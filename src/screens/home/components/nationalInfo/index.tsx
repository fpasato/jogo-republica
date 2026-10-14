
import styles from './styles.module.css';

const nationalInfoData = [
    {
        label: 'Inflação',
        value: '10%',
        trend: '0.4%'
    },
    {
        label: 'PIB nominal',
        value: 'valor',
        trend: '0.4%'
    },
    {
        label: 'dívida pública',
        value: 'valor',
        trend: '0.4%'
    },
    {
        label: 'carga tributária',
        value: 'valor',
        trend: '0.4%'
    },
    {
        label: 'cotação do dólar',
        value: 'valor',
        trend: '0.4%'
    },
    {
        label: 'salário mínimo',
        value: 'valor',
        trend: '0.4%'
    },
    {
        label: 'balança comercial',
        value: 'valor',
        trend: '0.4%'
    },
];


export function NationalInfo() {
    return (
        <main className={styles.container}>
            {nationalInfoData.map((item, index) => (
                <div key={index} className={styles.item}>
                    <div className={styles.content}>
                        <span className={styles.value}>{item.value}</span>
                        <span className={styles.trend}>{item.trend}</span>
                    </div>
                    <h3 className={styles.label}>{item.label}</h3>
                </div>
            ))}
        </main>
    );
}