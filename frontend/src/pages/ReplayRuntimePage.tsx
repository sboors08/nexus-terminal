import {
  useEffect,
  useState,
} from 'react';
import {
  Link,
  useSearchParams,
} from 'react-router';
import {
  ROUTES,
} from '@/app/routing/routes';
import {
  SETUP_REPLAY_RUNTIME_RESULT_LABELS,
  fetchSetupReplayRuntimeView,
  getSetupReplayRuntimeSetupLabel,
  type SetupReplayRuntimeFrame,
  type SetupReplayRuntimeResult,
  type SetupReplayRuntimeStage,
  type SetupReplayRuntimeViewData,
} from '@/shared/api/runtime/setupReplayRuntimeApi';
import {
  useSetupLifecycleRefresh,
} from '@/shared/api/runtime/useSetupLifecycleRefresh';
import {
  useApiQuery,
} from '@/shared/api/useApiQuery';
import {
  useFeedbackPageContext,
} from '@/shared/feedback/FeedbackProvider';
import {
  buildSetupSelectionUrl,
  buildWorkspaceUrl,
} from '@/shared/routing/setupContext';
import {
  AsyncDataState,
} from '@/shared/ui/AsyncDataState';
import {
  DirectionBadge,
} from '@/shared/ui/DirectionBadge';
import {
  SetupStageBadge,
  type SetupStage,
  type SetupStageResultLabel,
} from '@/shared/ui/SetupStageBadge';
import styles from './ReplayPage.module.css';

type ReplaySpeed =
  | 0.5
  | 1
  | 2
  | 4;

const SPEEDS:
readonly ReplaySpeed[] = [
  0.5,
  1,
  2,
  4,
];

const DATE_FORMATTER =
  new Intl.DateTimeFormat(
    'ru-RU',
    {
      day:
        '2-digit',
      month:
        '2-digit',
      year:
        '2-digit',
      hour:
        '2-digit',
      minute:
        '2-digit',
      second:
        '2-digit',
      timeZone:
        'UTC',
    },
  );

function formatUtc(
  value: string | null,
): string {
  if (!value) {
    return '—';
  }

  return (
    DATE_FORMATTER
      .format(
        new Date(
          value,
        ),
      )
      .replace(
        ',',
        '',
      )
    + ' UTC'
  );
}

function formatPrice(
  value: number,
): string {
  if (value >= 1000) {
    return value.toLocaleString(
      'ru-RU',
      {
        maximumFractionDigits:
          2,
      },
    );
  }

  if (value >= 10) {
    return value.toLocaleString(
      'ru-RU',
      {
        minimumFractionDigits:
          2,
        maximumFractionDigits:
          4,
      },
    );
  }

  return value.toLocaleString(
    'ru-RU',
    {
      minimumFractionDigits:
        4,
      maximumFractionDigits:
        8,
    },
  );
}

function formatDistance(
  value: number,
): string {
  return `${value.toFixed(4)}%`;
}

function formatStage(
  stage:
    SetupReplayRuntimeStage
    | null,
): string {
  if (stage === null) {
    return '—';
  }

  if (
    stage
    === 'LEVEL_CONFIRMED'
  ) {
    return 'Наблюдение';
  }

  if (
    stage
    === 'APPROACHING_THIRD_TOUCH'
  ) {
    return 'Подход';
  }

  if (
    stage
    === 'THIRD_TOUCH_CONFIRMED'
  ) {
    return 'Подтверждение';
  }

  if (
    stage
    === 'BREAKOUT_CONFIRMED'
  ) {
    return 'Пробой подтверждён';
  }

  if (
    stage
    === 'REJECTION_CONFIRMED'
  ) {
    return 'Реакция подтверждена';
  }

  return 'Истёк';
}

function formatEventType(
  type:
    SetupReplayRuntimeFrame['type'],
): string {
  if (
    type
    === 'candidate_created'
  ) {
    return 'Кандидат создан';
  }

  if (
    type
    === 'stage_transition'
  ) {
    return 'Смена стадии';
  }

  if (
    type
    === 'breakout_confirmed'
  ) {
    return 'Пробой подтверждён';
  }

  if (
    type
    === 'rejection_confirmed'
  ) {
    return 'Реакция подтверждена';
  }

  return 'Сетап истёк';
}

