import { useState } from 'react';
import { useGameStore } from '../../../../store/gameStore';
import {
  FISCAL_MAGNITUDE_REAIS,
  INSTRUMENT_BY_ID,
} from '../../../../game/data/catalog';
import { GROUPS } from '../../../../game/data/groups';
import { getIndicator } from '../../../../game/data/indicators';
import { INDICATORS_BY_ID } from '../../../../game/data/indicators';
import { GROUP_SENSITIVITY } from '../../../../game/data/groupSensitivity';

import type { AIInterpretation } from '../../../../game/types/ai';
import { Modal } from './modal';
import { Loading } from './loading';
import styles from './styles.module.css';

// ============================================================
// CONSTANTES
// ============================================================

const MAX_EDITS = 5;

// ============================================================
// HELPERS
// ============================================================

function formatBRL(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `R$ ${(abs / 1e12).toFixed(1)} trilhão`;
  if (abs >= 1e9) return `R$ ${(abs / 1e9).toFixed(0)} bilhões`;
  if (abs >= 1e6) return `R$ ${(abs / 1e6).toFixed(0)} milhões`;
  return `R$ ${abs.toFixed(0)}`;
}

function formatSigned(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '—';
  const s = n.toFixed(decimals).replace(/\.?0+$/, '');
  return n > 0 ? `+${s}` : s;
}

function groupName(id: string): string {
  return GROUPS.find((g) => g.id === id)?.nome ?? id;
}

function indicatorLabel(id: string): {
  nome: string;
  unidade: string;
  direction: string;
} {
  try {
    const ind = getIndicator(id);
    return { nome: ind.nome, unidade: ind.unidade, direction: ind.direction };
  } catch {
    return { nome: id, unidade: '', direction: 'neutral' };
  }
}



// ============================================================
// CONTADOR DE TENTATIVAS
// ============================================================

function AttemptCounter({
  used,
  max,
}: {
  used: number;
  max: number;
}) {
  const left = Math.max(0, max - used);
  const level = left === 0 ? 'danger' : left <= 2 ? 'warning' : 'ok';

  return (
    <div className={styles.counter} data-level={level}>
      <div className={styles.counterDots} aria-hidden="true">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={styles.counterDot}
            data-filled={i < used}
          />
        ))}
      </div>
      <span className={styles.counterText}>
        {used} / {max}
      </span>
    </div>
  );
}

// ============================================================
// BLOCO DE ANÁLISE
// ============================================================

function AnalysisBlock({ ai }: { ai: AIInterpretation }) {
  return <p className={styles.resumo}>{ai.interpretacao}</p>;
}

// ============================================================
// TIPOS
// ============================================================

export interface PolicyCreatorProps {
  onConfirm?: (policy: PendingPolicy) => void;
  onAdvanceMonth?: () => void | Promise<void>;
  testMode?: boolean;
}

export interface PendingPolicy {
  instrument: string;
  name: string;
  originalText: string;
  interpretation: AIInterpretation;
}

// ============================================================
// COMPONENTE
// ============================================================

