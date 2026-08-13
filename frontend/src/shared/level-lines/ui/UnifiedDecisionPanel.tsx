import type {
  UnifiedDecision,
  UnifiedDecisionMarketAlignment,
  UnifiedDecisionState,
} from '../../api/runtime/levelLinesApi.js';
import type {
  UseCausalLevelLinesResult,
} from '../hooks/useCausalLevelLines.js';

import styles from './UnifiedDecisionPanel.module.css';

const STATE_META: Record<
  UnifiedDecisionState,
  {
    readonly label: string;
    readonly summary: string;
    readonly tone: string;
  }
> = {
  observe: {
    label: 'НАБЛЮДАТЬ',
    summary:
      'Уровень найден, но условий для выбора сценария пока недостаточно.',
    tone: 'observe',
  },
  possible_long: {
    label: 'ВОЗМОЖЕН LONG',
    summary:
      'Факты поддерживают сценарий вверх. Это ещё не команда на вход.',
    tone: 'long',
  },
  possible_short: {
    label: 'ВОЗМОЖЕН SHORT',
    summary:
      'Факты поддерживают сценарий вниз. Это ещё не команда на вход.',
    tone: 'short',
  },
  wait_confirmation: {
    label: 'ЖДАТЬ ПОДТВЕРЖДЕНИЯ',
    summary:
      'Уровень близко, но источники ещё не дали согласованного направления.',
    tone: 'wait',
  },
  setup_confirmed: {
    label: 'СЕТАП ПОДТВЕРЖДЁН',
    summary:
      'Setup Engine зафиксировал исход сценария. Проверьте риск и актуальность цены.',
    tone: 'confirmed',
  },
  skip: {
    label: 'ПРОПУСТИТЬ',
    summary:
      'Сейчас нет надёжной основы для сценария либо контекст противоречив.',
    tone: 'skip',
  },
};

const REASON_LABELS:
Readonly<Record<string, string>> = {
  no_active_level:
    'Нет активного causal-уровня.',
  level_candidate_detected:
    'Обнаружен кандидат уровня.',
  level_confirmed:
    'Уровень подтверждён.',
  observation_progress_active:
    'Цена прошла порог наблюдения.',
  approach_active:
    'Цена находится в зоне подхода.',
  realtime_sources_support_breakout:
    'Лента и стакан согласованно поддерживают пробой.',
  realtime_sources_support_bounce:
    'Лента и стакан согласованно поддерживают отскок.',
  setup_breakout_confirmed:
    'Setup Engine подтвердил пробой.',
  setup_bounce_confirmed:
    'Setup Engine подтвердил отскок.',
  btc_context_aligned:
    'Режим BTC совпадает с направлением.',
  symbol_impulse_aligned:
    'Импульс монеты совпадает с направлением.',
  market_context_conflict:
    'Один рыночный фильтр против направления.',
  market_context_double_conflict:
    'Режим BTC и импульс монеты против направления.',
};

const MISSING_LABELS:
Readonly<Record<string, string>> = {
  active_level:
    'активный уровень',
  observation_progress:
    'порог наблюдения',
  approach_to_level:
    'подход к уровню',
  realtime_tape:
    'свежая лента',
  realtime_order_book:
    'синхронизированный стакан',
  realtime_direction_consensus:
    'единое направление ленты и стакана',
  setup_outcome:
    'подтверждённый исход Setup Engine',
  btc_market_mode:
    'актуальный режим BTC',
  symbol_market_impulse:
    'актуальный импульс монеты',
};

const ALIGNMENT_LABELS: Record<
  UnifiedDecisionMarketAlignment,
  string
> = {
  aligned: 'совпадает',
  opposed: 'против',
  neutral: 'нейтрально',
  unavailable: 'нет данных',
};

function scenarioLabel(
  decision: UnifiedDecision,
): string {
  if (decision.scenario === 'breakout') {
    return 'Пробой';
  }

  if (decision.scenario === 'bounce') {
    return 'Отскок';
  }

  return 'Сценарий не выбран';
}

function modeLabel(
  decision: UnifiedDecision,
): string {
  const mode =
    decision.marketContext.btc.mode;

  return mode === 'risk_on'
    ? 'Risk On'
    : mode === 'risk_off'
      ? 'Risk Off'
      : mode === 'neutral'
        ? 'Нейтрально'
        : 'Нет данных';
}

function impulseLabel(
  decision: UnifiedDecision,
): string {
  const direction =
    decision.marketContext
      .impulse.direction;

  return direction === 'long'
    ? 'Вверх'
    : direction === 'short'
      ? 'Вниз'
      : 'Нет импульса';
}

function badgeLabel(
  decision: UnifiedDecision,
): string {
  if (
    decision.state === 'possible_long'
    || decision.state === 'possible_short'
    || decision.state === 'setup_confirmed'
  ) {
    return decision.direction
      ?.toUpperCase()
      ?? 'WAIT';
  }

  if (decision.state === 'skip') {
    return 'SKIP';
  }

  return decision.state === 'observe'
    ? 'WATCH'
    : 'WAIT';
}

export function UnifiedDecisionPanel({
  levels,
}: {
  readonly levels:
    UseCausalLevelLinesResult;
}) {
  const decision =
    levels.snapshot
      ?.unifiedDecision
    ?? null;

  if (!decision) {
    return (
      <section className={styles.panel}>
        <div className={styles.heading}>
          <div>
            <span>Единое решение NEXUS</span>
            <h3>СБОР ДАННЫХ</h3>
          </div>
          <strong className={styles.wait}>
            WAIT
          </strong>
        </div>
        <p className={styles.summary}>
          Backend собирает уровень, ленту, стакан и рыночный контекст.
        </p>
      </section>
    );
  }

  const meta =
    STATE_META[decision.state];

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <div>
          <span>Единое решение NEXUS</span>
          <h3>{meta.label}</h3>
        </div>
        <strong className={styles[meta.tone]}>
          {badgeLabel(decision)}
        </strong>
      </div>

      <p className={styles.summary}>
        {meta.summary}
      </p>

      <div className={styles.matrix}>
        <div>
          <span>Сценарий</span>
          <strong>
            {scenarioLabel(decision)}
          </strong>
        </div>
        <div>
          <span>Стадия</span>
          <strong>
            {decision.causalStage ?? '—'}
          </strong>
        </div>
        <div>
          <span>BTC</span>
          <strong>
            {modeLabel(decision)} · {
              ALIGNMENT_LABELS[
                decision.marketContext
                  .btc.alignment
              ]
            }
          </strong>
        </div>
        <div>
          <span>Импульс</span>
          <strong>
            {impulseLabel(decision)} · {
              ALIGNMENT_LABELS[
                decision.marketContext
                  .impulse.alignment
              ]
            }
          </strong>
        </div>
      </div>

      {decision.reasons.length > 0 && (
        <ul className={styles.reasons}>
          {decision.reasons.map(
            (reason) => (
              <li key={reason}>
                {
                  REASON_LABELS[reason]
                  ?? reason
                }
              </li>
            ),
          )}
        </ul>
      )}

      {
        decision.missingConfirmations
          .length > 0
        && (
          <p className={styles.missing}>
            <strong>Ещё нужно:</strong>{' '}
            {
              decision.missingConfirmations
                .map(
                  (item) =>
                    MISSING_LABELS[item]
                    ?? item,
                )
                .join(', ')
            }.
          </p>
        )
      }

      <small className={styles.boundary}>
        Decision-support: не приказ купить или продать и не оценка вероятности прибыли.
      </small>
    </section>
  );
}
