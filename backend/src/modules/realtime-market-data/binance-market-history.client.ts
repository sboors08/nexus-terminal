import type {
  BinanceOneMinuteKlineUpdate,
} from './market-wide-one-minute-metrics.js';

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface BinanceMarketHistoryClientOptions {
  baseUrl: string;
  requestTimeoutMs: number;
  fetchImpl?: FetchLike;
  now?: () => Date;
}

export interface BinanceOneMinuteHistoryRequest {
  symbol: string;
  limit: number;
  endTime?: number;
}

export class BinanceMarketHistoryError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BinanceMarketHistoryError';
  }
}

export class BinanceMarketHistorySymbolNotFoundError
  extends BinanceMarketHistoryError {
  constructor(
    public readonly symbol: string,
  ) {
    super(
      `Binance market history symbol not found: ${symbol}`,
    );
    this.name =
      'BinanceMarketHistorySymbolNotFoundError';
  }
}

interface BinanceErrorPayload {
  code?: number;
  msg?: string;
}

type BinanceKlineRow = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  ...unknown[],
];

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const MAX_KLINES_PER_REQUEST =
  1_500;

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value.trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new BinanceMarketHistoryError(
      `Invalid Binance history symbol: ${value}`,
    );
  }

  return symbol;
}

function validateRequest(
  request: BinanceOneMinuteHistoryRequest,
): void {
  if (
    !Number.isInteger(request.limit)
    || request.limit < 1
    || request.limit
      > MAX_KLINES_PER_REQUEST
  ) {
    throw new BinanceMarketHistoryError(
      'Binance history limit must be an integer from 1 to 1500',
    );
  }

  if (
    request.endTime !== undefined
    && (
      !Number.isInteger(request.endTime)
      || request.endTime < 0
    )
  ) {
    throw new BinanceMarketHistoryError(
      'Binance history endTime must be a non-negative integer',
    );
  }
}

function readNumber(
  value: unknown,
  field: string,
  minimum: number,
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  if (
    !Number.isFinite(parsed)
    || parsed < minimum
  ) {
    throw new BinanceMarketHistoryError(
      `Invalid Binance history field: ${field}`,
    );
  }

  return parsed;
}

function readInteger(
  value: unknown,
  field: string,
  minimum: number,
): number {
  const parsed =
    readNumber(
      value,
      field,
      minimum,
    );

  if (!Number.isInteger(parsed)) {
    throw new BinanceMarketHistoryError(
      `Invalid Binance history integer: ${field}`,
    );
  }

  return parsed;
}

function timestampToIso(
  value: number,
  field: string,
): string {
  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BinanceMarketHistoryError(
      `Invalid Binance history timestamp: ${field}`,
    );
  }

  return date.toISOString();
}

function parseKline(
  symbol: string,
  payload: unknown,
  nowMs: number,
): BinanceOneMinuteKlineUpdate {
  if (
    !Array.isArray(payload)
    || payload.length < 11
  ) {
    throw new BinanceMarketHistoryError(
      'Binance returned an invalid history candle',
    );
  }

  const row =
    payload as BinanceKlineRow;

  const openTimeMs =
    readInteger(
      row[0],
      'openTime',
      0,
    );

  const closeTimeMs =
    readInteger(
      row[6],
      'closeTime',
      openTimeMs,
    );

  const open =
    readNumber(
      row[1],
      'open',
      Number.MIN_VALUE,
    );

  const high =
    readNumber(
      row[2],
      'high',
      Number.MIN_VALUE,
    );

  const low =
    readNumber(
      row[3],
      'low',
      Number.MIN_VALUE,
    );

  const close =
    readNumber(
      row[4],
      'close',
      Number.MIN_VALUE,
    );

  const quoteVolume =
    readNumber(
      row[7],
      'quoteVolume',
      0,
    );

  const tradesCount =
    readInteger(
      row[8],
      'tradesCount',
      0,
    );

  const takerBuyQuoteVolume =
    readNumber(
      row[10],
      'takerBuyQuoteVolume',
      0,
    );

  if (
    high < Math.max(open, close)
    || low > Math.min(open, close)
    || high < low
  ) {
    throw new BinanceMarketHistoryError(
      'Binance returned invalid history OHLC values',
    );
  }

  if (
    takerBuyQuoteVolume
    > quoteVolume + 0.00000001
  ) {
    throw new BinanceMarketHistoryError(
      'Binance returned invalid history taker volume',
    );
  }

  const closeTime =
    timestampToIso(
      closeTimeMs,
      'closeTime',
    );

  return {
    symbol,
    eventTime: closeTime,
    openTime:
      timestampToIso(
        openTimeMs,
        'openTime',
      ),
    closeTime,
    open,
    high,
    low,
    close,
    quoteVolume,
    tradesCount,
    takerBuyQuoteVolume,
    isClosed:
      closeTimeMs < nowMs,
  };
}

