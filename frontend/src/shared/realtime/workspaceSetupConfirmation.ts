import type {
  WorkspaceMarketDynamicsView,
} from './workspaceMarketDynamics.js';

export type WorkspaceSetupDirection =
  | 'long'
  | 'short';

export type WorkspaceSetupConfirmationFreshnessState =
  | 'live'
  | 'collecting'
  | 'stale'
  | 'error';

export type WorkspaceSetupConfirmationFreshnessTone =
  | 'live'
  | 'pending'
  | 'warning'
  | 'error';

export type WorkspaceSetupConfirmationStatus =
  | 'not-ready'
  | 'partial'
  | 'confirmed';

export type WorkspaceSetupConfirmationTone =
  | 'negative'
  | 'warning'
  | 'positive';

export type WorkspaceSetupEvidenceState =
  | 'supports'
  | 'opposes'
  | 'neutral'
  | 'unavailable';

export type WorkspaceSetupConfirmationCheckId =
  | 'trade-flow'
  | 'order-book'
  | 'agreement'
  | 'combined-pressure';

export interface WorkspaceSetupConfirmationFreshness {
  state:
    WorkspaceSetupConfirmationFreshnessState;
  tone:
    WorkspaceSetupConfirmationFreshnessTone;
  label:
    'LIVE'
    | 'COLLECTING'
    | 'STALE'
    | 'ERROR';
  message: string;
  lastUpdatedLabel: string;
}

export interface WorkspaceSetupConfirmationCheck {
  id:
    WorkspaceSetupConfirmationCheckId;
  label: string;
  state:
    WorkspaceSetupEvidenceState;
  valuePct:
    number
    | null;
  detail: string;
}

export interface WorkspaceSetupConfirmationView {
  direction:
    WorkspaceSetupDirection;
  freshness:
    WorkspaceSetupConfirmationFreshness;
  status:
    WorkspaceSetupConfirmationStatus;
  statusLabel:
    'НЕ ГОТОВО'
    | 'ЧАСТИЧНО'
    | 'ПОДТВЕРЖДЕНО';
  tone:
    WorkspaceSetupConfirmationTone;
  summary: string;
  directionalPressurePct:
    number
    | null;
  supportCount: number;
  blockingCount: number;
  isLiveConfirmation: boolean;
  checks:
    WorkspaceSetupConfirmationCheck[];
  reasons: string[];
}

export interface BuildWorkspaceSetupConfirmationOptions {
  direction:
    WorkspaceSetupDirection;
  marketDynamics:
    WorkspaceMarketDynamicsView;
}

const SOURCE_SUPPORT_THRESHOLD =
  8;

const COMBINED_SUPPORT_THRESHOLD =
  12;

function round(
  value: number,
  digits: number,
): number {
  const factor =
    10 ** digits;

  return Math.round(
    value
    * factor,
  ) / factor;
}

function getDirectionSign(
  direction:
    WorkspaceSetupDirection,
): 1 | -1 {
  return direction
    === 'long'
      ? 1
      : -1;
}

function getDirectionLabel(
  direction:
    WorkspaceSetupDirection,
): 'LONG' | 'SHORT' {
  return direction
    .toLocaleUpperCase(
      'en-US',
    ) as 'LONG' | 'SHORT';
}

function resolveEvidenceState(
  directionalValue:
    number
    | null,
  supportThreshold =
    SOURCE_SUPPORT_THRESHOLD,
): WorkspaceSetupEvidenceState {
  if (
    directionalValue === null
  ) {
    return 'unavailable';
  }

  if (
    directionalValue
    >= supportThreshold
  ) {
    return 'supports';
  }

  if (
    directionalValue
    <= -supportThreshold
  ) {
    return 'opposes';
  }

  return 'neutral';
}

function formatSignedPercent(
  value:
    number
    | null,
): string {
  if (
    value === null
  ) {
    return '—';
  }

  const normalizedValue =
    Math.abs(
      value,
    ) < 0.05
      ? 0
      : value;

  const sign =
    normalizedValue > 0
      ? '+'
      : '';

  return sign
    + normalizedValue.toLocaleString(
        'ru-RU',
        {
          minimumFractionDigits:
            1,
          maximumFractionDigits:
            1,
        },
      )
    + '%';
}

