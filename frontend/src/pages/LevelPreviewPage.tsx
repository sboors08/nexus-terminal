import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  Candle,
} from '@/shared/api';
import {
  useMarketCandles,
  type MarketCandleTimeframe,
} from '@/shared/charts';
import styles from './LevelPreviewPage.module.css';

const LEVEL_PREVIEW_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'AVAXUSDT',
  'DOGEUSDT',
] as const;

const LEVEL_PREVIEW_TIMEFRAMES:
readonly MarketCandleTimeframe[] = [
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
];

type LevelKind =
  | 'support'
  | 'resistance';

type LevelState =
  | 'candidate'
  | 'confirmed'
  | 'broken';

type BreakMode =
  | 'decisive_body_break'
  | 'consecutive_closes'
  | null;

interface PreviewLevel {
  readonly kind: LevelKind;
  readonly reference: number;
  readonly zoneLow: number;
  readonly zoneHigh: number;
  readonly touchIndexes: readonly number[];
  readonly candidateAtIndex: number | null;
  readonly confirmedAtIndex: number | null;
  readonly breakAtIndex: number | null;
  readonly breakMode: BreakMode;
  readonly state: LevelState;
  readonly atr: number;
}

interface PreviewEvent {
  readonly id: string;
  readonly candleIndex: number;
  readonly type:
    | 'touch'
    | 'candidate'
    | 'confirmed'
    | 'break';
  readonly label: string;
}

const CHART_WIDTH = 1180;
const CHART_HEIGHT = 610;
const CHART_PADDING = {
  top: 46,
  right: 86,
  bottom: 46,
  left: 18,
} as const;

function createSeed(value: string): number {
  let seed = 2166136261;

  for (const character of value) {
    seed ^= character.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }

  return seed >>> 0;
}

function createRandom(seedValue: number): () => number {
  let seed = seedValue || 1;

  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;

    return (seed >>> 0) / 4294967296;
  };
}

function timeframeMs(
  timeframe: MarketCandleTimeframe,
): number {
  const durations:
  Record<MarketCandleTimeframe, number> = {
    '1m': 60_000,
    '3m': 180_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '2h': 7_200_000,
    '4h': 14_400_000,
    '6h': 21_600_000,
    '8h': 28_800_000,
    '12h': 43_200_000,
    '1d': 86_400_000,
  };

  return durations[timeframe];
}

function fallbackBasePrice(symbol: string): number {
  if (symbol === 'BTCUSDT') return 115_000;
  if (symbol === 'ETHUSDT') return 3_650;
  if (symbol === 'SOLUSDT') return 186;
  if (symbol === 'AVAXUSDT') return 27.8;
  if (symbol === 'DOGEUSDT') return 0.228;

  return 100;
}

function buildFallbackCandles(
  symbol: string,
  timeframe: MarketCandleTimeframe,
): readonly Candle[] {
  const random = createRandom(
    createSeed(`${symbol}:${timeframe}`),
  );
  const duration = timeframeMs(timeframe);
  const count = 180;
  const endTime =
    Date.UTC(2026, 7, 5, 18, 0, 0);
  const basePrice = fallbackBasePrice(symbol);
  const volatility =
    symbol === 'DOGEUSDT'
      ? 0.0028
      : symbol === 'BTCUSDT'
        ? 0.00125
        : 0.002;

  let price = basePrice * 0.982;

  return Object.freeze(
    Array.from(
      { length: count },
      (_, index): Candle => {
        const cycle =
          Math.sin(index / 10.5) * volatility * 1.7;
        const impulse =
          index > 108 && index < 128
            ? volatility * 0.45
            : index >= 128
              ? -volatility * 0.18
              : 0;
        const noise =
          (random() - 0.48) * volatility;
        const open = price;
        const close = Math.max(
          basePrice * 0.65,
          open * (1 + cycle * 0.16 + impulse + noise),
        );
        const wick =
          Math.max(
            open,
            close,
          ) * volatility * (0.55 + random());
        const high =
          Math.max(open, close) + wick;
        const low =
          Math.max(
            0.000001,
            Math.min(open, close) - wick,
          );
        const openTime =
          endTime - (count - index) * duration;

        price = close;

        return {
          openTime: new Date(openTime).toISOString(),
          closeTime:
            new Date(openTime + duration - 1).toISOString(),
          open,
          high,
          low,
          close,
          volume:
            1_000_000 * (0.55 + random() * 1.7),
          tradesCount:
            Math.round(800 + random() * 4_200),
          isClosed: true,
        };
      },
    ),
  );
}

