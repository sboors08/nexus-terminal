import {
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';

import type {
  Candle,
} from '../../api/contracts.js';
import {
  mapCandleChartData,
} from '../model/candleMapping.js';
import styles from './NexusCandlestickChart.module.css';

const CHART_COLORS = {
  background: '#070e12',
  text: '#72837d',
  grid: '#17231f',
  border: '#263833',
  up: '#32d583',
  down: '#ff6273',
  volumeUp: 'rgba(50, 213, 131, 0.25)',
  volumeDown: 'rgba(255, 98, 115, 0.25)',
} as const;

export interface NexusCandlestickChartProps {
  candles: readonly Candle[];
  symbol: string;
}

export function NexusCandlestickChart({
  candles,
  symbol,
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
              true,
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
          },
          rightPriceScale: {
            borderColor:
              CHART_COLORS.border,
          },
          timeScale: {
            borderColor:
              CHART_COLORS.border,
            timeVisible:
              true,
            secondsVisible:
              false,
            rightOffset:
              4,
            barSpacing:
              8,
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
            true,
          lastValueVisible:
            true,
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
    };
  }, []);

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

    candleSeries.setData(
      chartData.candles,
    );

    volumeSeries.setData(
      chartData.volume,
    );

    if (
      chartData.candles.length
      > 0
    ) {
      chart
        .timeScale()
        .fitContent();
    }
  }, [chartData]);

  return (
    <div
      ref={containerRef}
      className={styles.chart}
      role="img"
      aria-label={`Свечной график ${symbol}`}
    />
  );
}