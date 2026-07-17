import { useEffect, useRef, useState } from 'react';

export type ApiQueryStatus = 'loading' | 'success' | 'error';

export interface ApiQueryResult<T> {
  status: ApiQueryStatus;
  data: T | null;
  error: Error | null;
  retry: () => void;
}

export function useApiQuery<T>(key: string, loader: () => Promise<T>): ApiQueryResult<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [retryToken, setRetryToken] = useState(0);
  const [state, setState] = useState<Omit<ApiQueryResult<T>, 'retry'>>({
    status: 'loading',
    data: null,
    error: null,
  });

  useEffect(() => {
    let active = true;

    setState({ status: 'loading', data: null, error: null });

    loaderRef.current()
      .then((data) => {
        if (!active) return;
        setState({ status: 'success', data, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: 'error',
          data: null,
          error: error instanceof Error ? error : new Error('Неизвестная ошибка Mock API'),
        });
      });

    return () => {
      active = false;
    };
  }, [key, retryToken]);

  return {
    ...state,
    retry: () => setRetryToken((current) => current + 1),
  };
}
