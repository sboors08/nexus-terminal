import type {
  Candle,
} from '../../api/contracts.js';
import type {
  LevelLine,
  LevelLineApproachEvaluation,
  LevelLinesSnapshot,
  ObservationPathProgress,
} from '../../api/runtime/levelLinesApi.js';
const LEVEL_COLORS = {
  support: '#32d583',
  resistance: '#ff6273',
} as const;

const VISIBLE_CANDLES = 160;

export type CausalLevelStage =
  | 'OBSERVATION'
  | 'APPROACH'
  | null;

export interface CausalLevelState {
  readonly line: LevelLine;
  readonly stage: CausalLevelStage;
  readonly observationProgress: number | null;
  readonly distanceToLevelPercent: number | null;
}

export interface CausalLevelHorizontalSegment {
  readonly price: number;
  readonly startTime: string;
  readonly color: string;
  readonly title?: string;
  readonly lineStyle?: 'solid' | 'dashed';
  readonly axisLabelVisible?: boolean;
}

export interface CausalLevelLinesView {
  readonly horizontalSegments:
    readonly CausalLevelHorizontalSegment[];
  readonly states: readonly CausalLevelState[];
  readonly primaryStates: readonly CausalLevelState[];
}

function clampProgress(
  value: number,
): number {
  return Math.max(
    0,
    Math.min(1, value),
  );
}

function distanceToLevel(
  price: number,
  levelPrice: number,
): number {
  return Math.abs(
    price - levelPrice,
  ) / levelPrice * 100;
}

function currentClosedPrice(
  snapshot: LevelLinesSnapshot,
): number | null {
  return snapshot.approachEvaluation.currentPrice
    ?? snapshot.observationTracking.currentPrice
    ?? snapshot.candles
      .filter(
        (candle) => candle.isClosed,
      )
      .at(-1)
      ?.close
    ?? null;
}

function visiblePriceRange(
  candles: readonly Candle[],
): {
  readonly minimum: number;
  readonly maximum: number;
} | null {
  const visible =
    candles
      .filter(
        (candle) => candle.isClosed !== false,
      )
      .slice(-VISIBLE_CANDLES);

  if (visible.length === 0) {
    return null;
  }

  const minimum =
    Math.min(
      ...visible.map(
        (candle) => candle.low,
      ),
    );
  const maximum =
    Math.max(
      ...visible.map(
        (candle) => candle.high,
      ),
    );
  const range =
    Math.max(
      maximum - minimum,
      maximum * 0.001,
    );

  return {
    minimum:
      minimum - range * 0.18,
    maximum:
      maximum + range * 0.18,
  };
}

function indexByLineId<T extends {
  readonly lineId: string;
}>(
  values: readonly T[],
): ReadonlyMap<string, T> {
  return new Map(
    values.map(
      (value) => [
        value.lineId,
        value,
      ],
    ),
  );
}

function buildState(
  line: LevelLine,
  price: number | null,
  observations:
    ReadonlyMap<string, ObservationPathProgress>,
  approaches:
    ReadonlyMap<string, LevelLineApproachEvaluation>,
): CausalLevelState {
  const observation =
    observations.get(line.id);
  const approach =
    approaches.get(line.id);

  return {
    line,
    stage:
      approach?.stage === 'APPROACH'
        ? 'APPROACH'
        : observation?.stage === 'OBSERVATION'
          ? 'OBSERVATION'
          : null,
    observationProgress:
      approach
        ? clampProgress(
            approach.observationProgress,
          )
        : observation
          ? clampProgress(
              observation.progress,
            )
          : null,
    distanceToLevelPercent:
      approach?.distanceToLevelPercent
      ?? (
        price === null
          ? null
          : distanceToLevel(
              price,
              line.price,
            )
      ),
  };
}

function selectPrimaryStates(
  states: readonly CausalLevelState[],
): readonly CausalLevelState[] {
  const nearestSupport =
    states.find(
      (state) =>
        state.line.kind === 'support',
    );
  const nearestResistance =
    states.find(
      (state) =>
        state.line.kind === 'resistance',
    );

  return [
    nearestSupport,
    nearestResistance,
  ].filter(
    (
      state,
    ): state is CausalLevelState =>
      state !== undefined,
  );
}

export function buildCausalLevelLinesView(
  snapshot: LevelLinesSnapshot | null,
  candles: readonly Candle[],
): CausalLevelLinesView {
  if (!snapshot) {
    return {
      horizontalSegments: [],
      states: [],
      primaryStates: [],
    };
  }

  const price =
    currentClosedPrice(snapshot);
  const observations =
    indexByLineId(
      snapshot.observationTracking.activeProgress,
    );
  const approaches =
    indexByLineId(
      snapshot.approachEvaluation.evaluations,
    );
  const states =
    snapshot.activeLevels
      .map(
        (line) =>
          buildState(
            line,
            price,
            observations,
            approaches,
          ),
      )
      .sort(
        (left, right) =>
          (left.distanceToLevelPercent
            ?? Number.POSITIVE_INFINITY)
          - (right.distanceToLevelPercent
            ?? Number.POSITIVE_INFINITY),
      );
  const primaryStates =
    selectPrimaryStates(states);
  const primaryLineIds =
    new Set(
      primaryStates.map(
        (state) => state.line.id,
      ),
    );
  const range =
    visiblePriceRange(candles);
  const visibleStates =
    range
      ? states.filter(
          (state) =>
            state.line.price >= range.minimum
            && state.line.price <= range.maximum,
        )
      : states;

  return {
    states,
    primaryStates,
    horizontalSegments:
      visibleStates.map(
        (state) => ({
          price:
            state.line.price,
          startTime:
            state.line.activeFrom,
          color:
            LEVEL_COLORS[
              state.line.kind
            ],
          title:
            state.stage
            ?? (
              state.line.kind === 'support'
                ? 'ПОДДЕРЖКА'
                : 'СОПРОТИВЛЕНИЕ'
            ),
          lineStyle:
            state.line.status === 'candidate'
              ? 'dashed'
              : 'solid',
          axisLabelVisible:
            primaryLineIds.has(
              state.line.id,
            ),
        }),
      ),
  };
}
