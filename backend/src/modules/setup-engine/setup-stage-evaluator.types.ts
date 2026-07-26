export interface SetupStageEvaluatorOptions {
  approachDistancePct: number;
  breakoutConfirmationPct: number;
  rejectionConfirmationPct: number;
  maxObservationAgeSec: number;
}

export interface SetupStageMarketObservation {
  symbol: string;
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  currentPrice: number;
  isClosed: boolean;
  observedAt: string;
  evaluatedAt: string;
}
