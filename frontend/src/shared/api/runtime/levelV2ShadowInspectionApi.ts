export const LEVEL_V2_SHADOW_BREAK_CLASSIFICATIONS_PATH =
  '/api/v1/setups/levels-v2/shadow/break-classifications';

export const LEVEL_V2_SHADOW_CONFIRMATION_CANDIDATES_PATH =
  '/api/v1/setups/levels-v2/shadow/confirmation-candidates';

export const LEVEL_V2_SHADOW_SETUP_OUTCOMES_PATH =
  '/api/v1/setups/levels-v2/shadow/setup-outcomes';

export type LevelV2ShadowInspectionBreakStatus =
  | 'idle'
  | 'pierce'
  | 'breakout_pending'
  | 'breakout_confirmed'
  | 'false_breakout';

export type LevelV2ShadowInspectionKind =
  | 'support'
  | 'resistance';

export type LevelV2ShadowInspectionVerdict =
  | 'supported'
  | 'contradicted'
  | 'mixed'
  | 'insufficient_data';

export type LevelV2ShadowInspectionConfidence =
  | 'low'
  | 'medium'
  | 'high';

export type LevelV2ShadowInspectionBehavior =
  | 'directional_continuation'
  | 'aggressive_buy_absorption'
  | 'aggressive_sell_absorption'
  | 'momentum_exhaustion'
  | 'mixed'
  | 'insufficient_data';

export type LevelV2ShadowInspectionPostEventReaction =
  | 'continuation'
  | 'rejection'
  | 'stall'
  | 'unknown';

export type LevelV2ShadowInspectionAvailability =
  | 'complete'
  | 'tape_only'
  | 'order_book_only'
  | 'unavailable';

export type LevelV2ShadowInspectionOutcomeStatus =
  | 'pending'
  | 'successful_continuation'
  | 'failed_reversal'
  | 'mixed';

export interface LevelV2ShadowInspectionBreakClassification {
  classifierId: string;
  levelId: string;
  currentKind: LevelV2ShadowInspectionKind;
  status: LevelV2ShadowInspectionBreakStatus;
  maxPenetrationDepthPct: number;
  acceptanceClosesCount: number;
  breakoutConfirmedAt: string | null;
  falseBreakoutAt: string | null;
  lastProcessedCloseTime: string;
}

export interface LevelV2ShadowInspectionConfirmationCandidate {
  id: string;
  classifierId: string;
  levelId: string;
  capturedAt: string;
  priceAcceptance: boolean;
  behavior: LevelV2ShadowInspectionBehavior;
  behaviorConfidence: LevelV2ShadowInspectionConfidence;
  postEventReaction: LevelV2ShadowInspectionPostEventReaction;
  verdict: LevelV2ShadowInspectionVerdict;
  confidence: LevelV2ShadowInspectionConfidence;
  reasons: readonly string[];
  latestAvailability: LevelV2ShadowInspectionAvailability;
  marketEvidenceEntriesCount: number;
  usableTapeEntriesCount: number;
  completeEntriesCount: number;
  netPriceChangePct: number | null;
  latestOrderBookImbalancePct: number | null;
}

export interface LevelV2ShadowInspectionOutcome {
  id: string;
  classifierId: string;
  levelId: string;
  startedAt: string;
  entryPrice: number;
  latestPrice: number;
  observedPricesCount: number;
  durationMs: number;
  maxFavorableExcursionPct: number;
  maxAdverseExcursionPct: number;
  continuationReached: boolean;
  returnedInsideLevel: boolean | null;
  failureConditionReached: boolean;
  status: LevelV2ShadowInspectionOutcomeStatus;
  timeToOutcomeMs: number | null;
  reasons: readonly string[];
}

export interface LevelV2ShadowInspection {
  symbol: string;
  levelId: string;
  generatedAt: string;
  breakClassification:
    LevelV2ShadowInspectionBreakClassification;
  confirmationCandidate:
    LevelV2ShadowInspectionConfirmationCandidate
    | null;
  outcome:
    LevelV2ShadowInspectionOutcome
    | null;
  observationalOnly: true;
}