function median(
  values: readonly number[],
): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values]
    .sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (
        sorted[middle - 1]
        + sorted[middle]
      ) / 2
    : sorted[middle];
}

function calculateAtr(
  candles: readonly Candle[],
  period = 14,
): number {
  if (candles.length === 0) {
    return 0;
  }

  const start =
    Math.max(1, candles.length - period);
  const ranges: number[] = [];

  for (
    let index = start;
    index < candles.length;
    index += 1
  ) {
    const candle = candles[index];
    const previous = candles[index - 1];

    ranges.push(
      Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - previous.close),
        Math.abs(candle.low - previous.close),
      ),
    );
  }

  return median(ranges);
}

function findPivotPrices(
  candles: readonly Candle[],
  kind: LevelKind,
): readonly number[] {
  const pivots: number[] = [];

  for (
    let index = 2;
    index < candles.length - 2;
    index += 1
  ) {
    const candle = candles[index];

    if (kind === 'support') {
      const isPivot =
        candle.low <= candles[index - 1].low
        && candle.low <= candles[index - 2].low
        && candle.low <= candles[index + 1].low
        && candle.low <= candles[index + 2].low;

      if (isPivot) {
        pivots.push(candle.low);
      }
    } else {
      const isPivot =
        candle.high >= candles[index - 1].high
        && candle.high >= candles[index - 2].high
        && candle.high >= candles[index + 1].high
        && candle.high >= candles[index + 2].high;

      if (isPivot) {
        pivots.push(candle.high);
      }
    }
  }

  return pivots;
}

function selectReferencePrice(
  candles: readonly Candle[],
  kind: LevelKind,
  atr: number,
): number {
  const pivots = findPivotPrices(candles, kind);
  const currentPrice =
    candles[candles.length - 1]?.close ?? 0;
  const tolerance =
    Math.max(
      currentPrice * 0.0012,
      atr * 0.9,
    );

  const clusters:
  Array<{
    prices: number[];
    reference: number;
  }> = [];

  for (
    const price of [...pivots]
      .sort((left, right) => left - right)
  ) {
    const cluster =
      clusters.find(
        (entry) =>
          Math.abs(entry.reference - price)
          <= tolerance,
      );

    if (cluster) {
      cluster.prices.push(price);
      cluster.reference =
        cluster.prices.reduce(
          (total, value) => total + value,
          0,
        ) / cluster.prices.length;
    } else {
      clusters.push({
        prices: [price],
        reference: price,
      });
    }
  }

  const directionalClusters =
    clusters.filter((cluster) =>
      kind === 'support'
        ? cluster.reference <= currentPrice * 1.006
        : cluster.reference >= currentPrice * 0.994,
    );

  const selected =
    directionalClusters
      .sort((left, right) => {
        if (
          left.prices.length
          !== right.prices.length
        ) {
          return (
            right.prices.length
            - left.prices.length
          );
        }

        return (
          Math.abs(left.reference - currentPrice)
          - Math.abs(right.reference - currentPrice)
        );
      })[0]
    ?? clusters[0];

  if (selected) {
    return selected.reference;
  }

  const fallbackPrices =
    candles.map((candle) =>
      kind === 'support'
        ? candle.low
        : candle.high,
    );

  return kind === 'support'
    ? Math.min(...fallbackPrices)
    : Math.max(...fallbackPrices);
}

