import type {
  LevelLinesExactPriceOriginCollisionDiagnosticsReport,
  LevelLinesExactPriceOriginCollisionGroupReport,
  LevelLinesExactPriceOriginCollisionPairReport,
} from './level-lines-exact-price-origin-collision-diagnostics.types.js';
import {
  LEVEL_LINES_EXACT_PRICE_ORIGIN_COLLISION_CLASSIFICATION_VERSION,
} from './level-lines-exact-price-origin-collision-classification.types.js';
import type {
  LevelLinesExactPriceOriginClassificationConfidence,
  LevelLinesExactPriceOriginCollisionClassificationReport,
  LevelLinesExactPriceOriginCollisionClassificationTotals,
  LevelLinesExactPriceOriginCollisionClassificationViolation,
  LevelLinesExactPriceOriginCollisionClassificationViolationCode,
  LevelLinesExactPriceOriginCoactivityBucket,
  LevelLinesExactPriceOriginDatasetClassification,
  LevelLinesExactPriceOriginGapBucket,
  LevelLinesExactPriceOriginGroupClassification,
  LevelLinesExactPriceOriginGroupClassificationTotals,
  LevelLinesExactPriceOriginPairClass,
  LevelLinesExactPriceOriginPairClassification,
  LevelLinesExactPriceOriginResolutionDirection,
} from './level-lines-exact-price-origin-collision-classification.types.js';

export interface ClassifyLevelLinesExactPriceOriginCollisionsOptions {
  readonly generatedAt?: string;
  readonly sourceReportHash?: string | null;
}

export class LevelLinesExactPriceOriginCollisionClassificationError
  extends Error {
  public readonly code:
    LevelLinesExactPriceOriginCollisionClassificationViolationCode;

  public constructor(
    code:
      LevelLinesExactPriceOriginCollisionClassificationViolationCode,
    message: string,
  ) {
    super(message);
    this.name =
      'LevelLinesExactPriceOriginCollisionClassificationError';
    this.code = code;
  }
}

function median(
  values: readonly number[],
): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort(
    (left, right) => left - right,
  );
  const middle = Math.floor(
    sorted.length / 2,
  );

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }

  const left = sorted[middle - 1];
  const right = sorted[middle];

  if (
    left === undefined
    || right === undefined
  ) {
    return null;
  }

  return (left + right) / 2;
}

function minimum(
  values: readonly number[],
): number | null {
  return values.length === 0
    ? null
    : Math.min(...values);
}

function maximum(
  values: readonly number[],
): number | null {
  return values.length === 0
    ? null
    : Math.max(...values);
}

function gapBucket(
  originGapBars: number,
): LevelLinesExactPriceOriginGapBucket {
  if (originGapBars <= 9) {
    return 'bars_1_9';
  }

  if (originGapBars <= 29) {
    return 'bars_10_29';
  }

  if (originGapBars <= 59) {
    return 'bars_30_59';
  }

  return 'bars_60_plus';
}

function coactivityBucket(
  observationCount: number,
): LevelLinesExactPriceOriginCoactivityBucket {
  if (observationCount === 1) {
    return 'one_observation';
  }

  if (observationCount <= 10) {
    return 'observations_2_10';
  }

  if (observationCount <= 59) {
    return 'observations_11_59';
  }

  return 'observations_60_plus';
}

