import type {
  CausalLevelStage,
  CausalLevelState,
} from '../model/causalLevelLines.js';
import type {
  UseCausalLevelLinesResult,
} from '../hooks/useCausalLevelLines.js';
import type {
  RealtimeConfirmationEvidenceState,
  RealtimeConfirmationReason,
  RealtimeConfirmationStatus,
  RealtimeConfirmationSourceState,
} from '../../api/runtime/levelLinesApi.js';

import styles from './CausalRealtimeConfirmationPanel.module.css';

const STATUS_META: Record<
  RealtimeConfirmationStatus,
  {
    readonly label: string;
    readonly tone: string;
    readonly summary: string;
  }
> = {
  not_applicable: {
    label: 'ОЖИДАНИЕ ПОДХОДА',
    tone: 'pending',
    summary:
      'Подтверждение ещё не применяется: уровень не вошёл в стадию «Подход».',
  },
  collecting: {
    label: 'СБОР ДАННЫХ',
    tone: 'collecting',
    summary:
      'Собираем свежую ленту и синхронизированный стакан.',
  },
  not_ready: {
    label: 'НЕ ГОТОВО',
    tone: 'negative',
    summary:
      'Условия backend-подтверждения пока не выполнены.',
  },
  partial: {
    label: 'ЧАСТИЧНО',
    tone: 'warning',
    summary:
      'Один live-источник поддерживает взаимодействие с уровнем.',
  },
  confirmed: {
    label: 'ВЗАИМОДЕЙСТВИЕ ПОДТВЕРЖДЕНО',
    tone: 'positive',
    summary:
      'Лента и стакан поддерживают взаимодействие; исход ещё не определён.',
  },
};

const BREAK_ATTEMPT_META = {
  label: 'ПОПЫТКА ПРОБОЯ',
  tone: 'warning',
} as const;

const CONFIRMED_BREAKOUT_META = {
  label: 'ПРОБОЙ ПОДТВЕРЖДЁН',
  tone: 'negative',
} as const;

const EVIDENCE_LABELS: Record<
  RealtimeConfirmationEvidenceState,
  string
> = {
  supports: 'поддерживает',
  opposes: 'против',
  neutral: 'нейтрально',
  unavailable: 'нет данных',
};

const REASON_LABELS: Record<
  RealtimeConfirmationReason,
  string
> = {
  line_not_in_approach:
    'Уровень ещё не находится в стадии «Подход».',
  approach_from_wrong_side:
    'Цена подходит к уровню с неверной стороны.',
  closed_candle_did_not_intersect_level_zone:
    'Закрытая свеча ещё не вошла в зону уровня.',
  tape_collecting:
    'Лента сделок ещё собирается.',
  tape_stale:
    'Данные ленты устарели.',
  tape_error:
    'Лента сделок временно недоступна.',
  order_book_collecting:
    'Синхронизированный стакан ещё собирается.',
  order_book_stale:
    'Данные стакана устарели.',
  order_book_error:
    'Синхронизированный стакан временно недоступен.',
  trade_flow_opposes_interaction:
    'Поток сделок направлен против взаимодействия с уровнем.',
  order_book_opposes_interaction:
    'Давление стакана направлено против взаимодействия с уровнем.',
  trade_flow_and_order_book_support_interaction:
    'Поток сделок и стакан согласованно поддерживают взаимодействие.',
  one_live_source_supports_interaction:
    'Один live-источник поддерживает взаимодействие, второй нейтрален.',
  directional_pressure_not_sufficient:
    'Направленного давления пока недостаточно.',
};

function formatPrice(
  value: number,
): string {
  const absolute =
    Math.abs(value);

  return new Intl.NumberFormat(
    'ru-RU',
    {
      maximumFractionDigits:
        absolute >= 1_000
          ? 2
          : absolute >= 1
            ? 4
            : 7,
    },
  ).format(value);
}

function formatPressure(
  value: number | null,
): string {
  if (value === null) {
    return '—';
  }

  const normalized =
    Math.abs(value) < 0.05
      ? 0
      : value;
  const sign =
    normalized > 0
      ? '+'
      : '';

  return `${sign}${normalized.toLocaleString(
    'ru-RU',
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    },
  )}%`;
}

function formatUpdatedAt(
  value: string,
): string {
  const date =
    new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return 'время неизвестно';
  }

  return date.toLocaleTimeString(
    'ru-RU',
    {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    },
  );
}

function resolveSourceState(
  levels: UseCausalLevelLinesResult,
): RealtimeConfirmationSourceState {
  if (levels.status === 'error') {
    return levels.snapshot
      ? 'stale'
      : 'error';
  }

  const evidence =
    levels.snapshot
      ?.realtimeConfirmation
      .evidence;

  if (!evidence) {
    return 'collecting';
  }

  const states = [
    evidence.tape.state,
    evidence.orderBook.state,
  ];

  if (states.includes('error')) {
    return 'error';
  }

  if (states.includes('stale')) {
    return 'stale';
  }

  if (
    states.every(
      (state) => state === 'live',
    )
  ) {
    return 'live';
  }

  return 'collecting';
}

function stageClass(
  current: CausalLevelStage,
  stage:
    Exclude<CausalLevelStage, null>,
): string {
  const indexes = {
    OBSERVATION: 0,
    APPROACH: 1,
    CONFIRMATION: 2,
  } as const;

  if (current === null) {
    return styles.stagePending;
  }

  if (indexes[stage] < indexes[current]) {
    return styles.stageComplete;
  }

  if (stage === current) {
    return styles.stageCurrent;
  }

  return styles.stagePending;
}

