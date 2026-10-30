import { useGameStore } from './store/gameStore';
import { Menu } from './screens/menu';
import { Home } from './screens/home';
import { Politicas } from './screens/politicas';
import { Pais } from './screens/pais';
import { Medidas } from './screens/medidas';
import { BackgroundAudio } from './components/BackgroundAudio';

export default function App() {
  const game = useGameStore((state) => state.game);
  const currentScreen = useGameStore((state) => state.currentScreen);

  return (
    <>
      <BackgroundAudio />
      {!game ? (
        <Menu />
      ) : (
        <main>
          {currentScreen === 'dashboard' && <Home />}
          {currentScreen === 'politicas' && <Politicas />}
          {currentScreen === 'pais' && <Pais />}
          {currentScreen === 'medidas' && <Medidas />}
        </main>
      )}
    </>
  );
}
