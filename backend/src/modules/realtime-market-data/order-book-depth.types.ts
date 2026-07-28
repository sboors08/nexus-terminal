export type OrderBookDepthSide =
  | 'bid'
  | 'ask';

export interface OrderBookDepthLevelInput {
  price: number;
  quantity: number;
}

export interface OrderBookDepthSnapshot {
  symbol: string;
  lastUpdateId: number;
  bids:
    readonly OrderBookDepthLevelInput[];
  asks:
    readonly OrderBookDepthLevelInput[];
  receivedAt: string;
}

export interface OrderBookDepthDelta {
  symbol: string;
  firstUpdateId: number;
  finalUpdateId: number;
  previousFinalUpdateId:
    number
    | null;
  bids:
    readonly OrderBookDepthLevelInput[];
  asks:
    readonly OrderBookDepthLevelInput[];
  eventTime: string;
  receivedAt: string;
}

export type OrderBookDepthApplyStatus =
  | 'buffered'
  | 'snapshot-applied'
  | 'applied'
  | 'ignored'
  | 'gap';

export interface OrderBookDepthApplyResult {
  status:
    OrderBookDepthApplyStatus;
  reason:
    string
    | null;
  lastUpdateId:
    number
    | null;
  synchronized: boolean;
}

export interface OrderBookDepthLevel {
  price: number;
  quantity: number;
  quoteValue: number;
}

export interface OrderBookDepthView {
  symbol: string;
  synchronized: boolean;
  lastUpdateId:
    number
    | null;
  bids:
    OrderBookDepthLevel[];
  asks:
    OrderBookDepthLevel[];
  updatedAt:
    string
    | null;
}

export interface OrderBookDepthBucket {
  side:
    OrderBookDepthSide;
  price: number;
  quantity: number;
  quoteValue: number;
  levelsCount: number;
}

export interface OrderBookDepthMetrics {
  symbol: string;
  synchronized: boolean;
  bestBid:
    number
    | null;
  bestAsk:
    number
    | null;
  midpoint:
    number
    | null;
  spread:
    number
    | null;
  spreadPct:
    number
    | null;
  depthRangePct: number;
  bidDepthQuote: number;
  askDepthQuote: number;
  totalDepthQuote: number;
  imbalancePct:
    number
    | null;
  updatedAt:
    string
    | null;
}
