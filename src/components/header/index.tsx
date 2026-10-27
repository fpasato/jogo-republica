import styles from './styles.module.css';
import { useGameStore } from '../../store/gameStore';
import logo from '../../assets/logo.png';

interface HeaderProps {
    onBackToMenu?: () => void;
}

export function Header({ onBackToMenu }: HeaderProps) {
    const game = useGameStore((state) => state.game);
    const reset = useGameStore((state) => state.reset);
    const currentScreen = useGameStore((state) => state.currentScreen);
    const setScreen = useGameStore((state) => state.setScreen);
    const monthLabel = game
        ? new Date(game.year, game.month - 1, 1).toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric',
        })
        : '';

    const handleBackToMenu = () => {
        if (onBackToMenu) onBackToMenu();
        else reset();
    };

    return (
        <header className={styles.header}>
            <div className={styles.headertop}>
                <div className={styles.logoContainer}>
                    <img src={logo} alt="Logo" className={styles.logo} />
                </div>
                <div className={styles.headerInfo}>
                    <div className={styles.presidentInfo}>
                        <p className={styles.name}>Presidente: {game?.profile.playerName ?? '—'}</p>
                        <p className={styles.party}>Partido: {game?.profile.partyAcronym ?? '—'}</p>
                    </div>
                    <div className={styles.monthInfo}>
                        <p className={styles.month}>{monthLabel}</p>
                        <button
                            type="button"
                            className={styles.exitButton}
                            onClick={handleBackToMenu}
                        >
                            Sair da gestão
                        </button>
                    </div>
                </div>
            </div>

            <nav className={styles.navBar}>
                <button
                    type="button"
                    className={`${styles.navLink} ${currentScreen === 'dashboard' ? styles.active : ''}`}
                    onClick={() => setScreen('dashboard')}
                >
                    Dashboard
                </button>
                <button
                    type="button"
                    className={`${styles.navLink} ${currentScreen === 'politicas' ? styles.active : ''}`}
                    onClick={() => setScreen('politicas')}
                >
                    Políticas
                </button>
                <button
                    type="button"
                    className={`${styles.navLink} ${currentScreen === 'pais' ? styles.active : ''}`}
                    onClick={() => setScreen('pais')}
                >
                    País
                </button>
            </nav>
        </header>
    );
}
