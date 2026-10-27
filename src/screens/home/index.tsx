import { useState } from 'react';
import styles from './styles.module.css';

import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { PolicyCreator, type PendingPolicy } from './components/PolicyCreator';
import { BrazilMap } from './components/BrazilMap';
import { NewsHome } from './components/newshome';
import { VotingScreen } from './components/VotingScreen';
import { STATES, STATE_IDS, type StateId } from '../../game/data/states';
import { useGameStore } from '../../store/gameStore';
import { runVoting, type VotingOutcome } from '../../game/services/parliament/votingService';
import { pickNewsArticle } from '../../game/services/engine/newsPicker';
import type { Noticia } from '../../game/types/ai';

const LOADING_LABEL: Record<string, string> = {
  turn: 'Aplicando a medida e atualizando os indicadores…',
  news: 'Preparando as notícias do mês…',
};

export function Home() {
  const game = useGameStore((state) => state.game);
  const saveId = useGameStore((state) => state.saveId);
  const confirmProposal = useGameStore((state) => state.confirmProposal);
  const discardProposal = useGameStore((state) => state.discardProposal);
  const prepareMonth = useGameStore((state) => state.prepareMonth);
  const commitPreparedMonth = useGameStore((state) => state.commitPreparedMonth);
  const [selectedState, setSelectedState] = useState<StateId | null>(null);
  const [votingOpen, setVotingOpen] = useState(false);
  const [voteOutcome, setVoteOutcome] = useState<VotingOutcome | null>(null);
  const [policyForVote, setPolicyForVote] = useState<PendingPolicy | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState<string | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [noticias, setNoticias] = useState<Noticia[]>([]);

  const mapStates = STATE_IDS.map((id) => {
    const state = STATES[id];
    const nat = game?.nationalApproval ?? 50;
    const govIdeology = game?.profile.govIdeology ?? 0; // -3 (esquerda) a +3 (direita)

    // Ajuste regional estrutural:
    // Sul e Sudeste têm histórico mais liberal/conservador (direita)
    // Norte e Nordeste têm histórico mais trabalhista/redistributivo (esquerda)
    // Centro-Oeste é fortemente agro/conservador (direita)
    let regionalLean = 0;
    if (state.region === 'Sul') regionalLean = 0.55;
    else if (state.region === 'Sudeste') regionalLean = 0.35;
    else if (state.region === 'Centro-Oeste') regionalLean = 0.60;
    else if (state.region === 'Nordeste') regionalLean = -0.65;
    else if (state.region === 'Norte') regionalLean = -0.20;

    // Combina inclinação específica do estado com o alinhamento regional
    const totalLean = (state.politicalInclination * 0.5) + (regionalLean * 0.5);

    // Se govIdeology for > 0 (direita): soma no Sul/Sudeste/CO e subtrai no Norte/Nordeste
    // Se govIdeology for < 0 (esquerda): soma no Norte/Nordeste e subtrai no Sul/Sudeste
    const shift = (govIdeology / 3) * totalLean * 16;
    const approval = Math.min(100, Math.max(1, nat + shift));
    return {
      ...state,
      approval,
    };
  });

  const startVoting = async (policy: PendingPolicy) => {
    setPolicyForVote(policy);
    setVoteOutcome(null);
    setVoteError(null);
    setVotingOpen(true);

    try {
      if (saveId === null || !game) throw new Error('Não foi possível localizar o save desta partida.');
      const outcome = await runVoting(saveId, policy.instrument, {
        governmentApproval: game.nationalApproval,
        policyPosition: policy.interpretation.posicao_ideologica,
        playerPartyId: game.profile.partyId,
      });
      setVoteOutcome(outcome);
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : 'Não foi possível calcular a votação.');
    }
  };

  const generateMonthlyNews = () => {
    setNewsError(null);
    setLoadingStage('turn');
    const prepared = prepareMonth();
    if (!prepared) {
      const error = useGameStore.getState().lastError;
      throw new Error(error ?? 'Não foi possível calcular o próximo mês.');
    }

    try {
      const noticia = pickNewsArticle({
        month: prepared.game.month,
        year: prepared.game.year,
        nationalApproval: prepared.game.nationalApproval,
        indicators: prepared.game.macros,
      });
      setNoticias([noticia]);
    } catch (error) {
      commitPreparedMonth(prepared);
      throw error;
    }
    commitPreparedMonth(prepared);
  };

  const finishVoting = async (outcome: VotingOutcome) => {
    if (!outcome.approved) {
      discardProposal();
      setVotingOpen(false);
      setPolicyForVote(null);
      setVoteOutcome(null);
      return;
    }

    if (!policyForVote) {
      setVoteError('A proposta aprovada não está disponível para assinatura.');
      return;
    }
    const signed = confirmProposal({
      text: policyForVote.originalText,
      analysis: policyForVote.interpretation,
      name: policyForVote.name,
    });
    if (!signed) {
      setVoteError('Não foi possível adicionar a medida ao jogo; o mês não foi avançado.');
      return;
    }
    setVotingOpen(false);
    setVoteOutcome(null);
    setLoadingStage('turn');
    try {
      generateMonthlyNews();
    } catch (error) {
      setNewsError(error instanceof Error ? error.message : 'Falha ao preparar o jornal deste mês.');
    } finally {
      setLoadingStage(null);
      setPolicyForVote(null);
    }
  };

  const cancelVoting = () => {
    discardProposal();
    setVotingOpen(false);
    setPolicyForVote(null);
    setVoteOutcome(null);
    setVoteError(null);
  };

  const advanceWithoutPolicy = () => {
    try {
      generateMonthlyNews();
    } catch (error) {
      setNewsError(error instanceof Error ? error.message : 'Falha ao preparar o jornal deste mês.');
    } finally {
      setLoadingStage(null);
    }
  };

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.contentGrid}>
        {/* Coluna principal: ação + feedback */}
        <div className={styles.mainColumn}>
          <PolicyCreator
            onConfirm={(policy) => { void startVoting(policy); }}
            onAdvanceMonth={advanceWithoutPolicy}
          />
          <NewsHome
            noticias={noticias}
            isLoading={!!loadingStage}
            error={newsError}
          />
        </div>

        {/* Coluna lateral: contexto (mapa) — fica sticky ao rolar */}
        <aside className={styles.sideColumn} aria-label="Situação por estado">
          <BrazilMap
            states={mapStates}
            selectedId={selectedState}
            onSelect={setSelectedState}
          />
        </aside>
      </main>

      {votingOpen && (
        <VotingScreen
          outcome={voteOutcome}
          policyName={policyForVote?.name}
          error={voteError}
          onCancel={cancelVoting}
          onFinish={finishVoting}
        />
      )}

      {loadingStage && (
        <div className={styles.loadingOverlay} role="status" aria-live="polite">
          <div className={styles.loadingCard}>
            <span className={styles.spinner} aria-hidden="true" />
            <h2>Fechando o mês</h2>
            <p>{LOADING_LABEL[loadingStage] ?? 'Preparando as notícias…'}</p>
            <small>O jogo avançará assim que esta etapa terminar.</small>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}