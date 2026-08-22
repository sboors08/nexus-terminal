import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectLevelLines,
} from '../src/modules/level-engine/level-lines-detector.js';
import {
  resolveLevelLinesExactPriceOrigins,
} from '../src/modules/level-engine/level-lines-exact-price-origin-resolution.js';
import type {
  LevelLine,
  LevelLinesDetectionOptions,
} from '../src/modules/level-engine/level-lines.types.js';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';

const START_MS = Date.parse(
  '2026-08-22T00:00:00.000Z',
);

function at(
  minute: number,
): string {
  return new Date(
    START_MS + minute * 60_000,
  ).toISOString();
}

function line(
  value: Readonly<{
    id: string;
    price?: number;
    kind?: 'support' | 'resistance';
    originMinute: number;
    activeMinute: number;
    confirmedMinute?: number | null;
    workedMinute?: number | null;
    status?: 'candidate' | 'confirmed' | 'worked';
  }>,
): LevelLine {
  const confirmedAt =
    value.confirmedMinute === null
      ? null
      : at(
          value.confirmedMinute
          ?? value.activeMinute,
        );
  const workedAt =
    value.workedMinute === undefined
    || value.workedMinute === null
      ? null
      : at(value.workedMinute);

  return Object.freeze({
    id: value.id,
    symbol: 'BTCUSDT',
    timeframe: '1m',
    price: value.price ?? 100,
    kind: value.kind ?? 'resistance',
    originCandleIndex:
      value.originMinute,
    originExtremumAt:
      at(value.originMinute),
    originExtremumPrice:
      value.price ?? 100,
    activeFrom:
      at(value.activeMinute),
    confirmedAt,
    touchCount:
      workedAt
        ? 3
        : confirmedAt
          ? 2
          : 1,
    status:
      value.status
      ?? (
        workedAt
          ? 'worked'
          : confirmedAt
            ? 'confirmed'
            : 'candidate'
      ),
    workedAt,
    supersededAt: null,
    supersessionEvidence: null,
    brokenAt: null,
    breakEvidence: null,
  });
}

function visibility(
  values: readonly LevelLine[],
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      values.map(
        (value) => [
          value.id,
          value.activeFrom,
        ],
      ),
    ),
  );
}

test(
  'reuses the older current identity when it had not worked before the newer origin became active',
  () => {
    const older = line({
      id: 'older-active',
      originMinute: 1,
      activeMinute: 2,
      confirmedMinute: 4,
      workedMinute: 12,
    });
    const newer = line({
      id: 'newer-reconfirmation',
      originMinute: 8,
      activeMinute: 9,
      confirmedMinute: 9,
    });
    const history = Object.freeze([
      older,
      newer,
    ]);
    const result =
      resolveLevelLinesExactPriceOrigins({
        symbol: 'BTCUSDT',
        timeframe: '1m',
        lines: history,
        currentLevels: history,
        currentLevelVisibleFrom:
          visibility(history),
      });

    assert.deepEqual(
      result.currentLevels.map(
        (value) => value.id,
      ),
      ['older-active'],
    );
    assert.equal(
      result.decisions[0]?.action,
      'reuse_active_exact_price_identity',
    );
    assert.equal(
      result.decisions[0]
        ?.olderStatusAtResolution,
      'confirmed',
    );
    assert.equal(
      result.decisions[0]
        ?.suppressedCurrentLineId,
      'newer-reconfirmation',
    );
    assert.equal(
      result.totals.activeIdentityReuseCount,
      1,
    );
    assert.equal(
      result.totals.workedIdentityRearmCount,
      0,
    );
    assert.equal(
      result.totals.retainedHistoryLineCount,
      2,
    );
    assert.equal(
      history.length,
      2,
    );
  },
);

