import {
  createHash,
} from 'node:crypto';
import type {
  CausalSetupRealDataValidationReport,
} from '../setup-engine/causal-setup-real-data-validation.types.js';
import {
  detectLevelLines,
} from './level-lines-detector.js';
import type {
  LevelEngineValidationDatasetSnapshot,
} from './level-engine-real-data-validation.types.js';
import type {
  LevelLine,
  LevelLinesDetectionResult,
} from './level-lines.types.js';
import {
  LEVEL_LINES_EXACT_PRICE_ORIGIN_RESOLUTION_VERSION,
} from './level-lines-exact-price-origin-resolution.types.js';
import {
  LEVEL_LINES_EXACT_PRICE_ORIGIN_RESOLUTION_REAL_DATA_VALIDATION_VERSION,
} from './level-lines-exact-price-origin-resolution-real-data-validation.types.js';
import type {
  LevelLinesExactPriceOriginResolutionDatasetValidationReport,
  LevelLinesExactPriceOriginResolutionDecisionObservation,
  LevelLinesExactPriceOriginResolutionRealDataValidationReport,
  LevelLinesExactPriceOriginResolutionRealDataValidationStatus,
  LevelLinesExactPriceOriginResolutionRealDataViolation,
  LevelLinesExactPriceOriginResolutionRealDataViolationCode,
  LevelLinesExactPriceOriginResolutionReplayPass,
} from './level-lines-exact-price-origin-resolution-real-data-validation.types.js';

export interface LevelLinesExactPriceOriginResolutionRealDataValidationOptions {
  readonly generatedAt?: string;
  readonly sourceDatasetHash?: string | null;
}

export interface LevelLinesExactPriceOriginResolutionReplayProgress {
  readonly symbol: string;
  readonly pass:
    LevelLinesExactPriceOriginResolutionReplayPass;
  readonly completedStepCount: number;
  readonly totalStepCount: number;
}

export interface LevelLinesExactPriceOriginResolutionRealDataValidationDependencies {
  readonly now?: () => Date;
  readonly onReplayProgress?: (
    progress:
      LevelLinesExactPriceOriginResolutionReplayProgress,
  ) => void;
}

export class LevelLinesExactPriceOriginResolutionRealDataValidationError
  extends Error {
  public constructor(message: string) {
    super(message);
    this.name =
      'LevelLinesExactPriceOriginResolutionRealDataValidationError';
  }
}

interface MutableDecisionObservation {
  key: string;
  groupKey: string;
  symbol: string;
  timeframe: '1m';
  kind: LevelLine['kind'];
  price: number;
  olderLineId: string;
  newerLineId: string;
  action:
    LevelLinesExactPriceOriginDecision['action'];
  currentLineId: string;
  suppressedCurrentLineId: string;
  retainedHistoryLineId: string;
  firstObservedAt: string;
  lastObservedAt: string;
  observationCount: number;
}

type LevelLinesExactPriceOriginDecision =
  LevelLinesDetectionResult[
    'exactPriceOriginResolution'
  ]['decisions'][number];

interface PrimaryReplayResult {
  readonly fingerprints: readonly string[];
  readonly replayFingerprint: string;
  readonly decisions:
    ReadonlyMap<string, MutableDecisionObservation>;
  readonly violations:
    LevelLinesExactPriceOriginResolutionRealDataViolation[];
  readonly seenViolations: Set<string>;
  readonly historyLineObservationCount: number;
  readonly inputCurrentLineObservationCount: number;
  readonly resolvedCurrentLineObservationCount: number;
  readonly resolutionObservationCount: number;
  readonly decisionObservationCount: number;
  readonly suppressedCurrentLineObservationCount: number;
  readonly suppressedCurrentLineIds: ReadonlySet<string>;
  readonly retainedHistoryLineObservationCount: number;
  readonly residualCurrentCollisionObservationCount: number;
  readonly residualCurrentCollisionGroupKeys: ReadonlySet<string>;
}

