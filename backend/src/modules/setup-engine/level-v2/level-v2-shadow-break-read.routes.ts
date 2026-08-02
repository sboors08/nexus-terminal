import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../../contracts/nexus-api.js';
import type {
  LevelV2BreakClassificationStatus,
} from './level-v2-break-classification.types.js';
import type {
  LevelV2ShadowRuntimeReader,
} from './level-v2-shadow-runtime.types.js';
import type {
  LevelV2Kind,
} from './level-v2-zones-score.types.js';
import type {
  LevelV2ShadowBreakDiagnostics,
  LevelV2ShadowBreakReadFilters,
  LevelV2ShadowBreakReadItem,
  LevelV2ShadowBreakReadListResponse,
} from './level-v2-shadow-break-read.types.js';

export interface LevelV2ShadowBreakReadRoutesOptions {
  levelV2ShadowRuntimeReader?:
    LevelV2ShadowRuntimeReader;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const LEVEL_ID_PATTERN =
  /^[A-Za-z0-9:._-]{1,240}$/;

const LEVEL_KINDS:
readonly LevelV2Kind[] = [
  'support',
  'resistance',
];

const BREAK_STATUSES:
readonly LevelV2BreakClassificationStatus[] = [
  'idle',
  'pierce',
  'breakout_pending',
  'breakout_confirmed',
  'false_breakout',
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
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const symbol =
    value.trim().toUpperCase();

  return SYMBOL_PATTERN.test(
    symbol,
  )
    ? symbol
    : null;
}

function normalizeLevelId(
  value:
    string
    | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const levelId =
    value.trim();

  return LEVEL_ID_PATTERN.test(
    levelId,
  )
    ? levelId
    : null;
}

function parseKind(
  value:
    string
    | undefined,
): LevelV2Kind | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized =
    value.trim();

  return LEVEL_KINDS.includes(
    normalized as
      LevelV2Kind,
  )
    ? normalized as
        LevelV2Kind
    : null;
}

function parseStatus(
  value:
    string
    | undefined,
): LevelV2BreakClassificationStatus | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized =
    value.trim();

  return BREAK_STATUSES.includes(
    normalized as
      LevelV2BreakClassificationStatus,
  )
    ? normalized as
        LevelV2BreakClassificationStatus
    : null;
}

function parseLimit(
  value:
    string
    | undefined,
): number | null {
  if (value === undefined) {
    return 100;
  }

  if (value.trim().length === 0) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isInteger(parsed)
    && parsed >= 1
    && parsed <= 500
      ? parsed
      : null;
}

function emptyStatusCounts():
Record<
  LevelV2BreakClassificationStatus,
  number
> {
  return {
    idle: 0,
    pierce: 0,
    breakout_pending: 0,
    breakout_confirmed: 0,
    false_breakout: 0,
  };
}

function emptyKindCounts():
Record<
  LevelV2Kind,
  number
> {
  return {
    support: 0,
    resistance: 0,
  };
}

function buildItems(
  runtime:
    LevelV2ShadowRuntimeReader,
  filters:
    LevelV2ShadowBreakReadFilters,
): {
  items: LevelV2ShadowBreakReadItem[];
  matchedCount: number;
  totalClassifications: number;
} {
  const snapshots =
    runtime.getSnapshots();

  const allItems:
    LevelV2ShadowBreakReadItem[] = [];

  let totalClassifications = 0;

  for (
    const snapshot
    of snapshots
  ) {
    const states =
      snapshot.breakClassifications
      ?? [];

    totalClassifications +=
      states.length;

    if (
      filters.symbol !== null
      && snapshot.symbol
        !== filters.symbol
    ) {
      continue;
    }

    const events =
      snapshot.breakClassificationEvents
      ?? [];

    const marketEvidence =
      snapshot.marketEvidence
      ?? [];

    for (
      const state
      of states
    ) {
      if (
        filters.levelId !== null
        && state.level.id
          !== filters.levelId
      ) {
        continue;
      }

      if (
        filters.kind !== null
        && state.currentKind
          !== filters.kind
      ) {
        continue;
      }

      if (
        filters.status !== null
        && state.status
          !== filters.status
      ) {
        continue;
      }

      allItems.push({
        symbol:
          snapshot.symbol,
        timeframe:
          snapshot.timeframe,
        generatedAt:
          snapshot.generatedAt,
        state,
        events:
          events.filter(
            (event) =>
              event.classifierId
                === state.id,
          ),
        marketEvidence:
          marketEvidence.find(
            (evidence) =>
              evidence.classifierId
                === state.id,
          )
          ?? null,
      });
    }
  }

  allItems.sort(
    (
      left,
      right,
    ) =>
      Date.parse(
        right.generatedAt,
      )
      - Date.parse(
          left.generatedAt,
        )
      || left.symbol.localeCompare(
        right.symbol,
      )
      || left.state.level.id
        .localeCompare(
          right.state.level.id,
        )
      || left.state.id.localeCompare(
        right.state.id,
      ),
  );

  return {
    items:
      allItems.slice(
        0,
        filters.limit,
      ),
    matchedCount:
      allItems.length,
    totalClassifications,
  };
}