function classifyPair(
  group:
    LevelLinesExactPriceOriginCollisionGroupReport,
  pair:
    LevelLinesExactPriceOriginCollisionPairReport,
): LevelLinesExactPriceOriginPairClassification {
  let classification:
    LevelLinesExactPriceOriginPairClass;
  let confidence:
    LevelLinesExactPriceOriginClassificationConfidence;
  let resolutionDirection:
    LevelLinesExactPriceOriginResolutionDirection;
  let rationale: readonly string[];

  if (
    pair.newerInheritedPriorExactOriginEvidence
    && pair.olderStatusAtFirstCoactive
      !== 'worked'
  ) {
    classification =
      'active_origin_reconfirmation';
    confidence = 'strong';
    resolutionDirection =
      'reuse_active_exact_price_identity';
    rationale = Object.freeze([
      'newer_origin_inherited_prior_exact_price_confirmation',
      'older_exact_price_identity_was_still_candidate_or_confirmed',
      'new_identity_is_redundant_until_a_resolution_contract_proves_separation',
    ]);
  } else if (
    pair.newerInheritedPriorExactOriginEvidence
    && pair.olderStatusAtFirstCoactive
      === 'worked'
  ) {
    classification =
      'worked_origin_retention_rearm';
    confidence = 'strong';
    resolutionDirection =
      'retire_worked_identity_before_rearm';
    rationale = Object.freeze([
      'newer_origin_inherited_prior_exact_price_confirmation',
      'older_exact_price_identity_was_already_worked_but_remained_coactive',
      'new_episode_may_be_valid_but_worked_identity_must_not_remain_in_current_projection',
    ]);
  } else if (
    pair.olderStatusAtFirstCoactive
      === 'worked'
  ) {
    classification =
      'post_work_independent_origin_candidate';
    confidence = 'insufficient';
    resolutionDirection =
      'validate_new_episode_identity';
    rationale = Object.freeze([
      'older_exact_price_identity_was_already_worked',
      'newer_origin_did_not_inherit_prior_exact_price_confirmation',
      'independent_structure_requires_separate_validation',
    ]);
  } else {
    classification =
      'unresolved_coactive_origin';
    confidence = 'insufficient';
    resolutionDirection =
      'collect_additional_origin_evidence';
    rationale = Object.freeze([
      'older_exact_price_identity_was_still_current',
      'newer_origin_did_not_inherit_prior_exact_price_confirmation',
      'available_evidence_does_not_prove_reuse_or_independence',
    ]);
  }

  return Object.freeze({
    pairKey: pair.key,
    groupKey: group.key,
    symbol: group.symbol,
    timeframe: group.timeframe,
    kind: group.kind,
    price: group.price,
    olderLineId: pair.olderLineId,
    newerLineId: pair.newerLineId,
    olderOriginExtremumAt:
      pair.olderOriginExtremumAt,
    newerOriginExtremumAt:
      pair.newerOriginExtremumAt,
    originGapBars: pair.originGapBars,
    gapBucket:
      gapBucket(pair.originGapBars),
    firstCoactiveAt: pair.firstCoactiveAt,
    lastCoactiveAt: pair.lastCoactiveAt,
    coactiveObservationCount:
      pair.coactiveObservationCount,
    coactivityBucket:
      coactivityBucket(
        pair.coactiveObservationCount,
      ),
    olderStatusAtFirstCoactive:
      pair.olderStatusAtFirstCoactive,
    newerStatusAtFirstCoactive:
      pair.newerStatusAtFirstCoactive,
    newerInheritedPriorExactOriginEvidence:
      pair.newerInheritedPriorExactOriginEvidence,
    classification,
    confidence,
    resolutionDirection,
    rationale,
  });
}

function classificationTotals(
  classifications:
    readonly LevelLinesExactPriceOriginPairClassification[],
): LevelLinesExactPriceOriginGroupClassificationTotals {
  return Object.freeze({
    pairCount: classifications.length,
    activeOriginReconfirmationCount:
      classifications.filter(
        (classification) =>
          classification.classification
            === 'active_origin_reconfirmation',
      ).length,
    workedOriginRetentionRearmCount:
      classifications.filter(
        (classification) =>
          classification.classification
            === 'worked_origin_retention_rearm',
      ).length,
    postWorkIndependentOriginCandidateCount:
      classifications.filter(
        (classification) =>
          classification.classification
            === 'post_work_independent_origin_candidate',
      ).length,
    unresolvedCoactiveOriginCount:
      classifications.filter(
        (classification) =>
          classification.classification
            === 'unresolved_coactive_origin',
      ).length,
  });
}

function violation(
  code:
    LevelLinesExactPriceOriginCollisionClassificationViolationCode,
  message: string,
  context: Readonly<{
    symbol?: string | null;
    groupKey?: string | null;
    pairKey?: string | null;
  }> = {},
): LevelLinesExactPriceOriginCollisionClassificationViolation {
  return Object.freeze({
    code,
    message,
    symbol: context.symbol ?? null,
    groupKey: context.groupKey ?? null,
    pairKey: context.pairKey ?? null,
  });
}

