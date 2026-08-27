export type NexusDrawingTool =
  | 'cursor'
  | 'trend'
  | 'ray'
  | 'infiniteLine'
  | 'horizontal'
  | 'horizontalRay'
  | 'vertical'
  | 'parallelChannel'
  | 'rectangle'
  | 'ellipse'
  | 'fibRetracement'
  | 'fibExtension'
  | 'measure'
  | 'longPosition'
  | 'shortPosition'
  | 'text'
  | 'arrow'
  | 'marker';

export interface NexusChartPoint {
  time: number;
  price: number;
}

interface NexusDrawingBase {
  id: string;
  locked: boolean;
  hidden: boolean;
}

export interface NexusTwoPointDrawing
  extends NexusDrawingBase {
  type:
    | 'trend'
    | 'ray'
    | 'infiniteLine'
    | 'rectangle'
    | 'ellipse'
    | 'fibRetracement'
    | 'measure'
    | 'arrow';

  points: [
    NexusChartPoint,
    NexusChartPoint,
  ];
}

export interface NexusThreePointDrawing
  extends NexusDrawingBase {
  type:
    | 'parallelChannel'
    | 'fibExtension';

  points: [
    NexusChartPoint,
    NexusChartPoint,
    NexusChartPoint,
  ];
}

export interface NexusHorizontalDrawing
  extends NexusDrawingBase {
  type: 'horizontal';
  price: number;
}

export interface NexusHorizontalRayDrawing
  extends NexusDrawingBase {
  type: 'horizontalRay';
  point: NexusChartPoint;
}

export interface NexusVerticalDrawing
  extends NexusDrawingBase {
  type: 'vertical';
  time: number;
}

export interface NexusTextDrawing
  extends NexusDrawingBase {
  type:
    | 'text'
    | 'marker';

  point: NexusChartPoint;
  text: string;
}

export interface NexusPositionDrawing
  extends NexusDrawingBase {
  type:
    | 'longPosition'
    | 'shortPosition';

  points: [
    NexusChartPoint,
    NexusChartPoint,
  ];

  stopPrice: number;
}

export type NexusDrawing =
  | NexusTwoPointDrawing
  | NexusThreePointDrawing
  | NexusHorizontalDrawing
  | NexusHorizontalRayDrawing
  | NexusVerticalDrawing
  | NexusTextDrawing
  | NexusPositionDrawing;

export function createNexusDrawingId(): string {
  return [
    Date.now(),
    Math.random()
      .toString(16)
      .slice(2),
  ].join('-');
}

function movePoint(
  point: NexusChartPoint,
  deltaTime: number,
  deltaPrice: number,
): NexusChartPoint {
  return {
    time:
      point.time + deltaTime,
    price:
      point.price + deltaPrice,
  };
}

export function moveNexusDrawing(
  drawing: NexusDrawing,
  deltaTime: number,
  deltaPrice: number,
): NexusDrawing {
  if (drawing.locked) {
    return drawing;
  }

  switch (drawing.type) {
    case 'horizontal':
      return {
        ...drawing,
        price:
          drawing.price
          + deltaPrice,
      };

    case 'vertical':
      return {
        ...drawing,
        time:
          drawing.time
          + deltaTime,
      };

    case 'horizontalRay':
    case 'text':
    case 'marker':
      return {
        ...drawing,
        point:
          movePoint(
            drawing.point,
            deltaTime,
            deltaPrice,
          ),
      };

    case 'parallelChannel':
    case 'fibExtension':
      return {
        ...drawing,
        points: [
          movePoint(
            drawing.points[0],
            deltaTime,
            deltaPrice,
          ),
          movePoint(
            drawing.points[1],
            deltaTime,
            deltaPrice,
          ),
          movePoint(
            drawing.points[2],
            deltaTime,
            deltaPrice,
          ),
        ],
      };

    case 'longPosition':
    case 'shortPosition':
      return {
        ...drawing,
        points: [
          movePoint(
            drawing.points[0],
            deltaTime,
            deltaPrice,
          ),
          movePoint(
            drawing.points[1],
            deltaTime,
            deltaPrice,
          ),
        ],
        stopPrice:
          drawing.stopPrice
          + deltaPrice,
      };

    default:
      return {
        ...drawing,
        points: [
          movePoint(
            drawing.points[0],
            deltaTime,
            deltaPrice,
          ),
          movePoint(
            drawing.points[1],
            deltaTime,
            deltaPrice,
          ),
        ],
      };
  }
}

