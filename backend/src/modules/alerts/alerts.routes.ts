import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../contracts/nexus-api.js';
import {
  ALERT_EVENT_TYPES,
  AlertsDomainError,
  type AlertEventSource,
  type AlertEventType,
  type AlertRuleCreateInput,
  type AlertRuleUpdateInput,
  type AlertsRuntimeContract,
} from './alerts.types.js';

export interface AlertsRoutesOptions {
  alertsRuntime?: AlertsRuntimeContract;
}

const ALERT_EVENT_SOURCES:
readonly AlertEventSource[] = [
  'custom',
  'market_scanner',
  'setup_lifecycle',
  'btc_market_mode',
  'adaptive_ranking',
];

function sendError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  error: string,
  message: string,
) {
  const payload: ApiErrorResponse = {
    error,
    message,
    requestId: request.id,
  };

  return reply
    .status(statusCode)
    .send(payload);
}

function sendDomainError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
) {
  if (error instanceof AlertsDomainError) {
    return sendError(
      request,
      reply,
      400,
      error.code,
      error.message,
    );
  }

  throw error;
}

function parseLimit(
  value: string | undefined,
): number | null {
  if (value === undefined) {
    return 100;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed)
    && parsed >= 1
    && parsed <= 500
      ? parsed
      : null;
}

function parseBoolean(
  value: string | undefined,
): boolean | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
}

function parseEventType(
  value: string | undefined,
): AlertEventType | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return ALERT_EVENT_TYPES.includes(
    value as AlertEventType,
  )
    ? value as AlertEventType
    : null;
}

function parseSource(
  value: string | undefined,
): AlertEventSource | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return ALERT_EVENT_SOURCES.includes(
    value as AlertEventSource,
  )
    ? value as AlertEventSource
    : null;
}

function requireRuntime(
  request: FastifyRequest,
  reply: FastifyReply,
  runtime: AlertsRuntimeContract | undefined,
): AlertsRuntimeContract | null {
  if (!runtime) {
    sendError(
      request,
      reply,
      503,
      'alerts_runtime_unavailable',
      'Alerts runtime is unavailable',
    );

    return null;
  }

  return runtime;
}

