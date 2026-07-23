import type {
  BinanceOneMinuteHistoryRequest,
} from './binance-market-history.client.js';
import type {
  BinanceOneMinuteKlineUpdate,
} from './market-wide-one-minute-metrics.js';

export interface MarketWideHistorySource {
  fetchOneMinuteKlines(
    request:
      BinanceOneMinuteHistoryRequest,
  ): Promise<
    BinanceOneMinuteKlineUpdate[]
  >;
}

export interface MarketWideHistoryTarget {
  applyHistoricalKlines(
    updates:
      readonly BinanceOneMinuteKlineUpdate[],
  ): number;
}

export type MarketWideHistoryWarmupState =
  | 'idle'
  | 'running'
  | 'completed'
  | 'stopped';

export interface MarketWideHistoryWarmupStatus {
  state:
    MarketWideHistoryWarmupState;
  totalSymbols: number;
  processedSymbols: number;
  successfulSymbols: number;
  failedSymbols: number;
  appliedKlines: number;
  currentSymbol: string | null;
  lastError: string | null;
  currentStageIndex: number;
  totalStages: number;
  completedStages: number;
  currentStageTargetMinutes:
    number | null;
}

export interface MarketWideHistoryWarmupOptions {
  historySource:
    MarketWideHistorySource;
  target:
    MarketWideHistoryTarget;
  minutesPerSymbol: number;
  requestDelayMs: number;
  delay?: (
    delayMs: number,
  ) => Promise<void>;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const MAX_KLINES_PER_REQUEST =
  1_500;

const MAX_HISTORY_DEPTH_MINUTES =
  3 * 24 * 60;

const DEFAULT_STAGE_TARGETS_MINUTES =
  [
    60,
    4 * 60,
    12 * 60,
    24 * 60,
    3 * 24 * 60,
  ] as const;

function validateInteger(
  value: number,
  name: string,
  minimum: number,
  maximum?: number,
): void {
  if (
    !Number.isInteger(value)
    || value < minimum
    || (
      maximum !== undefined
      && value > maximum
    )
  ) {
    const maximumLabel =
      maximum === undefined
        ? ''
        : ` and at most ${maximum}`;

    throw new Error(
      `${name} must be an integer greater than or equal to ${minimum}${maximumLabel}`,
    );
  }
}

function normalizeSymbols(
  values:
    readonly string[],
): string[] {
  const symbols =
    values.map((value) => {
      const symbol =
        value.trim().toUpperCase();

      if (!SYMBOL_PATTERN.test(symbol)) {
        throw new Error(
          `Invalid market-wide warm-up symbol: ${value}`,
        );
      }

      return symbol;
    });

  return [
    ...new Set(symbols),
  ].sort();
}

function buildStageTargets(
  finalTargetMinutes: number,
): number[] {
  const targets =
    DEFAULT_STAGE_TARGETS_MINUTES
      .filter(
        (target) =>
          target
          <= finalTargetMinutes,
      );

  if (
    !targets.includes(
      finalTargetMinutes as
        typeof DEFAULT_STAGE_TARGETS_MINUTES[number],
    )
  ) {
    targets.push(
      finalTargetMinutes,
    );
  }

  return [
    ...new Set(targets),
  ].sort(
    (
      first,
      second,
    ) =>
      first - second,
  );
}

function readOpenTime(
  update:
    BinanceOneMinuteKlineUpdate,
): number | null {
  const value =
    Date.parse(
      update.openTime,
    );

  return Number.isFinite(value)
    ? value
    : null;
}

async function defaultDelay(
  delayMs: number,
): Promise<void> {
  await new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        delayMs,
      );
    },
  );
}

export class MarketWideHistoryWarmupService {
  private state:
    MarketWideHistoryWarmupState =
      'idle';

  private totalSymbols = 0;

  private processedSymbols = 0;

  private successfulSymbols = 0;

  private failedSymbols = 0;

  private appliedKlines = 0;

  private currentSymbol:
    string | null = null;

  private lastError:
    string | null = null;

  private currentStageIndex = 0;

  private completedStages = 0;

  private currentStageTargetMinutes:
    number | null = null;

  private generation = 0;

  private startPromise:
    Promise<void>
    | null = null;

  private readonly delay:
    (
      delayMs: number,
    ) => Promise<void>;

  private readonly stageTargets:
    number[];

  private readonly requestedMinutes =
    new Map<
      string,
      number
    >();

  private readonly earliestOpenTimes =
    new Map<
      string,
      number
    >();

  private readonly exhaustedSymbols =
    new Set<string>();

  constructor(
    private readonly options:
      MarketWideHistoryWarmupOptions,
  ) {
    validateInteger(
      options.minutesPerSymbol,
      'minutesPerSymbol',
      1,
      MAX_HISTORY_DEPTH_MINUTES,
    );

    validateInteger(
      options.requestDelayMs,
      'requestDelayMs',
      0,
    );

    this.delay =
      options.delay
      ?? defaultDelay;

    this.stageTargets =
      buildStageTargets(
        options.minutesPerSymbol,
      );
  }

