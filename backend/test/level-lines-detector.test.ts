import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_LEVEL_LINES_DETECTION_OPTIONS,
  detectLevelLines,
} from '../src/modules/level-engine/level-lines-detector.js';
import type {
  LevelLinesDetectionOptions,
} from '../src/modules/level-engine/level-lines.types.js';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';

type CandleTuple = readonly [
  open: number,
  high: number,
  low: number,
  close: number,
  isClosed?: boolean,
];

const OPTIONS = Object.freeze({
  atrPeriod: 2,
  pivotLeftBars: 1,
  pivotRightBars: 1,
  originDepartureAtr: 0.6,
  originDepartureMaxCandles: 4,
  candidateVisibilityMinDepartureAtr: 2,
  candidateVisibilityMaxAgeBars: 5,
  persistentCandidateMinDepartureAtr: 1.5,
  persistentCandidateLookbackBars: 6,
  originEpisodeMaxSpanCandles: 3,
  workedEpisodeMaxSpanCandles: 8,
  touchTolerancePercent: 0.15,
  minBarsBetweenTouchEpisodes: 0,
  decisiveBreakAtr: 0.5,
  consecutiveBreakCloses: 2,
}) satisfies LevelLinesDetectionOptions;

function candles(
  values: readonly CandleTuple[],
): readonly LevelEngineCandle[] {
  const start =
    Date.parse(
      '2026-01-01T00:00:00.000Z',
    );

  return values.map(
    (
      value,
      index,
    ) => ({
      openTime:
        new Date(
          start + index * 60_000,
        ).toISOString(),
      closeTime:
        new Date(
          start
          + (index + 1) * 60_000
          - 1,
        ).toISOString(),
      open:
        value[0],
      high:
        value[1],
      low:
        value[2],
      close:
        value[3],
      isClosed:
        value[4]
        ?? true,
    }),
  );
}

function detect(
  values: readonly CandleTuple[],
  timeframe:
    '1m' | '5m' = '5m',
) {
  return detectLevelLines(
    {
      symbol:
        'btcusdt',
      timeframe,
      candles:
        candles(values),
    },
    OPTIONS,
  );
}

test(
  'waits for a structurally resolved pivot instead of accepting interim turns',
  () => {
    const unresolvedResistance:
    readonly CandleTuple[] = [
      [95, 100, 94, 99],
      [99, 102, 98, 101],
      [101, 104, 100, 103],
      [103, 106, 102, 105],
      [105, 110, 104, 109],
      [109, 109.5, 103, 104],
      [104, 111, 103, 110],
      [110, 110.5, 105, 106],
    ];
    const shallowSupport:
    readonly CandleTuple[] = [
      [100, 104, 99, 103],
      [103, 105, 100.5, 104],
      [104, 106, 102, 105],
      [105, 107, 103, 106],
      [106, 108, 101, 102],
      [102, 106, 102, 105],
      [105, 109, 103, 108],
      [108, 110, 106, 109],
    ];
    const legacyOptions = {
      ...OPTIONS,
      pivotLeftBars: 2,
      pivotRightBars: 1,
    } satisfies LevelLinesDetectionOptions;
    const structuralOptions = {
      ...OPTIONS,
      pivotLeftBars:
        DEFAULT_LEVEL_LINES_DETECTION_OPTIONS
          .pivotLeftBars,
      pivotRightBars:
        DEFAULT_LEVEL_LINES_DETECTION_OPTIONS
          .pivotRightBars,
    } satisfies LevelLinesDetectionOptions;

    assert.equal(
      DEFAULT_LEVEL_LINES_DETECTION_OPTIONS
        .pivotLeftBars,
      3,
    );
    assert.equal(
      DEFAULT_LEVEL_LINES_DETECTION_OPTIONS
        .pivotRightBars,
      2,
    );

    const legacyResistance =
      detectLevelLines(
        {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          candles:
            candles(
              unresolvedResistance,
            ),
        },
        legacyOptions,
      );
    const structuralResistance =
      detectLevelLines(
        {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          candles:
            candles(
              unresolvedResistance,
            ),
        },
        structuralOptions,
      );

    assert.equal(
      legacyResistance.lines.some(
        (line) =>
          line.kind === 'resistance'
          && line.originCandleIndex === 4,
      ),
      true,
    );
    assert.equal(
      structuralResistance.lines.some(
        (line) =>
          line.kind === 'resistance'
          && line.originCandleIndex === 4,
      ),
      false,
    );

    const legacySupport =
      detectLevelLines(
        {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          candles:
            candles(
              shallowSupport,
            ),
        },
        legacyOptions,
      );
    const structuralSupport =
      detectLevelLines(
        {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          candles:
            candles(
              shallowSupport,
            ),
        },
        structuralOptions,
      );

    assert.equal(
      legacySupport.lines.some(
        (line) =>
          line.kind === 'support'
          && line.originCandleIndex === 4,
      ),
      true,
    );
    assert.equal(
      structuralSupport.lines.some(
        (line) =>
          line.kind === 'support'
          && line.originCandleIndex === 4,
      ),
      false,
    );
  },
);

