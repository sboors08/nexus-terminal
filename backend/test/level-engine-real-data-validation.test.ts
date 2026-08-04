import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLevelCandidate,
} from '../src/modules/level-engine/level-engine.contract.js';
import {
  buildLevelEngineSymbolValidationReport,
  diagnoseLevelCandidateForReview,
  fetchBinanceLevelEngineCandles,
  LevelEngineRealDataValidationError,
  validateLevelEngineRealData,
} from '../src/modules/level-engine/level-engine-real-data-validation.js';
import {
  buildLevelEngineRealDataReviewHtml,
} from '../src/modules/level-engine/level-engine-real-data-review-html.js';
import type {
  LevelCandidate,
  LevelEngineTimeframe,
} from '../src/modules/level-engine/level-engine.types.js';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';
import type {
  LevelEngineTimeframeDataset,
  MultiTimeframeLevelDetectionResult,
  TimeframeLevelDetectionResult,
} from '../src/modules/level-engine/level-engine-multi-timeframe-detector.types.js';

function json(
  payload: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: {
        'content-type': 'application/json',
      },
    },
  );
}

function row(
  openTime: number,
  open: number,
  high: number,
  low: number,
  close: number,
  closeTime: number,
): unknown[] {
  return [
    openTime,
    String(open),
    String(high),
    String(low),
    String(close),
    '100',
    closeTime,
    '1000',
    10,
    '50',
    '500',
    '0',
  ];
}

function candle(
  index: number,
  timeframeMinutes = 1,
): LevelEngineCandle {
  const openTime = Date.UTC(2026, 0, 1)
    + index * timeframeMinutes * 60_000;
  const closeTime = openTime + timeframeMinutes * 60_000 - 1;
  return Object.freeze({
    openTime: new Date(openTime).toISOString(),
    closeTime: new Date(closeTime).toISOString(),
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    isClosed: true,
  });
}


function pricedCandle(
  index: number,
  values: {
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly close: number;
  },
  timeframeMinutes = 1,
): LevelEngineCandle {
  const openTime = Date.UTC(2026, 0, 1)
    + index * timeframeMinutes * 60_000;
  const closeTime = openTime + timeframeMinutes * 60_000 - 1;
  return Object.freeze({
    openTime: new Date(openTime).toISOString(),
    closeTime: new Date(closeTime).toISOString(),
    ...values,
    isClosed: true,
  });
}

function candidate(
  id: string,
  timeframe: LevelEngineTimeframe,
  maturity: 'candidate' | 'confirmed',
  episodeCount: 1 | 2,
  detectedAt: string,
): LevelCandidate {
  const detectedAtMs = Date.parse(detectedAt);
  const timestampBefore = (milliseconds: number): string =>
    new Date(detectedAtMs - milliseconds).toISOString();
  const firstStartedAt = timestampBefore(5 * 60_000);
  const firstEndedAt = timestampBefore(4 * 60_000);
  const firstConfirmedAt = episodeCount === 1
    ? detectedAt
    : timestampBefore(3 * 60_000);
  const episodes = [
    {
      id: `${id}-touch-1`,
      symbol: 'BTCUSDT',
      sourceTimeframe: timeframe,
      kind: 'support' as const,
      startCandleIndex: 1,
      endCandleIndex: 1,
      anchorCandleIndex: 1,
      startedAt: firstStartedAt,
      endedAt: firstEndedAt,
      anchorAt: firstEndedAt,
      confirmedAt: firstConfirmedAt,
      extremePrice: 100,
      atrAtTouch: 1,
      departureDistance: 1,
      departureAtr: 1,
      departureCandles: 1,
    },
  ];

  if (episodeCount === 2) {
    episodes.push({
      id: `${id}-touch-2`,
      symbol: 'BTCUSDT',
      sourceTimeframe: timeframe,
      kind: 'support' as const,
      startCandleIndex: 5,
      endCandleIndex: 5,
      anchorCandleIndex: 5,
      startedAt: timestampBefore(2 * 60_000),
      endedAt: timestampBefore(60_000),
      anchorAt: timestampBefore(60_000),
      confirmedAt: detectedAt,
      extremePrice: 100.1,
      atrAtTouch: 1,
      departureDistance: 1.2,
      departureAtr: 1.2,
      departureCandles: 1,
    });
  }

  return createLevelCandidate({
    id,
    symbol: 'BTCUSDT',
    sourceTimeframe: timeframe,
    kind: 'support',
    zone: {
      low: 99.5,
      reference: 100,
      high: 100.5,
    },
    activeFrom: firstConfirmedAt,
    detectedAt,
    maturity,
    status: 'active',
    decision: 'accepted',
    touchEpisodes: episodes,
    acceptanceReasons: [
      'confirmed_departure',
      'independent_touch_episode',
    ],
  });
}