export function PolicyCreator({
  onConfirm,
  onAdvanceMonth,
  testMode = false,
}: PolicyCreatorProps) {
  const analyzeProposal = useGameStore((s) => s.analyzeProposal);
  const confirmProposal = useGameStore((s) => s.confirmProposal);
  const discardProposal = useGameStore((s) => s.discardProposal);
  const runMonth = useGameStore((s) => s.runMonth);

  const pending = useGameStore((s) => s.pendingProposal);
  const isAnalyzing = useGameStore((s) => s.isAnalyzing);
  const isRunningTurn = useGameStore((s) => s.isRunningTurn);
  const lastError = useGameStore((s) => s.lastError);

  const [policyName, setPolicyName] = useState('');
  const [proposalText, setProposalText] = useState('');
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const busy = isAnalyzing || isRunningTurn || isAdvancing;
  const attemptsLeft = Math.max(0, MAX_EDITS - attemptsUsed);
  const canAttempt = attemptsLeft > 0;
  const isLimitReached = attemptsUsed >= MAX_EDITS;

  // ---------- Handlers ----------

  const handleAnalyze = async () => {
    if (!proposalText.trim() || !canAttempt || busy) return;
    setConnectionError(null);
    setAttemptsUsed((n) => n + 1);
    try {
      discardProposal();
      await analyzeProposal(proposalText);
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const handleEdit = () => {
    if (busy) return;
    discardProposal();
  };

  const resetForm = () => {
    setPolicyName('');
    setProposalText('');
    setAttemptsUsed(0);
  };

  const handleConfirm = () => {
    if (!pending) return;
    const policy = {
      instrument: pending.analysis.instrumento,
      name:
        policyName ||
        pending.analysis.objetivo ||
        pending.analysis.interpretacao,
      originalText: pending.text,
      interpretation: pending.analysis,
    };
    if (onConfirm) onConfirm(policy);
    else confirmProposal();
    resetForm();
  };

  const handleAdvanceMonth = async () => {
    if (busy) return;
    setIsAdvancing(true);
    resetForm();
    try {
      if (onAdvanceMonth) await onAdvanceMonth();
      else runMonth();
    } finally {
      setIsAdvancing(false);
    }
  };

  // ---------- Derivados ----------

  const instrument = pending
    ? INSTRUMENT_BY_ID[pending.analysis.instrumento]
    : null;

  const fiscal = pending?.analysis.impacto_fiscal;
  const fiscalMagnitude = fiscal
    ? (fiscal.valor_anual_bi !== undefined
      ? fiscal.valor_anual_bi * 1e9
      : FISCAL_MAGNITUDE_REAIS[fiscal.magnitude] ?? 0)
    : 0;
  const fiscalAnual =
    fiscal?.tipo === 'custo'
      ? -fiscalMagnitude
      : fiscal?.tipo === 'economia'
        ? fiscalMagnitude
        : 0;
  const fiscalContextText = `${pending?.text ?? ''} ${fiscal?.nota ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isTaxMeasure = pending?.analysis.tipo_medida === 'imposto';
  const isTaxRelief = /isenc|desoner|reduc|reduzir|cortar|extinguir/.test(fiscalContextText);
  const fiscalLabel = fiscal?.tipo === 'economia'
    ? (isTaxMeasure ? 'Arrecadação estimada' : 'Economia de gastos estimada')
    : null;
  const fiscalCostLabel = isTaxMeasure
    ? (isTaxRelief ? 'Renúncia de receita estimada' : 'Custo de arrecadação')
    : pending?.analysis.tipo_medida === 'programa' ? 'Orçamento do programa' : 'Custo estimado';
  const fiscalNotEstimated = fiscal?.tipo === 'neutro' && /não estimada|não informado|não permite estimar/i.test(fiscal.nota);

  const grupos = pending?.analysis.grupos ?? {};
  const indicadores = pending?.analysis.indicadores ?? {};
  const cardEffects = (pending?.analysis.novosIndicadores ?? []).reduce<Record<string, number>>((all, card) => {
    if (card.tipo !== 'slider') return all;
    const change = (card.valorProposto ?? card.valorInicial) - card.valorInicial;
    const scale = Math.max(1, card.affectScale ?? 1);
    for (const [id, perUnit] of Object.entries(card.affects ?? {})) {
      if (!INDICATORS_BY_ID[id]) continue;
      all[id] = (all[id] ?? 0) + perUnit * change / scale;
    }
    return all;
  }, {});
  const shownIndicators = { ...indicadores, ...cardEffects };
  const shownGroups: Record<string, number> = Object.keys(grupos).length > 0 ? grupos : Object.fromEntries(
    Object.entries(GROUP_SENSITIVITY).map(([groupId, sensitivities]) => {
      const impact = Object.entries(cardEffects).reduce((sum, [id, delta]) => {
        const sensitivity = sensitivities[id] ?? 0;
        const definition = INDICATORS_BY_ID[id];
        if (!sensitivity || !definition) return sum;
        const normalized = definition.formatKind === 'percent' || definition.formatKind === 'score'
          ? delta
          : delta / (Math.abs(definition.initial) || 1) * 12;
        return sum + sensitivity * normalized;
      }, 0);
      return [groupId, Math.max(-15, Math.min(15, impact))];
    }).filter(([, impact]) => typeof impact === 'number' && Math.abs(impact) >= 0.05)
      .sort((a, b) => Math.abs(Number(b[1])) - Math.abs(Number(a[1])))
      .slice(0, 5),
  ) as Record<string, number>;
  const isFallback = !!pending?.analysis._fallback;
  const modalOpen = !!pending;

  // ---------- Render ----------

  return (
    <>
      <div className={styles.policyCreator}>
        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Nova medida</h2>
            {!testMode && (
              <AttemptCounter used={attemptsUsed} max={MAX_EDITS} />
            )}
            {testMode && <span className={styles.badge}>Modo de teste</span>}
          </header>

          <div className={styles.field}>
            <label htmlFor="policy-name">
              Nome da medida <span>(opcional)</span>
            </label>
            <input
              id="policy-name"
              type="text"
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              placeholder="Ex.: Programa de saneamento básico"
              disabled={busy}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="policy-text">Descreva o que deseja mudar</label>
            <textarea
              id="policy-text"
              value={proposalText}
              onChange={(e) => setProposalText(e.target.value)}
              placeholder="Ex.: Ampliar o acesso a saneamento básico no Nordeste, priorizando municípios com menor cobertura."
              rows={6}
              disabled={busy}
            />
          </div>

          {(connectionError || lastError) && (
            <p className={styles.error} role="alert">
              {connectionError || lastError}
            </p>
          )}

          {isLimitReached && !pending && (
            <p className={styles.error}>
              Você usou os {MAX_EDITS} envios deste mês. Assine, descarte ou
              avance o mês.
            </p>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.ghost}
              onClick={handleAdvanceMonth}
              disabled={busy}
              title="Encerra o mês sem propor nenhuma medida"
            >
              {isAdvancing ? 'Avançando…' : 'Avançar mês sem medida'}
            </button>

            <button
              type="button"
              className={styles.primary}
              onClick={handleAnalyze}
              disabled={busy || !proposalText.trim() || !canAttempt}
            >
              {isAnalyzing
                ? 'Analisando proposta…'
                : isLimitReached
                  ? 'Limite de análises atingido'
                  : `Analisar proposta (${attemptsLeft} restantes)`}
            </button>
          </div>
        </section>
      </div>
      
      {/* ⭐ NOVO: overlays de carregamento */}
      <Loading open={isAnalyzing} variant="analyze" />
      <Loading open={isAdvancing} variant="advance" />

      <Modal
        open={modalOpen}
        size="lg"
        title={
          isFallback
            ? 'Análise indisponível'
            : 'Os ministros entenderam a sua medida como:'
        }
        footer={
          isFallback ? (
            <>
              <button
                type="button"
                className={styles.ghost}
                onClick={handleEdit}
                disabled={busy}
              >
                Voltar à proposta
              </button>
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  discardProposal();
                  void handleAnalyze();
                }}
                disabled={busy || !proposalText.trim() || !canAttempt}
              >
                {canAttempt
                  ? `Tentar novamente (${attemptsLeft} restantes)`
                  : 'Sem tentativas restantes'}
              </button>
            </>
          ) : (
            <>
              {!testMode && (
                <button
                  type="button"
                  className={`${styles.ghost} ${styles.footerStart}`}
                  onClick={handleEdit}
                  disabled={busy}
                >
                  Voltar e reescrever
                </button>
              )}
              {!testMode && (
                <button
                  type="button"
                  className={styles.confirm}
                  onClick={handleConfirm}
                  disabled={busy}
                >
                  Assinar
                </button>
              )}
            </>
          )
        }
      >
        {isFallback && pending && (
          <>
            <p className={styles.error}>{pending.analysis.interpretacao}</p>
            <p className={styles.muted}>
              {pending.analysis.interpretacao.includes('429')
                ? 'Limite temporário da Groq. Aguarde um minuto e tente novamente.'
                : 'A proposta não foi enviada para votação. Confira o erro acima e tente novamente.'}
            </p>
          </>
        )}

        {pending && !isFallback && instrument && (
          <>
            <h2 className={styles.resumo}>{pending.analysis.titulo || 'Medida proposta'}</h2>
            <p><strong>Tipo: </strong>{pending.analysis.tipo_medida === 'imposto' ? 'Imposto' : pending.analysis.tipo_medida === 'beneficio' ? 'Benefício' : pending.analysis.tipo_medida === 'programa' ? 'Programa' : 'Medida'}</p>

            <AnalysisBlock ai={pending.analysis} />

            <div className={styles.instrument}>
              <span className={styles.instrumentLabel}>Instrumento</span>
              <strong className={styles.instrumentName}>
                {instrument.label}
              </strong>
              <span className={styles.muted}>{instrument.regra}</span>
            </div>

            {pending.analysis.motivo_instrumento && pending.analysis.motivo_instrumento !== instrument.regra && (
              <p className={styles.muted}>{pending.analysis.motivo_instrumento}</p>
            )}

            <h4>Impacto fiscal</h4>
            <p>
              <strong>
                {fiscalNotEstimated && pending?.analysis.tipo_medida === 'imposto' && 'Arrecadação não estimada'}
                {fiscalNotEstimated && pending?.analysis.tipo_medida !== 'imposto' && 'Impacto fiscal não estimado'}
                {!fiscalNotEstimated && fiscal?.tipo === 'neutro' && 'Neutro'}
                {fiscal?.tipo === 'custo' &&
                  `${fiscalCostLabel} de ${formatBRL(Math.abs(fiscalAnual))} por ano`}
                {fiscal?.tipo === 'economia' &&
                  `${fiscalLabel} de ${formatBRL(Math.abs(fiscalAnual))} por ano`}
              </strong>
              {fiscal?.nota && (
                <span className={styles.muted}> · {fiscal.nota}</span>
              )}
            </p>

            {Object.keys(shownGroups).length > 0 && (
              <>
                <h4>Efeito esperado nos grupos</h4>
                <ul className={styles.effectList}>
                  {Object.entries(shownGroups).map(([gid, delta]) => (
                    <li key={gid}>
                      <strong>{groupName(gid)}</strong>:{' '}
                      <span
                        className={
                          delta >= 0 ? styles.positive : styles.negative
                        }
                      >
                        {formatSigned(delta)}{' '}
                        {Math.abs(delta) < 2 ? 'ponto' : 'pontos'}
                      </span>{' '}
                      de aprovação
                    </li>
                  ))}
                </ul>
              </>
            )}

            {Object.keys(shownIndicators).length > 0 && (
              <>
                <h4>Atributos calculados afetados</h4>
                <ul className={styles.effectList}>
                  {Object.entries(shownIndicators).map(([iid, delta]) => {
                    const info = indicatorLabel(iid);
                    const bom =
                      info.direction === 'higher_is_better'
                        ? delta > 0
                        : info.direction === 'lower_is_better'
                          ? delta < 0
                          : null;
                    return (
                      <li key={iid}>
                        {info.nome}:{' '}
                        <span
                          className={
                            bom === null
                              ? undefined
                              : bom
                                ? styles.positive
                                : styles.negative
                          }
                        >
                          {formatSigned(delta)} {info.unidade}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {!testMode && (
              <p className={styles.muted}>
                Se isto não é o que você quis dizer, volte e reescreva: o mês
                não foi gasto ainda. Ao assinar, a medida passa a valer e não
                há como desfazer.
              </p>
            )}
          </>
        )}
      </Modal>
    </>
  );
}

export default PolicyCreator;
