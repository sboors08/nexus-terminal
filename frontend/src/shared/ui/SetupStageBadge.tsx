import styles from './TradingBadges.module.css';

export type SetupStage = 'observation' | 'approach' | 'confirmation' | 'triggered';

export type SetupStageResultLabel =
  | 'Пробой'
  | 'Отскок'
  | 'Ложный пробой'
  | 'Уровень удержан'
  | 'Исход';

type SetupStageBadgeProps = {
  stage: SetupStage;
  resultLabel?: SetupStageResultLabel;
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
