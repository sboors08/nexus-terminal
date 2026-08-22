import type {
  LevelEngineTimeframe,
} from '../level-engine/level-engine.types.js';
import type {
  LevelLine,
  LevelLinesDetectionOptions,
} from '../level-engine/level-lines.types.js';
import type {
  RealtimeConfirmationEvidenceReaderOptions,
} from '../level-engine/realtime-confirmation-evidence.js';
import type {
  BinanceOneMinuteKlineUpdate,
} from '../realtime-market-data/market-wide-one-minute-metrics.js';
import type {
  RealtimeBookTicker,
} from '../realtime-market-data/realtime-market-data.types.js';
import type {
  SetupCausalUpdate,
} from './causal-setup-adapter.types.js';
import type {
  SetupCandidateFactoryOptions,
} from './setup-candidate-factory.js';
import type {
  SetupEngineSetupType,
  SetupEngineState,
} from './setup-engine.types.js';

export interface SetupDetectionMarketStore {
  getKlines(
    symbol: string,
    limit?: number,
  ): BinanceOneMinuteKlineUpdate[];

  getSetupCandles?(
    symbol: string,
    timeframe: LevelEngineTimeframe,
    limit?: number,
  ): SetupDetectionCandle[];

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

export interface SetupDetectionCandle {
  symbol: string;
  eventTime: string;
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  isClosed: boolean;
}

export interface SetupDetectionPipelineOptions {
  maxCandles: number;
  levelLinesOptions:
    LevelLinesDetectionOptions;
  candidateOptions:
    SetupCandidateFactoryOptions;
  setupTypes:
    readonly SetupEngineSetupType[];
}

export interface SetupDetectionPipelineDependencies {
  readonly realtimeEvidenceReaders?:
    RealtimeConfirmationEvidenceReaderOptions;
  readonly now?: () => Date;
  readonly timeframe?:
    LevelEngineTimeframe;
}

export interface SetupDetectionPipelineResult {
  symbol: string;
  timeframe: LevelEngineTimeframe;
  scannedCandlesCount: number;
  currentPrice: number | null;
  levels: LevelLine[];
  candidates: SetupEngineState[];
  causalUpdates: SetupCausalUpdate[];
  duplicateCandidateIds: string[];
  source: 'level_lines';
  sourceCreatesSetup: false;
  createsSignal: false;
  evaluatesBreakout: false;
  evaluatesBounce: false;
}
