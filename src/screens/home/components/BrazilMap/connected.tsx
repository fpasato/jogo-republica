import { useGameStore } from '../../../../store/gameStore';
import { STATES, STATE_IDS } from '../../../../game/data/states';
import { BrazilMap, type BrazilMapState } from './index';
import type { StateId } from '../../../../game/types/game';

interface Props {
  selectedId?: StateId | null;
  onSelect?: (id: StateId) => void;
  onHover?: (id: StateId | null) => void;
  showLegend?: boolean;
  highlight?: (id: StateId) => boolean;
}

export function BrazilMapConnected({
  selectedId,
  onSelect,
  onHover,
  showLegend,
  highlight,
}: Props) {
  const states = useGameStore(s => s.game?.states);
  if (!states) return null;

  const data: BrazilMapState[] = STATE_IDS.map(id => ({
    ...STATES[id],
    approval: states[id].approval,
  }));

  return (
    <BrazilMap
      states={data}
      selectedId={selectedId}
      onSelect={onSelect}
      onHover={onHover}
      showLegend={showLegend}
      highlight={highlight}
    />
  );
}