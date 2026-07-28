import type {
  DataFreshnessState,
  DataFreshnessTone,
} from './dataFreshness.js';
import type {
  WorkspaceLiquidityMapView,
} from './workspaceLiquidityMap.js';
import type {
  WorkspaceTradeTapeView,
} from './workspaceTradeTape.js';

export type WorkspaceMarketDynamicsFreshnessState =
  | 'live'
  | 'collecting'
  | 'stale'
  | 'error';

export type WorkspaceMarketDynamicsFreshnessTone =
  | 'live'
  | 'pending'
  | 'warning'
  | 'error';

export type WorkspaceMarketMode =
  | 'buyers'
  | 'sellers'
  | 'balanced'
  | 'collecting'
  | 'unavailable';

export type WorkspaceMarketModeTone =
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'pending'
  | 'error';

export type WorkspaceMarketSourceAgreement =
  | 'aligned'
  | 'mixed'
  | 'neutral'
  | 'unavailable';

export type WorkspaceActivityTrend =
  | 'accelerating'
  | 'slowing'
  | 'stable'
  | 'unknown';

export interface WorkspaceMarketDynamicsFreshness {
  state:
    WorkspaceMarketDynamicsFreshnessState;
  tone:
    WorkspaceMarketDynamicsFreshnessTone;
  label:
    'LIVE'
    | 'COLLECTING'
    | 'STALE'
    | 'ERROR';
  message: string;
  lastUpdatedLabel: string;
  tapeState:
    DataFreshnessState;
  orderBookState:
    WorkspaceLiquidityMapView[
      'freshness'
    ][
      'state'
    ];
}

export interface WorkspaceMarketDynamicsView {
  freshness:
    WorkspaceMarketDynamicsFreshness;
  mode:
    WorkspaceMarketMode;
  modeLabel: string;
  modeTone:
    WorkspaceMarketModeTone;
  modeDescription: string;
  agreement:
    WorkspaceMarketSourceAgreement;
  pressureScore:
    number
    | null;
  buyerPressurePct:
    number
    | null;
  sellerPressurePct:
    number
    | null;
  tradeRate:
    number
    | null;
  previousTradeRate:
    number
    | null;
  accelerationPct:
    number
    | null;
  activityTrend:
    WorkspaceActivityTrend;
  buyQuoteValue:
    number
    | null;
  sellQuoteValue:
    number
    | null;
  totalQuoteValue:
    number
    | null;
  deltaQuoteValue:
    number
    | null;
  deltaPressurePct:
    number
    | null;
  buySharePct:
    number
    | null;
  bookImbalancePct:
    number
    | null;
  spread:
    number
    | null;
  spreadPct:
    number
    | null;
  bidDepthQuote:
    number
    | null;
  askDepthQuote:
    number
    | null;
  hasTapeData: boolean;
  hasOrderBookData: boolean;
}

export interface BuildWorkspaceMarketDynamicsOptions {
  tradeTape:
    WorkspaceTradeTapeView;
  liquidityMap:
    WorkspaceLiquidityMapView;
}

const MARKET_MODE_THRESHOLD =
  12;

const SOURCE_DIRECTION_THRESHOLD =
  5;

const FLOW_PRESSURE_WEIGHT =
  0.55;

const BOOK_PRESSURE_WEIGHT =
  0.45;

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  );
}

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

function isUnavailableTapeState(
  state:
    DataFreshnessState,
): boolean {
  return state
    === 'error'
    || state
      === 'offline';
}

function isUnavailableOrderBookState(
  state:
    WorkspaceLiquidityMapView[
      'freshness'
    ][
      'state'
    ],
): boolean {
  return state
    === 'error';
}

function mapFreshnessTone(
  tone:
    DataFreshnessTone
    | WorkspaceLiquidityMapView[
        'freshness'
      ][
        'tone'
      ],
): WorkspaceMarketDynamicsFreshnessTone {
  if (
    tone
    === 'live'
  ) {
    return 'live';
  }

  if (
    tone
    === 'warning'
  ) {
    return 'warning';
  }

  if (
    tone
    === 'error'
    || tone
      === 'offline'
  ) {
    return 'error';
  }

  return 'pending';
}

