import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../contracts/nexus-api.js';
import type {
  SetupDirection,
  SetupEngineStage,
} from './setup-engine.types.js';
import type {
  SetupEventHistoryOutcomeFilter,
  SetupEventHistoryReader,
} from './setup-event-history.types.js';
import type {
  SetupLifecycleEventType,
} from './setup-lifecycle-events.types.js';

export interface SetupEventHistoryRoutesOptions {
  setupEventHistoryReader?:
    SetupEventHistoryReader;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const CANDIDATE_ID_PATTERN =
  /^[A-Za-z0-9._:-]{1,300}$/;

const EVENT_TYPES:
readonly SetupLifecycleEventType[] = [
  'candidate_created',
  'stage_transition',
  'breakout_confirmed',
  'rejection_confirmed',
  'setup_expired',
];

const DIRECTIONS:
readonly SetupDirection[] = [
  'long',
  'short',
];

const STAGES:
readonly SetupEngineStage[] = [
  'LEVEL_CONFIRMED',
  'APPROACHING_THIRD_TOUCH',
  'THIRD_TOUCH_CONFIRMED',
  'BREAKOUT_CONFIRMED',
  'REJECTION_CONFIRMED',
  'SETUP_EXPIRED',
];

const OUTCOMES:
readonly SetupEventHistoryOutcomeFilter[] = [
  'pending',
  'breakout',
  'rejection',
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
    .status(
      statusCode,
    )
    .send(
      payload,
    );
}

function normalizeSymbol(
  value:
    string
    | undefined,
): string | null {
  if (
    value === undefined
  ) {
    return null;
  }

  const symbol =
    value
      .trim()
      .toUpperCase();

  return SYMBOL_PATTERN.test(
    symbol,
  )
    ? symbol
    : '';
}

function normalizeCandidateId(
  value:
    string
    | undefined,
): string | null {
  if (
    value === undefined
  ) {
    return null;
  }

  const candidateId =
    value.trim();

  return CANDIDATE_ID_PATTERN
    .test(
      candidateId,
    )
      ? candidateId
      : '';
}

function parseEnum<
  Value extends string,
>(
  value:
    string
    | undefined,

  allowedValues:
    readonly Value[],
):
  Value
  | null
  | undefined {
  if (
    value === undefined
  ) {
    return undefined;
  }

  const normalized =
    value.trim();

  return allowedValues.includes(
    normalized as Value,
  )
    ? normalized as Value
    : null;
}

function parseLimit(
  value:
    string
    | undefined,
): number | null {
  if (
    value === undefined
  ) {
    return 100;
  }

  if (
    value.trim().length === 0
  ) {
    return null;
  }

  const parsed =
    Number(
      value,
    );

  return (
    Number.isInteger(
      parsed,
    )
    && parsed >= 1
    && parsed <= 500
  )
    ? parsed
    : null;
}

function parseEventId(
  value: string,
): number | null {
  if (
    !/^[1-9][0-9]*$/
      .test(
        value,
      )
  ) {
    return null;
  }

  const eventId =
    Number(
      value,
    );

  return Number.isSafeInteger(
    eventId,
  )
    ? eventId
    : null;
}

export const setupEventHistoryRoutes:
FastifyPluginAsync<
  SetupEventHistoryRoutesOptions
> = async (
  app,
  options,
) => {
  app.get(
    '/setups/events/status',
    async (
      request,
      reply,
    ) => {
      const history =
        options
          .setupEventHistoryReader;

      if (!history) {
        return sendError(
          request,
          reply,
          503,
          'setup_event_history_unavailable',
          'Setup event history is unavailable',
        );
      }

      return history
        .getStatus();
    },
  );

  app.get<{
    Querystring: {
      candidateId?: string;
      symbol?: string;
      type?: string;
      direction?: string;
      stage?: string;
      outcome?: string;
      limit?: string;
    };
  }>(
    '/setups/events',
    async (
      request,
      reply,
    ) => {
      const candidateId =
        normalizeCandidateId(
          request.query
            .candidateId,
        );

      if (
        candidateId === ''
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_event_candidate_id',
          'Invalid setup event candidate id',
        );
      }

      const symbol =
        normalizeSymbol(
          request.query
            .symbol,
        );

      if (
        symbol === ''
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_event_symbol',
          'Invalid setup event symbol',
        );
      }

      const type =
        parseEnum(
          request.query
            .type,
          EVENT_TYPES,
        );

      if (
        type === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_event_type',
          'Invalid setup lifecycle event type',
        );
      }

