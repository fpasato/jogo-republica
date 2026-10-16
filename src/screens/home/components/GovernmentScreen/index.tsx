import { useEffect, useState } from 'react';
import { useGameStore } from '../../../../store/gameStore';
import { SLIDERS } from '../../../../game/data/sliders';
import { GROUPS } from '../../../../game/data/groups';
import { STATES } from '../../../../game/data/states';
import { INDICATORS } from '../../../../game/data/indicators';
import type { GameState, SliderId } from '../../../../game/types/game';
import type { PolicyArea, PolicyMeasure } from '../../../../game/types/policy';
import styles from './styles.module.css';
import { projectPolicy } from '../../../../game/services/engine/policyProjection';


const THEMES: Array<{ id: string; title: string; sliders: SliderId[] }> = [
  { id: 'economia', title: 'Economia', sliders: ['impostos', 'selic', 'tarifasImportacao', 'gastosPublicos'] },
  { id: 'saude', title: 'Saúde', sliders: ['saude'] },
  { id: 'educacao', title: 'Educação', sliders: ['educacao'] },
  { id: 'seguranca', title: 'Segurança pública', sliders: ['policiamento', 'sistemaPrisional'] },
  { id: 'emprego', title: 'Emprego e renda', sliders: ['salarioMinimo'] },
  { id: 'social', title: 'Assistência social', sliders: ['beneficiosSociais'] },
  { id: 'infraestrutura', title: 'Infraestrutura e saneamento', sliders: ['investimentosPublicos'] },
  { id: 'meioAmbiente', title: 'Meio ambiente e energia', sliders: [] },
  { id: 'gestao', title: 'Administração pública', sliders: ['servidores', 'salariosServidores', 'privatizacao'] },
];

const AREA_LABEL: Record<PolicyArea, string> = {
  economia: 'Economia', saude: 'Saúde', educacao: 'Educação', seguranca: 'Segurança pública',
  infraestrutura: 'Infraestrutura e saneamento', social: 'Assistência social',
  meioAmbiente: 'Meio ambiente e energia', gestao: 'Administração pública',
};

