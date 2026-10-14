import { useGameStore } from './store/gameStore';
import { Menu } from './screens/menu';
import { Home } from './screens/home';

export default function App() {
  const game = useGameStore((state) => state.game);

  return (
    <main>
      {game ? <Home /> : <Menu />}
    </main>
  );
}