function resolveFreshness(
  marketDynamics:
    WorkspaceMarketDynamicsView,
): WorkspaceSetupConfirmationFreshness {
  const state =
    marketDynamics
      .freshness
      .state;

  const lastUpdatedLabel =
    marketDynamics
      .freshness
      .lastUpdatedLabel;

  if (
    state === 'live'
  ) {
    return {
      state:
        'live',
      tone:
        'live',
      label:
        'LIVE',
      message:
        'Подтверждение рассчитано по live-ленте и синхронизированному стакану.',
      lastUpdatedLabel,
    };
  }

  if (
    state === 'stale'
  ) {
    return {
      state:
        'stale',
      tone:
        'warning',
      label:
        'STALE',
      message:
        'Показана последняя рассчитанная оценка. Текущее подтверждение временно не обновляется.',
      lastUpdatedLabel,
    };
  }

  if (
    state === 'error'
  ) {
    return {
      state:
        'error',
      tone:
        'error',
      label:
        'ERROR',
      message:
        'Не удалось рассчитать подтверждение без доступных live-источников.',
      lastUpdatedLabel,
    };
  }

  return {
    state:
      'collecting',
    tone:
      'pending',
    label:
      'COLLECTING',
    message:
      'Собираем поток сделок и глубину стакана для подтверждения направления.',
    lastUpdatedLabel,
  };
}

function buildTradeFlowCheck(
  direction:
    WorkspaceSetupDirection,
  directionalFlowPct:
    number
    | null,
): WorkspaceSetupConfirmationCheck {
  const directionLabel =
    getDirectionLabel(
      direction,
    );

  const state =
    resolveEvidenceState(
      directionalFlowPct,
    );

  const detail =
    state === 'unavailable'
      ? 'Дельта потока сделок ещё не рассчитана.'
      : state === 'supports'
        ? `Поток сделок поддерживает ${directionLabel}: ${formatSignedPercent(
            directionalFlowPct,
          )}.`
        : state === 'opposes'
          ? `Поток сделок направлен против ${directionLabel}: ${formatSignedPercent(
              directionalFlowPct,
            )}.`
          : `Поток сделок близок к балансу относительно ${directionLabel}: ${formatSignedPercent(
              directionalFlowPct,
            )}.`;

  return {
    id:
      'trade-flow',
    label:
      'Поток сделок',
    state,
    valuePct:
      directionalFlowPct,
    detail,
  };
}

function buildOrderBookCheck(
  direction:
    WorkspaceSetupDirection,
  directionalBookPct:
    number
    | null,
): WorkspaceSetupConfirmationCheck {
  const directionLabel =
    getDirectionLabel(
      direction,
    );

  const state =
    resolveEvidenceState(
      directionalBookPct,
    );

  const detail =
    state === 'unavailable'
      ? 'Дисбаланс стакана ещё не рассчитан.'
      : state === 'supports'
        ? `Глубина стакана поддерживает ${directionLabel}: ${formatSignedPercent(
            directionalBookPct,
          )}.`
        : state === 'opposes'
          ? `Глубина стакана направлена против ${directionLabel}: ${formatSignedPercent(
              directionalBookPct,
            )}.`
          : `Глубина стакана близка к балансу относительно ${directionLabel}: ${formatSignedPercent(
              directionalBookPct,
            )}.`;

  return {
    id:
      'order-book',
    label:
      'Стакан',
    state,
    valuePct:
      directionalBookPct,
    detail,
  };
}

function buildAgreementCheck(
  flowState:
    WorkspaceSetupEvidenceState,
  bookState:
    WorkspaceSetupEvidenceState,
): WorkspaceSetupConfirmationCheck {
  let state:
    WorkspaceSetupEvidenceState;

  if (
    flowState === 'unavailable'
    || bookState === 'unavailable'
  ) {
    state =
      'unavailable';
  }
  else if (
    flowState === 'supports'
    && bookState === 'supports'
  ) {
    state =
      'supports';
  }
  else if (
    flowState === 'opposes'
    || bookState === 'opposes'
  ) {
    state =
      'opposes';
  }
  else {
    state =
      'neutral';
  }

  const detail =
    state === 'supports'
      ? 'Лента и стакан одновременно поддерживают направление сетапа.'
      : state === 'opposes'
        ? 'Лента и стакан не дают согласованного подтверждения направления.'
        : state === 'neutral'
          ? 'Источники не конфликтуют, но общего направленного перевеса пока нет.'
          : 'Для проверки согласованности нужны данные обоих источников.';

  return {
    id:
      'agreement',
    label:
      'Согласованность',
    state,
    valuePct:
      null,
    detail,
  };
}

function buildPressureCheck(
  direction:
    WorkspaceSetupDirection,
  directionalPressurePct:
    number
    | null,
): WorkspaceSetupConfirmationCheck {
  const directionLabel =
    getDirectionLabel(
      direction,
    );

  const state =
    resolveEvidenceState(
      directionalPressurePct,
      COMBINED_SUPPORT_THRESHOLD,
    );

  const detail =
    state === 'unavailable'
      ? 'Сводное давление ещё не рассчитано.'
      : state === 'supports'
        ? `Сводное давление достаточно для ${directionLabel}: ${formatSignedPercent(
            directionalPressurePct,
          )}.`
        : state === 'opposes'
          ? `Сводное давление направлено против ${directionLabel}: ${formatSignedPercent(
              directionalPressurePct,
            )}.`
          : `Сводное давление пока недостаточно для подтверждения ${directionLabel}: ${formatSignedPercent(
              directionalPressurePct,
            )}.`;

  return {
    id:
      'combined-pressure',
    label:
      'Сводное давление',
    state,
    valuePct:
      directionalPressurePct,
    detail,
  };
}

