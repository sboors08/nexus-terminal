import type {
  RealtimeOpenInterest,
  ReconnectScheduler,
} from './realtime-market-data.types.js';

export interface MarketWideOpenInterestReader {
  fetchOpenInterest(
    symbol: string,
  ): Promise<RealtimeOpenInterest>;
}

export interface MarketWideOpenInterestSymbolSource {
  getSymbols(): string[];
}

export interface MarketWideOpenInterestTarget {
  applyOpenInterest(
    value:
      RealtimeOpenInterest,
  ): boolean;
}

export interface MarketWideOpenInterestSweepResult {
  symbolsCount: number;
  successfulRequests: number;
  failedRequests: number;
}

export interface MarketWideOpenInterestPollerOptions {
  reader:
    MarketWideOpenInterestReader;
  symbolSource:
    MarketWideOpenInterestSymbolSource;
  target:
    MarketWideOpenInterestTarget;
  intervalMs: number;
  maxConcurrency: number;
  scheduler?: ReconnectScheduler;
  now?: () => Date;
}

export interface MarketWideOpenInterestPollerStatus {
  started: boolean;
  inFlight: boolean;
  symbolsCount: number;
  successfulRequests: number;
  failedRequests: number;
  lastSweepStartedAt:
    string
    | null;
  lastSweepFinishedAt:
    string
    | null;
  lastError:
    string
    | null;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const defaultScheduler:
ReconnectScheduler = {
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

function validatePositiveInteger(
  value: number,
  name: string,
): void {
  if (
    !Number.isInteger(value)
    || value < 1
  ) {
    throw new Error(
      `${name} must be a positive integer`,
    );
  }
}

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value.trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(
      `Invalid market-wide open interest symbol: ${value}`,
    );
  }

  return symbol;
}

function normalizeSymbols(
  values:
    readonly string[],
): string[] {
  return [
    ...new Set(
      values.map(
        normalizeSymbol,
      ),
    ),
  ].sort();
}

export async function runMarketWideOpenInterestSweep(
  symbols:
    readonly string[],
  reader:
    MarketWideOpenInterestReader,
  target:
    MarketWideOpenInterestTarget,
  maxConcurrency: number,
): Promise<
  MarketWideOpenInterestSweepResult
> {
  validatePositiveInteger(
    maxConcurrency,
    'maxConcurrency',
  );

  const normalizedSymbols =
    normalizeSymbols(
      symbols,
    );

  if (
    normalizedSymbols.length
    === 0
  ) {
    return {
      symbolsCount: 0,
      successfulRequests: 0,
      failedRequests: 0,
    };
  }

  let cursor = 0;
  let successfulRequests = 0;
  let failedRequests = 0;

  const workerCount =
    Math.min(
      maxConcurrency,
      normalizedSymbols.length,
    );

  const worker =
    async (): Promise<void> => {
      while (true) {
        const index =
          cursor;

        cursor += 1;

        const symbol =
          normalizedSymbols[
            index
          ];

        if (!symbol) {
          return;
        }

        try {
          const value =
            await reader
              .fetchOpenInterest(
                symbol,
              );

          if (
            normalizeSymbol(
              value.symbol,
            ) !== symbol
          ) {
            throw new Error(
              'Open interest reader returned a mismatched symbol',
            );
          }

          target
            .applyOpenInterest(
              value,
            );

          successfulRequests +=
            1;
        } catch {
          failedRequests +=
            1;
        }
      }
    };

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      () => worker(),
    ),
  );

  return {
    symbolsCount:
      normalizedSymbols.length,
    successfulRequests,
    failedRequests,
  };
}

export class MarketWideOpenInterestPoller {
  private readonly scheduler:
    ReconnectScheduler;

  private readonly now:
    () => Date;

  private started = false;
  private inFlight = false;
  private generation = 0;

  private scheduleHandle:
    unknown = null;

  private successfulRequests = 0;
  private failedRequests = 0;

  private lastSweepStartedAt:
    string
    | null = null;

  private lastSweepFinishedAt:
    string
    | null = null;

  private lastError:
    string
    | null = null;

  constructor(
    private readonly options:
      MarketWideOpenInterestPollerOptions,
  ) {
    validatePositiveInteger(
      options.intervalMs,
      'intervalMs',
    );

    validatePositiveInteger(
      options.maxConcurrency,
      'maxConcurrency',
    );

    this.scheduler =
      options.scheduler
      ?? defaultScheduler;

    this.now =
      options.now
      ?? (() => new Date());
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.generation += 1;
    this.lastError = null;

    this.scheduleSweep(
      0,
      this.generation,
    );
  }

  stop(): void {
    this.started = false;
    this.generation += 1;

    if (
      this.scheduleHandle
      !== null
    ) {
      this.scheduler.cancel(
        this.scheduleHandle,
      );

      this.scheduleHandle =
        null;
    }
  }

  getStatus():
  MarketWideOpenInterestPollerStatus {
    return {
      started:
        this.started,
      inFlight:
        this.inFlight,
      symbolsCount:
        normalizeSymbols(
          this.options
            .symbolSource
            .getSymbols(),
        ).length,
      successfulRequests:
        this.successfulRequests,
      failedRequests:
        this.failedRequests,
      lastSweepStartedAt:
        this.lastSweepStartedAt,
      lastSweepFinishedAt:
        this.lastSweepFinishedAt,
      lastError:
        this.lastError,
    };
  }

  private scheduleSweep(
    delayMs: number,
    generation: number,
  ): void {
    if (
      !this.started
      || generation
        !== this.generation
    ) {
      return;
    }

    this.scheduleHandle =
      this.scheduler.schedule(
        () => {
          this.scheduleHandle =
            null;

          void this.runSweep(
            generation,
          );
        },
        delayMs,
      );
  }

  private async runSweep(
    generation: number,
  ): Promise<void> {
    if (
      !this.started
      || generation
        !== this.generation
      || this.inFlight
    ) {
      return;
    }

    this.inFlight = true;

    this.lastSweepStartedAt =
      this.now()
        .toISOString();

    this.lastError = null;

    try {
      const result =
        await runMarketWideOpenInterestSweep(
          this.options
            .symbolSource
            .getSymbols(),
          this.options.reader,
          this.options.target,
          this.options
            .maxConcurrency,
        );

      this.successfulRequests +=
        result
          .successfulRequests;

      this.failedRequests +=
        result
          .failedRequests;

      if (
        result.failedRequests > 0
      ) {
        this.lastError =
          `${result.failedRequests} open interest request(s) failed in latest sweep`;
      }
    } catch (error) {
      this.lastError =
        error instanceof Error
          ? error.message
          : 'Market-wide open interest sweep failed';
    } finally {
      this.lastSweepFinishedAt =
        this.now()
          .toISOString();

      this.inFlight = false;

      if (
        this.started
        && generation
          === this.generation
      ) {
        this.scheduleSweep(
          this.options
            .intervalMs,
          generation,
        );
      }
    }
  }
}
