import type {
  LevelEngineCandle,
} from '../level-engine/level-engine-touch-detector.types.js';
import {
  normalizeLevelEngineSymbol,
} from '../level-engine/level-engine.contract.js';
import type {
  LevelEngineRealDataValidationReport,
  LevelEngineValidationDatasetSnapshot,
} from '../level-engine/level-engine-real-data-validation.types.js';
import type {
  BinanceOneMinuteKlineUpdate,
} from '../realtime-market-data/market-wide-one-minute-metrics.js';
import type {
  RealtimeBookTicker,
} from '../realtime-market-data/realtime-market-data.types.js';
import type {
  SetupCausalContext,
  SetupCausalUpdate,
} from './causal-setup-adapter.types.js';
import {
  CAUSAL_SETUP_REAL_DATA_VALIDATION_VERSION,
} from './causal-setup-real-data-validation.types.js';
import type {
  CausalSetupCandidateTrack,
  CausalSetupDatasetValidationReport,
  CausalSetupRealDataLatencyStats,
  CausalSetupRealDataValidationAppliedOptions,
  CausalSetupRealDataValidationOptions,
  CausalSetupRealDataValidationReport,
  CausalSetupStageObservation,
  CausalSetupSymbolValidationReport,
  CausalSetupValidationViolation,
  CausalSetupValidationViolationCode,
} from './causal-setup-real-data-validation.types.js';
import {
  DEFAULT_SETUP_DETECTION_PIPELINE_OPTIONS,
  SetupDetectionPipeline,
} from './setup-detection-pipeline.js';
import type {
  SetupDetectionMarketStore,
  SetupDetectionPipelineOptions,
} from './setup-detection-pipeline.types.js';
import type {
  SetupEngineState,
} from './setup-engine.types.js';

interface IndexedClosedCandle {
  readonly originalIndex: number;
  readonly candle: LevelEngineCandle;
}

interface MutableCandidateTrack {
  readonly candidateId: string;
  readonly lineId: string;
  readonly symbol: string;
  readonly candidate: SetupEngineState;
  readonly firstSeenAt: string;
  readonly firstSeenCandleIndex: number;
  lastSeenAt: string;
  lastSeenCandleIndex: number;
  readonly observation:
    CausalSetupStageObservation;
  approach:
    CausalSetupStageObservation | null;
  confirmation:
    CausalSetupStageObservation | null;
  latestContext: SetupCausalContext;
  scanObservationCount: number;
  disappearanceCount: number;
  reappearanceCount: number;
  presentPreviousStep: boolean;
  presentAtEnd: boolean;
  readonly levelConfirmedToObservationBars:
    number | null;
}

export interface CausalSetupRealDataReplayProgress {
  readonly symbol: string;
  readonly completedStepCount: number;
  readonly totalStepCount: number;
  readonly currentClosedCandleCount: number;
  readonly totalClosedCandleCount: number;
}

export interface CausalSetupRealDataValidationDependencies {
  readonly onReplayProgress?: (
    progress: CausalSetupRealDataReplayProgress,
  ) => void;
}

export class CausalSetupRealDataValidationError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      'CausalSetupRealDataValidationError';
  }
}

function fail(
  message: string,
): never {
  throw new CausalSetupRealDataValidationError(
    message,
  );
}

function positiveInteger(
  value: number,
  field: string,
): number {
  if (
    !Number.isSafeInteger(value)
    || value <= 0
  ) {
    fail(
      `${field} must be a positive integer`,
    );
  }

  return value;
}

function positiveFinite(
  value: number,
  field: string,
): number {
  if (
    !Number.isFinite(value)
    || value <= 0
  ) {
    fail(
      `${field} must be a positive finite number`,
    );
  }

  return value;
}

function canonicalTimestamp(
  value: string,
  field: string,
): string {
  const parsed =
    Date.parse(value);

  if (!Number.isFinite(parsed)) {
    fail(
      `${field} must be a valid timestamp`,
    );
  }

  return new Date(parsed)
    .toISOString();
}

function cloneContext(
  value: SetupCausalContext,
): SetupCausalContext {
  return Object.freeze({
    ...value,
    realtimeConfirmationReasons:
      Object.freeze([
        ...value
          .realtimeConfirmationReasons,
      ]),
  });
}

function cloneCandidate(
  value: SetupEngineState,
): SetupEngineState {
  const causal =
    value.causal;

  return Object.freeze({
    ...value,
    level:
      Object.freeze({
        ...value.level,
      }),
    ...(causal
      ? {
          causal:
            cloneContext(causal),
        }
      : {}),
  });
}

