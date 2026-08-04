import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEVEL_ENGINE_CONTRACT_VERSION,
  cloneLevelCandidate,
  createLevelCandidate,
  createTouchEpisode,
  isLevelEngineTimeframe,
} from '../src/modules/level-engine/index.js';
import type {
  CreateLevelCandidateInput,
  CreateTouchEpisodeInput,
} from '../src/modules/level-engine/index.js';

const baseTime = Date.parse('2026-08-04T00:00:00.000Z');

function timestamp(minutes: number): string {
  return new Date(baseTime + minutes * 60_000).toISOString();
}

function touch(
  number: number,
  overrides: Partial<CreateTouchEpisodeInput> = {},
): CreateTouchEpisodeInput {
  const start = number * 10;
  return {
    id: `BTCUSDT-1m-resistance-touch-${number}`,
    symbol: 'BTCUSDT',
    sourceTimeframe: '1m',
    kind: 'resistance',
    startCandleIndex: start,
    endCandleIndex: start + 1,
    anchorCandleIndex: start,
    startedAt: timestamp(start),
    endedAt: timestamp(start + 1),
    anchorAt: timestamp(start),
    confirmedAt: timestamp(start + 3),
    extremePrice: 100 + number * 0.05,
    atrAtTouch: 1,
    departureDistance: 1.25,
    departureAtr: 1.25,
    departureCandles: 2,
    ...overrides,
  };
}

function candidate(
  overrides: Partial<CreateLevelCandidateInput> = {},
): CreateLevelCandidateInput {
  const touchEpisodes = overrides.touchEpisodes ?? [
    touch(1),
    touch(3),
  ];
  return {
    id: 'BTCUSDT-1m-resistance-100',
    symbol: 'BTCUSDT',
    sourceTimeframe: '1m',
    kind: 'resistance',
    zone: {
      low: 99.9,
      reference: 100,
      high: 100.15,
    },
    activeFrom: touchEpisodes[0]?.confirmedAt ?? timestamp(13),
    detectedAt: timestamp(40),
    maturity: 'confirmed',
    status: 'active',
    decision: 'accepted',
    touchEpisodes,
    acceptanceReasons: [
      'confirmed_departure',
      'independent_touch_episode',
      'coherent_price_cluster',
    ],
    rejectionReasons: [],
    ...overrides,
  };
}

test('supports only the initial independent Level Engine timeframes', () => {
  assert.equal(isLevelEngineTimeframe('1m'), true);
  assert.equal(isLevelEngineTimeframe('5m'), true);
  assert.equal(isLevelEngineTimeframe('15m'), true);
  assert.equal(isLevelEngineTimeframe('1h'), true);
  assert.equal(isLevelEngineTimeframe('4h'), true);
  assert.equal(isLevelEngineTimeframe('3m'), false);
  assert.equal(isLevelEngineTimeframe('1d'), false);
});

test('creates a setup-neutral causal level candidate without a score', () => {
  const result = createLevelCandidate(candidate());

  assert.equal(result.contractVersion, LEVEL_ENGINE_CONTRACT_VERSION);
  assert.equal(result.observationalOnly, true);
  assert.equal(result.createsSetup, false);
  assert.equal(result.touchEpisodes.length, 2);
  assert.equal('score' in result, false);
  assert.equal(result.activeFrom, result.touchEpisodes[0]?.confirmedAt);
});

test('normalizes symbols and timestamps', () => {
  const result = createLevelCandidate(candidate({
    symbol: ' btcusdt ',
    touchEpisodes: [
      touch(1, { symbol: ' btcusdt ' }),
      touch(3, { symbol: ' btcusdt ' }),
    ],
  }));

  assert.equal(result.symbol, 'BTCUSDT');
  assert.match(result.detectedAt, /\.000Z$/);
});

test('requires the causal line boundary to equal the first confirmed touch', () => {
  assert.throws(
    () => createLevelCandidate(candidate({ activeFrom: timestamp(10) })),
    /activeFrom must equal the first causally confirmed touch/,
  );
});

test('rejects overlapping candles disguised as separate touch episodes', () => {
  assert.throws(
    () => createLevelCandidate(candidate({
      touchEpisodes: [
        touch(1),
        touch(2, {
          startCandleIndex: 11,
          endCandleIndex: 12,
          anchorCandleIndex: 11,
          startedAt: timestamp(11),
          endedAt: timestamp(12),
          anchorAt: timestamp(11),
          confirmedAt: timestamp(15),
        }),
      ],
      activeFrom: timestamp(13),
      detectedAt: timestamp(20),
    })),
    /separate, non-overlapping episodes/,
  );
});

test('confirmed maturity requires at least two independent episodes', () => {
  const oneTouch = [touch(1)];
  assert.throws(
    () => createLevelCandidate(candidate({
      touchEpisodes: oneTouch,
      activeFrom: oneTouch[0]?.confirmedAt,
      detectedAt: timestamp(20),
    })),
    /confirmed maturity requires at least two touch episodes/,
  );
});

test('accepted candidates must explain acceptance and cannot contain rejection reasons', () => {
  assert.throws(
    () => createLevelCandidate(candidate({ acceptanceReasons: [] })),
    /must explain why it was accepted/,
  );
  assert.throws(
    () => createLevelCandidate(candidate({
      rejectionReasons: ['single_candle_noise'],
    })),
    /cannot contain rejection reasons/,
  );
});

test('rejected candidates preserve explicit rejection reasons', () => {
  const oneTouch = [touch(1)];
  const result = createLevelCandidate(candidate({
    decision: 'rejected',
    maturity: 'candidate',
    touchEpisodes: oneTouch,
    activeFrom: oneTouch[0]?.confirmedAt,
    detectedAt: timestamp(20),
    acceptanceReasons: [],
    rejectionReasons: ['single_candle_noise'],
  }));

  assert.deepEqual(result.rejectionReasons, ['single_candle_noise']);
  assert.equal(result.createsSetup, false);
});

test('rejects invalid zone geometry', () => {
  assert.throws(
    () => createLevelCandidate(candidate({
      zone: {
        low: 100.2,
        reference: 100,
        high: 99.8,
      },
    })),
    /low <= reference <= high/,
  );
});

test('touch confirmation cannot use data before the episode ends', () => {
  assert.throws(
    () => createTouchEpisode(touch(1, {
      confirmedAt: timestamp(10),
    })),
    /confirmedAt cannot precede endedAt/,
  );
});

test('returns immutable defensive copies', () => {
  const original = createLevelCandidate(candidate());
  const copy = cloneLevelCandidate(original);

  assert.notEqual(copy, original);
  assert.notEqual(copy.zone, original.zone);
  assert.notEqual(copy.touchEpisodes, original.touchEpisodes);
  assert.notEqual(copy.touchEpisodes[0], original.touchEpisodes[0]);
  assert.equal(Object.isFrozen(copy), true);
  assert.equal(Object.isFrozen(copy.zone), true);
  assert.equal(Object.isFrozen(copy.touchEpisodes), true);
  assert.equal(Object.isFrozen(copy.touchEpisodes[0]), true);
});