function validateSource(
  source:
    LevelLinesExactPriceOriginCollisionDiagnosticsReport,
): void {
  if (
    source.version
      !== 'level-lines-exact-price-origin-collision-diagnostics-v0.1'
  ) {
    throw new LevelLinesExactPriceOriginCollisionClassificationError(
      'unsupported_source_version',
      `unsupported collision diagnostics version: ${String(source.version)}`,
    );
  }

  if (source.status === 'invalid') {
    throw new LevelLinesExactPriceOriginCollisionClassificationError(
      'invalid_source_status',
      'collision diagnostics report is invalid',
    );
  }

  if (
    source.totals.violationCount > 0
    || source.datasets.some(
      (dataset) =>
        dataset.violations.length > 0,
    )
  ) {
    throw new LevelLinesExactPriceOriginCollisionClassificationError(
      'source_violation_present',
      'collision diagnostics report contains invariant violations',
    );
  }
}

function classifyGroup(
  group:
    LevelLinesExactPriceOriginCollisionGroupReport,
  seenPairKeys: Set<string>,
  violations:
    LevelLinesExactPriceOriginCollisionClassificationViolation[],
): LevelLinesExactPriceOriginGroupClassification {
  const classifications:
    LevelLinesExactPriceOriginPairClassification[] = [];

  for (
    const pair of [...group.pairs].sort(
      (left, right) =>
        left.originGapBars - right.originGapBars
        || left.key.localeCompare(right.key),
    )
  ) {
    if (seenPairKeys.has(pair.key)) {
      violations.push(
        violation(
          'duplicate_pair_key',
          `duplicate pair key ${pair.key}`,
          {
            symbol: group.symbol,
            groupKey: group.key,
            pairKey: pair.key,
          },
        ),
      );
      continue;
    }

    seenPairKeys.add(pair.key);

    if (
      pair.olderLineId === pair.newerLineId
      || !group.distinctLineIds.includes(
        pair.olderLineId,
      )
      || !group.distinctLineIds.includes(
        pair.newerLineId,
      )
    ) {
      violations.push(
        violation(
          'pair_line_membership_mismatch',
          `pair ${pair.key} does not map to two distinct group lines`,
          {
            symbol: group.symbol,
            groupKey: group.key,
            pairKey: pair.key,
          },
        ),
      );
      continue;
    }

    const olderOriginAt = Date.parse(
      pair.olderOriginExtremumAt,
    );
    const newerOriginAt = Date.parse(
      pair.newerOriginExtremumAt,
    );
    const firstCoactiveAt = Date.parse(
      pair.firstCoactiveAt,
    );
    const lastCoactiveAt = Date.parse(
      pair.lastCoactiveAt,
    );

    if (
      !Number.isFinite(olderOriginAt)
      || !Number.isFinite(newerOriginAt)
      || newerOriginAt <= olderOriginAt
      || !Number.isFinite(firstCoactiveAt)
      || firstCoactiveAt < newerOriginAt
      || !Number.isFinite(lastCoactiveAt)
      || lastCoactiveAt < firstCoactiveAt
    ) {
      violations.push(
        violation(
          'invalid_pair_order',
          `pair ${pair.key} contains invalid causal timestamp order`,
          {
            symbol: group.symbol,
            groupKey: group.key,
            pairKey: pair.key,
          },
        ),
      );
      continue;
    }

    if (
      !Number.isInteger(pair.originGapBars)
      || pair.originGapBars <= 0
      || !Number.isInteger(
        pair.coactiveObservationCount,
      )
      || pair.coactiveObservationCount <= 0
    ) {
      violations.push(
        violation(
          'invalid_pair_measurement',
          `pair ${pair.key} contains invalid gap or coactivity measurement`,
          {
            symbol: group.symbol,
            groupKey: group.key,
            pairKey: pair.key,
          },
        ),
      );
      continue;
    }

    classifications.push(
      classifyPair(group, pair),
    );
  }

  const frozenClassifications = Object.freeze(
    classifications,
  );

  return Object.freeze({
    groupKey: group.key,
    symbol: group.symbol,
    timeframe: group.timeframe,
    kind: group.kind,
    price: group.price,
    distinctLineCount: group.distinctLineCount,
    maximumConcurrentLineCount:
      group.maximumConcurrentLineCount,
    observationCount: group.observationCount,
    classifications: frozenClassifications,
    totals:
      classificationTotals(
        frozenClassifications,
      ),
  });
}

