import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MarketWideOneMinuteMetricsStore,
  type BinanceOneMinuteKlineUpdate,
} from '../src/modules/realtime-market-data/market-wide-one-minute-metrics.js';

const START_TIME_MS =
  Date.parse('2026-07-23T00:00:00.000Z');

function buildKline(
  symbol: string,
  minuteIndex: number,
  quoteVolume: number,
  tradesCount: number,
  close = 100,
): BinanceOneMinuteKlineUpdate {
  const openTimeMs =
    START_TIME_MS
    + minuteIndex * 60_000;

  return {
    symbol,
    eventTime:
      new Date(
        openTimeMs + 59_999,
      ).toISOString(),
    openTime:
      new Date(
        openTimeMs,
      ).toISOString(),
    closeTime:
      new Date(
        openTimeMs + 59_999,
      ).toISOString(),
    open: 100,
    high:
      Math.max(
        100,
        close,
      ),
    low:
      Math.min(
        100,
        close,
      ),
    close,
    quoteVolume,
    tradesCount,
    takerBuyQuoteVolume:
      quoteVolume * 0.55,
    isClosed: true,
  };
}

test(
  'detects a volume spike from retained market-wide klines',
  () => {
    const store =
      new MarketWideOneMinuteMetricsStore([
        'SOLUSDT',
      ]);

    for (
      let minuteIndex = 0;
      minuteIndex < 70;
      minuteIndex += 1
    ) {
      const isCurrentPeriod =
        minuteIndex >= 65;

      const isLastMinute =
        minuteIndex === 69;

      assert.equal(
        store.applyKline(
          buildKline(
            'SOLUSDT',
            minuteIndex,
            isCurrentPeriod
              ? 50_000
              : 20_000,
            isCurrentPeriod
              ? 40
              : 20,
            isLastMinute
              ? 102
              : 100,
          ),
        ),
        true,
      );
    }

    const spikes =
      store.getVolumeSpikes(
        'SOLUSDT',
      );

    assert.equal(
      spikes.length,
      1,
    );

    const spike =
      spikes[0];

    assert.ok(spike);

    assert.equal(
      spike.symbol,
      'SOLUSDT',
    );

    assert.equal(
      spike.status,
      'new',
    );

    assert.equal(
      spike.currentQuoteVolume,
      250_000,
    );

    assert.equal(
      spike.baselineQuoteVolume,
      100_000,
    );

    assert.equal(
      spike.volumeRatio,
      2.5,
    );

    assert.equal(
      spike.tradesRatio,
      2,
    );

    assert.equal(
      spike.priceChangePct,
      2,
    );
  },
);
