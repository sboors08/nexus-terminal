import type {
  LevelEngineFrozenSampleDataset,
  LevelEngineFrozenSampleItem,
  LevelEngineFrozenSampleKind,
  LevelEngineFrozenSampleMaturity,
  LevelEngineFrozenSampleTransition,
  LevelEngineFrozenSampleZone,
} from './levelEngineFrozenSampleApi';

export type LevelEngineFrozenSampleLifecycleStatus =
  | 'active'
  | 'testing'
  | 'broken'
  | 'flipped'
  | 'expired';

export type LevelEngineFrozenSampleBreakMode =
  | 'decisive_body_break'
  | 'consecutive_closes';

export type LevelEngineFrozenSampleCausalEventType =
  | 'candidate_first_seen'
  | 'candidate_confirmed'
  | 'candidate_touch_added'
  | 'candidate_disappeared'
  | 'candidate_reappeared'
  | 'cycle_started'
  | 'cycle_confirmed'
  | 'cycle_touch_added'
  | 'cycle_broken';

export type LevelEngineFrozenSampleBreakTiming =
  | 'before_break'
  | 'at_break'
  | 'after_break'
  | 'no_break'
  | 'not_observed';

export type LevelEngineFrozenSampleConfirmationState =
  | 'confirmed_before_break'
  | 'confirmed_at_break'
  | 'confirmed_after_break'
  | 'confirmed_unbroken'
  | 'not_confirmed_broken'
  | 'not_confirmed_unbroken'
  | 'cycle_not_observed';

export interface LevelEngineFrozenSampleTouchEpisode {
  readonly id: string;
  readonly kind: LevelEngineFrozenSampleKind;
  readonly startCandleIndex: number;
  readonly endCandleIndex: number;
  readonly anchorCandleIndex: number;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly anchorAt: string;
  readonly confirmedAt: string;
  readonly extremePrice: number;
  readonly atrAtTouch: number;
  readonly departureDistance: number;
  readonly departureAtr: number;
  readonly departureCandles: number;
}

export interface LevelEngineFrozenSampleCandidate {
  readonly id: string;
  readonly kind: LevelEngineFrozenSampleKind;
  readonly zone: LevelEngineFrozenSampleZone;
  readonly activeFrom: string;
  readonly detectedAt: string;
  readonly maturity: LevelEngineFrozenSampleMaturity;
  readonly status: LevelEngineFrozenSampleLifecycleStatus;
  readonly decision:
    | 'accepted'
    | 'rejected';
  readonly touchEpisodes:
    readonly LevelEngineFrozenSampleTouchEpisode[];
  readonly acceptanceReasons: readonly string[];
  readonly rejectionReasons: readonly string[];
}

export interface LevelEngineFrozenSampleBreakEvidence {
  readonly mode: LevelEngineFrozenSampleBreakMode;
  readonly fromKind: LevelEngineFrozenSampleKind;
  readonly candleIndex: number;
  readonly brokenAt: string;
  readonly boundary: number;
  readonly close: number;
  readonly distanceBeyondBoundary: number;
  readonly distanceBeyondBoundaryAtr: number | null;
}

export interface LevelEngineFrozenSampleLifecycleTransition {
  readonly type: LevelEngineFrozenSampleTransition;
  readonly fromCycleId: string | null;
  readonly occurredAt: string;
  readonly triggerEpisodeId: string;
}

export interface LevelEngineFrozenSampleLifecycleCycle {
  readonly id: string;
  readonly sequence: number;
  readonly kind: LevelEngineFrozenSampleKind;
  readonly zone: LevelEngineFrozenSampleZone;
  readonly transition:
    LevelEngineFrozenSampleLifecycleTransition;
  readonly candidate:
    LevelEngineFrozenSampleCandidate;
  readonly endedAt: string | null;
  readonly breakEvidence:
    LevelEngineFrozenSampleBreakEvidence | null;
}

export interface LevelEngineFrozenSampleCausalEvent {
  readonly eventIndex: number;
  readonly type:
    LevelEngineFrozenSampleCausalEventType;
  readonly observedAt: string;
  readonly observedCandleIndex: number;
  readonly marketOccurredAt: string | null;
  readonly sourceCandidateId: string;
  readonly cycleId: string | null;
  readonly kind: LevelEngineFrozenSampleKind;
  readonly transition:
    LevelEngineFrozenSampleTransition | null;
  readonly maturity:
    LevelEngineFrozenSampleMaturity | null;
  readonly touchEpisodeCount: number;
}