export type LevelV2ShadowInspectionFetch =
  typeof globalThis.fetch;

export interface FetchLevelV2ShadowInspectionOptions {
  symbol: string;
  levelId: string;
  baseUrl?: string;
  signal?: AbortSignal;
  fetcher?: LevelV2ShadowInspectionFetch;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const IDENTIFIER_PATTERN =
  /^[A-Za-z0-9:._-]{1,240}$/;

const BREAK_STATUSES:
readonly LevelV2ShadowInspectionBreakStatus[] = [
  'idle',
  'pierce',
  'breakout_pending',
  'breakout_confirmed',
  'false_breakout',
];

const KINDS:
readonly LevelV2ShadowInspectionKind[] = [
  'support',
  'resistance',
];

const VERDICTS:
readonly LevelV2ShadowInspectionVerdict[] = [
  'supported',
  'contradicted',
  'mixed',
  'insufficient_data',
];

const CONFIDENCES:
readonly LevelV2ShadowInspectionConfidence[] = [
  'low',
  'medium',
  'high',
];

const BEHAVIORS:
readonly LevelV2ShadowInspectionBehavior[] = [
  'directional_continuation',
  'aggressive_buy_absorption',
  'aggressive_sell_absorption',
  'momentum_exhaustion',
  'mixed',
  'insufficient_data',
];

const POST_EVENT_REACTIONS:
readonly LevelV2ShadowInspectionPostEventReaction[] = [
  'continuation',
  'rejection',
  'stall',
  'unknown',
];

const AVAILABILITIES:
readonly LevelV2ShadowInspectionAvailability[] = [
  'complete',
  'tape_only',
  'order_book_only',
  'unavailable',
];

const OUTCOME_STATUSES:
readonly LevelV2ShadowInspectionOutcomeStatus[] = [
  'pending',
  'successful_continuation',
  'failed_reversal',
  'mixed',
];

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function readRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(
      `Invalid Level v2 shadow inspection object: ${field}`,
    );
  }

  return value;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value =
    record[key];

  if (
    typeof value !== 'string'
    || value.trim().length === 0
  ) {
    throw new Error(
      `Invalid Level v2 shadow inspection string: ${key}`,
    );
  }

  return value;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value =
    record[key];

  if (value === null) {
    return null;
  }

  if (
    typeof value !== 'string'
    || value.trim().length === 0
  ) {
    throw new Error(
      `Invalid Level v2 shadow inspection nullable string: ${key}`,
    );
  }

  return value;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value =
    record[key];

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
  ) {
    throw new Error(
      `Invalid Level v2 shadow inspection number: ${key}`,
    );
  }

  return value;
}

function readNullableNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value =
    record[key];

  if (value === null) {
    return null;
  }

  return readNumber(
    record,
    key,
  );
}

function readInteger(
  record: Record<string, unknown>,
  key: string,
): number {
  const value =
    readNumber(
      record,
      key,
    );

  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `Invalid Level v2 shadow inspection integer: ${key}`,
    );
  }

  return value;
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean {
  const value =
    record[key];

  if (typeof value !== 'boolean') {
    throw new Error(
      `Invalid Level v2 shadow inspection boolean: ${key}`,
    );
  }

  return value;
}

function readNullableBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean | null {
  const value =
    record[key];

  if (value === null) {
    return null;
  }

  return readBoolean(
    record,
    key,
  );
}

function readStringArray(
  record: Record<string, unknown>,
  key: string,
): readonly string[] {
  const value =
    record[key];

  if (
    !Array.isArray(value)
    || value.some(
      (item) =>
        typeof item !== 'string',
    )
  ) {
    throw new Error(
      `Invalid Level v2 shadow inspection string array: ${key}`,
    );
  }

  return [
    ...value,
  ];
}

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (
    typeof value !== 'string'
    || !allowed.includes(
      value as T,
    )
  ) {
    throw new Error(
      `Invalid Level v2 shadow inspection enum: ${field}`,
    );
  }

  return value as T;
}

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value
      .trim()
      .replace(
        /\//gu,
        '',
      )
      .toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(
      'Invalid Level v2 shadow inspection symbol',
    );
  }

  return symbol;
}

