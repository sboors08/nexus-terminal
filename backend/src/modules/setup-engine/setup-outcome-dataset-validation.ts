import type {
  BinanceOneMinuteKlineUpdate,
} from '../realtime-market-data/market-wide-one-minute-metrics.js';
import type {
  SetupDirection,
} from './setup-engine.types.js';
import type {
  SetupLifecycleEvent,
} from './setup-lifecycle-events.types.js';
import {
  DEFAULT_SETUP_OUTCOME_HORIZONS_MINUTES,
  SETUP_OUTCOME_DATASET_VALIDATION_VERSION,
} from './setup-outcome-dataset-validation.types.js';
import type {
  SetupOutcomeAnchorFact,
  SetupOutcomeCheckpoint,
  SetupOutcomeDatasetBuildOptions,
  SetupOutcomeDatasetItem,
  SetupOutcomeDatasetValidationReport,
  SetupOutcomeMarketHistorySource,
  SetupOutcomeMeasuredMetrics,
  SetupOutcomeMeasurementStatus,
  SetupOutcomeTerminalEventType,
} from './setup-outcome-dataset-validation.types.js';

const MINUTE_MS =
  60_000;

const DEFAULT_OPTIONS:
SetupOutcomeDatasetBuildOptions = {
  horizonsMinutes:
    DEFAULT_SETUP_OUTCOME_HORIZONS_MINUTES,

  excludeAnchorMinute:
    true,
};

const TERMINAL_EVENT_TYPES:
readonly SetupOutcomeTerminalEventType[] = [
  'breakout_confirmed',
  'rejection_confirmed',
  'setup_expired',
];

function round(
  value: number,
  digits = 6,
): number {
  const factor =
    10 ** digits;

  return Math.round(
    value * factor,
  ) / factor;
}