function CausalConfirmationCard({
  state,
}: {
  readonly state: CausalLevelState;
}) {
  const confirmation =
    state.realtimeConfirmation;
  const status =
    confirmation?.status
    ?? 'not_applicable';
  const statusMeta =
    state.interactionState === 'break_confirmed'
      ? CONFIRMED_BREAKOUT_META
      : state.interactionState === 'break_attempt'
        ? BREAK_ATTEMPT_META
        : STATUS_META[status];
  const reasons =
    state.interactionState === 'break_confirmed'
      ? [
          state.line.breakEvidence?.mode
          === 'consecutive_closes'
            ? 'Level Engine подтвердил пробой последовательными закрытиями свечей.'
            : 'Level Engine подтвердил решительный пробой телом свечи.',
          'Пробитый уровень исключён backend из активных.',
        ]
      : state.interactionState === 'break_attempt'
      ? [
          state.line.kind === 'support'
            ? 'Цена находится ниже зоны поддержки.'
            : 'Цена находится выше зоны сопротивления.',
          'Пробой, ложный пробой или возврат определяются отдельно по закрытым свечам.',
        ]
      : confirmation?.reasons
      .map(
        (reason) => REASON_LABELS[reason],
      )
      .slice(0, 2)
      ?? [STATUS_META[status].summary];

  return (
    <article
      className={[
        styles.card,
        styles[
          `kind_${state.line.kind}`
        ],
      ].join(' ')}
    >
      <div className={styles.cardHeader}>
        <div>
          <span>
            {state.line.kind === 'support'
              ? 'Поддержка'
              : 'Сопротивление'}
          </span>
          <strong>
            {formatPrice(state.line.price)}
          </strong>
        </div>
        <span
          className={[
            styles.statusBadge,
            styles[
              `status_${statusMeta.tone}`
            ],
          ].join(' ')}
        >
          {statusMeta.label}
        </span>
      </div>

      <div
        className={styles.stageFlow}
        aria-label="Наблюдение, Подход, Подтверждение"
      >
        {([
          ['OBSERVATION', 'Наблюдение'],
          ['APPROACH', 'Подход'],
          ['CONFIRMATION', 'Подтверждение'],
        ] as const).map(
          ([stage, label]) => (
            <span
              key={stage}
              className={[
                stageClass(
                  state.stage,
                  stage,
                ),
                styles[
                  `stage_${stage.toLowerCase()}`
                ],
              ].join(' ')}
            >
              <i aria-hidden="true" />
              {label}
            </span>
          ),
        )}
      </div>

      {confirmation && (
        <div className={styles.evidenceGrid}>
          <div>
            <span>Лента</span>
            <strong
              className={
                styles[
                  `evidence_${confirmation.tapeState}`
                ]
              }
            >
              {EVIDENCE_LABELS[confirmation.tapeState]}
            </strong>
            <small>
              {formatPressure(
                confirmation
                  .directionalTapePressurePercent,
              )}
            </small>
          </div>
          <div>
            <span>Стакан</span>
            <strong
              className={
                styles[
                  `evidence_${confirmation.orderBookState}`
                ]
              }
            >
              {EVIDENCE_LABELS[confirmation.orderBookState]}
            </strong>
            <small>
              {formatPressure(
                confirmation
                  .directionalOrderBookPressurePercent,
              )}
            </small>
          </div>
        </div>
      )}

      <ul className={styles.reasons}>
        {reasons.map(
          (reason) => (
            <li key={reason}>
              {reason}
            </li>
          ),
        )}
      </ul>
    </article>
  );
}

export function CausalRealtimeConfirmationPanel({
  levels,
  focusState,
}: {
  readonly levels: UseCausalLevelLinesResult;
  readonly focusState?: CausalLevelState | null;
}) {
  const sourceState =
    resolveSourceState(levels);
  const evaluatedAt =
    levels.snapshot
      ?.realtimeConfirmation
      .evaluatedAt;

  return (
    <section
      className={styles.root}
      aria-label="Backend-подтверждение causal-уровней"
    >
      <header className={styles.header}>
        <div>
          <h3>Подтверждение уровня</h3>
          <small>
            BACKEND
            {evaluatedAt
              ? ` · ${formatUpdatedAt(evaluatedAt)}`
              : ''}
          </small>
        </div>
        <span
          className={[
            styles.sourceBadge,
            styles[
              `source_${sourceState}`
            ],
          ].join(' ')}
          aria-live="polite"
        >
          {sourceState.toUpperCase()}
        </span>
      </header>

      {!levels.supported ? (
        <p className={styles.notice}>
          Текущий таймфрейм не поддерживает causal-уровни.
        </p>
      ) : levels.status === 'loading'
        && levels.snapshot === null ? (
          <p className={styles.notice}>
            Загружаем уровни и backend-подтверждение…
          </p>
        ) : levels.status === 'error'
          && levels.snapshot === null ? (
            <div className={styles.noticeRow}>
              <span>Подтверждение временно недоступно.</span>
              <button
                type="button"
                onClick={levels.retry}
              >
                Повторить
              </button>
            </div>
          ) : !focusState
            && levels.primaryStates.length === 0 ? (
            <p className={styles.notice}>
              Активных уровней для наблюдения сейчас нет.
            </p>
          ) : (
            <div className={styles.cards}>
              {(focusState
                ? [focusState]
                : levels.primaryStates
              ).map(
                (state) => (
                  <CausalConfirmationCard
                    key={state.line.id}
                    state={state}
                  />
                ),
              )}
            </div>
          )}

      <p className={styles.disclaimer}>
        Realtime Confirmation: без сигнала, score и исхода.
        Пробой подтверждается только Level Engine.
      </p>
    </section>
  );
}