function fail(message: string): never {
  throw new LevelLinesExactPriceOriginResolutionRealDataValidationError(
    message,
  );
}

function canonicalTimestamp(
  value: string,
  field: string,
): string {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    fail(`${field} must be a valid timestamp`);
  }

  return new Date(parsed).toISOString();
}

function lineGroupKey(line: LevelLine): string {
  return [
    line.symbol,
    line.timeframe,
    line.kind,
    String(line.price),
  ].join('|');
}

function addViolation(
  violations:
    LevelLinesExactPriceOriginResolutionRealDataViolation[],
  seen: Set<string>,
  value: Readonly<{
    code:
      LevelLinesExactPriceOriginResolutionRealDataViolationCode;
    symbol: string;
    replayPass:
      LevelLinesExactPriceOriginResolutionReplayPass;
    observedAt: string | null;
    closedCandleIndex: number | null;
    groupKey?: string | null;
    decisionKey?: string | null;
    lineId?: string | null;
    message: string;
  }>,
): void {
  const key = [
    value.code,
    value.symbol,
    value.replayPass,
    value.observedAt ?? '',
    value.groupKey ?? '',
    value.decisionKey ?? '',
    value.lineId ?? '',
  ].join('|');

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  violations.push(
    Object.freeze({
      code: value.code,
      symbol: value.symbol,
      replayPass:
        value.replayPass,
      observedAt:
        value.observedAt,
      closedCandleIndex:
        value.closedCandleIndex,
      groupKey:
        value.groupKey ?? null,
      decisionKey:
        value.decisionKey ?? null,
      lineId:
        value.lineId ?? null,
      message: value.message,
    }),
  );
}

function cloneClosedCandles(
  dataset:
    LevelEngineValidationDatasetSnapshot,
) {
  return Object.freeze(
    dataset.candles
      .filter((candle) => candle.isClosed)
      .map(
        (candle) => Object.freeze({
          ...candle,
          isClosed: true as const,
        }),
      ),
  );
}

function snapshotFingerprint(
  observedAt: string,
  detection: LevelLinesDetectionResult,
): string {
  const serializable = {
    observedAt,
    history: detection.lines.map(
      (line) => ({
        id: line.id,
        kind: line.kind,
        price: line.price,
        originExtremumAt:
          line.originExtremumAt,
        activeFrom: line.activeFrom,
        confirmedAt: line.confirmedAt,
        workedAt: line.workedAt,
        supersededAt: line.supersededAt,
        brokenAt: line.brokenAt,
        status: line.status,
      }),
    ),
    currentLineIds:
      detection.activeLevels.map(
        (line) => line.id,
      ),
    decisions:
      detection
        .exactPriceOriginResolution
        .decisions.map(
          (decision) => ({
            key: decision.key,
            action: decision.action,
            effectiveAt:
              decision.effectiveAt,
            currentLineId:
              decision.currentLineId,
            suppressedCurrentLineId:
              decision
                .suppressedCurrentLineId,
            retainedHistoryLineId:
              decision
                .retainedHistoryLineId,
          }),
        ),
    totals:
      detection
        .exactPriceOriginResolution
        .totals,
  };

  return createHash('sha256')
    .update(
      JSON.stringify(serializable),
      'utf8',
    )
    .digest('hex');
}

function replayFingerprint(
  fingerprints: readonly string[],
): string {
  return createHash('sha256')
    .update(
      fingerprints.join('\n'),
      'utf8',
    )
    .digest('hex');
}

