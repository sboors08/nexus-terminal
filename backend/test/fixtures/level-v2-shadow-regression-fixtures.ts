import type {
  BinanceOneMinuteKlineUpdate,
} from '../../src/modules/realtime-market-data/market-wide-one-minute-metrics.js';

const BASE_TIME =
  Date.parse(
    '2026-07-29T12:00:00.000Z',
  );

function candle(
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
  isClosed = true,
  symbol = 'SOLUSDT',
): BinanceOneMinuteKlineUpdate {
  const openTime =
    BASE_TIME
    + index * 60_000;

  const closeTime =
    openTime
    + 59_999;

  return {
    symbol,
    eventTime:
      new Date(
        closeTime,
      ).toISOString(),
    openTime:
      new Date(
        openTime,
      ).toISOString(),
    closeTime:
      new Date(
        closeTime,
      ).toISOString(),
    open,
    high,
    low,
    close,
    quoteVolume:
      10_000 + index,
    tradesCount:
      100 + index,
    takerBuyQuoteVolume:
      5_000,
    isClosed,
  };
}

const cleanResistance = [
  candle(0, 95, 97, 94, 96),
  candle(1, 96, 100, 95, 98),
  candle(2, 98, 99, 94, 95),
  candle(3, 95, 97, 93, 96),
  candle(4, 96, 100.1, 95, 98),
  candle(5, 98, 99, 93, 95),
  candle(6, 95, 97, 92, 96),
  candle(7, 96, 100.05, 95, 98),
  candle(8, 98, 99, 92, 94),
  candle(9, 94, 97, 93, 96),
];

const cleanSupport = [
  candle(0, 105, 106, 103, 104),
  candle(1, 104, 105, 100, 102),
  candle(2, 102, 106, 101, 105),
  candle(3, 105, 107, 103, 104),
  candle(4, 104, 105, 99.9, 102),
  candle(5, 102, 107, 101, 105),
  candle(6, 105, 108, 103, 104),
  candle(7, 104, 105, 99.95, 102),
  candle(8, 102, 108, 101, 106),
  candle(9, 106, 107, 103, 104),
];

export const LEVEL_V2_SHADOW_REGRESSION_FIXTURES = {
  cleanResistance,
  cleanSupport,
  openCandleTail: [
    ...cleanResistance,
    candle(
      10,
      96,
      110,
      95,
      109,
      false,
    ),
  ],
  wickFalseBreak: [
    ...cleanResistance,
    candle(
      10,
      96,
      102,
      95,
      99,
    ),
    candle(
      11,
      99,
      100,
      94,
      96,
    ),
  ],
  confirmedBreak: [
    ...cleanResistance,
    candle(
      10,
      96,
      101.5,
      95,
      101,
    ),
    candle(
      11,
      101,
      102.5,
      100.5,
      102,
    ),
  ],
} as const;