function findTouchEpisodes(
  candles: readonly Candle[],
  zoneLow: number,
  zoneHigh: number,
): readonly number[] {
  const episodes: number[] = [];
  let insideEpisode = false;

  for (
    let index = 0;
    index < candles.length;
    index += 1
  ) {
    const candle = candles[index];
    const intersects =
      candle.low <= zoneHigh
      && candle.high >= zoneLow;

    if (intersects && !insideEpisode) {
      episodes.push(index);
    }

    insideEpisode = intersects;
  }

  return episodes;
}

function findBreak(
  candles: readonly Candle[],
  kind: LevelKind,
  zoneLow: number,
  zoneHigh: number,
  atr: number,
  afterIndex: number,
): {
  index: number | null;
  mode: BreakMode;
} {
  const boundary =
    kind === 'support'
      ? zoneLow
      : zoneHigh;

  for (
    let index = Math.max(afterIndex + 1, 1);
    index < candles.length;
    index += 1
  ) {
    const candle = candles[index];
    const previous = candles[index - 1];
    const decisiveDistance =
      kind === 'support'
        ? boundary - Math.max(candle.open, candle.close)
        : Math.min(candle.open, candle.close) - boundary;
    const decisiveBody =
      decisiveDistance >= atr * 0.35;

    if (decisiveBody) {
      return {
        index,
        mode: 'decisive_body_break',
      };
    }

    const candleClosedBeyond =
      kind === 'support'
        ? candle.close < boundary
        : candle.close > boundary;
    const previousClosedBeyond =
      kind === 'support'
        ? previous.close < boundary
        : previous.close > boundary;

    if (
      candleClosedBeyond
      && previousClosedBeyond
    ) {
      return {
        index,
        mode: 'consecutive_closes',
      };
    }
  }

  return {
    index: null,
    mode: null,
  };
}

function buildPreviewLevel(
  candles: readonly Candle[],
  kind: LevelKind,
): PreviewLevel {
  const atr = calculateAtr(candles);
  const reference =
    selectReferencePrice(candles, kind, atr);
  const halfWidth =
    Math.max(
      atr * 0.28,
      reference * 0.00045,
    );
  const zoneLow = reference - halfWidth;
  const zoneHigh = reference + halfWidth;
  const touchIndexes =
    findTouchEpisodes(
      candles,
      zoneLow,
      zoneHigh,
    );
  const candidateAtIndex =
    touchIndexes[1] ?? null;
  const confirmedAtIndex =
    touchIndexes[2] ?? null;
  const breakResult =
    candidateAtIndex === null
      ? {
          index: null,
          mode: null as BreakMode,
        }
      : findBreak(
          candles,
          kind,
          zoneLow,
          zoneHigh,
          atr,
          candidateAtIndex,
        );
  const state: LevelState =
    breakResult.index !== null
      ? 'broken'
      : confirmedAtIndex !== null
        ? 'confirmed'
        : 'candidate';

  return {
    kind,
    reference,
    zoneLow,
    zoneHigh,
    touchIndexes,
    candidateAtIndex,
    confirmedAtIndex,
    breakAtIndex: breakResult.index,
    breakMode: breakResult.mode,
    state,
    atr,
  };
}

function buildEvents(
  level: PreviewLevel,
): readonly PreviewEvent[] {
  const events: PreviewEvent[] =
    level.touchIndexes.map(
      (candleIndex, index) => ({
        id: `touch-${candleIndex}`,
        candleIndex,
        type: 'touch',
        label: `Касание ${index + 1}`,
      }),
    );

  if (level.candidateAtIndex !== null) {
    events.push({
      id: `candidate-${level.candidateAtIndex}`,
      candleIndex: level.candidateAtIndex,
      type: 'candidate',
      label: 'Candidate',
    });
  }

  if (level.confirmedAtIndex !== null) {
    events.push({
      id: `confirmed-${level.confirmedAtIndex}`,
      candleIndex: level.confirmedAtIndex,
      type: 'confirmed',
      label: 'Confirmed',
    });
  }

  if (level.breakAtIndex !== null) {
    events.push({
      id: `break-${level.breakAtIndex}`,
      candleIndex: level.breakAtIndex,
      type: 'break',
      label: 'Break',
    });
  }

  return events.sort(
    (left, right) =>
      left.candleIndex - right.candleIndex,
  );
}