function validateDecision(
  symbol: string,
  observedAt: string,
  closedCandleIndex: number,
  decision:
    LevelLinesExactPriceOriginDecision,
  historyById: ReadonlyMap<string, LevelLine>,
  violations:
    LevelLinesExactPriceOriginResolutionRealDataViolation[],
  seenViolations: Set<string>,
): void {
  const older = historyById.get(
    decision.olderLineId,
  );
  const newer = historyById.get(
    decision.newerLineId,
  );

  if (!older || !newer) {
    addViolation(
      violations,
      seenViolations,
      {
        code:
          'suppressed_line_missing_from_history',
        symbol,
        replayPass: 'primary',
        observedAt,
        closedCandleIndex,
        groupKey: decision.groupKey,
        decisionKey: decision.key,
        lineId:
          !older
            ? decision.olderLineId
            : decision.newerLineId,
        message:
          'resolution decision references a line missing from full history',
      },
    );
    return;
  }

  if (
    lineGroupKey(older)
      !== decision.groupKey
    || lineGroupKey(newer)
      !== decision.groupKey
    || older.price !== newer.price
  ) {
    addViolation(
      violations,
      seenViolations,
      {
        code: 'decision_scope_mismatch',
        symbol,
        replayPass: 'primary',
        observedAt,
        closedCandleIndex,
        groupKey: decision.groupKey,
        decisionKey: decision.key,
        message:
          'resolution decision crosses symbol, timeframe, kind, or exact-price scope',
      },
    );
  }

  const actionValid =
    decision.action
      === 'reuse_active_exact_price_identity'
      ? decision.olderStatusAtResolution
          !== 'worked'
        && decision.currentLineId
          === decision.olderLineId
        && decision.suppressedCurrentLineId
          === decision.newerLineId
        && decision.retainedHistoryLineId
          === decision.newerLineId
      : decision.olderStatusAtResolution
          === 'worked'
        && decision.currentLineId
          === decision.newerLineId
        && decision.suppressedCurrentLineId
          === decision.olderLineId
        && decision.retainedHistoryLineId
          === decision.olderLineId;

  if (!actionValid) {
    addViolation(
      violations,
      seenViolations,
      {
        code: 'decision_action_mismatch',
        symbol,
        replayPass: 'primary',
        observedAt,
        closedCandleIndex,
        groupKey: decision.groupKey,
        decisionKey: decision.key,
        message:
          'resolution action does not match the older lifecycle state and selected identity',
      },
    );
  }
}