function countByClass(
  classifications:
    readonly LevelLinesExactPriceOriginPairClassification[],
  expected:
    LevelLinesExactPriceOriginPairClass,
): number {
  return classifications.filter(
    (classification) =>
      classification.classification
        === expected,
  ).length;
}

export function classifyLevelLinesExactPriceOriginCollisions(
  source:
    LevelLinesExactPriceOriginCollisionDiagnosticsReport,
  options:
    ClassifyLevelLinesExactPriceOriginCollisionsOptions = {},
): LevelLinesExactPriceOriginCollisionClassificationReport {
  validateSource(source);

  const violations:
    LevelLinesExactPriceOriginCollisionClassificationViolation[] = [];
  const seenPairKeys = new Set<string>();
  const datasets:
    LevelLinesExactPriceOriginDatasetClassification[] = [];
  let observedGroupCount = 0;
  let observedPairCount = 0;

  for (
    const dataset of [...source.datasets].sort(
      (left, right) =>
        left.symbol.localeCompare(right.symbol),
    )
  ) {
    const groups = [...dataset.groups]
      .sort(
        (left, right) =>
          left.key.localeCompare(right.key),
      )
      .map((group) =>
        classifyGroup(
          group,
          seenPairKeys,
          violations,
        ));
    const pairClassifications = groups.flatMap(
      (group) => group.classifications,
    );

    observedGroupCount += dataset.groups.length;
    observedPairCount += dataset.groups.reduce(
      (total, group) =>
        total + group.pairs.length,
      0,
    );

    if (
      dataset.totals.collisionGroupCount
        !== dataset.groups.length
      || dataset.totals.collisionPairCount
        !== dataset.groups.reduce(
          (total, group) =>
            total + group.pairs.length,
          0,
        )
    ) {
      violations.push(
        violation(
          'source_totals_mismatch',
          `dataset ${dataset.symbol} collision totals do not match report contents`,
          {
            symbol: dataset.symbol,
          },
        ),
      );
    }

    datasets.push(
      Object.freeze({
        symbol: dataset.symbol,
        groupCount: groups.length,
        pairCount:
          pairClassifications.length,
        activeOriginReconfirmationCount:
          countByClass(
            pairClassifications,
            'active_origin_reconfirmation',
          ),
        workedOriginRetentionRearmCount:
          countByClass(
            pairClassifications,
            'worked_origin_retention_rearm',
          ),
        postWorkIndependentOriginCandidateCount:
          countByClass(
            pairClassifications,
            'post_work_independent_origin_candidate',
          ),
        unresolvedCoactiveOriginCount:
          countByClass(
            pairClassifications,
            'unresolved_coactive_origin',
          ),
        classifications: Object.freeze(groups),
      }),
    );
  }

  if (
    source.totals.collisionGroupCount
      !== observedGroupCount
    || source.totals.collisionPairCount
      !== observedPairCount
  ) {
    violations.push(
      violation(
        'source_totals_mismatch',
        'top-level collision totals do not match report contents',
      ),
    );
  }

  const allClassifications = datasets.flatMap(
    (dataset) =>
      dataset.classifications.flatMap(
        (group) => group.classifications,
      ),
  );
  const originGaps = allClassifications.map(
    (classification) =>
      classification.originGapBars,
  );
  const coactiveCounts = allClassifications.map(
    (classification) =>
      classification.coactiveObservationCount,
  );
  const activeOriginReconfirmationCount =
    countByClass(
      allClassifications,
      'active_origin_reconfirmation',
    );
  const workedOriginRetentionRearmCount =
    countByClass(
      allClassifications,
      'worked_origin_retention_rearm',
    );
  const postWorkIndependentOriginCandidateCount =
    countByClass(
      allClassifications,
      'post_work_independent_origin_candidate',
    );
  const unresolvedCoactiveOriginCount =
    countByClass(
      allClassifications,
      'unresolved_coactive_origin',
    );

  const totals:
    LevelLinesExactPriceOriginCollisionClassificationTotals =
    Object.freeze({
      symbolCount: new Set(
        datasets.map(
          (dataset) => dataset.symbol,
        ),
      ).size,
      datasetCount: datasets.length,
      groupCount: observedGroupCount,
      pairCount: allClassifications.length,
      activeOriginReconfirmationCount,
      workedOriginRetentionRearmCount,
      postWorkIndependentOriginCandidateCount,
      unresolvedCoactiveOriginCount,
      inheritedEvidencePairCount:
        allClassifications.filter(
          (classification) =>
            classification
              .newerInheritedPriorExactOriginEvidence,
        ).length,
      nonInheritedEvidencePairCount:
        allClassifications.filter(
          (classification) =>
            !classification
              .newerInheritedPriorExactOriginEvidence,
        ).length,
      gapBuckets: Object.freeze({
        bars1To9: allClassifications.filter(
          (classification) =>
            classification.gapBucket
              === 'bars_1_9',
        ).length,
        bars10To29: allClassifications.filter(
          (classification) =>
            classification.gapBucket
              === 'bars_10_29',
        ).length,
        bars30To59: allClassifications.filter(
          (classification) =>
            classification.gapBucket
              === 'bars_30_59',
        ).length,
        bars60Plus: allClassifications.filter(
          (classification) =>
            classification.gapBucket
              === 'bars_60_plus',
        ).length,
      }),
      coactivityBuckets: Object.freeze({
        oneObservation: allClassifications.filter(
          (classification) =>
            classification.coactivityBucket
              === 'one_observation',
        ).length,
        observations2To10: allClassifications.filter(
          (classification) =>
            classification.coactivityBucket
              === 'observations_2_10',
        ).length,
        observations11To59: allClassifications.filter(
          (classification) =>
            classification.coactivityBucket
              === 'observations_11_59',
        ).length,
        observations60Plus: allClassifications.filter(
          (classification) =>
            classification.coactivityBucket
              === 'observations_60_plus',
        ).length,
      }),
      minimumOriginGapBars:
        minimum(originGaps),
      medianOriginGapBars:
        median(originGaps),
      maximumOriginGapBars:
        maximum(originGaps),
      minimumCoactiveObservationCount:
        minimum(coactiveCounts),
      medianCoactiveObservationCount:
        median(coactiveCounts),
      maximumCoactiveObservationCount:
        maximum(coactiveCounts),
      violationCount: violations.length,
    });

  const status =
    violations.length > 0
      ? 'invalid'
      : totals.pairCount === 0
        ? 'classified_without_pairs'
        : activeOriginReconfirmationCount > 0
          && workedOriginRetentionRearmCount > 0
          ? 'classified_with_split_resolution'
          : 'classified_with_single_resolution_path';

  return Object.freeze({
    version:
      LEVEL_LINES_EXACT_PRICE_ORIGIN_COLLISION_CLASSIFICATION_VERSION,
    sourceVersion: source.version,
    sourceGeneratedAt: source.generatedAt,
    generatedAt:
      options.generatedAt
      ?? new Date().toISOString(),
    sourceReportHash:
      options.sourceReportHash ?? null,
    datasets: Object.freeze(datasets),
    violations: Object.freeze(violations),
    totals,
    status,
    allObservedPairsInheritedPriorOriginEvidence:
      totals.pairCount > 0
      && totals.inheritedEvidencePairCount
        === totals.pairCount,
    activeIdentityReuseEvidenceObserved:
      activeOriginReconfirmationCount > 0,
    workedIdentityRetentionEvidenceObserved:
      workedOriginRetentionRearmCount > 0,
    requiresSplitResolutionContract:
      activeOriginReconfirmationCount > 0
      && workedOriginRetentionRearmCount > 0,
    independentOriginConfirmed: false,
    recommendsSingleGlobalPriceMerge: false,
    classificationOnly: true,
    offlineOnly: true,
    changesLevelIdentity: false,
    changesTradingRules: false,
    createsLiveSetup: false,
    createsSignal: false,
    createsTradeOrder: false,
    usesFutureCandles: false,
  });
}