export interface LevelEngineFrozenSampleLagObservation {
  readonly marketOccurredAt: string;
  readonly observedAt: string;
  readonly marketCandleIndex: number;
  readonly observedCandleIndex: number;
  readonly lagBars: number;
}

export interface LevelEngineFrozenSampleSelectedCycleDiagnostic {
  readonly cycleFound: boolean;
  readonly cycleId: string;
  readonly kind:
    LevelEngineFrozenSampleKind | null;
  readonly transition:
    LevelEngineFrozenSampleTransition | null;
  readonly firstObservedAt: string | null;
  readonly firstObservedCandleIndex: number | null;
  readonly firstConfirmedAt: string | null;
  readonly firstConfirmedCandleIndex: number | null;
  readonly brokenAt: string | null;
  readonly firstObservedBreakTiming:
    LevelEngineFrozenSampleBreakTiming;
  readonly confirmationState:
    LevelEngineFrozenSampleConfirmationState;
}

export interface LevelEngineFrozenSampleReview {
  readonly reviewOrder: number;
  readonly sourceCandidate:
    LevelEngineFrozenSampleCandidate;
  readonly selectedCandidate:
    LevelEngineFrozenSampleCandidate;
  readonly cycles:
    readonly LevelEngineFrozenSampleLifecycleCycle[];
  readonly currentCycleId: string | null;
  readonly breakCount: number;
  readonly flipCount: number;
  readonly reclaimCount: number;
  readonly selectedCycleId: string;
  readonly selectedCycleSequence: number;
  readonly selectedTransition:
    LevelEngineFrozenSampleTransition;
  readonly selectedCycleIsCurrent: boolean;
  readonly sourceTouchEpisodeCount: number;
  readonly selectedCycleTouchEpisodeCount: number;
  readonly retainedSourceTouchEpisodeCount: number;
  readonly discardedSourceTouchEpisodeCount: number;
  readonly lifecycleCycleCount: number;
  readonly ignoredLifecycleEpisodeCount: number;
  readonly firstLifecycleBreakAt: string | null;
  readonly causalTrackFound: boolean;
  readonly firstSeen:
    LevelEngineFrozenSampleLagObservation | null;
  readonly firstConfirmed:
    LevelEngineFrozenSampleLagObservation | null;
  readonly firstBreakAt: string | null;
  readonly detectorObservationCount: number;
  readonly disappearanceCount: number;
  readonly reappearanceCount: number;
  readonly causalReplayEvents:
    readonly LevelEngineFrozenSampleCausalEvent[];
  readonly selectedCycleDiagnostic:
    LevelEngineFrozenSampleSelectedCycleDiagnostic;
}

type JsonRecord =
  Record<string, unknown>;

const KINDS = [
  'support',
  'resistance',
] as const;

const MATURITIES = [
  'candidate',
  'developing',
  'confirmed',
] as const;

const STATUSES = [
  'active',
  'testing',
  'broken',
  'flipped',
  'expired',
] as const;

const DECISIONS = [
  'accepted',
  'rejected',
] as const;

const TRANSITIONS = [
  'origin',
  'reclaim',
  'flip',
] as const;

const BREAK_MODES = [
  'decisive_body_break',
  'consecutive_closes',
] as const;

const CAUSAL_EVENT_TYPES = [
  'candidate_first_seen',
  'candidate_confirmed',
  'candidate_touch_added',
  'candidate_disappeared',
  'candidate_reappeared',
  'cycle_started',
  'cycle_confirmed',
  'cycle_touch_added',
  'cycle_broken',
] as const;

const BREAK_TIMINGS = [
  'before_break',
  'at_break',
  'after_break',
  'no_break',
  'not_observed',
] as const;

const CONFIRMATION_STATES = [
  'confirmed_before_break',
  'confirmed_at_break',
  'confirmed_after_break',
  'confirmed_unbroken',
  'not_confirmed_broken',
  'not_confirmed_unbroken',
  'cycle_not_observed',
] as const;

