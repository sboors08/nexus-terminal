import type {
  OrderBookDepthRuntimeService,
} from '../../realtime-market-data/order-book-depth-runtime.types.js';
import type {
  RealtimeMarketDataService,
  RealtimeSymbolSnapshot,
  RealtimeTrade,
} from '../../realtime-market-data/realtime-market-data.types.js';
import type {
  LevelV2BreakClassificationState,
} from './level-v2-break-classification.types.js';
import type {
  LevelV2ShadowMarketEvidence,
  LevelV2ShadowMarketEvidenceAvailability,
  LevelV2ShadowMarketEvidenceCapture,
  LevelV2ShadowMarketEvidenceSource,
  LevelV2ShadowOrderBookEvidence,
  LevelV2ShadowTapeDominantSide,
  LevelV2ShadowTapeEvidence,
} from './level-v2-shadow-market-evidence.types.js';

export interface LevelV2ShadowMarketEvidenceAdapterOptions {
  tapeReader?:
    Pick<
      RealtimeMarketDataService,
      'getSnapshots'
    >
    | null;
  orderBookReader?:
    Pick<
      OrderBookDepthRuntimeService,
      'getSnapshot'
    >
    | null;
}

function roundMetric(
  value: number,
): number {
  return Number(
    value.toFixed(8),
  );
}

function aggregateTrades(
  snapshot:
    RealtimeSymbolSnapshot,
): LevelV2ShadowTapeEvidence {
  const trades =
    snapshot.recentTrades;

  let executionsCount = 0;
  let buyQuoteValue = 0;
  let sellQuoteValue = 0;
  let largestTradeQuoteValue = 0;

  for (
    const trade
    of trades
  ) {
    executionsCount +=
      trade.tradesCount
      ?? 1;

    if (trade.side === 'buy') {
      buyQuoteValue +=
        trade.quoteValue;
    } else {
      sellQuoteValue +=
        trade.quoteValue;
    }

    largestTradeQuoteValue =
      Math.max(
        largestTradeQuoteValue,
        trade.quoteValue,
      );
  }

  const totalQuoteValue =
    buyQuoteValue
    + sellQuoteValue;

  const quoteDelta =
    buyQuoteValue
    - sellQuoteValue;

  const dominantSide:
    LevelV2ShadowTapeDominantSide
    | null =
      totalQuoteValue === 0
        ? null
        : buyQuoteValue
            > sellQuoteValue
          ? 'buy'
          : sellQuoteValue
              > buyQuoteValue
            ? 'sell'
            : 'balanced';

  const firstTrade:
    RealtimeTrade
    | undefined =
      trades[0];

  const lastTrade:
    RealtimeTrade
    | undefined =
      trades[
        trades.length - 1
      ];

  const priceChangePct =
    firstTrade
    && lastTrade
    && firstTrade.price > 0
      ? roundMetric(
          (
            (
              lastTrade.price
              - firstTrade.price
            )
            / firstTrade.price
          )
          * 100,
        )
      : null;

  return {
    snapshotUpdatedAt:
      snapshot.updatedAt,
    lastTradeAt:
      lastTrade?.timestamp
      ?? snapshot.lastTrade?.timestamp
      ?? null,
    tradesCount:
      trades.length,
    executionsCount,
    buyQuoteValue:
      roundMetric(
        buyQuoteValue,
      ),
    sellQuoteValue:
      roundMetric(
        sellQuoteValue,
      ),
    totalQuoteValue:
      roundMetric(
        totalQuoteValue,
      ),
    quoteDelta:
      roundMetric(
        quoteDelta,
      ),
    buySharePct:
      totalQuoteValue > 0
        ? roundMetric(
            (
              buyQuoteValue
              / totalQuoteValue
            )
            * 100,
          )
        : null,
    dominantSide,
    largestTradeQuoteValue:
      roundMetric(
        largestTradeQuoteValue,
      ),
    firstTradePrice:
      firstTrade?.price
      ?? null,
    lastTradePrice:
      lastTrade?.price
      ?? snapshot.lastTrade?.price
      ?? null,
    priceChangePct,
  };
}

function cloneTape(
  tape:
    LevelV2ShadowTapeEvidence
    | null,
): LevelV2ShadowTapeEvidence | null {
  return tape
    ? {
        ...tape,
      }
    : null;
}

function cloneOrderBook(
  orderBook:
    LevelV2ShadowOrderBookEvidence
    | null,
): LevelV2ShadowOrderBookEvidence | null {
  return orderBook
    ? {
        ...orderBook,
      }
    : null;
}

export function cloneLevelV2ShadowMarketEvidence(
  evidence:
    LevelV2ShadowMarketEvidence,
): LevelV2ShadowMarketEvidence {
  return {
    ...evidence,
    tape:
      cloneTape(
        evidence.tape,
      ),
    orderBook:
      cloneOrderBook(
        evidence.orderBook,
      ),
    sourceErrors: [
      ...evidence.sourceErrors,
    ],
  };
}