function timeframeResult(
  timeframe: LevelEngineTimeframe,
  candidates: readonly LevelCandidate[],
): TimeframeLevelDetectionResult {
  return Object.freeze({
    symbol: 'BTCUSDT',
    sourceTimeframe: timeframe,
    closedCandlesCount: 100,
    ignoredOpenCandlesCount: 1,
    pivotSeeds: Object.freeze([]),
    candidates: Object.freeze([...candidates]),
    rejectedClusters: Object.freeze([
      Object.freeze({
        sourceTimeframe: timeframe,
        kind: 'support' as const,
        seedId: null,
        zone: null,
        pivotSeedCount: 0,
        reason: 'no_pivot_seed' as const,
      }),
    ]),
  });
}

function detection(
  results: readonly TimeframeLevelDetectionResult[],
): MultiTimeframeLevelDetectionResult {
  return Object.freeze({
    symbol: 'BTCUSDT',
    requestedTimeframes: Object.freeze(
      results.map((result) => result.sourceTimeframe),
    ),
    timeframes: Object.freeze([...results]),
    candidates: Object.freeze(
      results.flatMap((result) => result.candidates),
    ),
    observationalOnly: true,
    createsSetup: false,
    mergesAcrossTimeframes: false,
  });
}

test(
  'loads Binance futures candles for the requested real timeframe',
  async () => {
    const requests: string[] = [];
    const openTime = Date.UTC(2026, 0, 1);
    const closeTime = openTime + 5 * 60_000 - 1;

    const candles = await fetchBinanceLevelEngineCandles(
      {
        baseUrl: 'https://fapi.binance.com/',
        requestTimeoutMs: 1_000,
        symbol: ' btcusdt ',
        sourceTimeframe: '5m',
        limit: 2,
        endTime: closeTime,
      },
      {
        now: () => new Date(closeTime + 1),
        fetchImpl: async (input) => {
          const url = new URL(
            input instanceof Request
              ? input.url
              : input.toString(),
          );
          requests.push(`${url.pathname}${url.search}`);
          return json([
            row(
              openTime,
              100,
              102,
              99,
              101,
              closeTime,
            ),
          ]);
        },
      },
    );

    assert.deepEqual(requests, [
      '/fapi/v1/klines'
      + '?symbol=BTCUSDT'
      + '&interval=5m'
      + '&limit=2'
      + `&endTime=${closeTime}`,
    ]);
    assert.equal(candles.length, 1);
    assert.equal(candles[0]?.isClosed, true);
    assert.equal(candles[0]?.high, 102);
  },
);

test(
  'sorts candles and marks an unfinished Binance candle as open',
  async () => {
    const earlyOpen = Date.UTC(2026, 0, 1);
    const earlyClose = earlyOpen + 59_999;
    const lateOpen = earlyOpen + 60_000;
    const lateClose = lateOpen + 59_999;

    const candles = await fetchBinanceLevelEngineCandles(
      {
        baseUrl: 'https://fapi.binance.com',
        requestTimeoutMs: 1_000,
        symbol: 'SOLUSDT',
        sourceTimeframe: '1m',
        limit: 2,
      },
      {
        now: () => new Date(lateClose),
        fetchImpl: async () => json([
          row(lateOpen, 20, 21, 19, 20.5, lateClose),
          row(earlyOpen, 10, 11, 9, 10.5, earlyClose),
        ]),
      },
    );

    assert.equal(candles[0]?.open, 10);
    assert.equal(candles[1]?.open, 20);
    assert.equal(candles[1]?.isClosed, false);
    assert.equal(Object.isFrozen(candles), true);
    assert.equal(Object.isFrozen(candles[0]), true);
  },
);