function fail(
  field: string,
): never {
  throw new Error(
    `Invalid Level Engine review field: ${field}`,
  );
}

function readRecord(
  value: unknown,
  field: string,
): JsonRecord {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
  ) {
    return fail(field);
  }

  return value as JsonRecord;
}

function readArray(
  record: JsonRecord,
  key: string,
  field: string,
): readonly unknown[] {
  const value =
    record[key];

  if (!Array.isArray(value)) {
    return fail(`${field}.${key}`);
  }

  return value;
}

function readString(
  record: JsonRecord,
  key: string,
  field: string,
): string {
  const value =
    record[key];

  if (
    typeof value !== 'string'
    || value.length === 0
  ) {
    return fail(`${field}.${key}`);
  }

  return value;
}

function readNullableString(
  record: JsonRecord,
  key: string,
  field: string,
): string | null {
  const value =
    record[key];

  if (value === null) {
    return null;
  }

  if (
    typeof value !== 'string'
    || value.length === 0
  ) {
    return fail(`${field}.${key}`);
  }

  return value;
}

function readNumber(
  record: JsonRecord,
  key: string,
  field: string,
): number {
  const value =
    record[key];

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
  ) {
    return fail(`${field}.${key}`);
  }

  return value;
}

function readNullableNumber(
  record: JsonRecord,
  key: string,
  field: string,
): number | null {
  const value =
    record[key];

  if (value === null) {
    return null;
  }

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
  ) {
    return fail(`${field}.${key}`);
  }

  return value;
}

function readInteger(
  record: JsonRecord,
  key: string,
  field: string,
): number {
  const value =
    readNumber(
      record,
      key,
      field,
    );

  if (
    !Number.isInteger(value)
    || value < 0
  ) {
    return fail(`${field}.${key}`);
  }

  return value;
}

function readNullableInteger(
  record: JsonRecord,
  key: string,
  field: string,
): number | null {
  const value =
    readNullableNumber(
      record,
      key,
      field,
    );

  if (value === null) {
    return null;
  }

  if (
    !Number.isInteger(value)
    || value < 0
  ) {
    return fail(`${field}.${key}`);
  }

  return value;
}

function readBoolean(
  record: JsonRecord,
  key: string,
  field: string,
): boolean {
  const value =
    record[key];

  if (typeof value !== 'boolean') {
    return fail(`${field}.${key}`);
  }

  return value;
}

function readEnum<
  T extends readonly string[],
>(
  value: unknown,
  allowed: T,
  field: string,
): T[number] {
  if (
    typeof value !== 'string'
    || !allowed.includes(
      value as T[number],
    )
  ) {
    return fail(field);
  }

  return value as T[number];
}

function readNullableEnum<
  T extends readonly string[],
>(
  value: unknown,
  allowed: T,
  field: string,
): T[number] | null {
  if (value === null) {
    return null;
  }

  return readEnum(
    value,
    allowed,
    field,
  );
}

function readStringArray(
  record: JsonRecord,
  key: string,
  field: string,
): readonly string[] {
  return readArray(
    record,
    key,
    field,
  ).map(
    (
      value,
      index,
    ) => {
      if (
        typeof value !== 'string'
        || value.length === 0
      ) {
        return fail(
          `${field}.${key}[${index}]`,
        );
      }

      return value;
    },
  );
}

function parseZone(
  value: unknown,
  field: string,
): LevelEngineFrozenSampleZone {
  const record =
    readRecord(
      value,
      field,
    );

  const low =
    readNumber(
      record,
      'low',
      field,
    );

  const reference =
    readNumber(
      record,
      'reference',
      field,
    );

  const high =
    readNumber(
      record,
      'high',
      field,
    );

  if (
    low > reference
    || reference > high
  ) {
    return fail(field);
  }

  return {
    low,
    reference,
    high,
  };
}

