import {
  LEVEL_ENGINE_TIMEFRAMES,
  type LevelEngineTimeframe,
} from '../level-engine/level-engine.types.js';

export const SETUP_ENGINE_MULTI_TIMEFRAME_RUNTIME_VERSION =
  'setup-engine-multi-timeframe-runtime-v0.1' as const;

export const SETUP_ENGINE_RUNTIME_TIMEFRAMES:
  readonly LevelEngineTimeframe[] =
    Object.freeze([
      ...LEVEL_ENGINE_TIMEFRAMES,
    ]);

export const SETUP_ENGINE_MULTI_TIMEFRAME_RUNTIME_SAFETY =
  Object.freeze({
    independentTimeframeIdentity:
      true,
    reusesOneMinuteSource:
      true,
    usesClosedCandlesOnly:
      true,
    changesDetectionThresholds:
      false,
    createsTradeOrders:
      false,
  } as const);
