import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../contracts/nexus-api.js';
import {
  MarketDataUnavailableError,
  MarketSymbolNotFoundError,
} from '../market-data/market-data.provider.js';
import type {
  MarketDataProvider,
} from '../market-data/market-data.provider.js';
import type {
  OrderBookDepthRuntimeService,
} from '../realtime-market-data/order-book-depth-runtime.types.js';
import type {
  RealtimeMarketDataService,
} from '../realtime-market-data/realtime-market-data.types.js';
import {
  detectLevelLines,
} from './level-lines-detector.js';
import type {
  LevelLinesSnapshot,
  LevelLinesSnapshotCandle,
} from './level-lines.types.js';
import {
  isLevelEngineTimeframe,
  normalizeLevelEngineSymbol,
} from './level-engine.contract.js';
import {
  captureRealtimeConfirmationEvidence,
} from './realtime-confirmation-evidence.js';
import {
  evaluateRealtimeConfirmations,
} from './realtime-confirmation-engine.js';

export interface LevelLinesRoutesOptions {
  readonly marketDataProvider:
    MarketDataProvider;
  readonly realtimeMarketDataService?:
    Pick<
      RealtimeMarketDataService,
      'getSnapshots'
    >;
  readonly orderBookDepthService?:
    Pick<
      OrderBookDepthRuntimeService,
      'getSnapshot'
    >;
  readonly now?: () => Date;
}

function sendError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  error: string,
  message: string,
) {
  const payload:
  ApiErrorResponse = {
    error,
    message,
    requestId:
      request.id,
  };

  return reply
    .status(statusCode)
    .send(payload);
}

function normalizeSymbol(
  value: string | undefined,
): string | null {
  if (!value) {
    return null;
  }

  try {
    return normalizeLevelEngineSymbol(
      value,
    );
  } catch {
    return null;
  }
}

export const levelLinesRoutes:
FastifyPluginAsync<
  LevelLinesRoutesOptions
> = async (
  app,
  options,
) => {
  app.get<{
    Querystring: {
      symbol?: string;
      timeframe?: string;
      limit?: string;
    };
  }>(
    '/level-engine/lines',
    async (
      request,
      reply,
    ) => {
      const symbol =
        normalizeSymbol(
          request.query.symbol,
        );
      const timeframe =
        request.query.timeframe
        ?.trim()
        .toLowerCase();
      const limit =
        request.query.limit
          === undefined
          ? 500
          : Number(
              request.query.limit,
            );

      if (!symbol) {
        return sendError(
          request,
          reply,
          400,
          'invalid_symbol',
          'Query parameter symbol is required',
        );
      }

      if (
        !isLevelEngineTimeframe(
          timeframe,
        )
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_timeframe',
          'Level Lines supports 1m, 5m, 15m, 1h and 4h',
        );
      }

      if (
        !Number.isInteger(limit)
        || limit < 50
        || limit > 1000
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_limit',
          'Level Lines candle limit must be between 50 and 1000',
        );
      }

      try {
        const now =
          options.now
          ?? (() => new Date());
        const closedAt =
          now().toISOString();
        const nowMs =
          Date.parse(
            closedAt,
          );
        const sourceCandles =
          await options
            .marketDataProvider
            .getCandles(
              symbol,
              timeframe,
              {
                limit,
              },
            );
        const candles:
        readonly LevelLinesSnapshotCandle[] =
          Object.freeze(
            sourceCandles.map(
              (candle) =>
                Object.freeze({
                  ...candle,
                  isClosed:
                    Date.parse(
                      candle.closeTime,
                    ) <= nowMs,
                }),
            ),
          );
        const detection =
          detectLevelLines({
            symbol,
            timeframe,
            candles,
          });
        const currentCandleIndex =
          detection
            .approachEvaluation
            .currentCandleIndex;
        const currentClosedCandle =
          currentCandleIndex === null
            ? null
            : candles[
                currentCandleIndex
              ]
              ?? null;
        const realtimeEvidence =
          captureRealtimeConfirmationEvidence(
            symbol,
            {
              tapeReader:
                options
                  .realtimeMarketDataService
                ?? null,
              orderBookReader:
                options
                  .orderBookDepthService
                ?? null,
            },
            now,
          );
        const generatedAt =
          realtimeEvidence
            .capturedAt;
        const realtimeConfirmation =
          evaluateRealtimeConfirmations({
            symbol,
            timeframe,
            approachEvaluation:
              detection
                .approachEvaluation,
            currentClosedCandle,
            evidence:
              realtimeEvidence,
          });
        const snapshot:
        LevelLinesSnapshot =
          Object.freeze({
            ...detection,
            generatedAt,
            realtimeConfirmation,
            candles,
          });

        return snapshot;
      } catch (error: unknown) {
        if (
          error
          instanceof MarketSymbolNotFoundError
        ) {
          return sendError(
            request,
            reply,
            404,
            'symbol_not_found',
            error.message,
          );
        }

        if (
          error
          instanceof MarketDataUnavailableError
        ) {
          request.log.warn(
            {
              error,
            },
            'Level Lines market data is unavailable',
          );

          return sendError(
            request,
            reply,
            503,
            'market_data_unavailable',
            'Level Lines market data is temporarily unavailable',
          );
        }

        throw error;
      }
    },
  );
};
