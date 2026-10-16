import { useState } from 'react';
import { initialParties } from '../../game/types/politics';
import { useGameStore } from '../../store/gameStore';
import styles from './NewGameForm.module.css';

interface Props {
  onCreated?: () => void;
}

export function NewGameForm({ onCreated }: Props) {
  const [name, setName] = useState('');
  const [partyId, setPartyId] = useState<string>(initialParties[0]?.id ?? '');
  const [isCreating, setIsCreating] = useState(false);
  const newGame = useGameStore(s => s.newGame);

  const canSubmit = name.trim().length >= 2 && partyId;

  const handleSubmit = async () => {
    if (!canSubmit || isCreating) return;
    setIsCreating(true);
    try {
      await newGame(name.trim(), partyId);
      onCreated?.();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={e => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <h2>Nova partida</h2>

      <label>
        Nome do jogador
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex.: Presidente Silva"
          maxLength={40}
        />
      </label>

      <label>
        Partido
        <select value={partyId} onChange={e => setPartyId(e.target.value)}>
          {initialParties.map(p => (
            <option key={p.id} value={p.id}>
              {p.acronym} — {p.name}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" disabled={!canSubmit || isCreating}>
        {isCreating ? 'Criando…' : 'Começar'}
      </button>
    </form>
  );
}
