import type {
  OrderBookDepthRuntimeService,
} from '../realtime-market-data/order-book-depth-runtime.types.js';
import type {
  RealtimeMarketDataService,
} from '../realtime-market-data/realtime-market-data.types.js';
import type {
  RealtimeConfirmationEvidenceCapture,
  RealtimeConfirmationOrderBookCapture,
  RealtimeConfirmationTapeCapture,
} from './realtime-confirmation-engine.types.js';

export interface RealtimeConfirmationEvidenceReaderOptions {
  readonly tapeReader?:
    Pick<
      RealtimeMarketDataService,
      'getSnapshots'
    >
    | null;
  readonly orderBookReader?:
    Pick<
      OrderBookDepthRuntimeService,
      'getSnapshot'
    >
    | null;
}

function cloneTapeCapture(
  value:
    RealtimeConfirmationTapeCapture,
): RealtimeConfirmationTapeCapture {
  return Object.freeze({
    snapshotUpdatedAt:
      value.snapshotUpdatedAt,
    trades:
      Object.freeze(
        value.trades.map(
          (trade) =>
            Object.freeze({
              ...trade,
            }),
        ),
      ),
  });
}

function cloneOrderBookCapture(
  value:
    RealtimeConfirmationOrderBookCapture,
): RealtimeConfirmationOrderBookCapture {
  return Object.freeze({
    ...value,
  });
}

export function captureRealtimeConfirmationEvidence(
  symbol: string,
  readers:
    RealtimeConfirmationEvidenceReaderOptions,
  now:
    () => Date =
      () => new Date(),
): RealtimeConfirmationEvidenceCapture {
  const normalizedSymbol =
    symbol.trim().toUpperCase();
  const sourceErrors:
    string[] = [];

  let tape:
    RealtimeConfirmationTapeCapture
    | null = null;

  let orderBook:
    RealtimeConfirmationOrderBookCapture
    | null = null;

  try {
    const snapshot =
      readers
        .tapeReader
        ?.getSnapshots(
          normalizedSymbol,
        )[0]
      ?? null;

    if (snapshot) {
      tape =
        cloneTapeCapture({
          snapshotUpdatedAt:
            snapshot.updatedAt,
          trades:
            snapshot.recentTrades,
        });
    }
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
      readers
        .orderBookReader
        ?.getSnapshot(
          normalizedSymbol,
        )
      ?? null;

    if (snapshot) {
      orderBook =
        cloneOrderBookCapture({
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
        });
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

  return Object.freeze({
    symbol:
      normalizedSymbol,
    capturedAt:
      now().toISOString(),
    tape,
    orderBook,
    sourceErrors:
      Object.freeze([
        ...sourceErrors,
      ]),
  });
}