test(
  'rejects invalid real-data requests before calling Binance',
  async () => {
    let fetchCalled = false;

    await assert.rejects(
      fetchBinanceLevelEngineCandles(
        {
          baseUrl: 'https://fapi.binance.com',
          requestTimeoutMs: 1_000,
          symbol: 'BTCUSDT',
          sourceTimeframe: '1m',
          limit: 1_501,
        },
        {
          fetchImpl: async () => {
            fetchCalled = true;
            return json([]);
          },
        },
      ),
      LevelEngineRealDataValidationError,
    );

    assert.equal(fetchCalled, false);
  },
);

test(
  'maps Binance invalid-symbol errors explicitly',
  async () => {
    await assert.rejects(
      fetchBinanceLevelEngineCandles(
        {
          baseUrl: 'https://fapi.binance.com',
          requestTimeoutMs: 1_000,
          symbol: 'UNKNOWNUSDT',
          sourceTimeframe: '15m',
          limit: 100,
        },
        {
          fetchImpl: async () => json(
            {
              code: -1121,
              msg: 'Invalid symbol.',
            },
            400,
          ),
        },
      ),
      /Binance symbol not found: UNKNOWNUSDT/,
    );
  },
);

test(
  'builds a deterministic review queue without a quality score',
  () => {
    const oneMinuteCandidate = candidate(
      'one-minute-confirmed',
      '1m',
      'confirmed',
      2,
      '2026-01-01T00:06:59.999Z',
    );
    const fourHourCandidate = candidate(
      'four-hour-confirmed',
      '4h',
      'confirmed',
      2,
      '2026-01-01T00:06:59.999Z',
    );
    const singleTouchCandidate = candidate(
      'single-touch',
      '15m',
      'candidate',
      1,
      '2026-01-01T00:02:59.999Z',
    );

    const result = detection([
      timeframeResult('1m', [oneMinuteCandidate]),
      timeframeResult('15m', [singleTouchCandidate]),
      timeframeResult('4h', [fourHourCandidate]),
    ]);
    const datasets: LevelEngineTimeframeDataset[] = [
      {
        symbol: 'BTCUSDT',
        sourceTimeframe: '1m',
        candles: [candle(0)],
      },
      {
        symbol: 'BTCUSDT',
        sourceTimeframe: '15m',
        candles: [candle(0, 15)],
      },
      {
        symbol: 'BTCUSDT',
        sourceTimeframe: '4h',
        candles: [candle(0, 240)],
      },
    ];

    const report = buildLevelEngineSymbolValidationReport(
      datasets,
      result,
      3,
    );

    assert.deepEqual(
      report.reviewQueue.map(
        (item) => item.candidate.id,
      ),
      [
        'four-hour-confirmed',
        'one-minute-confirmed',
        'single-touch',
      ],
    );
    assert.equal(
      'score' in report.reviewQueue[0]!.candidate,
      false,
    );
    assert.equal(
      report.timeframeSummaries[1]?.oneTouchCandidateCount,
      1,
    );
    assert.equal(
      report.timeframeSummaries[0]
        ?.rejectedClustersByReason.no_pivot_seed,
      1,
    );
  },
);