function timestamp(
  value: string,
): number {
  const parsed =
    Date.parse(
      value,
    );

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Invalid Setup Outcome timestamp: ${value}`,
    );
  }

  return parsed;
}

function isTerminalEvent(
  event:
    SetupLifecycleEvent,
): event is
  SetupLifecycleEvent
  & {
    type:
      SetupOutcomeTerminalEventType;
  } {
  return TERMINAL_EVENT_TYPES.includes(
    event.type as
      SetupOutcomeTerminalEventType,
  );
}

function normalizeOptions(
  options:
    Partial<SetupOutcomeDatasetBuildOptions>
    | undefined,
): SetupOutcomeDatasetBuildOptions {
  const horizons =
    options?.horizonsMinutes
    ?? DEFAULT_OPTIONS.horizonsMinutes;

  if (
    horizons.length === 0
    || horizons.some(
      (value) =>
        !Number.isInteger(value)
        || value <= 0
        || value > 900,
    )
  ) {
    throw new Error(
      'Setup Outcome horizons must contain positive integer minutes up to 900',
    );
  }

  const normalized =
    [...new Set(horizons)]
      .sort(
        (left, right) =>
          left - right,
      );

  return {
    horizonsMinutes:
      Object.freeze(
        normalized,
      ),

    excludeAnchorMinute:
      true,
  };
}

function lastHorizonMinutes(
  horizonsMinutes:
    readonly number[],
): number {
  const value =
    horizonsMinutes[
      horizonsMinutes.length - 1
    ];

  if (value === undefined) {
    throw new Error(
      'Setup Outcome horizons cannot be empty',
    );
  }

  return value;
}

function measurementStartMs(
  anchorMs: number,
): number {
  return (
    Math.floor(
      anchorMs / MINUTE_MS,
    )
    * MINUTE_MS
    + MINUTE_MS
  );
}

function expectedClosedCandles(
  startMs: number,
  cutoffMs: number,
): number {
  if (cutoffMs < startMs) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (
        cutoffMs
        - startMs
        + 1
      ) / MINUTE_MS,
    ),
  );
}

function signedReturnPct(
  direction:
    SetupDirection,

  entryPrice: number,
  price: number,
): number {
  const raw =
    direction === 'long'
      ? (
          price
          - entryPrice
        ) / entryPrice
      : (
          entryPrice
          - price
        ) / entryPrice;

  return round(
    raw * 100,
  );
}

function buildMeasuredMetrics(
  direction:
    SetupDirection,

  anchorPrice: number,

  anchorAtMs: number,

  startMs: number,

  horizonsMinutes:
    readonly number[],

  candles:
    readonly BinanceOneMinuteKlineUpdate[],
): SetupOutcomeMeasuredMetrics {
  const maximumHorizonMinutes =
    lastHorizonMinutes(
      horizonsMinutes,
    );

  const observationWindowEndsAtMs =
    anchorAtMs
    + maximumHorizonMinutes
      * MINUTE_MS;

  const favorablePrice =
    direction === 'long'
      ? Math.max(
          ...candles.map(
            (candle) =>
              candle.high,
          ),
        )
      : Math.min(
          ...candles.map(
            (candle) =>
              candle.low,
          ),
        );

  const adversePrice =
    direction === 'long'
      ? Math.min(
          ...candles.map(
            (candle) =>
              candle.low,
          ),
        )
      : Math.max(
          ...candles.map(
            (candle) =>
              candle.high,
          ),
        );

  const maxFavorableExcursionPct =
    Math.max(
      0,
      signedReturnPct(
        direction,
        anchorPrice,
        favorablePrice,
      ),
    );

  const adverseSigned =
    signedReturnPct(
      direction,
      anchorPrice,
      adversePrice,
    );

  const maxAdverseExcursionPct =
    Math.max(
      0,
      round(
        -adverseSigned,
      ),
    );

  const checkpoints:
    SetupOutcomeCheckpoint[] = [];

  for (
    const horizonMinutes
    of horizonsMinutes
  ) {
    const cutoffMs =
      anchorAtMs
      + horizonMinutes
        * MINUTE_MS;

    const expectedCount =
      expectedClosedCandles(
        startMs,
        cutoffMs,
      );

    if (expectedCount <= 0) {
      continue;
    }

    const checkpointCandles =
      candles.slice(
        0,
        expectedCount,
      );

    const last =
      checkpointCandles[
        checkpointCandles.length - 1
      ];

    if (!last) {
      continue;
    }

    checkpoints.push({
      horizonMinutes,

      cutoffAt:
        new Date(
          cutoffMs,
        ).toISOString(),

      candlesCount:
        checkpointCandles.length,

      closePrice:
        last.close,

      signedReturnPct:
        signedReturnPct(
          direction,
          anchorPrice,
          last.close,
        ),
    });
  }

  const first =
    candles[0];

  const last =
    candles[
      candles.length - 1
    ];

  if (!first || !last) {
    throw new Error(
      'Measured Setup Outcome requires candles',
    );
  }

  return {
    observationWindowMinutes:
      maximumHorizonMinutes,

    observationWindowEndsAt:
      new Date(
        observationWindowEndsAtMs,
      ).toISOString(),

    candlesCount:
      candles.length,

    firstCandleOpenTime:
      first.openTime,

    lastCandleCloseTime:
      last.closeTime,

    maxFavorableExcursionPct:
      round(
        maxFavorableExcursionPct,
      ),

    maxAdverseExcursionPct:
      round(
        maxAdverseExcursionPct,
      ),

    maxFavorablePrice:
      favorablePrice,

    maxAdversePrice:
      adversePrice,

    checkpoints:
      Object.freeze(
        checkpoints,
      ),
  };
}

function selectCompleteWindowCandles(
  source:
    readonly BinanceOneMinuteKlineUpdate[],

  startMs: number,

  windowEndMs: number,
): readonly BinanceOneMinuteKlineUpdate[]
| null {
  const expectedCount =
    expectedClosedCandles(
      startMs,
      windowEndMs,
    );

  if (expectedCount <= 0) {
    return null;
  }

  const byOpenTime =
    new Map<
      number,
      BinanceOneMinuteKlineUpdate
    >();

  for (const candle of source) {
    if (!candle.isClosed) {
      continue;
    }

    const openMs =
      timestamp(
        candle.openTime,
      );

    const closeMs =
      timestamp(
        candle.closeTime,
      );

    if (
      openMs < startMs
      || closeMs > windowEndMs
    ) {
      continue;
    }

    byOpenTime.set(
      openMs,
      candle,
    );
  }

  const result:
    BinanceOneMinuteKlineUpdate[] = [];

  for (
    let index = 0;
    index < expectedCount;
    index += 1
  ) {
    const requiredOpenMs =
      startMs
      + index * MINUTE_MS;

    const candle =
      byOpenTime.get(
        requiredOpenMs,
      );

    if (!candle) {
      return null;
    }

    result.push(
      candle,
    );
  }

  return Object.freeze(
    result,
  );
}

function terminalFact(
  event:
    SetupLifecycleEvent
    & {
      type:
        SetupOutcomeTerminalEventType;
    },
) {
  return {
    eventId:
      event.eventId,

    type:
      event.type,

    occurredAt:
      event.occurredAt,

    stage:
      event.currentStage,

    lifecycleOutcome:
      event.outcome,

    snapshotPrice:
      event.candidate.currentPrice,
  };
}

function anchorFact(
  event:
    SetupLifecycleEvent,
): SetupOutcomeAnchorFact {
  const anchorMs =
    timestamp(
      event.occurredAt,
    );

  const startMs =
    measurementStartMs(
      anchorMs,
    );

  return {
    eventId:
      event.eventId,

    occurredAt:
      event.occurredAt,

    price:
      event.candidate.currentPrice,

    measurementStartsAt:
      new Date(
        startMs,
      ).toISOString(),

    anchorMinuteExcluded:
      true,

    anchorGapMs:
      startMs - anchorMs,
  };
}

interface BuildInput {
  events:
    readonly SetupLifecycleEvent[];

  droppedEventsCount?: number;

  historySnapshotFound?: boolean;

  snapshotSavedAt?:
    string
    | null;

  marketHistorySource:
    SetupOutcomeMarketHistorySource;

  now?:
    Date;

  options?:
    Partial<SetupOutcomeDatasetBuildOptions>;
}

export async function buildSetupOutcomeDatasetValidation(
  input:
    BuildInput,
): Promise<
  SetupOutcomeDatasetValidationReport
> {
  const options =
    normalizeOptions(
      input.options,
    );

  const now =
    input.now
    ?? new Date();

  const nowMs =
    now.getTime();

  if (!Number.isFinite(nowMs)) {
    throw new Error(
      'Setup Outcome validation now must be valid',
    );
  }

  const grouped =
    new Map<
      string,
      SetupLifecycleEvent[]
    >();

  for (const event of input.events) {
    const events =
      grouped.get(
        event.candidateId,
      )
      ?? [];

    events.push(
      event,
    );

    grouped.set(
      event.candidateId,
      events,
    );
  }

  const items:
    SetupOutcomeDatasetItem[] = [];

  let terminalCandidatesCount =
    0;

  let anchoredTerminalCandidatesCount =
    0;

  let measuredCandidatesCount =
    0;

  let pendingWindowCandidatesCount =
    0;

  let missingThirdTouchAnchorCount =
    0;

  let insufficientCandleCoverageCount =
    0;

  let marketHistoryErrorCount =
    0;

  let multipleTerminalEventsCount =
    0;

  let postEventMarketDataUsedForMeasurement =
    false;

  const maximumHorizonMinutes =
    lastHorizonMinutes(
      options.horizonsMinutes,
    );

  for (
    const [
      candidateId,
      candidateEventsSource,
    ]
    of [...grouped.entries()]
      .sort(
        (
          [left],
          [right],
        ) =>
          left.localeCompare(
            right,
          ),
      )
  ) {
    const candidateEvents =
      [...candidateEventsSource]
        .sort(
          (left, right) =>
            left.eventId
            - right.eventId,
        );

    const terminalEvents =
      candidateEvents
        .filter(
          isTerminalEvent,
        );

    const terminal =
      terminalEvents[0];

    if (!terminal) {
      continue;
    }

    terminalCandidatesCount +=
      1;

    if (terminalEvents.length > 1) {
      multipleTerminalEventsCount +=
        1;
    }

    const anchors =
      candidateEvents
        .filter(
          (event) =>
            event.eventId
              < terminal.eventId
            && event.currentStage
              === 'THIRD_TOUCH_CONFIRMED',
        );

    const anchor =
      anchors[
        anchors.length - 1
      ];

    const firstRetained =
      candidateEvents[0];

    const lastRetained =
      candidateEvents[
        candidateEvents.length - 1
      ];

    if (!firstRetained || !lastRetained) {
      continue;
    }

    const base = {
      id:
        `setup-outcome:${candidateId}`,

      candidateId,

      symbol:
        terminal.symbol,

      timeframe:
        terminal.candidate.timeframe,

      setupType:
        terminal.setupType,

      direction:
        terminal.direction,

      episodeId:
        terminal.candidate
          .episode?.id
        ?? null,

      lineId:
        terminal.candidate
          .causal?.lineId
        ?? terminal.candidate
          .episode?.lineId
        ?? null,

      historyComplete:
        candidateEvents.some(
          (event) =>
            event.type
              === 'candidate_created',
        ),

      firstRetainedEventId:
        firstRetained.eventId,

      lastRetainedEventId:
        lastRetained.eventId,

      lifecycleEventsCount:
        candidateEvents.length,

      terminal:
        terminalFact(
          terminal,
        ),

      observationalOnly:
        true as const,

      profitabilityLabelApplied:
        false as const,

      changesProductionSetup:
        false as const,

      changesTradingRules:
        false as const,

      tradeExecution:
        false as const,

      trainingApplied:
        false as const,
    };

    if (!anchor) {
      missingThirdTouchAnchorCount +=
        1;

      items.push({
        ...base,

        anchor:
          null,

        measurementStatus:
          'missing_third_touch_anchor',

        metrics:
          null,
      });

      continue;
    }

    anchoredTerminalCandidatesCount +=
      1;

    const resolvedAnchor =
      anchorFact(
        anchor,
      );

    const anchorAtMs =
      timestamp(
        resolvedAnchor.occurredAt,
      );

    const startMs =
      timestamp(
        resolvedAnchor
          .measurementStartsAt,
      );

    const windowEndMs =
      anchorAtMs
      + maximumHorizonMinutes
        * MINUTE_MS;

    if (nowMs < windowEndMs) {
      pendingWindowCandidatesCount +=
        1;

      items.push({
        ...base,

        anchor:
          resolvedAnchor,

        measurementStatus:
          'pending_window',

        metrics:
          null,
      });

      continue;
    }

    let measurementStatus:
      SetupOutcomeMeasurementStatus =
        'market_history_error';

    try {
      const candles =
        await input
          .marketHistorySource
          .fetchOneMinuteKlines({
            symbol:
              terminal.symbol,

            limit:
              Math.min(
                1_000,
                maximumHorizonMinutes
                  + 5,
              ),

            endTime:
              windowEndMs,
          });

      postEventMarketDataUsedForMeasurement =
        true;

      const completeWindow =
        selectCompleteWindowCandles(
          candles,
          startMs,
          windowEndMs,
        );

      if (!completeWindow) {
        measurementStatus =
          'insufficient_candle_coverage';

        insufficientCandleCoverageCount +=
          1;

        items.push({
          ...base,

          anchor:
            resolvedAnchor,

          measurementStatus,

          metrics:
            null,
        });

        continue;
      }

      const metrics =
        buildMeasuredMetrics(
          terminal.direction,
          resolvedAnchor.price,
          anchorAtMs,
          startMs,
          options.horizonsMinutes,
          completeWindow,
        );

      measurementStatus =
        'measured';

      measuredCandidatesCount +=
        1;

      items.push({
        ...base,

        anchor:
          resolvedAnchor,

        measurementStatus,

        metrics,
      });
    } catch {
      marketHistoryErrorCount +=
        1;

      items.push({
        ...base,

        anchor:
          resolvedAnchor,

        measurementStatus,

        metrics:
          null,
      });
    }
  }

  return {
    version:
      SETUP_OUTCOME_DATASET_VALIDATION_VERSION,

    generatedAt:
      now.toISOString(),

    status:
      measuredCandidatesCount > 0
        ? 'sample_available'
        : 'insufficient_sample',

    source: {
      historySnapshotFound:
        input.historySnapshotFound
        ?? false,

      snapshotSavedAt:
        input.snapshotSavedAt
        ?? null,

      retainedEventsCount:
        input.events.length,

      droppedEventsCount:
        input.droppedEventsCount
        ?? 0,
    },

    options,

    diagnostics: {
      candidatesCount:
        grouped.size,

      terminalCandidatesCount,

      anchoredTerminalCandidatesCount,

      measuredCandidatesCount,

      pendingWindowCandidatesCount,

      missingThirdTouchAnchorCount,

      insufficientCandleCoverageCount,

      marketHistoryErrorCount,

      multipleTerminalEventsCount,
    },

    items:
      Object.freeze(
        items,
      ),

    observationalOnly:
      true,

    profitabilityLabelApplied:
      false,

    sampleSufficiencyThresholdApplied:
      false,

    changesProductionSetup:
      false,

    changesTradingRules:
      false,

    tradeExecution:
      false,

    trainingApplied:
      false,

    futureMarketDataUsedForDetection:
      false,

    postEventMarketDataUsedForMeasurement,
  };
}