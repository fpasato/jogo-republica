import { useState } from 'react';
import { useGameStore } from '../../../../store/gameStore';
import { GROUPS } from '../../../../game/data/groups';
import { INDICATORS } from '../../../../game/data/indicators';
import { STATES } from '../../../../game/data/states';
import { OFFERS } from '../../../../game/services/parliament/negotiationService';
import { initialParties } from '../../../../game/types/politics';
import styles from './styles.module.css';

export function VotingScreen() {
  const game = useGameStore(s => s.game);
  const negotiation = useGameStore(s => s.negotiation);
  const outcome = useGameStore(s => s.votingOutcome);
  const setOffer = useGameStore(s => s.setOffer);
  const submit = useGameStore(s => s.submitToVoting);

  const [partyId, setPartyId] = useState<string>(initialParties[0]?.id ?? '');

  if (!game) return null;
  const pending = game.pendingPolicies[game.pendingPolicies.length - 1];

  if (!pending) {
    return (
      <div className={styles.empty}>
        <p>Nenhuma medida pendente. Crie uma em "Medidas".</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.policy}>
        <h3>{pending.name}</h3>
        <p>{pending.description}</p>
        <p className={styles.tag}>{pending.area} · {pending.type}</p>

        {pending.parameters?.length ? (
          <div className={styles.policyParameters}>
            {pending.parameters.map(parameter => (
              <span key={parameter.key}>{parameter.label}: <strong>{parameter.value.toLocaleString('pt-BR')} {parameter.unit}</strong></span>
            ))}
          </div>
        ) : <p className={styles.muted}>Esta proposta não informa parâmetros numéricos.</p>}
        <h4>Indicadores nacionais alterados diretamente · estimativa da IA</h4>
        {pending.indicatorEffects.length ? <ul>
          {pending.indicatorEffects.map(effect => (
            <li key={effect.indicatorId}>
              <strong>{INDICATORS[effect.indicatorId]?.name ?? effect.indicatorId}:</strong> {effect.target > 0 ? '+' : ''}{effect.target.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {INDICATORS[effect.indicatorId]?.unit} · {effect.reason}
            </li>
          ))}
        </ul> : <p className={styles.muted}>Nenhum indicador nacional direto informado.</p>}
        <p className={styles.muted}>Os demais indicadores são derivados pelo motor durante os turnos.</p>
        <h4>Estados com alteração direta de aprovação</h4>
        {pending.stateEffects?.length ? <ul>
          {pending.stateEffects.map(effect => (
            <li key={effect.stateId}>
              <strong>{STATES[effect.stateId]?.name ?? effect.stateId}:</strong> {effect.target > 0 ? '+' : ''}{effect.target.toFixed(1)} p.p. · {effect.reason}
            </li>
          ))}
        </ul> : <p className={styles.muted}>Nenhum estado afetado diretamente; os estados reagem indiretamente à simulação nacional.</p>}
        <h4>Grupos afetados · apoio atual</h4>
        <ul>
          {pending.groupReactions.map(reaction => {
            const group = GROUPS[reaction.groupId];
            return (
              <li key={reaction.groupId}>
                <strong>{group.name}:</strong> {game.groups[reaction.groupId].support.toFixed(1)}%
              </li>
            );
          })}
        </ul>
        <ul>
          {pending.groupReactions.map(reaction => (
            <li key={reaction.groupId}>
              Reação estimada: {reaction.intensity > 0 ? '+' : ''}{reaction.intensity.toFixed(2)} · {reaction.reason}
            </li>
          ))}
        </ul>
        <p className={styles.muted}>O apoio é recalculado pelo motor a cada mês.</p>
        <p className={styles.muted}>
          Primeiros efeitos: {pending.timeToEffect} {pending.timeToEffect === 1 ? 'mês' : 'meses'} · {' '}
          {pending.duration === 'permanente' ? 'Permanente' : `Duração de ${pending.duration} meses`}
        </p>
        <p className={styles.muted}>Se aprovada, entra em vigor no próximo mês.</p>
      </div>

      <div className={styles.negotiation}>
        <h4>Negociação</h4>
        <select value={partyId} onChange={e => setPartyId(e.target.value)}>
          {initialParties.map(p => (
            <option key={p.id} value={p.id}>{p.acronym} — {p.name}</option>
          ))}
        </select>

        <div className={styles.offers}>
          {OFFERS.map(o => {
            const enabled = (negotiation[partyId] ?? []).includes(o.id);
            return (
              <button
                key={o.id}
                className={enabled ? styles.active : ''}
                onClick={() => setOffer(partyId, o.id, !enabled)}
              >
                <strong>{o.label}</strong>
                <small>{o.descricao}</small>
                <span>+{o.bonus} apoio · −{o.custoAprovacao} popularidade · −{(o.diluicao * 100).toFixed(0)}% efeito</span>
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={() => submit(null)} className={styles.submit}>
        Levar à votação
      </button>

      {outcome && (
        <div className={styles.outcome}>
          <h3>{outcome.approved ? '✓ Aprovada' : '✗ Rejeitada'}</h3>
          {outcome.rejectedAt && <p>Rejeitada em: {outcome.rejectedAt}</p>}
          <table>
            <thead>
              <tr>
                <th>Casa</th>
                <th>Sim</th>
                <th>Não</th>
                <th>Abst.</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {outcome.stages.map((s, i) => (
                <tr key={i}>
                  <td>{s.stage}{s.turno ? ` (${s.turno}º turno)` : ''}</td>
                  <td>{s.yes}</td>
                  <td>{s.no}</td>
                  <td>{s.abstain}</td>
                  <td>{s.approved ? '✓' : '✗'} — {s.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