export function updateNexusDrawingPoint(
  drawing: NexusDrawing,
  pointIndex: number,
  point: NexusChartPoint,
): NexusDrawing {
  if (drawing.locked) {
    return drawing;
  }

  switch (drawing.type) {
    case 'horizontal':
      return {
        ...drawing,
        price:
          point.price,
      };

    case 'vertical':
      return {
        ...drawing,
        time:
          point.time,
      };

    case 'horizontalRay':
    case 'text':
    case 'marker':
      return {
        ...drawing,
        point,
      };

    case 'parallelChannel':
    case 'fibExtension': {
      if (
        pointIndex < 0
        || pointIndex > 2
      ) {
        return drawing;
      }

      const points = [
        ...drawing.points,
      ] as [
        NexusChartPoint,
        NexusChartPoint,
        NexusChartPoint,
      ];

      points[pointIndex] =
        point;

      return {
        ...drawing,
        points,
      };
    }

    case 'longPosition':
    case 'shortPosition': {
      if (pointIndex === 2) {
        return {
          ...drawing,
          stopPrice:
            point.price,
        };
      }

      if (
        pointIndex < 0
        || pointIndex > 1
      ) {
        return drawing;
      }

      const points = [
        ...drawing.points,
      ] as [
        NexusChartPoint,
        NexusChartPoint,
      ];

      points[pointIndex] =
        point;

      return {
        ...drawing,
        points,
      };
    }

    default: {
      if (
        pointIndex < 0
        || pointIndex > 1
      ) {
        return drawing;
      }

      const points = [
        ...drawing.points,
      ] as [
        NexusChartPoint,
        NexusChartPoint,
      ];

      points[pointIndex] =
        point;

      return {
        ...drawing,
        points,
      };
    }
  }
}

export function toggleNexusDrawingLock(
  drawing: NexusDrawing,
): NexusDrawing {
  return {
    ...drawing,
    locked:
      !drawing.locked,
  };
}

export function toggleNexusDrawingVisibility(
  drawing: NexusDrawing,
): NexusDrawing {
  return {
    ...drawing,
    hidden:
      !drawing.hidden,
  };
}

export function removeNexusDrawingById(
  drawings:
    readonly NexusDrawing[],
  drawingId: string,
): readonly NexusDrawing[] {
  return drawings.filter(
    (drawing) =>
      drawing.id !== drawingId,
  );
}

function isChartPoint(
  value: unknown,
): value is NexusChartPoint {
  if (
    typeof value !== 'object'
    || value === null
  ) {
    return false;
  }

  const point =
    value as Partial<NexusChartPoint>;

  return (
    Number.isFinite(point.time)
    && Number.isFinite(point.price)
  );
}

function isDrawing(
  value: unknown,
): value is NexusDrawing {
  if (
    typeof value !== 'object'
    || value === null
  ) {
    return false;
  }

  const drawing =
    value as Partial<NexusDrawing>;

  if (
    typeof drawing.id !== 'string'
    || typeof drawing.type !== 'string'
    || typeof drawing.locked !== 'boolean'
    || typeof drawing.hidden !== 'boolean'
  ) {
    return false;
  }

  if (
    drawing.type === 'horizontal'
  ) {
    return Number.isFinite(
      (
        drawing as NexusHorizontalDrawing
      ).price,
    );
  }

  if (
    drawing.type === 'vertical'
  ) {
    return Number.isFinite(
      (
        drawing as NexusVerticalDrawing
      ).time,
    );
  }

  if (
    drawing.type === 'horizontalRay'
    || drawing.type === 'text'
    || drawing.type === 'marker'
  ) {
    return isChartPoint(
      (
        drawing as
          | NexusHorizontalRayDrawing
          | NexusTextDrawing
      ).point,
    );
  }

  const points =
    (
      drawing as
        | NexusTwoPointDrawing
        | NexusThreePointDrawing
        | NexusPositionDrawing
    ).points;

  return (
    Array.isArray(points)
    && points.length >= 2
    && points.every(isChartPoint)
  );
}

function getStorageKey(
  scope: string,
): string {
  return [
    'nexus',
    'chart-drawings',
    'v1',
    scope,
  ].join(':');
}

export function loadNexusDrawings(
  scope: string,
): readonly NexusDrawing[] {
  if (
    typeof window === 'undefined'
  ) {
    return [];
  }

  try {
    const raw =
      window.localStorage.getItem(
        getStorageKey(scope),
      );

    if (!raw) {
      return [];
    }

    const value =
      JSON.parse(raw) as unknown;

    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(isDrawing);
  } catch {
    return [];
  }
}

export function saveNexusDrawings(
  scope: string,
  drawings: readonly NexusDrawing[],
): void {
  if (
    typeof window === 'undefined'
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      getStorageKey(scope),
      JSON.stringify(drawings),
    );
  } catch {
    // Local storage may be unavailable.
  }
}