export const alertsRoutes:
FastifyPluginAsync<AlertsRoutesOptions> =
async (app, options) => {
  app.get(
    '/alerts/meta',
    async () => ({
      persistenceMode:
        options.alertsRuntime
          ?.getStatus()
          .persistenceMode
        ?? 'runtime_only' as const,
      eventTypes: ALERT_EVENT_TYPES,
      eventSources: ALERT_EVENT_SOURCES,
      deliveryChannels: [] as string[],
    }),
  );

  app.get(
    '/alerts/status',
    async (request, reply) => {
      const runtime = requireRuntime(
        request,
        reply,
        options.alertsRuntime,
      );

      return runtime
        ? runtime.getStatus()
        : reply;
    },
  );

  app.get<{
    Querystring: {
      enabled?: string;
      eventType?: string;
      source?: string;
      symbol?: string;
      timeframe?: string;
      limit?: string;
    };
  }>(
    '/alerts/rules',
    async (request, reply) => {
      const enabled =
        parseBoolean(request.query.enabled);
      const eventType =
        parseEventType(request.query.eventType);
      const source =
        parseSource(request.query.source);
      const limit =
        parseLimit(request.query.limit);

      if (enabled === null) {
        return sendError(request, reply, 400,
          'invalid_alert_rule_enabled_filter',
          'Alert rule enabled filter must be true or false');
      }

      if (eventType === null) {
        return sendError(request, reply, 400,
          'invalid_alert_event_type',
          'Invalid alert event type');
      }

      if (source === null) {
        return sendError(request, reply, 400,
          'invalid_alert_event_source',
          'Invalid alert event source');
      }

      if (limit === null) {
        return sendError(request, reply, 400,
          'invalid_alert_limit',
          'Alert limit must be an integer from 1 to 500');
      }

      const runtime = requireRuntime(
        request,
        reply,
        options.alertsRuntime,
      );

      if (!runtime) {
        return reply;
      }

      try {
        return runtime.getRules({
          ...(enabled !== undefined ? { enabled } : {}),
          ...(eventType !== undefined ? { eventType } : {}),
          ...(source !== undefined ? { source } : {}),
          ...(request.query.symbol !== undefined
            ? { symbol: request.query.symbol }
            : {}),
          ...(request.query.timeframe !== undefined
            ? { timeframe: request.query.timeframe }
            : {}),
        }).slice(0, limit);
      } catch (error) {
        return sendDomainError(request, reply, error);
      }
    },
  );

  app.post<{
    Body: AlertRuleCreateInput;
  }>(
    '/alerts/rules',
    async (request, reply) => {
      const runtime = requireRuntime(
        request,
        reply,
        options.alertsRuntime,
      );

      if (!runtime) {
        return reply;
      }

      try {
        const rule = runtime.createRule(
          request.body,
        );

        return reply.status(201).send(rule);
      } catch (error) {
        return sendDomainError(request, reply, error);
      }
    },
  );

  app.get<{
    Params: { ruleId: string };
  }>(
    '/alerts/rules/:ruleId',
    async (request, reply) => {
      const runtime = requireRuntime(
        request,
        reply,
        options.alertsRuntime,
      );

      if (!runtime) {
        return reply;
      }

      try {
        const rule = runtime.getRule(
          request.params.ruleId,
        );

        return rule ?? sendError(
          request,
          reply,
          404,
          'alert_rule_not_found',
          `Alert rule ${request.params.ruleId} was not found`,
        );
      } catch (error) {
        return sendDomainError(request, reply, error);
      }
    },
  );

  app.patch<{
    Params: { ruleId: string };
    Body: AlertRuleUpdateInput;
  }>(
    '/alerts/rules/:ruleId',
    async (request, reply) => {
      const runtime = requireRuntime(
        request,
        reply,
        options.alertsRuntime,
      );

      if (!runtime) {
        return reply;
      }

      try {
        const rule = runtime.updateRule(
          request.params.ruleId,
          request.body,
        );

        return rule ?? sendError(
          request,
          reply,
          404,
          'alert_rule_not_found',
          `Alert rule ${request.params.ruleId} was not found`,
        );
      } catch (error) {
        return sendDomainError(request, reply, error);
      }
    },
  );

  app.patch<{
    Params: { ruleId: string };
    Body: { enabled: boolean };
  }>(
    '/alerts/rules/:ruleId/enabled',
    async (request, reply) => {
      const runtime = requireRuntime(
        request,
        reply,
        options.alertsRuntime,
      );

      if (!runtime) {
        return reply;
      }

      try {
        const rule = runtime.setRuleEnabled(
          request.params.ruleId,
          request.body?.enabled,
        );

        return rule ?? sendError(
          request,
          reply,
          404,
          'alert_rule_not_found',
          `Alert rule ${request.params.ruleId} was not found`,
        );
      } catch (error) {
        return sendDomainError(request, reply, error);
      }
    },
  );

  app.get<{
    Querystring: {
      ruleId?: string;
      eventType?: string;
      source?: string;
      symbol?: string;
      timeframe?: string;
      limit?: string;
    };
  }>(
    '/alerts/triggers',
    async (request, reply) => {
      const eventType =
        parseEventType(request.query.eventType);
      const source =
        parseSource(request.query.source);
      const limit =
        parseLimit(request.query.limit);

      if (eventType === null) {
        return sendError(request, reply, 400,
          'invalid_alert_event_type',
          'Invalid alert event type');
      }

      if (source === null) {
        return sendError(request, reply, 400,
          'invalid_alert_event_source',
          'Invalid alert event source');
      }

      if (limit === null) {
        return sendError(request, reply, 400,
          'invalid_alert_limit',
          'Alert limit must be an integer from 1 to 500');
      }

      const runtime = requireRuntime(
        request,
        reply,
        options.alertsRuntime,
      );

      if (!runtime) {
        return reply;
      }

      try {
        return runtime.getTriggers({
          ...(request.query.ruleId !== undefined
            ? { ruleId: request.query.ruleId }
            : {}),
          ...(eventType !== undefined ? { eventType } : {}),
          ...(source !== undefined ? { source } : {}),
          ...(request.query.symbol !== undefined
            ? { symbol: request.query.symbol }
            : {}),
          ...(request.query.timeframe !== undefined
            ? { timeframe: request.query.timeframe }
            : {}),
        }).slice(0, limit);
      } catch (error) {
        return sendDomainError(request, reply, error);
      }
    },
  );

  app.get<{
    Params: { triggerId: string };
  }>(
    '/alerts/triggers/:triggerId',
    async (request, reply) => {
      const runtime = requireRuntime(
        request,
        reply,
        options.alertsRuntime,
      );

      if (!runtime) {
        return reply;
      }

      try {
        const trigger = runtime.getTrigger(
          request.params.triggerId,
        );

        return trigger ?? sendError(
          request,
          reply,
          404,
          'alert_trigger_not_found',
          `Alert trigger ${request.params.triggerId} was not found`,
        );
      } catch (error) {
        return sendDomainError(request, reply, error);
      }
    },
  );
};
