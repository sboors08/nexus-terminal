import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRealtimeStreamUrl,
  RealtimeMarketDataClient,
} from '../node_modules/.tmp/realtime-test/realtimeClient.js';

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.closed = false;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  emit(type, data) {
    const event = data === undefined
      ? { type }
      : { type, data: JSON.stringify(data) };
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  emitRaw(type, data) {
    const event = { type, data };
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

test('builds an SSE URL and normalizes the symbol', () => {
  assert.equal(
    buildRealtimeStreamUrl({ baseUrl: 'http://127.0.0.1:4100/', symbol: ' btcusdt ' }),
    'http://127.0.0.1:4100/api/v1/market/realtime/stream?symbol=BTCUSDT',
  );
  assert.equal(
    buildRealtimeStreamUrl(),
    '/api/v1/market/realtime/stream',
  );
  assert.throws(() => buildRealtimeStreamUrl({ symbol: 'btc/usdt' }), /Invalid realtime symbol/);
});

test('receives status and snapshot events and closes cleanly', () => {
  let source = null;
  const client = new RealtimeMarketDataClient({
    symbol: 'BTCUSDT',
    eventSourceFactory: (url) => {
      source = new FakeEventSource(url);
      return source;
    },
  });
  const states = [];
  const unsubscribe = client.subscribe((state) => states.push(state));

  client.connect();
  assert.equal(states.at(-1)?.lifecycleState, 'connecting');
  assert.equal(source?.url, '/api/v1/market/realtime/stream?symbol=BTCUSDT');

  source?.emit('open');
  assert.equal(states.at(-1)?.lifecycleState, 'open');

  source?.emit('status', {
    state: 'connected',
    connectedAt: '2026-07-18T17:00:00.000Z',
    disconnectedAt: null,
    lastMessageAt: '2026-07-18T17:00:01.000Z',
    reconnectAttempts: 0,
    subscribedSymbols: ['BTCUSDT'],
    streamCount: 2,
    lastError: null,
  });
  assert.equal(states.at(-1)?.status?.state, 'connected');

  source?.emit('snapshot', {
    symbol: 'BTCUSDT',
    lastTrade: null,
    bookTicker: null,
    recentTrades: [],
    updatedAt: '2026-07-18T17:00:01.000Z',
  });
  assert.equal(states.at(-1)?.snapshots.BTCUSDT?.symbol, 'BTCUSDT');

  client.close();
  assert.equal(source?.closed, true);
  assert.equal(states.at(-1)?.lifecycleState, 'closed');
  unsubscribe();
});

test('reports reconnecting and malformed payload states', () => {
  let source = null;
  const client = new RealtimeMarketDataClient({
    eventSourceFactory: (url) => {
      source = new FakeEventSource(url);
      return source;
    },
  });

  client.connect();
  source?.emitRaw('snapshot', '{broken json');
  assert.match(client.getState().error?.message ?? '', /Unexpected token|JSON/);

  source.readyState = 0;
  source.emit('error');
  assert.equal(client.getState().lifecycleState, 'reconnecting');
  assert.match(client.getState().error?.message ?? '', /interrupted/);
});