function parseTouchEpisode(
  value: unknown,
  index: number,
  field: string,
): LevelEngineFrozenSampleTouchEpisode {
  const itemField =
    `${field}[${index}]`;

  const record =
    readRecord(
      value,
      itemField,
    );

  return {
    id:
      readString(
        record,
        'id',
        itemField,
      ),

    kind:
      readEnum(
        record.kind,
        KINDS,
        `${itemField}.kind`,
      ),

    startCandleIndex:
      readInteger(
        record,
        'startCandleIndex',
        itemField,
      ),

    endCandleIndex:
      readInteger(
        record,
        'endCandleIndex',
        itemField,
      ),

    anchorCandleIndex:
      readInteger(
        record,
        'anchorCandleIndex',
        itemField,
      ),

    startedAt:
      readString(
        record,
        'startedAt',
        itemField,
      ),

    endedAt:
      readString(
        record,
        'endedAt',
        itemField,
      ),

    anchorAt:
      readString(
        record,
        'anchorAt',
        itemField,
      ),

    confirmedAt:
      readString(
        record,
        'confirmedAt',
        itemField,
      ),

    extremePrice:
      readNumber(
        record,
        'extremePrice',
        itemField,
      ),

    atrAtTouch:
      readNumber(
        record,
        'atrAtTouch',
        itemField,
      ),

    departureDistance:
      readNumber(
        record,
        'departureDistance',
        itemField,
      ),

    departureAtr:
      readNumber(
        record,
        'departureAtr',
        itemField,
      ),

    departureCandles:
      readInteger(
        record,
        'departureCandles',
        itemField,
      ),
  };
}

function parseCandidate(
  value: unknown,
  field: string,
): LevelEngineFrozenSampleCandidate {
  const record =
    readRecord(
      value,
      field,
    );

  if (
    readBoolean(
      record,
      'observationalOnly',
      field,
    ) !== true
    || readBoolean(
      record,
      'createsSetup',
      field,
    ) !== false
  ) {
    return fail(
      `${field}.safety`,
    );
  }

  return {
    id:
      readString(
        record,
        'id',
        field,
      ),

    kind:
      readEnum(
        record.kind,
        KINDS,
        `${field}.kind`,
      ),

    zone:
      parseZone(
        record.zone,
        `${field}.zone`,
      ),

    activeFrom:
      readString(
        record,
        'activeFrom',
        field,
      ),

    detectedAt:
      readString(
        record,
        'detectedAt',
        field,
      ),

    maturity:
      readEnum(
        record.maturity,
        MATURITIES,
        `${field}.maturity`,
      ),

    status:
      readEnum(
        record.status,
        STATUSES,
        `${field}.status`,
      ),

    decision:
      readEnum(
        record.decision,
        DECISIONS,
        `${field}.decision`,
      ),

    touchEpisodes:
      readArray(
        record,
        'touchEpisodes',
        field,
      ).map(
        (
          episode,
          index,
        ) =>
          parseTouchEpisode(
            episode,
            index,
            `${field}.touchEpisodes`,
          ),
      ),

    acceptanceReasons:
      readStringArray(
        record,
        'acceptanceReasons',
        field,
      ),

    rejectionReasons:
      readStringArray(
        record,
        'rejectionReasons',
        field,
      ),
  };
}

function parseBreakEvidence(
  value: unknown,
  field: string,
): LevelEngineFrozenSampleBreakEvidence | null {
  if (value === null) {
    return null;
  }

  const record =
    readRecord(
      value,
      field,
    );

  return {
    mode:
      readEnum(
        record.mode,
        BREAK_MODES,
        `${field}.mode`,
      ),

    fromKind:
      readEnum(
        record.fromKind,
        KINDS,
        `${field}.fromKind`,
      ),

    candleIndex:
      readInteger(
        record,
        'candleIndex',
        field,
      ),

    brokenAt:
      readString(
        record,
        'brokenAt',
        field,
      ),

    boundary:
      readNumber(
        record,
        'boundary',
        field,
      ),

    close:
      readNumber(
        record,
        'close',
        field,
      ),

    distanceBeyondBoundary:
      readNumber(
        record,
        'distanceBeyondBoundary',
        field,
      ),

    distanceBeyondBoundaryAtr:
      readNullableNumber(
        record,
        'distanceBeyondBoundaryAtr',
        field,
      ),
  };
}

