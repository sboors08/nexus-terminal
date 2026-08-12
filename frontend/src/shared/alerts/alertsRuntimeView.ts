import type {
  AlertEventSource,
  AlertEventType,
  AlertParameterValue,
  AlertTrigger,
} from '@/shared/api/runtime/alertsRuntimeApi';
import type { TradeDirection } from '@/shared/ui/DirectionBadge';
import type { SetupStage } from '@/shared/ui/SetupStageBadge';

export type AlertPriority = 'critical' | 'attention' | 'info';
export type AlertReadStatus = 'new' | 'viewed';

export interface AlertMetric {
  label: string;
  value: string;
  tone: 'positive' | 'negative' | 'warning' | 'neutral';
}

export interface RuntimeAlertViewItem {
  id: string;
  ruleId: string;
  setupId: string | null;
  symbol: string | null;
  displaySymbol: string;
  timeframe: string | null;
  direction: TradeDirection | null;
  setupKind: string;
  stage: SetupStage | null;
  eventType: AlertEventType;
  eventLabel: string;
  sourceLabel: string;
  title: string;
  explanation: string;
  reasonToOpen: string;
  timestamp: string;
  relativeTime: string;
  price: string;
  changePercent: number | null;
  priority: AlertPriority;
  readStatus: AlertReadStatus;
  metrics: AlertMetric[];
}

export const ALERT_EVENT_LABELS: Record<AlertEventType, string> = {
  custom_condition: 'Пользовательское условие',
  volume_spike: 'Всплеск объёма',
  trades_anomaly: 'Аномалия сделок',
  impulse: 'Импульс',
  price_near_level: 'Цена у уровня',
  setup_stage_changed: 'Стадия сетапа изменилась',
  setup_confirmation: 'Подтверждение сетапа',
  setup_breakout: 'Пробой уровня',
  setup_bounce: 'Отскок от уровня',
  setup_invalidated: 'Сетап потерял актуальность',
  btc_market_mode_changed: 'Режим рынка BTC изменился',
  rating_changed: 'Рейтинг изменился',
};

export const ALERT_SOURCE_LABELS: Record<AlertEventSource, string> = {
  custom: 'Пользовательское правило',
  market_scanner: 'Market Scanner',
  setup_lifecycle: 'Setup Lifecycle',
  btc_market_mode: 'BTC Market Mode',
  adaptive_ranking: 'Adaptive Ranking',
};

export const ALERT_EVENT_MARKS: Record<AlertEventType, string> = {
  custom_condition: 'C',
  volume_spike: 'V',
  trades_anomaly: 'T',
  impulse: 'I',
  price_near_level: '≈',
  setup_stage_changed: 'S',
  setup_confirmation: '✓',
  setup_breakout: 'B',
  setup_bounce: '↗',
  setup_invalidated: '!',
  btc_market_mode_changed: '₿',
  rating_changed: 'R',
};

const PRIORITY_BY_EVENT: Record<AlertEventType, AlertPriority> = {
  custom_condition: 'attention',
  volume_spike: 'attention',
  trades_anomaly: 'attention',
  impulse: 'critical',
  price_near_level: 'info',
  setup_stage_changed: 'info',
  setup_confirmation: 'attention',
  setup_breakout: 'critical',
  setup_bounce: 'critical',
  setup_invalidated: 'attention',
  btc_market_mode_changed: 'attention',
  rating_changed: 'info',
};

