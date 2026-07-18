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

function readPort(value: string | undefined): number {
  if (!value) return 4100;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

function readApiPrefix(value: string | undefined): string {
  const prefix = value?.trim() || '/api/v1';
  if (!prefix.startsWith('/')) {
    throw new Error('API_PREFIX must start with /');
  }

  return prefix.length > 1 ? prefix.replace(/\/$/, '') : prefix;
}

function readCorsOrigins(value: string | undefined): string[] {
  return (value || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    nodeEnv: readEnum(source.NODE_ENV, NODE_ENV_VALUES, 'development', 'NODE_ENV'),
    host: source.HOST?.trim() || '0.0.0.0',
    port: readPort(source.PORT),
    apiPrefix: readApiPrefix(source.API_PREFIX),
    corsOrigins: readCorsOrigins(source.CORS_ORIGIN),
    logLevel: readEnum(source.LOG_LEVEL, LOG_LEVEL_VALUES, 'info', 'LOG_LEVEL'),
  };
}
