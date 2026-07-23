import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../contracts/nexus-api.js';
import type {
  MarketScannerMetrics,
} from './market-scanner-metrics.js';
import {
  DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS,
  type MarketVolumeSpike,
  type MarketVolumeSpikeOptions,
  type MarketVolumeSpikeStatus,
} from './market-volume-spikes.js';
import {
  isMarketScannerWindowId,
  type MarketScannerWindowId,
} from './scanner-windows.js';
import type {
  MarketWideHistoryWarmupStatus,
} from './market-wide-history-warmup.service.js';
import type {
  MarketWideRealtimeStatus,
} from './market-wide-realtime.service.js';

export interface MarketWideHistoryWarmupRouteService {
  getStatus():
    MarketWideHistoryWarmupStatus;
}

export interface MarketWideRealtimeRouteService {
  getStatus():
    MarketWideRealtimeStatus;

  getMetrics(
    symbol?: string,
    scannerWindow?:
      MarketScannerWindowId,
  ): MarketScannerMetrics[];
  getVolumeSpikes(
    symbol?: string,
    options?: MarketVolumeSpikeOptions,
  ): MarketVolumeSpike[];
}

interface MarketWideRealtimeRoutesOptions {
  marketWideRealtimeService:
    MarketWideRealtimeRouteService;

  marketWideHistoryWarmupService?:
    MarketWideHistoryWarmupRouteService;
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
      requestId: request.id,
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

  return /^[A-Z0-9]{5,30}$/
    .test(symbol)
      ? symbol
      : '';
}

const MARKET_VOLUME_SPIKE_PERIOD_MINUTES:
readonly number[] = [
  1,
  3,
  5,
  15,
];

const MARKET_VOLUME_SPIKE_STATUSES:
readonly MarketVolumeSpikeStatus[] = [
  'new',
  'growing',
  'stable',
  'fading',
];

