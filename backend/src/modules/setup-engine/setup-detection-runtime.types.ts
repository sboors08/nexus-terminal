import type {
  SetupDetectionPipelineOptions,
  SetupDetectionMarketStore,
} from './setup-detection-pipeline.types.js';
import type {
  SetupEngineState,
} from './setup-engine.types.js';
import type {
  SetupStageEvaluatorOptions,
} from './setup-stage-evaluator.types.js';

export type SetupDetectionRuntimeState =
  | 'idle'
  | 'running'
  | 'stopped';

export type SetupDetectionTriggerSource =
  | 'initial'
  | 'live'
  | 'history';

export interface SetupDetectionKlineChange {
  source:
    Exclude<
      SetupDetectionTriggerSource,
      'initial'
    >;
  symbols: string[];
}

export interface SetupDetectionRuntimeSource
  extends SetupDetectionMarketStore {
  getSymbols(): string[];

  subscribeKlineChanges(
    listener:
      (
        event:
          SetupDetectionKlineChange,
      ) => void,
  ): () => void;
}

export interface SetupDetectionRuntimeOptions {
  maxCandidates: number;

  pipelineOptions:
    SetupDetectionPipelineOptions;

  stageEvaluatorOptions?:
    SetupStageEvaluatorOptions;

  now: () => Date;
}

export interface SetupDetectionRuntimeStatus {
  state:
    SetupDetectionRuntimeState;

  candidatesCount: number;

  scansCount: number;
  failedScans: number;

  evaluationsCount: number;
  failedEvaluations: number;
  stageTransitionsCount: number;

  lastScanAt: string | null;
  lastEvaluationAt: string | null;
  lastTransitionAt: string | null;

  lastTriggerSource:
    SetupDetectionTriggerSource
    | null;

  lastError: string | null;
}

export interface SetupDetectionRuntimeLifecycle {
  start(): void;
  stop(): void;
}

export interface SetupDetectionRuntimeReader {
  getStatus():
    SetupDetectionRuntimeStatus;

  getCandidates(
    symbol?: string,
  ): SetupEngineState[];

  getCandidate(
    candidateId: string,
  ): SetupEngineState | null;
}
