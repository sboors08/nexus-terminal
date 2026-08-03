import {
  fetchLevelV2ShadowInspection,
  useApiQuery,
  type LevelV2ShadowInspection,
  type LevelV2ShadowInspectionAvailability,
  type LevelV2ShadowInspectionBehavior,
  type LevelV2ShadowInspectionBreakStatus,
  type LevelV2ShadowInspectionConfidence,
  type LevelV2ShadowInspectionOutcomeStatus,
  type LevelV2ShadowInspectionPostEventReaction,
  type LevelV2ShadowInspectionVerdict,
} from '@/shared/api';
import styles from './LevelV2ShadowInspectionPanel.module.css';


export type LevelV2ShadowInspectionLifecycleStatus =
  | 'forming'
  | 'active'
  | 'testing'
  | 'broken'
  | 'retest_pending'
  | 'flipped'
  | 'expired';

const LIFECYCLE_LABELS:
Record<
  LevelV2ShadowInspectionLifecycleStatus,
  string
> = {
  forming:
    'Формируется',
  active:
    'Активный уровень',
  testing:
    'Цена тестирует зону',
  broken:
    'Уровень пробит',
  retest_pending:
    'Ожидается ретест',
  flipped:
    'Роль уровня изменена',
  expired:
    'Уровень устарел',
};

const BREAK_LABELS:
Record<
  LevelV2ShadowInspectionBreakStatus,
  string
> = {
  idle:
    'Ожидание взаимодействия',
  pierce:
    'Прокол зоны',
  breakout_pending:
    'Закрепление проверяется',
  breakout_confirmed:
    'Пробой подтверждён ценой',
  false_breakout:
    'Ложный пробой',
};

const VERDICT_LABELS:
Record<
  LevelV2ShadowInspectionVerdict,
  string
> = {
  supported:
    'Поддерживается рынком',
  contradicted:
    'Противоречит рынку',
  mixed:
    'Смешанные признаки',
  insufficient_data:
    'Недостаточно данных',
};

const CONFIDENCE_LABELS:
Record<
  LevelV2ShadowInspectionConfidence,
  string
> = {
  low:
    'Низкая',
  medium:
    'Средняя',
  high:
    'Высокая',
};

const BEHAVIOR_LABELS:
Record<
  LevelV2ShadowInspectionBehavior,
  string
> = {
  directional_continuation:
    'Направленное продолжение',
  aggressive_buy_absorption:
    'Поглощение агрессивных покупок',
  aggressive_sell_absorption:
    'Поглощение агрессивных продаж',
  momentum_exhaustion:
    'Истощение импульса',
  mixed:
    'Смешанное поведение',
  insufficient_data:
    'Недостаточно данных',
};

const REACTION_LABELS:
Record<
  LevelV2ShadowInspectionPostEventReaction,
  string
> = {
  continuation:
    'Продолжение',
  rejection:
    'Возврат / отбой',
  stall:
    'Остановка',
  unknown:
    'Не определена',
};

const AVAILABILITY_LABELS:
Record<
  LevelV2ShadowInspectionAvailability,
  string
> = {
  complete:
    'Лента + стакан',
  tape_only:
    'Только лента',
  order_book_only:
    'Только стакан',
  unavailable:
    'Источники недоступны',
};

const OUTCOME_LABELS:
Record<
  LevelV2ShadowInspectionOutcomeStatus,
  string
> = {
  pending:
    'Наблюдение продолжается',
  successful_continuation:
    'Успешное продолжение',
  failed_reversal:
    'Возврат за уровень',
  mixed:
    'Продолжение и возврат',
};

