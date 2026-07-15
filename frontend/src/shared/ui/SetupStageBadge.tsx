import styles from './TradingBadges.module.css';

export type SetupStage = 'observation' | 'approach' | 'confirmation' | 'triggered';

type SetupStageBadgeProps = {
  stage: SetupStage;
  resultLabel?: 'Пробой' | 'Отскок';
};

const STAGE_LABELS: Record<Exclude<SetupStage, 'triggered'>, string> = {
  observation: 'Наблюдение',
  approach: 'Подход',
  confirmation: 'Подтверждение',
};

export function SetupStageBadge({ stage, resultLabel = 'Пробой' }: SetupStageBadgeProps) {
  const label = stage === 'triggered' ? resultLabel : STAGE_LABELS[stage];

  return <span className={`${styles.badge} ${styles[stage]}`}>{label}</span>;
}