function durationLabel(policy: PolicyMeasure, turn: number) {
  if (policy.duration === 'permanente') return 'Permanente';
  if (policy.activatedAtTurn == null) return `Duração: ${policy.duration} meses`;
  const elapsed = Math.max(0, turn - policy.activatedAtTurn - 1);
  return `Restam ${Math.max(0, policy.duration - elapsed)} meses`;
}
function formatMoney(v: number) {
  return `R$ ${Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} bi`;
}
function ActivePolicyCard({ policy, game }: { policy: PolicyMeasure; game: GameState }) {
  const turn = game.turn;
  const groupState = game.groups;
  const proj = projectPolicy(policy, game);

  const affected = policy.groupReactions.map(({ groupId, intensity }) => ({
    group: GROUPS[groupId],
    support: groupState?.[groupId]?.support,
    intensity,
  }));

  return (
    <article className={styles.policyCard}>
      <div className={styles.policyHeading}>
        <h3>{policy.name}</h3>
        <span className={styles.status}>{policy.status === 'active' ? 'Em vigor' : 'Encerrada'}</span>
      </div>
      <div className={styles.policyMeta}>{AREA_LABEL[policy.area]} · {policy.type}</div>
      {policy.parameters?.length ? (
        <div className={styles.parameters}>
          {policy.parameters.map(parameter => (
            <span key={parameter.key}>{parameter.label}: <b>{parameter.value.toLocaleString('pt-BR')} {parameter.unit}</b></span>
          ))}
        </div>
      ) : <p className={styles.muted}>Esta medida não declara parâmetros numéricos.</p>}
      <div className={styles.estimate}>
        <span>Impacto fiscal · estimativa</span>
        {proj.monthlyNet === 0 ? (
          <b>Sem impacto fiscal direto</b>
        ) : (
          <b className={proj.monthlyNet > 0 ? styles.bad : styles.good}>
            {proj.monthlyNet > 0 ? 'Gasto' : 'Economia'}: {formatMoney(proj.monthlyNet)}/mês
          </b>
        )}
        <small>
          Implantação: {formatMoney(proj.initialCost)} · recorrente: {formatMoney(proj.recurringCost)}/ano · receita: {formatMoney(proj.revenue)}/ano · economia: {formatMoney(proj.savings)}/ano · líquido anual: {formatMoney(proj.annualNet)}/ano.
          {' '}
          {proj.totalCost == null
            ? 'Medida permanente.'
            : `${proj.totalCost >= 0 ? 'Custo líquido até o fim' : 'Economia líquida até o fim'}: ${formatMoney(proj.totalCost)}.`}
        </small>
      </div>

      <div className={styles.estimate}>
        <span>Indicadores nacionais alterados diretamente · estimativa da IA</span>
        {proj.effects.length ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {proj.effects.map(e => (
              <li key={e.indicatorId} style={{ marginBottom: 8 }}>
                <b className={(INDICATORS[e.indicatorId]?.direction ?? 0) * e.totalDelta > 0 ? styles.good : (INDICATORS[e.indicatorId]?.direction ?? 0) * e.totalDelta < 0 ? styles.bad : ''}>{e.label}</b>: {e.totalDelta > 0 ? '+' : ''}
                {e.totalDelta.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                {e.unit ? ` ${e.unit}` : ''}
                <br />
                <small>
                  Aplicado: {e.appliedDelta > 0 ? '+' : ''}
                  {e.appliedDelta.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                  {' '}({Math.round(e.progress * 100)}%) · começa em {e.delayMonths}m, completo em {e.delayMonths + e.rampMonths}m
                </small>
                <progress value={e.progress} max={1} style={{ width: '100%' }} />
              </li>
            ))}
          </ul>
        ) : (
          <b className={styles.unknown}>Esta medida não tem efeitos numéricos</b>
        )}
      </div>
      <div className={styles.groups}>
        <span className={styles.groupTitle}>Estados com alteração direta de aprovação</span>
        {policy.stateEffects?.length ? policy.stateEffects.map(effect => (
          <span className={styles.group} key={effect.stateId}>
            {STATES[effect.stateId]?.name ?? effect.stateId} <b>{effect.target > 0 ? '+' : ''}{effect.target.toFixed(1)} p.p.</b>
          </span>
        )) : <span className={styles.muted}>Nenhum estado alterado diretamente</span>}
      </div>
      <small className={styles.muted}>Os demais estados recebem apenas efeitos indiretos da simulação nacional.</small>
      <div className={styles.groups}>
        <span className={styles.groupTitle}>Grupos afetados · apoio atual</span>
        {affected.length ? affected.map(({ group, support, intensity }) => (
          <span className={styles.group} key={group.id}>
            {group.name} · <b>{support == null ? '—' : `${support.toFixed(1)}%`}</b> · reação{' '}
            <b className={intensity > 0 ? styles.good : intensity < 0 ? styles.bad : ''}>{intensity > 0 ? '+' : ''}{intensity.toFixed(2)}</b>
          </span>
        )) : <span className={styles.muted}>Nenhum grupo identificado</span>}
      </div>
      <footer className={styles.policyFooter}>
        <span>Implementação: {policy.timeToEffect} {policy.timeToEffect === 1 ? 'mês' : 'meses'}</span>
        <b>{durationLabel(policy, turn)}</b>
      </footer>
    </article>
  );
}

export function GovernmentScreen() {
  const game = useGameStore(s => s.game);
  const saveSlider = useGameStore(s => s.saveSlider);
  const [drafts, setDrafts] = useState(game?.sliders);

  useEffect(() => {
    if (game) setDrafts(game.sliders);
  }, [game?.turn, game?.sliders]);

  if (!game || !drafts) return null;
  const activePolicies = game.activePolicies.filter(policy => policy.status === 'active');
  const allocatedSpending = (Object.keys(SLIDERS) as SliderId[])
    .filter(id => SLIDERS[id].insideBudget)
    .reduce((total, id) => total + game.sliders[id], 0);
  const effectiveSpendingEnvelope = Math.max(game.sliders.gastosPublicos, allocatedSpending);

  return (
    <div className={styles.page}>
      <section>
        <h1>Controles permanentes</h1>
        <p className={styles.intro}>Ajuste cada parâmetro e salve uma vez por mês; a simulação aplica a mudança ao avançar o turno.</p>
        <div className={styles.themeGrid}>
          {THEMES.map(theme => (
            <section className={styles.theme} key={theme.id}>
              <h2>{theme.title}</h2>
              {theme.sliders.length ? theme.sliders.map(id => {
                const def = SLIDERS[id];
                const value = game.sliders[id];
                const draft = drafts[id];
                const isSaved = game.sliderSavedAtTurn?.[id] === game.turn;
                const hasPendingChange = draft !== value;
                return (
                  <label className={styles.control} key={id}>
                    <span><b>{def.name}</b><output>{draft.toLocaleString('pt-BR')} {def.unit}</output></span>
                    <input
                      type="range"
                      min={def.min}
                      max={def.max}
                      step={def.step}
                      value={draft}
                      aria-label={def.name}
                      disabled={isSaved}
                      onChange={event => setDrafts(current => current ? { ...current, [id]: Number(event.target.value) } : current)}
                    />
                    <small>{def.description}</small>
                    <div className={styles.controlFooter}>
                      <span className={isSaved ? styles.saved : hasPendingChange ? styles.pending : ''}>
                        {isSaved ? 'Bloqueado até o próximo mês' : hasPendingChange ? 'Alteração pendente' : 'Valor vigente'}
                      </span>
                      <button
                        type="button"
                        className={styles.saveButton}
                        disabled={isSaved || !hasPendingChange}
                        onClick={() => saveSlider(id, draft)}
                      >
                        {isSaved ? 'Salvo' : 'Salvar'}
                      </button>
                    </div>
                  </label>
                );
              }) : <p className={styles.muted}>Sem controle permanente configurado. Crie uma medida para este tema.</p>}
            </section>
          ))}
        </div>
        <p className={styles.budgetNote}>
          Despesas setoriais: R$ {allocatedSpending.toLocaleString('pt-BR')} bi/ano · orçamento total: R$ {game.sliders.gastosPublicos.toLocaleString('pt-BR')} bi/ano · envelope considerado: R$ {effectiveSpendingEnvelope.toLocaleString('pt-BR')} bi/ano. Os orçamentos de saúde, educação e demais áreas compõem o total e não são somados duas vezes.
        </p>
      </section>

      <section>
        <h2>Medidas em vigor</h2>
        {activePolicies.length ? (
          <div className={styles.policyGrid}>
            {activePolicies.map(policy => <ActivePolicyCard key={policy.id} policy={policy} game={game} />)}
          </div>
        ) : <p className={styles.muted}>Ainda não há medidas aprovadas em vigor.</p>}
      </section>
    </div>
  );
}
