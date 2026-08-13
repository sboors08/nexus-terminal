import type {
  BtcMarketModeCurrentSnapshot,
} from '../alerts/btc-market-mode-producer.js';
import type {
  MarketImpulseCurrentSnapshot,
} from '../alerts/market-impulse-producer.js';
import type {
  UnifiedDecisionMarketContext,
  UnifiedDecisionMarketContextReader,
} from './unified-decision.types.js';

export interface UnifiedDecisionBtcContextSource {
  getCurrentSnapshot():
    BtcMarketModeCurrentSnapshot;
}

export interface UnifiedDecisionImpulseContextSource {
  getCurrentSnapshot(
    symbol: string,
  ): MarketImpulseCurrentSnapshot;
}

export interface ProducerUnifiedDecisionMarketContextOptions {
  readonly btc:
    UnifiedDecisionBtcContextSource | null;
  readonly impulse:
    UnifiedDecisionImpulseContextSource | null;
}

export class ProducerUnifiedDecisionMarketContextReader
implements UnifiedDecisionMarketContextReader {
  constructor(
    private readonly sources:
      ProducerUnifiedDecisionMarketContextOptions,
  ) {}

  getMarketContext(
    symbol: string,
  ): UnifiedDecisionMarketContext {
    const btc =
      this.sources.btc
        ?.getCurrentSnapshot();
    const impulse =
      this.sources.impulse
        ?.getCurrentSnapshot(
          symbol,
        );

    return Object.freeze({
      btc: Object.freeze({
        availability:
          btc?.availability
          ?? 'unavailable',
        mode:
          btc?.mode
          ?? null,
        observedAt:
          btc?.observedAt
          ?? null,
      }),
      impulse: Object.freeze({
        availability:
          impulse?.availability
          ?? 'unavailable',
        direction:
          impulse?.direction
          ?? null,
        observedAt:
          impulse?.observedAt
          ?? null,
      }),
    });
  }
}
