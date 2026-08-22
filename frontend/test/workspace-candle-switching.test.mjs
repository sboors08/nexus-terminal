import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  clearMarketCandlesCache,
  getMarketCandlesCacheSize,
  MARKET_CANDLES_CACHE_MAX_ENTRIES,
  MARKET_CANDLES_REQUEST_TIMEOUT_MS,
  MARKET_CANDLES_STALE_AFTER_MS,
  readMarketCandlesCache,
  resolveMarketCandlesFreshness,
  writeMarketCandlesCache,
} from '../node_modules/.tmp/realtime-test/charts/hooks/useMarketCandles.js';

function createCandle(
  index,
) {
  const openTime =
    new Date(
      Date.UTC(
        2026,
        6,
        27,
        12,
        index,
        0,
      ),
    );

  const closeTime =
    new Date(
      openTime.getTime()
      + 59_999,
    );

  return {
    openTime:
      openTime.toISOString(),

    closeTime:
      closeTime.toISOString(),

    open:
      1 + index,

    high:
      2 + index,

    low:
      0.5 + index,

    close:
      1.5 + index,

    volume:
      100 + index,

    tradesCount:
      10 + index,
  };
}

test(
  'stores candles separately for every symbol and timeframe key',
  () => {
    clearMarketCandlesCache();

    writeMarketCandlesCache(
      '/candles?symbol=LAUSDT&timeframe=1m',
      [
        createCandle(
          1,
        ),
      ],
      true,
    );

    writeMarketCandlesCache(
      '/candles?symbol=LAUSDT&timeframe=5m',
      [
        createCandle(
          5,
        ),
      ],
      false,
    );

    const oneMinute =
      readMarketCandlesCache(
        '/candles?symbol=LAUSDT&timeframe=1m',
      );

    const fiveMinutes =
      readMarketCandlesCache(
        '/candles?symbol=LAUSDT&timeframe=5m',
      );

    assert.equal(
      oneMinute?.data[0]?.open,
      2,
    );

    assert.equal(
      oneMinute?.hasMore,
      true,
    );

    assert.equal(
      fiveMinutes?.data[0]?.open,
      6,
    );

    assert.equal(
      fiveMinutes?.hasMore,
      false,
    );
  },
);

test(
  'returns defensive candle array copies from cache',
  () => {
    clearMarketCandlesCache();

    writeMarketCandlesCache(
      'LAUSDT-15m',
      [
        createCandle(
          15,
        ),
      ],
      true,
    );

    const first =
      readMarketCandlesCache(
        'LAUSDT-15m',
      );

    assert.ok(
      first,
    );

    first.data.length =
      0;

    const second =
      readMarketCandlesCache(
        'LAUSDT-15m',
      );

    assert.equal(
      second?.data.length,
      1,
    );
  },
);

test(
  'limits the number of remembered candle datasets',
  () => {
    clearMarketCandlesCache();

    for (
      let index = 0;
      index
        < MARKET_CANDLES_CACHE_MAX_ENTRIES
          + 5;
      index += 1
    ) {
      writeMarketCandlesCache(
        `market-${index}`,
        [
          createCandle(
            index,
          ),
        ],
        true,
      );
    }

    assert.equal(
      getMarketCandlesCacheSize(),
      MARKET_CANDLES_CACHE_MAX_ENTRIES,
    );

    assert.equal(
      readMarketCandlesCache(
        'market-0',
      ),
      null,
    );
  },
);

test(
  'preserves the market update timestamp in cache',
  () => {
    clearMarketCandlesCache();

    const updatedAt =
      '2026-07-28T18:15:00.000Z';

    writeMarketCandlesCache(
      'LAUSDT-1m-timestamp',
      [
        createCandle(
          1,
        ),
      ],
      true,
      updatedAt,
    );

    assert.equal(
      readMarketCandlesCache(
        'LAUSDT-1m-timestamp',
      )?.updatedAt,
      updatedAt,
    );
  },
);

test(
  'uses a finite candle request timeout',
  () => {
    assert.equal(
      MARKET_CANDLES_REQUEST_TIMEOUT_MS,
      15_000,
    );
  },
);