function normalizeIdentifier(
  value: string,
  field: string,
): string {
  const identifier =
    value.trim();

  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(
      `Invalid Level v2 shadow inspection ${field}`,
    );
  }

  return identifier;
}

function resolveBaseUrl(
  value: string | undefined,
): string {
  return (
    value
      ?.trim()
      .replace(/\/+$/, '')
    ?? ''
  );
}

function buildUrl(
  baseUrl: string | undefined,
  path: string,
  query: URLSearchParams,
): string {
  return (
    resolveBaseUrl(baseUrl)
    + path
    + '?'
    + query.toString()
  );
}

export function buildLevelV2ShadowBreakClassificationUrl(
  options:
    Pick<
      FetchLevelV2ShadowInspectionOptions,
      | 'symbol'
      | 'levelId'
      | 'baseUrl'
    >,
): string {
  return buildUrl(
    options.baseUrl,
    LEVEL_V2_SHADOW_BREAK_CLASSIFICATIONS_PATH,
    new URLSearchParams({
      symbol:
        normalizeSymbol(
          options.symbol,
        ),
      levelId:
        normalizeIdentifier(
          options.levelId,
          'levelId',
        ),
      limit:
        '1',
    }),
  );
}

export function buildLevelV2ShadowConfirmationCandidateUrl(
  options: {
    symbol: string;
    classifierId: string;
    baseUrl?: string;
  },
): string {
  return buildUrl(
    options.baseUrl,
    LEVEL_V2_SHADOW_CONFIRMATION_CANDIDATES_PATH,
    new URLSearchParams({
      symbol:
        normalizeSymbol(
          options.symbol,
        ),
      classifierId:
        normalizeIdentifier(
          options.classifierId,
          'classifierId',
        ),
      limit:
        '1',
    }),
  );
}

export function buildLevelV2ShadowSetupOutcomeUrl(
  options: {
    symbol: string;
    classifierId: string;
    baseUrl?: string;
  },
): string {
  return buildUrl(
    options.baseUrl,
    LEVEL_V2_SHADOW_SETUP_OUTCOMES_PATH,
    new URLSearchParams({
      symbol:
        normalizeSymbol(
          options.symbol,
        ),
      classifierId:
        normalizeIdentifier(
          options.classifierId,
          'classifierId',
        ),
      limit:
        '1',
    }),
  );
}

function parseBreakClassification(
  value: unknown,
): LevelV2ShadowInspectionBreakClassification {
  const item =
    readRecord(
      value,
      'break item',
    );

  const state =
    readRecord(
      item.state,
      'break state',
    );

  const level =
    readRecord(
      state.level,
      'break state level',
    );

  return {
    classifierId:
      readString(state, 'id'),
    levelId:
      readString(level, 'id'),
    currentKind:
      readEnum(
        state.currentKind,
        KINDS,
        'currentKind',
      ),
    status:
      readEnum(
        state.status,
        BREAK_STATUSES,
        'break status',
      ),
    maxPenetrationDepthPct:
      readNumber(
        state,
        'maxPenetrationDepthPct',
      ),
    acceptanceClosesCount:
      readInteger(
        state,
        'acceptanceClosesCount',
      ),
    breakoutConfirmedAt:
      readNullableString(
        state,
        'breakoutConfirmedAt',
      ),
    falseBreakoutAt:
      readNullableString(
        state,
        'falseBreakoutAt',
      ),
    lastProcessedCloseTime:
      readString(
        state,
        'lastProcessedCloseTime',
      ),
  };
}