      const direction =
        parseEnum(
          request.query
            .direction,
          DIRECTIONS,
        );

      if (
        direction === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_event_direction',
          'Setup event direction must be long or short',
        );
      }

      const stage =
        parseEnum(
          request.query
            .stage,
          STAGES,
        );

      if (
        stage === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_event_stage',
          'Invalid setup event stage',
        );
      }

      const outcome =
        parseEnum(
          request.query
            .outcome,
          OUTCOMES,
        );

      if (
        outcome === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_event_outcome',
          'Setup event outcome must be pending, breakout or rejection',
        );
      }

      const limit =
        parseLimit(
          request.query
            .limit,
        );

      if (
        limit === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_event_limit',
          'Setup event limit must be an integer from 1 to 500',
        );
      }

      const history =
        options
          .setupEventHistoryReader;

      if (!history) {
        return sendError(
          request,
          reply,
          503,
          'setup_event_history_unavailable',
          'Setup event history is unavailable',
        );
      }

      return history
        .getEvents({
          ...(
            candidateId
              ? {
                  candidateId,
                }
              : {}
          ),

          ...(
            symbol
              ? {
                  symbol,
                }
              : {}
          ),

          ...(
            type
              ? {
                  type,
                }
              : {}
          ),

          ...(
            direction
              ? {
                  direction,
                }
              : {}
          ),

          ...(
            stage
              ? {
                  currentStage:
                    stage,
                }
              : {}
          ),

          ...(
            outcome
              ? {
                  outcome,
                }
              : {}
          ),
        })
        .slice(
          0,
          limit,
        );
    },
  );

  app.get<{
    Params: {
      eventId: string;
    };
  }>(
    '/setups/events/:eventId',
    async (
      request,
      reply,
    ) => {
      const eventId =
        parseEventId(
          request.params
            .eventId,
        );

      if (
        eventId === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_event_id',
          'Setup event id must be a positive safe integer',
        );
      }

      const history =
        options
          .setupEventHistoryReader;

      if (!history) {
        return sendError(
          request,
          reply,
          503,
          'setup_event_history_unavailable',
          'Setup event history is unavailable',
        );
      }

      const event =
        history.getEvent(
          eventId,
        );

      if (!event) {
        return sendError(
          request,
          reply,
          404,
          'setup_event_not_found',
          `Setup event ${eventId} was not found`,
        );
      }

      return event;
    },
  );

  app.get<{
    Params: {
      candidateId: string;
    };

    Querystring: {
      limit?: string;
    };
  }>(
    '/setups/candidates/:candidateId/events',
    async (
      request,
      reply,
    ) => {
      const candidateId =
        normalizeCandidateId(
          request.params
            .candidateId,
        );

      if (
        candidateId === null
        || candidateId === ''
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_event_candidate_id',
          'Invalid setup event candidate id',
        );
      }

      const limit =
        parseLimit(
          request.query
            .limit,
        );

      if (
        limit === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_event_limit',
          'Setup event limit must be an integer from 1 to 500',
        );
      }

      const history =
        options
          .setupEventHistoryReader;

      if (!history) {
        return sendError(
          request,
          reply,
          503,
          'setup_event_history_unavailable',
          'Setup event history is unavailable',
        );
      }

      return history
        .getCandidateEvents(
          candidateId,
        )
        .slice(
          0,
          limit,
        );
    },
  );
};