function resolveStatus(
  checks:
    readonly WorkspaceSetupConfirmationCheck[],
): {
  status:
    WorkspaceSetupConfirmationStatus;
  statusLabel:
    WorkspaceSetupConfirmationView[
      'statusLabel'
    ];
  tone:
    WorkspaceSetupConfirmationTone;
  supportCount: number;
  blockingCount: number;
} {
  const supportCount =
    checks.filter(
      (check) =>
        check.state
        === 'supports',
    ).length;

  const blockingCount =
    checks.filter(
      (check) =>
        check.state
        === 'opposes',
    ).length;

  const allConfirmed =
    checks.length > 0
    && checks.every(
      (check) =>
        check.state
        === 'supports',
    );

  if (allConfirmed) {
    return {
      status:
        'confirmed',
      statusLabel:
        'ПОДТВЕРЖДЕНО',
      tone:
        'positive',
      supportCount,
      blockingCount,
    };
  }

  if (
    blockingCount > 0
    || supportCount === 0
  ) {
    return {
      status:
        'not-ready',
      statusLabel:
        'НЕ ГОТОВО',
      tone:
        'negative',
      supportCount,
      blockingCount,
    };
  }

  return {
    status:
      'partial',
    statusLabel:
      'ЧАСТИЧНО',
    tone:
      'warning',
    supportCount,
    blockingCount,
  };
}

function resolveSummary(
  direction:
    WorkspaceSetupDirection,
  freshness:
    WorkspaceSetupConfirmationFreshness,
  status:
    WorkspaceSetupConfirmationStatus,
  blockingCount: number,
): string {
  const directionLabel =
    getDirectionLabel(
      direction,
    );

  if (
    status === 'confirmed'
  ) {
    return freshness.state
      === 'live'
        ? `Лента и стакан одновременно подтверждают направление ${directionLabel}.`
        : `Последнее подтверждение ${directionLabel} сохранено, но live-данные сейчас не обновляются.`;
  }

  if (
    status === 'partial'
  ) {
    return `Часть условий поддерживает ${directionLabel}, но полного согласования пока нет.`;
  }

  if (
    blockingCount > 0
  ) {
    return `Один или несколько источников направлены против ${directionLabel}.`;
  }

  return `Недостаточно данных или направленного перевеса для подтверждения ${directionLabel}.`;
}

export function buildWorkspaceSetupConfirmation(
  options:
    BuildWorkspaceSetupConfirmationOptions,
): WorkspaceSetupConfirmationView {
  const {
    direction,
    marketDynamics,
  } = options;

  const directionSign =
    getDirectionSign(
      direction,
    );

  const directionalFlowPct =
    marketDynamics
      .deltaPressurePct === null
      ? null
      : round(
          marketDynamics
            .deltaPressurePct
          * directionSign,
          1,
        );

  const directionalBookPct =
    marketDynamics
      .bookImbalancePct === null
      ? null
      : round(
          marketDynamics
            .bookImbalancePct
          * directionSign,
          1,
        );

  const directionalPressurePct =
    marketDynamics
      .pressureScore === null
      ? null
      : round(
          marketDynamics
            .pressureScore
          * directionSign,
          1,
        );

  const tradeFlowCheck =
    buildTradeFlowCheck(
      direction,
      directionalFlowPct,
    );

  const orderBookCheck =
    buildOrderBookCheck(
      direction,
      directionalBookPct,
    );

  const agreementCheck =
    buildAgreementCheck(
      tradeFlowCheck.state,
      orderBookCheck.state,
    );

  const pressureCheck =
    buildPressureCheck(
      direction,
      directionalPressurePct,
    );

  const checks = [
    tradeFlowCheck,
    orderBookCheck,
    agreementCheck,
    pressureCheck,
  ];

  const freshness =
    resolveFreshness(
      marketDynamics,
    );

  const status =
    resolveStatus(
      checks,
    );

  return {
    direction,
    freshness,
    status:
      status.status,
    statusLabel:
      status.statusLabel,
    tone:
      status.tone,
    summary:
      resolveSummary(
        direction,
        freshness,
        status.status,
        status.blockingCount,
      ),
    directionalPressurePct,
    supportCount:
      status.supportCount,
    blockingCount:
      status.blockingCount,
    isLiveConfirmation:
      status.status
        === 'confirmed'
      && freshness.state
        === 'live',
    checks,
    reasons:
      checks.map(
        (check) =>
          check.detail,
      ),
  };
}
