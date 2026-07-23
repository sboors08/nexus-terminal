const NODE_ENV_VALUES = ['development', 'test', 'production'] as const;
const LOG_LEVEL_VALUES = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

type NodeEnv = (typeof NODE_ENV_VALUES)[number];
type LogLevel = (typeof LOG_LEVEL_VALUES)[number];

export interface AppEnv {
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  logLevel: LogLevel;
  binanceBaseUrl?: string;
  binanceRequestTimeoutMs?: number;
  binanceSymbolsLimit?: number;
  binanceCacheTtlMs?: number;
  binanceWebSocketEnabled?: boolean;
  binanceWebSocketBaseUrl?: string;
  binanceWebSocketSymbols?: string[];
  binanceWebSocketReconnectBaseDelayMs?: number;
  binanceWebSocketReconnectMaxDelayMs?: number;
  binanceWebSocketTradesBufferSize?: number;
  binanceSymbolUniverseEnabled?: boolean;
  binanceSymbolUniverseQuoteAsset?: string;
  binanceSymbolUniverseRefreshIntervalMs?: number;
  binanceSymbolUniverseCollectingDurationMs?: number;
  binanceMarketWideRealtimeEnabled?: boolean;
  binanceMarketWideWebSocketBaseUrl?: string;
  binanceMarketWideMaxStreamsPerSocket?: number;
  binanceMarketWideReconnectBaseDelayMs?: number;
  binanceMarketWideReconnectMaxDelayMs?: number;
  binanceMarketWideHistoryWarmupEnabled?: boolean;
  binanceMarketWideHistoryWarmupMinutesPerSymbol?: number;
  binanceMarketWideHistoryWarmupRequestDelayMs?: number;
}

function readEnum<T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  fallback: T[number],
  name: string,
): T[number] {
  if (!value) return fallback;
  if (allowed.includes(value)) return value as T[number];
  throw new Error(`${name} must be one of: ${allowed.join(', ')}`);
}