function parseConfirmationCandidate(
  value: unknown,
): LevelV2ShadowInspectionConfirmationCandidate {
  const candidate =
    readRecord(
      value,
      'confirmation candidate',
    );

  const evidence =
    readRecord(
      candidate.evidence,
      'confirmation evidence',
    );

  return {
    id:
      readString(candidate, 'id'),
    classifierId:
      readString(
        candidate,
        'classifierId',
      ),
    levelId:
      readString(candidate, 'levelId'),
    capturedAt:
      readString(candidate, 'capturedAt'),
    priceAcceptance:
      readBoolean(
        candidate,
        'priceAcceptance',
      ),
    behavior:
      readEnum(
        candidate.behavior,
        BEHAVIORS,
        'behavior',
      ),
    behaviorConfidence:
      readEnum(
        candidate.behaviorConfidence,
        CONFIDENCES,
        'behaviorConfidence',
      ),
    postEventReaction:
      readEnum(
        candidate.postEventReaction,
        POST_EVENT_REACTIONS,
        'postEventReaction',
      ),
    verdict:
      readEnum(
        candidate.verdict,
        VERDICTS,
        'verdict',
      ),
    confidence:
      readEnum(
        candidate.confidence,
        CONFIDENCES,
        'confidence',
      ),
    reasons:
      readStringArray(
        candidate,
        'reasons',
      ),
    latestAvailability:
      readEnum(
        evidence.latestAvailability,
        AVAILABILITIES,
        'latestAvailability',
      ),
    marketEvidenceEntriesCount:
      readInteger(
        evidence,
        'marketEvidenceEntriesCount',
      ),
    usableTapeEntriesCount:
      readInteger(
        evidence,
        'usableTapeEntriesCount',
      ),
    completeEntriesCount:
      readInteger(
        evidence,
        'completeEntriesCount',
      ),
    netPriceChangePct:
      readNullableNumber(
        evidence,
        'netPriceChangePct',
      ),
    latestOrderBookImbalancePct:
      readNullableNumber(
        evidence,
        'latestOrderBookImbalancePct',
      ),
  };
}

function parseOutcome(
  value: unknown,
): LevelV2ShadowInspectionOutcome {
  const outcome =
    readRecord(
      value,
      'setup outcome',
    );

  return {
    id:
      readString(outcome, 'id'),
    classifierId:
      readString(
        outcome,
        'classifierId',
      ),
    levelId:
      readString(outcome, 'levelId'),
    startedAt:
      readString(outcome, 'startedAt'),
    entryPrice:
      readNumber(outcome, 'entryPrice'),
    latestPrice:
      readNumber(outcome, 'latestPrice'),
    observedPricesCount:
      readInteger(
        outcome,
        'observedPricesCount',
      ),
    durationMs:
      readNumber(outcome, 'durationMs'),
    maxFavorableExcursionPct:
      readNumber(
        outcome,
        'maxFavorableExcursionPct',
      ),
    maxAdverseExcursionPct:
      readNumber(
        outcome,
        'maxAdverseExcursionPct',
      ),
    continuationReached:
      readBoolean(
        outcome,
        'continuationReached',
      ),
    returnedInsideLevel:
      readNullableBoolean(
        outcome,
        'returnedInsideLevel',
      ),
    failureConditionReached:
      readBoolean(
        outcome,
        'failureConditionReached',
      ),
    status:
      readEnum(
        outcome.status,
        OUTCOME_STATUSES,
        'outcome status',
      ),
    timeToOutcomeMs:
      readNullableNumber(
        outcome,
        'timeToOutcomeMs',
      ),
    reasons:
      readStringArray(
        outcome,
        'reasons',
      ),
  };
}

async function fetchJson(
  fetcher: LevelV2ShadowInspectionFetch,
  url: string,
  signal: AbortSignal | undefined,
): Promise<unknown> {
  const response =
    await fetcher(
      url,
      {
        method:
          'GET',
        headers: {
          accept:
            'application/json',
        },
        ...(
          signal
            ? { signal }
            : {}
        ),
      },
    );

  let payload:
    unknown = null;

  try {
    payload =
      await response.json();
  } catch {
    payload = null;
  }

  if (
    response.status < 200
    || response.status >= 300
  ) {
    throw new Error(
      `Level v2 shadow inspection request failed: ${response.status}`,
    );
  }

  return payload;
}