function readNumber(payload: AlertTrigger['payload'], key: string): number | null {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(payload: AlertTrigger['payload'], key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getDirection(payload: AlertTrigger['payload']): TradeDirection | null {
  const value = payload.direction;
  return value === 'long' || value === 'short' ? value : null;
}

function getStage(payload: AlertTrigger['payload'], eventType: AlertEventType): SetupStage | null {
  if (eventType === 'setup_breakout' || eventType === 'setup_bounce') return 'triggered';
  if (eventType === 'setup_confirmation') return 'confirmation';
  if (eventType === 'price_near_level') return 'approach';
  const value = readString(payload, 'currentStage');
  if (value === 'LEVEL_CONFIRMED') return 'observation';
  if (value === 'APPROACHING_THIRD_TOUCH') return 'approach';
  if (value === 'THIRD_TOUCH_CONFIRMED') return 'confirmation';
  if (value === 'BREAKOUT_CONFIRMED' || value === 'REJECTION_CONFIRMED') return 'triggered';
  return null;
}

function getSetupKind(payload: AlertTrigger['payload'], source: AlertEventSource): string {
  const setupType = readString(payload, 'setupType');
  const direction = getDirection(payload);
  if (setupType === 'level_breakout') {
    return direction === 'short' ? 'Пробой поддержки' : 'Пробой сопротивления';
  }
  if (setupType === 'level_bounce') {
    return direction === 'short' ? 'Отскок от сопротивления' : 'Отскок от поддержки';
  }
  return ALERT_SOURCE_LABELS[source];
}

function formatScalar(value: AlertParameterValue): string {
  if (typeof value === 'number') return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  return value ?? '—';
}

function buildMetrics(trigger: AlertTrigger): AlertMetric[] {
  const candidates: Array<[string, string, AlertMetric['tone'], ((value: AlertParameterValue) => string)?]> = [
    ['anomalyRatio', 'Коэффициент', 'warning', (value) => `${formatScalar(value)}×`],
    ['volumeRatio', 'Объём', 'positive', (value) => `${formatScalar(value)}×`],
    ['tradesRatio', 'Сделки', 'positive', (value) => `${formatScalar(value)}×`],
    ['priceChangePct', 'Изменение цены', 'neutral', (value) => `${(value as number) > 0 ? '+' : ''}${formatScalar(value)}%`],
    ['distanceToLevelPct', 'До уровня', 'warning', (value) => `${formatScalar(value)}%`],
    ['currentPrice', 'Цена события', 'neutral'],
    ['status', 'Статус сигнала', 'neutral'],
    ['currentStage', 'Текущая стадия', 'neutral'],
    ['outcome', 'Исход', 'neutral'],
    ['mode', 'Режим BTC', 'neutral'],
    ['rating', 'Рейтинг', 'neutral'],
  ];

  const metrics: AlertMetric[] = [];
  for (const [key, label, tone, formatter] of candidates) {
    const value = trigger.payload[key];
    if (value === undefined || value === null) continue;
    metrics.push({ label, value: formatter ? formatter(value) : formatScalar(value), tone });
    if (metrics.length === 4) break;
  }
  return metrics;
}

function buildExplanation(trigger: AlertTrigger): string {
  const ratio = readNumber(trigger.payload, 'anomalyRatio');
  const currentStage = readString(trigger.payload, 'currentStage');
  const previousStage = readString(trigger.payload, 'previousStage');
  if (ratio !== null) {
    return `${ALERT_EVENT_LABELS[trigger.eventType]} зафиксирован: значение ${ratio.toFixed(2)}× относительно backend baseline.`;
  }
  if (currentStage) {
    return previousStage
      ? `Backend перевёл сетап со стадии ${previousStage} на ${currentStage}.`
      : `Backend зафиксировал стадию сетапа ${currentStage}.`;
  }
  return `Backend Alerts получил событие от источника ${ALERT_SOURCE_LABELS[trigger.source]}.`;
}

function getRelativeTime(timestamp: string, now: Date): string {
  const differenceSeconds = Math.max(0, Math.floor((now.getTime() - Date.parse(timestamp)) / 1_000));
  if (differenceSeconds < 60) return `${differenceSeconds} сек назад`;
  if (differenceSeconds < 3_600) return `${Math.floor(differenceSeconds / 60)} мин назад`;
  if (differenceSeconds < 86_400) return `${Math.floor(differenceSeconds / 3_600)} ч назад`;
  return `${Math.floor(differenceSeconds / 86_400)} дн назад`;
}

export function mapAlertTriggerToView(
  trigger: AlertTrigger,
  viewedTriggerIds: ReadonlySet<string> = new Set<string>(),
  now: Date = new Date(),
): RuntimeAlertViewItem {
  const currentPrice = readNumber(trigger.payload, 'currentPrice');
  const changePercent = readNumber(trigger.payload, 'priceChangePct');
  const symbol = trigger.workspaceContext.symbol ?? trigger.symbol;
  const timeframe = trigger.workspaceContext.timeframe ?? trigger.timeframe;
  return {
    id: trigger.id,
    ruleId: trigger.ruleId,
    setupId: trigger.workspaceContext.setupId,
    symbol,
    displaySymbol: symbol ?? 'MARKET',
    timeframe,
    direction: getDirection(trigger.payload),
    setupKind: getSetupKind(trigger.payload, trigger.source),
    stage: getStage(trigger.payload, trigger.eventType),
    eventType: trigger.eventType,
    eventLabel: ALERT_EVENT_LABELS[trigger.eventType],
    sourceLabel: ALERT_SOURCE_LABELS[trigger.source],
    title: ALERT_EVENT_LABELS[trigger.eventType],
    explanation: buildExplanation(trigger),
    reasonToOpen: symbol
      ? 'Откройте Workspace, чтобы проверить актуальную цену, контекст уровня и развитие события.'
      : 'Проверьте состояние источника и связанные правила Alerts.',
    timestamp: new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date(trigger.occurredAt)),
    relativeTime: getRelativeTime(trigger.occurredAt, now),
    price: currentPrice === null ? '—' : String(currentPrice),
    changePercent,
    priority: PRIORITY_BY_EVENT[trigger.eventType],
    readStatus: viewedTriggerIds.has(trigger.id) ? 'viewed' : 'new',
    metrics: buildMetrics(trigger),
  };
}