test(
  'requests every symbol and timeframe as an independent dataset',
  async () => {
    const requests: string[] = [];
    const detectCalls: readonly LevelEngineTimeframeDataset[][] = [];
    const mutableDetectCalls =
      detectCalls as LevelEngineTimeframeDataset[][];

    const report = await validateLevelEngineRealData(
      {
        binanceBaseUrl: 'https://fapi.binance.com',
        requestTimeoutMs: 1_000,
        requestDelayMs: 0,
        symbols: ['BTCUSDT', 'ETHUSDT'],
        timeframes: ['1m', '5m'],
        candlesPerTimeframe: 50,
        reviewLimitPerSymbol: 20,
      },
      {
        now: () => new Date('2026-01-02T00:00:00.000Z'),
        fetchCandles: async (request) => {
          requests.push(
            `${request.symbol}:${request.sourceTimeframe}`,
          );
          return Object.freeze([candle(0)]);
        },
        detectCandidates: (datasets) => {
          mutableDetectCalls.push([...datasets]);
          const results = datasets.map((dataset) =>
            Object.freeze({
              symbol: dataset.symbol,
              sourceTimeframe: dataset.sourceTimeframe,
              closedCandlesCount: dataset.candles.length,
              ignoredOpenCandlesCount: 0,
              pivotSeeds: Object.freeze([]),
              candidates: Object.freeze([]),
              rejectedClusters: Object.freeze([]),
            }),
          );
          return Object.freeze({
            symbol: datasets[0]!.symbol,
            requestedTimeframes: Object.freeze(
              results.map((item) => item.sourceTimeframe),
            ),
            timeframes: Object.freeze(results),
            candidates: Object.freeze([]),
            observationalOnly: true,
            createsSetup: false,
            mergesAcrossTimeframes: false,
          });
        },
      },
    );

    assert.deepEqual(requests, [
      'BTCUSDT:1m',
      'BTCUSDT:5m',
      'ETHUSDT:1m',
      'ETHUSDT:5m',
    ]);
    assert.equal(mutableDetectCalls.length, 2);
    assert.deepEqual(
      mutableDetectCalls[0]?.map(
        (dataset) => dataset.sourceTimeframe,
      ),
      ['1m', '5m'],
    );
    assert.equal(report.totals.symbolCount, 2);
    assert.equal(report.totals.timeframeDatasetCount, 4);
    assert.equal(report.mergesAcrossTimeframes, false);
    assert.equal(report.usesQualityScore, false);
    assert.deepEqual(
      report.totals.reviewStateCounts,
      {
        active: 0,
        broken: 0,
        stale: 0,
        pending: 0,
      },
    );
  },
);

test(
  'returns frozen defensive validation structures',
  async () => {
    const report = await validateLevelEngineRealData(
      {
        binanceBaseUrl: 'https://fapi.binance.com',
        requestTimeoutMs: 1_000,
        requestDelayMs: 0,
        symbols: ['BTCUSDT'],
        timeframes: ['1m'],
        candlesPerTimeframe: 50,
        reviewLimitPerSymbol: 20,
      },
      {
        now: () => new Date('2026-01-02T00:00:00.000Z'),
        fetchCandles: async () => Object.freeze([candle(0)]),
        detectCandidates: (datasets) => Object.freeze({
          symbol: datasets[0]!.symbol,
          requestedTimeframes: Object.freeze(['1m'] as const),
          timeframes: Object.freeze([
            Object.freeze({
              symbol: datasets[0]!.symbol,
              sourceTimeframe: '1m',
              closedCandlesCount: 1,
              ignoredOpenCandlesCount: 0,
              pivotSeeds: Object.freeze([]),
              candidates: Object.freeze([]),
              rejectedClusters: Object.freeze([]),
            }),
          ]),
          candidates: Object.freeze([]),
          observationalOnly: true,
          createsSetup: false,
          mergesAcrossTimeframes: false,
        }),
      },
    );

    assert.equal(Object.isFrozen(report), true);
    assert.equal(Object.isFrozen(report.symbolReports), true);
    assert.equal(Object.isFrozen(report.symbolReports[0]), true);
    assert.equal(
      Object.isFrozen(report.symbolReports[0]?.datasets[0]?.candles),
      true,
    );
  },
);

test(
  'marks a support level broken after two closes below its zone',
  () => {
    const level = candidate(
      'support-two-close-break',
      '1m',
      'confirmed',
      2,
      '2026-01-01T00:02:59.999Z',
    );
    const candles = [
      candle(0),
      candle(1),
      candle(2),
      pricedCandle(3, {
        open: 100,
        high: 100.1,
        low: 99.1,
        close: 99.3,
      }),
      pricedCandle(4, {
        open: 99.3,
        high: 99.4,
        low: 99,
        close: 99.2,
      }),
    ];

    const diagnostic = diagnoseLevelCandidateForReview(
      {
        symbol: 'BTCUSDT',
        sourceTimeframe: '1m',
        candles,
      },
      level,
    );

    assert.equal(diagnostic.state, 'broken');
    assert.equal(
      diagnostic.breakEvidence?.mode,
      'consecutive_closes',
    );
    assert.equal(
      diagnostic.breakEvidence?.candleIndex,
      4,
    );
  },
);