test(
  'does not mutate the current request key during render',
  () => {
    const source =
      fs
        .readFileSync(
          new URL(
            '../src/shared/charts/hooks/useMarketCandles.ts',
            import.meta.url,
          ),
          'utf8',
        )
        .replace(
          /\r\n/g,
          '\n',
        );

    const functionStart =
      source.indexOf(
        'export function useMarketCandles',
      );

    const effectStart =
      source.indexOf(
        '  useEffect(() => {',
        functionStart,
      );

    const keyAssignment =
      source.indexOf(
        '    keyRef.current =\n      key;',
        effectStart,
      );

    assert.ok(
      functionStart >= 0,
    );

    assert.ok(
      effectStart > functionStart,
    );

    assert.ok(
      keyAssignment > effectStart,
    );

    const renderRegion =
      source.slice(
        functionStart,
        effectStart,
      );

    assert.equal(
      renderRegion.includes(
        'keyRef.current =',
      ),
      false,
    );

    assert.match(
      source.slice(
        effectStart,
      ),
      /let active\s*=\s*true;/u,
    );
  },
);

test(
  'starts live candle streaming only after historical candles are ready',
  () => {
    const source =
      fs
        .readFileSync(
          new URL(
            '../src/shared/charts/hooks/useMarketCandles.ts',
            import.meta.url,
          ),
          'utf8',
        )
        .replace(
          /\r\n/g,
          '\n',
        );

    const liveEffectStart =
      source.indexOf(
        '    if (\n      liveSubscriptionKey\n      !== key',
      );

    const historicalFetchStart =
      source.indexOf(
        '    fetchMarketCandles({',
      );

    assert.ok(
      liveEffectStart >= 0,
    );

    assert.ok(
      historicalFetchStart
      > liveEffectStart,
    );

    assert.match(
      source,
      /setLiveSubscriptionKey\(\s*key,\s*\);/u,
    );
  },
);

test(
  'preserves the request error while cached candles remain visible',
  () => {
    const source =
      fs
        .readFileSync(
          new URL(
            '../src/shared/charts/hooks/useMarketCandles.ts',
            import.meta.url,
          ),
          'utf8',
        )
        .replace(
          /\r\n/g,
          '\n',
        );

    const fallbackStart =
      source.indexOf(
        '        if (cached) {',
      );

    const fallbackEnd =
      source.indexOf(
        '          return;',
        fallbackStart,
      );

    assert.ok(
      fallbackStart >= 0,
    );

    assert.ok(
      fallbackEnd > fallbackStart,
    );

    const fallback =
      source.slice(
        fallbackStart,
        fallbackEnd,
      );

    assert.match(
      fallback,
      /error:\s*timedOut/u,
    );

    assert.doesNotMatch(
      fallback,
      /error:\s*null,/u,
    );
  },
);
test(
  'resolves candle freshness from connection and market timestamps',
  () => {
    assert.equal(
      MARKET_CANDLES_STALE_AFTER_MS,
      15_000,
    );

    const live =
      resolveMarketCandlesFreshness({
        hasData:
          true,
        connectionState:
          'open',
        updatedAt:
          '2026-07-28T18:00:00.000Z',
        error:
          null,
        isOnline:
          true,
        now:
          Date.parse(
            '2026-07-28T18:00:05.000Z',
          ),
      });

    assert.equal(
      live.state,
      'live',
    );

    assert.equal(
      live.label,
      'LIVE',
    );

    const stale =
      resolveMarketCandlesFreshness({
        hasData:
          true,
        connectionState:
          'reconnecting',
        updatedAt:
          '2026-07-28T18:00:00.000Z',
        error:
          new Error(
            'Live candle connection interrupted',
          ),
        isOnline:
          true,
        now:
          Date.parse(
            '2026-07-28T18:00:30.000Z',
          ),
      });

    assert.equal(
      stale.state,
      'stale',
    );

    assert.equal(
      stale.errorKind,
      'network',
    );

    const offline =
      resolveMarketCandlesFreshness({
        hasData:
          false,
        connectionState:
          'connecting',
        updatedAt:
          null,
        error:
          null,
        isOnline:
          false,
        now:
          Date.parse(
            '2026-07-28T18:00:30.000Z',
          ),
      });

    assert.equal(
      offline.state,
      'offline',
    );
  },
);