test(
  'keeps nearby independent extrema as separate exact-price lines',
  () => {
    const result =
      detect([
        [105, 106, 104, 105],
        [104, 105, 100, 101],
        [103.2, 104, 103, 103.5],
        [103.5, 105, 102, 104],
        [102, 103, 99, 100],
        [101, 104, 100.5, 103],
        [103, 105, 102, 104],
      ]);
    const supports =
      result.lines.filter(
        (line) =>
          line.kind === 'support',
      );

    assert.deepEqual(
      supports.map(
        (line) =>
          line.price,
      ),
      [100, 99],
    );
    assert.equal(
      supports.every(
        (line) =>
          line.price
          === line.originExtremumPrice,
      ),
      true,
    );
    assert.equal(
      new Set(
        supports.map(
          (line) => line.id,
        ),
      ).size,
      2,
    );
    assert.equal(
      result.mergesNearbyExtrema,
      false,
    );
  },
);

test(
  'treats adjacent equal extrema as one plateau origin',
  () => {
    const values:
    readonly CandleTuple[] = [
      [105, 106, 104, 105],
      [104, 105, 100, 101],
      [101, 104, 100, 103],
      [103, 107, 102, 106],
      [106, 109, 105, 108],
    ];
    const result =
      detect(values);
    const supports =
      result.lines.filter(
        (line) =>
          line.kind === 'support'
          && line.price === 100,
      );

    assert.equal(
      supports.length,
      1,
    );
    assert.equal(
      supports[0]
        ?.originCandleIndex,
      1,
    );
    assert.equal(
      supports[0]
        ?.originExtremumAt,
      candles(values)[1]
        ?.openTime,
    );
    assert.equal(
      supports[0]
        ?.activeFrom,
      candles(values)[3]
        ?.closeTime,
    );
  },
);

test(
  'keeps a weak causal candidate internal instead of exposing chart noise',
  () => {
    const values:
    readonly CandleTuple[] = [
      [105, 106, 104, 105],
      [104, 105, 100, 101],
      [103.2, 104, 103, 103.5],
      [103.5, 105, 102, 104],
    ];
    const result =
      detect(values);
    const support =
      result.lines.find(
        (line) =>
          line.kind === 'support'
          && line.price === 100,
      );

    assert.ok(support);
    assert.equal(
      support.originCandleIndex,
      1,
    );
    assert.equal(
      support.originExtremumAt,
      candles(values)[1]?.openTime,
    );
    assert.equal(
      support.activeFrom,
      candles(values)[2]?.closeTime,
    );
    assert.ok(
      Date.parse(
        support.activeFrom,
      )
      > Date.parse(
          support.originExtremumAt,
        ),
    );
    assert.equal(
      support.touchCount,
      1,
    );
    assert.equal(
      support.status,
      'candidate',
    );
    assert.equal(
      result.activeLevels.some(
        (line) =>
          line.id === support.id,
      ),
      false,
    );
  },
);

