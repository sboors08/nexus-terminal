import {
  detectLevelLines,
} from './level-lines-detector.js';
import type {
  LevelLine,
} from './level-lines.types.js';
import type {
  LevelEngineValidationDatasetSnapshot,
} from './level-engine-real-data-validation.types.js';
import type {
  CausalSetupRealDataValidationReport,
} from '../setup-engine/causal-setup-real-data-validation.types.js';
import {
  LEVEL_LINES_EXACT_PRICE_ORIGIN_COLLISION_DIAGNOSTICS_VERSION,
} from './level-lines-exact-price-origin-collision-diagnostics.types.js';
import type {
  LevelLinesExactPriceOriginCollisionDatasetReport,
  LevelLinesExactPriceOriginCollisionDatasetTotals,
  LevelLinesExactPriceOriginCollisionDiagnosticsReport,
  LevelLinesExactPriceOriginCollisionDiagnosticsStatus,
  LevelLinesExactPriceOriginCollisionEpisode,
  LevelLinesExactPriceOriginCollisionGroupReport,
  LevelLinesExactPriceOriginCollisionLineSnapshot,
  LevelLinesExactPriceOriginCollisionPairReport,
  LevelLinesExactPriceOriginCollisionViolation,
  LevelLinesExactPriceOriginCollisionViolationCode,
} from './level-lines-exact-price-origin-collision-diagnostics.types.js';

export interface LevelLinesExactPriceOriginCollisionReplayProgress {
  readonly symbol: string;
  readonly completedStepCount: number;
  readonly totalStepCount: number;
}

export interface LevelLinesExactPriceOriginCollisionDiagnosticsOptions {
  readonly generatedAt?: string;
  readonly sourceDatasetHash?: string | null;
}

export interface LevelLinesExactPriceOriginCollisionDiagnosticsDependencies {
  readonly now?: () => Date;
  readonly onReplayProgress?: (
    progress:
      LevelLinesExactPriceOriginCollisionReplayProgress,
  ) => void;
}

export class LevelLinesExactPriceOriginCollisionDiagnosticsError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      'LevelLinesExactPriceOriginCollisionDiagnosticsError';
  }
}

interface MutableCollisionEpisode {
  startedAt: string;
  lastObservedAt: string;
  firstObservedCandleIndex: number;
  lastObservedCandleIndex: number;
  observationCount: number;
  membershipSignature: string;
  lineCount: number;
  lineIds: readonly string[];
  lines:
    readonly LevelLinesExactPriceOriginCollisionLineSnapshot[];
}

interface MutablePairReport {
  readonly key: string;
  readonly olderLineId: string;
  readonly newerLineId: string;
  readonly olderOriginExtremumAt: string;
  readonly newerOriginExtremumAt: string;
  readonly originGapBars: number;
  readonly firstCoactiveAt: string;
  lastCoactiveAt: string;
  coactiveObservationCount: number;
  readonly olderStatusAtFirstCoactive:
    LevelLine['status'];
  readonly newerStatusAtFirstCoactive:
    LevelLine['status'];
  readonly newerInheritedPriorExactOriginEvidence:
    boolean;
}

interface MutableGroupReport {
  readonly key: string;
  readonly symbol: string;
  readonly timeframe: LevelLine['timeframe'];
  readonly kind: LevelLine['kind'];
  readonly price: number;
  readonly firstObservedAt: string;
  lastObservedAt: string;
  observationCount: number;
  maximumConcurrentLineCount: number;
  readonly distinctLineIds: Set<string>;
  readonly originCandleIndices: Set<number>;
  readonly originExtremumAts: Set<string>;
  readonly inheritedPriorExactOriginLineIds:
    Set<string>;
  membershipTransitionCount: number;
  readonly episodes: MutableCollisionEpisode[];
  readonly pairs: Map<string, MutablePairReport>;
  lastObservedCandleIndex: number;
  lastMembershipSignature: string;
}

