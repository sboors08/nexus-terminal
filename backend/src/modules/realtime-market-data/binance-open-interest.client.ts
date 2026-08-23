import type {
  RealtimeOpenInterest,
} from './realtime-market-data.types.js';

type FetchLike = (
  input:
    string
    | URL
    | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface BinanceOpenInterestClientOptions {
  baseUrl: string;
  requestTimeoutMs: number;
  fetchImpl?: FetchLike;
}

export class BinanceOpenInterestError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      'BinanceOpenInterestError';
  }
}

type UnknownRecord =
  Record<string, unknown>;

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value.trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new BinanceOpenInterestError(
      `Invalid Binance open interest symbol: ${value}`,
    );
  }

  return symbol;
}

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
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
    throw new BinanceOpenInterestError(
      `Invalid Binance open interest field: ${field}`,
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
    throw new BinanceOpenInterestError(
      `Invalid Binance open interest integer: ${field}`,
    );
  }

  return parsed;
}

export class BinanceOpenInterestClient {
  private readonly baseUrl:
    string;

  private readonly fetchImpl:
    FetchLike;

  constructor(
    private readonly options:
      BinanceOpenInterestClientOptions,
  ) {
    if (
      !Number.isInteger(
        options.requestTimeoutMs,
      )
      || options.requestTimeoutMs < 1
    ) {
      throw new BinanceOpenInterestError(
        'Binance open interest requestTimeoutMs must be a positive integer',
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
  }

  async fetchOpenInterest(
    requestedSymbol: string,
  ): Promise<RealtimeOpenInterest> {
    const symbol =
      normalizeSymbol(
        requestedSymbol,
      );

    const query =
      new URLSearchParams({
        symbol,
      });

    const payload =
      await this.requestJson(
        `/fapi/v1/openInterest?${query.toString()}`,
      );

    if (!isRecord(payload)) {
      throw new BinanceOpenInterestError(
        'Binance returned an unexpected open interest response',
      );
    }

    const responseSymbol =
      typeof payload.symbol
        === 'string'
        ? normalizeSymbol(
            payload.symbol,
          )
        : null;

    if (
      responseSymbol === null
      || responseSymbol
        !== symbol
    ) {
      throw new BinanceOpenInterestError(
        'Binance open interest symbol mismatch',
      );
    }

    const openInterest =
      readNumber(
        payload.openInterest,
        'openInterest',
        0,
      );

    const timeMs =
      readInteger(
        payload.time,
        'time',
        0,
      );

    const updatedAt =
      new Date(
        timeMs,
      );

    if (
      Number.isNaN(
        updatedAt.getTime(),
      )
    ) {
      throw new BinanceOpenInterestError(
        'Invalid Binance open interest timestamp',
      );
    }

    return {
      symbol,
      openInterest,
      updatedAt:
        updatedAt.toISOString(),
    };
  }

  private async requestJson(
    path: string,
  ): Promise<unknown> {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        this.options
          .requestTimeoutMs,
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
          throw new BinanceOpenInterestError(
            'Binance returned invalid open interest JSON',
          );
        }
      }

      if (!response.ok) {
        throw new BinanceOpenInterestError(
          `Binance open interest request failed with status ${response.status}`,
        );
      }

      return payload;
    } catch (error) {
      if (
        error
        instanceof
          BinanceOpenInterestError
      ) {
        throw error;
      }

      const message =
        error instanceof Error
        && error.name
          === 'AbortError'
          ? 'Binance open interest request timed out'
          : 'Binance open interest request failed';

      throw new BinanceOpenInterestError(
        message,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
