import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorResponse, FeedbackPayload, SetupFeedback } from '../../contracts/nexus-api.js';
import { MarketDataUnavailableError, MarketSymbolNotFoundError, type MarketDataProvider } from '../market-data/market-data.provider.js';
import { acceptFeedback, alerts, createWorkspaceSnapshot, replaySessions, setupHistory, setups } from './fixtures.js';

interface ApiContractRoutesOptions { marketDataProvider: MarketDataProvider; }

function sendError(request: FastifyRequest, reply: FastifyReply, statusCode: number, error: string, message: string) {
  const payload: ApiErrorResponse = { error, message, requestId: request.id };
  return reply.status(statusCode).send(payload);
}

function sendMarketDataError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof MarketSymbolNotFoundError) return sendError(request, reply, 404, 'symbol_not_found', error.message);
  if (error instanceof MarketDataUnavailableError) {
    request.log.warn({ error }, 'Market data provider is unavailable');
    return sendError(request, reply, 503, 'market_data_unavailable', 'Market data is temporarily unavailable');
  }
  throw error;
}

function normalizeSymbol(value: string | undefined): string | null {
  const symbol = value?.trim().toUpperCase();
  return symbol && /^[A-Z0-9]{5,20}$/.test(symbol) ? symbol : null;
}
function normalizeTimeframe(value: string | undefined): string | null {
  const timeframe = value?.trim().toLowerCase();
  return timeframe && /^(1|3|5|15|30)m$|^(1|2|4|6|8|12)h$|^1d$/.test(timeframe) ? timeframe : null;
}
function isFeedbackPayload(value: unknown): value is FeedbackPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<FeedbackPayload>;
  return typeof payload.type === 'string' && typeof payload.message === 'string' && payload.message.trim().length >= 3 && typeof payload.context === 'object' && payload.context !== null;
}
function isSetupFeedback(value: unknown): value is SetupFeedback {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<SetupFeedback>;
  return typeof payload.setupId === 'string' && payload.setupId.length > 0 && typeof payload.useful === 'boolean' && Array.isArray(payload.reasons);
}

export const apiContractRoutes: FastifyPluginAsync<ApiContractRoutesOptions> = async (app, options) => {
  app.get('/market/symbols', async (request, reply) => {
    try { return await options.marketDataProvider.getMarketSymbols(); } catch (error) { return sendMarketDataError(request, reply, error); }
  });

  app.get<{ Querystring: { symbol?: string; timeframe?: string } }>('/market/candles', async (request, reply) => {
    const symbol = normalizeSymbol(request.query.symbol);
    const timeframe = normalizeTimeframe(request.query.timeframe);
    if (!symbol) return sendError(request, reply, 400, 'invalid_symbol', 'Query parameter symbol is required');
    if (!timeframe) return sendError(request, reply, 400, 'invalid_timeframe', 'Unsupported timeframe');
    try { return await options.marketDataProvider.getCandles(symbol, timeframe); } catch (error) { return sendMarketDataError(request, reply, error); }
  });

  app.get('/setups', async () => setups);
  app.get<{ Params: { setupId: string } }>('/setups/:setupId', async (request, reply) => setups.find((item) => item.id === request.params.setupId) ?? sendError(request, reply, 404, 'setup_not_found', 'Setup was not found'));
  app.get<{ Querystring: { setupId?: string } }>('/workspace/snapshot', async (request, reply) => {
    const setup = request.query.setupId ? setups.find((item) => item.id === request.query.setupId) : setups[0];
    return setup ? createWorkspaceSnapshot(setup) : sendError(request, reply, 404, 'setup_not_found', 'Setup was not found');
  });
  app.get('/alerts', async () => alerts);
  app.get('/setup-history', async () => setupHistory);
  app.get<{ Querystring: { sessionId?: string } }>('/replay', async (request, reply) => {
    const session = request.query.sessionId ? replaySessions.find((item) => item.id === request.query.sessionId) : replaySessions[0];
    return session ?? sendError(request, reply, 404, 'replay_not_found', 'Replay session was not found');
  });
  app.post<{ Body: FeedbackPayload }>('/feedback', async (request, reply) => {
    if (!isFeedbackPayload(request.body)) return sendError(request, reply, 400, 'invalid_feedback', 'Feedback requires type, message and context');
    return reply.status(202).send(acceptFeedback(request.body));
  });
  app.post<{ Body: SetupFeedback }>('/setup-feedback', async (request, reply) => {
    if (!isSetupFeedback(request.body)) return sendError(request, reply, 400, 'invalid_setup_feedback', 'Setup feedback requires setupId, useful and reasons');
    return reply.status(202).send(acceptFeedback(request.body));
  });
};