function formatPrice(
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  const absolute = Math.abs(value);
  const maximumFractionDigits =
    absolute >= 10_000
      ? 1
      : absolute >= 100
        ? 2
        : absolute >= 1
          ? 4
          : 6;

  return new Intl.NumberFormat(
    'ru-RU',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    },
  ).format(value);
}

function formatPercent(
  value: number,
): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatDateTime(
  value: string | undefined,
): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(new Date(value));
}

function levelStateLabel(
  state: LevelState,
): string {
  if (state === 'confirmed') {
    return 'CONFIRMED';
  }

  if (state === 'broken') {
    return 'BROKEN';
  }

  return 'CANDIDATE';
}

function LevelPreviewChart({
  candles,
  level,
  events,
}: {
  candles: readonly Candle[];
  level: PreviewLevel;
  events: readonly PreviewEvent[];
}) {
  const plotWidth =
    CHART_WIDTH
    - CHART_PADDING.left
    - CHART_PADDING.right;
  const plotHeight =
    CHART_HEIGHT
    - CHART_PADDING.top
    - CHART_PADDING.bottom;
  const minimumPrice =
    Math.min(
      level.zoneLow,
      ...candles.map((candle) => candle.low),
    );
  const maximumPrice =
    Math.max(
      level.zoneHigh,
      ...candles.map((candle) => candle.high),
    );
  const padding =
    Math.max(
      (maximumPrice - minimumPrice) * 0.08,
      level.reference * 0.0005,
    );
  const chartLow =
    minimumPrice - padding;
  const chartHigh =
    maximumPrice + padding;
  const priceRange =
    Math.max(chartHigh - chartLow, 0.000001);
  const candleWidth =
    Math.max(
      2,
      Math.min(
        8,
        plotWidth / Math.max(candles.length, 1) * 0.62,
      ),
    );
  const xForIndex =
    (index: number) =>
      CHART_PADDING.left
      + (
        (index + 0.5)
        / Math.max(candles.length, 1)
      ) * plotWidth;
  const yForPrice =
    (price: number) =>
      CHART_PADDING.top
      + (
        (chartHigh - price)
        / priceRange
      ) * plotHeight;
  const zoneTop =
    yForPrice(level.zoneHigh);
  const zoneBottom =
    yForPrice(level.zoneLow);
  const currentPrice =
    candles[candles.length - 1]?.close
    ?? level.reference;
  const gridPrices =
    Array.from(
      { length: 6 },
      (_, index) =>
        chartLow
        + (
          priceRange
          * index
          / 5
        ),
    );

  return (
    <div className={styles.chartViewport}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`График ${level.kind} уровня`}
      >
        <defs>
          <linearGradient
            id={`level-zone-${level.kind}`}
            x1="0"
            x2="1"
          >
            <stop
              offset="0%"
              stopColor={
                level.kind === 'support'
                  ? '#32d583'
                  : '#ff6273'
              }
              stopOpacity="0.08"
            />
            <stop
              offset="100%"
              stopColor={
                level.kind === 'support'
                  ? '#32d583'
                  : '#ff6273'
              }
              stopOpacity="0.22"
            />
          </linearGradient>
        </defs>

        <rect
          x="0"
          y="0"
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          className={styles.chartBackground}
        />

        {gridPrices.map((price) => {
          const y = yForPrice(price);

          return (
            <g key={price}>
              <line
                x1={CHART_PADDING.left}
                x2={
                  CHART_WIDTH
                  - CHART_PADDING.right
                }
                y1={y}
                y2={y}
                className={styles.gridLine}
              />
              <text
                x={CHART_WIDTH - 8}
                y={y + 4}
                textAnchor="end"
                className={styles.axisLabel}
              >
                {formatPrice(price)}
              </text>
            </g>
          );
        })}

        <rect
          x={CHART_PADDING.left}
          y={zoneTop}
          width={plotWidth}
          height={Math.max(
            2,
            zoneBottom - zoneTop,
          )}
          fill={`url(#level-zone-${level.kind})`}
          className={
            level.kind === 'support'
              ? styles.supportZone
              : styles.resistanceZone
          }
        />

        <line
          x1={CHART_PADDING.left}
          x2={
            CHART_WIDTH
            - CHART_PADDING.right
          }
          y1={yForPrice(level.reference)}
          y2={yForPrice(level.reference)}
          className={
            level.kind === 'support'
              ? styles.supportReference
              : styles.resistanceReference
          }
        />

        {candles.map((candle, index) => {
          const x = xForIndex(index);
          const openY =
            yForPrice(candle.open);
          const closeY =
            yForPrice(candle.close);
          const highY =
            yForPrice(candle.high);
          const lowY =
            yForPrice(candle.low);
          const isUp =
            candle.close >= candle.open;
          const bodyTop =
            Math.min(openY, closeY);
          const bodyHeight =
            Math.max(
              1.5,
              Math.abs(closeY - openY),
            );

          return (
            <g
              key={`${candle.openTime}-${index}`}
              className={
                isUp
                  ? styles.candleUp
                  : styles.candleDown
              }
            >
              <line
                x1={x}
                x2={x}
                y1={highY}
                y2={lowY}
                className={styles.candleWick}
              />
              <rect
                x={x - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                rx="0.8"
                className={styles.candleBody}
              />
            </g>
          );
        })}

        {level.touchIndexes.map(
          (candleIndex, index) => {
            const candle =
              candles[candleIndex];
            const x =
              xForIndex(candleIndex);
            const price =
              level.kind === 'support'
                ? Math.min(
                    level.zoneHigh,
                    candle.low,
                  )
                : Math.max(
                    level.zoneLow,
                    candle.high,
                  );
            const y =
              yForPrice(price);

            return (
              <g
                key={`touch-marker-${candleIndex}`}
                className={styles.touchMarker}
              >
                <circle
                  cx={x}
                  cy={y}
                  r="7"
                />
                <text
                  x={x}
                  y={y + 3}
                  textAnchor="middle"
                >
                  {index + 1}
                </text>
              </g>
            );
          },
        )}

        {events
          .filter(
            (event) =>
              event.type !== 'touch',
          )
          .map((event, index) => {
            const x =
              xForIndex(event.candleIndex);
            const className =
              event.type === 'break'
                ? styles.eventBreak
                : event.type === 'confirmed'
                  ? styles.eventConfirmed
                  : styles.eventCandidate;

            return (
              <g
                key={event.id}
                className={className}
              >
                <line
                  x1={x}
                  x2={x}
                  y1={CHART_PADDING.top}
                  y2={
                    CHART_HEIGHT
                    - CHART_PADDING.bottom
                  }
                  className={styles.eventLine}
                />
                <rect
                  x={Math.min(
                    x + 4,
                    CHART_WIDTH - 168,
                  )}
                  y={
                    CHART_PADDING.top
                    + index * 24
                  }
                  width="154"
                  height="20"
                  rx="5"
                  className={styles.eventLabelBox}
                />
                <text
                  x={Math.min(
                    x + 12,
                    CHART_WIDTH - 160,
                  )}
                  y={
                    CHART_PADDING.top
                    + 14
                    + index * 24
                  }
                  className={styles.eventLabel}
                >
                  {event.label}
                </text>
              </g>
            );
          })}

        <line
          x1={CHART_PADDING.left}
          x2={
            CHART_WIDTH
            - CHART_PADDING.right
          }
          y1={yForPrice(currentPrice)}
          y2={yForPrice(currentPrice)}
          className={styles.currentPriceLine}
        />
        <rect
          x={CHART_WIDTH - 82}
          y={yForPrice(currentPrice) - 10}
          width="76"
          height="20"
          rx="5"
          className={styles.currentPriceBadge}
        />
        <text
          x={CHART_WIDTH - 12}
          y={yForPrice(currentPrice) + 4}
          textAnchor="end"
          className={styles.currentPriceText}
        >
          {formatPrice(currentPrice)}
        </text>
      </svg>
    </div>
  );
}

