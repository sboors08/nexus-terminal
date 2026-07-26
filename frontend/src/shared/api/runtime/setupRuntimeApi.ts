import type {
  PriceLevel,
  Setup,
  SetupReason,
} from '../contracts.js';

export const SETUP_RUNTIME_CANDIDATES_PATH =
  '/api/v1/setups/candidates';

export type SetupRuntimeStage =
  | 'LEVEL_CONFIRMED'
  | 'APPROACHING_THIRD_TOUCH'
  | 'THIRD_TOUCH_CONFIRMED'
  | 'BREAKOUT_CONFIRMED'
  | 'REJECTION_CONFIRMED'
  | 'SETUP_EXPIRED';

export interface SetupRuntimeCandidate {
  id: string;
  symbol: string;
  timeframe: string;

  setupType:
    | 'level_breakout'
    | 'level_bounce';

  direction:
    | 'long'
    | 'short';

  stage:
    SetupRuntimeStage;

  outcome:
    | 'breakout'
    | 'rejection'
    | null;

  level: {
    kind:
      | 'support'
      | 'resistance';

    centerPrice: number;
    zoneLow: number;
    zoneHigh: number;
    touches: number;
    confirmedAt: string;
  };

  currentPrice: number;
  distanceToLevelPct: number;

  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export type SetupRuntimeFetch =
  typeof globalThis.fetch;

export interface SetupRuntimeFetchOptions {
  baseUrl?: string;
  signal?: AbortSignal;
  fetcher?: SetupRuntimeFetch;
}

export interface FetchSetupRuntimeCandidatesOptions
  extends SetupRuntimeFetchOptions {
  limit?: number;
}

export interface FetchSetupRuntimeCandidateOptions
  extends SetupRuntimeFetchOptions {
  candidateId: string;
}

const SETUP_STAGES:
readonly SetupRuntimeStage[] = [
  'LEVEL_CONFIRMED',
  'APPROACHING_THIRD_TOUCH',
  'THIRD_TOUCH_CONFIRMED',
  'BREAKOUT_CONFIRMED',
  'REJECTION_CONFIRMED',
  'SETUP_EXPIRED',
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
      `Invalid setup runtime candidate: ${field}`,
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
      `Invalid setup runtime candidate: ${key}`,
    );
  }

  return value;
}

function readTimestamp(
  record: Record<string, unknown>,
  key: string,
): string {
  const value =
    readString(
      record,
      key,
    );

  if (
    !Number.isFinite(
      Date.parse(value),
    )
  ) {
    throw new Error(
      `Invalid setup runtime timestamp: ${key}`,
    );
  }

  return value;
}

function readPositiveNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value =
    record[key];

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value <= 0
  ) {
    throw new Error(
      `Invalid setup runtime number: ${key}`,
    );
  }

  return value;
}

function readNonNegativeNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value =
    record[key];

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < 0
  ) {
    throw new Error(
      `Invalid setup runtime number: ${key}`,
    );
  }

  return value;
}

function readPositiveInteger(
  record: Record<string, unknown>,
  key: string,
): number {
  const value =
    readPositiveNumber(
      record,
      key,
    );

  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `Invalid setup runtime integer: ${key}`,
    );
  }

  return value;
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

function normalizeCandidateId(
  value: string,
): string {
  const candidateId =
    value.trim();

  if (
    !/^[A-Za-z0-9._:-]{1,300}$/
      .test(candidateId)
  ) {
    throw new Error(
      'Invalid setup runtime candidate id',
    );
  }

  return candidateId;
}

export function buildSetupRuntimeCandidatesUrl(
  options:
    Pick<
      FetchSetupRuntimeCandidatesOptions,
      | 'baseUrl'
      | 'limit'
    > = {},
): string {
  const limit =
    options.limit ?? 100;

  if (
    !Number.isInteger(limit)
    || limit < 1
    || limit > 100
  ) {
    throw new Error(
      'Setup runtime limit must be between 1 and 100',
    );
  }

  return (
    resolveBaseUrl(
      options.baseUrl,
    )
    + SETUP_RUNTIME_CANDIDATES_PATH
    + `?limit=${limit}`
  );
}

