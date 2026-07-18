import type { Candle, MarketSymbol } from '../../contracts/nexus-api.js';

export interface MarketDataProvider {
  getMarketSymbols(): Promise<MarketSymbol[]>;
  getCandles(symbol: string, timeframe: string): Promise<Candle[]>;
}

export class MarketDataUnavailableError extends Error {
  override readonly name = 'MarketDataUnavailableError';
}

export class MarketSymbolNotFoundError extends Error {
  override readonly name = 'MarketSymbolNotFoundError';
  constructor(readonly symbol: string) {
    super(`Symbol ${symbol} was not found`);
  }
}