function validateSnapshot(
  symbol: string,
  observedAt: string,
  closedCandleIndex: number,
  detection: LevelLinesDetectionResult,
  decisions:
    Map<string, MutableDecisionObservation>,
  violations:
    LevelLinesExactPriceOriginResolutionRealDataViolation[],
  seenViolations: Set<string>,
  suppressedCurrentLineIds: Set<string>,
  residualCurrentCollisionGroupKeys:
    Set<string>,
): Readonly<{
  residualCollisionObserved: boolean;
}> {
  const resolution =
    detection.exactPriceOriginResolution;
  const historyById = new Map(
    detection.lines.map(
      (line) => [line.id, line] as const,
    ),
  );

  if (
    resolution.version
      !== LEVEL_LINES_EXACT_PRICE_ORIGIN_RESOLUTION_VERSION
    || resolution.preservesFullHistory
      !== true
    || resolution.usesExactPriceOnly
      !== true
    || resolution.mergesNearbyPrices
      !== false
    || resolution.changesTradingRules
      !== false
    || resolution.createsSetup !== false
    || resolution.createsSignal !== false
    || resolution.createsTradeOrder
      !== false
    || resolution.usesFutureCandles
      !== false
  ) {
    addViolation(
      violations,
      seenViolations,
      {
        code: 'resolution_contract_mismatch',
        symbol,
        replayPass: 'primary',
        observedAt,
        closedCandleIndex,
        message:
          'production resolution safety contract is incompatible with validation',
      },
    );
  }

  if (
    resolution.totals.historyLineCount
      !== detection.lines.length
    || resolution.totals
      .retainedHistoryLineCount
      !== detection.lines.length
    || resolution.totals
      .resolvedCurrentLineCount
      !== detection.activeLevels.length
    || resolution.totals
      .inputCurrentLineCount
      - resolution.totals
        .resolvedCurrentLineCount
      !== resolution.totals
        .suppressedCurrentLineCount
  ) {
    addViolation(
      violations,
      seenViolations,
      {
        code: 'history_count_mismatch',
        symbol,
        replayPass: 'primary',
        observedAt,
        closedCandleIndex,
        message:
          'resolution totals do not preserve the full history/current projection accounting',
      },
    );
  }

  const observedMs = Date.parse(observedAt);
  for (const line of detection.lines) {
    if (
      Date.parse(line.originExtremumAt)
        > observedMs
    ) {
      addViolation(
        violations,
        seenViolations,
        {
          code: 'future_line_origin',
          symbol,
          replayPass: 'primary',
          observedAt,
          closedCandleIndex,
          groupKey: lineGroupKey(line),
          lineId: line.id,
          message:
            'line origin is later than the causal replay boundary',
        },
      );
    }

    if (Date.parse(line.activeFrom) > observedMs) {
      addViolation(
        violations,
        seenViolations,
        {
          code: 'future_line_activation',
          symbol,
          replayPass: 'primary',
          observedAt,
          closedCandleIndex,
          groupKey: lineGroupKey(line),
          lineId: line.id,
          message:
            'line activation is later than the causal replay boundary',
        },
      );
    }
  }

  for (const decision of resolution.decisions) {
    validateDecision(
      symbol,
      observedAt,
      closedCandleIndex,
      decision,
      historyById,
      violations,
      seenViolations,
    );
    suppressedCurrentLineIds.add(
      decision.suppressedCurrentLineId,
    );

    const existing = decisions.get(
      decision.key,
    );

    if (existing) {
      if (
        existing.action !== decision.action
        || existing.currentLineId
          !== decision.currentLineId
        || existing.suppressedCurrentLineId
          !== decision.suppressedCurrentLineId
      ) {
        addViolation(
          violations,
          seenViolations,
          {
            code: 'decision_action_mismatch',
            symbol,
            replayPass: 'primary',
            observedAt,
            closedCandleIndex,
            groupKey: decision.groupKey,
            decisionKey: decision.key,
            message:
              'the same causal resolution decision changed across prefixes',
          },
        );
      }
      existing.lastObservedAt = observedAt;
      existing.observationCount += 1;
    } else {
      decisions.set(
        decision.key,
        {
          key: decision.key,
          groupKey: decision.groupKey,
          symbol: decision.symbol,
          timeframe: '1m',
          kind: decision.kind,
          price: decision.price,
          olderLineId:
            decision.olderLineId,
          newerLineId:
            decision.newerLineId,
          action: decision.action,
          currentLineId:
            decision.currentLineId,
          suppressedCurrentLineId:
            decision
              .suppressedCurrentLineId,
          retainedHistoryLineId:
            decision
              .retainedHistoryLineId,
          firstObservedAt: observedAt,
          lastObservedAt: observedAt,
          observationCount: 1,
        },
      );
    }
  }

  const currentGroups = new Map<string, number>();
  for (const line of detection.activeLevels) {
    const key = lineGroupKey(line);
    currentGroups.set(
      key,
      (currentGroups.get(key) ?? 0) + 1,
    );
  }

  let residualCollisionObserved = false;
  for (const [key, count] of currentGroups) {
    if (count < 2) {
      continue;
    }

    residualCollisionObserved = true;
    residualCurrentCollisionGroupKeys.add(key);
    addViolation(
      violations,
      seenViolations,
      {
        code: 'residual_current_collision',
        symbol,
        replayPass: 'primary',
        observedAt,
        closedCandleIndex,
        groupKey: key,
        message:
          `resolved current projection retains ${count} exact-price identities`,
      },
    );
  }

  return Object.freeze({
    residualCollisionObserved,
  });
}