export function buildSetupRuntimeCandidateUrl(
  options:
    Pick<
      FetchSetupRuntimeCandidateOptions,
      | 'baseUrl'
      | 'candidateId'
    >,
): string {
  const candidateId =
    normalizeCandidateId(
      options.candidateId,
    );

  return (
    resolveBaseUrl(
      options.baseUrl,
    )
    + SETUP_RUNTIME_CANDIDATES_PATH
    + '/'
    + encodeURIComponent(
      candidateId,
    )
  );
}

export function parseSetupRuntimeCandidate(
  value: unknown,
): SetupRuntimeCandidate {
  const candidate =
    readRecord(
      value,
      'candidate',
    );

  const level =
    readRecord(
      candidate.level,
      'level',
    );

  const setupType =
    readString(
      candidate,
      'setupType',
    );

  if (
    setupType !== 'level_breakout'
    && setupType !== 'level_bounce'
  ) {
    throw new Error(
      'Invalid setup runtime candidate: setupType',
    );
  }

  const direction =
    readString(
      candidate,
      'direction',
    );

  if (
    direction !== 'long'
    && direction !== 'short'
  ) {
    throw new Error(
      'Invalid setup runtime candidate: direction',
    );
  }

  const stage =
    readString(
      candidate,
      'stage',
    ) as SetupRuntimeStage;

  if (
    !SETUP_STAGES.includes(
      stage,
    )
  ) {
    throw new Error(
      'Invalid setup runtime candidate: stage',
    );
  }

  const levelKind =
    readString(
      level,
      'kind',
    );

  if (
    levelKind !== 'support'
    && levelKind !== 'resistance'
  ) {
    throw new Error(
      'Invalid setup runtime candidate: level.kind',
    );
  }

  const outcomeValue =
    candidate.outcome;

  if (
    outcomeValue !== null
    && outcomeValue !== 'breakout'
    && outcomeValue !== 'rejection'
  ) {
    throw new Error(
      'Invalid setup runtime candidate: outcome',
    );
  }

  const zoneLow =
    readPositiveNumber(
      level,
      'zoneLow',
    );

  const centerPrice =
    readPositiveNumber(
      level,
      'centerPrice',
    );

  const zoneHigh =
    readPositiveNumber(
      level,
      'zoneHigh',
    );

  if (
    zoneLow > centerPrice
    || centerPrice > zoneHigh
  ) {
    throw new Error(
      'Invalid setup runtime level zone',
    );
  }

  return {
    id:
      normalizeCandidateId(
        readString(
          candidate,
          'id',
        ),
      ),

    symbol:
      readString(
        candidate,
        'symbol',
      ).toUpperCase(),

    timeframe:
      readString(
        candidate,
        'timeframe',
      ),

    setupType,
    direction,
    stage,

    outcome:
      outcomeValue,

    level: {
      kind:
        levelKind,

      centerPrice,
      zoneLow,
      zoneHigh,

      touches:
        readPositiveInteger(
          level,
          'touches',
        ),

      confirmedAt:
        readTimestamp(
          level,
          'confirmedAt',
        ),
    },

    currentPrice:
      readPositiveNumber(
        candidate,
        'currentPrice',
      ),

    distanceToLevelPct:
      readNonNegativeNumber(
        candidate,
        'distanceToLevelPct',
      ),

    createdAt:
      readTimestamp(
        candidate,
        'createdAt',
      ),

    updatedAt:
      readTimestamp(
        candidate,
        'updatedAt',
      ),

    expiresAt:
      readTimestamp(
        candidate,
        'expiresAt',
      ),
  };
}

export function mapSetupRuntimeStage(
  stage: SetupRuntimeStage,
): Setup['stage'] {
  switch (stage) {
    case 'LEVEL_CONFIRMED':
      return 'watching';

    case 'APPROACHING_THIRD_TOUCH':
      return 'approaching';

    case 'THIRD_TOUCH_CONFIRMED':
      return 'confirmation';

    case 'BREAKOUT_CONFIRMED':
      return 'breakout';

    case 'REJECTION_CONFIRMED':
      return 'bounce';

    case 'SETUP_EXPIRED':
      return 'invalidated';
  }
}

