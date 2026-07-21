import type {
  BinanceSymbolUniverseChangeListener,
  BinanceSymbolUniverseRuntimeSnapshot,
} from './binance-symbol-universe.service.js';
import type {
  MarketWideSymbolChange,
} from './market-wide-one-minute-metrics.js';

export interface MarketWideSymbolUniverseSource {
  start():
    Promise<
      BinanceSymbolUniverseRuntimeSnapshot
    >;

  stop(): void;

  subscribe(
    listener:
      BinanceSymbolUniverseChangeListener,
  ): () => void;
}

export interface MarketWideRealtimeTarget {
  start(): void;

  stop(): void;

  replaceSymbols(
    symbols: readonly string[],
  ): MarketWideSymbolChange;

  getSymbols(): string[];
}

export interface MarketWideRuntimeCoordinatorStatus {
  started: boolean;
  symbolsCount: number;
}

export class MarketWideRuntimeCoordinator {
  private started = false;

  private startPromise:
    Promise<void>
    | null = null;

  private unsubscribeUniverse:
    (() => void)
    | null = null;

  constructor(
    private readonly symbolUniverse:
      MarketWideSymbolUniverseSource,
    private readonly marketWideRealtime:
      MarketWideRealtimeTarget,
  ) {}

  start(): Promise<void> {
    if (this.started) {
      return Promise.resolve();
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    const promise =
      this.performStart()
        .finally(() => {
          this.startPromise = null;
        });

    this.startPromise = promise;

    return promise;
  }

  stop(): void {
    this.unsubscribeUniverse?.();
    this.unsubscribeUniverse = null;

    this.marketWideRealtime.stop();
    this.symbolUniverse.stop();

    this.started = false;
  }

  getStatus():
  MarketWideRuntimeCoordinatorStatus {
    return {
      started: this.started,
      symbolsCount:
        this.marketWideRealtime
          .getSymbols()
          .length,
    };
  }

  private async performStart():
  Promise<void> {
    this.unsubscribeUniverse =
      this.symbolUniverse.subscribe(
        (event) => {
          this.syncSnapshot(
            event.snapshot,
          );
        },
      );

    try {
      const snapshot =
        await this.symbolUniverse.start();

      this.syncSnapshot(snapshot);
      this.marketWideRealtime.start();

      this.started = true;
    } catch (error) {
      this.unsubscribeUniverse?.();
      this.unsubscribeUniverse = null;

      this.marketWideRealtime.stop();
      this.started = false;

      throw error;
    }
  }

  private syncSnapshot(
    snapshot:
      BinanceSymbolUniverseRuntimeSnapshot,
  ): MarketWideSymbolChange {
    const symbols =
      snapshot.entries.map(
        (entry) => entry.symbol,
      );

    return this.marketWideRealtime
      .replaceSymbols(symbols);
  }
}