function resolveCombinedFreshness(
  tradeTape:
    WorkspaceTradeTapeView,
  liquidityMap:
    WorkspaceLiquidityMapView,
  hasTapeData: boolean,
  hasOrderBookData: boolean,
): WorkspaceMarketDynamicsFreshness {
  const tapeState =
    tradeTape
      .freshness
      .state;

  const orderBookState =
    liquidityMap
      .freshness
      .state;

  const bothLive =
    tapeState
      === 'live'
    && orderBookState
      === 'live'
    && hasTapeData
    && hasOrderBookData;

  if (bothLive) {
    return {
      state:
        'live',
      tone:
        'live',
      label:
        'LIVE',
      message:
        'Поток сделок и глубина стакана обновляются в реальном времени.',
      lastUpdatedLabel:
        [
          'Лента',
          tradeTape
            .freshness
            .lastUpdatedLabel,
          'Стакан',
          liquidityMap
            .freshness
            .lastUpdatedLabel,
        ].join(
          ' · ',
        ),
      tapeState,
      orderBookState,
    };
  }

  const anyData =
    hasTapeData
    || hasOrderBookData;

  const sourceInterrupted =
    tapeState
      === 'stale'
    || orderBookState
      === 'stale'
    || isUnavailableTapeState(
      tapeState,
    )
    || isUnavailableOrderBookState(
      orderBookState,
    );

  if (
    anyData
    && sourceInterrupted
  ) {
    return {
      state:
        'stale',
      tone:
        'warning',
      label:
        'STALE',
      message:
        'Показаны последние доступные метрики. Один или несколько источников временно не обновляются.',
      lastUpdatedLabel:
        [
          'Лента',
          tradeTape
            .freshness
            .lastUpdatedLabel,
          'Стакан',
          liquidityMap
            .freshness
            .lastUpdatedLabel,
        ].join(
          ' · ',
        ),
      tapeState,
      orderBookState,
    };
  }

  if (
    !anyData
    && (
      isUnavailableTapeState(
        tapeState,
      )
      || isUnavailableOrderBookState(
        orderBookState,
      )
    )
  ) {
    const sourceTone =
      isUnavailableTapeState(
        tapeState,
      )
        ? tradeTape
            .freshness
            .tone
        : liquidityMap
            .freshness
            .tone;

    return {
      state:
        'error',
      tone:
        mapFreshnessTone(
          sourceTone,
        ),
      label:
        'ERROR',
      message:
        'Не удалось получить поток сделок и данные стакана.',
      lastUpdatedLabel:
        [
          'Лента',
          tradeTape
            .freshness
            .lastUpdatedLabel,
          'Стакан',
          liquidityMap
            .freshness
            .lastUpdatedLabel,
        ].join(
          ' · ',
        ),
      tapeState,
      orderBookState,
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
      'Собираем поток сделок и синхронизируем стакан.',
    lastUpdatedLabel:
      [
        'Лента',
        tradeTape
          .freshness
          .lastUpdatedLabel,
        'Стакан',
        liquidityMap
          .freshness
          .lastUpdatedLabel,
      ].join(
        ' · ',
      ),
    tapeState,
    orderBookState,
  };
}

function getDirection(
  value:
    number
    | null,
): -1 | 0 | 1 | null {
  if (
    value === null
  ) {
    return null;
  }

  if (
    value
    > SOURCE_DIRECTION_THRESHOLD
  ) {
    return 1;
  }

  if (
    value
    < -SOURCE_DIRECTION_THRESHOLD
  ) {
    return -1;
  }

  return 0;
}

function resolveAgreement(
  flowPressurePct:
    number
    | null,
  bookPressurePct:
    number
    | null,
): WorkspaceMarketSourceAgreement {
  const flowDirection =
    getDirection(
      flowPressurePct,
    );

  const bookDirection =
    getDirection(
      bookPressurePct,
    );

  if (
    flowDirection === null
    || bookDirection === null
  ) {
    return 'unavailable';
  }

  if (
    flowDirection === 0
    || bookDirection === 0
  ) {
    return 'neutral';
  }

  return flowDirection
    === bookDirection
      ? 'aligned'
      : 'mixed';
}

function resolveActivityTrend(
  accelerationPct:
    number
    | null,
): WorkspaceActivityTrend {
  if (
    accelerationPct === null
  ) {
    return 'unknown';
  }

  if (
    accelerationPct >= 15
  ) {
    return 'accelerating';
  }

  if (
    accelerationPct <= -15
  ) {
    return 'slowing';
  }

  return 'stable';
}

function resolveMode(
  pressureScore:
    number
    | null,
  freshness:
    WorkspaceMarketDynamicsFreshness,
  agreement:
    WorkspaceMarketSourceAgreement,
): {
  mode:
    WorkspaceMarketMode;
  modeLabel: string;
  modeTone:
    WorkspaceMarketModeTone;
  modeDescription: string;
} {
  if (
    pressureScore === null
  ) {
    if (
      freshness.state
      === 'collecting'
    ) {
      return {
        mode:
          'collecting',
        modeLabel:
          'СБОР ДАННЫХ',
        modeTone:
          'pending',
        modeDescription:
          'Для сводной оценки нужны одновременно поток сделок и синхронизированный стакан.',
      };
    }

    return {
      mode:
        'unavailable',
      modeLabel:
        'НЕТ ДАННЫХ',
      modeTone:
        'error',
      modeDescription:
        'Сводная оценка недоступна, пока один из источников не содержит данных.',
    };
  }

  if (
    pressureScore
    >= MARKET_MODE_THRESHOLD
  ) {
    return {
      mode:
        'buyers',
      modeLabel:
        'ПОКУПАТЕЛИ',
      modeTone:
        'positive',
      modeDescription:
        agreement
          === 'aligned'
          ? 'Поток сделок и глубина стакана поддерживают покупателей.'
          : agreement
              === 'mixed'
            ? 'Сводный перевес покупателей, но поток сделок и стакан расходятся.'
            : 'Сводные данные показывают перевес покупателей.',
    };
  }

  if (
    pressureScore
    <= -MARKET_MODE_THRESHOLD
  ) {
    return {
      mode:
        'sellers',
      modeLabel:
        'ПРОДАВЦЫ',
      modeTone:
        'negative',
      modeDescription:
        agreement
          === 'aligned'
          ? 'Поток сделок и глубина стакана поддерживают продавцов.'
          : agreement
              === 'mixed'
            ? 'Сводный перевес продавцов, но поток сделок и стакан расходятся.'
            : 'Сводные данные показывают перевес продавцов.',
    };
  }

  return {
    mode:
      'balanced',
    modeLabel:
      'БАЛАНС',
    modeTone:
      'neutral',
    modeDescription:
      agreement
        === 'mixed'
        ? 'Поток сделок и стакан направлены в разные стороны, сводный перевес слабый.'
        : 'Поток сделок и глубина стакана близки к балансу.',
  };
}

export function buildWorkspaceMarketDynamics(
  options:
    BuildWorkspaceMarketDynamicsOptions,
): WorkspaceMarketDynamicsView {
  const {
    tradeTape,
    liquidityMap,
  } = options;

  const hasTapeData =
    tradeTape
      .freshness
      .hasData
    && tradeTape
      .prints
      .length > 0;

  const hasOrderBookData =
    liquidityMap
      .asks
      .length > 0
    || liquidityMap
      .bids
      .length > 0;

  const freshness =
    resolveCombinedFreshness(
      tradeTape,
      liquidityMap,
      hasTapeData,
      hasOrderBookData,
    );

  const tradeRate =
    hasTapeData
      ? tradeTape
          .metrics
          .tradeRate
      : null;

  const previousTradeRate =
    hasTapeData
      ? tradeTape
          .metrics
          .previousTradeRate
      : null;

  const accelerationPct =
    hasTapeData
      ? tradeTape
          .metrics
          .accelerationPct
      : null;

  const buyQuoteValue =
    hasTapeData
      ? tradeTape
          .metrics
          .buyQuoteValue
      : null;

  const sellQuoteValue =
    hasTapeData
      ? tradeTape
          .metrics
          .sellQuoteValue
      : null;

  const totalQuoteValue =
    hasTapeData
      ? tradeTape
          .metrics
          .totalQuoteValue
      : null;

  const deltaQuoteValue =
    hasTapeData
      ? tradeTape
          .metrics
          .deltaQuoteValue
      : null;

  const buySharePct =
    hasTapeData
      ? tradeTape
          .metrics
          .buySharePct
      : null;

  const flowPressurePct =
    buySharePct === null
      ? null
      : round(
          clamp(
            (
              buySharePct
              - 50
            )
            * 2,
            -100,
            100,
          ),
          1,
        );

  const deltaPressurePct =
    totalQuoteValue !== null
    && totalQuoteValue > 0
    && deltaQuoteValue !== null
      ? round(
          clamp(
            (
              deltaQuoteValue
              / totalQuoteValue
            )
            * 100,
            -100,
            100,
          ),
          1,
        )
      : null;

  const bookImbalancePct =
    hasOrderBookData
      ? liquidityMap
          .imbalancePct
      : null;

  const pressureScore =
    flowPressurePct !== null
    && bookImbalancePct !== null
      ? round(
          clamp(
            flowPressurePct
              * FLOW_PRESSURE_WEIGHT
            + bookImbalancePct
              * BOOK_PRESSURE_WEIGHT,
            -100,
            100,
          ),
          1,
        )
      : null;

  const agreement =
    resolveAgreement(
      flowPressurePct,
      bookImbalancePct,
    );

  const mode =
    resolveMode(
      pressureScore,
      freshness,
      agreement,
    );

  const buyerPressurePct =
    pressureScore === null
      ? null
      : round(
          clamp(
            (
              pressureScore
              + 100
            )
            / 2,
            0,
            100,
          ),
          1,
        );

  return {
    freshness,
    ...mode,
    agreement,
    pressureScore,
    buyerPressurePct,
    sellerPressurePct:
      buyerPressurePct === null
        ? null
        : round(
            100
            - buyerPressurePct,
            1,
          ),
    tradeRate,
    previousTradeRate,
    accelerationPct,
    activityTrend:
      resolveActivityTrend(
        accelerationPct,
      ),
    buyQuoteValue,
    sellQuoteValue,
    totalQuoteValue,
    deltaQuoteValue,
    deltaPressurePct,
    buySharePct,
    bookImbalancePct,
    spread:
      hasOrderBookData
        ? liquidityMap
            .spread
        : null,
    spreadPct:
      hasOrderBookData
        ? liquidityMap
            .spreadPct
        : null,
    bidDepthQuote:
      hasOrderBookData
        ? liquidityMap
            .bidDepthQuote
        : null,
    askDepthQuote:
      hasOrderBookData
        ? liquidityMap
            .askDepthQuote
        : null,
    hasTapeData,
    hasOrderBookData,
  };
}
