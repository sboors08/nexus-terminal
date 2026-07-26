import type {
  BinanceOneMinuteKlineUpdate,
} from '../realtime-market-data/market-wide-one-minute-metrics.js';
import type {
  RealtimeBookTicker,
} from '../realtime-market-data/realtime-market-data.types.js';
import type {
  SetupCandidateFactoryOptions,
} from './setup-candidate-factory.js';
import type {
  DetectedSetupLevel,
  SetupLevelDetectorOptions,
} from './setup-level-detector.types.js';
import type {
  SetupEngineSetupType,
  SetupEngineState,
} from './setup-engine.types.js';

export interface SetupDetectionMarketStore {
  getKlines(
    symbol: string,
    limit?: number,
  ): BinanceOneMinuteKlineUpdate[];

  getState(
    symbol: string,
  ): {
    kline:
      BinanceOneMinuteKlineUpdate
      | null;
    bookTicker:
      RealtimeBookTicker
      | null;
  } | null;
}

export interface SetupDetectionPipelineOptions {
  maxCandles: number;
  detectorOptions:
    SetupLevelDetectorOptions;
  candidateOptions:
    SetupCandidateFactoryOptions;
  setupTypes:
    readonly SetupEngineSetupType[];
}

export interface SetupDetectionPipelineResult {
  symbol: string;
  timeframe: '1m';
  scannedCandlesCount: number;
  currentPrice: number | null;
  levels: DetectedSetupLevel[];
  candidates: SetupEngineState[];
  duplicateCandidateIds: string[];
}