function clonePipelineOptions(
  value: SetupDetectionPipelineOptions,
): SetupDetectionPipelineOptions {
  return Object.freeze({
    maxCandles:
      value.maxCandles,
    levelLinesOptions:
      Object.freeze({
        ...value.levelLinesOptions,
      }),
    candidateOptions:
      Object.freeze({
        ...value.candidateOptions,
      }),
    setupTypes:
      Object.freeze([
        ...value.setupTypes,
      ]),
  });
}

function appliedOptions(
  value:
    CausalSetupRealDataValidationOptions,
): CausalSetupRealDataValidationAppliedOptions {
  const pipelineOptions =
    clonePipelineOptions(
      value.pipelineOptions
      ?? DEFAULT_SETUP_DETECTION_PIPELINE_OPTIONS,
    );
  const fallbackStart =
    pipelineOptions
      .levelLinesOptions
      .atrPeriod
    + pipelineOptions
      .levelLinesOptions
      .pivotLeftBars
    + pipelineOptions
      .levelLinesOptions
      .pivotRightBars;
  const startAtClosedCandleCount =
    positiveInteger(
      value.startAtClosedCandleCount
      ?? fallbackStart,
      'startAtClosedCandleCount',
    );

  return Object.freeze({
    startAtClosedCandleCount,
    pipelineOptions,
    historicalRealtimeEvidenceMode:
      'unavailable',
  });
}

function validateDataset(
  value:
    LevelEngineValidationDatasetSnapshot,
): {
  readonly symbol: string;
  readonly closed:
    readonly IndexedClosedCandle[];
  readonly ignoredOpenCandlesCount:
    number;
} {
  const symbol =
    normalizeLevelEngineSymbol(
      value.symbol,
    );

  if (value.sourceTimeframe !== '1m') {
    fail(
      `dataset ${symbol} must use the production 1m timeframe`,
    );
  }

  let previousOpenMs =
    Number.NEGATIVE_INFINITY;
  let openCandleSeen =
    false;
  let ignoredOpenCandlesCount =
    0;
  const closed:
    IndexedClosedCandle[] = [];

  value.candles.forEach(
    (
      candle,
      originalIndex,
    ) => {
      const openTime =
        canonicalTimestamp(
          candle.openTime,
          `candles[${originalIndex}].openTime`,
        );
      const closeTime =
        canonicalTimestamp(
          candle.closeTime,
          `candles[${originalIndex}].closeTime`,
        );
      const openMs =
        Date.parse(openTime);
      const closeMs =
        Date.parse(closeTime);

      if (openMs <= previousOpenMs) {
        fail(
          'dataset candles must be strictly ordered and unique',
        );
      }
      if (closeMs < openMs) {
        fail(
          `candles[${originalIndex}].closeTime cannot precede openTime`,
        );
      }

      const open =
        positiveFinite(
          candle.open,
          `candles[${originalIndex}].open`,
        );
      const high =
        positiveFinite(
          candle.high,
          `candles[${originalIndex}].high`,
        );
      const low =
        positiveFinite(
          candle.low,
          `candles[${originalIndex}].low`,
        );
      const close =
        positiveFinite(
          candle.close,
          `candles[${originalIndex}].close`,
        );

      if (
        low > high
        || open < low
        || open > high
        || close < low
        || close > high
      ) {
        fail(
          `candles[${originalIndex}] contains invalid OHLC values`,
        );
      }

      if (!candle.isClosed) {
        openCandleSeen =
          true;
        ignoredOpenCandlesCount +=
          1;
      } else if (openCandleSeen) {
        fail(
          'closed candles cannot appear after an open candle',
        );
      }

      previousOpenMs =
        openMs;

      if (!candle.isClosed) {
        return;
      }

      closed.push(
        Object.freeze({
          originalIndex,
          candle:
            Object.freeze({
              openTime,
              closeTime,
              open,
              high,
              low,
              close,
              isClosed: true,
            }),
        }),
      );
    },
  );

  return Object.freeze({
    symbol,
    closed:
      Object.freeze(closed),
    ignoredOpenCandlesCount,
  });
}

function toKline(
  symbol: string,
  candle: LevelEngineCandle,
): BinanceOneMinuteKlineUpdate {
  return {
    symbol,
    eventTime:
      candle.closeTime,
    openTime:
      candle.openTime,
    closeTime:
      candle.closeTime,
    open:
      candle.open,
    high:
      candle.high,
    low:
      candle.low,
    close:
      candle.close,
    quoteVolume: 0,
    tradesCount: 0,
    takerBuyQuoteVolume: 0,
    isClosed: true,
  };
}