function primaryReplay(
  dataset:
    LevelEngineValidationDatasetSnapshot,
  source:
    CausalSetupRealDataValidationReport,
  dependencies:
    LevelLinesExactPriceOriginResolutionRealDataValidationDependencies,
): PrimaryReplayResult {
  const candles = cloneClosedCandles(dataset);
  const startAt = Math.max(
    1,
    source.appliedOptions
      .startAtClosedCandleCount,
  );
  const totalStepCount = Math.max(
    0,
    candles.length - startAt + 1,
  );
  const fingerprints: string[] = [];
  const decisions =
    new Map<string, MutableDecisionObservation>();
  const violations:
    LevelLinesExactPriceOriginResolutionRealDataViolation[] = [];
  const seenViolations = new Set<string>();
  const suppressedCurrentLineIds =
    new Set<string>();
  const residualCurrentCollisionGroupKeys =
    new Set<string>();
  let historyLineObservationCount = 0;
  let inputCurrentLineObservationCount = 0;
  let resolvedCurrentLineObservationCount = 0;
  let resolutionObservationCount = 0;
  let decisionObservationCount = 0;
  let suppressedCurrentLineObservationCount = 0;
  let retainedHistoryLineObservationCount = 0;
  let residualCurrentCollisionObservationCount = 0;

  for (
    let closedCount = startAt;
    closedCount <= candles.length;
    closedCount += 1
  ) {
    const prefix = Object.freeze(
      candles.slice(0, closedCount),
    );
    const latest = prefix.at(-1);

    if (!latest) {
      continue;
    }

    const observedAt = canonicalTimestamp(
      latest.closeTime,
      'latest.closeTime',
    );
    const detection = detectLevelLines(
      {
        symbol: dataset.symbol,
        timeframe: '1m',
        candles: prefix,
      },
      source.appliedOptions
        .pipelineOptions
        .levelLinesOptions,
    );
    const resolution =
      detection.exactPriceOriginResolution;
    const validation = validateSnapshot(
      dataset.symbol,
      observedAt,
      closedCount - 1,
      detection,
      decisions,
      violations,
      seenViolations,
      suppressedCurrentLineIds,
      residualCurrentCollisionGroupKeys,
    );

    historyLineObservationCount +=
      detection.lines.length;
    inputCurrentLineObservationCount +=
      resolution.totals
        .inputCurrentLineCount;
    resolvedCurrentLineObservationCount +=
      detection.activeLevels.length;
    retainedHistoryLineObservationCount +=
      resolution.totals
        .retainedHistoryLineCount;
    decisionObservationCount +=
      resolution.decisions.length;
    suppressedCurrentLineObservationCount +=
      resolution.totals
        .suppressedCurrentLineCount;

    if (resolution.decisions.length > 0) {
      resolutionObservationCount += 1;
    }
    if (validation.residualCollisionObserved) {
      residualCurrentCollisionObservationCount += 1;
    }

    fingerprints.push(
      snapshotFingerprint(
        observedAt,
        detection,
      ),
    );
    dependencies.onReplayProgress?.({
      symbol: dataset.symbol,
      pass: 'primary',
      completedStepCount:
        closedCount - startAt + 1,
      totalStepCount,
    });
  }

  return Object.freeze({
    fingerprints: Object.freeze([
      ...fingerprints,
    ]),
    replayFingerprint:
      replayFingerprint(fingerprints),
    decisions,
    violations,
    seenViolations,
    historyLineObservationCount,
    inputCurrentLineObservationCount,
    resolvedCurrentLineObservationCount,
    resolutionObservationCount,
    decisionObservationCount,
    suppressedCurrentLineObservationCount,
    suppressedCurrentLineIds,
    retainedHistoryLineObservationCount,
    residualCurrentCollisionObservationCount,
    residualCurrentCollisionGroupKeys,
  });
}