test(
  'connects candle freshness to the runtime hook',
  () => {
    const source =
      fs
        .readFileSync(
          new URL(
            '../src/shared/charts/hooks/useMarketCandles.ts',
            import.meta.url,
          ),
          'utf8',
        )
        .replace(
          /\r\n/g,
          '\n',
        );

    assert.match(
      source,
      /freshness:\s*DataFreshness;/u,
    );

    assert.match(
      source,
      /setLiveFreshnessState/u,
    );

    assert.match(
      source,
      /liveState\s*\.connectionState/u,
    );

    assert.match(
      source,
      /\?\? state\.updatedAt/u,
    );

    assert.doesNotMatch(
      source,
      /latestCandle\?\.closeTime/u,
    );

    assert.match(
      source,
      /isOnline:\s*browserOnline/u,
    );

    assert.match(
      source,
      /error:\s*state\.error,\s*freshness,/u,
    );
  },
);

test(
  'refreshes candle freshness over time and browser connection changes',
  () => {
    const source =
      fs
        .readFileSync(
          new URL(
            '../src/shared/charts/hooks/useMarketCandles.ts',
            import.meta.url,
          ),
          'utf8',
        )
        .replace(
          /\r\n/g,
          '\n',
        );

    assert.match(
      source,
      /setBrowserOnline/u,
    );

    assert.match(
      source,
      /window\.addEventListener\(\s*'online'/u,
    );

    assert.match(
      source,
      /window\.addEventListener\(\s*'offline'/u,
    );

    assert.match(
      source,
      /globalThis\.setInterval/u,
    );

    assert.match(
      source,
      /5_000/u,
    );

    assert.match(
      source,
      /isOnline:\s*browserOnline/u,
    );

    assert.match(
      source,
      /now:\s*freshnessNow/u,
    );

    assert.match(
      source,
      /setLiveFreshnessState\(\{\s*connectionState:\s*'connecting'/u,
    );
  },
);

test(
  'shows Workspace candle freshness without presenting stale prices as live',
  () => {
    const page =
      fs
        .readFileSync(
          new URL(
            '../src/pages/WorkspacePage.tsx',
            import.meta.url,
          ),
          'utf8',
        )
        .replace(
          /\r\n/g,
          '\n',
        );

    const css =
      fs
        .readFileSync(
          new URL(
            '../src/pages/WorkspacePage.module.css',
            import.meta.url,
          ),
          'utf8',
        )
        .replace(
          /\r\n/g,
          '\n',
        );

    assert.equal(
      page.includes(
        'ПОСЛЕДНЯЯ СВЕЧА',
      ),
      false,
    );

    assert.equal(
      page.includes(
        "title:\n            'LAST'",
      ),
      false,
    );

    assert.match(
      page,
      /const chartPriceHeading/u,
    );

    assert.match(
      page,
      /Цена сетапа/u,
    );

    assert.match(
      page,
      /chartPriceLineTitle/u,
    );

    assert.match(
      page,
      /candleFreshness\s*\.lastUpdatedLabel/u,
    );

    assert.match(
      page,
      /candleFreshness\s*\.lastUpdatedAt/u,
    );

    assert.match(
      page,
      /candleFreshness\.state\s*===\s*'stale'/u,
    );

    assert.match(
      page,
      /candleFreshness\.state\s*===\s*'offline'/u,
    );

    assert.match(
      page,
      /styles\.chartFreshnessNotice/u,
    );

    assert.match(
      page,
      /onClick=\{candlesQuery\.retry\}/u,
    );

    assert.match(
      css,
      /\.freshnessBadge_live/u,
    );

    assert.match(
      css,
      /\.freshnessBadge_warning/u,
    );

    assert.match(
      css,
      /\.freshnessBadge_error/u,
    );

    assert.match(
      css,
      /\.chartFreshnessNotice/u,
    );
  },
);