function mapRuntimeStage(
  stage:
    SetupReplayRuntimeStage,
): SetupStage {
  if (
    stage
    === 'LEVEL_CONFIRMED'
  ) {
    return 'observation';
  }

  if (
    stage
    === 'APPROACHING_THIRD_TOUCH'
  ) {
    return 'approach';
  }

  if (
    stage
    === 'THIRD_TOUCH_CONFIRMED'
  ) {
    return 'confirmation';
  }

  return 'triggered';
}

function getStageResultLabel(
  frame:
    SetupReplayRuntimeFrame,
): SetupStageResultLabel {
  if (
    frame.currentStage
    === 'BREAKOUT_CONFIRMED'
  ) {
    return 'Пробой';
  }

  if (
    frame.currentStage
    === 'REJECTION_CONFIRMED'
  ) {
    return 'Отскок';
  }

  return 'Исход';
}

function resolveFrameResult(
  frame:
    SetupReplayRuntimeFrame,
): SetupReplayRuntimeResult {
  if (
    frame.currentStage
    === 'BREAKOUT_CONFIRMED'
  ) {
    return 'breakout_confirmed';
  }

  if (
    frame.currentStage
    === 'REJECTION_CONFIRMED'
  ) {
    return 'rejection_confirmed';
  }

  if (
    frame.currentStage
    === 'SETUP_EXPIRED'
  ) {
    return 'expired';
  }

  return 'active';
}

function resultExplanation(
  frame:
    SetupReplayRuntimeFrame,
): string {
  const result =
    resolveFrameResult(
      frame,
    );

  if (
    result
    === 'breakout_confirmed'
  ) {
    return 'Текущий кадр фиксирует BREAKOUT_CONFIRMED. Это lifecycle-факт Setup Engine, а не прибыль сделки.';
  }

  if (
    result
    === 'rejection_confirmed'
  ) {
    return 'Текущий кадр фиксирует REJECTION_CONFIRMED. Это lifecycle-факт реакции уровня, а не PnL.';
  }

  if (
    result
    === 'expired'
  ) {
    return 'Текущий кадр фиксирует SETUP_EXPIRED. Торговый результат не додумывается.';
  }

  return 'На текущем кадре terminal lifecycle result ещё не наступил. Более поздние retained events не используются в этой подписи.';
}

function frameTone(
  frame:
    SetupReplayRuntimeFrame,
): 'info' | 'positive' | 'warning' | 'critical' {
  if (
    frame.currentStage
    === 'BREAKOUT_CONFIRMED'
  ) {
    return 'positive';
  }

  if (
    frame.currentStage
    === 'REJECTION_CONFIRMED'
    || frame.currentStage
      === 'SETUP_EXPIRED'
  ) {
    return 'warning';
  }

  return 'info';
}

