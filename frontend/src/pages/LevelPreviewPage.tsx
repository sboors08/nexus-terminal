import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  LEVEL_ENGINE_FROZEN_SAMPLE_TIMEFRAMES,
  fetchLevelEngineFrozenSample,
  findLevelEngineFrozenSampleDataset,
  type LevelEngineFrozenSample,
  type LevelEngineFrozenSampleCandle,
  type LevelEngineFrozenSampleItem,
  type LevelEngineFrozenSampleKind,
  type LevelEngineFrozenSampleTimeframe,
} from '@/shared/api/runtime/levelEngineFrozenSampleApi';
import {
  parseLevelEngineFrozenSampleReview,
  type LevelEngineFrozenSampleCausalEvent,
  type LevelEngineFrozenSampleReview,
} from '@/shared/api/runtime/levelEngineFrozenSampleReview';

import { LevelEngineManualReviewPanel } from './LevelEngineManualReviewPanel';
import styles from './LevelPreviewPage.module.css';

const CHART_WIDTH = 1180;
const CHART_HEIGHT = 610;
const CHART_PADDING = {
  top: 46,
  right: 86,
  bottom: 46,
  left: 18,
} as const;

const TEXT = {
  title:
    '\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0443\u0440\u043e\u0432\u043d\u0435\u0439',
  subtitle:
    '\u0417\u0430\u043c\u043e\u0440\u043e\u0436\u0435\u043d\u043d\u0430\u044f \u0434\u0438\u0430\u0433\u043d\u043e\u0441\u0442\u0438\u043a\u0430 Level Engine: \u0442\u043e\u0447\u043d\u0430\u044f \u0437\u043e\u043d\u0430, \u044d\u043f\u0438\u0437\u043e\u0434\u044b \u043a\u0430\u0441\u0430\u043d\u0438\u044f, lifecycle \u0438 causal replay. \u042d\u043a\u0440\u0430\u043d \u043d\u0435 \u0441\u043e\u0437\u0434\u0430\u0451\u0442 \u0441\u0435\u0442\u0430\u043f\u044b, LONG/SHORT \u0438 quality score.',
  loading:
    '\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c frozen sample Level Engine\u2026',
  loadError:
    '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c frozen sample.',
  retry:
    '\u041f\u041e\u0412\u0422\u041e\u0420\u0418\u0422\u042c',
  refresh:
    '\u041e\u0411\u041d\u041e\u0412\u0418\u0422\u042c',
  instrument:
    '\u0418\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442',
  timeframe:
    '\u0422\u0430\u0439\u043c\u0444\u0440\u0435\u0439\u043c',
  levelKind:
    '\u0422\u0438\u043f \u0443\u0440\u043e\u0432\u043d\u044f',
  reviewItem:
    '\u042d\u043b\u0435\u043c\u0435\u043d\u0442 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438',
  controlLabel:
    '\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u043e\u043c \u0443\u0440\u043e\u0432\u043d\u0435\u0439',
  support:
    '\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430',
  resistance:
    '\u0421\u043e\u043f\u0440\u043e\u0442\u0438\u0432\u043b\u0435\u043d\u0438\u0435',
  shown:
    '\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u043e',
  candles:
    '\u0437\u0430\u043a\u0440\u044b\u0442\u044b\u0445 \u0441\u0432\u0435\u0447\u0435\u0439',
  closedOnly:
    '\u0422\u043e\u043b\u044c\u043a\u043e closed candles, \u0431\u0435\u0437 future leakage',
  exactBackend:
    '\u0417\u043e\u043d\u0430 \u0438 \u0441\u043e\u0431\u044b\u0442\u0438\u044f \u0432\u0437\u044f\u0442\u044b \u0438\u0437 backend, \u0431\u0435\u0437 \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e\u0433\u043e \u043f\u0435\u0440\u0435\u0441\u0447\u0451\u0442\u0430',
  events:
    '\u0441\u043e\u0431\u044b\u0442\u0438\u0439',
  noEvents:
    '\u041d\u0435\u0442 causal-\u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e \u0446\u0438\u043a\u043b\u0430',
  diagnostics:
    '\u0414\u0418\u0410\u0413\u041d\u041e\u0421\u0422\u0418\u041a\u0410',
  lifecycle:
    'LIFECYCLE',
  flags:
    '\u0414\u0418\u0410\u0413\u041d\u041e\u0421\u0422\u0418\u0427\u0415\u0421\u041a\u0418\u0415 \u0424\u041b\u0410\u0413\u0418',
  noFlags:
    '\u0414\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u0430 \u0444\u043b\u0430\u0433\u043e\u0432 \u043d\u0435\u0442.',
  sourceTouches:
    '\u0418\u0441\u0445\u043e\u0434\u043d\u044b\u0435 \u043a\u0430\u0441\u0430\u043d\u0438\u044f',
  selectedTouches:
    '\u041a\u0430\u0441\u0430\u043d\u0438\u044f \u0446\u0438\u043a\u043b\u0430',
  discardedTouches:
    '\u041e\u0442\u0431\u0440\u043e\u0448\u0435\u043d\u043e \u043a\u0430\u0441\u0430\u043d\u0438\u0439',
  cycle:
    '\u0426\u0438\u043a\u043b',
  currentCycle:
    '\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u0446\u0438\u043a\u043b',
  confirmation:
    '\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435 confirmation',
  breakMode:
    '\u0420\u0435\u0436\u0438\u043c \u043f\u0440\u043e\u0431\u043e\u044f',
  firstObserved:
    '\u0412\u043f\u0435\u0440\u0432\u044b\u0435 \u0437\u0430\u043c\u0435\u0447\u0435\u043d',
  firstConfirmed:
    '\u0412\u043f\u0435\u0440\u0432\u044b\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d',
  brokenAt:
    '\u041f\u0440\u043e\u0431\u0438\u0442',
  yes:
    '\u0414\u0430',
  no:
    '\u041d\u0435\u0442',
  none:
    '\u2014',
} as const;

