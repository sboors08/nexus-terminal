import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type LogicalRange,
  type ISeriesApi,
} from 'lightweight-charts';

import type {
  Candle,
} from '../../api/contracts.js';
import {
  mapCandleChartData,
} from '../model/candleMapping.js';
import {
  buildNexusHorizontalSegmentData,
} from '../model/horizontalSegment.js';
import {
  resolveNexusChartPriceFormat,
} from '../model/priceFormat.js';
import styles from './NexusCandlestickChart.module.css';
import {
  NexusChartDrawingOverlay,
} from './NexusChartDrawingOverlay.js';

const CHART_COLORS = {
  background: '#101112',
  text: '#7f858c',
  grid: '#22252a',
  border: '#2a2d31',
  up: '#32d583',
  down: '#ff6273',
  volumeUp: 'rgba(50, 213, 131, 0.25)',
  volumeDown: 'rgba(255, 98, 115, 0.25)',
} as const;

export interface NexusChartPriceLine {
  price: number;
  color: string;
  title?: string;
  lineStyle?: 'solid' | 'dashed';
  axisLabelVisible?: boolean;
}

export interface NexusChartHorizontalSegment {
  price: number;
  startTime: string;
  endTime?: string;
  color: string;
  title?: string;
  lineStyle?: 'solid' | 'dashed';
  axisLabelVisible?: boolean;
}

interface NexusHorizontalSegmentSeries {
  series: ISeriesApi<'Line'>;
  segment: NexusChartHorizontalSegment;
}

export interface NexusCandlestickChartProps {
  candles: readonly Candle[];
  symbol: string;
  fillContainer?: boolean;
  priceLines?: readonly NexusChartPriceLine[];
  horizontalSegments?: readonly NexusChartHorizontalSegment[];
  showSeriesPriceLine?: boolean;
  enableDrawingTools?: boolean;
  drawingScope?: string;
  onLoadOlder?: () => void;
  isLoadingOlder?: boolean;
  hasMore?: boolean;
}