export function LevelPreviewPage() {
  const [
    symbol,
    setSymbol,
  ] = useState<string>('SOLUSDT');
  const [
    timeframe,
    setTimeframe,
  ] = useState<MarketCandleTimeframe>('5m');
  const [
    selectedKind,
    setSelectedKind,
  ] = useState<LevelKind>('resistance');

  const candlesQuery =
    useMarketCandles({
      symbol,
      timeframe,
    });
  const snapshotKey =
    `${symbol}:${timeframe}`;
  const fallbackCandles =
    useMemo(
      () =>
        buildFallbackCandles(
          symbol,
          timeframe,
        ),
      [symbol, timeframe],
    );
  const backendClosedCandles =
    useMemo(
      () =>
        candlesQuery.data?.filter(
          (candle) => candle.isClosed !== false,
        ) ?? [],
      [candlesQuery.data],
    );
  const [
    frozenSnapshot,
    setFrozenSnapshot,
  ] = useState<{
    readonly key: string;
    readonly candles: readonly Candle[];
  } | null>(null);

  useEffect(() => {
    if (
      frozenSnapshot?.key === snapshotKey
      || candlesQuery.status !== 'success'
      || backendClosedCandles.length < 30
    ) {
      return;
    }

    setFrozenSnapshot({
      key: snapshotKey,
      candles: Object.freeze(
        backendClosedCandles.map(
          (candle) => Object.freeze({
            ...candle,
          }),
        ),
      ),
    });
  }, [
    backendClosedCandles,
    candlesQuery.status,
    frozenSnapshot,
    snapshotKey,
  ]);

  const sourceCandles =
    frozenSnapshot?.key === snapshotKey
      ? frozenSnapshot.candles
      : backendClosedCandles.length >= 30
        ? backendClosedCandles
        : fallbackCandles;
  const visibleCandles =
    useMemo(
      () =>
        sourceCandles.slice(-140),
      [sourceCandles],
    );
  const levels =
    useMemo(
      () => ({
        support:
          buildPreviewLevel(
            visibleCandles,
            'support',
          ),
        resistance:
          buildPreviewLevel(
            visibleCandles,
            'resistance',
          ),
      }),
      [visibleCandles],
    );
  const selectedLevel =
    levels[selectedKind];
  const events =
    useMemo(
      () =>
        buildEvents(selectedLevel),
      [selectedLevel],
    );
  const currentPrice =
    visibleCandles[
      visibleCandles.length - 1
    ]?.close ?? 0;
  const distancePct =
    selectedKind === 'support'
      ? (
          (
            currentPrice
            - selectedLevel.zoneHigh
          )
          / Math.max(currentPrice, 0.000001)
        ) * 100
      : (
          (
            selectedLevel.zoneLow
            - currentPrice
          )
          / Math.max(currentPrice, 0.000001)
        ) * 100;
  const levelWidthPct =
    (
      (
        selectedLevel.zoneHigh
        - selectedLevel.zoneLow
      )
      / Math.max(
        selectedLevel.reference,
        0.000001,
      )
    ) * 100;
  const lastTouchIndex =
    selectedLevel.touchIndexes[
      selectedLevel.touchIndexes.length - 1
    ] ?? null;
  const barsSinceLastTouch =
    lastTouchIndex === null
      ? null
      : visibleCandles.length
        - 1
        - lastTouchIndex;
  const isBackendData =
    frozenSnapshot?.key === snapshotKey
    || sourceCandles === backendClosedCandles;
  const sourceLabel =
    isBackendData
      ? 'BACKEND CANDLES'
      : candlesQuery.status === 'loading'
        ? 'DEMO · BACKEND LOADING'
        : 'DEMO FALLBACK';
  const firstPrice =
    visibleCandles[0]?.close
    ?? currentPrice;
  const changePct =
    firstPrice === 0
      ? 0
      : (
          (currentPrice - firstPrice)
          / firstPrice
        ) * 100;

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>
            NEXUS · LEVEL ENGINE · VISUAL QA
          </p>
          <h1>Level Preview</h1>
          <p className={styles.subtitle}>
            Первый браузерный экран для проверки зон,
            эпизодов касания, Candidate, Confirmed
            и Break. Он не создаёт LONG/SHORT и не
            использует quality score.
          </p>
        </div>

        <div className={styles.heroBadges}>
          <span
            className={
              isBackendData
                ? styles.liveBadge
                : styles.demoBadge
            }
          >
            {sourceLabel}
          </span>
          <span className={styles.observationalBadge}>
            OBSERVATIONAL ONLY
          </span>
        </div>
      </header>

      <section
        className={styles.controls}
        aria-label="Управление Level Preview"
      >
        <label>
          <span>Инструмент</span>
          <select
            value={symbol}
            onChange={(event) =>
              setSymbol(event.target.value)
            }
          >
            {LEVEL_PREVIEW_SYMBOLS.map(
              (value) => (
                <option
                  key={value}
                  value={value}
                >
                  {value}
                </option>
              ),
            )}
          </select>
        </label>

        <div className={styles.timeframes}>
          <span>Таймфрейм</span>
          <div>
            {LEVEL_PREVIEW_TIMEFRAMES.map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    timeframe === value
                      ? styles.controlButtonActive
                      : styles.controlButton
                  }
                  onClick={() =>
                    setTimeframe(value)
                  }
                >
                  {value}
                </button>
              ),
            )}
          </div>
        </div>

        <div className={styles.kindSwitch}>
          <span>Тип уровня</span>
          <div>
            <button
              type="button"
              className={
                selectedKind === 'support'
                  ? styles.supportButtonActive
                  : styles.controlButton
              }
              onClick={() =>
                setSelectedKind('support')
              }
            >
              SUPPORT
            </button>
            <button
              type="button"
              className={
                selectedKind === 'resistance'
                  ? styles.resistanceButtonActive
                  : styles.controlButton
              }
              onClick={() =>
                setSelectedKind('resistance')
              }
            >
              RESISTANCE
            </button>
          </div>
        </div>

        <button
          type="button"
          className={styles.retryButton}
          onClick={() => {
            setFrozenSnapshot(null);
            candlesQuery.retry();
          }}
          disabled={
            candlesQuery.status === 'loading'
          }
        >
          {candlesQuery.status === 'loading'
            ? 'ЗАГРУЗКА…'
            : 'ОБНОВИТЬ'}
        </button>
      </section>

      <section className={styles.marketStrip}>
        <div>
          <span>LAST</span>
          <strong>{formatPrice(currentPrice)}</strong>
        </div>
        <div>
          <span>ПЕРИОД</span>
          <strong
            className={
              changePct >= 0
                ? styles.positive
                : styles.negative
            }
          >
            {formatPercent(changePct)}
          </strong>
        </div>
        <div>
          <span>LEVEL</span>
          <strong>
            {formatPrice(
              selectedLevel.reference,
            )}
          </strong>
        </div>
        <div>
          <span>ZONE</span>
          <strong>
            {formatPrice(
              selectedLevel.zoneLow,
            )}
            {' — '}
            {formatPrice(
              selectedLevel.zoneHigh,
            )}
          </strong>
        </div>
        <div>
          <span>STATE</span>
          <strong
            className={
              styles[
                `state_${selectedLevel.state}`
              ]
            }
          >
            {levelStateLabel(
              selectedLevel.state,
            )}
          </strong>
        </div>
      </section>

      <div className={styles.mainGrid}>
        <article className={styles.chartPanel}>
          <header className={styles.panelHeader}>
            <div>
              <p>
                {symbol} · {timeframe}
              </p>
              <h2>
                {selectedKind === 'support'
                  ? 'Зона поддержки'
                  : 'Зона сопротивления'}
              </h2>
            </div>

            <div className={styles.legend}>
              <span>
                <i className={styles.legendZone} />
                Zone
              </span>
              <span>
                <i className={styles.legendTouch} />
                Touch episode
              </span>
              <span>
                <i className={styles.legendEvent} />
                Lifecycle event
              </span>
            </div>
          </header>

          <LevelPreviewChart
            candles={visibleCandles}
            level={selectedLevel}
            events={events}
          />

          <footer className={styles.chartFooter}>
            <span>
              Показано {visibleCandles.length} свечей
            </span>
            <span>
              Соседние свечи внутри зоны считаются
              одним эпизодом касания
            </span>
            <span>
              Break: 0.35 ATR body или 2 закрытия
            </span>
          </footer>
        </article>

        <aside className={styles.sidebar}>
          <article className={styles.diagnosticCard}>
            <header>
              <div>
                <p>LEVEL DIAGNOSTIC</p>
                <h3>
                  {selectedKind.toUpperCase()}
                </h3>
              </div>
              <span
                className={
                  styles[
                    `stateBadge_${selectedLevel.state}`
                  ]
                }
              >
                {levelStateLabel(
                  selectedLevel.state,
                )}
              </span>
            </header>

            <dl className={styles.metrics}>
              <div>
                <dt>Touch episodes</dt>
                <dd>
                  {
                    selectedLevel
                      .touchIndexes.length
                  }
                </dd>
              </div>
              <div>
                <dt>ATR</dt>
                <dd>
                  {formatPrice(
                    selectedLevel.atr,
                  )}
                </dd>
              </div>
              <div>
                <dt>Zone width</dt>
                <dd>
                  {levelWidthPct.toFixed(3)}%
                </dd>
              </div>
              <div>
                <dt>Distance</dt>
                <dd
                  className={
                    distancePct <= 0
                      ? styles.warning
                      : undefined
                  }
                >
                  {distancePct.toFixed(3)}%
                </dd>
              </div>
              <div>
                <dt>Bars from touch</dt>
                <dd>
                  {barsSinceLastTouch ?? '—'}
                </dd>
              </div>
              <div>
                <dt>Break mode</dt>
                <dd>
                  {selectedLevel.breakMode
                    ?? '—'}
                </dd>
              </div>
            </dl>
          </article>

          <article className={styles.timelineCard}>
            <header>
              <p>LIFECYCLE</p>
              <span>{events.length} событий</span>
            </header>

            <ol className={styles.timeline}>
              {events.length > 0
                ? events.map((event) => {
                    const candle =
                      visibleCandles[
                        event.candleIndex
                      ];

                    return (
                      <li
                        key={event.id}
                        data-event={event.type}
                      >
                        <i />
                        <div>
                          <strong>
                            {event.label}
                          </strong>
                          <span>
                            {formatDateTime(
                              candle?.closeTime,
                            )}
                          </span>
                        </div>
                        <em>
                          {formatPrice(
                            candle?.close ?? 0,
                          )}
                        </em>
                      </li>
                    );
                  })
                : (
                  <li>
                    <i />
                    <div>
                      <strong>
                        Нет событий
                      </strong>
                      <span>
                        Выбери другой уровень
                      </span>
                    </div>
                  </li>
                )}
            </ol>
          </article>

          <article className={styles.rulesCard}>
            <p>ПРАВИЛА ЭКРАНА</p>
            <ul>
              <li>
                Два эпизода формируют Candidate.
              </li>
              <li>
                Третий эпизод показывает Confirmed.
              </li>
              <li>
                Пробой считается отдельно от касаний.
              </li>
              <li>
                Никаких торговых направлений и score.
              </li>
            </ul>
          </article>
        </aside>
      </div>

      {!isBackendData && (
        <div className={styles.demoNotice}>
          <strong>Сейчас показан визуальный fallback.</strong>
          <span>
            Запусти backend NEXUS, затем нажми
            «Обновить» — экран переключится на
            реальные Binance Futures candles.
            Формирование зон в этой версии выполняется
            локально только для визуальной проверки UI;
            это ещё не подключение production Level
            Engine к frontend.
          </span>
        </div>
      )}
    </section>
  );
}