export class BinanceMarketHistoryClient {
  private readonly baseUrl: string;

  private readonly fetchImpl:
    FetchLike;

  private readonly now:
    () => Date;

  constructor(
    private readonly options:
      BinanceMarketHistoryClientOptions,
  ) {
    if (
      !Number.isInteger(
        options.requestTimeoutMs,
      )
      || options.requestTimeoutMs < 1
    ) {
      throw new BinanceMarketHistoryError(
        'Binance history requestTimeoutMs must be a positive integer',
      );
    }

    this.baseUrl =
      options.baseUrl.replace(
        /\/$/,
        '',
      );

    this.fetchImpl =
      options.fetchImpl
      ?? globalThis.fetch;

    this.now =
      options.now
      ?? (() => new Date());
  }

  async fetchOneMinuteKlines(
    request:
      BinanceOneMinuteHistoryRequest,
  ): Promise<
    BinanceOneMinuteKlineUpdate[]
  > {
    validateRequest(request);

    const symbol =
      normalizeSymbol(
        request.symbol,
      );

    const query =
      new URLSearchParams({
        symbol,
        interval: '1m',
        limit:
          String(request.limit),
      });

    if (
      request.endTime
      !== undefined
    ) {
      query.set(
        'endTime',
        String(request.endTime),
      );
    }

    const payload =
      await this.requestJson(
        `/fapi/v1/klines?${query.toString()}`,
        symbol,
      );

    if (!Array.isArray(payload)) {
      throw new BinanceMarketHistoryError(
        'Binance returned an unexpected history response',
      );
    }

    const nowMs =
      this.now().getTime();

    return payload
      .map(
        (row) =>
          parseKline(
            symbol,
            row,
            nowMs,
          ),
      )
      .sort(
        (left, right) =>
          Date.parse(left.openTime)
          - Date.parse(right.openTime),
      );
  }

  private async requestJson(
    path: string,
    symbol: string,
  ): Promise<unknown> {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        this.options.requestTimeoutMs,
      );

    try {
      const response =
        await this.fetchImpl(
          `${this.baseUrl}${path}`,
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

      let payload:
        unknown = null;

      if (text.length > 0) {
        try {
          payload =
            JSON.parse(text);
        } catch {
          throw new BinanceMarketHistoryError(
            'Binance returned invalid history JSON',
          );
        }
      }

      if (!response.ok) {
        const apiError =
          payload as
            BinanceErrorPayload
            | null;

        if (
          response.status === 400
          && apiError?.code === -1121
        ) {
          throw new BinanceMarketHistorySymbolNotFoundError(
            symbol,
          );
        }

        throw new BinanceMarketHistoryError(
          `Binance history request failed with status ${response.status}`,
        );
      }

      return payload;
    } catch (error) {
      if (
        error
        instanceof
          BinanceMarketHistoryError
      ) {
        throw error;
      }

      const message =
        error instanceof Error
        && error.name === 'AbortError'
          ? 'Binance history request timed out'
          : 'Binance history request failed';

      throw new BinanceMarketHistoryError(
        message,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}