test(
  'exposes only a strong recent candidate before its second interaction',
  () => {
    const strongValues:
    readonly CandleTuple[] = [
      [105, 106, 104, 105],
      [104, 105, 100, 101],
      [103, 111, 103, 110],
      [110, 112, 108, 111],
    ];
    const strong =
      detect(strongValues);
    const candidate =
      strong.lines.find(
        (line) =>
          line.kind === 'support'
          && line.price === 100,
      );

    assert.ok(candidate);
    assert.equal(
      candidate.status,
      'candidate',
    );
    assert.equal(
      candidate.touchCount,
      1,
    );
    assert.equal(
      strong.activeLevels.some(
        (line) =>
          line.id === candidate.id,
      ),
      true,
    );

    const stale =
      detect([
        ...strongValues,
        [111, 113, 109, 112],
        [112, 114, 110, 113],
        [113, 115, 111, 114],
        [114, 116, 112, 115],
      ]);
    const staleCandidate =
      stale.lines.find(
        (line) =>
          line.kind === 'support'
          && line.price === 100,
      );

    assert.ok(staleCandidate);
    assert.equal(
      staleCandidate.status,
      'candidate',
    );
    assert.equal(
      stale.activeLevels.some(
        (line) =>
          line.id
          === staleCandidate.id,
      ),
      false,
    );
  },
);

test(
  'keeps a prominent candidate visible after the ordinary age window',
  () => {
    const values:
    readonly CandleTuple[] = [
      [96, 98, 96, 97],
      [97, 99, 97, 98],
      [97, 98.5, 96.5, 97.5],
      [97, 99, 97, 98],
      [97, 98.5, 96.5, 97.5],
      [97, 99, 97, 98],
      [98, 100, 98, 99],
      [97, 98, 96.5, 97],
      [97, 98, 96.8, 97.5],
      [97.5, 98.5, 97, 98],
      [98, 98.8, 97.2, 98.2],
      [98.2, 99, 97.5, 98],
      [98, 98.6, 97.3, 97.8],
      [97.8, 98.4, 97, 97.5],
    ];
    const options = {
      ...OPTIONS,
      candidateVisibilityMaxAgeBars: 2,
      persistentCandidateMinDepartureAtr:
        1.5,
      persistentCandidateLookbackBars: 6,
    } satisfies LevelLinesDetectionOptions;
    const result =
      detectLevelLines(
        {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          candles:
            candles(values),
        },
        options,
      );
    const candidate =
      result.lines.find(
        (line) =>
          line.kind === 'resistance'
          && line.price === 100,
      );

    assert.ok(candidate);
    assert.equal(
      candidate.status,
      'candidate',
    );
    assert.equal(
      result.closedCandlesCount
      - 1
      - candidate.originCandleIndex
      > options
        .candidateVisibilityMaxAgeBars,
      true,
    );
    assert.equal(
      result.activeLevels.some(
        (line) =>
          line.id === candidate.id,
      ),
      true,
    );
  },
);

test(
  'rejects a pivot that never produces the required causal departure',
  () => {
    const result =
      detect([
        [103, 104, 102, 103],
        [102, 103, 100, 101],
        [101, 101.4, 100.4, 101.1],
        [101.1, 101.3, 100.5, 101],
        [101, 101.2, 100.6, 101],
        [101, 101.3, 100.7, 101.1],
      ]);

    assert.equal(
      result.lines.some(
        (line) =>
          line.kind === 'support'
          && line.price === 100,
      ),
      false,
    );
  },
);

