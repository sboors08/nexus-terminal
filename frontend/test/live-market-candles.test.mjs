import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLiveMarketCandleStreamUrl,
  LiveMarketCandleStore,
  mergeLiveMarketCandle,
  parseLiveMarketCandle,
} from '../node_modules/.tmp/realtime-test/charts/api/liveMarketCandles.js';

class FakeEventSource {
  constructor(
    url,
  ) {
    this.url =
      url;

    this.readyState =
      0;

    this.closed =
      false;

    this.listeners =
      new Map();
  }

  addEventListener(
    type,
    listener,
  ) {
    const listeners =
      this.listeners.get(
        type,
      )
      ?? new Set();

    listeners.add(
      listener,
    );

    this.listeners.set(
      type,
      listeners,
    );
  }

  removeEventListener(
    type,
    listener,
  ) {
    this.listeners
      .get(
        type,
      )
      ?.delete(
        listener,
      );
  }

  close() {
    this.closed =
      true;

    this.readyState =
      2;
  }

  emit(
    type,
    data,
  ) {
    const event =
      data === undefined
        ? {
            type,
          }
        : {
            type,
            data:
              JSON.stringify(
                data,
              ),
          };

    for (
      const listener
      of this.listeners.get(
        type,
      )
      ?? []
    ) {
      listener(
        event,
      );
    }
  }
}

function createLiveCandle(
  overrides = {},
) {
  return {
    symbol:
      'BTCUSDT',
    timeframe:
      '5m',
    openTime:
      '2026-07-27T12:00:00.000Z',
    closeTime:
      '2026-07-27T12:04:59.999Z',
    open:
      100,
    high:
      105,
    low:
      99,
    close:
      104,
    volume:
      25,
    quoteVolume:
      2_550,
    tradesCount:
      150,
    isClosed:
      false,
    updatedAt:
      '2026-07-27T12:03:20.000Z',
    ...overrides,
  };
}

test(
  'builds a candle-only SSE URL',
  () => {
    assert.equal(
      buildLiveMarketCandleStreamUrl({
        baseUrl:
          'http://127.0.0.1:4100/',
        symbol:
          ' btcusdt ',
        timeframe:
          '5m',
      }),
      'http://127.0.0.1:4100'
      + '/api/v1/market/realtime/stream'
      + '?candleSymbol=BTCUSDT'
      + '&candleTimeframe=5m'
      + '&candleOnly=true',
    );
  },
);

test(
  'parses and merges a live market candle',
  () => {
    const candle =
      parseLiveMarketCandle(
        createLiveCandle(),
      );

    assert.equal(
      candle.symbol,
      'BTCUSDT',
    );

    assert.equal(
      candle.timeframe,
      '5m',
    );

    const merged =
      mergeLiveMarketCandle(
        [
          {
            openTime:
              candle.openTime,
            closeTime:
              candle.closeTime,
            open:
              100,
            high:
              102,
            low:
              99,
            close:
              101,
            volume:
              10,
            tradesCount:
              50,
          },
        ],
        candle,
      );

    assert.equal(
      merged.length,
      1,
    );

    assert.equal(
      merged[0]?.close,
      104,
    );

    assert.equal(
      merged[0]?.volume,
      25,
    );

    assert.throws(
      () =>
        parseLiveMarketCandle({
          ...createLiveCandle(),
          volume:
            null,
        }),
      /volume/u,
    );
  },
);

test(
  'shares one EventSource for matching candle subscriptions',
  () => {
    const sources =
      [];

    const store =
      new LiveMarketCandleStore({
        eventSourceFactory:
          (url) => {
            const source =
              new FakeEventSource(
                url,
              );

            sources.push(
              source,
            );

            return source;
          },
      });

    const firstStates =
      [];

    const secondStates =
      [];

    const unsubscribeFirst =
      store.subscribe(
        {
          symbol:
            'BTCUSDT',
          timeframe:
            '5m',
        },
        (state) => {
          firstStates.push(
            state,
          );
        },
      );

    const unsubscribeSecond =
      store.subscribe(
        {
          symbol:
            'BTCUSDT',
          timeframe:
            '5m',
        },
        (state) => {
          secondStates.push(
            state,
          );
        },
      );

    assert.equal(
      sources.length,
      1,
    );

    assert.equal(
      store.getConnectionCount(),
      1,
    );

    const source =
      sources[0];

    source.emit(
      'open',
    );

    source.emit(
      'candle',
      createLiveCandle(),
    );

    assert.equal(
      firstStates.at(-1)
        ?.candle
        ?.close,
      104,
    );

    assert.equal(
      secondStates.at(-1)
        ?.candle
        ?.close,
      104,
    );

    unsubscribeFirst();

    assert.equal(
      source.closed,
      false,
    );

    assert.equal(
      store.getConnectionCount(),
      1,
    );

    unsubscribeSecond();

    assert.equal(
      source.closed,
      true,
    );

    assert.equal(
      store.getConnectionCount(),
      0,
    );
  },
);

test(
  'ignores stale live candle updates',
  () => {
    let source =
      null;

    const store =
      new LiveMarketCandleStore({
        eventSourceFactory:
          (url) => {
            source =
              new FakeEventSource(
                url,
              );

            return source;
          },
      });

    const states =
      [];

    const unsubscribe =
      store.subscribe(
        {
          symbol:
            'BTCUSDT',
          timeframe:
            '5m',
        },
        (state) => {
          states.push(
            state,
          );
        },
      );

    source.emit(
      'candle',
      createLiveCandle({
        close:
          105,
        updatedAt:
          '2026-07-27T12:03:30.000Z',
      }),
    );

    source.emit(
      'candle',
      createLiveCandle({
        close:
          90,
        updatedAt:
          '2026-07-27T12:03:10.000Z',
      }),
    );

    assert.equal(
      states.at(-1)
        ?.candle
        ?.close,
      105,
    );

    unsubscribe();
  },
);