function parseCycle(
  value: unknown,
  index: number,
): LevelEngineFrozenSampleLifecycleCycle {
  const field =
    `reviewItem.lifecycle.cycles[${index}]`;

  const record =
    readRecord(
      value,
      field,
    );

  const transitionRecord =
    readRecord(
      record.transition,
      `${field}.transition`,
    );

  return {
    id:
      readString(
        record,
        'id',
        field,
      ),

    sequence:
      readInteger(
        record,
        'sequence',
        field,
      ),

    kind:
      readEnum(
        record.kind,
        KINDS,
        `${field}.kind`,
      ),

    zone:
      parseZone(
        record.zone,
        `${field}.zone`,
      ),

    transition: {
      type:
        readEnum(
          transitionRecord.type,
          TRANSITIONS,
          `${field}.transition.type`,
        ),

      fromCycleId:
        readNullableString(
          transitionRecord,
          'fromCycleId',
          `${field}.transition`,
        ),

      occurredAt:
        readString(
          transitionRecord,
          'occurredAt',
          `${field}.transition`,
        ),

      triggerEpisodeId:
        readString(
          transitionRecord,
          'triggerEpisodeId',
          `${field}.transition`,
        ),
    },

    candidate:
      parseCandidate(
        record.candidate,
        `${field}.candidate`,
      ),

    endedAt:
      readNullableString(
        record,
        'endedAt',
        field,
      ),

    breakEvidence:
      parseBreakEvidence(
        record.breakEvidence,
        `${field}.breakEvidence`,
      ),
  };
}

function parseLagObservation(
  value: unknown,
  field: string,
): LevelEngineFrozenSampleLagObservation | null {
  if (value === null) {
    return null;
  }

  const record =
    readRecord(
      value,
      field,
    );

  return {
    marketOccurredAt:
      readString(
        record,
        'marketOccurredAt',
        field,
      ),

    observedAt:
      readString(
        record,
        'observedAt',
        field,
      ),

    marketCandleIndex:
      readInteger(
        record,
        'marketCandleIndex',
        field,
      ),

    observedCandleIndex:
      readInteger(
        record,
        'observedCandleIndex',
        field,
      ),

    lagBars:
      readInteger(
        record,
        'lagBars',
        field,
      ),
  };
}

function parseCausalEvent(
  value: unknown,
  index: number,
): LevelEngineFrozenSampleCausalEvent {
  const field =
    `reviewItem.causalReplayEvents[${index}]`;

  const record =
    readRecord(
      value,
      field,
    );

  return {
    eventIndex:
      readInteger(
        record,
        'eventIndex',
        field,
      ),

    type:
      readEnum(
        record.type,
        CAUSAL_EVENT_TYPES,
        `${field}.type`,
      ),

    observedAt:
      readString(
        record,
        'observedAt',
        field,
      ),

    observedCandleIndex:
      readInteger(
        record,
        'observedCandleIndex',
        field,
      ),

    marketOccurredAt:
      readNullableString(
        record,
        'marketOccurredAt',
        field,
      ),

    sourceCandidateId:
      readString(
        record,
        'sourceCandidateId',
        field,
      ),

    cycleId:
      readNullableString(
        record,
        'cycleId',
        field,
      ),

    kind:
      readEnum(
        record.kind,
        KINDS,
        `${field}.kind`,
      ),

    transition:
      readNullableEnum(
        record.transition,
        TRANSITIONS,
        `${field}.transition`,
      ),

    maturity:
      readNullableEnum(
        record.maturity,
        MATURITIES,
        `${field}.maturity`,
      ),

    touchEpisodeCount:
      readInteger(
        record,
        'touchEpisodeCount',
        field,
      ),
  };
}

function assertCandleIndex(
  value: number | null,
  candleCount: number,
  field: string,
): void {
  if (
    value !== null
    && (
      value < 0
      || value >= candleCount
    )
  ) {
    fail(field);
  }
}

function assertSameZone(
  left: LevelEngineFrozenSampleZone,
  right: LevelEngineFrozenSampleZone,
  field: string,
): void {
  if (
    left.low !== right.low
    || left.reference !== right.reference
    || left.high !== right.high
  ) {
    fail(field);
  }
}

