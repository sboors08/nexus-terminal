import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../contracts/nexus-api.js';
import type {
  MarketDataProvider,
} from '../market-data/market-data.provider.js';
import type {
  SetupDetectionRuntimeReader,
} from './setup-detection-runtime.types.js';
import {
  projectCurrentSetupCandidateEpisodes,
} from './setup-candidate-current-episode-projection.js';
import type {
  SetupDirection,
  SetupEngineLevelKind,
  SetupEngineSetupType,
} from './setup-engine.types.js';

export interface SetupReadRoutesOptions {
  setupDetectionRuntimeReader?:
    SetupDetectionRuntimeReader;

  marketDataProvider?:
    MarketDataProvider;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const CANDIDATE_ID_PATTERN =
  /^[A-Za-z0-9._:-]{1,300}$/;

const SETUP_TYPES:
readonly SetupEngineSetupType[] = [
  'level_breakout',
  'level_bounce',
];

const DIRECTIONS:
readonly SetupDirection[] = [
  'long',
  'short',
];

const LEVEL_KINDS:
readonly SetupEngineLevelKind[] = [
  'support',
  'resistance',
];

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
  value:
    string
    | undefined,
): string | null {
  if (value === undefined) {
    return null;
  }

  const symbol =
    value.trim().toUpperCase();

  return SYMBOL_PATTERN.test(
    symbol,
  )
    ? symbol
    : '';
}

function parseSetupType(
  value:
    string
    | undefined,
):
  SetupEngineSetupType
  | null
  | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized =
    value.trim();

  return SETUP_TYPES.includes(
    normalized as
      SetupEngineSetupType,
  )
    ? normalized as
        SetupEngineSetupType
    : null;
}

function parseDirection(
  value:
    string
    | undefined,
):
  SetupDirection
  | null
  | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized =
    value.trim();

  return DIRECTIONS.includes(
    normalized as
      SetupDirection,
  )
    ? normalized as
        SetupDirection
    : null;
}

function parseLevelKind(
  value:
    string
    | undefined,
):
  SetupEngineLevelKind
  | null
  | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized =
    value.trim();

  return LEVEL_KINDS.includes(
    normalized as
      SetupEngineLevelKind,
  )
    ? normalized as
        SetupEngineLevelKind
    : null;
}

function parseLimit(
  value:
    string
    | undefined,
): number | null {
  if (value === undefined) {
    return 20;
  }

  if (
    value.trim().length === 0
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return (
    Number.isInteger(parsed)
    && parsed >= 1
    && parsed <= 1_000
  )
    ? parsed
    : null;
}

function parseMinQuoteVolume24h(
  value:
    string
    | undefined,
):
  number
  | null
  | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value.trim().length === 0) {
    return null;
  }

  const parsed =
    Number(value);

  return (
    Number.isFinite(parsed)
    && parsed >= 0
  )
    ? parsed
    : null;
}

function normalizeCandidateId(
  value: string,
): string {
  const candidateId =
    value.trim();

  return CANDIDATE_ID_PATTERN
    .test(candidateId)
      ? candidateId
      : '';
}

export const setupReadRoutes:
FastifyPluginAsync<
  SetupReadRoutesOptions
