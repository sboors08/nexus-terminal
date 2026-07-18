import cors from '@fastify/cors';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { readEnv, type AppEnv } from './config/env.js';
import { apiModules } from './modules/index.js';
import { BinanceMarketDataClient } from './modules/market-data/binance-market-data.client.js';
import type { MarketDataProvider } from './modules/market-data/market-data.provider.js';

export interface BuildAppOptions {
  env?: AppEnv;
  marketDataProvider?: MarketDataProvider;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? readEnv();
  const marketDataProvider = options.marketDataProvider ?? new BinanceMarketDataClient({
    baseUrl: env.binanceBaseUrl ?? 'https://data-api.binance.vision',
    requestTimeoutMs: env.binanceRequestTimeoutMs ?? 5_000,
    symbolsLimit: env.binanceSymbolsLimit ?? 100,
    cacheTtlMs: env.binanceCacheTtlMs ?? 15_000,
  });
  const app = Fastify({
    logger: env.nodeEnv === 'test' ? false : { level: env.logLevel },
    trustProxy: true,
    requestIdHeader: 'x-request-id',
  });

  await app.register(cors, {
    credentials: true,
    origin(origin: string | undefined, callback: (error: Error | null, allow: boolean) => void) {
      const isAllowed = !origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin);
      callback(null, isAllowed);
    },
  });

  app.get('/', async () => ({ service: 'nexus-backend', version: '0.1.0', apiPrefix: env.apiPrefix }));
  await app.register(apiModules, { prefix: env.apiPrefix, marketDataProvider });

  app.setNotFoundHandler((request, reply) => reply.status(404).send({ error: 'not_found', message: `Route ${request.method} ${request.url} was not found`, requestId: request.id }));
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ error }, 'Unhandled request error');
    return reply.status(error.statusCode ?? 500).send({ error: error.code ?? 'internal_error', message: error.statusCode && error.statusCode < 500 ? error.message : 'Internal server error', requestId: request.id });
  });
  return app;
}
