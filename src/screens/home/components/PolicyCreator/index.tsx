import { useState } from 'react';
import { useGameStore } from '../../../../store/gameStore';
import { GROUPS } from '../../../../game/data/groups';
import { INDICATORS } from '../../../../game/data/indicators';
import { STATES } from '../../../../game/data/states';
import type { PolicyArea } from '../../../../game/types/policy';
import { projectPolicy } from '../../../../game/services/engine/policyProjection';
import styles from './styles.module.css';

interface Props { onCreated: () => void; }

const AREA_LABEL: Record<PolicyArea, string> = {
  economia: 'Economia', saude: 'Saúde', educacao: 'Educação', seguranca: 'Segurança pública',
  infraestrutura: 'Infraestrutura e saneamento', social: 'Assistência social',
  meioAmbiente: 'Meio ambiente e energia', gestao: 'Administração pública',
};

export function PolicyCreator({ onCreated }: Props) {
  const [text, setText] = useState('');
  const pending = useGameStore(s => s.pendingProposal);
  const game = useGameStore(s => s.game);
  const isAnalyzing = useGameStore(s => s.isAnalyzing);
  const lastError = useGameStore(s => s.lastError);
  const analyze = useGameStore(s => s.analyzeProposal);
  const confirm = useGameStore(s => s.confirmProposal);
  const discard = useGameStore(s => s.discardProposal);
  const projection = pending && game ? projectPolicy(pending.policy, game) : null;

  const handleAnalyze = () => {
    if (text.trim().length >= 10) void analyze(text.trim());
  };
  const handleConfirm = () => {
    if (confirm()) {
      setText('');
      onCreated();
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.composer}>
        <label htmlFor="policy-description">Descreva a medida</label>
        <textarea
          id="policy-description"
          value={text}
          onChange={event => setText(event.target.value)}
          rows={3}
          placeholder="Ex.: Criar benefício mensal de R$ 600 para famílias de baixa renda."
        />
        <button className={styles.primary} onClick={handleAnalyze} disabled={isAnalyzing || text.trim().length < 10}>
          {isAnalyzing ? 'Interpretando…' : 'Analisar medida'}
        </button>
      </section>

      {lastError && <p className={styles.error} role="alert">{lastError}</p>}

      {pending && (
        <article className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <h2>{pending.policy.name}</h2>
              <span>{AREA_LABEL[pending.policy.area]} · {pending.policy.type}</span>
            </div>
            <span className={styles.draft}>Proposta</span>
          </header>

          <p className={styles.description}>{pending.policy.description}</p>

          <section className={styles.parameters}>
            <h3>Parâmetros da medida</h3>
            {pending.policy.parameters?.length ? pending.policy.parameters.map(parameter => (
              <div className={styles.parameter} key={parameter.key}>
                <span>{parameter.label}</span>
                <b>{parameter.value.toLocaleString('pt-BR')} {parameter.unit}</b>
              </div>
            )) : <p className={styles.muted}>A análise não identificou parâmetros numéricos. Confirme os dados no texto da proposta.</p>}
          </section>

          <div className={styles.infoGrid}>
            <section className={styles.info}>
              <h3>Impacto fiscal estimado</h3>
              {projection && <b className={projection.monthlyNet > 0 ? styles.bad : projection.monthlyNet < 0 ? styles.good : styles.unknown}>
                {projection.monthlyNet > 0 ? 'Gasto líquido' : projection.monthlyNet < 0 ? 'Economia líquida' : 'Sem impacto líquido direto'}: R$ {Math.abs(projection.monthlyNet).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} bi/mês
              </b>}
              <small>Implantação R$ {pending.policy.initialCost.toLocaleString('pt-BR')} bi · recorrente R$ {pending.policy.recurringCost.toLocaleString('pt-BR')} bi/ano · economia R$ {pending.policy.savings.toLocaleString('pt-BR')} bi/ano · receita R$ {pending.policy.revenue.toLocaleString('pt-BR')} bi/ano.
                {projection?.totalCost != null && <> Líquido até o fim: R$ {Math.abs(projection.totalCost).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} bi.</>}
              </small>
            </section>
            <section className={styles.info}>
              <h3>Indicadores nacionais alterados diretamente · estimativa da IA</h3>
              {pending.policy.indicatorEffects.length ? (
                <div className={styles.estimatedEffects}>
                  {pending.policy.indicatorEffects.map(effect => (
                    <span className={(INDICATORS[effect.indicatorId]?.direction ?? 0) * effect.target > 0 ? styles.good : (INDICATORS[effect.indicatorId]?.direction ?? 0) * effect.target < 0 ? styles.bad : ''} key={effect.indicatorId}>
                      <b>{INDICATORS[effect.indicatorId]?.name ?? effect.indicatorId}</b> {effect.target > 0 ? '+' : ''}{effect.target.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {INDICATORS[effect.indicatorId]?.unit} · começa em {effect.delayMonths}m, gradual por {effect.rampMonths}m · {effect.reason}
                    </span>
                  ))}
                </div>
              ) : <b className={styles.unknown}>Não identificados</b>}
              <small>Os efeitos são aplicados gradualmente; outros indicadores são derivados pelo motor.</small>
            </section>
          </div>

          <section className={styles.groups}>
            <h3>Estados com alteração direta de aprovação</h3>
            {pending.policy.stateEffects?.length ? pending.policy.stateEffects.map(effect => (
              <span className={styles.group} key={effect.stateId}>
                {STATES[effect.stateId]?.name ?? effect.stateId} <b className={effect.target > 0 ? styles.good : styles.bad}>{effect.target > 0 ? '+' : ''}{effect.target.toFixed(1)} p.p.</b> · {effect.reason}
              </span>
            )) : <span className={styles.muted}>Nenhum estado indicado. Os demais recebem apenas efeitos indiretos.</span>}
          </section>

          <section className={styles.groups}>
            <h3>Grupos afetados · apoio atual</h3>
            {pending.policy.groupReactions.length ? pending.policy.groupReactions.map(reaction => {
              const group = GROUPS[reaction.groupId];
              const support = game?.groups[reaction.groupId]?.support;
              return (
                <span className={styles.group} key={reaction.groupId}>
                  {group.name} · apoio atual <b>{support == null ? '—' : `${support.toFixed(1)}%`}</b> · reação estimada{' '}
                  <b className={reaction.intensity > 0 ? styles.good : reaction.intensity < 0 ? styles.bad : ''}>{reaction.intensity > 0 ? '+' : ''}{reaction.intensity.toFixed(2)}</b>
                </span>
              );
            }) : <span className={styles.muted}>A análise não identificou grupos afetados.</span>}
            <small>A simulação atualiza o apoio ao longo dos turnos.</small>
          </section>

          <footer className={styles.footer}>
            <div className={styles.timeline}>
              <span>Primeiros efeitos: {pending.policy.timeToEffect} {pending.policy.timeToEffect === 1 ? 'mês' : 'meses'}</span>
              <b>{pending.policy.duration === 'permanente' ? 'Permanente' : `Ativa por ${pending.policy.duration} meses`}</b>
              <small>Se aprovada, entra em vigor no próximo mês; os impactos se acumulam gradualmente.</small>
            </div>
            <div className={styles.actions}>
              <button className={styles.primary} onClick={handleConfirm}>Enviar para votação</button>
              <button className={styles.secondary} onClick={discard}>Descartar</button>
            </div>
          </footer>

          {pending.warnings.length > 0 && (
            <div className={styles.warnings}>
              {pending.warnings.map((warning, index) => <p key={index}>Atenção: {warning}</p>)}
            </div>
          )}
        </article>
      )}
    </div>
  );
}

export type { PolicyArea };
