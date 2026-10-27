import { useGameStore } from './store/gameStore';
import { Menu } from './screens/menu';
import { Home } from './screens/home';
import { Politicas } from './screens/politicas';
import { Pais } from './screens/pais';

export default function App() {
  const game = useGameStore((state) => state.game);
  const currentScreen = useGameStore((state) => state.currentScreen);

  if (!game) {
    return <Menu />;
  }

  return (
    <main>
      {currentScreen === 'dashboard' && <Home />}
      {currentScreen === 'politicas' && <Politicas />}
      {currentScreen === 'pais' && <Pais />}
    </main>
  );
}
