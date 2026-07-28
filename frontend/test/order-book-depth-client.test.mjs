import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OrderBookDepthClient,
  buildOrderBookDepthStreamUrl,
} from '../node_modules/.tmp/realtime-test/realtime/orderBookDepthClient.js';

class FakeEventSource {
  readyState = 1;
  listeners =
    new Map();

  addEventListener(
    type,
    listener,
  ) {
    const listeners =
      this.listeners.get(
        type,
      )
      ?? [];

    listeners.push(
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
    const listeners =
      this.listeners.get(
        type,
      )
      ?? [];

    this.listeners.set(
      type,
      listeners.filter(
        (item) =>
          item !== listener,
      ),
    );
  }

  close() {
    this.readyState =
      2;
  }

  emit(
    type,
    data,
  ) {
    const event =
      data === undefined
        ? {}
        : {
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

function snapshot() {
  return {
    symbol:
      'BTCUSDT',
    state:
      'live',
    synchronized:
      true,
    lastUpdateId:
      123,
    bids: [
      {
        price:
          63_760,
        quantity:
          2,
        quoteValue:
          127_520,
      },
    ],
    asks: [
      {
        price:
          63_760.1,
        quantity:
          3,
        quoteValue:
          191_280.3,
      },
    ],
    buckets: {
      bids: [
        {
          side:
            'bid',
          price:
            63_760,
          quantity:
            2,
          quoteValue:
            127_520,
          levelsCount:
            1,
        },
      ],
      asks: [
        {
          side:
            'ask',
          price:
            63_770,
          quantity:
            3,
          quoteValue:
            191_280.3,
          levelsCount:
            1,
        },
      ],
    },
    metrics: {
      symbol:
        'BTCUSDT',
      synchronized:
        true,
      bestBid:
        63_760,
      bestAsk:
        63_760.1,
      midpoint:
        63_760.05,
      spread:
        0.1,
      spreadPct:
        0.0001568,
      depthRangePct:
        0.2,
      bidDepthQuote:
        10_000_000,
      askDepthQuote:
        12_000_000,
      totalDepthQuote:
        22_000_000,
      imbalancePct:
        -9.09,
      updatedAt:
        '2026-07-28T19:08:30.000Z',
    },
    updatedAt:
      '2026-07-28T19:08:30.000Z',
    ageMs:
      10,
    staleAfterMs:
      5_000,
    lastError:
      null,
  };
}

test(
  'builds a configurable Binance order book SSE URL',
  () => {
    assert.equal(
      buildOrderBookDepthStreamUrl({
        baseUrl:
          'http://127.0.0.1:4100/',
        symbol:
          'btcusdt',
        levelsLimit:
          40,
        depthRangePct:
          0.2,
        bucketSize:
          10,
        maxBucketsPerSide:
          20,
      }),
      'http://127.0.0.1:4100/api/v1/market/order-book/stream?symbol=BTCUSDT&levels=40&depthRangePct=0.2&maxBuckets=20&bucketSize=10',
    );
  },
);

test(
  'receives status and snapshot events while keeping defensive copies',
  () => {
    const source =
      new FakeEventSource();

    const client =
      new OrderBookDepthClient({
        symbol:
          'BTCUSDT',
        eventSourceFactory:
          () => source,
      });

    client.connect();
    source.emit(
      'open',
    );

    source.emit(
      'status',
      {
        state:
          'connected',
        connectedAt:
          '2026-07-28T19:08:00.000Z',
        disconnectedAt:
          null,
        lastMessageAt:
          '2026-07-28T19:08:30.000Z',
        reconnectAttempts:
          0,
        subscribedSymbols: [
          'BTCUSDT',
        ],
        streamCount:
          1,
        lastError:
          null,
      },
    );

    source.emit(
      'snapshot',
      snapshot(),
    );

    const first =
      client.getState();

    assert.equal(
      first.lifecycleState,
      'open',
    );

    assert.equal(
      first.status?.state,
      'connected',
    );

    assert.equal(
      first.snapshot
        ?.lastUpdateId,
      123,
    );

    first.snapshot
      ?.bids
      .push({
        price:
          1,
        quantity:
          1,
        quoteValue:
          1,
      });

    assert.equal(
      client.getState()
        .snapshot
        ?.bids.length,
      1,
    );
  },
);

test(
  'retains the last snapshot while EventSource reconnects',
  () => {
    const source =
      new FakeEventSource();

    const client =
      new OrderBookDepthClient({
        symbol:
          'BTCUSDT',
        eventSourceFactory:
          () => source,
      });

    client.connect();

    source.emit(
      'snapshot',
      snapshot(),
    );

    source.readyState =
      0;

    source.emit(
      'error',
    );

    const state =
      client.getState();

    assert.equal(
      state.lifecycleState,
      'reconnecting',
    );

    assert.equal(
      state.snapshot
        ?.lastUpdateId,
      123,
    );

    assert.match(
      state.error?.message
      ?? '',
      /interrupted/u,
    );
  },
);