function formatSignedPercent(
  value: number | null,
): string {
  if (value === null) {
    return '—';
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(3)}%`;
}

function formatDuration(
  value: number | null,
): string {
  if (value === null) {
    return '—';
  }

  const seconds =
    Math.max(
      0,
      Math.round(
        value / 1_000,
      ),
    );

  if (seconds < 60) {
    return `${seconds}с`;
  }

  const minutes =
    Math.floor(
      seconds / 60,
    );

  const remainingSeconds =
    seconds % 60;

  return `${minutes}м ${remainingSeconds}с`;
}

function getStateClass(
  inspection:
    LevelV2ShadowInspection,
): string {
  const outcome =
    inspection.outcome;

  if (
    outcome?.status
    === 'successful_continuation'
  ) {
    return styles.statePositive;
  }

  if (
    outcome?.status
      === 'failed_reversal'
    || inspection.confirmationCandidate
      ?.verdict === 'contradicted'
    || inspection.breakClassification
      .status === 'false_breakout'
  ) {
    return styles.stateNegative;
  }

  if (
    outcome?.status === 'mixed'
    || inspection.confirmationCandidate
      ?.verdict === 'mixed'
  ) {
    return styles.stateMixed;
  }

  return styles.stateNeutral;
}

export interface LevelV2ShadowInspectionPanelProps {
  symbol: string;
  levelId: string | null;
  lifecycleStatus:
    LevelV2ShadowInspectionLifecycleStatus
    | null;
}

export function LevelV2ShadowInspectionPanel({
  symbol,
  levelId,
  lifecycleStatus,
}: LevelV2ShadowInspectionPanelProps) {
  const query =
    useApiQuery(
      `level-v2-shadow-inspection:${symbol}:${levelId ?? 'none'}`,
      () =>
        levelId
          ? fetchLevelV2ShadowInspection({
              symbol,
              levelId,
            })
          : Promise.resolve(null),
      {
        intervalMs:
          levelId
            ? 5_000
            : 0,
        preserveData:
          true,
      },
    );

  if (!levelId) {
    return null;
  }

  if (
    query.status === 'loading'
    && query.data === null
  ) {
    return (
      <section
        className={styles.panel}
        aria-label="Level v2 Shadow pipeline"
      >
        <div className={styles.header}>
          <span>V2 SHADOW PIPELINE</span>
          <strong>Загрузка</strong>
        </div>
        <p className={styles.message}>
          Читаем классификацию пробоя, подтверждение и результат.
        </p>
      </section>
    );
  }

  if (
    query.status === 'error'
    && query.data === null
  ) {
    return (
      <section
        className={`${styles.panel} ${styles.panelError}`}
        aria-label="Level v2 Shadow pipeline error"
      >
        <div className={styles.header}>
          <span>V2 SHADOW PIPELINE</span>
          <strong>Ошибка API</strong>
        </div>
        <p className={styles.message}>
          {query.error?.message ?? 'Данные Level v2 не загрузились.'}
        </p>
        <button
          type="button"
          className={styles.retryButton}
          onClick={query.retry}
        >
          Повторить
        </button>
      </section>
    );
  }

  const inspection =
    query.data;

  if (!inspection) {
    return (
      <section
        className={styles.panel}
        aria-label="Level v2 Shadow pipeline empty"
      >
        <div className={styles.header}>
          <span>V2 SHADOW PIPELINE</span>
          <strong>Ожидание</strong>
        </div>
        <p className={styles.message}>
          Для уровня ещё нет отдельной классификации пробоя.
        </p>
      </section>
    );
  }

  const candidate =
    inspection.confirmationCandidate;

  const outcome =
    inspection.outcome;

  const reasons =
    outcome?.reasons.length
      ? outcome.reasons
      : candidate?.reasons
        ?? [];

  return (
    <section
      className={`${styles.panel} ${getStateClass(inspection)}`}
      aria-label="Level v2 Shadow pipeline"
    >
      <div className={styles.header}>
        <span>V2 SHADOW PIPELINE</span>
        <strong>
          {BREAK_LABELS[
            inspection
              .breakClassification
              .status
          ]}
        </strong>
      </div>

      <div className={styles.stageGrid}>
        <div>
          <span>Жизненный цикл</span>
          <strong>
            {lifecycleStatus
              ? LIFECYCLE_LABELS[
                  lifecycleStatus
                ]
              : '—'}
          </strong>
          <small>Level v2</small>
        </div>

        <div>
          <span>Цена</span>
          <strong>
            {BREAK_LABELS[
              inspection
                .breakClassification
                .status
            ]}
          </strong>
          <small>
            Глубина{' '}
            {inspection
              .breakClassification
              .maxPenetrationDepthPct
              .toFixed(3)}%
          </small>
        </div>

        <div>
          <span>Рынок</span>
          <strong>
            {candidate
              ? VERDICT_LABELS[
                  candidate.verdict
                ]
              : 'Кандидат не сформирован'}
          </strong>
          <small>
            {candidate
              ? CONFIDENCE_LABELS[
                  candidate.confidence
                ]
              : '—'}
          </small>
        </div>

        <div>
          <span>Результат</span>
          <strong>
            {outcome
              ? OUTCOME_LABELS[
                  outcome.status
                ]
              : 'Наблюдение не началось'}
          </strong>
          <small>
            {outcome
              ? `${outcome.observedPricesCount} ценовых точек`
              : '—'}
          </small>
        </div>
      </div>

      <div className={styles.metricsGrid}>
        <div>
          <span>Закрепление цены</span>
          <strong>
            {candidate
              ? candidate.priceAcceptance
                ? 'Да'
                : 'Нет'
              : '—'}
          </strong>
        </div>

        <div>
          <span>Поведение</span>
          <strong>
            {candidate
              ? BEHAVIOR_LABELS[
                  candidate.behavior
                ]
              : '—'}
          </strong>
        </div>

        <div>
          <span>Реакция</span>
          <strong>
            {candidate
              ? REACTION_LABELS[
                  candidate
                    .postEventReaction
                ]
              : '—'}
          </strong>
        </div>

        <div>
          <span>Данные</span>
          <strong>
            {candidate
              ? AVAILABILITY_LABELS[
                  candidate
                    .latestAvailability
                ]
              : '—'}
          </strong>
        </div>

        <div>
          <span>Изменение цены</span>
          <strong>
            {formatSignedPercent(
              candidate
                ?.netPriceChangePct
              ?? null,
            )}
          </strong>
        </div>

        <div>
          <span>Стакан</span>
          <strong>
            {formatSignedPercent(
              candidate
                ?.latestOrderBookImbalancePct
              ?? null,
            )}
          </strong>
        </div>

        <div>
          <span>MFE</span>
          <strong className={styles.positiveValue}>
            {formatSignedPercent(
              outcome
                ?.maxFavorableExcursionPct
              ?? null,
            )}
          </strong>
        </div>

        <div>
          <span>MAE</span>
          <strong className={styles.negativeValue}>
            {formatSignedPercent(
              outcome
                ?.maxAdverseExcursionPct
              ?? null,
            )}
          </strong>
        </div>

        <div>
          <span>Время до исхода</span>
          <strong>
            {formatDuration(
              outcome?.timeToOutcomeMs
              ?? null,
            )}
          </strong>
        </div>
      </div>

      {
        reasons.length > 0
          ? (
              <ul className={styles.reasons}>
                {reasons
                  .slice(0, 3)
                  .map(
                    (reason) => (
                      <li key={reason}>
                        {reason}
                      </li>
                    ),
                  )}
              </ul>
            )
          : null
      }

      <footer className={styles.footer}>
        <span>
          Наблюдательный слой — не торговый сигнал и не исполнение сделки.
        </span>
        {
          query.status === 'error'
            ? (
                <button
                  type="button"
                  onClick={query.retry}
                >
                  Обновить
                </button>
              )
            : null
        }
      </footer>
    </section>
  );
}
