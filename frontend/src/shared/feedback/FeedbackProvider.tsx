import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation } from 'react-router';
import { nexusApi, type FeedbackPayload, type SetupFeedback } from '@/shared/api';
import styles from './FeedbackProvider.module.css';

type FeedbackMode = 'general' | 'setup';
type FeedbackType = FeedbackPayload['type'];
type SetupFeedbackReason = SetupFeedback['reasons'][number];

export interface FeedbackPageContext {
  screen?: string;
  symbol?: string | null;
  timeframe?: string | null;
  setupId?: string | null;
  replayId?: string | null;
}

interface FeedbackController {
  setPageContext(context: FeedbackPageContext | null): void;
}

interface ResolvedFeedbackContext {
  route: string;
  screen: string;
  symbol: string | null;
  timeframe: string | null;
  setupId: string | null;
  replayId: string | null;
}

const FeedbackContext = createContext<FeedbackController | null>(null);

const FEEDBACK_TYPES: Array<{ value: FeedbackType; label: string }> = [
  { value: 'bug', label: 'Ошибка в работе' },
  { value: 'feature_request', label: 'Предложение функции' },
  { value: 'ui_issue', label: 'Проблема интерфейса' },
  { value: 'data_issue', label: 'Проблема данных' },
  { value: 'setup_issue', label: 'Проблема сетапа' },
  { value: 'other', label: 'Другое' },
];

const SETUP_REASONS: Array<{ value: SetupFeedbackReason; label: string }> = [
  { value: 'weak_level', label: 'Слабый уровень' },
  { value: 'incorrect_touches', label: 'Неверно посчитаны касания' },
  { value: 'detected_too_late', label: 'Сетап найден слишком поздно' },
  { value: 'incorrect_stage', label: 'Неверно определена стадия' },
  { value: 'volume_issue', label: 'Проблема с оценкой объёма' },
  { value: 'liquidity_issue', label: 'Проблема с ликвидностью' },
  { value: 'other', label: 'Другая причина' },
];

function getScreenName(pathname: string) {
  if (pathname === '/app' || pathname === '/app/') return 'Dashboard';
  if (pathname.startsWith('/app/scanner')) return 'Scanner';
  if (pathname.startsWith('/app/market-history')) return 'Market History';
  if (pathname.startsWith('/app/market')) return 'Market';
  if (pathname.startsWith('/app/workspace')) return 'Workspace';
  if (pathname.startsWith('/app/alerts')) return 'Alerts';
  if (pathname.startsWith('/app/replay')) return 'Replay';
  if (pathname.startsWith('/app/settings')) return 'Settings';
  return 'NEXUS';
}

function ContextSummary({ context }: { context: ResolvedFeedbackContext }) {
  const items = [
    ['Экран', context.screen],
    ['Монета', context.symbol],
    ['Таймфрейм', context.timeframe],
    ['Setup ID', context.setupId],
    ['Replay ID', context.replayId],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <div className={styles.contextBlock}>
      <div className={styles.contextHeader}>
        <span>Контекст добавится автоматически</span>
        <small>{context.route}</small>
      </div>
      <div className={styles.contextChips}>
        {items.map(([label, value]) => (
          <span key={label}><small>{label}</small>{value}</span>
        ))}
      </div>
    </div>
  );
}

function GeneralFeedbackForm({
  context,
  onClose,
}: {
  context: ResolvedFeedbackContext;
  onClose(): void;
}) {
  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [contact, setContact] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [resultId, setResultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) return;

    setStatus('sending');
    setError(null);

    try {
      const result = await nexusApi.sendFeedback({
        type,
        message: message.trim(),
        rating,
        contact: contact.trim() || null,
        context: {
          ...context,
          appVersion: import.meta.env.VITE_APP_VERSION ?? 'frontend-feedback-v0.1',
          userAgent: navigator.userAgent,
          createdAt: new Date().toISOString(),
        },
      });
      setResultId(result.id);
      setStatus('success');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Не удалось отправить сообщение.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className={styles.successState}>
        <span className={styles.successIcon}>✓</span>
        <h3>Спасибо, сообщение принято</h3>
        <p>В тестовом контуре оно сохранено в Mock API.</p>
        <small>ID: {resultId}</small>
        <button type="button" onClick={onClose}>Закрыть</button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <ContextSummary context={context} />

      <label>
        <span>Тип сообщения</span>
        <select value={type} onChange={(event) => setType(event.target.value as FeedbackType)}>
          {FEEDBACK_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>

      <label>
        <span>Что произошло или что стоит улучшить?</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Опиши проблему или идею. Контекст страницы будет приложен автоматически."
          rows={5}
          maxLength={1600}
          required
        />
        <small className={styles.counter}>{message.length}/1600</small>
      </label>

      <fieldset className={styles.ratingFieldset}>
        <legend>Общая оценка экрана — необязательно</legend>
        <div className={styles.ratingButtons}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={rating === value ? styles.ratingActive : ''}
              onClick={() => setRating(rating === value ? null : value)}
              aria-pressed={rating === value}
            >
              {value}
            </button>
          ))}
        </div>
      </fieldset>

      <label>
        <span>Контакт для ответа — необязательно</span>
        <input
          type="text"
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          placeholder="Email или Telegram"
          maxLength={160}
        />
      </label>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.formActions}>
        <button className={styles.secondaryButton} type="button" onClick={onClose}>Отмена</button>
        <button className={styles.primaryButton} type="submit" disabled={!message.trim() || status === 'sending'}>
          {status === 'sending' ? 'Отправляем…' : 'Отправить'}
        </button>
      </div>
    </form>
  );
}