> = async (
  app,
  options,
) => {
  app.get(
    '/setups/runtime/status',
    async (
      request,
      reply,
    ) => {
      const runtime =
        options
          .setupDetectionRuntimeReader;

      if (!runtime) {
        return sendError(
          request,
          reply,
          503,
          'setup_runtime_unavailable',
          'Setup detection runtime is unavailable',
        );
      }

      return runtime.getStatus();
    },
  );

  app.get<{
    Querystring: {
      symbol?: string;
      setupType?: string;
      direction?: string;
      levelKind?: string;
      minQuoteVolume24h?: string;
      limit?: string;
    };
  }>(
    '/setups/candidates',
    async (
      request,
      reply,
    ) => {
      const symbol =
        normalizeSymbol(
          request.query.symbol,
        );

      if (symbol === '') {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_symbol',
          'Invalid setup candidate symbol',
        );
      }

      const setupType =
        parseSetupType(
          request.query
            .setupType,
        );

      if (setupType === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_type',
          'Setup type must be level_breakout or level_bounce',
        );
      }

      const direction =
        parseDirection(
          request.query.direction,
        );

      if (direction === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_direction',
          'Setup direction must be long or short',
        );
      }

      const levelKind =
        parseLevelKind(
          request.query.levelKind,
        );

      if (levelKind === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_level_kind',
          'Setup levelKind must be support or resistance',
        );
      }

      const limit =
        parseLimit(
          request.query.limit,
        );

      if (limit === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_limit',
          'Setup candidate limit must be an integer from 1 to 1000',
        );
      }

      const minQuoteVolume24h =
        parseMinQuoteVolume24h(
          request.query
            .minQuoteVolume24h,
        );

      if (minQuoteVolume24h === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_min_quote_volume_24h',
          'Minimum 24h quote volume must be a non-negative number',
        );
      }

      const runtime =
        options
          .setupDetectionRuntimeReader;

      if (!runtime) {
        return sendError(
          request,
          reply,
          503,
          'setup_runtime_unavailable',
          'Setup detection runtime is unavailable',
        );
      }

      const currentEpisodeProjection =
        projectCurrentSetupCandidateEpisodes(
          runtime
            .getCandidates(
              symbol
              ?? undefined,
            ),
        );

      let candidates =
        currentEpisodeProjection
          .candidates
          .filter(
            (candidate) =>
              (
                setupType
                === undefined
                || candidate.setupType
                  === setupType
              )
              && (
                direction
                === undefined
                || candidate.direction
                  === direction
              )
              && (
                levelKind
                === undefined
                || candidate.level.kind
                  === levelKind
              ),
          );

      if (
        minQuoteVolume24h !== undefined
        && minQuoteVolume24h > 0
      ) {
        const marketDataProvider =
          options.marketDataProvider;

        if (!marketDataProvider) {
          return sendError(
            request,
            reply,
            503,
            'setup_market_data_unavailable',
            'Market data is unavailable for 24h volume filtering',
          );
        }

        try {
          const marketSymbols =
            await marketDataProvider
              .getMarketSymbols();

          const volumeBySymbol =
            new Map(
              marketSymbols.map(
                (marketSymbol) => [
                  marketSymbol.symbol
                    .trim()
                    .toUpperCase(),
                  marketSymbol.volumeQuote,
                ] as const,
              ),
            );

          candidates =
            candidates.filter(
              (candidate) =>
                (
                  volumeBySymbol.get(
                    candidate.symbol
                      .trim()
                      .toUpperCase(),
                  )
                  ?? -1
                )
                >= minQuoteVolume24h,
            );
        } catch (error) {
          request.log.warn(
            { error },
            'Market data provider failed during setup volume filtering',
          );

          return sendError(
            request,
            reply,
            503,
            'setup_market_data_unavailable',
            'Market data is temporarily unavailable for 24h volume filtering',
          );
        }
      }

      return candidates.slice(
        0,
        limit,
      );
    },
  );

  app.get<{
    Params: {
      candidateId: string;
    };
  }>(
    '/setups/candidates/:candidateId',
    async (
      request,
      reply,
    ) => {
      const candidateId =
        normalizeCandidateId(
          request.params
            .candidateId,
        );

      if (candidateId === '') {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_candidate_id',
          'Invalid setup candidate id',
        );
      }

      const runtime =
        options
          .setupDetectionRuntimeReader;

      if (!runtime) {
        return sendError(
          request,
          reply,
          503,
          'setup_runtime_unavailable',
          'Setup detection runtime is unavailable',
        );
      }

      const candidate =
        runtime.getCandidate(
          candidateId,
        );

      if (!candidate) {
        return sendError(
          request,
          reply,
          404,
          'setup_candidate_not_found',
          `Setup candidate ${candidateId} was not found`,
        );
      }

      return candidate;
    },
  );
};