test(
  'keeps a line active and confirms it after the second independent interaction',
  () => {
    const values:
    readonly CandleTuple[] = [
      [105, 106, 104, 105],
      [104, 105, 100, 101],
      [103.2, 104, 103, 103.5],
      [104, 105, 103, 104],
      [103, 104, 100.1, 101],
      [102, 105, 102, 104],
      [104, 106, 103, 105],
    ];
    const result =
      detect(values);
    const confirmed =
      result.lines.find(
        (line) =>
          line.kind === 'support'
          && line.originCandleIndex === 1,
      );

    assert.ok(confirmed);
    assert.equal(
      confirmed.status,
      'confirmed',
    );
    assert.equal(
      confirmed.price,
      100,
    );
    assert.equal(
      confirmed.touchCount,
      2,
    );
    assert.equal(
      confirmed.confirmedAt,
      candles(values)[5]
        ?.closeTime,
    );
    assert.equal(
      confirmed.workedAt,
      null,
    );
    assert.equal(
      confirmed.brokenAt,
      null,
    );
    assert.equal(
      result.activeLevels.some(
        (line) =>
          line.id === confirmed.id,
      ),
      true,
    );
    assert.deepEqual(
      result
        .departureExtremumTracking
        .activeExtrema
        .filter(
          (extremum) =>
            extremum.lineId
            === confirmed.id,
        )
        .map(
          (extremum) => ({
            price:
              extremum.price,
            candleIndex:
              extremum.candleIndex,
            trackingStartedAt:
              extremum
                .trackingStartedAt,
          }),
        ),
      [
        {
          price: 106,
          candleIndex: 6,
          trackingStartedAt:
            candles(values)[5]
              ?.closeTime,
        },
      ],
    );
    assert.deepEqual(
      result
        .observationTracking
        .activeProgress
        .filter(
          (progress) =>
            progress.lineId
            === confirmed.id,
        )
        .map(
          (progress) => ({
            levelPrice:
              progress.levelPrice,
            departureExtremumPrice:
              progress
                .departureExtremumPrice,
            currentPrice:
              progress.currentPrice,
            progress:
              progress.progress,
            stage:
              progress.stage,
          }),
        ),
      [
        {
          levelPrice: 100,
          departureExtremumPrice: 106,
          currentPrice: 105,
          progress: 1 / 6,
          stage: null,
        },
      ],
    );
    assert.deepEqual(
      result
        .approachEvaluation
        .evaluations
        .filter(
          (evaluation) =>
            evaluation.lineId
            === confirmed.id,
        )
        .map(
          (evaluation) => ({
            levelPrice:
              evaluation.levelPrice,
            currentPrice:
              evaluation.currentPrice,
            distanceToLevelPercent:
              evaluation
                .distanceToLevelPercent,
            observationStage:
              evaluation.observationStage,
            stage:
              evaluation.stage,
          }),
        ),
      [
        {
          levelPrice: 100,
          currentPrice: 105,
          distanceToLevelPercent: 5,
          observationStage: null,
          stage: null,
        },
      ],
    );
  },
);

test(
  'does not split the origin swing into an immediate extra touch episode',
  () => {
    const values:
    readonly CandleTuple[] = [
      [95, 96, 94, 95],
      [96, 100, 95, 99],
      [99, 99.95, 97.5, 98],
      [98, 99.9, 97, 99],
      [98, 98.5, 96, 97],
      [98, 99.9, 97, 99],
      [96, 97, 94, 95],
      [95, 96, 93, 94],
    ];
    const result =
      detect(values);
    const confirmed =
      result.lines.find(
        (line) =>
          line.kind === 'resistance'
          && line.originCandleIndex === 1,
      );

    assert.ok(confirmed);
    assert.equal(
      confirmed.status,
      'confirmed',
    );
    assert.equal(
      confirmed.touchCount,
      2,
    );
    assert.equal(
      confirmed.workedAt,
      null,
    );
    assert.equal(
      result.activeLevels.some(
        (line) =>
          line.id === confirmed.id,
      ),
      true,
    );
  },
);

test(
  'keeps a worked line active until a confirmed break',
  () => {
    const values:
    readonly CandleTuple[] = [
      [105, 106, 104, 105],
      [104, 105, 100, 101],
      [103.2, 104, 103, 103.5],
      [104, 105, 103, 104],
      [103, 104, 100.1, 101],
      [102, 105, 102, 104],
      [104, 106, 103, 105],
      [103, 104, 100.05, 101],
      [102, 105, 102, 104],
    ];
    const result =
      detect(values);
    const worked =
      result.lines.find(
        (line) =>
          line.kind === 'support'
          && line.originCandleIndex === 1,
      );

    assert.ok(worked);
    assert.equal(
      worked.status,
      'worked',
    );
    assert.equal(
      worked.price,
      100,
    );
    assert.equal(
      worked.touchCount,
      3,
    );
    assert.equal(
      worked.workedAt,
      candles(values)[8]?.closeTime,
    );
    assert.equal(
      result
        .departureExtremumTracking
        .activeExtrema
        .find(
          (extremum) =>
            extremum.lineId
            === worked.id,
        )
        ?.trackingStartedAt,
      worked.workedAt,
    );
    assert.equal(
      worked.brokenAt,
      null,
    );
    assert.equal(
      result.activeLevels.some(
        (line) =>
          line.id === worked.id,
      ),
      true,
    );
  },
);