function parseFiniteQueryNumber(
  value: string | undefined,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseIntegerQueryNumber(
  value: string | undefined,
): number | null | undefined {
  const parsed =
    parseFiniteQueryNumber(value);

  if (
    parsed === undefined
    || parsed === null
  ) {
    return parsed;
  }

  return Number.isInteger(parsed)
    ? parsed
    : null;
}

function isMarketVolumeSpikeStatus(
  value: string,
): value is MarketVolumeSpikeStatus {
  return MARKET_VOLUME_SPIKE_STATUSES
    .includes(
      value as MarketVolumeSpikeStatus,
    );
}

function parseVolumeSpikeStatuses(
  value: string | undefined,
):
  MarketVolumeSpikeStatus[]
  | null
  | undefined {
  if (value === undefined) {
    return undefined;
  }

  const statuses:
    MarketVolumeSpikeStatus[] = [];

  for (
    const item
    of value.split(',')
  ) {
    const status = item.trim();

    if (
      status.length === 0
      || !isMarketVolumeSpikeStatus(
        status,
      )
    ) {
      return null;
    }

    if (
      !statuses.includes(status)
    ) {
      statuses.push(status);
    }
  }

  return statuses.length > 0
    ? statuses
    : null;
}

export const marketWideRealtimeRoutes:
FastifyPluginAsync<
  MarketWideRealtimeRoutesOptions
> = async (
  app,
  options,
) => {
  app.get(
    '/market/realtime/market-wide/status',
    async () => ({
      ...options
        .marketWideRealtimeService
        .getStatus(),
      historyWarmup:
        options
          .marketWideHistoryWarmupService
          ?.getStatus()
        ?? null,
    }),
  );

  app.get<{
    Querystring: {
      symbol?: string;
      scannerWindow?: string;
    };
  }>(
    '/market/realtime/market-wide/scanner-metrics',
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
          'invalid_symbol',
          'Invalid symbol format',
        );
      }

      const scannerWindow =
        request.query
          .scannerWindow;

      if (
        scannerWindow !== undefined
        && !isMarketScannerWindowId(
          scannerWindow,
        )
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_market_wide_scanner_window',
          'Invalid market-wide scanner window',
        );
      }

      const metrics =
        options
          .marketWideRealtimeService
          .getMetrics(
            symbol ?? undefined,
            scannerWindow,
          );

      if (
        symbol
        && metrics.length === 0
      ) {
        return sendError(
          request,
          reply,
          404,
          'market_wide_symbol_not_found',
          `Symbol ${symbol} is not present in the market-wide universe`,
        );
      }

      return metrics;
    },
  );
  app.get<{
    Querystring: {
      symbol?: string;
      limit?: string;
      periodMinutes?: string;
      baselinePeriods?: string;
      minVolumeRatio?: string;
      minTradesRatio?: string;
      minCurrentQuoteVolume?: string;
      statuses?: string;
    };
  }>(
    '/market/realtime/market-wide/volume-spikes',
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
          'invalid_symbol',
          'Invalid symbol format',
        );
      }

      const requestedLimit =
        parseIntegerQueryNumber(
          request.query.limit,
        );

      if (
        requestedLimit === null
        || (
          requestedLimit !== undefined
          && (
            requestedLimit < 1
            || requestedLimit > 100
          )
        )
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_volume_spike_limit',
          'Volume spike limit must be an integer from 1 to 100',
        );
      }

      const requestedPeriodMinutes =
        parseIntegerQueryNumber(
          request.query.periodMinutes,
        );

      if (
        requestedPeriodMinutes === null
        || (
          requestedPeriodMinutes !== undefined
          && !MARKET_VOLUME_SPIKE_PERIOD_MINUTES
            .includes(
              requestedPeriodMinutes,
            )
        )
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_volume_spike_period_minutes',
          'Volume spike periodMinutes must be one of: 1, 3, 5, 15',
        );
      }

      const requestedBaselinePeriods =
        parseIntegerQueryNumber(
          request.query.baselinePeriods,
        );

      if (
        requestedBaselinePeriods === null
        || (
          requestedBaselinePeriods !== undefined
          && (
            requestedBaselinePeriods < 3
            || requestedBaselinePeriods > 48
          )
        )
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_volume_spike_baseline_periods',
          'Volume spike baselinePeriods must be an integer from 3 to 48',
        );
      }

      const requestedMinVolumeRatio =
        parseFiniteQueryNumber(
          request.query.minVolumeRatio,
        );

      if (
        requestedMinVolumeRatio === null
        || (
          requestedMinVolumeRatio !== undefined
          && (
            requestedMinVolumeRatio < 1
            || requestedMinVolumeRatio > 100
          )
        )
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_volume_spike_min_volume_ratio',
          'Volume spike minVolumeRatio must be from 1 to 100',
        );
      }

      const requestedMinTradesRatio =
        parseFiniteQueryNumber(
          request.query.minTradesRatio,
        );

      if (
        requestedMinTradesRatio === null
        || (
          requestedMinTradesRatio !== undefined
          && (
            requestedMinTradesRatio < 0.1
            || requestedMinTradesRatio > 100
          )
        )
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_volume_spike_min_trades_ratio',
          'Volume spike minTradesRatio must be from 0.1 to 100',
        );
      }

      const requestedMinCurrentQuoteVolume =
        parseFiniteQueryNumber(
          request.query.minCurrentQuoteVolume,
        );

      if (
        requestedMinCurrentQuoteVolume === null
        || (
          requestedMinCurrentQuoteVolume !== undefined
          && (
            requestedMinCurrentQuoteVolume < 0
            || requestedMinCurrentQuoteVolume
              > 1_000_000_000_000
          )
        )
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_volume_spike_min_current_quote_volume',
          'Volume spike minCurrentQuoteVolume must be from 0 to 1000000000000',
        );
      }

      const requestedStatuses =
        parseVolumeSpikeStatuses(
          request.query.statuses,
        );

      if (requestedStatuses === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_volume_spike_statuses',
          'Volume spike statuses must contain only: new, growing, stable, fading',
        );
      }

      const limit =
        requestedLimit
        ?? 20;

      const volumeSpikeOptions:
        MarketVolumeSpikeOptions = {
          ...DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS,
          periodMinutes:
            requestedPeriodMinutes
            ?? DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS
              .periodMinutes,
          baselinePeriods:
            requestedBaselinePeriods
            ?? DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS
              .baselinePeriods,
          minVolumeRatio:
            requestedMinVolumeRatio
            ?? DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS
              .minVolumeRatio,
          minTradesRatio:
            requestedMinTradesRatio
            ?? DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS
              .minTradesRatio,
          minCurrentQuoteVolume:
            requestedMinCurrentQuoteVolume
            ?? DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS
              .minCurrentQuoteVolume,
        };

      const allowedStatuses =
        requestedStatuses === undefined
          ? null
          : new Set(
              requestedStatuses,
            );

      return options
        .marketWideRealtimeService
        .getVolumeSpikes(
          symbol ?? undefined,
          volumeSpikeOptions,
        )
        .filter(
          (spike) =>
            allowedStatuses === null
            || allowedStatuses.has(
              spike.status,
            ),
        )
        .slice(
          0,
          limit,
        );
    },
  );
};
