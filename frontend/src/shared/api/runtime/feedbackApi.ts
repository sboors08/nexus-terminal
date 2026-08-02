import type {
  ApiMutationResult,
  FeedbackPayload,
  SetupFeedback,
} from '../contracts';

export const RUNTIME_FEEDBACK_PATH =
  '/api/v1/feedback';

export const RUNTIME_SETUP_FEEDBACK_PATH =
  '/api/v1/setup-feedback';

export type RuntimeFeedbackFetch =
  typeof globalThis.fetch;

export interface FetchRuntimeFeedbackOptions {
  baseUrl?: string;
  signal?: AbortSignal;
  fetcher?: RuntimeFeedbackFetch;
}

type JsonRecord =
  Record<string, unknown>;

function normalizeBaseUrl(
  value: string | undefined,
): string {
  return (
    value
      ?.trim()
      .replace(/\/+$/u, '')
    ?? ''
  );
}

function readMutationRecord(
  value: unknown,
): JsonRecord {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    throw new Error(
      'Invalid feedback mutation response',
    );
  }

  return value as JsonRecord;
}

export function parseRuntimeFeedbackResult(
  value: unknown,
): ApiMutationResult {
  const record =
    readMutationRecord(value);

  const id =
    record.id;

  const acceptedAt =
    record.acceptedAt;

  if (
    typeof id !== 'string'
    || id.trim().length === 0
  ) {
    throw new Error(
      'Invalid feedback mutation id',
    );
  }

  if (
    typeof acceptedAt !== 'string'
    || acceptedAt.trim().length === 0
    || !Number.isFinite(
      Date.parse(acceptedAt),
    )
  ) {
    throw new Error(
      'Invalid feedback mutation acceptedAt',
    );
  }

  return {
    id,
    acceptedAt,
  };
}

const defaultFetch:
RuntimeFeedbackFetch = (
  input,
  init,
) =>
  globalThis.fetch(
    input,
    init,
  );

async function sendRuntimeFeedback(
  path: string,
  payload:
    FeedbackPayload
    | SetupFeedback,
  label: string,
  options:
    FetchRuntimeFeedbackOptions,
): Promise<ApiMutationResult> {
  const response =
    await (
      options.fetcher
      ?? defaultFetch
    )(
      normalizeBaseUrl(
        options.baseUrl,
      )
      + path,
      {
        method:
          'POST',

        headers: {
          accept:
            'application/json',

          'content-type':
            'application/json',
        },

        body:
          JSON.stringify(payload),

        signal:
          options.signal,
      },
    );

  let responsePayload:
    unknown;

  try {
    responsePayload =
      await response.json();
  } catch {
    throw new Error(
      `${label} returned invalid JSON`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `${label} request failed with status ${response.status}`,
    );
  }

  return parseRuntimeFeedbackResult(
    responsePayload,
  );
}

export function fetchRuntimeFeedback(
  payload: FeedbackPayload,
  options:
    FetchRuntimeFeedbackOptions = {},
): Promise<ApiMutationResult> {
  return sendRuntimeFeedback(
    RUNTIME_FEEDBACK_PATH,
    payload,
    'Feedback',
    options,
  );
}

export function fetchRuntimeSetupFeedback(
  payload: SetupFeedback,
  options:
    FetchRuntimeFeedbackOptions = {},
): Promise<ApiMutationResult> {
  return sendRuntimeFeedback(
    RUNTIME_SETUP_FEEDBACK_PATH,
    payload,
    'Setup feedback',
    options,
  );
}
