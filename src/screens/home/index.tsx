import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { GovernmentScreen } from './components/GovernmentScreen';
import { PolicyCreator } from './components/PolicyCreator';
import { VotingScreen } from './components/VotingScreen';
import { NationalInfo } from './components/nationalInfo';
import { NewsHome } from './components/newshome';
import { BrazilMapConnected } from './components/BrazilMap/connected';
import { STATES } from '../../game/data/states';
import type { StateId } from '../../game/types/game';

type Tab = 'mapa' | 'governo' | 'medidas' | 'votacao' | 'info' | 'noticias';
const TAB_LABEL: Record<Tab, string> = {
  mapa: 'Brasil', governo: 'Governo', medidas: 'Medidas', votacao: 'Votação', info: 'Indicadores', noticias: 'Notícias',
};

export function HomeScreen() {
  const game = useGameStore(s => s.game);
  const runMonth = useGameStore(s => s.runMonth);
  const isRunning = useGameStore(s => s.isRunningTurn);
  const [tab, setTab] = useState<Tab>('mapa');
  const [selectedState, setSelectedState] = useState<StateId | null>(null);

  if (!game) return <div>Carregando…</div>;

  const selected = selectedState ? game.states[selectedState] : null;

  return (
    <div className="home">
      <header className="topbar">
        <span>Turno {game.turn}</span>
        <span>Aprovação: {game.indicators.aprovacao.toFixed(1)}%</span>
        {game.playerName && <span>{game.playerName}</span>}
        <button onClick={runMonth} disabled={isRunning}>
          {isRunning ? 'Processando…' : 'Avançar mês'}
        </button>
      </header>

      <nav className="tabs">
        {(['mapa', 'governo', 'medidas', 'votacao', 'info', 'noticias'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? 'active' : ''}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'mapa' && (
          <div>
            <BrazilMapConnected
              selectedId={selectedState}
              onSelect={setSelectedState}
            />
            {selected && selectedState && (
              <div className="state-detail">
                <h3>{STATES[selectedState].name}</h3>
                <p>Região: {STATES[selectedState].region}</p>
                <p>População: {STATES[selectedState].population.toFixed(1)} mi</p>
                <p>Aprovação: {selected.approval.toFixed(1)}%</p>
                <button onClick={() => setSelectedState(null)}>Fechar</button>
              </div>
            )}
          </div>
        )}
        {tab === 'governo' && <GovernmentScreen />}
        {tab === 'medidas' && <PolicyCreator onCreated={() => setTab('votacao')} />}
        {tab === 'votacao' && <VotingScreen />}
        {tab === 'info' && <NationalInfo />}
        {tab === 'noticias' && <NewsHome />}
      </main>
    </div>
  );
}

// Compatibilidade com App.tsx
export { HomeScreen as Home };
