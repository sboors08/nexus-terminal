import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

import type {
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from 'lightweight-charts';

import type {
  Candle,
} from '../../api/contracts.js';

import {
  createNexusDrawingId,
  loadNexusDrawings,
  moveNexusDrawing,
  saveNexusDrawings,
  toggleNexusDrawingLock,
  toggleNexusDrawingVisibility,
  updateNexusDrawingPoint,
  type NexusChartPoint,
  type NexusDrawing,
  type NexusDrawingTool,
} from '../model/drawingModel.js';

import styles from './NexusChartDrawingOverlay.module.css';

type EditorTool =
  | 'pan'
  | NexusDrawingTool;

type TwoPointTool =
  | 'trend'
  | 'ray'
  | 'infiniteLine'
  | 'rectangle'
  | 'ellipse'
  | 'fibRetracement'
  | 'measure'
  | 'longPosition'
  | 'shortPosition'
  | 'arrow';

type ThreePointTool =
  | 'parallelChannel'
  | 'fibExtension';

interface TwoPointDraft {
  type: TwoPointTool;
  start: NexusChartPoint;
  current: NexusChartPoint;
}

interface ThreePointDraft {
  type: ThreePointTool;
  points: readonly NexusChartPoint[];
  preview: NexusChartPoint | null;
}

interface CursorDrag {
  drawingId: string;
  mode: 'move' | 'point';
  pointIndex: number;
  start: NexusChartPoint;
  originalDrawing: NexusDrawing;
  originalDrawings: readonly NexusDrawing[];
  changed: boolean;
}

interface ScreenPoint {
  x: number;
  y: number;
}

interface ScreenHandle extends ScreenPoint {
  pointIndex: number;
}

interface NexusChartDrawingOverlayProps {
  chartRef: RefObject<IChartApi | null>;
  seriesRef: RefObject<
    ISeriesApi<'Candlestick'> | null
  >;
  readyVersion: number;
  candles: readonly Candle[];
  scope: string;
}

const TOOLS: readonly {
  id: EditorTool;
  label: string;
  symbol: string;
}[] = [
  {
    id: 'pan',
    label: 'Навигация по графику',
    symbol: '✋',
  },
  {
    id: 'cursor',
    label: 'Выбор и редактирование',
    symbol: '↖',
  },
  {
    id: 'trend',
    label: 'Трендовая линия',
    symbol: '╱',
  },
  {
    id: 'ray',
    label: 'Луч',
    symbol: '↗',
  },
  {
    id: 'infiniteLine',
    label: 'Бесконечная линия',
    symbol: '↔',
  },
  {
    id: 'horizontal',
    label: 'Горизонтальная линия',
    symbol: '—',
  },
  {
    id: 'horizontalRay',
    label: 'Горизонтальный луч',
    symbol: '—›',
  },
  {
    id: 'vertical',
    label: 'Вертикальная линия',
    symbol: '│',
  },
  {
    id: 'parallelChannel',
    label: 'Параллельный канал',
    symbol: '∥',
  },
  {
    id: 'rectangle',
    label: 'Прямоугольник',
    symbol: '▭',
  },
  {
    id: 'ellipse',
    label: 'Эллипс',
    symbol: '◯',
  },
  {
    id: 'fibRetracement',
    label: 'Коррекция Fibonacci',
    symbol: 'Fib',
  },
  {
    id: 'fibExtension',
    label: 'Расширение Fibonacci',
    symbol: 'Ext',
  },
  {
    id: 'measure',
    label: 'Измерение цены и времени',
    symbol: 'Δ',
  },
  {
    id: 'longPosition',
    label: 'Позиция LONG',
    symbol: 'L',
  },
  {
    id: 'shortPosition',
    label: 'Позиция SHORT',
    symbol: 'S',
  },
  {
    id: 'text',
    label: 'Текстовая заметка',
    symbol: 'T',
  },
  {
    id: 'arrow',
    label: 'Стрелка',
    symbol: '➜',
  },
  {
    id: 'marker',
    label: 'Метка',
    symbol: '●',
  },
];

const TWO_POINT_TOOLS =
  new Set<EditorTool>([
    'trend',
    'ray',
    'infiniteLine',
    'rectangle',
    'ellipse',
    'fibRetracement',
    'measure',
    'longPosition',
    'shortPosition',
    'arrow',
  ]);

const THREE_POINT_TOOLS =
  new Set<EditorTool>([
    'parallelChannel',
    'fibExtension',
  ]);

const FIB_RETRACEMENT_LEVELS = [
  0,
  0.236,
  0.382,
  0.5,
  0.618,
  0.786,
  1,
] as const;

const FIB_EXTENSION_LEVELS = [
  0,
  0.618,
  1,
  1.272,
  1.618,
  2,
] as const;

const HANDLE_RADIUS = 7;
const HIT_DISTANCE = 8;

function formatPrice(
  value: number,
): string {
  return value.toLocaleString(
    'ru-RU',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    },
  );
}

function formatDuration(
  seconds: number,
): string {
  const absolute =
    Math.abs(seconds);

  if (absolute < 3600) {
    return `${Math.round(
      absolute / 60,
    )} мин`;
  }

  if (absolute < 86400) {
    return `${(
      absolute / 3600
    ).toFixed(1)} ч`;
  }

  return `${(
    absolute / 86400
  ).toFixed(1)} д`;
}

function distance(
  first: ScreenPoint,
  second: ScreenPoint,
): number {
  return Math.hypot(
    first.x - second.x,
    first.y - second.y,
  );
}

function distanceToSegment(
  point: ScreenPoint,
  start: ScreenPoint,
  end: ScreenPoint,
): number {
  const dx =
    end.x - start.x;

  const dy =
    end.y - start.y;

  if (dx === 0 && dy === 0) {
    return distance(
      point,
      start,
    );
  }

  const ratio =
    Math.max(
      0,
      Math.min(
        1,
        (
          (
            point.x - start.x
          )
          * dx
          + (
            point.y - start.y
          )
          * dy
        )
        / (
          dx * dx
          + dy * dy
        ),
      ),
    );

  return distance(
    point,
    {
      x:
        start.x
        + ratio * dx,
      y:
        start.y
        + ratio * dy,
    },
  );
}

function parseCandleTime(
  candle: Candle,
): number | null {
  const milliseconds =
    Date.parse(candle.openTime);

  if (
    !Number.isFinite(milliseconds)
  ) {
    return null;
  }

  return Math.floor(
    milliseconds / 1000,
  );
}

