import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  BinanceSymbolUniverseChangeListener,
  BinanceSymbolUniverseRuntimeSnapshot,
} from '../src/modules/realtime-market-data/binance-symbol-universe.service.js';
import type {
  MarketWideSymbolChange,
} from '../src/modules/realtime-market-data/market-wide-one-minute-metrics.js';
import {
  MarketWideRuntimeCoordinator,
  type MarketWideRealtimeTarget,
  type MarketWideSymbolUniverseSource,
} from '../src/modules/realtime-market-data/market-wide-runtime-coordinator.js';

function createSnapshot(
  symbols:
    Array<{
      symbol: string;
      status:
        | 'active'
        | 'collecting';
    }>,
): BinanceSymbolUniverseRuntimeSnapshot {
  const updatedAt =
    '2026-07-21T12:00:00.000Z';

  return {
    entries:
      symbols.map(
        (item) => ({
          symbol: item.symbol,
          baseAsset:
            item.symbol.replace(
              /USDT$/,
              '',
            ),
          quoteAsset: 'USDT',
          status: item.status,
          firstSeenAt: updatedAt,
          lastSeenAt: updatedAt,
        }),
      ),
    activeSymbols:
      symbols
        .filter(
          (item) =>
            item.status === 'active',
        )
        .map(
          (item) => item.symbol,
        ),
    collectingSymbols:
      symbols
        .filter(
          (item) =>
            item.status === 'collecting',
        )
        .map(
          (item) => item.symbol,
        ),
    addedSymbols: [],
    removedSymbols: [],
    updatedAt,
    serviceState: 'ready',
    initialized: true,
    refreshCount: 1,
    lastSuccessfulRefreshAt:
      updatedAt,
    lastError: null,
  };
}

class TestSymbolUniverse
implements MarketWideSymbolUniverseSource {
  startCount = 0;
  stopCount = 0;

  private listener:
    BinanceSymbolUniverseChangeListener
    | null = null;

  constructor(
    private snapshot:
      BinanceSymbolUniverseRuntimeSnapshot,
  ) {}

  async start():
  Promise<
    BinanceSymbolUniverseRuntimeSnapshot
  > {
    this.startCount += 1;

    return this.snapshot;
  }

  stop(): void {
    this.stopCount += 1;
  }

  subscribe(
    listener:
      BinanceSymbolUniverseChangeListener,
  ): () => void {
    this.listener = listener;

    return () => {
      if (this.listener === listener) {
        this.listener = null;
      }
    };
  }

  emit(
    snapshot:
      BinanceSymbolUniverseRuntimeSnapshot,
  ): void {
    this.snapshot = snapshot;

    this.listener?.({
      addedSymbols:
        [...snapshot.addedSymbols],
      removedSymbols:
        [...snapshot.removedSymbols],
      snapshot,
    });
  }

  hasListener(): boolean {
    return this.listener !== null;
  }
}

class TestMarketWideRealtime
implements MarketWideRealtimeTarget {
  startCount = 0;
  stopCount = 0;

  readonly replacements:
    string[][] = [];

  private symbols:
    string[] = [];

  start(): void {
    this.startCount += 1;
  }

  stop(): void {
    this.stopCount += 1;
  }

  replaceSymbols(
    symbols: readonly string[],
  ): MarketWideSymbolChange {
    const nextSymbols =
      [...new Set(symbols)]
        .sort();

    const previous =
      new Set(this.symbols);

    const next =
      new Set(nextSymbols);

    const addedSymbols =
      nextSymbols.filter(
        (symbol) =>
          !previous.has(symbol),
      );

    const removedSymbols =
      this.symbols.filter(
        (symbol) =>
          !next.has(symbol),
      );

    this.symbols =
      nextSymbols;

    this.replacements.push(
      [...nextSymbols],
    );

    return {
      addedSymbols,
      removedSymbols,
    };
  }

  getSymbols(): string[] {
    return [...this.symbols];
  }
}

test(
  'starts market-wide realtime with active and collecting universe symbols',
  async () => {
    const universe =
      new TestSymbolUniverse(
        createSnapshot([
          {
            symbol: 'BTCUSDT',
            status: 'active',
          },
          {
            symbol: 'NEWUSDT',
            status: 'collecting',
          },
          {
            symbol: 'SOLUSDT',
            status: 'active',
          },
        ]),
      );

    const realtime =
      new TestMarketWideRealtime();

    const coordinator =
      new MarketWideRuntimeCoordinator(
        universe,
        realtime,
      );

    await coordinator.start();

    assert.equal(
      universe.startCount,
      1,
    );

    assert.equal(
      realtime.startCount,
      1,
    );

    assert.deepEqual(
      realtime.getSymbols(),
      [
        'BTCUSDT',
        'NEWUSDT',
        'SOLUSDT',
      ],
    );

    assert.deepEqual(
      coordinator.getStatus(),
      {
        started: true,
        symbolsCount: 3,
      },
    );
  },
);

test(
  'updates market-wide streams when Binance universe changes',
  async () => {
    const universe =
      new TestSymbolUniverse(
        createSnapshot([
          {
            symbol: 'BTCUSDT',
            status: 'active',
          },
          {
            symbol: 'OLDUSDT',
            status: 'active',
          },
        ]),
      );

    const realtime =
      new TestMarketWideRealtime();

    const coordinator =
      new MarketWideRuntimeCoordinator(
        universe,
        realtime,
      );

    await coordinator.start();

    const nextSnapshot =
      createSnapshot([
        {
          symbol: 'BTCUSDT',
          status: 'active',
        },
        {
          symbol: 'NEWUSDT',
          status: 'collecting',
        },
      ]);

    nextSnapshot.addedSymbols =
      ['NEWUSDT'];

    nextSnapshot.removedSymbols =
      ['OLDUSDT'];

    universe.emit(nextSnapshot);

    assert.deepEqual(
      realtime.getSymbols(),
      [
        'BTCUSDT',
        'NEWUSDT',
      ],
    );

    assert.equal(
      realtime.replacements.length,
      2,
    );

    coordinator.stop();

    assert.equal(
      realtime.stopCount,
      1,
    );

    assert.equal(
      universe.stopCount,
      1,
    );

    assert.equal(
      universe.hasListener(),
      false,
    );

    assert.deepEqual(
      coordinator.getStatus(),
      {
        started: false,
        symbolsCount: 2,
      },
    );
  },
);

test(
  'does not start coordinator twice',
  async () => {
    const universe =
      new TestSymbolUniverse(
        createSnapshot([
          {
            symbol: 'BTCUSDT',
            status: 'active',
          },
        ]),
      );

    const realtime =
      new TestMarketWideRealtime();

    const coordinator =
      new MarketWideRuntimeCoordinator(
        universe,
        realtime,
      );

    await Promise.all([
      coordinator.start(),
      coordinator.start(),
    ]);

    await coordinator.start();

    assert.equal(
      universe.startCount,
      1,
    );

    assert.equal(
      realtime.startCount,
      1,
    );
  },
);