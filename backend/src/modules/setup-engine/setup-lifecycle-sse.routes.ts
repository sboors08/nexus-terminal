import type {
  ServerResponse,
} from 'node:http';
import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../contracts/nexus-api.js';
import type {
  SetupDetectionRuntimeEventSource,
} from './setup-detection-runtime.types.js';
import type {
  SetupEventHistoryFilters,
  SetupEventHistoryReader,
} from './setup-event-history.types.js';
import type {
  SetupLifecycleEvent,
} from './setup-lifecycle-events.types.js';

const SSE_HEARTBEAT_INTERVAL_MS =
  15_000;

const SSE_RETRY_INTERVAL_MS =
  3_000;

const SSE_REPLAY_LIMIT =
  500;

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const CANDIDATE_ID_PATTERN =
  /^[A-Za-z0-9._:-]{1,300}$/;

export interface SetupLifecycleSseRoutesOptions {
  setupEventHistoryReader?:
    SetupEventHistoryReader;

  setupDetectionRuntimeEventSource?:
    SetupDetectionRuntimeEventSource;
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

  return CANDIDATE_ID_PATTERN.test(
    candidateId,
  )
    ? candidateId
    : '';
}

function parseResumeEventId(
  value:
    string
    | undefined,
):
  number
  | null
  | undefined {
  if (
    value === undefined
  ) {
    return undefined;
  }

  if (
    !/^(0|[1-9][0-9]*)$/
      .test(
        value,
      )
  ) {
    return null;
  }

  const parsed =
    Number(
      value,
    );

  return Number.isSafeInteger(
    parsed,
  )
    ? parsed
    : null;
}

function matchesFilters(
  event:
    SetupLifecycleEvent,

  filters:
    SetupEventHistoryFilters,
): boolean {
  return (
    (
      filters.candidateId
      === undefined
      || event.candidateId
        === filters.candidateId
    )
    && (
      filters.symbol
      === undefined
      || event.symbol
        === filters.symbol
    )
  );
}

function writeSseEvent(
  response:
    ServerResponse,

  eventName:
    string,

  data:
    unknown,

  eventId?:
    number,
): void {
  if (
    response.destroyed
    || response.writableEnded
  ) {
    return;
  }

  if (
    eventId !== undefined
  ) {
    response.write(
      `id: ${eventId}\n`,
    );
  }

  response.write(
    `event: ${eventName}\n`,
  );

  response.write(
    `data: ${JSON.stringify(
      data,
    )}\n\n`,
  );
}

export const setupLifecycleSseRoutes:
FastifyPluginAsync<
  SetupLifecycleSseRoutesOptions
> = async (
  app,
  options,
) => {
  app.get<{
    Querystring: {
      candidateId?: string;
      symbol?: string;
      afterEventId?: string;
    };
  }>(
    '/setups/events/stream',
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

      const queryResumeEventId =
        parseResumeEventId(
          request.query
            .afterEventId,
        );

      if (
        queryResumeEventId === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_event_resume_id',
          'afterEventId must be a non-negative safe integer',
        );
      }

      const rawLastEventId =
        request.headers[
          'last-event-id'
        ];

      if (
        Array.isArray(
          rawLastEventId,
        )
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_event_resume_id',
          'Last-Event-ID must be a non-negative safe integer',
        );
      }

      const headerResumeEventId =
        parseResumeEventId(
          rawLastEventId,
        );

      if (
        headerResumeEventId === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_event_resume_id',
          'Last-Event-ID must be a non-negative safe integer',
        );
      }

      const history =
        options
          .setupEventHistoryReader;

      const eventSource =
        options
          .setupDetectionRuntimeEventSource;

      if (
        !history
        || !eventSource
      ) {
        return sendError(
          request,
          reply,
          503,
          'setup_lifecycle_stream_unavailable',
          'Setup lifecycle stream is unavailable',
        );
      }

      const filters:
      SetupEventHistoryFilters = {
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
      };

      const resumeEventId =
        headerResumeEventId
        ?? queryResumeEventId
        ?? null;

      reply.hijack();

      const response =
        reply.raw;

      response.statusCode =
        200;

      response.setHeader(
        'Content-Type',
        'text/event-stream; charset=utf-8',
      );

      response.setHeader(
        'Cache-Control',
        'no-cache, no-transform',
      );

      response.setHeader(
        'Connection',
        'keep-alive',
      );

      response.setHeader(
        'X-Accel-Buffering',
        'no',
      );

      response.flushHeaders();

      response.write(
        `retry: ${SSE_RETRY_INTERVAL_MS}\n\n`,
      );

      const historyStatus =
        history.getStatus();

      writeSseEvent(
        response,
        'ready',
        {
          connectedAt:
            new Date()
              .toISOString(),

          firstEventId:
            historyStatus
              .firstEventId,

          lastEventId:
            historyStatus
              .lastEventId,

          replayLimit:
            SSE_REPLAY_LIMIT,

          filters,
        },
      );

      let lastSentEventId =
        resumeEventId
        ?? 0;

      const sendLifecycleEvent = (
        event:
          SetupLifecycleEvent,
      ) => {
        if (
          event.eventId
          <= lastSentEventId
          || !matchesFilters(
            event,
            filters,
          )
        ) {
          return;
        }

        writeSseEvent(
          response,
          'setup_event',
          event,
          event.eventId,
        );

        lastSentEventId =
          event.eventId;
      };

      let replaying =
        true;

      const pendingLiveEvents:
      SetupLifecycleEvent[] = [];

      const handleLiveEvent = (
        event:
          SetupLifecycleEvent,
      ) => {
        if (
          replaying
        ) {
          pendingLiveEvents.push(
            structuredClone(
              event,
            ),
          );

          return;
        }

        sendLifecycleEvent(
          event,
        );
      };

      const unsubscribe =
        eventSource
          .subscribeLifecycleEvents(
            handleLiveEvent,
          );

      if (
        resumeEventId !== null
      ) {
        const replayEvents =
          history
            .getEvents(
              filters,
            )
            .filter(
              (event) =>
                event.eventId
                > resumeEventId,
            )
            .sort(
              (
                left,
                right,
              ) =>
                left.eventId
                - right.eventId,
            )
            .slice(
              0,
              SSE_REPLAY_LIMIT,
            );

        for (
          const event
          of replayEvents
        ) {
          sendLifecycleEvent(
            event,
          );
        }
      }

      replaying =
        false;

      pendingLiveEvents.sort(
        (
          left,
          right,
        ) =>
          left.eventId
          - right.eventId,
      );

      for (
        const event
        of pendingLiveEvents
      ) {
        sendLifecycleEvent(
          event,
        );
      }

      const heartbeat =
        setInterval(
          () => {
            if (
              response.destroyed
              || response.writableEnded
            ) {
              return;
            }

            response.write(
              ': heartbeat '
              + new Date()
                  .toISOString()
              + '\n\n',
            );
          },
          SSE_HEARTBEAT_INTERVAL_MS,
        );

      heartbeat.unref();

      let cleanedUp =
        false;

      const cleanup =
        () => {
          if (
            cleanedUp
          ) {
            return;
          }

          cleanedUp =
            true;

          clearInterval(
            heartbeat,
          );

          unsubscribe();
        };

      response.once(
        'close',
        cleanup,
      );

      response.once(
        'error',
        cleanup,
      );

      return reply;
    },
  );
};
