import styles from './AsyncDataState.module.css';

interface AsyncDataStateProps {
  state: 'loading' | 'error' | 'empty';
  title?: string;
  message?: string;
  onRetry?: () => void;
}

const DEFAULTS = {
  loading: {
    title: 'Загружаем тестовые данные',
    message: 'Mock API подготавливает данные для экрана.',
  },
  error: {
    title: 'Данные не загрузились',
    message: 'Проверьте состояние Mock API и повторите запрос.',
  },
  empty: {
    title: 'Данных пока нет',
    message: 'Для выбранного экрана Mock API вернул пустой результат.',
  },
} as const;

export function AsyncDataState({ state, title, message, onRetry }: AsyncDataStateProps) {
  const copy = DEFAULTS[state];

  return (
    <section className={styles.state} data-state={state} role={state === 'error' ? 'alert' : 'status'}>
      <span className={styles.icon} aria-hidden="true">
        {state === 'loading' ? <i className={styles.spinner} /> : state === 'error' ? '!' : '∅'}
      </span>
      <div>
        <h1>{title ?? copy.title}</h1>
        <p>{message ?? copy.message}</p>
      </div>
      {state === 'error' && onRetry && (
        <button type="button" onClick={onRetry}>Повторить</button>
      )}
    </section>
  );
}
