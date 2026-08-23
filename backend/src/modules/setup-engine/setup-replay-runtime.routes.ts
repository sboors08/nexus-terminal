import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../contracts/nexus-api.js';
import type {
  SetupEventHistoryReader,
} from './setup-event-history.types.js';
import {
  buildSetupReplayRuntimeResponse,
} from './setup-replay-runtime.js';

export interface SetupReplayRuntimeRoutesOptions {
  setupEventHistoryReader?:
    SetupEventHistoryReader;
}

const CANDIDATE_ID_PATTERN =
  /^[A-Za-z0-9._:-]{1,300}$/;

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

function normalizeCandidateId(
  value: string,
): string | null {
  const candidateId =
    value.trim();

  return CANDIDATE_ID_PATTERN
    .test(
      candidateId,
    )
      ? candidateId
      : null;
}

export const setupReplayRuntimeRoutes:
FastifyPluginAsync<
  SetupReplayRuntimeRoutesOptions
> = async (
  app,
  options,
) => {
  app.get<{
    Params: {
      candidateId: string;
    };
  }>(
    '/setups/candidates/:candidateId/replay',
    async (
      request,
      reply,
    ) => {
      const candidateId =
        normalizeCandidateId(
          request.params
            .candidateId,
        );

      if (!candidateId) {
        return sendError(
          request,
          reply,
          400,
          'invalid_setup_replay_candidate_id',
          'Invalid Setup Replay candidate id',
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
          'setup_replay_runtime_unavailable',
          'Persistent Setup event history is unavailable',
        );
      }

      const response =
        buildSetupReplayRuntimeResponse(
          history,
          candidateId,
        );

      if (!response) {
        return sendError(
          request,
          reply,
          404,
          'setup_replay_not_found',
          'Setup Replay history was not found',
        );
      }

      return response;
    },
  );
};