class PrefixMarketStore
implements SetupDetectionMarketStore {
  private prefix:
    readonly BinanceOneMinuteKlineUpdate[] =
      Object.freeze([]);

  constructor(
    private readonly symbol: string,
  ) {}

  setPrefix(
    values:
      readonly BinanceOneMinuteKlineUpdate[],
  ): void {
    this.prefix =
      Object.freeze(
        values.map(
          (value) =>
            Object.freeze({
              ...value,
            }),
        ),
      );
  }

  getKlines(
    symbolValue: string,
    limit?: number,
  ): BinanceOneMinuteKlineUpdate[] {
    const symbol =
      normalizeLevelEngineSymbol(
        symbolValue,
      );

    if (symbol !== this.symbol) {
      return [];
    }

    const selected =
      limit === undefined
        ? this.prefix
        : this.prefix.slice(
            -positiveInteger(
              limit,
              'market store limit',
            ),
          );

    return selected.map(
      (value) => ({
        ...value,
      }),
    );
  }

  getState(
    symbolValue: string,
  ): {
    kline:
      BinanceOneMinuteKlineUpdate
      | null;
    bookTicker:
      RealtimeBookTicker
      | null;
  } | null {
    const symbol =
      normalizeLevelEngineSymbol(
        symbolValue,
      );

    if (symbol !== this.symbol) {
      return null;
    }

    const latest =
      this.prefix.at(-1)
      ?? null;

    return {
      kline:
        latest
          ? {
              ...latest,
            }
          : null,
      bookTicker: null,
    };
  }
}

function latencyStats(
  values: readonly number[],
): CausalSetupRealDataLatencyStats {
  if (values.length === 0) {
    return Object.freeze({
      sampleCount: 0,
      minimumBars: null,
      medianBars: null,
      averageBars: null,
      maximumBars: null,
    });
  }

  const sorted =
    [...values].sort(
      (
        left,
        right,
      ) => left - right,
    );
  const middle =
    Math.floor(
      sorted.length / 2,
    );
  const median =
    sorted.length % 2 === 1
      ? sorted[middle]!
      : (
          sorted[middle - 1]!
          + sorted[middle]!
        ) / 2;
  const average =
    sorted.reduce(
      (
        total,
        value,
      ) => total + value,
      0,
    ) / sorted.length;

  return Object.freeze({
    sampleCount:
      sorted.length,
    minimumBars:
      sorted[0]!,
    medianBars:
      median,
    averageBars:
      Number(
        average.toFixed(4),
      ),
    maximumBars:
      sorted.at(-1)!,
  });
}

function violation(
  values:
    CausalSetupValidationViolation[],
  code:
    CausalSetupValidationViolationCode,
  symbol: string,
  observedCandleIndex: number,
  observedAt: string,
  candidateId: string | null,
  lineId: string | null,
  message: string,
): void {
  values.push(
    Object.freeze({
      code,
      symbol,
      observedCandleIndex,
      observedAt,
      candidateId,
      lineId,
      message,
    }),
  );
}

function contextCandleIndex(
  context: SetupCausalContext,
  symbol: string,
  candleIndexByCloseTime:
    ReadonlyMap<string, number>,
  currentCandleIndex: number,
  currentObservedAt: string,
  violations:
    CausalSetupValidationViolation[],
): number {
  const observedAt =
    canonicalTimestamp(
      context.observedAt,
      `context ${context.lineId} observedAt`,
    );
  const contextIndex =
    candleIndexByCloseTime.get(
      observedAt,
    );

  if (
    contextIndex === undefined
    || contextIndex > currentCandleIndex
    || Date.parse(observedAt)
      > Date.parse(currentObservedAt)
  ) {
    violation(
      violations,
      'future_observation',
      symbol,
      currentCandleIndex,
      currentObservedAt,
      null,
      context.lineId,
      `context ${context.lineId} is not backed by an available closed-candle prefix`,
    );

    return currentCandleIndex;
  }

  return contextIndex;
}

function stageObservation(
  contextValue: SetupCausalContext,
  symbol: string,
  candleIndexByCloseTime:
    ReadonlyMap<string, number>,
  currentCandleIndex: number,
  currentObservedAt: string,
  violations:
    CausalSetupValidationViolation[],
): CausalSetupStageObservation {
  const context =
    cloneContext(
      contextValue,
    );

  return Object.freeze({
    stage:
      context.stage,
    observedAt:
      canonicalTimestamp(
        context.observedAt,
        `context ${context.lineId} observedAt`,
      ),
    observedCandleIndex:
      contextCandleIndex(
        context,
        symbol,
        candleIndexByCloseTime,
        currentCandleIndex,
        currentObservedAt,
        violations,
      ),
    context,
  });
}

