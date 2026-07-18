import assert from 'node:assert/strict';
import { get } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';
import { createCandles, marketSymbols } from '../src/modules/api-contract/fixtures.js';
import type { MarketDataProvider } from '../src/modules/market-data/market-data.provider.js';
import { BinanceWebSocketMarketDataService } from '../src/modules/realtime-market-data/binance-websocket.service.js';
import type {
  RealtimeMarketDataListener,
  RealtimeMarketDataService,
  RealtimeSocketEvent,
  RealtimeSymbolSnapshot,
  RealtimeWebSocket,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';

class FakeSocket implements RealtimeWebSocket {
  private readonly listeners = new Map<string, Array<(event: RealtimeSocketEvent) => void>>();
  closeCalls: Array<{ code?: number; reason?: string }> = [];

  addEventListener(
    type: 'open' | 'message' | 'error' | 'close',
    listener: (event: RealtimeSocketEvent) => void,
  ): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({
      ...(code === undefined ? {} : { code }),
      ...(reason === undefined ? {} : { reason }),
    });
  }

  emit(type: 'open' | 'message' | 'error' | 'close', event: RealtimeSocketEvent = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

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

test('Binance WebSocket service adds and removes dynamic symbols with reference counting', () => {
  const sockets: FakeSocket[] = [];
  const urls: string[] = [];

  const service = new BinanceWebSocketMarketDataService({
    baseUrl: 'wss://data-stream.binance.vision',
    symbols: ['BTCUSDT'],
    reconnectBaseDelayMs: 1_000,
    reconnectMaxDelayMs: 30_000,
    tradesBufferSize: 10,
    socketFactory(url) {
      urls.push(url);
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    now: () => new Date('2026-07-18T18:30:00.000Z'),
  });

  service.start();
  sockets[0]?.emit('open');
  assert.deepEqual(service.getStatus().subscribedSymbols, ['BTCUSDT']);

  const releaseFirst = service.acquireSymbol('injusdt');
  assert.equal(sockets.length, 2);
  assert.ok((urls[1] ?? '').includes('injusdt@trade/injusdt@bookTicker'));
  assert.equal(sockets[0]?.closeCalls[0]?.reason, 'NEXUS subscriptions changed');
  assert.deepEqual(service.getStatus().subscribedSymbols, ['BTCUSDT', 'INJUSDT']);
  assert.equal(service.getStatus().streamCount, 4);
  assert.equal(service.getSnapshots('INJUSDT')[0]?.symbol, 'INJUSDT');

  const releaseSecond = service.acquireSymbol('INJUSDT');
  releaseFirst();
  assert.equal(sockets.length, 2);
  assert.ok(service.getSnapshots('INJUSDT')[0]);

  releaseSecond();
  assert.equal(sockets.length, 3);
  assert.deepEqual(service.getStatus().subscribedSymbols, ['BTCUSDT']);
  assert.equal(service.getSnapshots('INJUSDT').length, 0);

  service.stop();
});

class DynamicRouteRealtimeService implements RealtimeMarketDataService {
  private readonly snapshots = new Map<string, RealtimeSymbolSnapshot>();
  private readonly references = new Map<string, number>();
  private readonly listeners = new Set<RealtimeMarketDataListener>();

  constructor() {
    this.snapshots.set('BTCUSDT', this.createSnapshot('BTCUSDT'));
  }

  start(): void {}

  stop(): void {
    this.listeners.clear();
  }

  getStatus() {
    return {
      state: 'connected' as const,
      connectedAt: '2026-07-18T18:30:00.000Z',
      disconnectedAt: null,
      lastMessageAt: null,
      reconnectAttempts: 0,
      subscribedSymbols: [...this.snapshots.keys()],
      streamCount: this.snapshots.size * 2,
      lastError: null,
    };
  }

  getSnapshots(symbol?: string): RealtimeSymbolSnapshot[] {
    if (symbol) {
      const snapshot = this.snapshots.get(symbol);
      return snapshot ? [{ ...snapshot, recentTrades: [...snapshot.recentTrades] }] : [];
    }
    return [...this.snapshots.values()].map((snapshot) => ({
      ...snapshot,
      recentTrades: [...snapshot.recentTrades],
    }));
  }

  acquireSymbol(symbol: string): () => void {
    const references = this.references.get(symbol) ?? 0;
    this.references.set(symbol, references + 1);
    if (!this.snapshots.has(symbol)) this.snapshots.set(symbol, this.createSnapshot(symbol));

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const current = this.references.get(symbol) ?? 0;
      if (current > 1) {
        this.references.set(symbol, current - 1);
        return;
      }
      this.references.delete(symbol);
      if (symbol !== 'BTCUSDT') this.snapshots.delete(symbol);
    };
  }

  subscribe(listener: RealtimeMarketDataListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  hasSymbol(symbol: string): boolean {
    return this.snapshots.has(symbol);
  }

  private createSnapshot(symbol: string): RealtimeSymbolSnapshot {
    return {
      symbol,
      lastTrade: null,
      bookTicker: null,
      recentTrades: [],
      updatedAt: null,
    };
  }
}

test('Realtime SSE route dynamically acquires and releases a requested Scanner symbol', async (t) => {
  const realtimeService = new DynamicRouteRealtimeService();
  const app = await buildApp({
    env: testEnv,
    marketDataProvider: fixtureProvider,
    realtimeMarketDataService: realtimeService,
  });

  await app.listen({ host: '127.0.0.1', port: 0 });
  t.after(async () => app.close());

  const address = app.server.address() as AddressInfo;
  let acquiredWhileConnected = false;

  const body = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Timed out waiting for dynamic SSE snapshot'));
    }, 2_000);

    const request = get({
      host: '127.0.0.1',
      port: address.port,
      path: '/api/v1/market/realtime/stream?symbol=INJUSDT',
      headers: { accept: 'text/event-stream' },
    }, (response) => {
      let payload = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        payload += chunk;
        if (
          !settled
          && payload.includes('event: snapshot')
          && payload.includes('"symbol":"INJUSDT"')
        ) {
          settled = true;
          acquiredWhileConnected = realtimeService.hasSymbol('INJUSDT');
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

  assert.match(body, /"symbol":"INJUSDT"/);
  assert.equal(acquiredWhileConnected, true);

  await new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + 1_000;
    const checkReleased = () => {
      if (!realtimeService.hasSymbol('INJUSDT')) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error('Dynamic symbol was not released after SSE disconnect'));
        return;
      }
      setTimeout(checkReleased, 10);
    };
    checkReleased();
  });

  assert.equal(realtimeService.hasSymbol('INJUSDT'), false);
});