export function NexusCandlestickChart({
  candles,
  symbol,
  fillContainer = false,
  priceLines = [],
  horizontalSegments = [],
  showSeriesPriceLine = true,
  enableDrawingTools = false,
  drawingScope = symbol,
  onLoadOlder,
  isLoadingOlder = false,
  hasMore = false,
}: NexusCandlestickChartProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const chartRef =
    useRef<IChartApi | null>(
      null,
    );

  const candleSeriesRef =
    useRef<
      ISeriesApi<'Candlestick'> | null
    >(null);

  const volumeSeriesRef =
    useRef<
      ISeriesApi<'Histogram'> | null
    >(null);

  const horizontalSegmentSeriesRef =
    useRef<
      NexusHorizontalSegmentSeries[]
    >([]);

  const [
    chartReadyVersion,
    setChartReadyVersion,
  ] = useState(0);

  const onLoadOlderRef =
    useRef(onLoadOlder);

  const isLoadingOlderRef =
    useRef(isLoadingOlder);

  const hasMoreRef =
    useRef(hasMore);

  const previousDataLengthRef =
    useRef(0);

  onLoadOlderRef.current =
    onLoadOlder;

  isLoadingOlderRef.current =
    isLoadingOlder;

  hasMoreRef.current =
    hasMore;

  const chartData =
    useMemo(
      () =>
        mapCandleChartData(
          candles,
          {
            up:
              CHART_COLORS.volumeUp,
            down:
              CHART_COLORS.volumeDown,
          },
        ),
      [candles],
    );

  const chartPriceFormat =
    useMemo(
      () =>
        resolveNexusChartPriceFormat([
          ...candles.flatMap(
            (candle) => [
              candle.open,
              candle.high,
              candle.low,
              candle.close,
            ],
          ),

          ...priceLines.map(
            (line) =>
              line.price,
          ),

          ...horizontalSegments.map(
            (segment) =>
              segment.price,
          ),
        ]),
      [
        candles,
        horizontalSegments,
        priceLines,
      ],
    );

  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    const chart =
      createChart(
        container,
        {
          width:
            container.clientWidth,
          height:
            container.clientHeight,
          layout: {
            background: {
              type:
                ColorType.Solid,
              color:
                CHART_COLORS.background,
            },
            textColor:
              CHART_COLORS.text,
            attributionLogo:
              false,
          },
          grid: {
            vertLines: {
              color:
                CHART_COLORS.grid,
            },
            horzLines: {
              color:
                CHART_COLORS.grid,
            },
          },
          crosshair: {
            mode:
              CrosshairMode.Normal,
            vertLine: {
              color:
                '#59616a',
              width:
                1,
              style:
                LineStyle.Dashed,
              labelBackgroundColor:
                '#3b4148',
            },
            horzLine: {
              color:
                '#59616a',
              width:
                1,
              style:
                LineStyle.Dashed,
              labelBackgroundColor:
                '#3b4148',
            },
          },
          rightPriceScale: {
            borderColor:
              CHART_COLORS.border,
            scaleMargins: {
              top:
                0.08,
              bottom:
                0.2,
            },
          },
          timeScale: {
            borderColor:
              CHART_COLORS.border,
            timeVisible:
              true,
            secondsVisible:
              false,
            rightOffset:
              8,
            barSpacing:
              6,
            minBarSpacing:
              3,
          },
          handleScroll: {
            mouseWheel:
              true,
            pressedMouseMove:
              true,
            horzTouchDrag:
              true,
            vertTouchDrag:
              false,
          },
          handleScale: {
            axisPressedMouseMove:
              true,
            mouseWheel:
              true,
            pinch:
              true,
          },
        },
      );

    const candleSeries =
      chart.addSeries(
        CandlestickSeries,
        {
          upColor:
            CHART_COLORS.up,
          downColor:
            CHART_COLORS.down,
          borderUpColor:
            CHART_COLORS.up,
          borderDownColor:
            CHART_COLORS.down,
          wickUpColor:
            CHART_COLORS.up,
          wickDownColor:
            CHART_COLORS.down,
          priceLineVisible:
            showSeriesPriceLine,
          lastValueVisible:
            showSeriesPriceLine,
        },
      );

    const volumeSeries =
      chart.addSeries(
        HistogramSeries,
        {
          priceScaleId:
            'volume',
          priceFormat: {
            type:
              'volume',
          },
          priceLineVisible:
            false,
          lastValueVisible:
            false,
        },
      );

    chart
      .priceScale('volume')
      .applyOptions({
        scaleMargins: {
          top:
            0.8,
          bottom:
            0,
        },
      });

    chartRef.current =
      chart;

    candleSeriesRef.current =
      candleSeries;

    volumeSeriesRef.current =
      volumeSeries;

    setChartReadyVersion(
      (value) => value + 1,
    );

    const resizeObserver =
      new ResizeObserver(
        (entries) => {
          const entry =
            entries[0];

          if (!entry) {
            return;
          }

          const width =
            Math.floor(
              entry.contentRect.width,
            );

          const height =
            Math.floor(
              entry.contentRect.height,
            );

          if (
            width <= 0
            || height <= 0
          ) {
            return;
          }

          chart.resize(
            width,
            height,
          );
        },
      );

    resizeObserver.observe(
      container,
    );

    return () => {
      resizeObserver.disconnect();
      chart.remove();

      chartRef.current =
        null;

      candleSeriesRef.current =
        null;

      volumeSeriesRef.current =
        null;

      horizontalSegmentSeriesRef.current =
        [];
    };
  }, []);

  useEffect(() => {
    const candleSeries =
      candleSeriesRef.current;

    if (!candleSeries) {
      return;
    }

    candleSeries.applyOptions({
      priceFormat:
        chartPriceFormat,
    });
  }, [
    chartPriceFormat,
    chartReadyVersion,
  ]);

  useEffect(() => {
    const chart =
      chartRef.current;

    const candleSeries =
      candleSeriesRef.current;

    const volumeSeries =
      volumeSeriesRef.current;

    if (
      !chart
      || !candleSeries
      || !volumeSeries
    ) {
      return;
    }

    const timeScale =
      chart.timeScale();

    const previousRange =
      timeScale
        .getVisibleLogicalRange();

    const previousLength =
      previousDataLengthRef.current;

    const currentLength =
      chartData.candles.length;

    candleSeries.setData(
      chartData.candles,
    );

    volumeSeries.setData(
      chartData.volume,
    );

    if (currentLength > 0) {
      if (previousLength === 0) {
        const right =
          currentLength + 4;

        timeScale
          .setVisibleLogicalRange({
            from:
              Math.max(
                0,
                right - 160,
              ),
            to:
              right,
          });
      } else if (
        currentLength
          > previousLength
        && previousRange
      ) {
        const addedCount =
          currentLength
          - previousLength;

        timeScale
          .setVisibleLogicalRange({
            from:
              previousRange.from
              + addedCount,
            to:
              previousRange.to
              + addedCount,
          });
      }
    }

    previousDataLengthRef.current =
      currentLength;
  }, [chartData]);

  useEffect(() => {
    const chart =
      chartRef.current;

    if (!chart) {
      return;
    }

    const handleVisibleRangeChange = (
      range: LogicalRange | null,
    ) => {
      if (
        !range
        || range.from > 25
        || isLoadingOlderRef.current
        || !hasMoreRef.current
      ) {
        return;
      }

      onLoadOlderRef.current?.();
    };

    const timeScale =
      chart.timeScale();

    timeScale
      .subscribeVisibleLogicalRangeChange(
        handleVisibleRangeChange,
      );

    return () => {
      timeScale
        .unsubscribeVisibleLogicalRangeChange(
          handleVisibleRangeChange,
        );
    };
  }, [chartReadyVersion]);

  useEffect(() => {
    const chart =
      chartRef.current;

    if (!chart) {
      return;
    }

    const createdSeries =
      horizontalSegments
        .filter(
          (segment) =>
            Number.isFinite(
              segment.price,
            )
            && segment.price > 0
            && Number.isFinite(
              Date.parse(
                segment.startTime,
              ),
            ),
        )
        .map(
          (
            segment,
          ): NexusHorizontalSegmentSeries => {
            const series =
              chart.addSeries(
                LineSeries,
                {
                  color:
                    segment.color,

                  lineWidth:
                    segment.lineStyle
                    === 'solid'
                      ? 2
                      : 1,

                  lineStyle:
                    segment.lineStyle
                    === 'solid'
                      ? LineStyle.Solid
                      : LineStyle.Dashed,

                  priceLineVisible:
                    false,

                  lastValueVisible:
                    segment
                      .axisLabelVisible
                    ?? true,

                  crosshairMarkerVisible:
                    false,

                  title:
                    segment.title
                    ?? '',
                },
              );

            return {
              series,
              segment,
            };
          },
        );

    horizontalSegmentSeriesRef.current =
      createdSeries;

    return () => {
      if (chartRef.current === chart) {
        for (
          const entry
          of createdSeries
        ) {
          chart.removeSeries(
            entry.series,
          );
        }
      }

      horizontalSegmentSeriesRef.current =
        [];
    };
  }, [
    chartReadyVersion,
    horizontalSegments,
  ]);

  useEffect(() => {
    for (
      const entry
      of horizontalSegmentSeriesRef.current
    ) {
      entry.series.applyOptions({
        priceFormat:
          chartPriceFormat,
      });

      entry.series.setData(
        buildNexusHorizontalSegmentData(
          candles,
          entry.segment.startTime,
          entry.segment.price,
          entry.segment.endTime,
        ),
      );
    }
  }, [
    candles,
    chartPriceFormat,
    chartReadyVersion,
    horizontalSegments,
  ]);

  useEffect(() => {
    const candleSeries =
      candleSeriesRef.current;

    if (!candleSeries) {
      return;
    }

    const createdLines: IPriceLine[] =
      priceLines
        .filter(
          (line) =>
            Number.isFinite(line.price)
            && line.price > 0,
        )
        .map((line) =>
          candleSeries.createPriceLine({
            price: line.price,
            color: line.color,
            lineWidth:
              line.lineStyle === 'solid'
                ? 2
                : 1,
            lineStyle:
              line.lineStyle === 'solid'
                ? LineStyle.Solid
                : LineStyle.Dashed,
            axisLabelVisible:
              line.axisLabelVisible
              ?? true,
            title:
              line.title
              ?? '',
          }),
        );

    return () => {
      for (const line of createdLines) {
        candleSeries.removePriceLine(
          line,
        );
      }
    };
  }, [priceLines]);

  return (
    <div
      aria-busy={
        isLoadingOlder
      }
      className={[
        styles.root,
        fillContainer
          ? styles.fill
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        ref={containerRef}
        className={styles.chart}
        role="img"
        aria-label={`Свечной график ${symbol}`}
      />

      {enableDrawingTools
        ? (
          <NexusChartDrawingOverlay
            chartRef={chartRef}
            seriesRef={candleSeriesRef}
            readyVersion={
              chartReadyVersion
            }
            candles={candles}
            scope={drawingScope}
          />
        )
        : null}
    </div>
  );
}
