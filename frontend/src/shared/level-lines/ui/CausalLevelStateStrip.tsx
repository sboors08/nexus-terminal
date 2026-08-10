import type {
  CSSProperties,
} from 'react';

import type {
  CausalLevelState,
} from '../model/causalLevelLines.js';
import type {
  UseCausalLevelLinesResult,
} from '../hooks/useCausalLevelLines.js';
import styles from './CausalLevelStateStrip.module.css';

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

function lifecycleLabel(
  state: CausalLevelState,
): string {
  const touchLabel =
    state.line.touchCount === 1
      ? '1 касание'
      : state.line.touchCount < 5
        ? `${state.line.touchCount} касания`
        : `${state.line.touchCount} касаний`;

  if (state.line.status === 'broken') {
    return `${touchLabel} · уровень пробит`;
  }

  if (state.line.status === 'worked') {
    return state.line.touchCount >= 3
      ? `${touchLabel} · уровень ослаблен`
      : `${touchLabel} · повторное взаимодействие`;
  }

  if (state.line.status === 'confirmed') {
    return `${touchLabel} · рабочий уровень`;
  }

  return `${touchLabel} · кандидат`;
}

function stageLabel(
  state: CausalLevelState,
): string {
  if (state.interactionState === 'break_confirmed') {
    return 'ПРОБОЙ';
  }

  if (state.stage === 'CONFIRMATION') {
    return 'CONFIRMATION';
  }

  if (state.stage === 'APPROACH') {
    return 'APPROACH';
  }

  if (state.stage === 'OBSERVATION') {
    return 'OBSERVATION';
  }

  return 'LEVEL';
}

export function CausalLevelStateStrip({
  levels,
  focusState,
}: {
  readonly levels: UseCausalLevelLinesResult;
  readonly focusState?: CausalLevelState | null;
}) {
  const activeCount =
    levels.states.length;

  return (
    <section
      className={styles.root}
      aria-label="Состояния causal-уровней"
    >
      <header className={styles.header}>
        <span>CAUSAL LEVELS</span>
        <strong>
          {levels.supported
            ? `${activeCount} активных`
            : 'ТФ не поддерживается'}
        </strong>
      </header>

      {!levels.supported ? (
        <p className={styles.notice}>
          Уровни доступны на 1m, 5m, 15m, 1h и 4h.
        </p>
      ) : levels.status === 'loading'
        && levels.snapshot === null ? (
          <p className={styles.notice}>
            Загружаем уровни и состояния…
          </p>
        ) : levels.status === 'error'
          && levels.snapshot === null ? (
            <div className={styles.noticeRow}>
              <span>Уровни временно недоступны.</span>
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
              Активных causal-уровней в текущем snapshot нет.
            </p>
          ) : (
            <div className={styles.items}>
              {(focusState
                ? [focusState]
                : levels.primaryStates
              ).map(
                (state) => {
                  const progress =
                    state.observationProgress
                    ?? 0;
                  const style = {
                    '--level-progress':
                      `${Math.round(progress * 100)}%`,
                  } as CSSProperties;

                  return (
                    <article
                      key={state.line.id}
                      className={[
                        styles.item,
                        styles[
                          `kind_${state.line.kind}`
                        ],
                      ].join(' ')}
                      style={style}
                    >
                      <div className={styles.identity}>
                        <span>
                          {state.line.kind === 'support'
                            ? 'Поддержка'
                            : 'Сопротивление'}
                        </span>
                        <strong>
                          {formatPrice(state.line.price)}
                        </strong>
                        <small>
                          {lifecycleLabel(state)}
                        </small>
                      </div>

                      <div className={styles.stage}>
                        <span
                          className={[
                            styles.stageBadge,
                            state.stage
                              ? styles[
                                  `stage_${state.stage.toLowerCase()}`
                                ]
                              : styles.stage_level,
                          ].join(' ')}
                        >
                          {stageLabel(state)}
                        </span>
                        <small>
                          {state.interactionState === 'break_attempt'
                            ? state.line.kind === 'support'
                              ? 'Цена ниже зоны поддержки'
                              : 'Цена выше зоны сопротивления'
                            : state.interactionState === 'break_confirmed'
                              ? 'Подтверждён закрытыми свечами'
                            : state.distanceToLevelPercent === null
                            ? 'Расстояние неизвестно'
                            : `${state.distanceToLevelPercent.toFixed(2)}% до уровня`}
                        </small>
                      </div>

                      <div className={styles.progress}>
                        <span>
                          {
                            state.interactionState === 'break_attempt'
                              ? 'Попытка пробоя'
                              : state.interactionState === 'break_confirmed'
                                ? 'Пробой подтверждён'
                              : state.realtimeConfirmation?.status
                              === 'confirmed'
                              ? 'Взаимодействие подтверждено'
                              : 'Прогресс возврата'
                          }
                          <strong>
                            {
                              state.interactionState === 'break_attempt'
                                ? 'РИСК'
                                : state.interactionState === 'break_confirmed'
                                  ? 'ФАКТ'
                                : state.realtimeConfirmation?.status
                                === 'confirmed'
                                ? 'ЕСТЬ'
                                : state.observationProgress === null
                                  ? '—'
                                  : `${Math.round(progress * 100)}%`
                            }
                          </strong>
                        </span>
                        <i><b /></i>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          )}
    </section>
  );
}