function validateContextThresholds(
  context: SetupCausalContext,
  symbol: string,
  currentCandleIndex: number,
  currentObservedAt: string,
  candidateId: string,
  violations:
    CausalSetupValidationViolation[],
): void {
  if (
    context.stage !== 'LEVEL_CONFIRMED'
    && (
      context.observationProgress
        === null
      || context.observationProgress
        < context
          .observationProgressThreshold
    )
  ) {
    violation(
      violations,
      'observation_below_threshold',
      symbol,
      currentCandleIndex,
      currentObservedAt,
      candidateId,
      context.lineId,
      `candidate ${candidateId} entered ${context.stage} below the observation threshold`,
    );
  }

  if (
    (
      context.stage === 'APPROACH'
      || context.stage
        === 'CONFIRMATION'
    )
    && (
      context.distanceToLevelPercent
        === null
      || context.distanceToLevelPercent
        > context
          .maxDistanceToLevelPercent
    )
  ) {
    violation(
      violations,
      'approach_outside_threshold',
      symbol,
      currentCandleIndex,
      currentObservedAt,
      candidateId,
      context.lineId,
      `candidate ${candidateId} entered ${context.stage} outside the approach threshold`,
    );
  }

  if (
    context.stage === 'CONFIRMATION'
  ) {
    violation(
      violations,
      'confirmation_without_realtime_evidence',
      symbol,
      currentCandleIndex,
      currentObservedAt,
      candidateId,
      context.lineId,
      `candidate ${candidateId} reached confirmation without historical realtime evidence`,
    );
  }
}

function createTrack(
  candidateValue: SetupEngineState,
  currentCandleIndex: number,
  currentObservedAt: string,
  candleIndexByCloseTime:
    ReadonlyMap<string, number>,
  violations:
    CausalSetupValidationViolation[],
): MutableCandidateTrack {
  const candidate =
    cloneCandidate(
      candidateValue,
    );
  const context =
    candidate.causal;

  if (!context) {
    fail(
      `candidate ${candidate.id} has no causal context`,
    );
  }
  if (context.stage !== 'OBSERVATION') {
    fail(
      `candidate ${candidate.id} must start from OBSERVATION`,
    );
  }
  if (
    candidate.timeframe !== '1m'
    || candidate.createdAt
      !== context.observedAt
  ) {
    fail(
      `candidate ${candidate.id} identity does not match its causal context`,
    );
  }

  const observation =
    stageObservation(
      context,
      candidate.symbol,
      candleIndexByCloseTime,
      currentCandleIndex,
      currentObservedAt,
      violations,
    );
  const confirmedAt =
    canonicalTimestamp(
      candidate.level.confirmedAt,
      `candidate ${candidate.id} level.confirmedAt`,
    );
  const confirmedIndex =
    candleIndexByCloseTime.get(
      confirmedAt,
    );

  if (confirmedIndex === undefined) {
    violation(
      violations,
      'missing_level_confirmation_candle',
      candidate.symbol,
      currentCandleIndex,
      currentObservedAt,
      candidate.id,
      context.lineId,
      `candidate ${candidate.id} level confirmation is unavailable in the dataset`,
    );
  } else if (
    confirmedIndex
      > observation
        .observedCandleIndex
  ) {
    violation(
      violations,
      'future_observation',
      candidate.symbol,
      currentCandleIndex,
      currentObservedAt,
      candidate.id,
      context.lineId,
      `candidate ${candidate.id} observation precedes level confirmation`,
    );
  }

  validateContextThresholds(
    context,
    candidate.symbol,
    currentCandleIndex,
    currentObservedAt,
    candidate.id,
    violations,
  );

  return {
    candidateId:
      candidate.id,
    lineId:
      context.lineId,
    symbol:
      candidate.symbol,
    candidate,
    firstSeenAt:
      currentObservedAt,
    firstSeenCandleIndex:
      currentCandleIndex,
    lastSeenAt:
      currentObservedAt,
    lastSeenCandleIndex:
      currentCandleIndex,
    observation,
    approach: null,
    confirmation: null,
    latestContext:
      context,
    scanObservationCount: 0,
    disappearanceCount: 0,
    reappearanceCount: 0,
    presentPreviousStep: false,
    presentAtEnd: false,
    levelConfirmedToObservationBars:
      confirmedIndex === undefined
      || confirmedIndex
        > observation
          .observedCandleIndex
        ? null
        : observation
          .observedCandleIndex
          - confirmedIndex,
  };
}