function buildDiagnostics(
  runtime:
    LevelV2ShadowRuntimeReader,
): LevelV2ShadowBreakDiagnostics {
  const snapshots =
    runtime.getSnapshots();

  const statusCounts =
    emptyStatusCounts();

  const kindCounts =
    emptyKindCounts();

  let classificationsCount = 0;
  let eventsCount = 0;
  let marketEvidenceCount = 0;
  let completeMarketEvidenceCount = 0;
  let tapeAvailableCount = 0;
  let orderBookAvailableCount = 0;
  let marketEvidenceSourceErrorsCount = 0;
  let maxPenetrationDepthPct = 0;
  let latestGeneratedAt:
    string | null = null;

  const symbols =
    new Set<string>();

  for (
    const snapshot
    of snapshots
  ) {
    const states =
      snapshot.breakClassifications
      ?? [];

    const events =
      snapshot.breakClassificationEvents
      ?? [];

    const marketEvidence =
      snapshot.marketEvidence
      ?? [];

    const hasBreakData =
      states.length > 0
      || events.length > 0;

    if (hasBreakData) {
      symbols.add(
        snapshot.symbol,
      );
    }

    classificationsCount +=
      states.length;

    eventsCount +=
      events.length;

    marketEvidenceCount +=
      marketEvidence.length;

    for (
      const evidence
      of marketEvidence
    ) {
      if (
        evidence.availability
          === 'complete'
      ) {
        completeMarketEvidenceCount += 1;
      }

      if (evidence.tape) {
        tapeAvailableCount += 1;
      }

      if (evidence.orderBook) {
        orderBookAvailableCount += 1;
      }

      marketEvidenceSourceErrorsCount +=
        evidence.sourceErrors.length;
    }

    for (
      const state
      of states
    ) {
      statusCounts[
        state.status
      ] += 1;

      kindCounts[
        state.currentKind
      ] += 1;

      maxPenetrationDepthPct =
        Math.max(
          maxPenetrationDepthPct,
          state.maxPenetrationDepthPct,
        );
    }

    if (
      hasBreakData
      && (
        latestGeneratedAt === null
        || Date.parse(
          snapshot.generatedAt,
        ) > Date.parse(
          latestGeneratedAt,
        )
      )
    ) {
      latestGeneratedAt =
        snapshot.generatedAt;
    }
  }

  return {
    runtime:
      runtime.getStatus(),
    symbolsCount:
      symbols.size,
    classificationsCount,
    eventsCount,
    marketEvidenceCount,
    completeMarketEvidenceCount,
    tapeAvailableCount,
    orderBookAvailableCount,
    marketEvidenceSourceErrorsCount,
    statusCounts,
    kindCounts,
    maxPenetrationDepthPct,
    latestGeneratedAt,
  };
}

export const levelV2ShadowBreakReadRoutes:
FastifyPluginAsync<
  LevelV2ShadowBreakReadRoutesOptions
> = async (
  app,
  options,
) => {
  app.get<{
    Querystring: {
      symbol?: string;
      levelId?: string;
      kind?: string;
      status?: string;
      limit?: string;
    };
  }>(
    '/setups/levels-v2/shadow/break-classifications',
    async (
      request,
      reply,
    ) => {
      const symbol =
        normalizeSymbol(
          request.query.symbol,
        );

      if (symbol === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_break_symbol',
          'Invalid Level v2 shadow break-classification symbol',
        );
      }

      const levelId =
        normalizeLevelId(
          request.query.levelId,
        );

      if (levelId === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_break_level_id',
          'Invalid Level v2 shadow break-classification levelId',
        );
      }

      const kind =
        parseKind(
          request.query.kind,
        );

      if (kind === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_break_kind',
          'Level v2 shadow break-classification kind must be support or resistance',
        );
      }

      const status =
        parseStatus(
          request.query.status,
        );

      if (status === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_break_status',
          'Invalid Level v2 shadow break-classification status',
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
          'invalid_level_v2_shadow_break_limit',
          'Level v2 shadow break-classification limit must be an integer from 1 to 500',
        );
      }

      const runtime =
        options
          .levelV2ShadowRuntimeReader;

      if (!runtime) {
        return sendError(
          request,
          reply,
          503,
          'level_v2_shadow_runtime_unavailable',
          'Level v2 shadow runtime is unavailable',
        );
      }

      const filters:
      LevelV2ShadowBreakReadFilters = {
        symbol:
          symbol
          ?? null,
        levelId:
          levelId
          ?? null,
        kind:
          kind
          ?? null,
        status:
          status
          ?? null,
        limit,
      };

      const result =
        buildItems(
          runtime,
          filters,
        );

      const response:
      LevelV2ShadowBreakReadListResponse = {
        items:
          result.items,
        count:
          result.items.length,
        matchedCount:
          result.matchedCount,
        totalClassifications:
          result.totalClassifications,
        filters,
      };

      return response;
    },
  );

  app.get(
    '/setups/levels-v2/shadow/break-classifications/diagnostics',
    async (
      request,
      reply,
    ) => {
      const runtime =
        options
          .levelV2ShadowRuntimeReader;

      if (!runtime) {
        return sendError(
          request,
          reply,
          503,
          'level_v2_shadow_runtime_unavailable',
          'Level v2 shadow runtime is unavailable',
        );
      }

      return buildDiagnostics(
        runtime,
      );
    },
  );
};