type LoadStatus =
  | 'loading'
  | 'success'
  | 'error';

type ChartEventKind =
  | 'candidate'
  | 'confirmed'
  | 'break';

interface ChartEvent {
  readonly id: string;
  readonly candleIndex: number;
  readonly kind: ChartEventKind;
  readonly label: string;
  readonly observedAt: string;
}

interface ChartModel {
  readonly candles:
    readonly LevelEngineFrozenSampleCandle[];
  readonly startIndex: number;
  readonly touchIndexes: readonly number[];
  readonly events: readonly ChartEvent[];
}

function formatPrice(
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return TEXT.none;
  }

  const absolute =
    Math.abs(value);

  const maximumFractionDigits =
    absolute >= 1_000
      ? 2
      : absolute >= 1
        ? 4
        : 6;

  return new Intl.NumberFormat(
    'ru-RU',
    {
      maximumFractionDigits,
    },
  ).format(value);
}

function formatDateTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return TEXT.none;
  }

  const timestamp =
    Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      day:
        '2-digit',
      month:
        '2-digit',
      hour:
        '2-digit',
      minute:
        '2-digit',
      second:
        '2-digit',
    },
  ).format(timestamp);
}

function kindLabel(
  kind: LevelEngineFrozenSampleKind,
): string {
  return kind === 'support'
    ? TEXT.support
    : TEXT.resistance;
}

function eventKind(
  event: LevelEngineFrozenSampleCausalEvent,
): ChartEventKind | null {
  if (
    event.type === 'cycle_started'
    || event.type === 'candidate_first_seen'
  ) {
    return 'candidate';
  }

  if (
    event.type === 'cycle_confirmed'
    || event.type === 'candidate_confirmed'
  ) {
    return 'confirmed';
  }

  if (event.type === 'cycle_broken') {
    return 'break';
  }

  return null;
}

function eventLabel(
  event: LevelEngineFrozenSampleCausalEvent,
): string {
  const labels:
  Record<
    LevelEngineFrozenSampleCausalEvent['type'],
    string
  > = {
    candidate_first_seen:
      'CANDIDATE FIRST SEEN',
    candidate_confirmed:
      'CANDIDATE CONFIRMED',
    candidate_touch_added:
      'CANDIDATE TOUCH',
    candidate_disappeared:
      'CANDIDATE DISAPPEARED',
    candidate_reappeared:
      'CANDIDATE REAPPEARED',
    cycle_started:
      'CYCLE STARTED',
    cycle_confirmed:
      'CYCLE CONFIRMED',
    cycle_touch_added:
      'CYCLE TOUCH',
    cycle_broken:
      'CYCLE BROKEN',
  };

  return labels[event.type];
}

