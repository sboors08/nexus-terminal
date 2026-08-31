import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';

import type {
  Candle,
} from '../../api/contracts.js';
import {
  resolveLiquidationHeatColor,
  type LiquidationHeatmapSnapshot,
} from '../../realtime/liquidationHeatmap.js';
import type {
  LiquidationHeatmapQueryStatus,
} from '../../realtime/useLiquidationHeatmap.js';
import styles from './NexusLiquidationHeatmap.module.css';

export interface NexusLiquidationHeatmapProps {
  symbol: string;
  timeframe: string;
  candles: readonly Candle[];
  snapshot: LiquidationHeatmapSnapshot | null;
  status: LiquidationHeatmapQueryStatus;
  error: Error | null;
  onRetry: () => void;
}

const WIDTH = 1_000;
const HEIGHT = 410;
const LEFT = 16;
const RIGHT = 92;
const TOP = 18;
const BOTTOM = 42;
const DEFAULT_CANDLE_COUNT = 120;
const MIN_CANDLE_COUNT = 30;
const MAX_CANDLE_COUNT = 360;
const MIN_PRICE_SCALE = 0.22;
const MAX_PRICE_SCALE = 8;

interface HeatmapViewport {
  candleCount: number;
  offsetFromLatest: number;
  priceOffset: number;
  priceScale: number;
}

interface HeatmapDragState {
  mode: 'pan' | 'price-scale';
  pointerId: number;
  startClientX: number;
  startClientY: number;
  viewport: HeatmapViewport;
}

const INITIAL_VIEWPORT: HeatmapViewport = {
  candleCount: DEFAULT_CANDLE_COUNT,
  offsetFromLatest: 0,
  priceOffset: 0,
  priceScale: 1,
};

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

function resolveCandleCount(
  requestedCount: number,
  availableCount: number,
): number {
  const maximum = Math.max(
    1,
    Math.min(MAX_CANDLE_COUNT, availableCount),
  );
  const minimum = Math.min(
    MIN_CANDLE_COUNT,
    maximum,
  );

  return Math.round(
    clamp(requestedCount, minimum, maximum),
  );
}

function formatCompact(
  value: number,
): string {
  return value.toLocaleString(
    'ru-RU',
    {
      notation: 'compact',
      maximumFractionDigits: 1,
    },
  );
}

function resolvePricePrecision(
  value: number,
): number {
  if (value >= 1_000) {
    return 2;
  }

  if (value >= 1) {
    return 4;
  }

  return 8;
}

function formatPrice(
  value: number,
): string {
  const precision = resolvePricePrecision(value);

  return value.toLocaleString(
    'ru-RU',
    {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    },
  );
}

function resolveStatusLabel(
  snapshot: LiquidationHeatmapSnapshot | null,
  status: LiquidationHeatmapQueryStatus,
): string {
  if (status === 'error') {
    return 'НЕТ ДАННЫХ';
  }

  if (
    status === 'loading'
    || snapshot === null
    || snapshot.status === 'collecting'
  ) {
    return 'СБОР ДАННЫХ';
  }

  return snapshot.status === 'degraded'
    ? 'ДАННЫЕ УСТАРЕЛИ'
    : 'LIVE';
}