  start(
    symbols:
      readonly string[],
  ): Promise<void> {
    if (this.startPromise) {
      return this.startPromise;
    }

    const normalizedSymbols =
      normalizeSymbols(symbols);

    this.generation += 1;

    const generation =
      this.generation;

    this.totalSymbols =
      normalizedSymbols.length;

    this.processedSymbols = 0;
    this.successfulSymbols = 0;
    this.failedSymbols = 0;
    this.appliedKlines = 0;
    this.currentSymbol = null;
    this.lastError = null;
    this.currentStageIndex = 0;
    this.completedStages = 0;
    this.currentStageTargetMinutes =
      null;

    this.requestedMinutes.clear();
    this.earliestOpenTimes.clear();
    this.exhaustedSymbols.clear();

    if (
      normalizedSymbols.length === 0
    ) {
      this.state = 'completed';
      this.completedStages =
        this.stageTargets.length;

      return Promise.resolve();
    }

    this.state = 'running';

    const promise =
      this.performStart(
        normalizedSymbols,
        generation,
      ).finally(() => {
        if (
          this.startPromise
          === promise
        ) {
          this.startPromise = null;
        }
      });

    this.startPromise = promise;

    return promise;
  }

  stop(): void {
    this.generation += 1;

    if (this.state === 'running') {
      this.state = 'stopped';
    }

    this.currentSymbol = null;
  }

  getStatus():
  MarketWideHistoryWarmupStatus {
    return {
      state:
        this.state,
      totalSymbols:
        this.totalSymbols,
      processedSymbols:
        this.processedSymbols,
      successfulSymbols:
        this.successfulSymbols,
      failedSymbols:
        this.failedSymbols,
      appliedKlines:
        this.appliedKlines,
      currentSymbol:
        this.currentSymbol,
      lastError:
        this.lastError,
      currentStageIndex:
        this.currentStageIndex,
      totalStages:
        this.stageTargets.length,
      completedStages:
        this.completedStages,
      currentStageTargetMinutes:
        this.currentStageTargetMinutes,
    };
  }

  private async performStart(
    symbols:
      readonly string[],
    generation: number,
  ): Promise<void> {
    for (
      const [
        stageIndex,
        targetMinutes,
      ]
      of this.stageTargets.entries()
    ) {
      if (
        generation
        !== this.generation
      ) {
        return;
      }

      this.currentStageIndex =
        stageIndex + 1;

      this.currentStageTargetMinutes =
        targetMinutes;

      this.processedSymbols = 0;
      this.successfulSymbols = 0;
      this.failedSymbols = 0;

      for (const symbol of symbols) {
        if (
          generation
          !== this.generation
        ) {
          return;
        }

        this.currentSymbol =
          symbol;

        try {
          const completed =
            await this.loadSymbolToTarget(
              symbol,
              targetMinutes,
              generation,
            );

          if (!completed) {
            return;
          }

          this.successfulSymbols += 1;
        } catch (error) {
          if (
            generation
            !== this.generation
          ) {
            return;
          }

          this.failedSymbols += 1;

          this.lastError =
            error instanceof Error
              ? error.message
              : `Unable to warm up ${symbol}`;
        }

        this.processedSymbols += 1;
        this.currentSymbol = null;
      }

      this.completedStages =
        stageIndex + 1;
    }

    if (
      generation
      === this.generation
    ) {
      this.state = 'completed';
      this.currentSymbol = null;
    }
  }

  private async loadSymbolToTarget(
    symbol: string,
    targetMinutes: number,
    generation: number,
  ): Promise<boolean> {
    if (
      this.exhaustedSymbols.has(
        symbol,
      )
    ) {
      return true;
    }

    let loadedMinutes =
      this.requestedMinutes.get(
        symbol,
      )
      ?? 0;

    while (
      loadedMinutes
      < targetMinutes
    ) {
      if (
        generation
        !== this.generation
      ) {
        return false;
      }

      const requestLimit =
        Math.min(
          targetMinutes
          - loadedMinutes,
          MAX_KLINES_PER_REQUEST,
        );

      const earliestOpenTime =
        this.earliestOpenTimes.get(
          symbol,
        );

      const request:
        BinanceOneMinuteHistoryRequest = {
          symbol,
          limit:
            requestLimit,
          ...(
            earliestOpenTime
            !== undefined
              ? {
                  endTime:
                    Math.max(
                      0,
                      earliestOpenTime
                      - 1,
                    ),
                }
              : {}
          ),
        };

      let klines:
        BinanceOneMinuteKlineUpdate[];

      try {
        klines =
          await this.options
            .historySource
            .fetchOneMinuteKlines(
              request,
            );
      } finally {
        if (
          this.options
            .requestDelayMs > 0
        ) {
          await this.delay(
            this.options
              .requestDelayMs,
          );
        }
      }

      if (
        generation
        !== this.generation
      ) {
        return false;
      }

      this.appliedKlines +=
        this.options.target
          .applyHistoricalKlines(
            klines,
          );

      const openTimes =
        klines
          .map(readOpenTime)
          .filter(
            (
              value,
            ): value is number =>
              value !== null,
          );

      const nextEarliestOpenTime =
        openTimes.length > 0
          ? Math.min(
              ...openTimes,
            )
          : null;

      const historyAdvanced =
        nextEarliestOpenTime
        !== null
        && (
          earliestOpenTime
          === undefined
          || nextEarliestOpenTime
          < earliestOpenTime
        );

      if (historyAdvanced) {
        this.earliestOpenTimes.set(
          symbol,
          nextEarliestOpenTime,
        );
      }

      loadedMinutes +=
        requestLimit;

      this.requestedMinutes.set(
        symbol,
        loadedMinutes,
      );

      if (
        klines.length
        < requestLimit
        || !historyAdvanced
      ) {
        this.exhaustedSymbols.add(
          symbol,
        );

        break;
      }
    }

    return true;
  }
}