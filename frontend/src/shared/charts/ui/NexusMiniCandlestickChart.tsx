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
  createChart,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';

import type {
  Candle,
} from '../../api/contracts.js';
import {
  fetchMarketCandles,
  type MarketCandleTimeframe,
} from '../api/marketCandles.js';
import {
  mapCandleChartData,
} from '../model/candleMapping.js';
import styles from './NexusMiniCandlestickChart.module.css';

const MINI_CANDLE_LIMIT =
  150;

const MINI_CHART_COLORS = {
  background:
    '#070e12',
  text:
    '#72837d',
  grid:
    '#17231f',
  up:
    '#32d583',
  down:
    '#ff6273',
} as const;

export interface NexusMiniCandlestickChartProps {
  symbol: string;
  timeframe: MarketCandleTimeframe;
}

export function NexusMiniCandlestickChart({
  symbol,
  timeframe,
}: NexusMiniCandlestickChartProps) {
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
    >(
      null,
    );

  const [
    candles,
    setCandles,
  ] = useState<Candle[]>([]);

  const [
    status,
    setStatus,
  ] = useState<
    | 'loading'
    | 'success'
    | 'error'
  >('loading');

  const chartData =
    useMemo(
      () =>
        mapCandleChartData(
          candles,
          {
            up:
              MINI_CHART_COLORS.up,
            down:
              MINI_CHART_COLORS.down,
          },
        ).candles,
      [
        candles,
      ],
    );

  useEffect(
    () => {
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
              container.clientWidth
              || 320,
            height:
              container.clientHeight
              || 220,
            layout: {
              background: {
                type:
                  ColorType.Solid,
                color:
                  MINI_CHART_COLORS.background,
              },
              textColor:
                MINI_CHART_COLORS.text,
              attributionLogo:
                false,
            },
            grid: {
              vertLines: {
                color:
                  MINI_CHART_COLORS.grid,
              },
              horzLines: {
                color:
                  MINI_CHART_COLORS.grid,
              },
            },
            crosshair: {
              mode:
                CrosshairMode.Normal,
            },
            rightPriceScale: {
              borderVisible:
                false,
              scaleMargins: {
                top:
                  0.08,
                bottom:
                  0.08,
              },
            },
            timeScale: {
              borderVisible:
                false,
              timeVisible:
                true,
              secondsVisible:
                false,
              rightOffset:
                2,
              barSpacing:
                5,
              minBarSpacing:
                2,
            },
            handleScroll:
              false,
            handleScale:
              false,
          },
        );

      const candleSeries =
        chart.addSeries(
          CandlestickSeries,
          {
            upColor:
              MINI_CHART_COLORS.up,
            downColor:
              MINI_CHART_COLORS.down,
            borderUpColor:
              MINI_CHART_COLORS.up,
            borderDownColor:
              MINI_CHART_COLORS.down,
            wickUpColor:
              MINI_CHART_COLORS.up,
            wickDownColor:
              MINI_CHART_COLORS.down,
            priceLineVisible:
              false,
            lastValueVisible:
              true,
          },
        );

      chartRef.current =
        chart;

      candleSeriesRef.current =
        candleSeries;

      const resizeObserver =
        typeof ResizeObserver
        === 'undefined'
          ? null
          : new ResizeObserver(
              (entries) => {
                const entry =
                  entries[0];

                if (!entry) {
                  return;
                }

                const width =
                  Math.floor(
                    entry
                      .contentRect
                      .width,
                  );

                const height =
                  Math.floor(
                    entry
                      .contentRect
                      .height,
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

      resizeObserver
        ?.observe(
          container,
        );

      return () => {
        resizeObserver
          ?.disconnect();

        chart.remove();

        chartRef.current =
          null;

        candleSeriesRef.current =
          null;
      };
    },
    [],
  );

  useEffect(
    () => {
      const controller =
        new AbortController();

      setStatus(
        'loading',
      );

      fetchMarketCandles({
        symbol,
        timeframe,
        limit:
          MINI_CANDLE_LIMIT,
        signal:
          controller.signal,
      })
        .then(
          (nextCandles) => {
            if (
              controller
                .signal
                .aborted
            ) {
              return;
            }

            setCandles(
              nextCandles,
            );

            setStatus(
              'success',
            );
          },
        )
        .catch(
          () => {
            if (
              controller
                .signal
                .aborted
            ) {
              return;
            }

            setCandles([]);

            setStatus(
              'error',
            );
          },
        );

      return () => {
        controller.abort();
      };
    },
    [
      symbol,
      timeframe,
    ],
  );

  useEffect(
    () => {
      const candleSeries =
        candleSeriesRef.current;

      const chart =
        chartRef.current;

      if (
        !candleSeries
        || !chart
      ) {
        return;
      }

      candleSeries.setData(
        chartData,
      );

      if (
        chartData.length > 0
      ) {
        chart
          .timeScale()
          .fitContent();
      }
    },
    [
      chartData,
    ],
  );

  return (
    <div
      className={
        styles.root
      }
    >
      <div
        ref={
          containerRef
        }
        className={
          styles.chart
        }
        aria-label={
          `Мини-график ${symbol} ${timeframe}`
        }
      />

      {
        status
        !== 'success'
          ? (
              <div
                className={
                  styles.status
                }
              >
                {
                  status
                  === 'loading'
                    ? 'Загрузка свечей…'
                    : 'Свечи недоступны'
                }
              </div>
            )
          : null
      }
    </div>
  );
}