function fail(message: string): never {
  throw new LevelLinesExactPriceOriginCollisionDiagnosticsError(
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

function exactPriceKey(price: number): string {
  if (!Number.isFinite(price) || price <= 0) {
    fail('line price must be a positive finite number');
  }

  return price.toString();
}

function groupKey(line: LevelLine): string {
  return [
    line.symbol,
    line.timeframe,
    line.kind,
    exactPriceKey(line.price),
  ].join('|');
}

function expectedLineId(line: LevelLine): string {
  return `${line.symbol}-${line.timeframe}-line-${line.kind}-${Date.parse(
    line.originExtremumAt,
  )}`;
}

function inheritedPriorExactOriginEvidence(
  line: LevelLine,
): boolean {
  return line.confirmedAt !== null
    && line.confirmedAt === line.activeFrom
    && line.touchCount >= 2;
}

function lineSnapshot(
  line: LevelLine,
): LevelLinesExactPriceOriginCollisionLineSnapshot {
  return Object.freeze({
    lineId: line.id,
    symbol: line.symbol,
    timeframe: line.timeframe,
    kind: line.kind,
    price: line.price,
    originCandleIndex:
      line.originCandleIndex,
    originExtremumAt:
      line.originExtremumAt,
    activeFrom: line.activeFrom,
    confirmedAt: line.confirmedAt,
    workedAt: line.workedAt,
    touchCount: line.touchCount,
    status: line.status,
    inheritedPriorExactOriginEvidence:
      inheritedPriorExactOriginEvidence(
        line,
      ),
  });
}

function orderedLines(
  lines: readonly LevelLine[],
): readonly LevelLine[] {
  return Object.freeze(
    [...lines].sort(
      (left, right) =>
        Date.parse(
          left.originExtremumAt,
        )
        - Date.parse(
          right.originExtremumAt,
        )
        || left.id.localeCompare(
          right.id,
        ),
    ),
  );
}

function addViolation(
  violations:
    LevelLinesExactPriceOriginCollisionViolation[],
  seen: Set<string>,
  code:
    LevelLinesExactPriceOriginCollisionViolationCode,
  symbol: string,
  observedAt: string | null,
  collisionGroupKey: string | null,
  lineId: string | null,
  message: string,
): void {
  const key = [
    code,
    symbol,
    collisionGroupKey ?? '',
    lineId ?? '',
  ].join('|');

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  violations.push(
    Object.freeze({
      code,
      symbol,
      observedAt,
      groupKey:
        collisionGroupKey,
      lineId,
      message,
    }),
  );
}

function validateActiveLines(
  symbol: string,
  observedAt: string,
  lines: readonly LevelLine[],
  violations:
    LevelLinesExactPriceOriginCollisionViolation[],
  seenViolations: Set<string>,
): void {
  const lineIds = new Set<string>();
  const observedMs = Date.parse(observedAt);

  for (const line of lines) {
    if (lineIds.has(line.id)) {
      addViolation(
        violations,
        seenViolations,
        'duplicate_line_id_in_snapshot',
        symbol,
        observedAt,
        null,
        line.id,
        `line ${line.id} appears more than once in one active snapshot`,
      );
    }
    lineIds.add(line.id);

    if (line.id !== expectedLineId(line)) {
      addViolation(
        violations,
        seenViolations,
        'line_id_formula_mismatch',
        symbol,
        observedAt,
        null,
        line.id,
        `line ${line.id} does not match its origin identity`,
      );
    }

    if (line.price !== line.originExtremumPrice) {
      addViolation(
        violations,
        seenViolations,
        'line_price_origin_mismatch',
        symbol,
        observedAt,
        null,
        line.id,
        `line ${line.id} price differs from its origin extremum`,
      );
    }

    if (Date.parse(line.originExtremumAt) > observedMs) {
      addViolation(
        violations,
        seenViolations,
        'future_line_origin',
        symbol,
        observedAt,
        null,
        line.id,
        `line ${line.id} has a future origin`,
      );
    }

    if (Date.parse(line.activeFrom) > observedMs) {
      addViolation(
        violations,
        seenViolations,
        'future_line_activation',
        symbol,
        observedAt,
        null,
        line.id,
        `line ${line.id} activates in the future`,
      );
    }
  }
}

function updatePairs(
  accumulator: MutableGroupReport,
  lines: readonly LevelLine[],
  observedAt: string,
): void {
  for (
    let olderIndex = 0;
    olderIndex < lines.length - 1;
    olderIndex += 1
  ) {
    const older = lines[olderIndex];

    if (!older) {
      continue;
    }

    for (
      let newerIndex = olderIndex + 1;
      newerIndex < lines.length;
      newerIndex += 1
    ) {
      const newer = lines[newerIndex];

      if (!newer) {
        continue;
      }

      const key = `${older.id}|${newer.id}`;
      const existing = accumulator.pairs.get(key);

      if (existing) {
        existing.lastCoactiveAt = observedAt;
        existing.coactiveObservationCount += 1;
        continue;
      }

      accumulator.pairs.set(
        key,
        {
          key,
          olderLineId: older.id,
          newerLineId: newer.id,
          olderOriginExtremumAt:
            older.originExtremumAt,
          newerOriginExtremumAt:
            newer.originExtremumAt,
          originGapBars:
            newer.originCandleIndex
            - older.originCandleIndex,
          firstCoactiveAt: observedAt,
          lastCoactiveAt: observedAt,
          coactiveObservationCount: 1,
          olderStatusAtFirstCoactive:
            older.status,
          newerStatusAtFirstCoactive:
            newer.status,
          newerInheritedPriorExactOriginEvidence:
            inheritedPriorExactOriginEvidence(
              newer,
            ),
        },
      );
    }
  }
}

function updateGroup(
  groups: Map<string, MutableGroupReport>,
  linesValue: readonly LevelLine[],
  observedAt: string,
  observedCandleIndex: number,
): void {
  const lines = orderedLines(linesValue);
  const first = lines[0];

  if (!first) {
    return;
  }

  const key = groupKey(first);
  const lineIds = Object.freeze(
    lines.map((line) => line.id),
  );
  const signature = lineIds.join('|');
  const snapshots = Object.freeze(
    lines.map(lineSnapshot),
  );
  let accumulator = groups.get(key);

  if (!accumulator) {
    accumulator = {
      key,
      symbol: first.symbol,
      timeframe: first.timeframe,
      kind: first.kind,
      price: first.price,
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,
      observationCount: 0,
      maximumConcurrentLineCount: 0,
      distinctLineIds: new Set<string>(),
      originCandleIndices: new Set<number>(),
      originExtremumAts: new Set<string>(),
      inheritedPriorExactOriginLineIds:
        new Set<string>(),
      membershipTransitionCount: 0,
      episodes: [],
      pairs: new Map(),
      lastObservedCandleIndex: -2,
      lastMembershipSignature: '',
    };
    groups.set(key, accumulator);
  }

  accumulator.lastObservedAt = observedAt;
  accumulator.observationCount += 1;
  accumulator.maximumConcurrentLineCount =
    Math.max(
      accumulator.maximumConcurrentLineCount,
      lines.length,
    );

  for (const line of lines) {
    accumulator.distinctLineIds.add(line.id);
    accumulator.originCandleIndices.add(
      line.originCandleIndex,
    );
    accumulator.originExtremumAts.add(
      line.originExtremumAt,
    );
    if (inheritedPriorExactOriginEvidence(line)) {
      accumulator
        .inheritedPriorExactOriginLineIds
        .add(line.id);
    }
  }

  const continuesEpisode =
    accumulator.lastObservedCandleIndex
      === observedCandleIndex - 1
    && accumulator.lastMembershipSignature
      === signature;
  const currentEpisode =
    accumulator.episodes.at(-1);

  if (continuesEpisode && currentEpisode) {
    currentEpisode.lastObservedAt = observedAt;
    currentEpisode.lastObservedCandleIndex =
      observedCandleIndex;
    currentEpisode.observationCount += 1;
  } else {
    if (accumulator.episodes.length > 0) {
      accumulator.membershipTransitionCount += 1;
    }
    accumulator.episodes.push({
      startedAt: observedAt,
      lastObservedAt: observedAt,
      firstObservedCandleIndex:
        observedCandleIndex,
      lastObservedCandleIndex:
        observedCandleIndex,
      observationCount: 1,
      membershipSignature: signature,
      lineCount: lines.length,
      lineIds,
      lines: snapshots,
    });
  }

  accumulator.lastObservedCandleIndex =
    observedCandleIndex;
  accumulator.lastMembershipSignature =
    signature;
  updatePairs(
    accumulator,
    lines,
    observedAt,
  );
}

function freezeEpisode(
  value: MutableCollisionEpisode,
): LevelLinesExactPriceOriginCollisionEpisode {
  return Object.freeze({
    ...value,
    lineIds: Object.freeze([
      ...value.lineIds,
    ]),
    lines: Object.freeze([
      ...value.lines,
    ]),
  });
}

function freezePair(
  value: MutablePairReport,
): LevelLinesExactPriceOriginCollisionPairReport {
  return Object.freeze({
    ...value,
  });
}

function freezeGroup(
  value: MutableGroupReport,
): LevelLinesExactPriceOriginCollisionGroupReport {
  return Object.freeze({
    key: value.key,
    symbol: value.symbol,
    timeframe: value.timeframe,
    kind: value.kind,
    price: value.price,
    firstObservedAt:
      value.firstObservedAt,
    lastObservedAt:
      value.lastObservedAt,
    observationCount:
      value.observationCount,
    maximumConcurrentLineCount:
      value.maximumConcurrentLineCount,
    distinctLineCount:
      value.distinctLineIds.size,
    distinctLineIds: Object.freeze(
      [...value.distinctLineIds].sort(),
    ),
    originCandleIndices: Object.freeze(
      [...value.originCandleIndices].sort(
        (left, right) => left - right,
      ),
    ),
    originExtremumAts: Object.freeze(
      [...value.originExtremumAts].sort(
        (left, right) =>
          Date.parse(left)
          - Date.parse(right),
      ),
    ),
    membershipTransitionCount:
      value.membershipTransitionCount,
    inheritedPriorExactOriginLineCount:
      value
        .inheritedPriorExactOriginLineIds
        .size,
    episodes: Object.freeze(
      value.episodes.map(
        freezeEpisode,
      ),
    ),
    pairs: Object.freeze(
      [...value.pairs.values()]
        .sort(
          (left, right) =>
            Date.parse(
              left.olderOriginExtremumAt,
            )
            - Date.parse(
              right.olderOriginExtremumAt,
            )
            || Date.parse(
              left.newerOriginExtremumAt,
            )
            - Date.parse(
              right.newerOriginExtremumAt,
            )
            || left.key.localeCompare(
              right.key,
            ),
        )
        .map(freezePair),
    ),
  });
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

function validateCollisionScope(
  symbol: string,
  observedAt: string,
  key: string,
  lines: readonly LevelLine[],
  violations:
    LevelLinesExactPriceOriginCollisionViolation[],
  seenViolations: Set<string>,
): void {
  const first = lines[0];

  if (!first) {
    return;
  }

  if (
    lines.some(
      (line) => groupKey(line) !== key,
    )
  ) {
    addViolation(
      violations,
      seenViolations,
      'collision_scope_mismatch',
      symbol,
      observedAt,
      key,
      null,
      `collision group ${key} mixes identity scopes`,
    );
  }

  const origins = new Set<string>();
  for (const line of lines) {
    if (origins.has(line.originExtremumAt)) {
      addViolation(
        violations,
        seenViolations,
        'duplicate_origin_identity',
        symbol,
        observedAt,
        key,
        line.id,
        `collision group ${key} contains multiple line ids for one origin timestamp`,
      );
    }
    origins.add(line.originExtremumAt);
  }
}

function diagnoseDataset(
  dataset:
    LevelEngineValidationDatasetSnapshot,
  source:
    CausalSetupRealDataValidationReport,
  dependencies:
    LevelLinesExactPriceOriginCollisionDiagnosticsDependencies,
): LevelLinesExactPriceOriginCollisionDatasetReport {
  if (dataset.sourceTimeframe !== '1m') {
    fail(
      `dataset ${dataset.symbol} must use 1m candles`,
    );
  }

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
  const groups =
    new Map<string, MutableGroupReport>();
  const violations:
    LevelLinesExactPriceOriginCollisionViolation[] = [];
  const seenViolations = new Set<string>();
  let activeLineObservationCount = 0;
  let collisionObservationCount = 0;

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

    const observedAt =
      canonicalTimestamp(
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
    activeLineObservationCount +=
      detection.activeLevels.length;
    validateActiveLines(
      dataset.symbol,
      observedAt,
      detection.activeLevels,
      violations,
      seenViolations,
    );

    const snapshotGroups =
      new Map<string, LevelLine[]>();
    for (const line of detection.activeLevels) {
      const key = groupKey(line);
      const values =
        snapshotGroups.get(key) ?? [];
      values.push(line);
      snapshotGroups.set(key, values);
    }

    for (const [key, lines] of snapshotGroups) {
      if (lines.length < 2) {
        continue;
      }

      collisionObservationCount += 1;
      validateCollisionScope(
        dataset.symbol,
        observedAt,
        key,
        lines,
        violations,
        seenViolations,
      );
      updateGroup(
        groups,
        lines,
        observedAt,
        closedCount - 1,
      );
    }

    dependencies.onReplayProgress?.({
      symbol: dataset.symbol,
      completedStepCount:
        closedCount - startAt + 1,
      totalStepCount,
    });
  }

  const frozenGroups = Object.freeze(
    [...groups.values()]
      .map(freezeGroup)
      .sort(
        (left, right) =>
          left.kind.localeCompare(
            right.kind,
          )
          || left.price - right.price
          || left.firstObservedAt.localeCompare(
            right.firstObservedAt,
          ),
      ),
  );
  const collidingLineIds = new Set(
    frozenGroups.flatMap(
      (group) => group.distinctLineIds,
    ),
  );
  const inheritedLineIds = new Set(
    frozenGroups.flatMap(
      (group) =>
        group.episodes.flatMap(
          (episode) =>
            episode.lines
              .filter(
                (line) =>
                  line
                    .inheritedPriorExactOriginEvidence,
              )
              .map((line) => line.lineId),
        ),
    ),
  );
  const totals:
    LevelLinesExactPriceOriginCollisionDatasetTotals =
      Object.freeze({
        closedCandlesCount:
          candles.length,
        replayStepCount:
          totalStepCount,
        activeLineObservationCount,
        collisionObservationCount,
        collisionGroupCount:
          frozenGroups.length,
        collisionEpisodeCount:
          frozenGroups.reduce(
            (total, group) =>
              total + group.episodes.length,
            0,
          ),
        collisionPairCount:
          frozenGroups.reduce(
            (total, group) =>
              total + group.pairs.length,
            0,
          ),
        uniqueCollidingLineCount:
          collidingLineIds.size,
        inheritedPriorExactOriginLineCount:
          inheritedLineIds.size,
        maximumConcurrentLineCount:
          frozenGroups.reduce(
            (maximum, group) =>
              Math.max(
                maximum,
                group
                  .maximumConcurrentLineCount,
              ),
            0,
          ),
        violationCount:
          violations.length,
      });

  return Object.freeze({
    symbol: dataset.symbol,
    sourceTimeframe: '1m',
    firstClosedAt:
      candles[0]?.closeTime ?? null,
    lastClosedAt:
      candles.at(-1)?.closeTime ?? null,
    groups: frozenGroups,
    violations: Object.freeze([
      ...violations,
    ]),
    totals,
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
    fail(`unsupported source version: ${source.version}`);
  }
  if (
    source.changesTradingRules !== false
    || source.createsLiveSetup !== false
    || source.createsSignal !== false
    || source.usesFutureCandles !== false
  ) {
    fail('source safety contract is incompatible');
  }
  if (source.sourceDatasets.length === 0) {
    fail('source report has no real candle datasets');
  }
}

export function diagnoseLevelLinesExactPriceOriginCollisions(
  source:
    CausalSetupRealDataValidationReport,
  options:
    LevelLinesExactPriceOriginCollisionDiagnosticsOptions = {},
  dependencies:
    LevelLinesExactPriceOriginCollisionDiagnosticsDependencies = {},
): LevelLinesExactPriceOriginCollisionDiagnosticsReport {
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
          diagnoseDataset(
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
  const totals = Object.freeze({
    symbolCount:
      new Set(
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
    activeLineObservationCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .activeLineObservationCount,
        0,
      ),
    collisionObservationCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .collisionObservationCount,
        0,
      ),
    collisionGroupCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .collisionGroupCount,
        0,
      ),
    collisionEpisodeCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .collisionEpisodeCount,
        0,
      ),
    collisionPairCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .collisionPairCount,
        0,
      ),
    uniqueCollidingLineCount:
      new Set(
        datasets.flatMap(
          (dataset) =>
            dataset.groups.flatMap(
              (group) =>
                group.distinctLineIds,
            ),
        ),
      ).size,
    inheritedPriorExactOriginLineCount:
      new Set(
        datasets.flatMap(
          (dataset) =>
            dataset.groups.flatMap(
              (group) =>
                group.episodes.flatMap(
                  (episode) =>
                    episode.lines
                      .filter(
                        (line) =>
                          line
                            .inheritedPriorExactOriginEvidence,
                      )
                      .map(
                        (line) => line.lineId,
                      ),
                ),
            ),
        ),
      ).size,
    maximumConcurrentLineCount:
      datasets.reduce(
        (maximum, dataset) =>
          Math.max(
            maximum,
            dataset.totals
              .maximumConcurrentLineCount,
          ),
        0,
      ),
    violationCount:
      datasets.reduce(
        (total, dataset) =>
          total
          + dataset.totals
            .violationCount,
        0,
      ),
  });
  const status:
    LevelLinesExactPriceOriginCollisionDiagnosticsStatus =
      totals.violationCount > 0
        ? 'invalid'
        : totals.collisionGroupCount > 0
          ? 'diagnosed_with_collisions'
          : 'diagnosed_without_collisions';

  return Object.freeze({
    version:
      LEVEL_LINES_EXACT_PRICE_ORIGIN_COLLISION_DIAGNOSTICS_VERSION,
    sourceVersion: source.version,
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
    exactPriceCollisionsObserved:
      totals.collisionGroupCount > 0,
    repeatedOriginWhilePriorLineActiveObserved:
      totals.collisionPairCount > 0,
    independentStructureConfirmed: false,
    duplicateOriginConfirmed: false,
    recommendsImmediatePriceMerge: false,
    offlineOnly: true,
    reusesSavedRealCandles: true,
    syntheticObservationsCreated: false,
    changesLevelIdentity: false,
    changesTradingRules: false,
    createsLiveSetup: false,
    createsTradeOrder: false,
    createsSignal: false,
    usesFutureCandles: false,
  });
}