test(
  'retires a worked identity from current projection and rearms the newer origin without deleting history',
  () => {
    const worked = line({
      id: 'worked-history',
      originMinute: 1,
      activeMinute: 2,
      confirmedMinute: 4,
      workedMinute: 7,
    });
    const rearmed = line({
      id: 'rearmed-current',
      originMinute: 10,
      activeMinute: 11,
      confirmedMinute: 11,
    });
    const history = Object.freeze([
      worked,
      rearmed,
    ]);
    const result =
      resolveLevelLinesExactPriceOrigins({
        symbol: 'BTCUSDT',
        timeframe: '1m',
        lines: history,
        currentLevels: history,
        currentLevelVisibleFrom:
          visibility(history),
      });

    assert.deepEqual(
      result.currentLevels.map(
        (value) => value.id,
      ),
      ['rearmed-current'],
    );
    assert.equal(
      result.decisions[0]?.action,
      'retire_worked_identity_before_rearm',
    );
    assert.equal(
      result.decisions[0]
        ?.olderStatusAtResolution,
      'worked',
    );
    assert.equal(
      result.decisions[0]
        ?.retainedHistoryLineId,
      'worked-history',
    );
    assert.equal(
      result.totals.workedIdentityRearmCount,
      1,
    );
    assert.equal(
      result.preservesFullHistory,
      true,
    );
    assert.equal(
      history.some(
        (value) =>
          value.id === 'worked-history',
      ),
      true,
    );
  },
);

test(
  'uses first current visibility instead of the earlier internal origin activation boundary',
  () => {
    const older = line({
      id: 'older-worked-before-visibility',
      originMinute: 1,
      activeMinute: 2,
      confirmedMinute: 5,
      workedMinute: 10,
    });
    const newer = line({
      id: 'newer-internal-before-visible',
      originMinute: 7,
      activeMinute: 8,
      confirmedMinute: null,
      status: 'candidate',
    });
    const values = Object.freeze([
      older,
      newer,
    ]);
    const result =
      resolveLevelLinesExactPriceOrigins({
        symbol: 'BTCUSDT',
        timeframe: '1m',
        lines: values,
        currentLevels: values,
        currentLevelVisibleFrom:
          Object.freeze({
            [older.id]: older.activeFrom,
            [newer.id]: at(11),
          }),
      });

    assert.equal(
      result.decisions[0]?.action,
      'retire_worked_identity_before_rearm',
    );
    assert.equal(
      result.decisions[0]?.effectiveAt,
      at(11),
    );
    assert.deepEqual(
      result.currentLevels.map(
        (value) => value.id,
      ),
      [newer.id],
    );
  },
);

test(
  'resolves an exact-price chain causally before selecting one current line',
  () => {
    const first = line({
      id: 'first',
      originMinute: 1,
      activeMinute: 2,
      confirmedMinute: 5,
      workedMinute: 9,
    });
    const reconfirmation = line({
      id: 'reconfirmation',
      originMinute: 4,
      activeMinute: 5,
      confirmedMinute: 5,
    });
    const rearm = line({
      id: 'rearm',
      originMinute: 11,
      activeMinute: 12,
      confirmedMinute: 12,
    });
    const values = Object.freeze([
      first,
      reconfirmation,
      rearm,
    ]);
    const result =
      resolveLevelLinesExactPriceOrigins({
        symbol: 'BTCUSDT',
        timeframe: '1m',
        lines: values,
        currentLevels: values,
        currentLevelVisibleFrom:
          visibility(values),
      });

    assert.deepEqual(
      result.decisions.map(
        (value) => value.action,
      ),
      [
        'reuse_active_exact_price_identity',
        'retire_worked_identity_before_rearm',
      ],
    );
    assert.deepEqual(
      result.currentLevels.map(
        (value) => value.id,
      ),
      ['rearm'],
    );
    assert.equal(
      result.totals.inputCurrentLineCount,
      3,
    );
    assert.equal(
      result.totals.resolvedCurrentLineCount,
      1,
    );
  },
);

