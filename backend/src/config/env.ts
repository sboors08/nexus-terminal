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

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    nodeEnv: readEnum(source.NODE_ENV, NODE_ENV_VALUES, 'development', 'NODE_ENV'),
    host: source.HOST?.trim() || '0.0.0.0',
    port: readPort(source.PORT),
    apiPrefix: readApiPrefix(source.API_PREFIX),
    corsOrigins: readCorsOrigins(source.CORS_ORIGIN),
    logLevel: readEnum(source.LOG_LEVEL, LOG_LEVEL_VALUES, 'info', 'LOG_LEVEL'),
    binanceBaseUrl: readHttpUrl(source.BINANCE_BASE_URL, 'https://data-api.binance.vision', 'BINANCE_BASE_URL'),
    binanceRequestTimeoutMs: readInteger(source.BINANCE_REQUEST_TIMEOUT_MS, 5_000, 'BINANCE_REQUEST_TIMEOUT_MS', 250, 30_000),
    binanceSymbolsLimit: readInteger(source.BINANCE_SYMBOLS_LIMIT, 100, 'BINANCE_SYMBOLS_LIMIT', 1, 500),
    binanceCacheTtlMs: readInteger(source.BINANCE_CACHE_TTL_MS, 15_000, 'BINANCE_CACHE_TTL_MS', 0, 300_000),
  };
}