function ReplayRuntimeContent({
  data,
}: {
  data:
    SetupReplayRuntimeViewData;
}) {
  const session =
    data.session;

  const [
    frameIndex,
    setFrameIndex,
  ] = useState(
    0,
  );

  const [
    isPlaying,
    setIsPlaying,
  ] = useState(
    false,
  );

  const [
    speed,
    setSpeed,
  ] = useState<ReplaySpeed>(
    1,
  );

  useFeedbackPageContext({
    screen:
      'Replay',
    symbol:
      session.symbol,
    timeframe:
      session.timeframe,
    setupId:
      session.setupId,
    replayId:
      session.id,
  });

  const lastFrameIndex =
    session.frames.length
    - 1;

  const currentFrame =
    session.frames[
      frameIndex
    ]
    ?? session.frames[0];

  if (!currentFrame) {
    throw new Error(
      'Setup Replay runtime requires at least one frame',
    );
  }

  const currentResult =
    resolveFrameResult(
      currentFrame,
    );

  const visibleFrames =
    session.frames.slice(
      0,
      frameIndex + 1,
    );

  useEffect(
    () => {
      setFrameIndex(
        0,
      );
      setIsPlaying(
        false,
      );
    },
    [
      session.id,
    ],
  );

  useEffect(
    () => {
      if (!isPlaying) {
        return undefined;
      }

      if (
        frameIndex
        >= lastFrameIndex
      ) {
        setIsPlaying(
          false,
        );
        return undefined;
      }

      const timer =
        window.setTimeout(
          () => {
            setFrameIndex(
              (current) =>
                Math.min(
                  lastFrameIndex,
                  current + 1,
                ),
            );
          },
          900 / speed,
        );

      return () =>
        window.clearTimeout(
          timer,
        );
    },
    [
      frameIndex,
      isPlaying,
      lastFrameIndex,
      speed,
    ],
  );

  const setupLabel =
    getSetupReplayRuntimeSetupLabel(
      session,
      currentFrame,
    );

  const stageLabels = [
    'Наблюдение',
    'Подход',
    'Подтверждение',
    'Исход',
  ];

  const stageIndex =
    currentFrame.currentStage
      === 'LEVEL_CONFIRMED'
        ? 0
        : currentFrame.currentStage
            === 'APPROACHING_THIRD_TOUCH'
          ? 1
          : currentFrame.currentStage
              === 'THIRD_TOUCH_CONFIRMED'
            ? 2
            : 3;

  const togglePlayback =
    () => {
      if (
        frameIndex
        >= lastFrameIndex
      ) {
        setFrameIndex(
          0,
        );
      }

      setIsPlaying(
        (current) =>
          !current,
      );
    };

  return (
    <section className={styles.replayPage}>
      <header className={styles.pageHeader}>
        <div className={styles.headerIdentity}>
          <Link
            className={styles.backButton}
            to={buildSetupSelectionUrl(
              ROUTES.marketHistory,
              session.setupId,
              {
                symbol:
                  session.symbol,
                timeframe:
                  session.timeframe,
              },
            )}
            aria-label="Вернуться в Market History"
          >
            ←
          </Link>

          <div>
            <p className={styles.eyebrow}>
              Persistent Setup lifecycle · event-by-event Replay
            </p>

            <div className={styles.symbolLine}>
              <h1>{session.symbol}</h1>
              <DirectionBadge
                direction={session.direction}
              />
              <span className={styles.exchangeBadge}>
                BINANCE
              </span>
              <span className={styles.timeframeBadge}>
                {session.timeframe}
              </span>
            </div>

            <p className={styles.subtitle}>
              {setupLabel}
              {' · '}
              event {currentFrame.eventId}
              {' · '}
              {formatStage(
                currentFrame.currentStage,
              )}
            </p>
          </div>
        </div>

        <div className={styles.headerResult}>
          <span>Lifecycle result</span>
          <strong>
            {
              SETUP_REPLAY_RUNTIME_RESULT_LABELS[
                currentResult
              ]
            }
          </strong>
          <small>
            {session.frameCount} factual frames
          </small>
        </div>
      </header>

      <section
        className={styles.dataNotice}
        aria-label="Источник данных Replay"
      >
        <strong>
          {
            session.historyComplete
              ? 'REAL RUNTIME DATA: persisted Setup lifecycle frames'
              : 'PARTIAL RUNTIME DATA: ранние events удалены bounded retention'
          }
        </strong>
        <span>
          Каждый кадр — реально сохранённый Setup Engine event и candidate snapshot.
          Свечи, aggTrade, исторический стакан и PnL в этом Replay отсутствуют и не синтезируются.
        </span>
      </section>

      <section
        className={styles.playerPanel}
        aria-label="Управление lifecycle Replay"
      >
        <div className={styles.playbackControls}>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setFrameIndex(0);
            }}
            disabled={frameIndex === 0}
            aria-label="Первый retained event"
          >
            ↺
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setFrameIndex(
                (current) =>
                  Math.max(
                    0,
                    current - 1,
                  ),
              );
            }}
            disabled={frameIndex === 0}
            aria-label="Предыдущее lifecycle событие"
          >
            ‹
          </button>

          <button
            type="button"
            className={styles.playButton}
            onClick={togglePlayback}
            disabled={lastFrameIndex === 0}
            aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
          >
            {isPlaying ? 'Ⅱ' : '▶'}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setFrameIndex(
                (current) =>
                  Math.min(
                    lastFrameIndex,
                    current + 1,
                  ),
              );
            }}
            disabled={frameIndex >= lastFrameIndex}
            aria-label="Следующее lifecycle событие"
          >
            ›
          </button>
        </div>

        <div className={styles.timelineControl}>
          <span>
            {formatUtc(
              session.firstRetainedAt,
            )}
          </span>

          <input
            type="range"
            min="0"
            max={lastFrameIndex}
            value={frameIndex}
            onChange={(event) => {
              setIsPlaying(false);
              setFrameIndex(
                Number(
                  event.target.value,
                ),
              );
            }}
            aria-label="Позиция lifecycle Replay"
          />

          <span>
            {formatUtc(
              session.latestEventAt,
            )}
          </span>
        </div>

        <div
          className={styles.speedControl}
          aria-label="Скорость просмотра событий"
        >
          {SPEEDS.map(
            (value) => (
              <button
                key={value}
                type="button"
                className={
                  speed === value
                    ? styles.speedActive
                    : ''
                }
                onClick={() =>
                  setSpeed(
                    value,
                  )
                }
              >
                {value}×
              </button>
            ),
          )}
        </div>
      </section>

      <div className={styles.replayGrid}>
        <div className={styles.leftColumn}>
          <article className={styles.chartPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelEyebrow}>
                  Retained candidate snapshot
                </p>
                <h2>
                  Кадр {frameIndex + 1} / {session.frameCount}
                </h2>
              </div>

              <span className={styles.replayIndicator}>
                EVENT REPLAY
              </span>
            </div>

            <div className={styles.metricGrid}>
              <div>
                <span>Event ID</span>
                <strong>{currentFrame.eventId}</strong>
              </div>
              <div>
                <span>Время</span>
                <strong>{formatUtc(currentFrame.occurredAt)}</strong>
              </div>
              <div>
                <span>Цена snapshot</span>
                <strong>{formatPrice(currentFrame.currentPrice)}</strong>
              </div>
              <div>
                <span>До уровня</span>
                <strong>{formatDistance(currentFrame.distanceToLevelPct)}</strong>
              </div>
              <div>
                <span>Зона уровня</span>
                <strong>
                  {formatPrice(currentFrame.level.zoneLow)}
                  {'–'}
                  {formatPrice(currentFrame.level.zoneHigh)}
                </strong>
              </div>
              <div>
                <span>Касания</span>
                <strong>{currentFrame.level.touches}</strong>
              </div>
            </div>
          </article>

          <div className={styles.marketPanels}>
            <article className={styles.printsPanel}>
              <div className={styles.compactPanelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>
                    Уже воспроизведено
                  </p>
                  <h2>Lifecycle timeline</h2>
                </div>
                <span>{visibleFrames.length} events</span>
              </div>

              <div className={styles.eventList}>
                {visibleFrames
                  .slice()
                  .reverse()
                  .map(
                    (frame) => (
                      <article
                        key={frame.eventId}
                        className={`${styles.eventItem} ${styles[`event_${frameTone(frame)}`]}`}
                      >
                        <div>
                          <strong>
                            {formatEventType(
                              frame.type,
                            )}
                          </strong>
                          <span>
                            {formatUtc(
                              frame.occurredAt,
                            )}
                          </span>
                        </div>
                        <p>
                          {formatStage(frame.previousStage)}
                          {' → '}
                          {formatStage(frame.currentStage)}
                          {' · price '}
                          {formatPrice(frame.currentPrice)}
                        </p>
                      </article>
                    ),
                  )}
              </div>
            </article>

            <article className={styles.liquidityPanel}>
              <div className={styles.compactPanelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>
                    Data availability
                  </p>
                  <h2>Границы Replay v0.1</h2>
                </div>
              </div>

              <div className={styles.snapshotGrid}>
                <div>
                  <span>Lifecycle frames</span>
                  <strong>REAL</strong>
                </div>
                <div>
                  <span>Snapshot price</span>
                  <strong>REAL</strong>
                </div>
                <div>
                  <span>Candles</span>
                  <strong>Недоступны</strong>
                </div>
                <div>
                  <span>aggTrade</span>
                  <strong>Недоступны</strong>
                </div>
                <div>
                  <span>Order book</span>
                  <strong>Недоступен</strong>
                </div>
                <div>
                  <span>PnL</span>
                  <strong>Не рассчитывается</strong>
                </div>
              </div>

              <p className={styles.confidenceNote}>
                Скорость 0.5×–4× управляет только просмотром сохранённых events и не имитирует реальный масштаб времени между событиями.
              </p>
            </article>
          </div>
        </div>

        <aside
          className={styles.nexusPanel}
          aria-label="Состояние NEXUS в lifecycle Replay"
        >
          <section className={styles.nexusSection}>
            <div className={styles.nexusHeader}>
              <div>
                <p className={styles.panelEyebrow}>
                  Панель NEXUS
                </p>
                <h2>
                  {formatStage(
                    currentFrame.currentStage,
                  )}
                </h2>
              </div>

              <SetupStageBadge
                stage={mapRuntimeStage(
                  currentFrame.currentStage,
                )}
                resultLabel={getStageResultLabel(
                  currentFrame,
                )}
              />
            </div>

            <div className={styles.stageFlow}>
              {stageLabels.map(
                (
                  label,
                  index,
                ) => (
                  <div
                    key={label}
                    className={`${styles.stageStep} ${index < stageIndex ? styles.stagePassed : ''} ${index === stageIndex ? styles.stageCurrent : ''}`}
                  >
                    <span>{index + 1}</span>
                    <small>{label}</small>
                  </div>
                ),
              )}
            </div>
          </section>

          <section className={styles.nexusSection}>
            <p className={styles.panelEyebrow}>
              Identity
            </p>

            <div className={styles.snapshotGrid}>
              <div>
                <span>Setup ID</span>
                <strong>{session.setupId}</strong>
              </div>
              <div>
                <span>Episode ID</span>
                <strong>{session.episodeId ?? '—'}</strong>
              </div>
              <div>
                <span>Line ID</span>
                <strong>{session.lineId ?? '—'}</strong>
              </div>
              <div>
                <span>History</span>
                <strong>
                  {session.historyComplete ? 'complete' : 'partial'}
                </strong>
              </div>
              <div>
                <span>Detected at</span>
                <strong>{formatUtc(session.detectedAt)}</strong>
              </div>
              <div>
                <span>First retained</span>
                <strong>{formatUtc(session.firstRetainedAt)}</strong>
              </div>
            </div>
          </section>

          <section className={styles.resultCard}>
            <p className={styles.panelEyebrow}>
              Factual lifecycle
            </p>

            <h3>
              {
                SETUP_REPLAY_RUNTIME_RESULT_LABELS[
                  currentResult
                ]
              }
            </h3>

            <p>
              {resultExplanation(
                currentFrame,
              )}
            </p>

            <div className={styles.resultActions}>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setFrameIndex(lastFrameIndex);
                }}
                disabled={frameIndex === lastFrameIndex}
              >
                {
                  frameIndex === lastFrameIndex
                    ? 'Последний event открыт ✓'
                    : 'К последнему event →'
                }
              </button>

              <Link
                className={styles.workspaceLink}
                to={buildWorkspaceUrl(
                  ROUTES.workspace,
                  {
                    setupId:
                      session.setupId,
                    symbol:
                      session.symbol,
                    timeframe:
                      session.timeframe,
                  },
                )}
              >
                Workspace
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function ReplayRuntimeQuery({
  setupId,
}: {
  setupId:
    string;
}) {
  const query =
    useApiQuery(
      `setup-replay-runtime:${setupId}`,
      () =>
        fetchSetupReplayRuntimeView(
          setupId,
        ),
      {
        preserveData:
          true,
      },
    );

  useSetupLifecycleRefresh({
    onEvent:
      query.retry,
  });

  if (
    query.status === 'loading'
    && !query.data
  ) {
    return <AsyncDataState state="loading" />;
  }

  if (
    query.status === 'error'
    && !query.data
  ) {
    return (
      <AsyncDataState
        state="error"
        message={query.error?.message}
        onRetry={query.retry}
      />
    );
  }

  if (!query.data) {
    return (
      <AsyncDataState
        state="empty"
        title="Replay не найден"
        message="Для этого Setup ID нет retained lifecycle events."
      />
    );
  }

  return (
    <ReplayRuntimeContent
      data={query.data}
    />
  );
}

export function ReplayPage() {
  const [
    searchParams,
  ] = useSearchParams();

  const setupId =
    searchParams
      .get(
        'setupId',
      )
      ?.trim()
    ?? '';

  if (!setupId) {
    return (
      <AsyncDataState
        state="empty"
        title="Replay не выбран"
        message="Открой Replay из Market History, чтобы передать Setup ID."
      />
    );
  }

  return (
    <ReplayRuntimeQuery
      setupId={setupId}
    />
  );
}
