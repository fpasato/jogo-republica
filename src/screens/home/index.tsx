
import { useState } from 'react';
import styles from './styles.module.css';

import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { NationalInfo } from './components/nationalInfo';
import { PolicyCreator } from './components/PolicyCreator';
import { BrazilMap } from './components/BrazilMap';
import { STATES, STATE_IDS, type StateId } from '../../game/data/states';
import { useGameStore } from '../../store/gameStore';



export function Home() {
    const game = useGameStore((state) => state.game);
    const [selectedState, setSelectedState] = useState<StateId | null>(null);
    const mapStates = STATE_IDS.map((id) => ({
        ...STATES[id],
        approval: game?.stateApprovals[id] ?? game?.nationalApproval ?? 50,
    }));

    return (
        <div className={styles.container}>
            <Header />
            <NationalInfo />
            <div className={styles.contentGrid}>
                <PolicyCreator />
                <BrazilMap
                    states={mapStates}
                    selectedId={selectedState}
                    onSelect={setSelectedState}
                />
                <h1>campo pra jornal</h1>
            </div>
            <Footer />
        </div>
    );
}