test(
  'confirms a later origin from an earlier exact-price rejection without backdating it',
  () => {
    const values:
    readonly CandleTuple[] = [
      [105, 110, 104, 109],
      [99, 100, 97, 98],
      [98, 99, 94, 95],
      [95, 96, 93, 94],
      [96, 100, 95, 99],
      [99, 99, 94, 95],
    ];
    const result =
      detect(values);
    const resistance =
      result.lines.find(
        (line) =>
          line.kind === 'resistance'
          && line.originCandleIndex === 4,
      );

    assert.ok(resistance);
    assert.equal(
      resistance.price,
      100,
    );
    assert.equal(
      resistance.originExtremumAt,
      candles(values)[4]
        ?.openTime,
    );
    assert.equal(
      resistance.activeFrom,
      candles(values)[5]
        ?.closeTime,
    );
    assert.equal(
      resistance.status,
      'confirmed',
    );
    assert.equal(
      resistance.touchCount,
      2,
    );
    assert.equal(
      result.activeLevels.some(
        (line) =>
          line.id
          === resistance.id,
      ),
      true,
    );
  },
);

test(
  'does not reuse an exact-price rejection that broke before the new origin',
  () => {
    const result =
      detect([
        [105, 110, 104, 109],
        [99, 100, 97, 98],
        [98, 99, 94, 95],
        [101, 103, 100.5, 102],
        [102, 104, 101, 103],
        [99, 99, 95, 96],
        [96, 100, 95, 99],
        [99, 99, 94, 95],
      ]);
    const resistance =
      result.lines.find(
        (line) =>
          line.kind === 'resistance'
          && line.originCandleIndex === 6,
      );

    assert.ok(resistance);
    assert.equal(
      resistance.status,
      'candidate',
    );
    assert.equal(
      resistance.touchCount,
      1,
    );
  },
);

test(
  'does not reuse an exact-price rejection after a more extreme wick',
  () => {
    const result =
      detect([
        [105, 110, 104, 109],
        [99, 100, 97, 98],
        [98, 99, 94, 95],
        [99, 101, 95, 98],
        [98, 99, 94, 95],
        [96, 100, 95, 99],
        [99, 99, 94, 95],
      ]);
    const resistance =
      result.lines.find(
        (line) =>
          line.kind === 'resistance'
          && line.originCandleIndex === 5,
      );

    assert.ok(resistance);
    assert.equal(
      resistance.status,
      'candidate',
    );
    assert.equal(
      resistance.touchCount,
      1,
    );
  },
);

test(
  'preserves worked evidence when a later break ends the line',
  () => {
    const result =
      detect([
        [105, 106, 104, 105],
        [104, 105, 100, 101],
        [103.2, 104, 103, 103.5],
        [104, 105, 103, 104],
        [103, 104, 100.1, 101],
        [102, 105, 102, 104],
        [104, 106, 103, 105],
        [103, 104, 100.05, 101],
        [102, 105, 102, 104],
        [99, 99.5, 94, 95],
        [95, 96, 93, 94],
      ]);
    const broken =
      result.lines.find(
        (line) =>
          line.kind === 'support'
          && line.originCandleIndex === 1,
      );

    assert.ok(broken);
    assert.equal(
      broken.status,
      'broken',
    );
    assert.ok(
      broken.workedAt,
    );
    assert.ok(
      broken.brokenAt,
    );
    assert.ok(
      Date.parse(
        broken.brokenAt,
      ) > Date.parse(
        broken.workedAt,
      ),
    );
    assert.equal(
      result.activeLevels.some(
        (line) =>
          line.id === broken.id,
      ),
      false,
    );
    assert.equal(
      result
        .departureExtremumTracking
        .activeExtrema
        .some(
          (extremum) =>
            extremum.lineId
            === broken.id,
        ),
      false,
    );
  },
);

