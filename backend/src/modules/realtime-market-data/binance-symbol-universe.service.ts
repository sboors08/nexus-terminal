import {
  createInitialBinanceSymbolUniverse,
  parseBinanceSpotSymbolUniverse,
  reconcileBinanceSymbolUniverse,
  type BinanceSymbolUniverseSnapshot,
} from './binance-symbol-universe.js';

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type BinanceSymbolUniverseServiceState =
  | 'idle'
  | 'refreshing'
  | 'ready'
  | 'degraded'
  | 'error'
  | 'stopped';

export interface BinanceSymbolUniverseScheduler {
  schedule: (
    callback: () => void,
    delayMs: number,
  ) => unknown;
  cancel: (
    handle: unknown,
  ) => void;
}

export interface BinanceSymbolUniverseServiceOptions {
  baseUrl: string;
  quoteAsset: string;
  refreshIntervalMs: number;
  requestTimeoutMs: number;
  collectingDurationMs: number;
  fetchImpl?: FetchLike;
  scheduler?: BinanceSymbolUniverseScheduler;
  now?: () => Date;
}

export interface BinanceSymbolUniverseRuntimeSnapshot
  extends BinanceSymbolUniverseSnapshot {
  serviceState:
    BinanceSymbolUniverseServiceState;
  initialized: boolean;
  refreshCount: number;
  lastSuccessfulRefreshAt: string | null;
  lastError: string | null;
}

export interface BinanceSymbolUniverseChangeEvent {
  addedSymbols: string[];
  removedSymbols: string[];
  snapshot:
    BinanceSymbolUniverseRuntimeSnapshot;
}

export type BinanceSymbolUniverseChangeListener = (
  event:
    BinanceSymbolUniverseChangeEvent,
) => void;

const defaultScheduler:
BinanceSymbolUniverseScheduler = {
  schedule: (
    callback,
    delayMs,
  ) =>
    setTimeout(
      callback,
      delayMs,
    ),
  cancel: (handle) =>
    clearTimeout(
      handle as
        ReturnType<typeof setTimeout>,
    ),
};

function validateFiniteInteger(
  value: number,
  name: string,
  minimum: number,
): void {
  if (
    !Number.isInteger(value)
    || value < minimum
  ) {
    throw new Error(
      `${name} must be an integer greater than or equal to ${minimum}`,
    );
  }
}

function cloneUniverseSnapshot(
  snapshot:
    BinanceSymbolUniverseSnapshot,
): BinanceSymbolUniverseSnapshot {
  return {
    entries:
      snapshot.entries.map(
        (entry) => ({
          ...entry,
        }),
      ),
    activeSymbols:
      [...snapshot.activeSymbols],
    collectingSymbols:
      [...snapshot.collectingSymbols],
    addedSymbols:
      [...snapshot.addedSymbols],
    removedSymbols:
      [...snapshot.removedSymbols],
    updatedAt:
      snapshot.updatedAt,
  };
}

export class BinanceSymbolUniverseService {
  private readonly baseUrl: string;
  private readonly quoteAsset: string;
  private readonly fetchImpl: FetchLike;
  private readonly scheduler:
    BinanceSymbolUniverseScheduler;
  private readonly now: () => Date;

  private universe:
    BinanceSymbolUniverseSnapshot;

  private state:
    BinanceSymbolUniverseServiceState =
      'idle';

  private initialized = false;
  private running = false;
  private refreshCount = 0;

  private lastSuccessfulRefreshAt:
    string | null = null;

  private lastError:
    string | null = null;

  private refreshHandle:
    unknown = null;

  private refreshPromise:
    Promise<
      BinanceSymbolUniverseRuntimeSnapshot
    > | null = null;

  private readonly listeners =
    new Set<
      BinanceSymbolUniverseChangeListener
    >();

  constructor(
    private readonly options:
      BinanceSymbolUniverseServiceOptions,
  ) {
    validateFiniteInteger(
      options.refreshIntervalMs,
      'refreshIntervalMs',
      1_000,
    );

    validateFiniteInteger(
      options.requestTimeoutMs,
      'requestTimeoutMs',
      250,
    );

    validateFiniteInteger(
      options.collectingDurationMs,
      'collectingDurationMs',
      0,
    );

    const quoteAsset =
      options.quoteAsset
        .trim()
        .toUpperCase();

    if (
      !/^[A-Z0-9]{2,20}$/.test(
        quoteAsset,
      )
    ) {
      throw new Error(
        `Invalid Binance quote asset: ${options.quoteAsset}`,
      );
    }

    this.baseUrl =
      options.baseUrl.replace(
        /\/$/,
        '',
      );

    this.quoteAsset =
      quoteAsset;

    this.fetchImpl =
      options.fetchImpl
      ?? globalThis.fetch;

    this.scheduler =
      options.scheduler
      ?? defaultScheduler;

    this.now =
      options.now
      ?? (() => new Date());

    const createdAt =
      this.now().toISOString();

    this.universe = {
      entries: [],
      activeSymbols: [],
      collectingSymbols: [],
      addedSymbols: [],
      removedSymbols: [],
      updatedAt: createdAt,
    };
  }