function applyUpdate(
  track: MutableCandidateTrack,
  update: SetupCausalUpdate,
  currentCandleIndex: number,
  currentObservedAt: string,
  candleIndexByCloseTime:
    ReadonlyMap<string, number>,
  violations:
    CausalSetupValidationViolation[],
): void {
  const context =
    cloneContext(
      update.context,
    );

  if (
    update.candidateId
      !== track.candidateId
    || context.lineId
      !== track.lineId
  ) {
    violation(
      violations,
      'candidate_identity_changed',
      track.symbol,
      currentCandleIndex,
      currentObservedAt,
      update.candidateId,
      context.lineId,
      `candidate ${track.candidateId} changed causal identity`,
    );

    return;
  }

  validateContextThresholds(
    context,
    track.symbol,
    currentCandleIndex,
    currentObservedAt,
    track.candidateId,
    violations,
  );

  const observation =
    stageObservation(
      context,
      track.symbol,
      candleIndexByCloseTime,
      currentCandleIndex,
      currentObservedAt,
      violations,
    );

  if (
    context.stage === 'APPROACH'
    && track.approach === null
  ) {
    track.approach =
      observation;
  }
  if (
    context.stage === 'CONFIRMATION'
    && track.confirmation === null
  ) {
    track.confirmation =
      observation;
  }

  track.latestContext =
    context;

  if (!track.presentPreviousStep) {
    if (track.scanObservationCount > 0) {
      track.reappearanceCount +=
        1;
    }
    track.presentPreviousStep =
      true;
  }

  track.presentAtEnd =
    true;
  track.lastSeenAt =
    currentObservedAt;
  track.lastSeenCandleIndex =
    currentCandleIndex;
  track.scanObservationCount +=
    1;
}

function freezeTrack(
  value: MutableCandidateTrack,
): CausalSetupCandidateTrack {
  const approachLag =
    value.approach === null
      ? null
      : value.approach
        .observedCandleIndex
        - value.observation
          .observedCandleIndex;
  const confirmationLag =
    value.confirmation === null
    || value.approach === null
      ? null
      : value.confirmation
        .observedCandleIndex
        - value.approach
          .observedCandleIndex;

  return Object.freeze({
    candidateId:
      value.candidateId,
    lineId:
      value.lineId,
    symbol:
      value.symbol,
    timeframe: '1m',
    setupType:
      value.candidate.setupType,
    direction:
      value.candidate.direction,
    levelKind:
      value.candidate.level.kind,
    levelPrice:
      value.candidate.level.centerPrice,
    levelConfirmedAt:
      value.candidate.level.confirmedAt,
    candidate:
      value.candidate,
    firstSeenAt:
      value.firstSeenAt,
    firstSeenCandleIndex:
      value.firstSeenCandleIndex,
    lastSeenAt:
      value.lastSeenAt,
    lastSeenCandleIndex:
      value.lastSeenCandleIndex,
    observation:
      value.observation,
    approach:
      value.approach,
    confirmation:
      value.confirmation,
    latestContext:
      value.latestContext,
    scanObservationCount:
      value.scanObservationCount,
    disappearanceCount:
      value.disappearanceCount,
    reappearanceCount:
      value.reappearanceCount,
    presentAtEnd:
      value.presentAtEnd,
    levelConfirmedToObservationBars:
      value
        .levelConfirmedToObservationBars,
    observationToApproachBars:
      approachLag,
    approachToConfirmationBars:
      confirmationLag,
  });
}

function sum(
  values: readonly number[],
): number {
  return values.reduce(
    (
      total,
      value,
    ) => total + value,
    0,
  );
}

