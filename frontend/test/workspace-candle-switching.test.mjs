import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  clearMarketCandlesCache,
  getMarketCandlesCacheSize,
  MARKET_CANDLES_CACHE_MAX_ENTRIES,
  MARKET_CANDLES_REQUEST_TIMEOUT_MS,
  readMarketCandlesCache,
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