test(
  'marks a decisive full-body break without waiting for a second close',
  () => {
    const level = candidate(
      'support-decisive-break',
      '1m',
      'confirmed',
      2,
      '2026-01-01T00:13:59.999Z',
    );
    const candles = Array.from(
      { length: 14 },
      (_, index) => candle(index),
    );
    candles.push(pricedCandle(14, {
      open: 98.2,
      high: 98.3,
      low: 97.8,
      close: 98,
    }));

    const diagnostic = diagnoseLevelCandidateForReview(
      {
        symbol: 'BTCUSDT',
        sourceTimeframe: '1m',
        candles,
      },
      level,
    );

    assert.equal(diagnostic.state, 'broken');
    assert.equal(
      diagnostic.breakEvidence?.mode,
      'decisive_body_break',
    );
    assert.equal(
      diagnostic.breakEvidence?.candleIndex,
      14,
    );
  },
);

test(
  'marks an unbroken distant level stale after a long absence',
  () => {
    const level = candidate(
      'support-stale',
      '1m',
      'confirmed',
      2,
      '2026-01-01T00:02:59.999Z',
    );
    const candles = [
      candle(0),
      candle(1),
      candle(2),
      ...Array.from(
        { length: 130 },
        (_, offset) => pricedCandle(offset + 3, {
          open: 110,
          high: 111,
          low: 109,
          close: 110,
        }),
      ),
    ];

    const diagnostic = diagnoseLevelCandidateForReview(
      {
        symbol: 'BTCUSDT',
        sourceTimeframe: '1m',
        candles,
      },
      level,
    );

    assert.equal(diagnostic.state, 'stale');
    assert.equal(
      diagnostic.barsSinceLastInteraction,
      130,
    );
    assert.ok(
      (diagnostic.distanceFromZoneAtr ?? 0) >= 3,
    );
  },
);

test(
  'keeps a newly detected level pending without enough future candles',
  () => {
    const level = candidate(
      'support-pending',
      '1m',
      'confirmed',
      2,
      '2026-01-01T00:02:59.999Z',
    );

    const diagnostic = diagnoseLevelCandidateForReview(
      {
        symbol: 'BTCUSDT',
        sourceTimeframe: '1m',
        candles: [
          candle(0),
          candle(1),
          candle(2),
          candle(3),
        ],
      },
      level,
    );

    assert.equal(diagnostic.state, 'pending');
    assert.equal(diagnostic.futureClosedCandlesCount, 1);
    assert.equal(diagnostic.breakEvidence, null);
  },
);

test(
  'generates a self-contained visual Level Review document',
  async () => {
    const level = candidate(
      'html-review-level',
      '1m',
      'confirmed',
      2,
      '2026-01-01T00:06:59.999Z',
    );
    const candles = Object.freeze(
      Array.from({ length: 20 }, (_, index) => candle(index)),
    );
    const report = await validateLevelEngineRealData(
      {
        binanceBaseUrl: 'https://fapi.binance.com',
        requestTimeoutMs: 1_000,
        requestDelayMs: 0,
        symbols: ['BTCUSDT'],
        timeframes: ['1m'],
        candlesPerTimeframe: 20,
        reviewLimitPerSymbol: 20,
      },
      {
        now: () => new Date('2026-01-02T00:00:00.000Z'),
        fetchCandles: async () => candles,
        detectCandidates: () => detection([
          timeframeResult('1m', [level]),
        ]),
      },
    );

    const html = buildLevelEngineRealDataReviewHtml(report);

    assert.match(html, /NEXUS · Level Review/);
    assert.match(html, /html-review-level/);
    assert.match(html, /single_candle_false_level/);
    assert.match(html, /level-engine-review-diagnostics-v0\.1/);
    assert.doesNotMatch(html, /qualityScore/);
  },
);