export function replayCausalSetupRealDataDataset(
  dataset:
    LevelEngineValidationDatasetSnapshot,
  optionsValue:
    CausalSetupRealDataValidationOptions = {},
  dependencies:
    CausalSetupRealDataValidationDependencies = {},
): CausalSetupDatasetValidationReport {
  const validated =
    validateDataset(
      dataset,
    );
  const options =
    appliedOptions(
      optionsValue,
    );
  const candles =
    validated.closed.map(
      (value) =>
        toKline(
          validated.symbol,
          value.candle,
        ),
    );

  if (
    options.startAtClosedCandleCount
      > candles.length
  ) {
    fail(
      `dataset ${validated.symbol} has ${candles.length} closed candles, fewer than startAtClosedCandleCount ${options.startAtClosedCandleCount}`,
    );
  }

  const candleIndexByCloseTime =
    new Map<string, number>(
      validated.closed.map(
        (value) => [
          value.candle.closeTime,
          value.originalIndex,
        ],
      ),
    );
  const store =
    new PrefixMarketStore(
      validated.symbol,
    );
  let replayNow =
    new Date(0);
  const pipeline =
    new SetupDetectionPipeline(
      store,
      options.pipelineOptions,
      {
        now: () =>
          new Date(
            replayNow.getTime(),
          ),
      },
    );
  const tracks =
    new Map<
      string,
      MutableCandidateTrack
    >();
  const uniqueLevelIds =
    new Set<string>();
  const violations:
    CausalSetupValidationViolation[] = [];
  let replayStepCount = 0;
  let activeLevelObservationCount = 0;
  let emittedCandidateCount = 0;
  let duplicateCandidateObservationCount =
    0;
  const totalStepCount =
    candles.length
    - options.startAtClosedCandleCount
    + 1;

  for (
    let closedCount =
      options
        .startAtClosedCandleCount;
    closedCount <= candles.length;
    closedCount += 1
  ) {
    const current =
      validated.closed[
        closedCount - 1
      ];

    if (!current) {
      continue;
    }

    replayStepCount += 1;
    replayNow =
      new Date(
        current.candle.closeTime,
      );
    store.setPrefix(
      candles.slice(
        0,
        closedCount,
      ),
    );

    const result =
      pipeline.scanSymbol(
        validated.symbol,
      );

    if (
      result.symbol
        !== validated.symbol
      || result.timeframe !== '1m'
      || result.source
        !== 'level_lines'
      || result.sourceCreatesSetup
        !== false
      || result.createsSignal
        !== false
      || result.evaluatesBreakout
        !== false
      || result.evaluatesBounce
        !== false
    ) {
      fail(
        `pipeline contract does not match ${validated.symbol} replay`,
      );
    }

    activeLevelObservationCount +=
      result.levels.length;
    result.levels.forEach(
      (level) =>
        uniqueLevelIds.add(
          level.id,
        ),
    );
    emittedCandidateCount +=
      result.candidates.length;
    duplicateCandidateObservationCount +=
      result
        .duplicateCandidateIds
        .length;

    const updatesByCandidateId =
      new Map<string, SetupCausalUpdate>();

    result.causalUpdates.forEach(
      (update) => {
        if (
          updatesByCandidateId.has(
            update.candidateId,
          )
        ) {
          fail(
            `duplicate causal update for ${update.candidateId}`,
          );
        }

        updatesByCandidateId.set(
          update.candidateId,
          update,
        );
      },
    );

    for (
      const candidate
      of result.candidates
    ) {
      if (
        tracks.has(
          candidate.id,
        )
      ) {
        fail(
          `pipeline emitted duplicate candidate ${candidate.id}`,
        );
      }

      const update =
        updatesByCandidateId.get(
          candidate.id,
        );

      if (!update) {
        violation(
          violations,
          'candidate_without_update',
          validated.symbol,
          current.originalIndex,
          current.candle.closeTime,
          candidate.id,
          candidate.causal
            ?.lineId
            ?? null,
          `candidate ${candidate.id} has no causal update`,
        );
      }

      tracks.set(
        candidate.id,
        createTrack(
          candidate,
          current.originalIndex,
          current.candle.closeTime,
          candleIndexByCloseTime,
          violations,
        ),
      );
    }

    const presentCandidateIds =
      new Set<string>();

    for (
      const update
      of result.causalUpdates
    ) {
      const track =
        tracks.get(
          update.candidateId,
        );

      if (!track) {
        violation(
          violations,
          'update_without_candidate',
          validated.symbol,
          current.originalIndex,
          current.candle.closeTime,
          update.candidateId,
          update.context.lineId,
          `causal update ${update.candidateId} has no emitted candidate`,
        );

        continue;
      }

      presentCandidateIds.add(
        update.candidateId,
      );
      applyUpdate(
        track,
        update,
        current.originalIndex,
        current.candle.closeTime,
        candleIndexByCloseTime,
        violations,
      );
    }

    for (
      const track
      of tracks.values()
    ) {
      if (
        track.presentPreviousStep
        && !presentCandidateIds.has(
          track.candidateId,
        )
      ) {
        track.presentPreviousStep =
          false;
        track.presentAtEnd =
          false;
        track.disappearanceCount +=
          1;
      }
    }

    dependencies.onReplayProgress?.(
      Object.freeze({
        symbol:
          validated.symbol,
        completedStepCount:
          replayStepCount,
        totalStepCount,
        currentClosedCandleCount:
          closedCount,
        totalClosedCandleCount:
          candles.length,
      }),
    );
  }

  const candidateTracks =
    Object.freeze(
      [...tracks.values()]
        .sort(
          (
            left,
            right,
          ) =>
            left.firstSeenCandleIndex
            - right.firstSeenCandleIndex
            || left.candidateId
              .localeCompare(
                right.candidateId,
              ),
        )
        .map(
          freezeTrack,
        ),
    );
  const levelConfirmedToObservationBars =
    candidateTracks
      .map(
        (track) =>
          track
            .levelConfirmedToObservationBars,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );
  const observationToApproachBars =
    candidateTracks
      .map(
        (track) =>
          track
            .observationToApproachBars,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );
  const approachToConfirmationBars =
    candidateTracks
      .map(
        (track) =>
          track
            .approachToConfirmationBars,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );

  return Object.freeze({
    symbol:
      validated.symbol,
    sourceTimeframe: '1m',
    closedCandlesCount:
      validated.closed.length,
    ignoredOpenCandlesCount:
      validated
        .ignoredOpenCandlesCount,
    firstClosedAt:
      validated.closed[0]
        ?.candle.closeTime
      ?? null,
    lastClosedAt:
      validated.closed.at(-1)
        ?.candle.closeTime
      ?? null,
    candidateTracks,
    violations:
      Object.freeze([
        ...violations,
      ]),
    totals:
      Object.freeze({
        replayStepCount,
        activeLevelObservationCount,
        uniqueLevelCount:
          uniqueLevelIds.size,
        emittedCandidateCount,
        candidateTrackCount:
          candidateTracks.length,
        breakoutCandidateCount:
          candidateTracks.filter(
            (track) =>
              track.setupType
              === 'level_breakout',
          ).length,
        bounceCandidateCount:
          candidateTracks.filter(
            (track) =>
              track.setupType
              === 'level_bounce',
          ).length,
        longCandidateCount:
          candidateTracks.filter(
            (track) =>
              track.direction
              === 'long',
          ).length,
        shortCandidateCount:
          candidateTracks.filter(
            (track) =>
              track.direction
              === 'short',
          ).length,
        observationReachedCount:
          candidateTracks.length,
        approachReachedCount:
          candidateTracks.filter(
            (track) =>
              track.approach
              !== null,
          ).length,
        confirmationReachedCount:
          candidateTracks.filter(
            (track) =>
              track.confirmation
              !== null,
          ).length,
        duplicateCandidateObservationCount,
        candidateDisappearanceCount:
          sum(
            candidateTracks.map(
              (track) =>
                track
                  .disappearanceCount,
            ),
          ),
        candidateReappearanceCount:
          sum(
            candidateTracks.map(
              (track) =>
                track
                  .reappearanceCount,
            ),
          ),
        violationCount:
          violations.length,
        levelConfirmedToObservationBars:
          latencyStats(
            levelConfirmedToObservationBars,
          ),
        observationToApproachBars:
          latencyStats(
            observationToApproachBars,
          ),
        approachToConfirmationBars:
          latencyStats(
            approachToConfirmationBars,
          ),
      }),
    appliedOptions:
      options,
    historicalRealtimeEvidenceAvailable:
      false,
    realtimeConfirmationValidated:
      false,
    outcomeClassificationValidated:
      false,
    usesFutureCandles: false,
    usesFutureRealtimeEvidence: false,
  });
}