test(
  'lets a confirmed line break before a third worked interaction',
  () => {
    const values:
    readonly CandleTuple[] = [
      [95, 96, 94, 95],
      [96, 100, 95, 99],
      [96, 97, 94, 95],
      [95, 96, 93, 94],
      [98, 99.9, 97, 99],
      [96, 97, 94, 95],
      [95, 96, 93, 94],
      [101, 106, 100.5, 105],
      [105, 106, 104, 105],
    ];
    const result =
      detect(values);
    const broken =
      result.lines.find(
        (line) =>
          line.kind === 'resistance'
          && line.originCandleIndex === 1,
      );

    assert.ok(broken);
    assert.equal(
      broken.status,
      'broken',
    );
    assert.equal(
      broken.touchCount,
      2,
    );
    assert.equal(
      broken.workedAt,
      null,
    );
    assert.equal(
      broken.supersededAt,
      null,
    );
    assert.equal(
      broken.supersessionEvidence,
      null,
    );
    assert.equal(
      broken.brokenAt,
      candles(values)[7]?.closeTime,
    );
    assert.equal(
      result.activeLevels.some(
        (line) =>
          line.id === broken.id,
      ),
      false,
    );
  },
);

test(
  'supersedes an unconfirmed support when a lower low appears to its right',
  () => {
    const values:
    readonly CandleTuple[] = [
      [105, 106, 104, 105],
      [104, 105, 100, 101],
      [103.2, 104, 103, 103.5],
      [101, 102, 98, 101],
      [101, 101.4, 99.5, 99.8],
      [99.8, 100.1, 99.2, 99.6],
      [99.6, 101, 99.4, 100.7],
    ];
    const result =
      detect(values);
    const support =
      result.lines.find(
        (line) =>
          line.kind === 'support'
          && line.price === 100,
      );

    assert.ok(support);
    assert.equal(
      support.status,
      'superseded',
    );
    assert.equal(
      support.workedAt,
      null,
    );
    assert.equal(
      support.supersededAt,
      candles(values)[3]?.closeTime,
    );
    assert.equal(
      support.supersessionEvidence
        ?.candleIndex,
      3,
    );
    assert.equal(
      support.supersessionEvidence
        ?.extremePrice,
      98,
    );
    assert.equal(
      support.brokenAt,
      null,
    );
    assert.equal(
      support.breakEvidence,
      null,
    );
    assert.equal(
      result.activeLevels.some(
        (line) =>
          line.id === support.id,
      ),
      false,
    );
  },
);

test(
  'supersedes an unconfirmed resistance when a higher high appears to its right',
  () => {
    const values:
    readonly CandleTuple[] = [
      [95, 96, 94, 95],
      [96, 100, 95, 99],
      [96, 97, 94, 95],
      [95, 96, 93, 94],
      [99, 101, 98, 100],
      [96, 97, 94, 95],
    ];
    const result =
      detect(values);
    const resistance =
      result.lines.find(
        (line) =>
          line.kind === 'resistance'
          && line.price === 100,
      );

    assert.ok(resistance);
    assert.equal(
      resistance.status,
      'superseded',
    );
    assert.equal(
      resistance.touchCount,
      1,
    );
    assert.equal(
      resistance.supersededAt,
      candles(values)[4]?.closeTime,
    );
    assert.equal(
      resistance.supersessionEvidence
        ?.candleIndex,
      4,
    );
    assert.equal(
      resistance.supersessionEvidence
        ?.extremePrice,
      101,
    );
    assert.equal(
      resistance.brokenAt,
      null,
    );
    assert.equal(
      result.activeLevels.some(
        (line) =>
          line.id
          === resistance.id,
      ),
      false,
    );
  },
);