export function parseLevelEngineFrozenSampleReview(
  item: LevelEngineFrozenSampleItem,
  dataset: LevelEngineFrozenSampleDataset,
): LevelEngineFrozenSampleReview {
  if (
    dataset.key !== item.datasetKey
    || dataset.symbol !== item.symbol
    || dataset.sourceTimeframe
      !== item.sourceTimeframe
  ) {
    fail(
      'dataset',
    );
  }

  const firstOpenCandleIndex =
    dataset.candles.findIndex(
      (candle) =>
        candle.isClosed !== true,
    );

  const closedCandleCount =
    firstOpenCandleIndex === -1
      ? dataset.candles.length
      : firstOpenCandleIndex;

  if (
    closedCandleCount === 0
    || dataset.candles
      .slice(
        closedCandleCount,
      )
      .some(
        (candle) =>
          candle.isClosed === true,
      )
  ) {
    fail(
      'dataset.closedCandles',
    );
  }

  const review =
    readRecord(
      item.reviewItem,
      'reviewItem',
    );

  const sourceCandidate =
    parseCandidate(
      review.sourceCandidate,
      'reviewItem.sourceCandidate',
    );

  const selectedCandidate =
    parseCandidate(
      review.candidate,
      'reviewItem.candidate',
    );

  const lifecycle =
    readRecord(
      review.lifecycle,
      'reviewItem.lifecycle',
    );

  if (
    readBoolean(
      lifecycle,
      'observationalOnly',
      'reviewItem.lifecycle',
    ) !== true
    || readBoolean(
      lifecycle,
      'createsSetup',
      'reviewItem.lifecycle',
    ) !== false
    || readBoolean(
      lifecycle,
      'usesQualityScore',
      'reviewItem.lifecycle',
    ) !== false
  ) {
    fail(
      'reviewItem.lifecycle.safety',
    );
  }

  const cycles =
    readArray(
      lifecycle,
      'cycles',
      'reviewItem.lifecycle',
    ).map(
      parseCycle,
    );

  const lifecycleDiagnostic =
    readRecord(
      review.lifecycleDiagnostic,
      'reviewItem.lifecycleDiagnostic',
    );

  const causalDiagnostic =
    readRecord(
      review.causalReplayDiagnostic,
      'reviewItem.causalReplayDiagnostic',
    );

  const selectedCycleDiagnosticRecord =
    readRecord(
      causalDiagnostic.selectedCycle,
      'reviewItem.causalReplayDiagnostic.selectedCycle',
    );

  const selectedCycleDiagnostic:
  LevelEngineFrozenSampleSelectedCycleDiagnostic = {
    cycleFound:
      readBoolean(
        selectedCycleDiagnosticRecord,
        'cycleFound',
        'reviewItem.causalReplayDiagnostic.selectedCycle',
      ),

    cycleId:
      readString(
        selectedCycleDiagnosticRecord,
        'cycleId',
        'reviewItem.causalReplayDiagnostic.selectedCycle',
      ),

    kind:
      readNullableEnum(
        selectedCycleDiagnosticRecord.kind,
        KINDS,
        'reviewItem.causalReplayDiagnostic.selectedCycle.kind',
      ),

    transition:
      readNullableEnum(
        selectedCycleDiagnosticRecord.transition,
        TRANSITIONS,
        'reviewItem.causalReplayDiagnostic.selectedCycle.transition',
      ),

    firstObservedAt:
      readNullableString(
        selectedCycleDiagnosticRecord,
        'firstObservedAt',
        'reviewItem.causalReplayDiagnostic.selectedCycle',
      ),

    firstObservedCandleIndex:
      readNullableInteger(
        selectedCycleDiagnosticRecord,
        'firstObservedCandleIndex',
        'reviewItem.causalReplayDiagnostic.selectedCycle',
      ),

    firstConfirmedAt:
      readNullableString(
        selectedCycleDiagnosticRecord,
        'firstConfirmedAt',
        'reviewItem.causalReplayDiagnostic.selectedCycle',
      ),

    firstConfirmedCandleIndex:
      readNullableInteger(
        selectedCycleDiagnosticRecord,
        'firstConfirmedCandleIndex',
        'reviewItem.causalReplayDiagnostic.selectedCycle',
      ),

    brokenAt:
      readNullableString(
        selectedCycleDiagnosticRecord,
        'brokenAt',
        'reviewItem.causalReplayDiagnostic.selectedCycle',
      ),

    firstObservedBreakTiming:
      readEnum(
        selectedCycleDiagnosticRecord.firstObservedBreakTiming,
        BREAK_TIMINGS,
        'reviewItem.causalReplayDiagnostic.selectedCycle.firstObservedBreakTiming',
      ),

    confirmationState:
      readEnum(
        selectedCycleDiagnosticRecord.confirmationState,
        CONFIRMATION_STATES,
        'reviewItem.causalReplayDiagnostic.selectedCycle.confirmationState',
      ),
  };

  const result:
  LevelEngineFrozenSampleReview = {
    reviewOrder:
      readInteger(
        review,
        'reviewOrder',
        'reviewItem',
      ),

    sourceCandidate,
    selectedCandidate,
    cycles,

    currentCycleId:
      readNullableString(
        lifecycle,
        'currentCycleId',
        'reviewItem.lifecycle',
      ),

    breakCount:
      readInteger(
        lifecycle,
        'breakCount',
        'reviewItem.lifecycle',
      ),

    flipCount:
      readInteger(
        lifecycle,
        'flipCount',
        'reviewItem.lifecycle',
      ),

    reclaimCount:
      readInteger(
        lifecycle,
        'reclaimCount',
        'reviewItem.lifecycle',
      ),

    selectedCycleId:
      readString(
        lifecycleDiagnostic,
        'selectedCycleId',
        'reviewItem.lifecycleDiagnostic',
      ),

    selectedCycleSequence:
      readInteger(
        lifecycleDiagnostic,
        'selectedCycleSequence',
        'reviewItem.lifecycleDiagnostic',
      ),

    selectedTransition:
      readEnum(
        lifecycleDiagnostic.selectedTransition,
        TRANSITIONS,
        'reviewItem.lifecycleDiagnostic.selectedTransition',
      ),

    selectedCycleIsCurrent:
      readBoolean(
        lifecycleDiagnostic,
        'selectedCycleIsCurrent',
        'reviewItem.lifecycleDiagnostic',
      ),

    sourceTouchEpisodeCount:
      readInteger(
        lifecycleDiagnostic,
        'sourceTouchEpisodeCount',
        'reviewItem.lifecycleDiagnostic',
      ),

    selectedCycleTouchEpisodeCount:
      readInteger(
        lifecycleDiagnostic,
        'selectedCycleTouchEpisodeCount',
        'reviewItem.lifecycleDiagnostic',
      ),

    retainedSourceTouchEpisodeCount:
      readInteger(
        lifecycleDiagnostic,
        'retainedSourceTouchEpisodeCount',
        'reviewItem.lifecycleDiagnostic',
      ),

    discardedSourceTouchEpisodeCount:
      readInteger(
        lifecycleDiagnostic,
        'discardedSourceTouchEpisodeCount',
        'reviewItem.lifecycleDiagnostic',
      ),

    lifecycleCycleCount:
      readInteger(
        lifecycleDiagnostic,
        'lifecycleCycleCount',
        'reviewItem.lifecycleDiagnostic',
      ),

    ignoredLifecycleEpisodeCount:
      readInteger(
        lifecycleDiagnostic,
        'ignoredLifecycleEpisodeCount',
        'reviewItem.lifecycleDiagnostic',
      ),

    firstLifecycleBreakAt:
      readNullableString(
        lifecycleDiagnostic,
        'firstBreakAt',
        'reviewItem.lifecycleDiagnostic',
      ),

    causalTrackFound:
      readBoolean(
        causalDiagnostic,
        'trackFound',
        'reviewItem.causalReplayDiagnostic',
      ),

    firstSeen:
      parseLagObservation(
        causalDiagnostic.firstSeen,
        'reviewItem.causalReplayDiagnostic.firstSeen',
      ),

    firstConfirmed:
      parseLagObservation(
        causalDiagnostic.firstConfirmed,
        'reviewItem.causalReplayDiagnostic.firstConfirmed',
      ),

    firstBreakAt:
      readNullableString(
        causalDiagnostic,
        'firstBreakAt',
        'reviewItem.causalReplayDiagnostic',
      ),

    detectorObservationCount:
      readInteger(
        causalDiagnostic,
        'detectorObservationCount',
        'reviewItem.causalReplayDiagnostic',
      ),

    disappearanceCount:
      readInteger(
        causalDiagnostic,
        'disappearanceCount',
        'reviewItem.causalReplayDiagnostic',
      ),

    reappearanceCount:
      readInteger(
        causalDiagnostic,
        'reappearanceCount',
        'reviewItem.causalReplayDiagnostic',
      ),

    causalReplayEvents:
      readArray(
        review,
        'causalReplayEvents',
        'reviewItem',
      ).map(
        parseCausalEvent,
      ),

    selectedCycleDiagnostic,
  };

  if (
    sourceCandidate.id
      !== item.sourceCandidateId
    || selectedCandidate.id
      !== item.selectedCandidateId
    || sourceCandidate.kind
      !== item.sourceKind
    || selectedCandidate.kind
      !== item.selectedKind
    || selectedCandidate.maturity
      !== item.selectedMaturity
    || result.selectedCycleId
      !== item.selectedCandidateId
    || result.selectedTransition
      !== item.selectedTransition
    || result.selectedCycleDiagnostic.cycleId
      !== result.selectedCycleId
    || result.lifecycleCycleCount
      !== result.cycles.length
    || result.sourceTouchEpisodeCount
      !== sourceCandidate.touchEpisodes.length
    || result.selectedCycleTouchEpisodeCount
      !== selectedCandidate.touchEpisodes.length
  ) {
    fail(
      'reviewItem.consistency',
    );
  }

  assertSameZone(
    selectedCandidate.zone,
    item.selectedZone,
    'reviewItem.selectedZone',
  );

  const selectedCycle =
    cycles.find(
      (cycle) =>
        cycle.id === result.selectedCycleId,
    );

  if (
    !selectedCycle
    || selectedCycle.transition.type
      !== result.selectedTransition
    || selectedCycle.candidate.id
      !== selectedCandidate.id
  ) {
    fail(
      'reviewItem.selectedCycle',
    );
  }

  const candleCount =
    closedCandleCount;

  for (
    const candidate
    of [
      sourceCandidate,
      selectedCandidate,
      ...cycles.map(
        (cycle) =>
          cycle.candidate,
      ),
    ]
  ) {
    for (
      const episode
      of candidate.touchEpisodes
    ) {
      assertCandleIndex(
        episode.startCandleIndex,
        candleCount,
        `${episode.id}.startCandleIndex`,
      );

      assertCandleIndex(
        episode.endCandleIndex,
        candleCount,
        `${episode.id}.endCandleIndex`,
      );

      assertCandleIndex(
        episode.anchorCandleIndex,
        candleCount,
        `${episode.id}.anchorCandleIndex`,
      );
    }
  }

  for (const cycle of cycles) {
    assertCandleIndex(
      cycle.breakEvidence?.candleIndex
        ?? null,
      candleCount,
      `${cycle.id}.breakEvidence.candleIndex`,
    );
  }

  for (
    const event
    of result.causalReplayEvents
  ) {
    assertCandleIndex(
      event.observedCandleIndex,
      candleCount,
      `causalReplayEvent[${event.eventIndex}]`,
    );
  }

  assertCandleIndex(
    result.firstSeen?.marketCandleIndex
      ?? null,
    candleCount,
    'firstSeen.marketCandleIndex',
  );

  assertCandleIndex(
    result.firstSeen?.observedCandleIndex
      ?? null,
    candleCount,
    'firstSeen.observedCandleIndex',
  );

  assertCandleIndex(
    result.firstConfirmed?.marketCandleIndex
      ?? null,
    candleCount,
    'firstConfirmed.marketCandleIndex',
  );

  assertCandleIndex(
    result.firstConfirmed?.observedCandleIndex
      ?? null,
    candleCount,
    'firstConfirmed.observedCandleIndex',
  );

  assertCandleIndex(
    result.selectedCycleDiagnostic
      .firstObservedCandleIndex,
    candleCount,
    'selectedCycle.firstObservedCandleIndex',
  );

  assertCandleIndex(
    result.selectedCycleDiagnostic
      .firstConfirmedCandleIndex,
    candleCount,
    'selectedCycle.firstConfirmedCandleIndex',
  );

  return result;
}