import styles from './styles.module.css';
import { useGameStore } from '../../store/gameStore';
import logo from '../../assets/logo.png';

interface HeaderProps {
    onBackToMenu?: () => void;
    activePage?: string;
    onNavigate?: (page: string) => void;
}

export function Header({ onBackToMenu, activePage, onNavigate }: HeaderProps) {
    const game = useGameStore((state) => state.game);
    const reset = useGameStore((state) => state.reset);
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

            <div className={styles.navBar}>
                {[["dashboard", "Dashboard"], ["pais", "País"], ["economia", "Economia"], ["saude", "Saúde"], ["educacao", "Educação"], ["seguranca", "Segurança"], ["emprego", "Emprego"], ["social", "Assistência social"], ["infraestrutura", "Infraestrutura"], ["ambiente", "Meio ambiente e energia"], ["gestao", "Administração"]].map(([id, label]) => <a key={id} href={`#${id}`} aria-current={activePage === id ? 'page' : undefined} onClick={(event) => { if (onNavigate) { event.preventDefault(); onNavigate(id); } }}>{label}</a>)}
            </div>
        </header>
    );
}