function resolveAvailability(
  capture:
    LevelV2ShadowMarketEvidenceCapture,
): LevelV2ShadowMarketEvidenceAvailability {
  if (
    capture.tape
    && capture.orderBook
  ) {
    return 'complete';
  }

  if (capture.tape) {
    return 'tape_only';
  }

  if (capture.orderBook) {
    return 'order_book_only';
  }

  return 'unavailable';
}

function unavailableCapture(
  symbol: string,
  capturedAt: string,
  error: unknown,
): LevelV2ShadowMarketEvidenceCapture {
  return {
    symbol,
    capturedAt,
    tape:
      null,
    orderBook:
      null,
    sourceErrors: [
      error instanceof Error
        ? error.message
        : String(error),
    ],
  };
}

export class LevelV2ShadowMarketEvidenceAdapter
implements LevelV2ShadowMarketEvidenceSource {
  constructor(
    private readonly options:
      LevelV2ShadowMarketEvidenceAdapterOptions,
  ) {}

  capture(
    symbol: string,
    capturedAt: string,
  ): LevelV2ShadowMarketEvidenceCapture {
    const sourceErrors:
      string[] = [];

    let tape:
      LevelV2ShadowTapeEvidence
      | null = null;

    let orderBook:
      LevelV2ShadowOrderBookEvidence
      | null = null;

    try {
      const snapshot =
        this.options
          .tapeReader
          ?.getSnapshots(
            symbol,
          )[0]
        ?? null;

      tape =
        snapshot
          ? aggregateTrades(
              snapshot,
            )
          : null;
    } catch (error) {
      sourceErrors.push(
        `tape: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }

    try {
      const snapshot =
        this.options
          .orderBookReader
          ?.getSnapshot(
            symbol,
          )
        ?? null;

      if (snapshot) {
        orderBook = {
          state:
            snapshot.state,
          synchronized:
            snapshot.synchronized,
          updatedAt:
            snapshot.updatedAt,
          ageMs:
            snapshot.ageMs,
          staleAfterMs:
            snapshot.staleAfterMs,
          bestBid:
            snapshot.metrics.bestBid,
          bestAsk:
            snapshot.metrics.bestAsk,
          spreadPct:
            snapshot.metrics.spreadPct,
          bidDepthQuote:
            snapshot.metrics
              .bidDepthQuote,
          askDepthQuote:
            snapshot.metrics
              .askDepthQuote,
          totalDepthQuote:
            snapshot.metrics
              .totalDepthQuote,
          imbalancePct:
            snapshot.metrics
              .imbalancePct,
        };
      }
    } catch (error) {
      sourceErrors.push(
        `order_book: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }

    return {
      symbol,
      capturedAt,
      tape,
      orderBook,
      sourceErrors,
    };
  }
}

export function buildLevelV2ShadowMarketEvidence(
  states:
    readonly LevelV2BreakClassificationState[],
  source:
    LevelV2ShadowMarketEvidenceSource
    | null,
  capturedAt: string,
): LevelV2ShadowMarketEvidence[] {
  if (
    states.length === 0
    || source === null
  ) {
    return [];
  }

  const symbol =
    states[0]?.level.symbol;

  if (!symbol) {
    return [];
  }

  let capture:
    LevelV2ShadowMarketEvidenceCapture;

  try {
    capture =
      source.capture(
        symbol,
        capturedAt,
      );
  } catch (error) {
    capture =
      unavailableCapture(
        symbol,
        capturedAt,
        error,
      );
  }

  const sourceErrors = [
    ...capture.sourceErrors,
  ];

  if (capture.symbol !== symbol) {
    sourceErrors.push(
      `symbol mismatch: expected ${symbol}, received ${capture.symbol}`,
    );
  }

  const normalizedCapture:
    LevelV2ShadowMarketEvidenceCapture = {
      symbol,
      capturedAt,
      tape:
        capture.symbol === symbol
          ? cloneTape(
              capture.tape,
            )
          : null,
      orderBook:
        capture.symbol === symbol
          ? cloneOrderBook(
              capture.orderBook,
            )
          : null,
      sourceErrors,
    };

  const availability =
    resolveAvailability(
      normalizedCapture,
    );

  return states.map(
    (state) => ({
      id:
        `${state.id}:market:${capturedAt}`,
      classifierId:
        state.id,
      levelId:
        state.level.id,
      symbol:
        state.level.symbol,
      timeframe:
        state.level.timeframe,
      currentKind:
        state.currentKind,
      classificationStatus:
        state.status,
      capturedAt,
      availability,
      tape:
        cloneTape(
          normalizedCapture.tape,
        ),
      orderBook:
        cloneOrderBook(
          normalizedCapture.orderBook,
        ),
      sourceErrors: [
        ...normalizedCapture
          .sourceErrors,
      ],
    }),
  );
}
