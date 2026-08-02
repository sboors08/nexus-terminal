import type {
  LevelV2BreakClassificationStatus,
} from './level-v2-break-classification.types.js';
import type {
  LevelV2Kind,
} from './level-v2-zones-score.types.js';

export type LevelV2ShadowMarketEvidenceAvailability =
  | 'complete'
  | 'tape_only'
  | 'order_book_only'
  | 'unavailable';

export type LevelV2ShadowTapeDominantSide =
  | 'buy'
  | 'sell'
  | 'balanced';

export interface LevelV2ShadowTapeEvidence {
  snapshotUpdatedAt: string | null;
  lastTradeAt: string | null;
  tradesCount: number;
  executionsCount: number;
  buyQuoteValue: number;
  sellQuoteValue: number;
  totalQuoteValue: number;
  quoteDelta: number;
  buySharePct: number | null;
  dominantSide:
    LevelV2ShadowTapeDominantSide
    | null;
  largestTradeQuoteValue: number;
  firstTradePrice: number | null;
  lastTradePrice: number | null;
  priceChangePct: number | null;
}

export interface LevelV2ShadowOrderBookEvidence {
  state:
    | 'collecting'
    | 'live'
    | 'stale'
    | 'error';
  synchronized: boolean;
  updatedAt: string | null;
  ageMs: number | null;
  staleAfterMs: number;
  bestBid: number | null;
  bestAsk: number | null;
  spreadPct: number | null;
  bidDepthQuote: number;
  askDepthQuote: number;
  totalDepthQuote: number;
  imbalancePct: number | null;
}

export interface LevelV2ShadowMarketEvidenceCapture {
  symbol: string;
  capturedAt: string;
  tape:
    LevelV2ShadowTapeEvidence
    | null;
  orderBook:
    LevelV2ShadowOrderBookEvidence
    | null;
  sourceErrors: readonly string[];
}

export interface LevelV2ShadowMarketEvidence {
  id: string;
  classifierId: string;
  levelId: string;
  symbol: string;
  timeframe: string;
  currentKind: LevelV2Kind;
  classificationStatus:
    LevelV2BreakClassificationStatus;
  capturedAt: string;
  availability:
    LevelV2ShadowMarketEvidenceAvailability;
  tape:
    LevelV2ShadowTapeEvidence
    | null;
  orderBook:
    LevelV2ShadowOrderBookEvidence
    | null;
  sourceErrors: readonly string[];
}

export interface LevelV2ShadowMarketEvidenceSource {
  capture(
    symbol: string,
    capturedAt: string,
  ): LevelV2ShadowMarketEvidenceCapture;
}