export function NexusLiquidationHeatmap({
  symbol,
  timeframe,
  candles,
  snapshot,
  status,
  error,
  onRetry,
}: NexusLiquidationHeatmapProps) {
  const clipPathId = useId().replace(/:/gu, '');
  const [viewport, setViewport] =
    useState<HeatmapViewport>(INITIAL_VIEWPORT);
  const [dragMode, setDragMode] =
    useState<HeatmapDragState['mode'] | null>(null);
  const dragStateRef =
    useRef<HeatmapDragState | null>(null);

  const normalizedViewport = useMemo(() => {
    const candleCount = resolveCandleCount(
      viewport.candleCount,
      candles.length,
    );
    const maximumOffset = Math.max(
      0,
      candles.length - candleCount,
    );

    return {
      ...viewport,
      candleCount,
      offsetFromLatest: clamp(
        viewport.offsetFromLatest,
        0,
        maximumOffset,
      ),
      priceScale: clamp(
        viewport.priceScale,
        MIN_PRICE_SCALE,
        MAX_PRICE_SCALE,
      ),
    };
  }, [candles.length, viewport]);

  const visibleCandles = useMemo(
    () => {
      const endIndex = Math.max(
        normalizedViewport.candleCount,
        candles.length
        - Math.round(
          normalizedViewport.offsetFromLatest,
        ),
      );
      const startIndex = Math.max(
        0,
        endIndex
        - normalizedViewport.candleCount,
      );

      return candles.slice(
        startIndex,
        endIndex,
      );
    },
    [candles, normalizedViewport],
  );

  const visibleTimeRange = useMemo(() => {
    const first = visibleCandles.at(0);
    const last = visibleCandles.at(-1);

    return {
      firstTime:
        first === undefined
          ? Number.NaN
          : Date.parse(first.openTime),
      lastTime:
        last === undefined
          ? Number.NaN
          : Date.parse(last.closeTime),
    };
  }, [visibleCandles]);

  const visibleHistoryBuckets = useMemo(
    () => (
      snapshot?.historyBuckets.filter(
        (bucket) => {
          const start = Date.parse(bucket.bucketStart);
          const end = Date.parse(bucket.bucketEnd);

          return (
            !Number.isFinite(visibleTimeRange.firstTime)
            || !Number.isFinite(visibleTimeRange.lastTime)
            || (
              end >= visibleTimeRange.firstTime
              && start <= visibleTimeRange.lastTime
            )
          );
        },
      )
      ?? []
    ),
    [snapshot, visibleTimeRange],
  );

  const basePriceRange = useMemo(() => {
    const candlePrices = visibleCandles.flatMap(
      (candle) => [candle.low, candle.high],
    );
    const finiteCandlePrices = candlePrices.filter(
      (value) => Number.isFinite(value) && value > 0,
    );
    const marketPrice = snapshot?.marketPrice;
    const fallbackPrice =
      marketPrice
      ?? finiteCandlePrices.at(-1)
      ?? 1;
    const candleMinimum = finiteCandlePrices.length > 0
      ? Math.min(...finiteCandlePrices)
      : fallbackPrice * 0.99;
    const candleMaximum = finiteCandlePrices.length > 0
      ? Math.max(...finiteCandlePrices)
      : fallbackPrice * 1.01;
    const candleSpan = Math.max(
      candleMaximum - candleMinimum,
      fallbackPrice * 0.012,
      1e-8,
    );
    const relevantDistance = Math.max(
      candleSpan * 2.4,
      fallbackPrice * 0.055,
    );
    const historicalZones = [
      ...(snapshot?.estimatedZones ?? []),
      ...visibleHistoryBuckets.flatMap(
        (bucket) => bucket.estimatedZones,
      ),
    ];
    const nearbyZonePrices =
      historicalZones
        .filter(
          (zone) =>
            Math.abs(
              zone.centerPrice - fallbackPrice,
            ) <= relevantDistance,
        )
        .flatMap(
          (zone) => [zone.priceLow, zone.priceHigh],
        )
      ;
    const nearbyObservedPrices =
      snapshot?.observedEvents
        .map((event) => event.price)
        .filter(
          (price) =>
            Math.abs(price - fallbackPrice)
            <= relevantDistance,
        )
      ?? [];
    const values = [
      ...finiteCandlePrices,
      ...nearbyZonePrices,
      ...nearbyObservedPrices,
      fallbackPrice,
    ];
    const rawMinimum = Math.min(...values);
    const rawMaximum = Math.max(...values);
    const rawSpan = Math.max(
      rawMaximum - rawMinimum,
      fallbackPrice * 0.012,
      1e-8,
    );
    const paddedSpan = rawSpan * 1.14;

    return {
      center:
        (rawMinimum + rawMaximum) / 2,
      span: paddedSpan,
    };
  }, [snapshot, visibleCandles, visibleHistoryBuckets]);

  const scene = useMemo(() => {
    const span = Math.max(
      basePriceRange.span
      * normalizedViewport.priceScale,
      1e-8,
    );
    const center =
      basePriceRange.center
      + normalizedViewport.priceOffset;
    const minimum = Math.max(
      0,
      center - span / 2,
    );
    const maximum = minimum + span;
    const plotWidth = WIDTH - LEFT - RIGHT;
    const plotHeight = HEIGHT - TOP - BOTTOM;
    const y = (price: number) =>
      TOP
      + (
        (maximum - price)
        / (maximum - minimum)
      ) * plotHeight;
    const candleWidth = Math.max(
      1.4,
      Math.min(
        7,
        plotWidth
        / Math.max(visibleCandles.length, 1)
        * 0.62,
      ),
    );
    const x = (index: number) =>
      LEFT
      + (
        (index + 0.5)
        / Math.max(visibleCandles.length, 1)
      ) * plotWidth;
    const timeX = (timestamp: string) => {
      const eventTime = Date.parse(timestamp);

      if (
        !Number.isFinite(eventTime)
        || !Number.isFinite(visibleTimeRange.firstTime)
        || !Number.isFinite(visibleTimeRange.lastTime)
        || visibleTimeRange.lastTime <= visibleTimeRange.firstTime
      ) {
        return LEFT + plotWidth;
      }

      return LEFT
        + (
          (eventTime - visibleTimeRange.firstTime)
          / (
            visibleTimeRange.lastTime
            - visibleTimeRange.firstTime
          )
        ) * plotWidth;
    };

    return {
      minimum,
      maximum,
      plotWidth,
      plotHeight,
      y,
      x,
      timeX,
      candleWidth,
    };
  }, [
    basePriceRange,
    normalizedViewport,
    visibleCandles,
    visibleTimeRange,
  ]);

  const zones = snapshot?.estimatedZones ?? [];
  const observedEvents = snapshot?.observedEvents ?? [];
  const strongestZone = zones.reduce(
    (strongest, zone) =>
      strongest === null
      || zone.intensity > strongest.intensity
        ? zone
        : strongest,
    null as LiquidationHeatmapSnapshot['estimatedZones'][number] | null,
  );
  const statusLabel = resolveStatusLabel(
    snapshot,
    status,
  );
  const generatedLabel = snapshot === null
    ? '—'
    : new Date(snapshot.generatedAt).toLocaleTimeString(
        'ru-RU',
        {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        },
      );

  const heatCells = useMemo(
    () => visibleHistoryBuckets.flatMap(
      (bucket) => {
        const startX = scene.timeX(bucket.bucketStart);
        const endX = scene.timeX(bucket.bucketEnd);

        return bucket.estimatedZones
          .filter(
            (zone) =>
              zone.priceHigh >= scene.minimum
              && zone.priceLow <= scene.maximum,
          )
          .map((zone) => ({
            key: `${bucket.bucketStart}:${zone.id}`,
            bucket,
            zone,
            x: startX,
            width: Math.max(2, endX - startX + 0.5),
          }));
      },
    ),
    [scene, visibleHistoryBuckets],
  );

  const resetViewport = useCallback(() => {
    setViewport(INITIAL_VIEWPORT);
  }, []);

  const zoomViewport = useCallback(
    (
      factor: number,
      anchorX = 0.5,
      anchorY = 0.5,
    ) => {
      setViewport((current) => {
        const currentCount = resolveCandleCount(
          current.candleCount,
          candles.length,
        );
        const nextCount = resolveCandleCount(
          currentCount * factor,
          candles.length,
        );
        const currentEnd =
          candles.length
          - clamp(
            current.offsetFromLatest,
            0,
            Math.max(0, candles.length - currentCount),
          );
        const currentStart = currentEnd - currentCount;
        const anchorIndex =
          currentStart + currentCount * anchorX;
        const nextStart =
          anchorIndex - nextCount * anchorX;
        const nextEnd = nextStart + nextCount;
        const maximumOffset = Math.max(
          0,
          candles.length - nextCount,
        );
        const offsetFromLatest = clamp(
          candles.length - nextEnd,
          0,
          maximumOffset,
        );
        const currentSpan =
          basePriceRange.span
          * clamp(
            current.priceScale,
            MIN_PRICE_SCALE,
            MAX_PRICE_SCALE,
          );
        const currentCenter =
          basePriceRange.center
          + current.priceOffset;
        const currentMaximum =
          currentCenter + currentSpan / 2;
        const anchorPrice =
          currentMaximum - currentSpan * anchorY;
        const nextPriceScale = clamp(
          current.priceScale * factor,
          MIN_PRICE_SCALE,
          MAX_PRICE_SCALE,
        );
        const nextSpan =
          basePriceRange.span * nextPriceScale;
        const nextMaximum =
          anchorPrice + nextSpan * anchorY;
        const nextCenter =
          nextMaximum - nextSpan / 2;

        return {
          candleCount: nextCount,
          offsetFromLatest,
          priceOffset:
            nextCenter - basePriceRange.center,
          priceScale: nextPriceScale,
        };
      });
    },
    [basePriceRange, candles.length],
  );

  const resolveSvgPoint = useCallback(
    (
      element: SVGSVGElement,
      clientX: number,
      clientY: number,
    ) => {
      const bounds = element.getBoundingClientRect();

      return {
        x:
          (clientX - bounds.left)
          / Math.max(bounds.width, 1)
          * WIDTH,
        y:
          (clientY - bounds.top)
          / Math.max(bounds.height, 1)
          * HEIGHT,
      };
    },
    [],
  );

  const handleWheel = useCallback(
    (event: ReactWheelEvent<SVGSVGElement>) => {
      event.preventDefault();

      const point = resolveSvgPoint(
        event.currentTarget,
        event.clientX,
        event.clientY,
      );
      const anchorX = clamp(
        (point.x - LEFT) / scene.plotWidth,
        0,
        1,
      );
      const anchorY = clamp(
        (point.y - TOP) / scene.plotHeight,
        0,
        1,
      );
      const factor = event.deltaY < 0
        ? 0.84
        : 1.18;

      zoomViewport(
        factor,
        anchorX,
        anchorY,
      );
    },
    [resolveSvgPoint, scene, zoomViewport],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) {
        return;
      }

      const point = resolveSvgPoint(
        event.currentTarget,
        event.clientX,
        event.clientY,
      );
      const mode = point.x >= WIDTH - RIGHT
        ? 'price-scale'
        : 'pan';

      dragStateRef.current = {
        mode,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        viewport: normalizedViewport,
      };
      setDragMode(mode);
      event.currentTarget.setPointerCapture(
        event.pointerId,
      );
      event.preventDefault();
    },
    [normalizedViewport, resolveSvgPoint],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const drag = dragStateRef.current;

      if (
        drag === null
        || drag.pointerId !== event.pointerId
      ) {
        return;
      }

      const bounds =
        event.currentTarget.getBoundingClientRect();
      const deltaX =
        event.clientX - drag.startClientX;
      const deltaY =
        event.clientY - drag.startClientY;

      if (drag.mode === 'price-scale') {
        const factor = Math.exp(
          deltaY
          / Math.max(bounds.height * 0.62, 1),
        );

        setViewport({
          ...drag.viewport,
          priceScale: clamp(
            drag.viewport.priceScale * factor,
            MIN_PRICE_SCALE,
            MAX_PRICE_SCALE,
          ),
        });
        return;
      }

      const horizontalBars =
        deltaX
        / Math.max(bounds.width, 1)
        * drag.viewport.candleCount;
      const priceSpan =
        basePriceRange.span
        * drag.viewport.priceScale;
      const priceDelta =
        deltaY
        / Math.max(bounds.height, 1)
        * priceSpan;
      const maximumOffset = Math.max(
        0,
        candles.length
        - drag.viewport.candleCount,
      );

      setViewport({
        ...drag.viewport,
        offsetFromLatest: clamp(
          drag.viewport.offsetFromLatest
          + horizontalBars,
          0,
          maximumOffset,
        ),
        priceOffset:
          drag.viewport.priceOffset
          + priceDelta,
      });
    },
    [basePriceRange.span, candles.length],
  );

  const finishPointerDrag = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (
        dragStateRef.current?.pointerId
        !== event.pointerId
      ) {
        return;
      }

      if (
        event.currentTarget.hasPointerCapture(
          event.pointerId,
        )
      ) {
        event.currentTarget.releasePointerCapture(
          event.pointerId,
        );
      }

      dragStateRef.current = null;
      setDragMode(null);
    },
    [],
  );

  useEffect(() => {
    setViewport((current) => ({
      ...current,
      candleCount: resolveCandleCount(
        current.candleCount,
        candles.length,
      ),
    }));
  }, [candles.length]);

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Binance forceOrder + NEXUS model
          </p>
          <h2>Карта ликвидаций</h2>
        </div>

        <div className={styles.headerMeta}>
          <span className={styles.modelBadge}>
            ОЦЕНКА NEXUS
          </span>
          <span
            className={
              `${styles.status} ${styles[`status_${snapshot?.status ?? status}`] ?? ''}`
            }
          >
            {statusLabel}
          </span>
        </div>
      </header>

      <div className={styles.summary}>
        <div>
          <span>Инструмент</span>
          <strong>{symbol} · {timeframe}</strong>
        </div>
        <div>
          <span>Цена</span>
          <strong>
            {
              snapshot?.marketPrice === null
              || snapshot?.marketPrice === undefined
                ? '—'
                : formatPrice(snapshot.marketPrice)
            }
          </strong>
        </div>
        <div>
          <span>forceOrder</span>
          <strong>{observedEvents.length}</strong>
        </div>
        <div>
          <span>Зоны модели</span>
          <strong>{zones.length}</strong>
        </div>
        <div>
          <span>Сильнейшая зона</span>
          <strong>
            {
              strongestZone === null
                ? '—'
                : `${strongestZone.leverageBand ?? '—'}x · ${Math.round(strongestZone.confidence * 100)}%`
            }
          </strong>
        </div>
        <small>{generatedLabel}</small>
      </div>

      <div className={styles.chartWrap}>
        <div className={styles.chartControls}>
          <span>
            ЛКМ — двигать · колесо — масштаб · шкала цены — высота
          </span>
          <button
            type="button"
            onClick={() => zoomViewport(0.82)}
            aria-label="Увеличить карту ликвидаций"
            title="Увеличить"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomViewport(1.2)}
            aria-label="Уменьшить карту ликвидаций"
            title="Уменьшить"
          >
            −
          </button>
          <button
            type="button"
            onClick={resetViewport}
            className={styles.resetButton}
          >
            Сброс
          </button>
        </div>

        <svg
          className={
            `${styles.chart} ${
              dragMode === 'pan'
                ? styles.chartDragging
                : dragMode === 'price-scale'
                  ? styles.priceScaleDragging
                  : ''
            }`
          }
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Карта ликвидаций ${symbol}`}
          preserveAspectRatio="none"
          tabIndex={0}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onDoubleClick={resetViewport}
        >
          <defs>
            <clipPath id={clipPathId}>
              <rect
                x={LEFT}
                y={TOP}
                width={scene.plotWidth}
                height={scene.plotHeight}
              />
            </clipPath>
          </defs>

          <rect
            x={LEFT}
            y={TOP}
            width={scene.plotWidth}
            height={scene.plotHeight}
            className={styles.plotBackground}
          />

          {
            Array.from({ length: 6 }, (_, index) => {
              const fraction = index / 5;
              const lineY = TOP + scene.plotHeight * fraction;
              const price = scene.maximum
                - (scene.maximum - scene.minimum) * fraction;

              return (
                <g key={`grid-${index}`}>
                  <line
                    x1={LEFT}
                    x2={WIDTH - RIGHT}
                    y1={lineY}
                    y2={lineY}
                    className={styles.gridLine}
                  />
                  <text
                    x={WIDTH - RIGHT + 8}
                    y={lineY + 4}
                    className={styles.axisLabel}
                  >
                    {formatPrice(price)}
                  </text>
                </g>
              );
            })
          }

          <g clipPath={`url(#${clipPathId})`}>
          {
            heatCells.map((cell) => {
              const { zone } = cell;
              const top = scene.y(zone.priceHigh);
              const bottom = scene.y(zone.priceLow);
              const height = Math.max(4, bottom - top);
              const heatColor = resolveLiquidationHeatColor(
                zone.intensity,
              );

              return (
                <g key={cell.key}>
                  <rect
                    x={cell.x}
                    y={top}
                    width={cell.width}
                    height={height}
                    fill={heatColor}
                    opacity={0.12 + zone.intensity * 0.72}
                  />
                  <title>
                    {new Date(cell.bucket.bucketStart).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · {zone.liquidatedPositionSide.toUpperCase()} {zone.leverageBand ?? '—'}x · {formatCompact(zone.estimatedNotional)} USDT
                  </title>
                </g>
              );
            })
          }

          {
            visibleCandles.map((candle, index) => {
              const candleX = scene.x(index);
              const openY = scene.y(candle.open);
              const closeY = scene.y(candle.close);
              const highY = scene.y(candle.high);
              const lowY = scene.y(candle.low);
              const rising = candle.close >= candle.open;
              const bodyY = Math.min(openY, closeY);
              const bodyHeight = Math.max(1.2, Math.abs(openY - closeY));

              return (
                <g key={`${candle.openTime}-${index}`}>
                  <line
                    x1={candleX}
                    x2={candleX}
                    y1={highY}
                    y2={lowY}
                    className={rising ? styles.upCandle : styles.downCandle}
                  />
                  <rect
                    x={candleX - scene.candleWidth / 2}
                    y={bodyY}
                    width={scene.candleWidth}
                    height={bodyHeight}
                    className={rising ? styles.upCandle : styles.downCandle}
                  />
                </g>
              );
            })
          }

          {
            observedEvents.map((event) => (
              <g key={event.id}>
                <circle
                  cx={scene.timeX(event.eventAt)}
                  cy={scene.y(event.price)}
                  r={4 + Math.min(7, Math.log10(event.notional + 1))}
                  className={
                    event.liquidatedPositionSide === 'long'
                      ? styles.longLiquidation
                      : styles.shortLiquidation
                  }
                />
                <title>
                  Исполненная ликвидация {event.liquidatedPositionSide.toUpperCase()} · {formatCompact(event.notional)} USDT
                </title>
              </g>
            ))
          }

          {
            snapshot?.marketPrice !== null
            && snapshot?.marketPrice !== undefined
            && (
              <g>
                <line
                  x1={LEFT}
                  x2={WIDTH - RIGHT}
                  y1={scene.y(snapshot.marketPrice)}
                  y2={scene.y(snapshot.marketPrice)}
                  className={styles.currentPrice}
                />
                <text
                  x={WIDTH - RIGHT - 4}
                  y={scene.y(snapshot.marketPrice) - 6}
                  textAnchor="end"
                  className={styles.currentPriceLabel}
                >
                  LIVE {formatPrice(snapshot.marketPrice)}
                </text>
              </g>
            )
          }
          </g>
        </svg>

        {
          (
            status === 'loading'
            || snapshot?.status === 'collecting'
          )
          && (
            <div className={styles.overlayState}>
              <span className={styles.loader} />
              <strong>СБОР ДАННЫХ</strong>
              <small>
                Ожидаем Open Interest, mark price и рыночные метрики
              </small>
            </div>
          )
        }

        {
          status === 'error'
          && (
            <div className={styles.overlayState}>
              <strong>НЕТ ДАННЫХ</strong>
              <small>
                {error?.message ?? 'Карта ликвидаций временно недоступна'}
              </small>
              <button type="button" onClick={onRetry}>
                Повторить
              </button>
            </div>
          )
        }
      </div>

      <footer className={styles.footer}>
        <div className={styles.legend}>
          <span><i className={styles.executedDot} />Исполненные Binance forceOrder</span>
          <span><i className={styles.estimatedBand} />История расчётных зон NEXUS</span>
        </div>
        <p>
          Свечи и исполненные ликвидации — фактические данные. Будущие зоны — оценка модели NEXUS, не биржевой факт.
        </p>
      </footer>
    </section>
  );
}
