import assert from 'node:assert/strict';
import { get } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';
import { createCandles, marketSymbols } from '../src/modules/api-contract/fixtures.js';
import type { MarketDataProvider } from '../src/modules/market-data/market-data.provider.js';
import type {
  RealtimeMarketDataEvent,
  RealtimeMarketDataListener,
  RealtimeMarketDataService,
  RealtimeSymbolSnapshot,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';

const testEnv: AppEnv = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4100,
  apiPrefix: '/api/v1',
  corsOrigins: ['http://localhost:5173'],
  logLevel: 'silent',
};

const fixtureProvider: MarketDataProvider = {
  getMarketSymbols: async () => marketSymbols,
  getCandles: async (symbol, timeframe) => createCandles(symbol, timeframe),
};

class FakeRealtimeService implements RealtimeMarketDataService {
  private readonly listeners = new Set<{
    listener: RealtimeMarketDataListener;
    symbol?: string;
  }>();

  private readonly snapshot: RealtimeSymbolSnapshot = {
    symbol: 'BTCUSDT',
    lastTrade: {
      id: 'BTCUSDT-1',
      symbol: 'BTCUSDT',
      timestamp: '2026-07-18T16:00:00.000Z',
      price: 64_000,
      quantity: 0.1,
      quoteValue: 6_400,
      side: 'buy',
      isBuyerMaker: false,
    },
    bookTicker: {
      symbol: 'BTCUSDT',
      bidPrice: 63_999,
      bidQuantity: 1,
      askPrice: 64_001,
      askQuantity: 1.5,
      spread: 2,
      spreadPct: 0.003125,
      updatedAt: '2026-07-18T16:00:00.000Z',
    },
    recentTrades: [],
    updatedAt: '2026-07-18T16:00:00.000Z',
  };

  start(): void {}

  stop(): void {
    this.listeners.clear();
  }

  getStatus() {
    return {
      state: 'connected' as const,
      connectedAt: '2026-07-18T16:00:00.000Z',
      disconnectedAt: null,
      lastMessageAt: '2026-07-18T16:00:00.000Z',
      reconnectAttempts: 0,
      subscribedSymbols: ['BTCUSDT'],
      streamCount: 2,
      lastError: null,
    };
  }

  getSnapshots(symbol?: string): RealtimeSymbolSnapshot[] {
    if (symbol && symbol !== 'BTCUSDT') return [];
    return [{ ...this.snapshot, recentTrades: [...this.snapshot.recentTrades] }];
  }

  acquireSymbol(): () => void {
    return () => undefined;
  }

  subscribe(listener: RealtimeMarketDataListener, symbol?: string): () => void {
    const subscription = symbol ? { listener, symbol } : { listener };
    this.listeners.add(subscription);
    return () => this.listeners.delete(subscription);
  }

  emit(event: RealtimeMarketDataEvent): void {
    for (const subscription of this.listeners) {
      if (
        event.type === 'snapshot'
        && subscription.symbol
        && subscription.symbol !== event.snapshot.symbol
      ) {
        continue;
      }
      subscription.listener(event);
    }
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

test('Realtime SSE endpoint sends initial status and symbol snapshot', async (t) => {
  const realtimeService = new FakeRealtimeService();
  const app = await buildApp({
    env: testEnv,
    marketDataProvider: fixtureProvider,
    realtimeMarketDataService: realtimeService,
  });

  await app.listen({ host: '127.0.0.1', port: 0 });
  t.after(async () => app.close());

  const address = app.server.address() as AddressInfo;
  const body = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Timed out waiting for SSE payload'));
    }, 2_000);

    const request = get({
      host: '127.0.0.1',
      port: address.port,
      path: '/api/v1/market/realtime/stream?symbol=BTCUSDT',
      headers: { accept: 'text/event-stream' },
    }, (response) => {
      assert.match(response.headers['content-type'] ?? '', /^text\/event-stream/);
      let payload = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        payload += chunk;
        if (
          !settled
          && payload.includes('event: status')
          && payload.includes('event: snapshot')
          && payload.includes('"symbol":"BTCUSDT"')
        ) {
          settled = true;
          clearTimeout(timeout);
          resolve(payload);
          response.destroy();
        }
      });
    });

    request.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
  });

  assert.match(body, /retry: 3000/);
  assert.match(body, /"state":"connected"/);
  assert.match(body, /"bidPrice":63999/);

  await new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + 1_000;
    const checkCleanup = () => {
      if (realtimeService.listenerCount === 0) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error('SSE subscription was not cleaned up after disconnect'));
        return;
      }
      setTimeout(checkCleanup, 10);
    };
    checkCleanup();
  });
  assert.equal(realtimeService.listenerCount, 0);
});

test('Realtime SSE endpoint rejects an invalid symbol format', async (t) => {
  const app = await buildApp({
    env: testEnv,
    marketDataProvider: fixtureProvider,
    realtimeMarketDataService: new FakeRealtimeService(),
  });
  t.after(async () => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/market/realtime/stream?symbol=BAD!',
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, 'invalid_symbol');
});