function buildChartModel(
  closedCandles:
    readonly LevelEngineFrozenSampleCandle[],
  review:
    LevelEngineFrozenSampleReview,
): ChartModel {
  const selectedCycle =
    review.cycles.find(
      (cycle) =>
        cycle.id === review.selectedCycleId,
    );

  const relevantEvents =
    review.causalReplayEvents
      .filter(
        (event) =>
          event.cycleId
            === review.selectedCycleId,
      )
      .flatMap(
        (event): readonly ChartEvent[] => {
          const kind =
            eventKind(event);

          if (!kind) {
            return [];
          }

          return [{
            id:
              `${event.eventIndex}:${event.type}`,
            candleIndex:
              event.observedCandleIndex,
            kind,
            label:
              eventLabel(event),
            observedAt:
              event.observedAt,
          }];
        },
      );

  const touchIndexes =
    review.selectedCandidate
      .touchEpisodes
      .map(
        (episode) =>
          episode.anchorCandleIndex,
      );

  const focusIndexes = [
    ...touchIndexes,
    ...relevantEvents.map(
      (event) =>
        event.candleIndex,
    ),
    review.selectedCycleDiagnostic
      .firstObservedCandleIndex,
    review.selectedCycleDiagnostic
      .firstConfirmedCandleIndex,
    selectedCycle
      ?.breakEvidence
      ?.candleIndex
      ?? null,
  ].filter(
    (value): value is number =>
      value !== null,
  );

  let startIndex =
    Math.max(
      0,
      closedCandles.length - 160,
    );
  let endIndex =
    closedCandles.length;

  if (focusIndexes.length > 0) {
    const minimum =
      Math.min(...focusIndexes);
    const maximum =
      Math.max(...focusIndexes);

    startIndex =
      Math.max(
        0,
        minimum - 55,
      );
    endIndex =
      Math.min(
        closedCandles.length,
        maximum + 56,
      );

    if (
      endIndex - startIndex < 120
    ) {
      const missing =
        120 - (endIndex - startIndex);
      const left =
        Math.min(
          startIndex,
          Math.ceil(missing / 2),
        );

      startIndex -= left;
      endIndex =
        Math.min(
          closedCandles.length,
          endIndex + missing - left,
        );
    }

    if (
      endIndex - startIndex > 190
    ) {
      startIndex =
        Math.max(
          0,
          maximum - 145,
        );
      endIndex =
        Math.min(
          closedCandles.length,
          startIndex + 190,
        );
    }
  }

  return {
    candles:
      closedCandles.slice(
        startIndex,
        endIndex,
      ),
    startIndex,
    touchIndexes:
      touchIndexes.filter(
        (index) =>
          index >= startIndex
          && index < endIndex,
      ),
    events:
      relevantEvents.filter(
        (event) =>
          event.candleIndex >= startIndex
          && event.candleIndex < endIndex,
      ),
  };
}

function chooseClosestItem(
  items:
    readonly LevelEngineFrozenSampleItem[],
  current:
    LevelEngineFrozenSampleItem,
  change: {
    readonly symbol?: string;
    readonly sourceTimeframe?:
      LevelEngineFrozenSampleTimeframe;
    readonly selectedKind?:
      LevelEngineFrozenSampleKind;
  },
): LevelEngineFrozenSampleItem {
  const target = {
    symbol:
      change.symbol
      ?? current.symbol,
    sourceTimeframe:
      change.sourceTimeframe
      ?? current.sourceTimeframe,
    selectedKind:
      change.selectedKind
      ?? current.selectedKind,
  };

  return (
    items.find(
      (item) =>
        item.symbol
          === target.symbol
        && item.sourceTimeframe
          === target.sourceTimeframe
        && item.selectedKind
          === target.selectedKind,
    )
    ?? items.find(
      (item) =>
        (
          change.symbol === undefined
          || item.symbol === change.symbol
        )
        && (
          change.sourceTimeframe
            === undefined
          || item.sourceTimeframe
            === change.sourceTimeframe
        )
        && (
          change.selectedKind === undefined
          || item.selectedKind
            === change.selectedKind
        ),
    )
    ?? current
  );
}