function readItems(
  value: unknown,
  field: string,
): readonly unknown[] {
  const response =
    readRecord(
      value,
      field,
    );

  if (!Array.isArray(response.items)) {
    throw new Error(
      `Invalid Level v2 shadow inspection items: ${field}`,
    );
  }

  return response.items;
}

const defaultFetch:
LevelV2ShadowInspectionFetch = (
  input,
  init,
) =>
  globalThis.fetch(
    input,
    init,
  );

export async function fetchLevelV2ShadowInspection(
  options:
    FetchLevelV2ShadowInspectionOptions,
): Promise<LevelV2ShadowInspection | null> {
  const symbol =
    normalizeSymbol(
      options.symbol,
    );

  const levelId =
    normalizeIdentifier(
      options.levelId,
      'levelId',
    );

  const fetcher =
    options.fetcher
    ?? defaultFetch;

  const breakPayload =
    await fetchJson(
      fetcher,
      buildLevelV2ShadowBreakClassificationUrl({
        symbol,
        levelId,
        ...(
          options.baseUrl !== undefined
            ? { baseUrl: options.baseUrl }
            : {}
        ),
      }),
      options.signal,
    );

  const breakItems =
    readItems(
      breakPayload,
      'break classifications',
    );

  if (breakItems.length === 0) {
    return null;
  }

  const breakClassification =
    parseBreakClassification(
      breakItems[0],
    );

  if (
    breakClassification.levelId
    !== levelId
  ) {
    throw new Error(
      'Level v2 shadow inspection level mismatch',
    );
  }

  const [
    candidatePayload,
    outcomePayload,
  ] = await Promise.all([
    fetchJson(
      fetcher,
      buildLevelV2ShadowConfirmationCandidateUrl({
        symbol,
        classifierId:
          breakClassification
            .classifierId,
        ...(
          options.baseUrl !== undefined
            ? { baseUrl: options.baseUrl }
            : {}
        ),
      }),
      options.signal,
    ),
    fetchJson(
      fetcher,
      buildLevelV2ShadowSetupOutcomeUrl({
        symbol,
        classifierId:
          breakClassification
            .classifierId,
        ...(
          options.baseUrl !== undefined
            ? { baseUrl: options.baseUrl }
            : {}
        ),
      }),
      options.signal,
    ),
  ]);

  const candidateItems =
    readItems(
      candidatePayload,
      'confirmation candidates',
    );

  const outcomeItems =
    readItems(
      outcomePayload,
      'setup outcomes',
    );

  const confirmationCandidate =
    candidateItems.length > 0
      ? parseConfirmationCandidate(
          candidateItems[0],
        )
      : null;

  const outcome =
    outcomeItems.length > 0
      ? parseOutcome(
          outcomeItems[0],
        )
      : null;

  if (
    confirmationCandidate
    && (
      confirmationCandidate.classifierId
        !== breakClassification.classifierId
      || confirmationCandidate.levelId
        !== levelId
    )
  ) {
    throw new Error(
      'Level v2 shadow inspection candidate mismatch',
    );
  }

  if (
    outcome
    && (
      outcome.classifierId
        !== breakClassification.classifierId
      || outcome.levelId
        !== levelId
    )
  ) {
    throw new Error(
      'Level v2 shadow inspection outcome mismatch',
    );
  }

  const breakResponse =
    readRecord(
      breakItems[0],
      'break item',
    );

  const responseSymbol =
    readString(
      breakResponse,
      'symbol',
    );

  if (responseSymbol !== symbol) {
    throw new Error(
      'Level v2 shadow inspection symbol mismatch',
    );
  }

  return {
    symbol,
    levelId,
    generatedAt:
      readString(
        breakResponse,
        'generatedAt',
      ),
    breakClassification,
    confirmationCandidate,
    outcome,
    observationalOnly:
      true,
  };
}