function SetupFeedbackForm({
  context,
  onClose,
}: {
  context: ResolvedFeedbackContext;
  onClose(): void;
}) {
  const [useful, setUseful] = useState<boolean | null>(null);
  const [reasons, setReasons] = useState<SetupFeedbackReason[]>([]);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [resultId, setResultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleReason = (reason: SetupFeedbackReason) => {
    setReasons((current) => current.includes(reason)
      ? current.filter((item) => item !== reason)
      : [...current, reason]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (useful === null || !context.setupId) return;

    setStatus('sending');
    setError(null);

    try {
      const result = await nexusApi.sendSetupFeedback({
        setupId: context.setupId,
        useful,
        reasons,
        comment: comment.trim() || null,
        createdAt: new Date().toISOString(),
      });
      setResultId(result.id);
      setStatus('success');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Не удалось отправить оценку.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className={styles.successState}>
        <span className={styles.successIcon}>✓</span>
        <h3>Оценка сетапа принята</h3>
        <p>Она сохранена в тестовом контуре и позже сможет участвовать в обучении рейтинга сетапов.</p>
        <small>ID: {resultId}</small>
        <button type="button" onClick={onClose}>Закрыть</button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <ContextSummary context={context} />

      <fieldset className={styles.usefulFieldset}>
        <legend>Этот сетап был полезным?</legend>
        <div className={styles.usefulButtons}>
          <button type="button" className={useful === true ? styles.usefulPositiveActive : ''} onClick={() => setUseful(true)} aria-pressed={useful === true}>Да, полезный</button>
          <button type="button" className={useful === false ? styles.usefulNegativeActive : ''} onClick={() => setUseful(false)} aria-pressed={useful === false}>Нет, есть проблема</button>
        </div>
      </fieldset>

      <fieldset className={styles.reasonFieldset}>
        <legend>Что можно улучшить?</legend>
        <div className={styles.reasonGrid}>
          {SETUP_REASONS.map((reason) => (
            <label key={reason.value} className={reasons.includes(reason.value) ? styles.reasonSelected : ''}>
              <input type="checkbox" checked={reasons.includes(reason.value)} onChange={() => toggleReason(reason.value)} />
              <span>{reason.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        <span>Комментарий — необязательно</span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Например: уровень правильный, но сетап появился после основного импульса."
          rows={4}
          maxLength={1200}
        />
        <small className={styles.counter}>{comment.length}/1200</small>
      </label>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.formActions}>
        <button className={styles.secondaryButton} type="button" onClick={onClose}>Отмена</button>
        <button className={styles.primaryButton} type="submit" disabled={useful === null || status === 'sending'}>
          {status === 'sending' ? 'Сохраняем…' : 'Сохранить оценку'}
        </button>
      </div>
    </form>
  );
}

function FeedbackModal({
  mode,
  context,
  onClose,
}: {
  mode: FeedbackMode;
  context: ResolvedFeedbackContext;
  onClose(): void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="nexus-feedback-title">
        <header className={styles.modalHeader}>
          <div>
            <span className={styles.modalEyebrow}>NEXUS · TEST FEEDBACK</span>
            <h2 id="nexus-feedback-title">{mode === 'setup' ? 'Оценить сетап' : 'Обратная связь'}</h2>
            <p>{mode === 'setup'
              ? 'Помоги понять, насколько корректно система нашла и описала торговую ситуацию.'
              : 'Сообщи об ошибке или предложи улучшение интерфейса и логики.'}</p>
          </div>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Закрыть">×</button>
        </header>

        {mode === 'setup'
          ? <SetupFeedbackForm context={context} onClose={onClose} />
          : <GeneralFeedbackForm context={context} onClose={onClose} />}
      </section>
    </div>
  );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [pageContext, setPageContext] = useState<FeedbackPageContext | null>(null);
  const [mode, setMode] = useState<FeedbackMode | null>(null);

  const resolvedContext = useMemo<ResolvedFeedbackContext>(() => {
    const params = new URLSearchParams(location.search);
    return {
      route: `${location.pathname}${location.search}`,
      screen: pageContext?.screen ?? getScreenName(location.pathname),
      symbol: pageContext?.symbol ?? params.get('symbol'),
      timeframe: pageContext?.timeframe ?? params.get('timeframe') ?? params.get('tf'),
      setupId: pageContext?.setupId ?? params.get('setupId') ?? params.get('setup'),
      replayId: pageContext?.replayId ?? params.get('replayId') ?? params.get('session'),
    };
  }, [location.pathname, location.search, pageContext]);

  const closeModal = useCallback(() => setMode(null), []);
  const controller = useMemo<FeedbackController>(() => ({ setPageContext }), []);

  return (
    <FeedbackContext.Provider value={controller}>
      {children}

      <div className={styles.feedbackDock} aria-label="Обратная связь NEXUS">
        {resolvedContext.setupId && (
          <button className={styles.setupFeedbackButton} type="button" onClick={() => setMode('setup')}>
            <span>◎</span> Оценить сетап
          </button>
        )}
        <button className={styles.feedbackButton} type="button" onClick={() => setMode('general')}>
          <span>✦</span> Feedback
        </button>
      </div>

      {mode && <FeedbackModal mode={mode} context={resolvedContext} onClose={closeModal} />}
    </FeedbackContext.Provider>
  );
}

export function useFeedbackPageContext(context: FeedbackPageContext) {
  const controller = useContext(FeedbackContext);
  if (!controller) throw new Error('useFeedbackPageContext must be used inside FeedbackProvider');

  const { replayId, screen, setupId, symbol, timeframe } = context;

  useEffect(() => {
    controller.setPageContext({ replayId, screen, setupId, symbol, timeframe });
    return () => controller.setPageContext(null);
  }, [controller, replayId, screen, setupId, symbol, timeframe]);
}
