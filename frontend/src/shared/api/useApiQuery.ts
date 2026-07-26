import {
  useEffect,
  useRef,
  useState,
} from 'react';

export type ApiQueryStatus =
  | 'loading'
  | 'success'
  | 'error';

export interface ApiQueryResult<T> {
  status:
    ApiQueryStatus;

  data:
    T | null;

  error:
    Error | null;

  retry:
    () => void;
}

export interface ApiQueryOptions {
  intervalMs?: number;
  preserveData?: boolean;
}

export function useApiQuery<T>(
  key: string,
  loader: () => Promise<T>,
  options:
    ApiQueryOptions = {},
): ApiQueryResult<T> {
  const loaderRef =
    useRef(loader);

  loaderRef.current =
    loader;

  const intervalMs =
    options.intervalMs ?? 0;

  const preserveData =
    options.preserveData ?? false;

  const [
    retryToken,
    setRetryToken,
  ] = useState(0);

  const [
    state,
    setState,
  ] = useState<
    Omit<
      ApiQueryResult<T>,
      'retry'
    >
  >({
    status:
      'loading',

    data:
      null,

    error:
      null,
  });

  useEffect(
    () => {
      let active =
        true;

      setState(
        (current) =>
          preserveData
          && current.data !== null
            ? {
                ...current,
                error:
                  null,
              }
            : {
                status:
                  'loading',

                data:
                  null,

                error:
                  null,
              },
      );

      loaderRef.current()
        .then(
          (data) => {
            if (!active) {
              return;
            }

            setState({
              status:
                'success',

              data,

              error:
                null,
            });
          },
        )
        .catch(
          (error: unknown) => {
            if (!active) {
              return;
            }

            setState(
              (current) => ({
                status:
                  'error',

                data:
                  preserveData
                    ? current.data
                    : null,

                error:
                  error instanceof Error
                    ? error
                    : new Error(
                        'Неизвестная ошибка API',
                      ),
              }),
            );
          },
        );

      return () => {
        active =
          false;
      };
    },
    [
      key,
      preserveData,
      retryToken,
    ],
  );

  useEffect(
    () => {
      if (
        !Number.isFinite(
          intervalMs,
        )
        || intervalMs <= 0
      ) {
        return;
      }

      const timer =
        globalThis.setInterval(
          () => {
            setRetryToken(
              (current) =>
                current + 1,
            );
          },
          intervalMs,
        );

      return () => {
        globalThis.clearInterval(
          timer,
        );
      };
    },
    [
      intervalMs,
      key,
    ],
  );

  return {
    ...state,

    retry:
      () =>
        setRetryToken(
          (current) =>
            current + 1,
        ),
  };
}