function restartReplay(
  dataset:
    LevelEngineValidationDatasetSnapshot,
  source:
    CausalSetupRealDataValidationReport,
  primary: PrimaryReplayResult,
  dependencies:
    LevelLinesExactPriceOriginResolutionRealDataValidationDependencies,
): Readonly<{
  fingerprint: string;
  replayStepCount: number;
  mismatchCount: number;
}> {
  const candles = cloneClosedCandles(dataset);
  const startAt = Math.max(
    1,
    source.appliedOptions
      .startAtClosedCandleCount,
  );
  const totalStepCount = Math.max(
    0,
    candles.length - startAt + 1,
  );
  const fingerprints: string[] = [];
  let mismatchCount = 0;

  for (
    let closedCount = startAt;
    closedCount <= candles.length;
    closedCount += 1
  ) {
    const prefix = Object.freeze(
      candles.slice(0, closedCount),
    );
    const latest = prefix.at(-1);

    if (!latest) {
      continue;
    }

    const observedAt = canonicalTimestamp(
      latest.closeTime,
      'latest.closeTime',
    );
    const detection = detectLevelLines(
      {
        symbol: dataset.symbol,
        timeframe: '1m',
        candles: prefix,
      },
      source.appliedOptions
        .pipelineOptions
        .levelLinesOptions,
    );
    const fingerprint = snapshotFingerprint(
      observedAt,
      detection,
    );
    const stepIndex = closedCount - startAt;
    fingerprints.push(fingerprint);

    if (
      primary.fingerprints[stepIndex]
        !== fingerprint
    ) {
      mismatchCount += 1;
      addViolation(
        primary.violations,
        primary.seenViolations,
        {
          code: 'restart_replay_mismatch',
          symbol: dataset.symbol,
          replayPass: 'restart',
          observedAt,
          closedCandleIndex:
            closedCount - 1,
          message:
            'independent restart replay produced a different production snapshot fingerprint',
        },
      );
    }

    dependencies.onReplayProgress?.({
      symbol: dataset.symbol,
      pass: 'restart',
      completedStepCount:
        closedCount - startAt + 1,
      totalStepCount,
    });
  }

  return Object.freeze({
    fingerprint:
      replayFingerprint(fingerprints),
    replayStepCount:
      fingerprints.length,
    mismatchCount,
  });
}

function freezeDecision(
  value: MutableDecisionObservation,
): LevelLinesExactPriceOriginResolutionDecisionObservation {
  return Object.freeze({
    ...value,
  });
}

function validateDataset(
  dataset:
    LevelEngineValidationDatasetSnapshot,
  source:
    CausalSetupRealDataValidationReport,
  dependencies:
    LevelLinesExactPriceOriginResolutionRealDataValidationDependencies,
): LevelLinesExactPriceOriginResolutionDatasetValidationReport {
  if (dataset.sourceTimeframe !== '1m') {
    fail(
      `dataset ${dataset.symbol} must use 1m candles`,
    );
  }

  const candles = cloneClosedCandles(dataset);
  const primary = primaryReplay(
    dataset,
    source,
    dependencies,
  );
  const restart = restartReplay(
    dataset,
    source,
    primary,
    dependencies,
  );
  const decisions = Object.freeze(
    [...primary.decisions.values()]
      .sort(
        (left, right) =>
          left.firstObservedAt.localeCompare(
            right.firstObservedAt,
          )
          || left.key.localeCompare(right.key),
      )
      .map(freezeDecision),
  );
  const activeIdentityReuseDecisionCount =
    decisions.filter(
      (decision) =>
        decision.action
          === 'reuse_active_exact_price_identity',
    ).length;
  const workedIdentityRearmDecisionCount =
    decisions.filter(
      (decision) =>
        decision.action
          === 'retire_worked_identity_before_rearm',
    ).length;
  const violations = Object.freeze([
    ...primary.violations,
  ]);
  const fullHistoryPreserved =
    !violations.some(
      (violation) =>
        violation.code
          === 'history_count_mismatch'
        || violation.code
          === 'suppressed_line_missing_from_history',
    );
  const residualCurrentCollisionsObserved =
    primary
      .residualCurrentCollisionObservationCount
      > 0;

  return Object.freeze({
    symbol: dataset.symbol,
    sourceTimeframe: '1m',
    firstClosedAt:
      candles[0]?.closeTime ?? null,
    lastClosedAt:
      candles.at(-1)?.closeTime ?? null,
    decisions,
    violations,
    primaryReplayFingerprint:
      primary.replayFingerprint,
    restartReplayFingerprint:
      restart.fingerprint,
    restartReplayEquivalent:
      restart.mismatchCount === 0
      && primary.replayFingerprint
        === restart.fingerprint,
    fullHistoryPreserved,
    residualCurrentCollisionsObserved,
    totals: Object.freeze({
      closedCandlesCount:
        candles.length,
      replayStepCount:
        primary.fingerprints.length,
      restartReplayStepCount:
        restart.replayStepCount,
      historyLineObservationCount:
        primary.historyLineObservationCount,
      inputCurrentLineObservationCount:
        primary.inputCurrentLineObservationCount,
      resolvedCurrentLineObservationCount:
        primary.resolvedCurrentLineObservationCount,
      resolutionObservationCount:
        primary.resolutionObservationCount,
      decisionObservationCount:
        primary.decisionObservationCount,
      uniqueDecisionCount:
        decisions.length,
      activeIdentityReuseDecisionCount,
      workedIdentityRearmDecisionCount,
      suppressedCurrentLineObservationCount:
        primary
          .suppressedCurrentLineObservationCount,
      uniqueSuppressedCurrentLineCount:
        primary.suppressedCurrentLineIds.size,
      retainedHistoryLineObservationCount:
        primary
          .retainedHistoryLineObservationCount,
      residualCurrentCollisionObservationCount:
        primary
          .residualCurrentCollisionObservationCount,
      residualCurrentCollisionGroupCount:
        primary
          .residualCurrentCollisionGroupKeys
          .size,
      restartReplayMismatchCount:
        restart.mismatchCount,
      violationCount:
        violations.length,
    }),
    usesFutureCandles: false,
  });
}