  async start():
  Promise<
    BinanceSymbolUniverseRuntimeSnapshot
  > {
    if (this.running) {
      return this.getSnapshot();
    }

    this.running = true;

    try {
      return await this.refresh();
    } catch {
      return this.getSnapshot();
    }
  }

  stop(): void {
    this.running = false;

    if (
      this.refreshHandle !== null
    ) {
      this.scheduler.cancel(
        this.refreshHandle,
      );

      this.refreshHandle = null;
    }

    this.state = 'stopped';
  }

  getSnapshot():
  BinanceSymbolUniverseRuntimeSnapshot {
    const universe =
      cloneUniverseSnapshot(
        this.universe,
      );

    return {
      ...universe,
      serviceState: this.state,
      initialized:
        this.initialized,
      refreshCount:
        this.refreshCount,
      lastSuccessfulRefreshAt:
        this.lastSuccessfulRefreshAt,
      lastError:
        this.lastError,
    };
  }

  subscribe(
    listener:
      BinanceSymbolUniverseChangeListener,
  ): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(
        listener,
      );
    };
  }

  refresh():
  Promise<
    BinanceSymbolUniverseRuntimeSnapshot
  > {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshPromise =
      this.performRefresh()
        .finally(() => {
          this.refreshPromise = null;
          this.scheduleNextRefresh();
        });

    this.refreshPromise =
      refreshPromise;

    return refreshPromise;
  }

  private async performRefresh():
  Promise<
    BinanceSymbolUniverseRuntimeSnapshot
  > {
    this.state = 'refreshing';

    try {
      const payload =
        await this.requestExchangeInfo();

      const symbols =
        parseBinanceSpotSymbolUniverse(
          payload,
          this.quoteAsset,
        );

      const observedAt =
        this.now().toISOString();

      const nextUniverse =
        this.initialized
          ? reconcileBinanceSymbolUniverse(
              this.universe.entries,
              symbols,
              observedAt,
              {
                collectingDurationMs:
                  this.options
                    .collectingDurationMs,
              },
            )
          : createInitialBinanceSymbolUniverse(
              symbols,
              observedAt,
            );

      this.universe =
        nextUniverse;

      this.initialized = true;
      this.refreshCount += 1;

      this.lastSuccessfulRefreshAt =
        observedAt;

      this.lastError = null;
      this.state = 'ready';

      const snapshot =
        this.getSnapshot();

      if (
        nextUniverse.addedSymbols
          .length > 0
        || nextUniverse.removedSymbols
          .length > 0
      ) {
        this.emitChange({
          addedSymbols:
            [
              ...nextUniverse
                .addedSymbols,
            ],
          removedSymbols:
            [
              ...nextUniverse
                .removedSymbols,
            ],
          snapshot,
        });
      }

      return snapshot;
    } catch (error) {
      this.lastError =
        error instanceof Error
          ? error.message
          : 'Unable to refresh Binance symbol universe';

      this.state =
        this.initialized
          ? 'degraded'
          : 'error';

      throw error;
    }
  }

  private scheduleNextRefresh():
  void {
    if (!this.running) {
      return;
    }

    if (
      this.refreshHandle !== null
    ) {
      this.scheduler.cancel(
        this.refreshHandle,
      );
    }

    this.refreshHandle =
      this.scheduler.schedule(
        () => {
          this.refreshHandle = null;

          void this.refresh()
            .catch(() => undefined);
        },
        this.options
          .refreshIntervalMs,
      );
  }

  private emitChange(
    event:
      BinanceSymbolUniverseChangeEvent,
  ): void {
    for (
      const listener
      of this.listeners
    ) {
      listener({
        addedSymbols:
          [...event.addedSymbols],
        removedSymbols:
          [...event.removedSymbols],
        snapshot:
          event.snapshot,
      });
    }
  }

  private async requestExchangeInfo():
  Promise<unknown> {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        this.options
          .requestTimeoutMs,
      );

    try {
      const response =
        await this.fetchImpl(
          `${this.baseUrl}/api/v3/exchangeInfo`,
          {
            headers: {
              accept:
                'application/json',
            },
            signal:
              controller.signal,
          },
        );

      const text =
        await response.text();

      let payload: unknown = null;

      if (text) {
        try {
          payload =
            JSON.parse(text);
        } catch {
          throw new Error(
            'Binance exchangeInfo returned invalid JSON',
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          `Binance exchangeInfo request failed with status ${response.status}`,
        );
      }

      return payload;
    } catch (error) {
      if (
        error instanceof Error
        && error.name
          === 'AbortError'
      ) {
        throw new Error(
          'Binance exchangeInfo request timed out',
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}