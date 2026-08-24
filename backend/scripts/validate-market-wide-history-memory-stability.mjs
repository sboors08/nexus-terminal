import assert from 'node:assert/strict';

import {
  MarketWideHistoryWarmupService,
} from '../src/modules/realtime-market-data/market-wide-history-warmup.service.ts';

import {
  MarketWideOneMinuteMetricsStore,
} from '../src/modules/realtime-market-data/market-wide-one-minute-metrics.ts';

const SYMBOL_COUNT =
  511;

const MINUTES_PER_SYMBOL =
  4_320;

const RETAINED_HEAP_LIMIT_MB =
  1_024;

const PEAK_HEAP_LIMIT_MB =
  1_536;

const MINUTE_MS =
  60_000;

const latestOpenTime =
  Date.parse(
    '2026-08-24T16:00:00.000Z',
  );

const gc =
  globalThis.gc;

if (typeof gc !== 'function') {
  throw new Error(
    'Memory validation requires --expose-gc',
  );
}

const symbols =
  Array.from(
    {
      length:
        SYMBOL_COUNT,
    },
    (
      _,
      index,
    ) =>
      `M${String(
        index,
      ).padStart(
        4,
        '0',
      )}USDT`,
  );

const store =
  new MarketWideOneMinuteMetricsStore(
    symbols,
  );

let peakHeapBytes =
  process.memoryUsage()
    .heapUsed;

function sampleHeap() {
  peakHeapBytes =
    Math.max(
      peakHeapBytes,
      process.memoryUsage()
        .heapUsed,
    );
}

const historySource = {
  async fetchOneMinuteKlines(
    request,
  ) {
    const endOpenTime =
      request.endTime === undefined
        ? latestOpenTime
        : Math.floor(
            request.endTime
            / MINUTE_MS,
          )
          * MINUTE_MS;

    const startOpenTime =
      endOpenTime
      - (
          request.limit - 1
        )
        * MINUTE_MS;

    const updates =
      Array.from(
        {
          length:
            request.limit,
        },
        (
          _,
          offset,
        ) => {
          const openTime =
            startOpenTime
            + offset
              * MINUTE_MS;

          const price =
            100
            + (
                offset
                % 100
              )
              / 10;

          return {
            symbol:
              request.symbol,

            eventTime:
              new Date(
                openTime
                + 59_999,
              ).toISOString(),

            openTime:
              new Date(
                openTime,
              ).toISOString(),

            closeTime:
              new Date(
                openTime
                + 59_999,
              ).toISOString(),

            open:
              price,

            high:
              price + 1,

            low:
              price - 1,

            close:
              price + 0.25,

            volume:
              1_000,

            quoteVolume:
              100_000,

            tradesCount:
              250,

            takerBuyQuoteVolume:
              52_000,

            isClosed:
              true,
          };
        },
      );

    sampleHeap();

    return updates;
  },
};

const target = {
  applyHistoricalKlines(
    updates,
  ) {
    const applied =
      store.applyHistoricalKlines(
        updates,
      );

    sampleHeap();

    return applied;
  },
};

const warmup =
  new MarketWideHistoryWarmupService({
    historySource,
    target,
    minutesPerSymbol:
      MINUTES_PER_SYMBOL,
    requestDelayMs:
      0,
    maxRequestAttempts:
      1,
    retryBaseDelayMs:
      0,
    delay:
      async () => {},
  });

console.log(
  '===== SYNTHETIC FULL-UNIVERSE HISTORY WARMUP =====',
);

console.log(
  `SYMBOLS=${SYMBOL_COUNT}`,
);

console.log(
  `MINUTES_PER_SYMBOL=${MINUTES_PER_SYMBOL}`,
);

console.log(
  `EXPECTED_RETAINED_KLINES=${
    SYMBOL_COUNT
    * MINUTES_PER_SYMBOL
  }`,
);

await warmup.start(
  symbols,
);

const status =
  warmup.getStatus();

assert.equal(
  status.state,
  'completed',
);

assert.equal(
  status.totalSymbols,
  SYMBOL_COUNT,
);

assert.equal(
  status.appliedKlines,
  SYMBOL_COUNT
  * MINUTES_PER_SYMBOL,
);

const sample =
  store.getKlines(
    symbols[0],
    5,
  );

assert.equal(
  sample.length,
  5,
);

for (
  let index = 1;
  index < sample.length;
  index += 1
) {
  const previous =
    sample[index - 1];

  const current =
    sample[index];

  assert.ok(
    previous
    && current,
  );

  assert.equal(
    Date.parse(
      current.openTime,
    )
    - Date.parse(
        previous.openTime,
      ),
    MINUTE_MS,
  );
}

gc();
gc();
gc();

const retainedHeapBytes =
  process.memoryUsage()
    .heapUsed;

const retainedHeapMb =
  retainedHeapBytes
  / 1024
  / 1024;

const peakHeapMb =
  peakHeapBytes
  / 1024
  / 1024;

console.log(
  `APPLIED_KLINES=${status.appliedKlines}`,
);

console.log(
  `RETAINED_HEAP_MB=${retainedHeapMb.toFixed(1)}`,
);

console.log(
  `PEAK_HEAP_MB=${peakHeapMb.toFixed(1)}`,
);

console.log(
  `RETAINED_HEAP_LIMIT_MB=${RETAINED_HEAP_LIMIT_MB}`,
);

console.log(
  `PEAK_HEAP_LIMIT_MB=${PEAK_HEAP_LIMIT_MB}`,
);

if (
  retainedHeapMb
  > RETAINED_HEAP_LIMIT_MB
) {
  throw new Error(
    `Retained heap exceeded ${RETAINED_HEAP_LIMIT_MB} MB`,
  );
}

if (
  peakHeapMb
  > PEAK_HEAP_LIMIT_MB
) {
  throw new Error(
    `Peak heap exceeded ${PEAK_HEAP_LIMIT_MB} MB`,
  );
}

console.log(
  'MARKET_WIDE_HISTORY_MEMORY_STABILITY=PASSED',
);
