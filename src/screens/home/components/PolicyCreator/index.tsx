import { useState } from 'react';
import { useGameStore } from '../../../../store/gameStore';
import {
  FISCAL_MAGNITUDE_REAIS,
  INSTRUMENT_BY_ID,
} from '../../../../game/data/catalog';
import { GROUPS } from '../../../../game/data/groups';
import { getIndicator } from '../../../../game/data/indicators';

import type { AIInterpretation } from '../../../../game/types/ai';
import { checkOllama } from '../../../../game/services/ai/ollamaClient';
import { Modal } from './modal';
import styles from './styles.module.css';

// ============================================================
// CONSTANTES
// ============================================================

const MAX_EDITS = 5;

const RISK_LABEL: Record<string, string> = {
  baixo: 'risco jurídico baixo',
  medio: 'risco jurídico médio',
  alto: 'risco jurídico alto',
};

const AXIS_LABEL: Record<string, string> = {
  economia: 'Economia',
  saude: 'Saúde',
  educacao: 'Educação',
  seguranca: 'Segurança',
  infraestrutura: 'Infraestrutura',
  social: 'Social',
  ambiente: 'Meio Ambiente',
  gestao: 'Gestão',
  politica: 'Política',
};

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



function areaLabel(id: string): string {
  return AXIS_LABEL[id] ?? id;
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
  const objetivo = ai.objetivo;
  const areaPrincipal = ai.area_principal;
  const secundarias = ai.areas_secundarias ?? [];
  const beneficios = ai.beneficios ?? [];
  const riscos = ai.riscos ?? [];
  const colaterais = ai.efeitos_colaterais ?? [];

  const vazio =
    !objetivo &&
    !areaPrincipal &&
    secundarias.length === 0 &&
    beneficios.length + riscos.length + colaterais.length === 0;

  if (vazio) return null;

  return (
    <div className={styles.analysis}>
      {objetivo && (
        <p>
          <strong>Objetivo:</strong> {objetivo}
        </p>
      )}

      {(areaPrincipal || secundarias.length > 0) && (
        <div className={styles.tags}>
          {areaPrincipal && (
            <span className={`${styles.tag} ${styles.tagPrimary}`}>
              {areaLabel(areaPrincipal)}
            </span>
          )}
          {secundarias.map((a) => (
            <span key={a} className={styles.tag}>
              {areaLabel(a)}
            </span>
          ))}
          <span className={styles.tag}>Abrangência nacional</span>
        </div>
      )}

      {(beneficios.length > 0 ||
        riscos.length > 0 ||
        colaterais.length > 0) && (
        <div className={styles.analysisGrid}>
          {beneficios.length > 0 && (
            <div>
              <h4>Benefícios</h4>
              <ul className={styles.effectList}>
                {beneficios.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {riscos.length > 0 && (
            <div>
              <h4>Riscos</h4>
              <ul className={styles.effectList}>
                {riscos.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {colaterais.length > 0 && (
            <div>
              <h4>Efeitos colaterais</h4>
              <ul className={styles.effectList}>
                {colaterais.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
      await checkOllama();
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

  const handleDiscard = () => {
    discardProposal();
    resetForm();
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

  const grupos = pending?.analysis.grupos ?? {};
  const indicadores = pending?.analysis.indicadores ?? {};
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
              <button
                type="button"
                className={styles.danger}
                onClick={handleDiscard}
                disabled={busy}
              >
                Descartar
              </button>
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
              A proposta não foi enviada para votação. Confira o Ollama e
              tente novamente.
            </p>
          </>
        )}

        {pending && !isFallback && instrument && (
          <>
            <p className={styles.resumo}>
              {pending.analysis.interpretacao}
            </p>

            <AnalysisBlock ai={pending.analysis} />

            <div className={styles.instrument}>
              <span className={styles.instrumentLabel}>Vira</span>
              <strong className={styles.instrumentName}>
                {instrument.label}
              </strong>
              <span className={styles.muted}>{instrument.regra}</span>
            </div>

            <h4>Instrumento</h4>
            <p>
              {pending.analysis.motivo_instrumento || instrument.quandoUsar}
            </p>

            <h4>Impacto fiscal</h4>
            <p>
              <strong>
                {fiscal?.tipo === 'neutro' && 'Neutro'}
                {fiscal?.tipo === 'custo' &&
                  `Custo de ${formatBRL(Math.abs(fiscalAnual))} por ano`}
                {fiscal?.tipo === 'economia' &&
                  `Economia de ${formatBRL(Math.abs(fiscalAnual))} por ano`}
              </strong>
              {fiscal?.nota && (
                <span className={styles.muted}> · {fiscal.nota}</span>
              )}
            </p>

            {pending.analysis.intensidade > 0 && (
              <>
                <h4>
                  {instrument.vigoraAoAssinar
                    ? 'Choque ao assinar'
                    : 'Choque no dia em que virar lei'}
                </h4>
                <p className={styles.muted}>
                  Intensidade {pending.analysis.intensidade} de 3.
                </p>
              </>
            )}

            {Object.keys(grupos).length > 0 && (
              <>
                <h4>Efeito esperado nos grupos</h4>
                <ul className={styles.effectList}>
                  {Object.entries(grupos).map(([gid, delta]) => (
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

            {Object.keys(indicadores).length > 0 && (
              <>
                <h4>Efeitos estimados nos indicadores</h4>
                <ul className={styles.effectList}>
                  {Object.entries(indicadores).map(([iid, delta]) => {
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

            {pending.analysis.assessoria_juridica && (
              <p className={styles.legal}>
                <strong>Assessoria jurídica:</strong>{' '}
                {pending.analysis.assessoria_juridica}{' '}
                <span className={styles.muted}>
                  ({RISK_LABEL[pending.analysis.risco_juridico]})
                </span>
              </p>
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
