import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../contracts/nexus-api.js';
import type {
  LevelEngineFrozenSampleReader,
} from './level-engine-frozen-sample-reader.js';

export interface LevelEngineFrozenSampleReadRoutesOptions {
  readonly levelEngineFrozenSampleReader:
    LevelEngineFrozenSampleReader;
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

export const levelEngineFrozenSampleReadRoutes:
FastifyPluginAsync<
  LevelEngineFrozenSampleReadRoutesOptions
> = async (
  app,
  options,
) => {
  app.get(
    '/level-engine/frozen-sample/latest',
    async (
      request,
      reply,
    ) => {
      try {
        const sample =
          await options
            .levelEngineFrozenSampleReader
            .readLatest();

        if (!sample) {
          return sendError(
            request,
            reply,
            404,
            'level_engine_frozen_sample_not_found',
            'Latest Level Engine frozen sample was not found',
          );
        }

        return sample;
      } catch (error: unknown) {
        request.log.error(
          {
            error,
          },
          'Failed to read latest Level Engine frozen sample',
        );

        return sendError(
          request,
          reply,
          503,
          'level_engine_frozen_sample_unavailable',
          'Latest Level Engine frozen sample is unavailable',
        );
      }
    },
  );
};