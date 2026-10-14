import styles from './styles.module.css';
import { useGameStore } from '../../store/gameStore';

interface HeaderProps {
    onBackToMenu?: () => void;
}

export function Header({ onBackToMenu: _onBackToMenu }: HeaderProps) {
    const month = useGameStore((state) => state.game?.month ?? 1);
    return (
        <header className={styles.header}>
            <div className={styles.headertop}>
                <div className={styles.logoContainer}>
                    <img src="/src/assets/logo.png" alt="Logo" className={styles.logo} />
                </div>
                <div className={styles.headerInfo}>
                   <div className={styles.presidentInfo}>
                    <p className={styles.name}>Presidente: João</p>
                    <p className={styles.party}>Partido: Missão</p>
                   </div>
                   <div className={styles.monthInfo}>
                    <p className={styles.month}>Mês: {month} / 42</p>
                   </div>
                </div>
            </div>

            <div className={styles.navBar}>
                <a href="#">Dashboard</a>
                <a href="#">Economia</a>
                <a href="#">Política</a>
                <a href="#">Social</a>
            </div>
        </header>
    );
}