function cloneDataset(
  value:
    LevelEngineValidationDatasetSnapshot,
): LevelEngineValidationDatasetSnapshot {
  return Object.freeze({
    symbol:
      normalizeLevelEngineSymbol(
        value.symbol,
      ),
    sourceTimeframe:
      value.sourceTimeframe,
    candles:
      Object.freeze(
        value.candles.map(
          (candle) =>
            Object.freeze({
              ...candle,
            }),
        ),
      ),
  });
}

export function buildCausalSetupRealDataValidationReport(
  source:
    LevelEngineRealDataValidationReport,
  optionsValue:
    CausalSetupRealDataValidationOptions = {},
  dependencies:
    CausalSetupRealDataValidationDependencies = {},
): CausalSetupRealDataValidationReport {
  if (
    source.version
      !== 'level-engine-real-data-validation-v0.1'
    || source.observationalOnly
      !== true
    || source.createsSetup
      !== false
    || source.usesQualityScore
      !== false
  ) {
    fail(
      'source Level Engine validation contract is incompatible',
    );
  }
  if (
    !source.requestedTimeframes
      .includes('1m')
  ) {
    fail(
      'source validation must include the production 1m timeframe',
    );
  }

  const generatedAt =
    canonicalTimestamp(
      source.generatedAt,
      'source generatedAt',
    );
  const options =
    appliedOptions(
      optionsValue,
    );
  const sourceDatasets =
    Object.freeze(
      source.symbolReports
        .flatMap(
          (symbolReport) =>
            symbolReport.datasets,
        )
        .filter(
          (dataset) =>
            dataset.sourceTimeframe
            === '1m',
        )
        .map(
          cloneDataset,
        ),
    );

  if (sourceDatasets.length === 0) {
    fail(
      'source validation contains no 1m datasets',
    );
  }

  const datasetKeys =
    new Set<string>();
  const symbolReports:
    CausalSetupSymbolValidationReport[] = [];

  for (
    const dataset
    of sourceDatasets
  ) {
    const symbol =
      normalizeLevelEngineSymbol(
        dataset.symbol,
      );
    const key =
      `${symbol}:1m`;

    if (datasetKeys.has(key)) {
      fail(
        `duplicate source dataset: ${key}`,
      );
    }
    datasetKeys.add(key);

    symbolReports.push(
      Object.freeze({
        symbol,
        dataset:
          replayCausalSetupRealDataDataset(
            dataset,
            options,
            dependencies,
          ),
      }),
    );
  }

  symbolReports.sort(
    (
      left,
      right,
    ) =>
      left.symbol.localeCompare(
        right.symbol,
      ),
  );

  const datasets =
    symbolReports.map(
      (report) =>
        report.dataset,
    );
  const tracks =
    datasets.flatMap(
      (dataset) =>
        dataset.candidateTracks,
    );
  const levelConfirmedToObservationBars =
    tracks
      .map(
        (track) =>
          track
            .levelConfirmedToObservationBars,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );
  const observationToApproachBars =
    tracks
      .map(
        (track) =>
          track
            .observationToApproachBars,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );
  const approachToConfirmationBars =
    tracks
      .map(
        (track) =>
          track
            .approachToConfirmationBars,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );

  return Object.freeze({
    version:
      CAUSAL_SETUP_REAL_DATA_VALIDATION_VERSION,
    sourceValidationVersion:
      source.version,
    generatedAt,
    requestedSymbols:
      Object.freeze(
        source.requestedSymbols.map(
          (symbol) =>
            normalizeLevelEngineSymbol(
              symbol,
            ),
        ),
      ),
    sourceDatasets,
    symbolReports:
      Object.freeze([
        ...symbolReports,
      ]),
    totals:
      Object.freeze({
        symbolCount:
          symbolReports.length,
        datasetCount:
          datasets.length,
        closedCandlesCount:
          sum(
            datasets.map(
              (dataset) =>
                dataset
                  .closedCandlesCount,
            ),
          ),
        ignoredOpenCandlesCount:
          sum(
            datasets.map(
              (dataset) =>
                dataset
                  .ignoredOpenCandlesCount,
            ),
          ),
        replayStepCount:
          sum(
            datasets.map(
              (dataset) =>
                dataset.totals
                  .replayStepCount,
            ),
          ),
        activeLevelObservationCount:
          sum(
            datasets.map(
              (dataset) =>
                dataset.totals
                  .activeLevelObservationCount,
            ),
          ),
        uniqueLevelCount:
          sum(
            datasets.map(
              (dataset) =>
                dataset.totals
                  .uniqueLevelCount,
            ),
          ),
        emittedCandidateCount:
          sum(
            datasets.map(
              (dataset) =>
                dataset.totals
                  .emittedCandidateCount,
            ),
          ),
        candidateTrackCount:
          tracks.length,
        breakoutCandidateCount:
          tracks.filter(
            (track) =>
              track.setupType
              === 'level_breakout',
          ).length,
        bounceCandidateCount:
          tracks.filter(
            (track) =>
              track.setupType
              === 'level_bounce',
          ).length,
        longCandidateCount:
          tracks.filter(
            (track) =>
              track.direction
              === 'long',
          ).length,
        shortCandidateCount:
          tracks.filter(
            (track) =>
              track.direction
              === 'short',
          ).length,
        observationReachedCount:
          tracks.length,
        approachReachedCount:
          tracks.filter(
            (track) =>
              track.approach
              !== null,
          ).length,
        confirmationReachedCount:
          tracks.filter(
            (track) =>
              track.confirmation
              !== null,
          ).length,
        duplicateCandidateObservationCount:
          sum(
            datasets.map(
              (dataset) =>
                dataset.totals
                  .duplicateCandidateObservationCount,
            ),
          ),
        candidateDisappearanceCount:
          sum(
            tracks.map(
              (track) =>
                track
                  .disappearanceCount,
            ),
          ),
        candidateReappearanceCount:
          sum(
            tracks.map(
              (track) =>
                track
                  .reappearanceCount,
            ),
          ),
        violationCount:
          sum(
            datasets.map(
              (dataset) =>
                dataset
                  .violations.length,
            ),
          ),
        levelConfirmedToObservationBars:
          latencyStats(
            levelConfirmedToObservationBars,
          ),
        observationToApproachBars:
          latencyStats(
            observationToApproachBars,
          ),
        approachToConfirmationBars:
          latencyStats(
            approachToConfirmationBars,
          ),
      }),
    appliedOptions:
      options,
    offlineOnly: true,
    reusesFetchedDatasets: true,
    historicalRealtimeEvidenceAvailable:
      false,
    realtimeConfirmationValidated:
      false,
    outcomeClassificationValidated:
      false,
    changesTradingRules: false,
    createsLiveSetup: false,
    createsSignal: false,
    usesQualityScore: false,
    appliesTraining: false,
    usesFutureCandles: false,
    usesFutureRealtimeEvidence: false,
  });
}