test(
  'keeps different prices and opposite kinds independent',
  () => {
    const values = Object.freeze([
      line({
        id: 'resistance-100',
        originMinute: 1,
        activeMinute: 2,
      }),
      line({
        id: 'resistance-100-01',
        price: 100.01,
        originMinute: 3,
        activeMinute: 4,
      }),
      line({
        id: 'support-100',
        kind: 'support',
        originMinute: 5,
        activeMinute: 6,
      }),
    ]);
    const result =
      resolveLevelLinesExactPriceOrigins({
        symbol: 'BTCUSDT',
        timeframe: '1m',
        lines: values,
        currentLevels: values,
        currentLevelVisibleFrom:
          visibility(values),
      });

    assert.equal(
      result.currentLevels.length,
      3,
    );
    assert.equal(
      result.decisions.length,
      0,
    );
    assert.equal(
      result.mergesNearbyPrices,
      false,
    );
  },
);

const DETECTOR_OPTIONS = Object.freeze({
  atrPeriod: 2,
  pivotLeftBars: 1,
  pivotRightBars: 1,
  originDepartureAtr: 0.6,
  originDepartureMaxCandles: 4,
  candidateVisibilityMinDepartureAtr: 2,
  candidateVisibilityMaxAgeBars: 10,
  persistentCandidateMinDepartureAtr: 1.5,
  persistentCandidateLookbackBars: 6,
  originEpisodeMaxSpanCandles: 3,
  workedEpisodeMaxSpanCandles: 8,
  touchTolerancePercent: 0.15,
  minBarsBetweenTouchEpisodes: 0,
  decisiveBreakAtr: 0.5,
  consecutiveBreakCloses: 2,
}) satisfies LevelLinesDetectionOptions;

function candleHistory(
  values:
    readonly (readonly [
      open: number,
      high: number,
      low: number,
      close: number,
    ])[],
): readonly LevelEngineCandle[] {
  return values.map(
    (value, index) => Object.freeze({
      openTime: at(index),
      closeTime:
        new Date(
          START_MS
          + (index + 1) * 60_000
          - 1,
        ).toISOString(),
      open: value[0],
      high: value[1],
      low: value[2],
      close: value[3],
      isClosed: true,
    }),
  );
}

test(
  'wires resolution before downstream tracking while retaining both origin records',
  () => {
    const detection = detectLevelLines(
      {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        candles: candleHistory([
          [94, 95, 93, 94],
          [95, 100, 94, 99],
          [96, 97, 92, 93],
          [93, 94, 90, 91],
          [92, 95, 91, 94],
          [95, 100, 94, 99],
          [96, 97, 92, 93],
          [93, 94, 90, 91],
        ]),
      },
      DETECTOR_OPTIONS,
    );
    const history = detection.lines.filter(
      (value) =>
        value.kind === 'resistance'
        && value.price === 100,
    );
    const current = detection.activeLevels.filter(
      (value) =>
        value.kind === 'resistance'
        && value.price === 100,
    );

    assert.equal(history.length, 2);
    assert.equal(current.length, 1);
    assert.equal(
      current[0]?.id,
      history[0]?.id,
    );
    assert.equal(
      detection
        .exactPriceOriginResolution
        .totals
        .activeIdentityReuseCount,
      1,
    );
    assert.equal(
      detection
        .departureExtremumTracking
        .activeExtrema
        .filter(
          (value) =>
            value.lineId
            === history[1]?.id,
        ).length,
      0,
    );
    assert.equal(
      Object.isFrozen(
        detection
          .exactPriceOriginResolution,
      ),
      true,
    );
  },
);

test(
  'rejects duplicate current identities and missing history membership',
  () => {
    const value = line({
      id: 'one',
      originMinute: 1,
      activeMinute: 2,
    });

    assert.throws(
      () =>
        resolveLevelLinesExactPriceOrigins({
          symbol: 'BTCUSDT',
          timeframe: '1m',
          lines: Object.freeze([value]),
          currentLevels: Object.freeze([
            value,
            value,
          ]),
          currentLevelVisibleFrom:
            visibility([value]),
        }),
      /duplicate current line id/,
    );

    assert.throws(
      () =>
        resolveLevelLinesExactPriceOrigins({
          symbol: 'BTCUSDT',
          timeframe: '1m',
          lines: Object.freeze([]),
          currentLevels: Object.freeze([
            value,
          ]),
          currentLevelVisibleFrom:
            visibility([value]),
        }),
      /missing from history/,
    );
  },
);