function pageHero() {
  return (
    <header className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>
          {'NEXUS \u00b7 LEVEL ENGINE \u00b7 FROZEN SAMPLE'}
        </p>
        <h1>{TEXT.title}</h1>
        <p className={styles.subtitle}>
          {TEXT.subtitle}
        </p>
      </div>

      <div className={styles.heroBadges}>
        <span className={styles.liveBadge}>
          BACKEND DIAGNOSTICS
        </span>
        <span className={styles.observationalBadge}>
          OBSERVATIONAL ONLY
        </span>
      </div>
    </header>
  );
}

function statusBadgeClass(
  item: LevelEngineFrozenSampleItem,
): string {
  if (item.reviewState === 'broken') {
    return styles.stateBadge_broken;
  }

  if (item.selectedMaturity === 'confirmed') {
    return styles.stateBadge_confirmed;
  }

  return styles.stateBadge_candidate;
}

function statusTextClass(
  item: LevelEngineFrozenSampleItem,
): string {
  if (item.reviewState === 'broken') {
    return styles.state_broken;
  }

  if (item.selectedMaturity === 'confirmed') {
    return styles.state_confirmed;
  }

  return styles.state_candidate;
}

function LevelFrozenChart({
  model,
  item,
}: {
  readonly model: ChartModel;
  readonly item: LevelEngineFrozenSampleItem;
}) {
  const candles =
    model.candles;

  const priceValues = [
    item.selectedZone.low,
    item.selectedZone.reference,
    item.selectedZone.high,
    ...candles.flatMap(
      (candle) => [
        candle.low,
        candle.high,
      ],
    ),
  ];

  const minimumPrice =
    Math.min(...priceValues);
  const maximumPrice =
    Math.max(...priceValues);
  const rawRange =
    Math.max(
      maximumPrice - minimumPrice,
      Math.abs(maximumPrice) * 0.0001,
      0.000001,
    );
  const priceMinimum =
    minimumPrice - rawRange * 0.08;
  const priceMaximum =
    maximumPrice + rawRange * 0.08;
  const priceRange =
    priceMaximum - priceMinimum;
  const plotWidth =
    CHART_WIDTH
    - CHART_PADDING.left
    - CHART_PADDING.right;
  const plotHeight =
    CHART_HEIGHT
    - CHART_PADDING.top
    - CHART_PADDING.bottom;
  const step =
    plotWidth
    / Math.max(candles.length, 1);
  const bodyWidth =
    Math.max(
      1.5,
      Math.min(
        8,
        step * 0.62,
      ),
    );

  const xForDatasetIndex = (
    datasetIndex: number,
  ): number =>
    CHART_PADDING.left
    + (
      datasetIndex
      - model.startIndex
      + 0.5
    ) * step;

  const yForPrice = (
    price: number,
  ): number =>
    CHART_PADDING.top
    + (
      (priceMaximum - price)
      / priceRange
    ) * plotHeight;

  const zoneTop =
    yForPrice(
      item.selectedZone.high,
    );
  const zoneBottom =
    yForPrice(
      item.selectedZone.low,
    );
  const currentPrice =
    candles.at(-1)?.close
    ?? item.selectedZone.reference;

  return (
    <div className={styles.chartViewport}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`${item.symbol} ${item.sourceTimeframe}`}
      >
        <rect
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          className={styles.chartBackground}
        />

        {Array.from(
          { length: 6 },
          (_, index) => {
            const ratio =
              index / 5;
            const y =
              CHART_PADDING.top
              + ratio * plotHeight;
            const price =
              priceMaximum
              - ratio * priceRange;

            return (
              <g key={`grid-${index}`}>
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
                  x={CHART_WIDTH - 10}
                  y={y + 4}
                  textAnchor="end"
                  className={styles.axisLabel}
                >
                  {formatPrice(price)}
                </text>
              </g>
            );
          },
        )}

        <rect
          x={CHART_PADDING.left}
          y={zoneTop}
          width={plotWidth}
          height={
            Math.max(
              1,
              zoneBottom - zoneTop,
            )
          }
          className={
            item.selectedKind === 'support'
              ? styles.supportZone
              : styles.resistanceZone
          }
          fill={
            item.selectedKind === 'support'
              ? 'rgba(50, 213, 131, 0.10)'
              : 'rgba(255, 98, 115, 0.10)'
          }
        />

        <line
          x1={CHART_PADDING.left}
          x2={
            CHART_WIDTH
            - CHART_PADDING.right
          }
          y1={
            yForPrice(
              item.selectedZone.reference,
            )
          }
          y2={
            yForPrice(
              item.selectedZone.reference,
            )
          }
          className={
            item.selectedKind === 'support'
              ? styles.supportReference
              : styles.resistanceReference
          }
        />

        {candles.map(
          (candle, localIndex) => {
            const datasetIndex =
              model.startIndex
              + localIndex;
            const x =
              xForDatasetIndex(
                datasetIndex,
              );
            const openY =
              yForPrice(candle.open);
            const closeY =
              yForPrice(candle.close);
            const highY =
              yForPrice(candle.high);
            const lowY =
              yForPrice(candle.low);
            const className =
              candle.close >= candle.open
                ? styles.candleUp
                : styles.candleDown;

            return (
              <g
                key={candle.openTime}
                className={className}
              >
                <line
                  x1={x}
                  x2={x}
                  y1={highY}
                  y2={lowY}
                  className={styles.candleWick}
                />
                <rect
                  x={x - bodyWidth / 2}
                  y={Math.min(openY, closeY)}
                  width={bodyWidth}
                  height={
                    Math.max(
                      1,
                      Math.abs(
                        closeY - openY,
                      ),
                    )
                  }
                  className={styles.candleBody}
                />
              </g>
            );
          },
        )}

        {model.touchIndexes.map(
          (datasetIndex, index) => {
            const candle =
              candles[
                datasetIndex
                - model.startIndex
              ];

            if (!candle) {
              return null;
            }

            const x =
              xForDatasetIndex(
                datasetIndex,
              );
            const y =
              yForPrice(
                item.selectedKind === 'support'
                  ? candle.low
                  : candle.high,
              );

            return (
              <g
                key={`touch-${datasetIndex}`}
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

        {model.events.map(
          (event, index) => {
            const x =
              xForDatasetIndex(
                event.candleIndex,
              );
            const className =
              event.kind === 'break'
                ? styles.eventBreak
                : event.kind === 'confirmed'
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
                  x={
                    Math.min(
                      x + 4,
                      CHART_WIDTH - 168,
                    )
                  }
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
                  x={
                    Math.min(
                      x + 12,
                      CHART_WIDTH - 160,
                    )
                  }
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
          },
        )}

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
    status,
    setStatus,
  ] = useState<LoadStatus>('loading');
  const [
    sample,
    setSample,
  ] = useState<
    LevelEngineFrozenSample | null
  >(null);
  const [
    selectedItemId,
    setSelectedItemId,
  ] = useState('');
  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const loadSample =
    useCallback(
      async (
        signal?: AbortSignal,
      ) => {
        setStatus('loading');
        setErrorMessage('');

        try {
          const nextSample =
            await fetchLevelEngineFrozenSample({
              signal,
            });
          const firstItem =
            nextSample.items.at(0);

          if (!firstItem) {
            throw new Error(
              'Frozen sample contains no review items',
            );
          }

          if (signal?.aborted) {
            return;
          }

          setSample(nextSample);
          setSelectedItemId(
            (currentId) =>
              nextSample.items.some(
                (item) =>
                  item.id === currentId,
              )
                ? currentId
                : firstItem.id,
          );
          setStatus('success');
        } catch (error) {
          if (signal?.aborted) {
            return;
          }

          setStatus('error');
          setErrorMessage(
            error instanceof Error
              ? error.message
              : TEXT.loadError,
          );
        }
      },
      [],
    );

  useEffect(
    () => {
      const controller =
        new AbortController();

      void loadSample(
        controller.signal,
      );

      return () => {
        controller.abort();
      };
    },
    [loadSample],
  );

  if (status === 'loading') {
    return (
      <section className={styles.page}>
        {pageHero()}
        <div className={styles.demoNotice}>
          <strong>LOADING</strong>
          <span>{TEXT.loading}</span>
        </div>
      </section>
    );
  }

  if (
    status === 'error'
    || !sample
  ) {
    return (
      <section className={styles.page}>
        {pageHero()}
        <div className={styles.demoNotice}>
          <strong>ERROR</strong>
          <span>
            {TEXT.loadError}
            {' '}
            {errorMessage}
          </span>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => {
              void loadSample();
            }}
          >
            {TEXT.retry}
          </button>
        </div>
      </section>
    );
  }

  const selectedItem =
    sample.items.find(
      (item) =>
        item.id === selectedItemId,
    )
    ?? sample.items[0];

  if (!selectedItem) {
    return null;
  }

  const dataset =
    findLevelEngineFrozenSampleDataset(
      sample,
      selectedItem,
    );
  const review =
    parseLevelEngineFrozenSampleReview(
      selectedItem,
      dataset,
    );
  const closedCandles =
    dataset.candles.filter(
      (candle) =>
        candle.isClosed,
    );
  const chartModel =
    buildChartModel(
      closedCandles,
      review,
    );
  const selectedCycle =
    review.cycles.find(
      (cycle) =>
        cycle.id
          === review.selectedCycleId,
    );
  const matchingItems =
    sample.items.filter(
      (item) =>
        item.symbol
          === selectedItem.symbol
        && item.sourceTimeframe
          === selectedItem.sourceTimeframe
        && item.selectedKind
          === selectedItem.selectedKind,
    );
  const symbols =
    Array.from(
      new Set(
        sample.items.map(
          (item) =>
            item.symbol,
        ),
      ),
    );
  const lastPrice =
    chartModel.candles.at(-1)?.close
    ?? selectedItem.selectedZone.reference;

  const selectClosest = (
    change: {
      readonly symbol?: string;
      readonly sourceTimeframe?:
        LevelEngineFrozenSampleTimeframe;
      readonly selectedKind?:
        LevelEngineFrozenSampleKind;
    },
  ) => {
    const nextItem =
      chooseClosestItem(
        sample.items,
        selectedItem,
        change,
      );

    setSelectedItemId(
      nextItem.id,
    );
  };

  return (
    <section className={styles.page}>
      {pageHero()}

      <section
        className={styles.controls}
        aria-label={TEXT.controlLabel}
      >
        <label>
          <span>{TEXT.instrument}</span>
          <select
            value={selectedItem.symbol}
            onChange={(event) => {
              selectClosest({
                symbol:
                  event.target.value,
              });
            }}
          >
            {symbols.map(
              (symbol) => (
                <option
                  key={symbol}
                  value={symbol}
                >
                  {symbol}
                </option>
              ),
            )}
          </select>
        </label>

        <div className={styles.timeframes}>
          <span>{TEXT.timeframe}</span>
          <div>
            {LEVEL_ENGINE_FROZEN_SAMPLE_TIMEFRAMES.map(
              (timeframe) => (
                <button
                  key={timeframe}
                  type="button"
                  className={
                    selectedItem.sourceTimeframe
                      === timeframe
                      ? styles.controlButtonActive
                      : styles.controlButton
                  }
                  onClick={() => {
                    selectClosest({
                      sourceTimeframe:
                        timeframe,
                    });
                  }}
                >
                  {timeframe}
                </button>
              ),
            )}
          </div>
        </div>

        <div className={styles.kindSwitch}>
          <span>{TEXT.levelKind}</span>
          <div>
            {(
              [
                'support',
                'resistance',
              ] as const
            ).map(
              (kind) => (
                <button
                  key={kind}
                  type="button"
                  className={
                    selectedItem.selectedKind
                      === kind
                      ? kind === 'support'
                        ? styles.supportButtonActive
                        : styles.resistanceButtonActive
                      : styles.controlButton
                  }
                  onClick={() => {
                    selectClosest({
                      selectedKind:
                        kind,
                    });
                  }}
                >
                  {kind.toUpperCase()}
                </button>
              ),
            )}
          </div>
        </div>

        <button
          type="button"
          className={styles.retryButton}
          onClick={() => {
            void loadSample();
          }}
        >
          {TEXT.refresh}
        </button>

        <label>
          <span>{TEXT.reviewItem}</span>
          <select
            value={selectedItem.id}
            onChange={(event) => {
              setSelectedItemId(
                event.target.value,
              );
            }}
          >
            {matchingItems.map(
              (item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {`#${item.selectionIndex + 1} \u00b7 ${item.selectedTransition} \u00b7 ${item.reviewState}`}
                </option>
              ),
            )}
          </select>
        </label>
      </section>

      <section className={styles.marketStrip}>
        <div>
          <span>LAST</span>
          <strong>
            {formatPrice(lastPrice)}
          </strong>
        </div>
        <div>
          <span>ZONE</span>
          <strong>
            {formatPrice(
              selectedItem.selectedZone.low,
            )}
            {' \u2014 '}
            {formatPrice(
              selectedItem.selectedZone.high,
            )}
          </strong>
        </div>
        <div>
          <span>MATURITY</span>
          <strong
            className={
              statusTextClass(
                selectedItem,
              )
            }
          >
            {selectedItem.selectedMaturity}
          </strong>
        </div>
        <div>
          <span>REVIEW STATE</span>
          <strong
            className={
              statusTextClass(
                selectedItem,
              )
            }
          >
            {selectedItem.reviewState}
          </strong>
        </div>
        <div>
          <span>TRANSITION</span>
          <strong>
            {selectedItem.selectedTransition}
          </strong>
        </div>
      </section>

      <div className={styles.mainGrid}>
        <article className={styles.chartPanel}>
          <header className={styles.panelHeader}>
            <div>
              <p>
                {selectedItem.symbol}
                {' \u00b7 '}
                {selectedItem.sourceTimeframe}
                {' \u00b7 '}
                CYCLE #{review.selectedCycleSequence}
              </p>
              <h2>
                {kindLabel(
                  selectedItem.selectedKind,
                )}
              </h2>
            </div>

            <div className={styles.legend}>
              <span>
                <i className={styles.legendZone} />
                Backend zone
              </span>
              <span>
                <i className={styles.legendTouch} />
                Touch episode
              </span>
              <span>
                <i className={styles.legendEvent} />
                Causal event
              </span>
            </div>
          </header>

          <LevelFrozenChart
            model={chartModel}
            item={selectedItem}
          />

          <footer className={styles.chartFooter}>
            <span>
              {TEXT.shown}
              {' '}
              {chartModel.candles.length}
              {' '}
              {TEXT.candles}
            </span>
            <span>{TEXT.closedOnly}</span>
            <span>{TEXT.exactBackend}</span>
          </footer>
        </article>

        <aside className={styles.sidebar}>
          <article className={styles.diagnosticCard}>
            <header>
              <div>
                <p>{TEXT.diagnostics}</p>
                <h3>
                  {selectedItem.selectedKind.toUpperCase()}
                </h3>
              </div>
              <span
                className={
                  statusBadgeClass(
                    selectedItem,
                  )
                }
              >
                {selectedItem.reviewState}
              </span>
            </header>

            <dl className={styles.metrics}>
              <div>
                <dt>{TEXT.sourceTouches}</dt>
                <dd>
                  {review.sourceTouchEpisodeCount}
                </dd>
              </div>
              <div>
                <dt>{TEXT.selectedTouches}</dt>
                <dd>
                  {
                    review
                      .selectedCycleTouchEpisodeCount
                  }
                </dd>
              </div>
              <div>
                <dt>{TEXT.discardedTouches}</dt>
                <dd>
                  {
                    review
                      .discardedSourceTouchEpisodeCount
                  }
                </dd>
              </div>
              <div>
                <dt>{TEXT.cycle}</dt>
                <dd>
                  {review.selectedCycleSequence}
                  {' / '}
                  {review.lifecycleCycleCount}
                </dd>
              </div>
              <div>
                <dt>{TEXT.currentCycle}</dt>
                <dd>
                  {review.selectedCycleIsCurrent
                    ? TEXT.yes
                    : TEXT.no}
                </dd>
              </div>
              <div>
                <dt>{TEXT.confirmation}</dt>
                <dd>
                  {
                    review
                      .selectedCycleDiagnostic
                      .confirmationState
                  }
                </dd>
              </div>
              <div>
                <dt>{TEXT.breakMode}</dt>
                <dd>
                  {
                    selectedCycle
                      ?.breakEvidence
                      ?.mode
                    ?? TEXT.none
                  }
                </dd>
              </div>
              <div>
                <dt>CAUSAL EVENTS</dt>
                <dd>
                  {review.causalReplayEvents.length}
                </dd>
              </div>
            </dl>
          </article>

          <article className={styles.timelineCard}>
            <header>
              <p>{TEXT.lifecycle}</p>
              <span>
                {chartModel.events.length}
                {' '}
                {TEXT.events}
              </span>
            </header>

            <ol className={styles.timeline}>
              {chartModel.events.length > 0
                ? chartModel.events.map(
                    (event) => {
                      const candle =
                        closedCandles[
                          event.candleIndex
                        ];

                      return (
                        <li
                          key={event.id}
                          data-event={event.kind}
                        >
                          <i />
                          <div>
                            <strong>
                              {event.label}
                            </strong>
                            <span>
                              {formatDateTime(
                                event.observedAt,
                              )}
                            </span>
                          </div>
                          <em>
                            {formatPrice(
                              candle?.close
                              ?? selectedItem
                                .selectedZone
                                .reference,
                            )}
                          </em>
                        </li>
                      );
                    },
                  )
                : (
                  <li>
                    <i />
                    <div>
                      <strong>
                        {TEXT.noEvents}
                      </strong>
                    </div>
                  </li>
                )}
            </ol>
          </article>

          <article className={styles.rulesCard}>
            <p>{TEXT.flags}</p>
            <ul>
              {selectedItem
                .diagnosticFlags
                .length > 0
                ? selectedItem
                    .diagnosticFlags
                    .map(
                      (flag) => (
                        <li key={flag}>
                          {flag}
                        </li>
                      ),
                    )
                : (
                  <li>{TEXT.noFlags}</li>
                )}
            </ul>
          </article>

          <article className={styles.diagnosticCard}>
            <header>
              <div>
                <p>CAUSAL TIMING</p>
                <h3>
                  {review.causalTrackFound
                    ? 'TRACK FOUND'
                    : 'TRACK MISSING'}
                </h3>
              </div>
            </header>

            <dl className={styles.metrics}>
              <div>
                <dt>{TEXT.firstObserved}</dt>
                <dd>
                  {formatDateTime(
                    review
                      .selectedCycleDiagnostic
                      .firstObservedAt,
                  )}
                </dd>
              </div>
              <div>
                <dt>{TEXT.firstConfirmed}</dt>
                <dd>
                  {formatDateTime(
                    review
                      .selectedCycleDiagnostic
                      .firstConfirmedAt,
                  )}
                </dd>
              </div>
              <div>
                <dt>{TEXT.brokenAt}</dt>
                <dd>
                  {formatDateTime(
                    review
                      .selectedCycleDiagnostic
                      .brokenAt,
                  )}
                </dd>
              </div>
              <div>
                <dt>BREAK TIMING</dt>
                <dd>
                  {
                    review
                      .selectedCycleDiagnostic
                      .firstObservedBreakTiming
                  }
                </dd>
              </div>
            </dl>
          </article>
        </aside>
      </div>

      <LevelEngineManualReviewPanel
        sample={sample}
        item={selectedItem}
      />

      <div className={styles.demoNotice}>
        <strong>FROZEN SAMPLE</strong>
        <span>
          {sample.id}
          {' \u00b7 '}
          {formatDateTime(
            sample.generatedAt,
          )}
          {' \u00b7 '}
          {sample.items.length}
          {' review items \u00b7 '}
          {sample.datasets.length}
          {' datasets'}
        </span>
      </div>
    </section>
  );
}