function validateSource(
  source:
    CausalSetupRealDataValidationReport,
): void {
  if (
    source.version
      !== 'causal-setup-real-data-validation-v0.1'
  ) {
    fail(
      `unsupported source version: ${source.version}`,
    );
  }
  if (
    source.sourceValidationVersion
      !== 'level-engine-real-data-validation-v0.1'
    || source.offlineOnly !== true
    || source.reusesFetchedDatasets !== true
    || source.changesTradingRules !== false
    || source.createsLiveSetup !== false
    || source.createsSignal !== false
    || source.appliesTraining !== false
    || source.usesFutureCandles !== false
  ) {
    fail('source safety contract is incompatible');
  }
  if (source.sourceDatasets.length === 0) {
    fail('source report has no real candle datasets');
  }
}

export function validateLevelLinesExactPriceOriginResolutionOnRealData(
  source:
    CausalSetupRealDataValidationReport,
  options:
    LevelLinesExactPriceOriginResolutionRealDataValidationOptions = {},
  dependencies:
    LevelLinesExactPriceOriginResolutionRealDataValidationDependencies = {},
): LevelLinesExactPriceOriginResolutionRealDataValidationReport {
  validateSource(source);
  const generatedAt = canonicalTimestamp(
    options.generatedAt
      ?? (dependencies.now ?? (() => new Date()))()
        .toISOString(),
    'generatedAt',
  );
  const datasets = Object.freeze(
    source.sourceDatasets
      .map(
        (dataset) =>
          validateDataset(
            dataset,
            source,
            dependencies,
          ),
      )
      .sort(
        (left, right) =>
          left.symbol.localeCompare(
            right.symbol,
          ),
      ),
  );
  const allDecisions = datasets.flatMap(
    (dataset) => dataset.decisions,
  );
  const allViolations = datasets.flatMap(
    (dataset) => dataset.violations,
  );
  const totals = Object.freeze({
    symbolCount: new Set(
      datasets.map(
        (dataset) => dataset.symbol,
      ),
    ).size,
    datasetCount: datasets.length,
    closedCandlesCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .closedCandlesCount,
        0,
      ),
    replayStepCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .replayStepCount,
        0,
      ),
    restartReplayStepCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .restartReplayStepCount,
        0,
      ),
    historyLineObservationCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .historyLineObservationCount,
        0,
      ),
    inputCurrentLineObservationCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .inputCurrentLineObservationCount,
        0,
      ),
    resolvedCurrentLineObservationCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .resolvedCurrentLineObservationCount,
        0,
      ),
    resolutionObservationCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .resolutionObservationCount,
        0,
      ),
    decisionObservationCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .decisionObservationCount,
        0,
      ),
    uniqueDecisionCount:
      allDecisions.length,
    activeIdentityReuseDecisionCount:
      allDecisions.filter(
        (decision) =>
          decision.action
            === 'reuse_active_exact_price_identity',
      ).length,
    workedIdentityRearmDecisionCount:
      allDecisions.filter(
        (decision) =>
          decision.action
            === 'retire_worked_identity_before_rearm',
      ).length,
    suppressedCurrentLineObservationCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .suppressedCurrentLineObservationCount,
        0,
      ),
    uniqueSuppressedCurrentLineCount:
      new Set(
        allDecisions.map(
          (decision) =>
            decision.suppressedCurrentLineId,
        ),
      ).size,
    retainedHistoryLineObservationCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .retainedHistoryLineObservationCount,
        0,
      ),
    residualCurrentCollisionObservationCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .residualCurrentCollisionObservationCount,
        0,
      ),
    residualCurrentCollisionGroupCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .residualCurrentCollisionGroupCount,
        0,
      ),
    restartReplayMismatchCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .restartReplayMismatchCount,
        0,
      ),
    violationCount:
      allViolations.length,
  });
  const fullHistoryPreserved =
    datasets.every(
      (dataset) =>
        dataset.fullHistoryPreserved,
    );
  const restartReplayEquivalent =
    datasets.every(
      (dataset) =>
        dataset.restartReplayEquivalent,
    );
  const residualCurrentCollisionsObserved =
    totals.residualCurrentCollisionObservationCount
      > 0;
  const status:
    LevelLinesExactPriceOriginResolutionRealDataValidationStatus =
      totals.violationCount > 0
      || !fullHistoryPreserved
      || !restartReplayEquivalent
      || residualCurrentCollisionsObserved
        ? 'invalid'
        : totals.uniqueDecisionCount > 0
          ? 'validated_with_observed_resolution'
          : 'validated_without_observed_resolution';

  return Object.freeze({
    version:
      LEVEL_LINES_EXACT_PRICE_ORIGIN_RESOLUTION_REAL_DATA_VALIDATION_VERSION,
    sourceVersion: source.version,
    resolutionVersion:
      LEVEL_LINES_EXACT_PRICE_ORIGIN_RESOLUTION_VERSION,
    sourceGeneratedAt:
      canonicalTimestamp(
        source.generatedAt,
        'source.generatedAt',
      ),
    generatedAt,
    sourceDatasetHash:
      options.sourceDatasetHash ?? null,
    requestedSymbols: Object.freeze([
      ...source.requestedSymbols,
    ]),
    datasets,
    totals,
    appliedOptions:
      source.appliedOptions
        .pipelineOptions
        .levelLinesOptions,
    status,
    activeIdentityReuseObserved:
      totals.activeIdentityReuseDecisionCount
        > 0,
    workedIdentityRearmObserved:
      totals.workedIdentityRearmDecisionCount
        > 0,
    fullHistoryPreserved,
    residualCurrentCollisionsObserved,
    restartReplayEquivalent,
    offlineOnly: true,
    reusesSavedRealCandles: true,
    syntheticObservationsCreated: false,
    usesExactPriceOnly: true,
    mergesNearbyPrices: false,
    changesLevelIdentityFormula: false,
    changesTradingRules: false,
    createsLiveSetup: false,
    createsTradeOrder: false,
    createsSignal: false,
    appliesTraining: false,
    usesFutureCandles: false,
  });
}
