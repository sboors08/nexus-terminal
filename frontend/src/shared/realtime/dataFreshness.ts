export type DataFreshnessState =
  | 'live'
  | 'collecting'
  | 'stale'
  | 'error'
  | 'offline';

export type DataFreshnessTone =
  | 'live'
  | 'pending'
  | 'warning'
  | 'error'
  | 'offline';

export type DataErrorKind =
  | 'timeout'
  | 'rate-limit'
  | 'network'
  | 'server'
  | 'invalid-data'
  | 'unknown';

export type DataFreshnessSourceState =
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'error'
  | 'offline';

export interface DataFreshnessInput {
  hasData: boolean;
  sourceState:
    DataFreshnessSourceState;
  updatedAt:
    string
    | null;
  error:
    unknown;
  staleAfterMs: number;
  now?: number;
}

export interface DataFreshness {
  state:
    DataFreshnessState;
  tone:
    DataFreshnessTone;
  label:
    'LIVE'
    | 'COLLECTING'
    | 'STALE'
    | 'ERROR'
    | 'OFFLINE';
  hasData: boolean;
  lastUpdatedAt:
    string
    | null;
  ageMs:
    number
    | null;
  lastUpdatedLabel: string;
  errorKind:
    DataErrorKind
    | null;
  message: string;
}

function readErrorText(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return [
      error.name,
      error.message,
    ].join(' ');
  }

  if (
    typeof error === 'string'
  ) {
    return error;
  }

  if (
    typeof error === 'object'
    && error !== null
  ) {
    const candidate =
      error as {
        message?: unknown;
        status?: unknown;
        statusCode?: unknown;
      };

    return [
      candidate.message,
      candidate.status,
      candidate.statusCode,
    ]
      .filter(
        (
          value,
        ): value is string | number =>
          typeof value === 'string'
          || typeof value === 'number',
      )
      .join(' ');
  }

  return '';
}

export function classifyDataError(
  error: unknown,
): DataErrorKind {
  const text =
    readErrorText(
      error,
    )
      .toLocaleLowerCase(
        'ru-RU',
      );

  if (
    text.includes(
      'timeout',
    )
    || text.includes(
      'timed out',
    )
    || text.includes(
      'тайм-аут',
    )
    || text.includes(
      'превышено время',
    )
  ) {
    return 'timeout';
  }

  if (
    text.includes(
      '429',
    )
    || text.includes(
      'rate limit',
    )
    || text.includes(
      'too many requests',
    )
    || text.includes(
      'слишком много запросов',
    )
    || text.includes(
      'лимит запросов',
    )
  ) {
    return 'rate-limit';
  }

  if (
    /\b5\d\d\b/u.test(
      text,
    )
    || text.includes(
      'server error',
    )
    || text.includes(
      'ошибка сервера',
    )
  ) {
    return 'server';
  }

  if (
    text.includes(
      'failed to fetch',
    )
    || text.includes(
      'network',
    )
    || text.includes(
      'connection',
    )
    || text.includes(
      'offline',
    )
    || text.includes(
      'сеть',
    )
    || text.includes(
      'соединение',
    )
    || text.includes(
      'подключение',
    )
  ) {
    return 'network';
  }

  if (
    text.includes(
      'invalid',
    )
    || text.includes(
      'parse',
    )
    || text.includes(
      'payload',
    )
    || text.includes(
      'json',
    )
    || text.includes(
      'некоррект',
    )
    || text.includes(
      'невалид',
    )
  ) {
    return 'invalid-data';
  }

  return 'unknown';
}

export function formatDataFreshnessAge(
  ageMs: number | null,
): string {
  if (
    ageMs === null
    || !Number.isFinite(
      ageMs,
    )
    || ageMs < 0
  ) {
    return 'время обновления неизвестно';
  }

  if (ageMs < 5_000) {
    return 'обновлено только что';
  }

  if (ageMs < 60_000) {
    return `обновлено ${Math.floor(
      ageMs / 1_000,
    )} сек. назад`;
  }

  if (ageMs < 3_600_000) {
    return `обновлено ${Math.floor(
      ageMs / 60_000,
    )} мин. назад`;
  }

  if (ageMs < 86_400_000) {
    return `обновлено ${Math.floor(
      ageMs / 3_600_000,
    )} ч назад`;
  }

  return `обновлено ${Math.floor(
    ageMs / 86_400_000,
  )} дн. назад`;
}

function getAgeMs(
  updatedAt:
    string
    | null,
  now: number,
): number | null {
  if (updatedAt === null) {
    return null;
  }

  const timestamp =
    Date.parse(
      updatedAt,
    );

  if (
    !Number.isFinite(
      timestamp,
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    now - timestamp,
  );
}

function getFreshnessMetadata(
  state:
    DataFreshnessState,
): {
  tone: DataFreshnessTone;
  label: DataFreshness['label'];
  message: string;
} {
  switch (state) {
    case 'live':
      return {
        tone:
          'live',
        label:
          'LIVE',
        message:
          'Данные поступают в реальном времени.',
      };

    case 'collecting':
      return {
        tone:
          'pending',
        label:
          'COLLECTING',
        message:
          'Подключаемся и собираем первые данные.',
      };

    case 'stale':
      return {
        tone:
          'warning',
        label:
          'STALE',
        message:
          'Показаны последние доступные данные. Текущее обновление прервано.',
      };

    case 'error':
      return {
        tone:
          'error',
        label:
          'ERROR',
        message:
          'Не удалось загрузить данные. Повторите запрос.',
      };

    case 'offline':
      return {
        tone:
          'offline',
        label:
          'OFFLINE',
        message:
          'Нет подключения к источнику данных.',
      };
  }
}

export function resolveDataFreshness(
  input:
    DataFreshnessInput,
): DataFreshness {
  if (
    !Number.isFinite(
      input.staleAfterMs,
    )
    || input.staleAfterMs < 0
  ) {
    throw new Error(
      'staleAfterMs must be a non-negative finite number',
    );
  }

  const now =
    input.now
    ?? Date.now();

  const ageMs =
    getAgeMs(
      input.updatedAt,
      now,
    );

  const errorKind =
    input.error === null
    || input.error === undefined
      ? null
      : classifyDataError(
          input.error,
        );

  let state:
    DataFreshnessState;

  if (!input.hasData) {
    if (
      input.sourceState
      === 'offline'
    ) {
      state =
        'offline';
    }
    else if (
      input.sourceState
      === 'error'
      || errorKind !== null
    ) {
      state =
        'error';
    }
    else {
      state =
        'collecting';
    }
  }
  else {
    const dataIsRecent =
      ageMs !== null
      && ageMs
        <= input.staleAfterMs;

    const sourceIsHealthy =
      input.sourceState
        === 'open'
      && errorKind === null;

    state =
      dataIsRecent
      && sourceIsHealthy
        ? 'live'
        : 'stale';
  }

  const metadata =
    getFreshnessMetadata(
      state,
    );

  return {
    state,
    tone:
      metadata.tone,
    label:
      metadata.label,
    hasData:
      input.hasData,
    lastUpdatedAt:
      input.updatedAt,
    ageMs,
    lastUpdatedLabel:
      formatDataFreshnessAge(
        ageMs,
      ),
    errorKind,
    message:
      metadata.message,
  };
}