test(
  'supersedes worked lines when a more extreme candle appears to their right',
  () => {
    const supportValues:
    readonly CandleTuple[] = [
      [105, 106, 104, 105],
      [104, 105, 100, 101],
      [103.2, 104, 103, 103.5],
      [104, 105, 103, 104],
      [103, 104, 100.1, 101],
      [102, 105, 102, 104],
      [104, 106, 103, 105],
      [103, 104, 100.05, 101],
      [102, 105, 102, 104],
      [103, 104, 99, 103],
      [103, 105, 102, 104],
    ];
    const supportResult =
      detect(supportValues);
    const support =
      supportResult.lines.find(
        (line) =>
          line.kind === 'support'
          && line.price === 100,
      );

    assert.ok(support);
    assert.ok(support.workedAt);
    assert.equal(
      support.status,
      'superseded',
    );
    assert.equal(
      support.touchCount,
      3,
    );
    assert.equal(
      support.supersededAt,
      candles(supportValues)[9]
        ?.closeTime,
    );
    assert.equal(
      supportResult.activeLevels.some(
        (line) =>
          line.id === support.id,
      ),
      false,
    );

    const resistanceValues:
    readonly CandleTuple[] = [
      [95, 96, 94, 95],
      [96, 100, 95, 99],
      [96, 97, 94, 95],
      [95, 96, 93, 94],
      [98, 99.9, 97, 99],
      [96, 97, 94, 95],
      [95, 96, 93, 94],
      [98, 99.95, 97, 99],
      [96, 97, 94, 95],
      [99, 101, 98, 99],
      [96, 97, 94, 95],
    ];
    const resistanceResult =
      detect(resistanceValues);
    const resistance =
      resistanceResult.lines.find(
        (line) =>
          line.kind === 'resistance'
          && line.price === 100,
      );

    assert.ok(resistance);
    assert.ok(resistance.workedAt);
    assert.equal(
      resistance.status,
      'superseded',
    );
    assert.equal(
      resistance.touchCount,
      3,
    );
    assert.equal(
      resistance.supersededAt,
      candles(resistanceValues)[9]
        ?.closeTime,
    );
    assert.equal(
      resistanceResult.activeLevels.some(
        (line) =>
          line.id === resistance.id,
      ),
      false,
    );
  },
);

test(
  'ignores open candles and never confirms a final candle without right-side data',
  () => {
    const values:
    readonly CandleTuple[] = [
      [105, 106, 104, 105],
      [104, 105, 100, 101],
      [103.2, 104, 103, 103.5],
      [103, 110, 99, 109, false],
    ];
    const result =
      detect(values);

    assert.equal(
      result.ignoredOpenCandlesCount,
      1,
    );
    assert.equal(
      result.lines.some(
        (line) =>
          line.originCandleIndex === 3,
      ),
      false,
    );
    assert.equal(
      result.usesFutureCandles,
      false,
    );
  },
);

test(
  'keeps timeframe identity independent and returns frozen registries',
  () => {
    const values:
    readonly CandleTuple[] = [
      [105, 106, 104, 105],
      [104, 105, 100, 101],
      [103.2, 104, 103, 103.5],
      [103.5, 105, 102, 104],
    ];
    const oneMinute =
      detect(values, '1m');
    const fiveMinutes =
      detect(values, '5m');

    assert.notEqual(
      oneMinute.lines[0]?.id,
      fiveMinutes.lines[0]?.id,
    );
    assert.equal(
      oneMinute.lines[0]
        ?.timeframe,
      '1m',
    );
    assert.equal(
      fiveMinutes.lines[0]
        ?.timeframe,
      '5m',
    );
    assert.equal(
      oneMinute
        .departureExtremumTracking
        .timeframe,
      '1m',
    );
    assert.equal(
      fiveMinutes
        .departureExtremumTracking
        .timeframe,
      '5m',
    );
    assert.equal(
      oneMinute
        .observationTracking
        .timeframe,
      '1m',
    );
    assert.equal(
      fiveMinutes
        .observationTracking
        .timeframe,
      '5m',
    );
    assert.equal(
      oneMinute
        .approachEvaluation
        .timeframe,
      '1m',
    );
    assert.equal(
      fiveMinutes
        .approachEvaluation
        .timeframe,
      '5m',
    );
    assert.equal(
      Object.isFrozen(oneMinute),
      true,
    );
    assert.equal(
      Object.isFrozen(
        oneMinute.lines,
      ),
      true,
    );
    assert.equal(
      Object.isFrozen(
        oneMinute.activeLevels,
      ),
      true,
    );
    assert.equal(
      Object.isFrozen(
        oneMinute
          .departureExtremumTracking,
      ),
      true,
    );
    assert.equal(
      Object.isFrozen(
        oneMinute
          .departureExtremumTracking
          .activeExtrema,
      ),
      true,
    );
    assert.equal(
      Object.isFrozen(
        oneMinute
          .observationTracking,
      ),
      true,
    );
    assert.equal(
      Object.isFrozen(
        oneMinute
          .observationTracking
          .activeProgress,
      ),
      true,
    );
    assert.equal(
      Object.isFrozen(
        oneMinute
          .approachEvaluation,
      ),
      true,
    );
    assert.equal(
      Object.isFrozen(
        oneMinute
          .approachEvaluation
          .evaluations,
      ),
      true,
    );
  },
);