function hasDrawingPoints(
  drawing: NexusDrawing,
): drawing is Extract<
  NexusDrawing,
  {
    points:
      readonly NexusChartPoint[];
  }
> {
  return 'points' in drawing;
}

function createBaseDrawing() {
  return {
    id:
      createNexusDrawingId(),
    locked:
      false,
    hidden:
      false,
  };
}

export function NexusChartDrawingOverlay({
  chartRef,
  seriesRef,
  readyVersion,
  candles,
  scope,
}: NexusChartDrawingOverlayProps) {
  const svgRef =
    useRef<SVGSVGElement | null>(
      null,
    );

  const skipPersistenceRef =
    useRef(true);

  const [
    activeTool,
    setActiveTool,
  ] = useState<EditorTool>(
    'pan',
  );

  const [
    drawings,
    setDrawings,
  ] = useState<
    readonly NexusDrawing[]
  >([]);

  const [
    past,
    setPast,
  ] = useState<
    readonly (
      readonly NexusDrawing[]
    )[]
  >([]);

  const [
    future,
    setFuture,
  ] = useState<
    readonly (
      readonly NexusDrawing[]
    )[]
  >([]);

  const [
    selectedId,
    setSelectedId,
  ] = useState<string | null>(
    null,
  );

  const [
    twoPointDraft,
    setTwoPointDraft,
  ] = useState<
    TwoPointDraft | null
  >(null);

  const [
    threePointDraft,
    setThreePointDraft,
  ] = useState<
    ThreePointDraft | null
  >(null);

  const [
    cursorDrag,
    setCursorDrag,
  ] = useState<
    CursorDrag | null
  >(null);

  const [
    magnetEnabled,
    setMagnetEnabled,
  ] = useState(true);

  const [
    revision,
    setRevision,
  ] = useState(0);

  const selectedDrawing =
    drawings.find(
      (drawing) =>
        drawing.id
        === selectedId,
    )
    ?? null;

  useEffect(() => {
    skipPersistenceRef.current =
      true;

    setDrawings(
      loadNexusDrawings(
        scope,
      ),
    );

    setPast([]);
    setFuture([]);
    setSelectedId(null);
    setTwoPointDraft(null);
    setThreePointDraft(null);
  }, [scope]);

  useEffect(() => {
    if (
      skipPersistenceRef.current
    ) {
      skipPersistenceRef.current =
        false;

      return;
    }

    saveNexusDrawings(
      scope,
      drawings,
    );
  }, [
    drawings,
    scope,
  ]);

  useEffect(() => {
    const chart =
      chartRef.current;

    const svg =
      svgRef.current;

    if (!chart || !svg) {
      return;
    }

    const refresh = () => {
      setRevision(
        (value) => value + 1,
      );
    };

    const timeScale =
      chart.timeScale();

    timeScale
      .subscribeVisibleTimeRangeChange(
        refresh,
      );

    timeScale
      .subscribeVisibleLogicalRangeChange(
        refresh,
      );

    const resizeObserver =
      new ResizeObserver(
        refresh,
      );

    const parent =
      svg.parentElement;

    if (parent) {
      resizeObserver.observe(parent);
    }

    return () => {
      timeScale
        .unsubscribeVisibleTimeRangeChange(
          refresh,
        );

      timeScale
        .unsubscribeVisibleLogicalRangeChange(
          refresh,
        );

      resizeObserver.disconnect();
    };
  }, [
    chartRef,
    readyVersion,
  ]);

  const commitDrawings = (
    next:
      readonly NexusDrawing[],
  ) => {
    setPast(
      (items) => [
        ...items,
        drawings,
      ],
    );

    setDrawings(next);
    setFuture([]);
  };

  const undo = () => {
    const previous =
      past.at(-1);

    if (!previous) {
      return;
    }

    setFuture(
      (items) => [
        drawings,
        ...items,
      ],
    );

    setDrawings(previous);
    setPast(
      (items) =>
        items.slice(
          0,
          -1,
        ),
    );

    setSelectedId(null);
  };

  const redo = () => {
    const next =
      future[0];

    if (!next) {
      return;
    }

    setPast(
      (items) => [
        ...items,
        drawings,
      ],
    );

    setDrawings(next);
    setFuture(
      (items) =>
        items.slice(1),
    );

    setSelectedId(null);
  };

  const toScreenPoint = (
    point: NexusChartPoint,
  ): ScreenPoint | null => {
    const chart =
      chartRef.current;

    const series =
      seriesRef.current;

    if (!chart || !series) {
      return null;
    }

    const x =
      chart
        .timeScale()
        .timeToCoordinate(
          point.time as UTCTimestamp,
        );

    const y =
      series.priceToCoordinate(
        point.price,
      );

    if (
      x === null
      || y === null
    ) {
      return null;
    }

    return {
      x,
      y,
    };
  };

  const snapChartPoint = (
    point: NexusChartPoint,
  ): NexusChartPoint => {
    if (
      !magnetEnabled
      || candles.length === 0
    ) {
      return point;
    }

    let nearest:
      {
        time: number;
        candle: Candle;
      }
      | null = null;

    for (const candle of candles) {
      const time =
        parseCandleTime(
          candle,
        );

      if (time === null) {
        continue;
      }

      if (
        nearest === null
        || Math.abs(
          time - point.time,
        )
        < Math.abs(
          nearest.time
          - point.time,
        )
      ) {
        nearest = {
          time,
          candle,
        };
      }
    }

    if (!nearest) {
      return point;
    }

    const prices = [
      nearest.candle.open,
      nearest.candle.high,
      nearest.candle.low,
      nearest.candle.close,
    ];

    const nearestPrice =
      prices.reduce(
        (
          best,
          price,
        ) =>
          Math.abs(
            price - point.price,
          )
          < Math.abs(
            best - point.price,
          )
            ? price
            : best,
        prices[0]
        ?? point.price,
      );

    return {
      time:
        nearest.time,
      price:
        nearestPrice,
    };
  };

  const getChartPoint = (
    event:
      ReactPointerEvent<SVGSVGElement>,
    useMagnet = true,
  ): NexusChartPoint | null => {
    const chart =
      chartRef.current;

    const series =
      seriesRef.current;

    if (!chart || !series) {
      return null;
    }

    const bounds =
      event.currentTarget
        .getBoundingClientRect();

    const x =
      event.clientX
      - bounds.left;

    const y =
      event.clientY
      - bounds.top;

    const rawTime =
      chart
        .timeScale()
        .coordinateToTime(x);

    const price =
      series.coordinateToPrice(y);

    if (
      typeof rawTime !== 'number'
      || price === null
      || !Number.isFinite(price)
    ) {
      return null;
    }

    const point = {
      time:
        Number(rawTime),
      price,
    };

    return useMagnet
      ? snapChartPoint(point)
      : point;
  };

  const getPointerScreenPoint = (
    event:
      ReactPointerEvent<SVGSVGElement>,
  ): ScreenPoint => {
    const bounds =
      event.currentTarget
        .getBoundingClientRect();

    return {
      x:
        event.clientX
        - bounds.left,
      y:
        event.clientY
        - bounds.top,
    };
  };

  const getDrawingHandles = (
    drawing: NexusDrawing,
  ): readonly ScreenHandle[] => {
    const svg =
      svgRef.current;

    if (!svg) {
      return [];
    }

    if (
      drawing.type
      === 'horizontal'
    ) {
      const y =
        seriesRef.current
          ?.priceToCoordinate(
            drawing.price,
          )
        ?? null;

      return y === null
        ? []
        : [{
            x: 56,
            y,
            pointIndex: 0,
          }];
    }

    if (
      drawing.type
      === 'vertical'
    ) {
      const x =
        chartRef.current
          ?.timeScale()
          .timeToCoordinate(
            drawing.time as UTCTimestamp,
          )
        ?? null;

      return x === null
        ? []
        : [{
            x,
            y: 64,
            pointIndex: 0,
          }];
    }

    if (
      drawing.type
      === 'horizontalRay'
      || drawing.type
      === 'text'
      || drawing.type
      === 'marker'
    ) {
      const point =
        toScreenPoint(
          drawing.point,
        );

      return point
        ? [{
            ...point,
            pointIndex: 0,
          }]
        : [];
    }

    if (
      drawing.type
      === 'longPosition'
      || drawing.type
      === 'shortPosition'
    ) {
      const entry =
        toScreenPoint(
          drawing.points[0],
        );

      const target =
        toScreenPoint(
          drawing.points[1],
        );

      const stop =
        toScreenPoint({
          time:
            drawing.points[1].time,
          price:
            drawing.stopPrice,
        });

      return [
        entry
          ? {
              ...entry,
              pointIndex: 0,
            }
          : null,
        target
          ? {
              ...target,
              pointIndex: 1,
            }
          : null,
        stop
          ? {
              ...stop,
              pointIndex: 2,
            }
          : null,
      ].filter(
        (
          value,
        ): value is ScreenHandle =>
          value !== null,
      );
    }

    if (
      !hasDrawingPoints(drawing)
    ) {
      return [];
    }

    return drawing.points
      .map(
        (point, pointIndex) => {
          const screenPoint =
            toScreenPoint(point);

          return screenPoint
            ? {
                ...screenPoint,
                pointIndex,
              }
            : null;
        },
      )
      .filter(
        (
          value,
        ): value is ScreenHandle =>
          value !== null,
      );
  };

  const getExtendedLine = (
    start: ScreenPoint,
    end: ScreenPoint,
    mode:
      | 'ray'
      | 'infiniteLine',
  ) => {
    const multiplier = 1000;

    const dx =
      end.x - start.x;

    const dy =
      end.y - start.y;

    if (
      mode === 'ray'
    ) {
      return {
        start,
        end: {
          x:
            start.x
            + dx * multiplier,
          y:
            start.y
            + dy * multiplier,
        },
      };
    }

    return {
      start: {
        x:
          start.x
          - dx * multiplier,
        y:
          start.y
          - dy * multiplier,
      },
      end: {
        x:
          start.x
          + dx * multiplier,
        y:
          start.y
          + dy * multiplier,
      },
    };
  };

  const isDrawingHit = (
    drawing: NexusDrawing,
    point: ScreenPoint,
  ): boolean => {
    if (drawing.hidden) {
      return false;
    }

    const svg =
      svgRef.current;

    if (!svg) {
      return false;
    }

    const width =
      svg.clientWidth;

    const height =
      svg.clientHeight;

    if (
      drawing.type
      === 'horizontal'
    ) {
      const y =
        seriesRef.current
          ?.priceToCoordinate(
            drawing.price,
          )
        ?? null;

      return (
        y !== null
        && Math.abs(
          point.y - y,
        )
        <= HIT_DISTANCE
      );
    }

    if (
      drawing.type
      === 'vertical'
    ) {
      const x =
        chartRef.current
          ?.timeScale()
          .timeToCoordinate(
            drawing.time as UTCTimestamp,
          )
        ?? null;

      return (
        x !== null
        && Math.abs(
          point.x - x,
        )
        <= HIT_DISTANCE
      );
    }

    if (
      drawing.type
      === 'horizontalRay'
    ) {
      const start =
        toScreenPoint(
          drawing.point,
        );

      return (
        start !== null
        && point.x >= start.x
        && Math.abs(
          point.y - start.y,
        )
        <= HIT_DISTANCE
      );
    }

    if (
      drawing.type
      === 'text'
      || drawing.type
      === 'marker'
    ) {
      const anchor =
        toScreenPoint(
          drawing.point,
        );

      return (
        anchor !== null
        && distance(
          point,
          anchor,
        )
        <= 22
      );
    }

    const handles =
      getDrawingHandles(
        drawing,
      );

    if (
      handles.some(
        (handle) =>
          distance(
            point,
            handle,
          )
          <= HANDLE_RADIUS + 2,
      )
    ) {
      return true;
    }

    if (
      drawing.type
      === 'parallelChannel'
    ) {
      const first =
        toScreenPoint(
          drawing.points[0],
        );

      const second =
        toScreenPoint(
          drawing.points[1],
        );

      const third =
        toScreenPoint(
          drawing.points[2],
        );

      if (
        !first
        || !second
        || !third
      ) {
        return false;
      }

      const parallelEnd = {
        x:
          third.x
          + second.x
          - first.x,
        y:
          third.y
          + second.y
          - first.y,
      };

      return (
        distanceToSegment(
          point,
          first,
          second,
        )
        <= HIT_DISTANCE
        || distanceToSegment(
          point,
          third,
          parallelEnd,
        )
        <= HIT_DISTANCE
      );
    }

    if (
      drawing.type
      === 'fibExtension'
    ) {
      const screens =
        drawing.points
          .map(toScreenPoint);

      if (
        screens.some(
          (value) =>
            value === null,
        )
      ) {
        return false;
      }

      const [
        first,
        second,
        third,
      ] =
        screens as [
          ScreenPoint,
          ScreenPoint,
          ScreenPoint,
        ];

      const left =
        Math.min(
          first.x,
          second.x,
          third.x,
        );

      const right =
        Math.max(
          first.x,
          second.x,
          third.x,
        );

      if (
        point.x < left - 8
        || point.x > right + 8
      ) {
        return false;
      }

      return FIB_EXTENSION_LEVELS
        .some((level) => {
          const price =
            drawing.points[2].price
            + (
              drawing.points[1].price
              - drawing.points[0].price
            )
            * level;

          const y =
            seriesRef.current
              ?.priceToCoordinate(
                price,
              )
            ?? null;

          return (
            y !== null
            && Math.abs(
              point.y - y,
            )
            <= HIT_DISTANCE
          );
        });
    }

    if (
      !hasDrawingPoints(drawing)
    ) {
      return false;
    }

    const start =
      toScreenPoint(
        drawing.points[0],
      );

    const end =
      toScreenPoint(
        drawing.points[1],
      );

    if (!start || !end) {
      return false;
    }

    if (
      drawing.type
      === 'rectangle'
    ) {
      return (
        point.x
        >= Math.min(
          start.x,
          end.x,
        )
        - HIT_DISTANCE
        && point.x
        <= Math.max(
          start.x,
          end.x,
        )
        + HIT_DISTANCE
        && point.y
        >= Math.min(
          start.y,
          end.y,
        )
        - HIT_DISTANCE
        && point.y
        <= Math.max(
          start.y,
          end.y,
        )
        + HIT_DISTANCE
      );
    }

    if (
      drawing.type
      === 'ellipse'
    ) {
      const centerX =
        (
          start.x + end.x
        ) / 2;

      const centerY =
        (
          start.y + end.y
        ) / 2;

      const radiusX =
        Math.max(
          Math.abs(
            end.x - start.x,
          ) / 2,
          1,
        );

      const radiusY =
        Math.max(
          Math.abs(
            end.y - start.y,
          ) / 2,
          1,
        );

      const normalized =
        (
          (
            point.x - centerX
          )
          / radiusX
        ) ** 2
        + (
          (
            point.y - centerY
          )
          / radiusY
        ) ** 2;

      return normalized <= 1.15;
    }

    if (
      drawing.type
      === 'fibRetracement'
    ) {
      const left =
        Math.min(
          start.x,
          end.x,
        );

      const right =
        Math.max(
          start.x,
          end.x,
        );

      if (
        point.x < left - 8
        || point.x > right + 8
      ) {
        return false;
      }

      return FIB_RETRACEMENT_LEVELS
        .some((level) => {
          const price =
            drawing.points[0].price
            + (
              drawing.points[1].price
              - drawing.points[0].price
            )
            * level;

          const y =
            seriesRef.current
              ?.priceToCoordinate(
                price,
              )
            ?? null;

          return (
            y !== null
            && Math.abs(
              point.y - y,
            )
            <= HIT_DISTANCE
          );
        });
    }

    if (
      drawing.type
      === 'longPosition'
      || drawing.type
      === 'shortPosition'
    ) {
      const stop =
        toScreenPoint({
          time:
            drawing.points[1].time,
          price:
            drawing.stopPrice,
        });

      if (!stop) {
        return false;
      }

      return (
        point.x
        >= Math.min(
          start.x,
          end.x,
        )
        - HIT_DISTANCE
        && point.x
        <= Math.max(
          start.x,
          end.x,
        )
        + HIT_DISTANCE
        && point.y
        >= Math.min(
          start.y,
          end.y,
          stop.y,
        )
        - HIT_DISTANCE
        && point.y
        <= Math.max(
          start.y,
          end.y,
          stop.y,
        )
        + HIT_DISTANCE
      );
    }

    if (
      drawing.type
      === 'ray'
      || drawing.type
      === 'infiniteLine'
    ) {
      const extended =
        getExtendedLine(
          start,
          end,
          drawing.type,
        );

      return distanceToSegment(
        point,
        extended.start,
        extended.end,
      ) <= HIT_DISTANCE;
    }

    void width;
    void height;

    return distanceToSegment(
      point,
      start,
      end,
    ) <= HIT_DISTANCE;
  };

  const findHitDrawing = (
    point: ScreenPoint,
  ): NexusDrawing | null => {
    for (
      let index =
        drawings.length - 1;
      index >= 0;
      index -= 1
    ) {
      const drawing =
        drawings[index];

      if (
        drawing
        && isDrawingHit(
          drawing,
          point,
        )
      ) {
        return drawing;
      }
    }

    return null;
  };

  const createTwoPointDrawing = (
    draft: TwoPointDraft,
  ): NexusDrawing => {
    const base =
      createBaseDrawing();

    if (
      draft.type
      === 'longPosition'
      || draft.type
      === 'shortPosition'
    ) {
      const distanceToTarget =
        Math.max(
          Math.abs(
            draft.current.price
            - draft.start.price,
          ),
          draft.start.price
          * 0.001,
        );

      const stopPrice =
        draft.type
        === 'longPosition'
          ? draft.start.price
            - distanceToTarget
            * 0.5
          : draft.start.price
            + distanceToTarget
            * 0.5;

      return {
        ...base,
        type:
          draft.type,
        points: [
          draft.start,
          draft.current,
        ],
        stopPrice,
      };
    }

    return {
      ...base,
      type:
        draft.type,
      points: [
        draft.start,
        draft.current,
      ],
    };
  };

  const handlePointerDown = (
    event:
      ReactPointerEvent<SVGSVGElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const chartPoint =
      getChartPoint(
        event,
        activeTool !== 'cursor',
      );

    if (!chartPoint) {
      return;
    }

    const screenPoint =
      getPointerScreenPoint(
        event,
      );

    if (
      activeTool === 'cursor'
    ) {
      const hit =
        findHitDrawing(
          screenPoint,
        );

      if (!hit) {
        setSelectedId(null);
        return;
      }

      setSelectedId(
        hit.id,
      );

      if (hit.locked) {
        return;
      }

      const handle =
        getDrawingHandles(hit)
          .find(
            (candidate) =>
              distance(
                candidate,
                screenPoint,
              )
              <= HANDLE_RADIUS + 2,
          );

      setCursorDrag({
        drawingId:
          hit.id,
        mode:
          handle
            ? 'point'
            : 'move',
        pointIndex:
          handle?.pointIndex
          ?? -1,
        start:
          chartPoint,
        originalDrawing:
          hit,
        originalDrawings:
          drawings,
        changed:
          false,
      });

      event.currentTarget
        .setPointerCapture(
          event.pointerId,
        );

      return;
    }

    if (
      activeTool
      === 'horizontal'
    ) {
      const drawing:
        NexusDrawing = {
          ...createBaseDrawing(),
          type:
            'horizontal',
          price:
            chartPoint.price,
        };

      commitDrawings([
        ...drawings,
        drawing,
      ]);

      setSelectedId(
        drawing.id,
      );

      return;
    }

    if (
      activeTool
      === 'vertical'
    ) {
      const drawing:
        NexusDrawing = {
          ...createBaseDrawing(),
          type:
            'vertical',
          time:
            chartPoint.time,
        };

      commitDrawings([
        ...drawings,
        drawing,
      ]);

      setSelectedId(
        drawing.id,
      );

      return;
    }

    if (
      activeTool
      === 'horizontalRay'
    ) {
      const drawing:
        NexusDrawing = {
          ...createBaseDrawing(),
          type:
            'horizontalRay',
          point:
            chartPoint,
        };

      commitDrawings([
        ...drawings,
        drawing,
      ]);

      setSelectedId(
        drawing.id,
      );

      return;
    }

    if (
      activeTool === 'text'
      || activeTool === 'marker'
    ) {
      const text =
        window.prompt(
          activeTool === 'text'
            ? 'Текст заметки'
            : 'Название метки',
          activeTool === 'text'
            ? 'Заметка'
            : 'Метка',
        );

      if (!text?.trim()) {
        return;
      }

      const drawing:
        NexusDrawing = {
          ...createBaseDrawing(),
          type:
            activeTool,
          point:
            chartPoint,
          text:
            text.trim(),
        };

      commitDrawings([
        ...drawings,
        drawing,
      ]);

      setSelectedId(
        drawing.id,
      );

      return;
    }

    if (
      THREE_POINT_TOOLS
        .has(activeTool)
    ) {
      const type =
        activeTool as ThreePointTool;

      if (
        !threePointDraft
        || threePointDraft.type
        !== type
      ) {
        setThreePointDraft({
          type,
          points: [
            chartPoint,
          ],
          preview:
            chartPoint,
        });

        return;
      }

      const points = [
        ...threePointDraft.points,
        chartPoint,
      ];

      if (points.length < 3) {
        setThreePointDraft({
          ...threePointDraft,
          points,
          preview:
            chartPoint,
        });

        return;
      }

      const drawing:
        NexusDrawing = {
          ...createBaseDrawing(),
          type,
          points: [
            points[0]!,
            points[1]!,
            points[2]!,
          ],
        };

      commitDrawings([
        ...drawings,
        drawing,
      ]);

      setSelectedId(
        drawing.id,
      );

      setThreePointDraft(null);

      return;
    }

    if (
      TWO_POINT_TOOLS
        .has(activeTool)
    ) {
      setTwoPointDraft({
        type:
          activeTool as TwoPointTool,
        start:
          chartPoint,
        current:
          chartPoint,
      });

      event.currentTarget
        .setPointerCapture(
          event.pointerId,
        );
    }
  };

  const handlePointerMove = (
    event:
      ReactPointerEvent<SVGSVGElement>,
  ) => {
    const point =
      getChartPoint(
        event,
        activeTool !== 'cursor',
      );

    if (!point) {
      return;
    }

    if (cursorDrag) {
      const updated =
        cursorDrag.mode
        === 'point'
          ? updateNexusDrawingPoint(
              cursorDrag.originalDrawing,
              cursorDrag.pointIndex,
              point,
            )
          : moveNexusDrawing(
              cursorDrag.originalDrawing,
              point.time
              - cursorDrag.start.time,
              point.price
              - cursorDrag.start.price,
            );

      setDrawings(
        cursorDrag
          .originalDrawings
          .map(
            (drawing) =>
              drawing.id
              === updated.id
                ? updated
                : drawing,
          ),
      );

      setCursorDrag({
        ...cursorDrag,
        changed:
          true,
      });

      return;
    }

    if (twoPointDraft) {
      setTwoPointDraft({
        ...twoPointDraft,
        current:
          point,
      });

      return;
    }

    if (threePointDraft) {
      setThreePointDraft({
        ...threePointDraft,
        preview:
          point,
      });
    }
  };

  const handlePointerUp = (
    event:
      ReactPointerEvent<SVGSVGElement>,
  ) => {
    if (cursorDrag) {
      if (cursorDrag.changed) {
        setPast(
          (items) => [
            ...items,
            cursorDrag
              .originalDrawings,
          ],
        );

        setFuture([]);
      }

      setCursorDrag(null);
    }

    if (twoPointDraft) {
      const point =
        getChartPoint(
          event,
          true,
        )
        ?? twoPointDraft.current;

      const drawing =
        createTwoPointDrawing({
          ...twoPointDraft,
          current:
            point,
        });

      commitDrawings([
        ...drawings,
        drawing,
      ]);

      setSelectedId(
        drawing.id,
      );

      setTwoPointDraft(null);
    }

    if (
      event.currentTarget
        .hasPointerCapture(
          event.pointerId,
        )
    ) {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId,
        );
    }
  };

  const cancelDrafts = () => {
    setTwoPointDraft(null);
    setThreePointDraft(null);
    setCursorDrag(null);
  };

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      const target =
        event.target;

      if (
        target instanceof
          HTMLInputElement
        || target instanceof
          HTMLTextAreaElement
      ) {
        return;
      }

      if (
        event.key === 'Escape'
      ) {
        cancelDrafts();
        setSelectedId(null);
        setActiveTool('pan');
        return;
      }

      if (
        event.key === 'Delete'
        && selectedId
      ) {
        commitDrawings(
          drawings.filter(
            (drawing) =>
              drawing.id
              !== selectedId,
          ),
        );

        setSelectedId(null);
        return;
      }

      if (
        (
          event.ctrlKey
          || event.metaKey
        )
        && event.key
          .toLowerCase()
        === 'z'
      ) {
        event.preventDefault();

        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }

        return;
      }

      if (
        (
          event.ctrlKey
          || event.metaKey
        )
        && event.key
          .toLowerCase()
        === 'y'
      ) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  });

  const renderHandles = (
    drawing: NexusDrawing,
  ) => {
    if (
      drawing.id !== selectedId
      || drawing.hidden
    ) {
      return null;
    }

    return getDrawingHandles(
      drawing,
    ).map(
      (handle) => (
        <circle
          key={
            handle.pointIndex
          }
          cx={handle.x}
          cy={handle.y}
          r={HANDLE_RADIUS}
          className={[
            styles.handle,
            drawing.locked
              ? styles.handleLocked
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ),
    );
  };

  const renderDrawing = (
    drawing: NexusDrawing,
    preview = false,
  ) => {
    if (drawing.hidden) {
      return null;
    }

    const svg =
      svgRef.current;

    if (!svg) {
      return null;
    }

    const width =
      svg.clientWidth;

    const height =
      svg.clientHeight;

    const selected =
      drawing.id
      === selectedId;

    const groupClassName = [
      styles.drawing,
      selected
        ? styles.selected
        : '',
      preview
        ? styles.preview
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    let shape:
      React.ReactNode = null;

    if (
      drawing.type
      === 'horizontal'
    ) {
      const y =
        seriesRef.current
          ?.priceToCoordinate(
            drawing.price,
          )
        ?? null;

      if (y === null) {
        return null;
      }

      shape = (
        <>
          <line
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            className={
              styles.horizontalLine
            }
          />
          <text
            x={8}
            y={y - 6}
            className={
              styles.priceLabel
            }
          >
            {formatPrice(
              drawing.price,
            )}
          </text>
        </>
      );
    } else if (
      drawing.type
      === 'vertical'
    ) {
      const x =
        chartRef.current
          ?.timeScale()
          .timeToCoordinate(
            drawing.time as UTCTimestamp,
          )
        ?? null;

      if (x === null) {
        return null;
      }

      shape = (
        <line
          x1={x}
          y1={0}
          x2={x}
          y2={height}
          className={
            styles.verticalLine
          }
        />
      );
    } else if (
      drawing.type
      === 'horizontalRay'
    ) {
      const start =
        toScreenPoint(
          drawing.point,
        );

      if (!start) {
        return null;
      }

      shape = (
        <>
          <line
            x1={start.x}
            y1={start.y}
            x2={width}
            y2={start.y}
            className={
              styles.horizontalLine
            }
          />
          <text
            x={start.x + 7}
            y={start.y - 6}
            className={
              styles.priceLabel
            }
          >
            {formatPrice(
              drawing.point.price,
            )}
          </text>
        </>
      );
    } else if (
      drawing.type === 'text'
      || drawing.type === 'marker'
    ) {
      const point =
        toScreenPoint(
          drawing.point,
        );

      if (!point) {
        return null;
      }

      shape = drawing.type
      === 'marker'
        ? (
          <>
            <circle
              cx={point.x}
              cy={point.y}
              r={6}
              className={
                styles.marker
              }
            />
            <text
              x={point.x + 10}
              y={point.y - 8}
              className={
                styles.note
              }
            >
              {drawing.text}
            </text>
          </>
        )
        : (
          <>
            <circle
              cx={point.x}
              cy={point.y}
              r={3}
              className={
                styles.anchor
              }
            />
            <text
              x={point.x + 8}
              y={point.y - 8}
              className={
                styles.note
              }
            >
              {drawing.text}
            </text>
          </>
        );
    } else if (
      drawing.type
      === 'parallelChannel'
    ) {
      const first =
        toScreenPoint(
          drawing.points[0],
        );

      const second =
        toScreenPoint(
          drawing.points[1],
        );

      const third =
        toScreenPoint(
          drawing.points[2],
        );

      if (
        !first
        || !second
        || !third
      ) {
        return null;
      }

      const parallelEnd = {
        x:
          third.x
          + second.x
          - first.x,
        y:
          third.y
          + second.y
          - first.y,
      };

      shape = (
        <>
          <polygon
            points={[
              `${first.x},${first.y}`,
              `${second.x},${second.y}`,
              `${parallelEnd.x},${parallelEnd.y}`,
              `${third.x},${third.y}`,
            ].join(' ')}
            className={
              styles.channelFill
            }
          />
          <line
            x1={first.x}
            y1={first.y}
            x2={second.x}
            y2={second.y}
            className={
              styles.channelLine
            }
          />
          <line
            x1={third.x}
            y1={third.y}
            x2={parallelEnd.x}
            y2={parallelEnd.y}
            className={
              styles.channelLine
            }
          />
        </>
      );
    } else if (
      drawing.type
      === 'fibExtension'
    ) {
      const screens =
        drawing.points
          .map(toScreenPoint);

      if (
        screens.some(
          (value) =>
            value === null,
        )
      ) {
        return null;
      }

      const [
        first,
        second,
        third,
      ] =
        screens as [
          ScreenPoint,
          ScreenPoint,
          ScreenPoint,
        ];

      const left =
        Math.min(
          first.x,
          second.x,
          third.x,
        );

      const right =
        Math.max(
          first.x,
          second.x,
          third.x,
        );

      shape = (
        <>
          {FIB_EXTENSION_LEVELS
            .map((level) => {
              const price =
                drawing.points[2].price
                + (
                  drawing.points[1].price
                  - drawing.points[0].price
                )
                * level;

              const y =
                seriesRef.current
                  ?.priceToCoordinate(
                    price,
                  )
                ?? null;

              if (y === null) {
                return null;
              }

              return (
                <g key={level}>
                  <line
                    x1={left}
                    y1={y}
                    x2={right}
                    y2={y}
                    className={
                      styles.fibonacciLine
                    }
                  />
                  <text
                    x={right + 6}
                    y={y - 4}
                    className={
                      styles.fibonacciLabel
                    }
                  >
                    {Math.round(
                      level * 1000,
                    ) / 10}%
                  </text>
                </g>
              );
            })}
        </>
      );
    } else {
      if (
        !hasDrawingPoints(drawing)
      ) {
        return null;
      }

      const start =
        toScreenPoint(
          drawing.points[0],
        );

      const end =
        toScreenPoint(
          drawing.points[1],
        );

      if (!start || !end) {
        return null;
      }

      if (
        drawing.type
        === 'rectangle'
      ) {
        shape = (
          <rect
            x={Math.min(
              start.x,
              end.x,
            )}
            y={Math.min(
              start.y,
              end.y,
            )}
            width={Math.abs(
              end.x - start.x,
            )}
            height={Math.abs(
              end.y - start.y,
            )}
            className={
              styles.rectangle
            }
          />
        );
      } else if (
        drawing.type
        === 'ellipse'
      ) {
        shape = (
          <ellipse
            cx={
              (
                start.x + end.x
              ) / 2
            }
            cy={
              (
                start.y + end.y
              ) / 2
            }
            rx={
              Math.abs(
                end.x - start.x,
              ) / 2
            }
            ry={
              Math.abs(
                end.y - start.y,
              ) / 2
            }
            className={
              styles.ellipse
            }
          />
        );
      } else if (
        drawing.type
        === 'fibRetracement'
      ) {
        const left =
          Math.min(
            start.x,
            end.x,
          );

        const right =
          Math.max(
            start.x,
            end.x,
          );

        shape = (
          <>
            {FIB_RETRACEMENT_LEVELS
              .map((level) => {
                const price =
                  drawing.points[0].price
                  + (
                    drawing.points[1].price
                    - drawing.points[0].price
                  )
                  * level;

                const y =
                  seriesRef.current
                    ?.priceToCoordinate(
                      price,
                    )
                  ?? null;

                if (y === null) {
                  return null;
                }

                return (
                  <g key={level}>
                    <line
                      x1={left}
                      y1={y}
                      x2={right}
                      y2={y}
                      className={
                        styles.fibonacciLine
                      }
                    />
                    <text
                      x={right + 6}
                      y={y - 4}
                      className={
                        styles.fibonacciLabel
                      }
                    >
                      {Math.round(
                        level * 1000,
                      ) / 10}%
                    </text>
                  </g>
                );
              })}
          </>
        );
      } else if (
        drawing.type
        === 'longPosition'
        || drawing.type
        === 'shortPosition'
      ) {
        const stop =
          toScreenPoint({
            time:
              drawing.points[1].time,
            price:
              drawing.stopPrice,
          });

        if (!stop) {
          return null;
        }

        const left =
          Math.min(
            start.x,
            end.x,
          );

        const rectangleWidth =
          Math.max(
            Math.abs(
              end.x - start.x,
            ),
            24,
          );

        const isLong =
          drawing.type
          === 'longPosition';

        const targetTop =
          Math.min(
            start.y,
            end.y,
          );

        const targetHeight =
          Math.abs(
            end.y - start.y,
          );

        const stopTop =
          Math.min(
            start.y,
            stop.y,
          );

        const stopHeight =
          Math.abs(
            stop.y - start.y,
          );

        const targetPercent =
          (
            (
              drawing.points[1].price
              - drawing.points[0].price
            )
            / drawing.points[0].price
          )
          * 100;

        const stopPercent =
          (
            (
              drawing.stopPrice
              - drawing.points[0].price
            )
            / drawing.points[0].price
          )
          * 100;

        shape = (
          <>
            <rect
              x={left}
              y={targetTop}
              width={rectangleWidth}
              height={targetHeight}
              className={
                isLong
                  ? styles.positionProfit
                  : styles.positionLoss
              }
            />
            <rect
              x={left}
              y={stopTop}
              width={rectangleWidth}
              height={stopHeight}
              className={
                isLong
                  ? styles.positionLoss
                  : styles.positionProfit
              }
            />
            <line
              x1={left}
              y1={start.y}
              x2={
                left
                + rectangleWidth
              }
              y2={start.y}
              className={
                styles.positionEntry
              }
            />
            <text
              x={left + 6}
              y={targetTop + 15}
              className={
                styles.positionLabel
              }
            >
              TP {targetPercent >= 0
                ? '+'
                : ''}
              {targetPercent.toFixed(2)}%
            </text>
            <text
              x={left + 6}
              y={
                stopTop
                + stopHeight
                - 6
              }
              className={
                styles.positionLabel
              }
            >
              SL {stopPercent >= 0
                ? '+'
                : ''}
              {stopPercent.toFixed(2)}%
            </text>
          </>
        );
      } else {
        let lineStart =
          start;

        let lineEnd =
          end;

        if (
          drawing.type
          === 'ray'
          || drawing.type
          === 'infiniteLine'
        ) {
          const extended =
            getExtendedLine(
              start,
              end,
              drawing.type,
            );

          lineStart =
            extended.start;

          lineEnd =
            extended.end;
        }

        const percent =
          (
            (
              drawing.points[1].price
              - drawing.points[0].price
            )
            / drawing.points[0].price
          )
          * 100;

        const duration =
          drawing.points[1].time
          - drawing.points[0].time;

        shape = (
          <>
            <line
              x1={lineStart.x}
              y1={lineStart.y}
              x2={lineEnd.x}
              y2={lineEnd.y}
              className={
                drawing.type
                === 'measure'
                  ? styles.measureLine
                  : drawing.type
                  === 'arrow'
                    ? styles.arrowLine
                    : styles.trendLine
              }
              markerEnd={
                drawing.type
                === 'arrow'
                  ? 'url(#nexus-arrow)'
                  : undefined
              }
            />

            {drawing.type
              === 'measure'
              ? (
                <text
                  x={
                    (
                      start.x
                      + end.x
                    ) / 2
                  }
                  y={
                    (
                      start.y
                      + end.y
                    ) / 2
                    - 10
                  }
                  className={
                    styles.measureLabel
                  }
                >
                  {percent >= 0
                    ? '+'
                    : ''}
                  {percent.toFixed(2)}%
                  {' · '}
                  {formatDuration(
                    duration,
                  )}
                </text>
              )
              : null}
          </>
        );
      }
    }

    return (
      <g
        key={drawing.id}
        className={
          groupClassName
        }
      >
        {shape}
        {renderHandles(
          drawing,
        )}
      </g>
    );
  };

  const previewDrawing:
    NexusDrawing | null =
      twoPointDraft
        ? createTwoPointDrawing(
            twoPointDraft,
          )
        : threePointDraft
          && threePointDraft.preview
          ? threePointDraft
              .points.length === 1
            ? {
                ...createBaseDrawing(),
                type:
                  'trend',
                points: [
                  threePointDraft
                    .points[0]!,
                  threePointDraft
                    .preview,
                ],
              }
            : {
                ...createBaseDrawing(),
                type:
                  threePointDraft.type,
                points: [
                  threePointDraft
                    .points[0]!,
                  threePointDraft
                    .points[1]!,
                  threePointDraft
                    .preview,
                ],
              }
          : null;

  const setTool = (
    tool: EditorTool,
  ) => {
    cancelDrafts();
    setActiveTool(tool);

    if (tool !== 'cursor') {
      setSelectedId(null);
    }
  };

  const toggleSelectedLock = () => {
    if (!selectedId) {
      return;
    }

    commitDrawings(
      drawings.map(
        (drawing) =>
          drawing.id
          === selectedId
            ? toggleNexusDrawingLock(
                drawing,
              )
            : drawing,
      ),
    );
  };

  const toggleVisibility = () => {
    if (selectedId) {
      commitDrawings(
        drawings.map(
          (drawing) =>
            drawing.id
            === selectedId
              ? toggleNexusDrawingVisibility(
                  drawing,
                )
              : drawing,
        ),
      );

      setSelectedId(null);
      return;
    }

    if (
      drawings.some(
        (drawing) =>
          drawing.hidden,
      )
    ) {
      commitDrawings(
        drawings.map(
          (drawing) => ({
            ...drawing,
            hidden:
              false,
          }),
        ),
      );
    }
  };

  const deleteSelected = () => {
    if (!selectedId) {
      return;
    }

    commitDrawings(
      drawings.filter(
        (drawing) =>
          drawing.id
          !== selectedId,
      ),
    );

    setSelectedId(null);
  };

  void revision;

  return (
    <>
      <div
        className={
          styles.toolbar
        }
        onPointerDown={
          (event) =>
            event.stopPropagation()
        }
      >
        <div
          className={
            styles.toolScroller
          }
        >
          {TOOLS.map(
            (tool) => (
              <button
                key={tool.id}
                type="button"
                className={[
                  styles.toolButton,
                  activeTool
                  === tool.id
                    ? styles.active
                    : '',
                  tool.id
                  === 'longPosition'
                    ? styles.longTool
                    : '',
                  tool.id
                  === 'shortPosition'
                    ? styles.shortTool
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={
                  tool.label
                }
                title={
                  tool.label
                }
                aria-pressed={
                  activeTool
                  === tool.id
                }
                onClick={() =>
                  setTool(
                    tool.id,
                  )
                }
              >
                {tool.symbol}
              </button>
            ),
          )}
        </div>

        <span
          className={
            styles.separator
          }
        />

        <button
          type="button"
          className={[
            styles.actionButton,
            magnetEnabled
              ? styles.active
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          title="Магнит к OHLC свечей"
          aria-label="Магнит к OHLC свечей"
          aria-pressed={
            magnetEnabled
          }
          onClick={() =>
            setMagnetEnabled(
              (value) => !value,
            )
          }
        >
          🧲
        </button>

        <button
          type="button"
          className={
            styles.actionButton
          }
          title="Отменить Ctrl+Z"
          aria-label="Отменить"
          disabled={
            past.length === 0
          }
          onClick={undo}
        >
          ↶
        </button>

        <button
          type="button"
          className={
            styles.actionButton
          }
          title="Повторить Ctrl+Y"
          aria-label="Повторить"
          disabled={
            future.length === 0
          }
          onClick={redo}
        >
          ↷
        </button>

        <button
          type="button"
          className={[
            styles.actionButton,
            selectedDrawing?.locked
              ? styles.active
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          title={
            selectedDrawing?.locked
              ? 'Разблокировать объект'
              : 'Заблокировать объект'
          }
          aria-label={
            selectedDrawing?.locked
              ? 'Разблокировать объект'
              : 'Заблокировать объект'
          }
          disabled={
            !selectedDrawing
          }
          onClick={
            toggleSelectedLock
          }
        >
          {selectedDrawing?.locked
            ? '🔒'
            : '🔓'}
        </button>

        <button
          type="button"
          className={
            styles.actionButton
          }
          title={
            selectedDrawing
              ? 'Скрыть выбранный объект'
              : 'Показать скрытые объекты'
          }
          aria-label="Видимость объектов"
          disabled={
            !selectedDrawing
            && !drawings.some(
              (drawing) =>
                drawing.hidden,
            )
          }
          onClick={
            toggleVisibility
          }
        >
          👁
        </button>

        <button
          type="button"
          className={
            styles.actionButton
          }
          title="Удалить выбранный объект"
          aria-label="Удалить выбранный объект"
          disabled={
            !selectedDrawing
          }
          onClick={
            deleteSelected
          }
        >
          ⌫
        </button>

        <button
          type="button"
          className={
            styles.actionButton
          }
          title="Удалить все объекты"
          aria-label="Удалить все объекты"
          disabled={
            drawings.length === 0
          }
          onClick={() => {
            commitDrawings([]);
            setSelectedId(null);
          }}
        >
          🗑
        </button>

        <span
          className={
            styles.counter
          }
          title="Количество объектов"
        >
          {drawings.length}
        </span>
      </div>

      <svg
        ref={svgRef}
        className={[
          styles.layer,
          activeTool !== 'pan'
            ? styles.interactive
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
        onPointerDown={
          handlePointerDown
        }
        onPointerMove={
          handlePointerMove
        }
        onPointerUp={
          handlePointerUp
        }
        onPointerCancel={
          cancelDrafts
        }
      >
        <defs>
          <marker
            id="nexus-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path
              d="M 0 0 L 8 4 L 0 8 z"
              className={
                styles.arrowHead
              }
            />
          </marker>
        </defs>

        {drawings.map(
          (drawing) =>
            renderDrawing(
              drawing,
            ),
        )}

        {previewDrawing
          ? renderDrawing(
              previewDrawing,
              true,
            )
          : null}
      </svg>

      {threePointDraft
        ? (
          <div
            className={
              styles.hint
            }
          >
            Точка {
              threePointDraft
                .points.length + 1
            } из 3
          </div>
        )
        : null}
    </>
  );
}
