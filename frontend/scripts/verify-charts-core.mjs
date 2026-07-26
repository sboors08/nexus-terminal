import {
  readFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';

const root =
  process.cwd();

const [
  packageSource,
  page,
  client,
  hook,
  mapping,
  component,
  componentCss,
  clientTests,
  mappingTests,
] =
  await Promise.all([
    readFile(
      resolve(
        root,
        'package.json',
      ),
      'utf8',
    ),
    readFile(
      resolve(
        root,
        'src/pages/MarketPage.tsx',
      ),
      'utf8',
    ),
    readFile(
      resolve(
        root,
        'src/shared/charts/api/marketCandles.ts',
      ),
      'utf8',
    ),
    readFile(
      resolve(
        root,
        'src/shared/charts/hooks/useMarketCandles.ts',
      ),
      'utf8',
    ),
    readFile(
      resolve(
        root,
        'src/shared/charts/model/candleMapping.ts',
      ),
      'utf8',
    ),
    readFile(
      resolve(
        root,
        'src/shared/charts/ui/NexusCandlestickChart.tsx',
      ),
      'utf8',
    ),
    readFile(
      resolve(
        root,
        'src/shared/charts/ui/NexusCandlestickChart.module.css',
      ),
      'utf8',
    ),
    readFile(
      resolve(
        root,
        'test/market-candles.test.mjs',
      ),
      'utf8',
    ),
    readFile(
      resolve(
        root,
        'test/candle-mapping.test.mjs',
      ),
      'utf8',
    ),
  ]);

const packageJson =
  JSON.parse(
    packageSource,
  );

const markers = [
  [
    packageJson
      .dependencies
      ?.['lightweight-charts'],
    '^5.2.0',
  ],
  [
    client,
    '/api/v1/market/candles',
  ],
  [
    client,
    'parseMarketCandle',
  ],
  [
    client,
    'Market candles request failed',
  ],
  [
    client,
    "'1d'",
  ],
  [
    hook,
    'fetchMarketCandles',
  ],
  [
    hook,
    'loadOlder',
  ],
  [
    hook,
    'MARKET_CANDLES_PAGE_SIZE',
  ],
  [
    client,
    'mergeMarketCandlePages',
  ],
  [
    mapping,
    'mapCandleChartData',
  ],
  [
    mapping,
    'toUtcTimestamp',
  ],
  [
    mapping,
    'sortAndDeduplicateCandles',
  ],
  [
    component,
    'createChart',
  ],
  [
    component,
    'CandlestickSeries',
  ],
  [
    component,
    'HistogramSeries',
  ],
  [
    component,
    'ResizeObserver',
  ],
  [
    component,
    'attributionLogo:',
  ],
  [
    component,
    'setVisibleLogicalRange',
  ],
  [
    component,
    'subscribeVisibleLogicalRangeChange',
  ],
  [
    component,
    'onLoadOlder',
  ],
  [
    componentCss,
    'height: 462px',
  ],
  [
    page,
    'useMarketCandles({',
  ],
  [
    page,
    '<NexusCandlestickChart',
  ],
  [
    page,
    "'1d'",
  ],
  [
    page,
    'Для выбранного периода нет свечей.',
  ],
  [
    clientTests,
    'fetches and validates market candles',
  ],
  [
    clientTests,
    'request failed: 503',
  ],
  [
    mappingTests,
    'maps candles and volume in chronological order',
  ],
  [
    mappingTests,
    'keeps the latest duplicate candle',
  ],
];

const missing =
  markers
    .filter(
      ([source, marker]) =>
        typeof source
          !== 'string'
        || !source.includes(
          marker,
        ),
    )
    .map(
      ([, marker]) =>
        marker,
    );

const forbiddenMarkers = [
  [
    page,
    'nexusApi.getMarketCandles',
  ],
  [
    page,
    'function MarketChart',
  ],
  [
    page,
    "'24h'",
  ],
];

const forbiddenFound =
  forbiddenMarkers
    .filter(
      ([source, marker]) =>
        source.includes(
          marker,
        ),
    )
    .map(
      ([, marker]) =>
        marker,
    );

if (
  missing.length > 0
  || forbiddenFound.length > 0
) {
  if (missing.length > 0) {
    console.error(
      `Missing Charts Core markers: ${missing.join(', ')}`,
    );
  }

  if (
    forbiddenFound.length
    > 0
  ) {
    console.error(
      `Forbidden legacy Charts markers: ${forbiddenFound.join(', ')}`,
    );
  }

  process.exit(1);
}

console.log(
  'NEXUS frontend verified: Charts Core Foundation + Market Integration v0.1 is present.',
);