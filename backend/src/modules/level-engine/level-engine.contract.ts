import {
  LEVEL_ENGINE_CONTRACT_VERSION,
  LEVEL_ENGINE_TIMEFRAMES,
} from './level-engine.types.js';
import type {
  LevelAcceptanceReason,
  LevelCandidate,
  LevelEngineDecision,
  LevelEngineKind,
  LevelEngineLifecycleStatus,
  LevelEngineMaturity,
  LevelEngineTimeframe,
  LevelEngineZone,
  LevelRejectionReason,
  TouchEpisode,
} from './level-engine.types.js';

export interface CreateTouchEpisodeInput {
  id: string;
  symbol: string;
  sourceTimeframe: LevelEngineTimeframe;
  kind: LevelEngineKind;
  startCandleIndex: number;
  endCandleIndex: number;
  anchorCandleIndex: number;
  startedAt: string;
  endedAt: string;
  anchorAt: string;
  confirmedAt: string;
  extremePrice: number;
  atrAtTouch: number;
  departureDistance: number;
  departureAtr: number;
  departureCandles: number;
}

export interface CreateLevelCandidateInput {
  id: string;
  symbol: string;
  sourceTimeframe: LevelEngineTimeframe;
  kind: LevelEngineKind;
  zone: LevelEngineZone;
  activeFrom: string;
  detectedAt: string;
  maturity: LevelEngineMaturity;
  status: LevelEngineLifecycleStatus;
  decision: LevelEngineDecision;
  touchEpisodes: readonly CreateTouchEpisodeInput[];
  acceptanceReasons?: readonly LevelAcceptanceReason[];
  rejectionReasons?: readonly LevelRejectionReason[];
}

const SYMBOL_PATTERN = /^[A-Z0-9]{5,30}$/;

function fail(message: string): never {
  throw new Error(`Level Engine contract: ${message}`);
}

function normalizeId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    fail(`${field} cannot be empty`);
  }
  return normalized;
}

export function normalizeLevelEngineSymbol(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(normalized)) {
    fail(`invalid symbol: ${value}`);
  }
  return normalized;
}

export function isLevelEngineTimeframe(
  value: string | null | undefined,
): value is LevelEngineTimeframe {
  return LEVEL_ENGINE_TIMEFRAMES.includes(
    value as LevelEngineTimeframe,
  );
}

function canonicalTimestamp(value: string, field: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    fail(`${field} must be a valid timestamp`);
  }
  return new Date(timestamp).toISOString();
}

function positiveFinite(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    fail(`${field} must be a positive finite number`);
  }
  return value;
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    fail(`${field} must be a non-negative integer`);
  }
  return value;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    fail(`${field} must be a positive integer`);
  }
  return value;
}

function uniqueValues<T extends string>(
  values: readonly T[],
  field: string,
): readonly T[] {
  const unique = [...new Set(values)];
  if (unique.length !== values.length) {
    fail(`${field} cannot contain duplicates`);
  }
  return Object.freeze(unique);
}

function freezeTouchEpisode(episode: TouchEpisode): TouchEpisode {
  return Object.freeze({ ...episode });
}

export function createTouchEpisode(
  input: CreateTouchEpisodeInput,
): TouchEpisode {
  if (!isLevelEngineTimeframe(input.sourceTimeframe)) {
    fail(`unsupported timeframe: ${input.sourceTimeframe}`);
  }

  const startCandleIndex = nonNegativeInteger(
    input.startCandleIndex,
    'touch startCandleIndex',
  );
  const endCandleIndex = nonNegativeInteger(
    input.endCandleIndex,
    'touch endCandleIndex',
  );
  const anchorCandleIndex = nonNegativeInteger(
    input.anchorCandleIndex,
    'touch anchorCandleIndex',
  );

  if (endCandleIndex < startCandleIndex) {
    fail('touch endCandleIndex cannot precede startCandleIndex');
  }
  if (
    anchorCandleIndex < startCandleIndex
    || anchorCandleIndex > endCandleIndex
  ) {
    fail('touch anchorCandleIndex must belong to the episode');
  }

  const startedAt = canonicalTimestamp(input.startedAt, 'touch startedAt');
  const endedAt = canonicalTimestamp(input.endedAt, 'touch endedAt');
  const anchorAt = canonicalTimestamp(input.anchorAt, 'touch anchorAt');
  const confirmedAt = canonicalTimestamp(
    input.confirmedAt,
    'touch confirmedAt',
  );

  const startedMs = Date.parse(startedAt);
  const endedMs = Date.parse(endedAt);
  const anchorMs = Date.parse(anchorAt);
  const confirmedMs = Date.parse(confirmedAt);

  if (endedMs < startedMs) {
    fail('touch endedAt cannot precede startedAt');
  }
  if (anchorMs < startedMs || anchorMs > endedMs) {
    fail('touch anchorAt must belong to the episode time range');
  }
  if (confirmedMs < endedMs) {
    fail('touch confirmedAt cannot precede endedAt');
  }

  return freezeTouchEpisode({
    id: normalizeId(input.id, 'touch id'),
    symbol: normalizeLevelEngineSymbol(input.symbol),
    sourceTimeframe: input.sourceTimeframe,
    kind: input.kind,
    startCandleIndex,
    endCandleIndex,
    anchorCandleIndex,
    startedAt,
    endedAt,
    anchorAt,
    confirmedAt,
    extremePrice: positiveFinite(input.extremePrice, 'touch extremePrice'),
    atrAtTouch: positiveFinite(input.atrAtTouch, 'touch atrAtTouch'),
    departureDistance: positiveFinite(
      input.departureDistance,
      'touch departureDistance',
    ),
    departureAtr: positiveFinite(input.departureAtr, 'touch departureAtr'),
    departureCandles: positiveInteger(
      input.departureCandles,
      'touch departureCandles',
    ),
  });
}