export function mapSetupRuntimeCandidate(
  value:
    SetupRuntimeCandidate,
): Setup {
  const stage =
    mapSetupRuntimeStage(
      value.stage,
    );

  const levelStatus:
    PriceLevel['status'] =
      value.stage === 'SETUP_EXPIRED'
        ? 'invalidated'
        : value.stage === 'BREAKOUT_CONFIRMED'
          ? 'broken'
          : value.stage === 'REJECTION_CONFIRMED'
            ? 'tested'
            : 'active';

  const formationDurationSec =
    Math.max(
      0,
      Math.round(
        (
          Date.parse(
            value.updatedAt,
          )
          - Date.parse(
              value.createdAt,
            )
        ) / 1000,
      ),
    );

  const reasons:
    SetupReason[] = [
      {
        code:
          'runtime.level_confirmed',

        labelKey:
          'setup.runtime.level_confirmed',

        value:
          `${value.level.kind}:${value.level.touches}`,

        state:
          'positive',
      },
      {
        code:
          'runtime.stage',

        labelKey:
          'setup.runtime.stage',

        value:
          value.stage,

        state:
          'neutral',
      },
      {
        code:
          'runtime.distance',

        labelKey:
          'setup.runtime.distance',

        value:
          value.distanceToLevelPct,

        state:
          value.distanceToLevelPct <= 0.5
            ? 'positive'
            : 'neutral',
      },
    ];

  return {
    id:
      value.id,

    symbol:
      value.symbol,

    exchange:
      'binance',

    type:
      value.setupType,

    direction:
      value.direction,

    stage,

    timeframe:
      value.timeframe,

    detectedAt:
      value.createdAt,

    updatedAt:
      value.updatedAt,

    level: {
      id:
        `${value.id}.level`,

      symbol:
        value.symbol,

      type:
        value.level.kind,

      zoneLow:
        value.level.zoneLow,

      zoneHigh:
        value.level.zoneHigh,

      centerPrice:
        value.level.centerPrice,

      touchesCount:
        value.level.touches,

      formedAt:
        value.level.confirmedAt,

      formationDurationSec,

      pullbackType:
        null,

      strength:
        null,

      status:
        levelStatus,
    },

    currentPrice:
      value.currentPrice,

    distanceToLevelPct:
      value.distanceToLevelPct,

    volumeAnomaly:
      null,

    tradesAnomaly:
      null,

    tradeRateAnomaly:
      null,

    btcCorrelation:
      null,

    btcRelativeStrength:
      null,

    reasons,

    warnings: [
      'setup.runtime.metrics_pending',
    ],

    score:
      null,

    scoreStatus:
      null,
  };
}

const defaultFetch:
SetupRuntimeFetch = (
  input,
  init,
) =>
  globalThis.fetch(
    input,
    init,
  );

async function requestJson(
  url: string,
  options:
    SetupRuntimeFetchOptions,
): Promise<{
  status: number;
  payload: unknown;
}> {
  const response =
    await (
      options.fetcher
      ?? defaultFetch
    )(
      url,
      {
        method:
          'GET',

        headers: {
          accept:
            'application/json',
        },

        signal:
          options.signal,
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

  return {
    status:
      response.status,

    payload,
  };
}

export async function fetchSetupRuntimeCandidates(
  options:
    FetchSetupRuntimeCandidatesOptions = {},
): Promise<Setup[]> {
  const response =
    await requestJson(
      buildSetupRuntimeCandidatesUrl(
        options,
      ),
      options,
    );

  if (
    response.status < 200
    || response.status >= 300
  ) {
    throw new Error(
      `Setup runtime request failed: ${response.status}`,
    );
  }

  if (
    !Array.isArray(
      response.payload,
    )
  ) {
    throw new Error(
      'Invalid setup runtime candidates response',
    );
  }

  return response.payload.map(
    (candidate) =>
      mapSetupRuntimeCandidate(
        parseSetupRuntimeCandidate(
          candidate,
        ),
      ),
  );
}

export async function fetchSetupRuntimeCandidate(
  options:
    FetchSetupRuntimeCandidateOptions,
): Promise<Setup | null> {
  const response =
    await requestJson(
      buildSetupRuntimeCandidateUrl(
        options,
      ),
      options,
    );

  if (response.status === 404) {
    return null;
  }

  if (
    response.status < 200
    || response.status >= 300
  ) {
    throw new Error(
      `Setup runtime candidate request failed: ${response.status}`,
    );
  }

  return mapSetupRuntimeCandidate(
    parseSetupRuntimeCandidate(
      response.payload,
    ),
  );
}
