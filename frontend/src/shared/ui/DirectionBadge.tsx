import styles from './TradingBadges.module.css';

export type TradeDirection = 'long' | 'short';

type DirectionBadgeProps = {
  direction: TradeDirection;
};

export function DirectionBadge({ direction }: DirectionBadgeProps) {
  const label = direction === 'long' ? 'LONG' : 'SHORT';
  const className = direction === 'long' ? styles.long : styles.short;

  return <span className={`${styles.badge} ${className}`}>{label}</span>;
}