function validateZone(zone: LevelEngineZone): LevelEngineZone {
  const low = positiveFinite(zone.low, 'zone low');
  const reference = positiveFinite(zone.reference, 'zone reference');
  const high = positiveFinite(zone.high, 'zone high');

  if (low > reference || reference > high) {
    fail('zone must satisfy low <= reference <= high');
  }

  return Object.freeze({ low, reference, high });
}

function validateEpisodeSequence(
  episodes: readonly TouchEpisode[],
  candidate: {
    symbol: string;
    sourceTimeframe: LevelEngineTimeframe;
    kind: LevelEngineKind;
    detectedAt: string;
  },
): void {
  const ids = new Set<string>();
  let previous: TouchEpisode | undefined;
  const detectedMs = Date.parse(candidate.detectedAt);

  for (const episode of episodes) {
    if (ids.has(episode.id)) {
      fail('touch episode ids must be unique');
    }
    ids.add(episode.id);

    if (episode.symbol !== candidate.symbol) {
      fail('touch episode symbol must match the candidate');
    }
    if (episode.sourceTimeframe !== candidate.sourceTimeframe) {
      fail('touch episode timeframe must match the candidate');
    }
    if (episode.kind !== candidate.kind) {
      fail('touch episode kind must match the candidate');
    }
    if (Date.parse(episode.confirmedAt) > detectedMs) {
      fail('candidate cannot depend on a future touch confirmation');
    }

    if (previous) {
      if (episode.startCandleIndex <= previous.endCandleIndex) {
        fail('touch episodes must be separate, non-overlapping episodes');
      }
      if (Date.parse(episode.startedAt) <= Date.parse(previous.endedAt)) {
        fail('touch episode timestamps must be strictly ordered');
      }
    }

    previous = episode;
  }
}

export function createLevelCandidate(
  input: CreateLevelCandidateInput,
): LevelCandidate {
  if (!isLevelEngineTimeframe(input.sourceTimeframe)) {
    fail(`unsupported timeframe: ${input.sourceTimeframe}`);
  }

  const symbol = normalizeLevelEngineSymbol(input.symbol);
  const activeFrom = canonicalTimestamp(input.activeFrom, 'activeFrom');
  const detectedAt = canonicalTimestamp(input.detectedAt, 'detectedAt');
  const episodes = Object.freeze(
    input.touchEpisodes.map((episode) => createTouchEpisode(episode)),
  );

  if (episodes.length === 0) {
    fail('candidate must contain at least one touch episode');
  }

  validateEpisodeSequence(episodes, {
    symbol,
    sourceTimeframe: input.sourceTimeframe,
    kind: input.kind,
    detectedAt,
  });

  const firstEpisode = episodes[0];
  const latestEpisode = episodes.at(-1);
  if (!firstEpisode || !latestEpisode) {
    fail('candidate touch episodes are unavailable');
  }

  if (Date.parse(activeFrom) !== Date.parse(firstEpisode.confirmedAt)) {
    fail('activeFrom must equal the first causally confirmed touch');
  }
  if (Date.parse(detectedAt) < Date.parse(latestEpisode.confirmedAt)) {
    fail('detectedAt cannot precede the latest touch confirmation');
  }
  if (input.maturity === 'confirmed' && episodes.length < 2) {
    fail('confirmed maturity requires at least two touch episodes');
  }

  const acceptanceReasons = uniqueValues(
    input.acceptanceReasons ?? [],
    'acceptanceReasons',
  );
  const rejectionReasons = uniqueValues(
    input.rejectionReasons ?? [],
    'rejectionReasons',
  );

  if (input.decision === 'accepted') {
    if (acceptanceReasons.length === 0) {
      fail('accepted candidate must explain why it was accepted');
    }
    if (rejectionReasons.length > 0) {
      fail('accepted candidate cannot contain rejection reasons');
    }
  } else if (rejectionReasons.length === 0) {
    fail('rejected candidate must explain why it was rejected');
  }

  return Object.freeze({
    id: normalizeId(input.id, 'candidate id'),
    contractVersion: LEVEL_ENGINE_CONTRACT_VERSION,
    symbol,
    sourceTimeframe: input.sourceTimeframe,
    kind: input.kind,
    zone: validateZone(input.zone),
    activeFrom,
    detectedAt,
    maturity: input.maturity,
    status: input.status,
    decision: input.decision,
    touchEpisodes: episodes,
    acceptanceReasons,
    rejectionReasons,
    observationalOnly: true,
    createsSetup: false,
  });
}

export function cloneLevelCandidate(
  candidate: LevelCandidate,
): LevelCandidate {
  return createLevelCandidate({
    id: candidate.id,
    symbol: candidate.symbol,
    sourceTimeframe: candidate.sourceTimeframe,
    kind: candidate.kind,
    zone: { ...candidate.zone },
    activeFrom: candidate.activeFrom,
    detectedAt: candidate.detectedAt,
    maturity: candidate.maturity,
    status: candidate.status,
    decision: candidate.decision,
    touchEpisodes: candidate.touchEpisodes.map((episode) => ({ ...episode })),
    acceptanceReasons: [...candidate.acceptanceReasons],
    rejectionReasons: [...candidate.rejectionReasons],
  });
}
