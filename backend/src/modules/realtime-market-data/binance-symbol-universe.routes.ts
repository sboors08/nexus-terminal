import type {
  FastifyPluginAsync,
} from 'fastify';
import type {
  BinanceSymbolUniverseService,
} from './binance-symbol-universe.service.js';

interface BinanceSymbolUniverseRoutesOptions {
  binanceSymbolUniverseService:
    BinanceSymbolUniverseService;
}

export const binanceSymbolUniverseRoutes:
FastifyPluginAsync<
  BinanceSymbolUniverseRoutesOptions
> = async (
  app,
  options,
) => {
  app.get(
    '/market/symbol-universe',
    async () =>
      options
        .binanceSymbolUniverseService
        .getSnapshot(),
  );
};