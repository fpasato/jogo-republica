import { useState } from 'react';
import styles from './styles.module.css';

import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { NationalInfo } from './components/nationalInfo';
import { PolicyCreator, type PendingPolicy } from './components/PolicyCreator';
import { BrazilMap } from './components/BrazilMap';
import { NewsHome } from './components/newshome';
import { VotingScreen } from './components/VotingScreen';
import { STATES, STATE_IDS, type StateId } from '../../game/data/states';
import { useGameStore } from '../../store/gameStore';
import { runVoting, type VotingOutcome } from '../../game/services/parliament/votingService';
import { runFeedPipeline } from '../../game/services/social/feedOrchestrator';
import type { Noticia, Post } from '../../game/types/ai';

const LOADING_LABEL: Record<string, string> = {
  turn: 'Aplicando a medida e atualizando os indicadores…',
  player_posts: 'Analisando a repercussão das publicações…',
  news: 'Redigindo as notícias do mês…',
  social: 'Preparando a repercussão nas redes…',
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
  const [posts, setPosts] = useState<Post[]>([]);

  const mapStates = STATE_IDS.map((id) => ({
    ...STATES[id],
    approval: game?.stateApprovals[id] ?? game?.nationalApproval ?? 50,
  }));

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

  const generateMonthlyFeed = async () => {
    setNewsError(null);
    setLoadingStage('turn');
    const prepared = prepareMonth();
    if (!prepared) {
      const error = useGameStore.getState().lastError;
      throw new Error(error ?? 'Não foi possível calcular o próximo mês.');
    }

    try {
      const result = await runFeedPipeline(
        {
          game: prepared.game,
          history: prepared.game.history,
          lastTurnLog: prepared.log,
          lastTurnSummary: prepared.summary,
          playerPostsFromLastTurn: [],
          playerSeed: {
            nome: prepared.game.profile.playerName,
            handle: '@presidente',
            ideology: prepared.game.profile.govIdeologyLabel ?? 'centro_esquerda',
          },
          socialPostCount: 10,
        },
        {
          timeoutMs: 45_000,
          maxAttempts: 1,
          onProgress: (stage) => setLoadingStage(stage),
        },
      );
      setNoticias(result.noticias);
      setPosts(result.posts);
    } catch (error) {
      // O mês é aplicado mesmo se houver uma falha inesperada no feed.
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
      await generateMonthlyFeed();
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

  const advanceWithoutPolicy = async () => {
    try {
      await generateMonthlyFeed();
    } catch (error) {
      setNewsError(error instanceof Error ? error.message : 'Falha ao preparar o jornal deste mês.');
    } finally {
      setLoadingStage(null);
    }
  };

  return (
    <div className={styles.container}>
      <Header />
      <NationalInfo />
      <div className={styles.contentGrid}>
        <PolicyCreator onConfirm={(policy) => { void startVoting(policy); }} onAdvanceMonth={advanceWithoutPolicy} />
        <BrazilMap
          states={mapStates}
          selectedId={selectedState}
          onSelect={setSelectedState}
        />
        <NewsHome noticias={noticias} posts={posts} isLoading={!!loadingStage} error={newsError} />
      </div>

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
