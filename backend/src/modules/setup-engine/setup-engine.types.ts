export type SetupDirection =
  | 'long'
  | 'short';

export type SetupEngineSetupType =
  | 'level_breakout'
  | 'level_bounce';

export type SetupEngineLevelKind =
  | 'support'
  | 'resistance';

export type SetupEngineStage =
  | 'LEVEL_CONFIRMED'
  | 'APPROACHING_THIRD_TOUCH'
  | 'THIRD_TOUCH_CONFIRMED'
  | 'BREAKOUT_CONFIRMED'
  | 'REJECTION_CONFIRMED'
  | 'SETUP_EXPIRED';

export type SetupEngineOutcome =
  | 'breakout'
  | 'rejection'
  | null;

export interface SetupLevelZone {
  kind: SetupEngineLevelKind;
  centerPrice: number;
  zoneLow: number;
  zoneHigh: number;
  touches: number;
  confirmedAt: string;
}

export interface SetupEngineState {
  id: string;
  symbol: string;
  timeframe: string;
  setupType: SetupEngineSetupType;
  direction: SetupDirection;
  stage: SetupEngineStage;
  outcome: SetupEngineOutcome;
  level: SetupLevelZone;
  currentPrice: number;
  distanceToLevelPct: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  causal?: import('./causal-setup-adapter.types.js')
    .SetupCausalContext;
}

export type SetupEngineEvent =
  | {
      type: 'APPROACH_DETECTED';
      price: number;
      occurredAt: string;
    }
  | {
      type: 'THIRD_TOUCH_DETECTED';
      price: number;
      occurredAt: string;
    }
  | {
      type: 'BREAKOUT_DETECTED';
      price: number;
      occurredAt: string;
    }
  | {
      type: 'REJECTION_DETECTED';
      price: number;
      occurredAt: string;
    }
  | {
      type: 'EXPIRED';
      occurredAt: string;
    };