function readInteger(value: string | undefined, fallback: number, name: string, min: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function readBoolean(value: string | undefined, fallback: boolean, name: string): boolean {
  if (!value) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function readPort(value: string | undefined): number {
  return readInteger(value, 4100, 'PORT', 1, 65_535);
}

function readApiPrefix(value: string | undefined): string {
  const prefix = value?.trim() || '/api/v1';
  if (!prefix.startsWith('/')) throw new Error('API_PREFIX must start with /');
  return prefix.length > 1 ? prefix.replace(/\/$/, '') : prefix;
}

function readCorsOrigins(value: string | undefined): string[] {
  return (value || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean);
}

function readHttpUrl(value: string | undefined, fallback: string, name: string): string {
  const candidate = value?.trim() || fallback;
  let parsed: URL;
  try { parsed = new URL(candidate); } catch { throw new Error(`${name} must be a valid HTTP URL`); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error(`${name} must use http or https`);
  return parsed.toString().replace(/\/$/, '');
}

function readWebSocketUrl(value: string | undefined, fallback: string, name: string): string {
  const candidate = value?.trim() || fallback;
  let parsed: URL;
  try { parsed = new URL(candidate); } catch { throw new Error(`${name} must be a valid WebSocket URL`); }
  if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') throw new Error(`${name} must use ws or wss`);
  return parsed.toString().replace(/\/$/, '');
}

function readSymbols(value: string | undefined): string[] {
  const symbols = (value || 'BTCUSDT,ETHUSDT,SOLUSDT')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0 || symbols.some((symbol) => !/^[A-Z0-9]{5,20}$/.test(symbol))) {
    throw new Error('BINANCE_WS_SYMBOLS must contain comma-separated Binance symbols');
  }

  return [...new Set(symbols)];
}

function readQuoteAsset(
  value: string | undefined,
): string {
  const quoteAsset =
    (value || 'USDT')
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z0-9]{2,20}$/.test(
      quoteAsset,
    )
  ) {
    throw new Error(
      'BINANCE_SYMBOL_UNIVERSE_QUOTE_ASSET must contain a valid Binance asset',
    );
  }

  return quoteAsset;
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    nodeEnv: readEnum(source.NODE_ENV, NODE_ENV_VALUES, 'development', 'NODE_ENV'),
    host: source.HOST?.trim() || '0.0.0.0',
    port: readPort(source.PORT),
    apiPrefix: readApiPrefix(source.API_PREFIX),
    corsOrigins: readCorsOrigins(source.CORS_ORIGIN),
    logLevel: readEnum(source.LOG_LEVEL, LOG_LEVEL_VALUES, 'info', 'LOG_LEVEL'),
    binanceBaseUrl: readHttpUrl(source.BINANCE_BASE_URL, 'https://fapi.binance.com', 'BINANCE_BASE_URL'),
    binanceRequestTimeoutMs: readInteger(source.BINANCE_REQUEST_TIMEOUT_MS, 5_000, 'BINANCE_REQUEST_TIMEOUT_MS', 250, 30_000),
    binanceSymbolsLimit: readInteger(source.BINANCE_SYMBOLS_LIMIT, 100, 'BINANCE_SYMBOLS_LIMIT', 1, 500),
    binanceCacheTtlMs: readInteger(source.BINANCE_CACHE_TTL_MS, 15_000, 'BINANCE_CACHE_TTL_MS', 0, 300_000),
    binanceWebSocketEnabled: readBoolean(source.BINANCE_WS_ENABLED, true, 'BINANCE_WS_ENABLED'),
    binanceWebSocketBaseUrl: readWebSocketUrl(source.BINANCE_WS_BASE_URL, 'wss://fstream.binance.com', 'BINANCE_WS_BASE_URL'),
    binanceWebSocketSymbols: readSymbols(source.BINANCE_WS_SYMBOLS),
    binanceWebSocketReconnectBaseDelayMs: readInteger(source.BINANCE_WS_RECONNECT_BASE_DELAY_MS, 1_000, 'BINANCE_WS_RECONNECT_BASE_DELAY_MS', 100, 60_000),
    binanceWebSocketReconnectMaxDelayMs: readInteger(source.BINANCE_WS_RECONNECT_MAX_DELAY_MS, 30_000, 'BINANCE_WS_RECONNECT_MAX_DELAY_MS', 1_000, 300_000),
    binanceWebSocketTradesBufferSize: readInteger(source.BINANCE_WS_TRADES_BUFFER_SIZE, 100, 'BINANCE_WS_TRADES_BUFFER_SIZE', 1, 5_000),
    binanceSymbolUniverseEnabled: readBoolean(
      source.BINANCE_SYMBOL_UNIVERSE_ENABLED,
      source.NODE_ENV !== 'test',
      'BINANCE_SYMBOL_UNIVERSE_ENABLED',
    ),
    binanceSymbolUniverseQuoteAsset: readQuoteAsset(
      source.BINANCE_SYMBOL_UNIVERSE_QUOTE_ASSET,
    ),
    binanceSymbolUniverseRefreshIntervalMs: readInteger(
      source.BINANCE_SYMBOL_UNIVERSE_REFRESH_INTERVAL_MS,
      60_000,
      'BINANCE_SYMBOL_UNIVERSE_REFRESH_INTERVAL_MS',
      10_000,
      3_600_000,
    ),
    binanceSymbolUniverseCollectingDurationMs: readInteger(
      source.BINANCE_SYMBOL_UNIVERSE_COLLECTING_DURATION_MS,
      15 * 60 * 1000,
      'BINANCE_SYMBOL_UNIVERSE_COLLECTING_DURATION_MS',
      0,
      86_400_000,
    ),
    binanceMarketWideRealtimeEnabled: readBoolean(
      source.BINANCE_MARKET_WIDE_ENABLED,
      source.NODE_ENV !== 'test',
      'BINANCE_MARKET_WIDE_ENABLED',
    ),
    binanceMarketWideWebSocketBaseUrl: readWebSocketUrl(
      source.BINANCE_MARKET_WIDE_WS_BASE_URL,
      'wss://fstream.binance.com',
      'BINANCE_MARKET_WIDE_WS_BASE_URL',
    ),
    binanceMarketWideMaxStreamsPerSocket: readInteger(
      source.BINANCE_MARKET_WIDE_MAX_STREAMS_PER_SOCKET,
      800,
      'BINANCE_MARKET_WIDE_MAX_STREAMS_PER_SOCKET',
      2,
      1_000,
    ),
    binanceMarketWideReconnectBaseDelayMs: readInteger(
      source.BINANCE_MARKET_WIDE_RECONNECT_BASE_DELAY_MS,
      1_000,
      'BINANCE_MARKET_WIDE_RECONNECT_BASE_DELAY_MS',
      100,
      60_000,
    ),
    binanceMarketWideReconnectMaxDelayMs: readInteger(
      source.BINANCE_MARKET_WIDE_RECONNECT_MAX_DELAY_MS,
      30_000,
      'BINANCE_MARKET_WIDE_RECONNECT_MAX_DELAY_MS',
      1_000,
      300_000,
    ),
    binanceMarketWideHistoryWarmupEnabled: readBoolean(
      source.BINANCE_MARKET_WIDE_HISTORY_WARMUP_ENABLED,
      source.NODE_ENV !== 'test',
      'BINANCE_MARKET_WIDE_HISTORY_WARMUP_ENABLED',
    ),
    binanceMarketWideHistoryWarmupMinutesPerSymbol: readInteger(
      source.BINANCE_MARKET_WIDE_HISTORY_WARMUP_MINUTES_PER_SYMBOL,
      4_320,
      'BINANCE_MARKET_WIDE_HISTORY_WARMUP_MINUTES_PER_SYMBOL',
      1,
      4_320,
    ),
    binanceMarketWideHistoryWarmupRequestDelayMs: readInteger(
      source.BINANCE_MARKET_WIDE_HISTORY_WARMUP_REQUEST_DELAY_MS,
      250,
      'BINANCE_MARKET_WIDE_HISTORY_WARMUP_REQUEST_DELAY_MS',
      0,
      60_000,
    ),
  };
}
