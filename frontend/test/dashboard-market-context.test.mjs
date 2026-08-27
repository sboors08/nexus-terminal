import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  formatDashboardMarketChange,
  resolveDashboardMarketContext,
} from '../node_modules/.tmp/realtime-test/realtime/dashboardMarketContext.js';

function metric(priceChangePct) {
  return {
    symbol: 'BTCUSDT',
    priceChangePct,
    updatedAt: '2026-08-27T15:31:53.415Z',
  };
}

function rows(
  positiveCount,
  totalCount,
  volatilityPct = 1,
) {
  return Array.from(
    { length: totalCount },
    (_, index) => ({
      view: {
        isLive: true,
        priceChangePct:
          index < positiveCount
            ? 1
            : -1,
        volatilityPct,
      },
    }),
  );
}

test(
  'uses stable market-wide BTC movement for bullish context',
  () => {
    const context =
      resolveDashboardMarketContext({
        btcMetric: metric(1),
        rows: rows(8, 10),
        activityPeriod: '5M',
        scannerStatus: 'ready',
      });

    assert.equal(context.dataState, 'ready');
    assert.equal(context.mode, 'bullish');
    assert.equal(context.btcChangePct, 1);
    assert.equal(context.marketBreadthPct, 80);
    assert.equal(
      context.risk,
      'ПОКУПАТЕЛИ СИЛЬНЕЕ',
    );
    assert.equal(context.sentiment.value, 75);
    assert.equal(
      context.sentiment.label,
      'ЖАДНОСТЬ',
    );
  },
);
test(
  'builds bearish NEXUS sentiment from BTC and market breadth',
  () => {
    const context =
      resolveDashboardMarketContext({
        btcMetric: metric(-1),
        rows: rows(2, 10),
        activityPeriod: '5M',
        scannerStatus: 'ready',
      });

    assert.equal(context.mode, 'bearish');
    assert.equal(context.marketBreadthPct, 20);
    assert.equal(
      context.risk,
      'ПРОДАВЦЫ СИЛЬНЕЕ',
    );
    assert.equal(context.sentiment.value, 26);
    assert.equal(context.sentiment.label, 'СТРАХ');
  },
);

test(
  'keeps mixed market conditions neutral',
  () => {
    const context =
      resolveDashboardMarketContext({
        btcMetric: metric(0.1),
        rows: rows(5, 10),
        activityPeriod: '5M',
        scannerStatus: 'ready',
      });

    assert.equal(context.mode, 'neutral');
    assert.equal(
      context.risk,
      'БАЛАНС СИЛ',
    );
    assert.equal(context.sentiment.value, 51);
    assert.equal(
      context.sentiment.label,
      'НЕЙТРАЛЬНО',
    );
  },
);

test(
  'distinguishes collecting history from a request error',
  () => {
    const collecting =
      resolveDashboardMarketContext({
        btcMetric: undefined,
        rows: [],
        activityPeriod: '1M',
        scannerStatus: 'loading',
      });

    const failed =
      resolveDashboardMarketContext({
        btcMetric: undefined,
        rows: [],
        activityPeriod: '1M',
        scannerStatus: 'error',
      });

    assert.equal(
      collecting.dataState,
      'collecting',
    );
    assert.equal(
      collecting.trend,
      'НЕДОСТАТОЧНО ИСТОРИИ',
    );
    assert.equal(
      collecting.risk,
      'СБОР ДАННЫХ',
    );
    assert.equal(failed.dataState, 'error');
    assert.equal(failed.title, 'ОШИБКА ДАННЫХ');
    assert.equal(
      failed.risk,
      'НЕТ ДАННЫХ',
    );
  },
);

test(
  'formats stable market-wide BTC change',
  () => {
    assert.equal(
      formatDashboardMarketChange(
        -0.116722772,
      ),
      '-0.12%',
    );
    assert.equal(
      formatDashboardMarketChange(
        0.842583,
      ),
      '+0.84%',
    );
    assert.equal(
      formatDashboardMarketChange(null),
      '—',
    );
  },
);

test(
  'Dashboard uses Market Context without a hardcoded sentiment placeholder',
  () => {
    const dashboardSource =
      fs
        .readFileSync(
          new URL(
            '../src/pages/DashboardPage.tsx',
            import.meta.url,
          ),
          'utf8',
        )
        .replace(/\r\n/gu, '\n');

    assert.match(
      dashboardSource,
      /resolveDashboardMarketContext/u,
    );
    assert.match(
      dashboardSource,
      /scannerMetrics\s*\.metrics\s*\.BTCUSDT/u,
    );
    assert.match(
      dashboardSource,
      /NEXUS FEAR &amp; GREED/u,
    );
    assert.match(
      dashboardSource,
      /neutral-market\.png/u,
    );
    assert.match(
      dashboardSource,
      /context\.mode === 'neutral'/u,
    );
    assert.match(
      dashboardSource,
      /collecting-market\.png/u,
    );
    assert.match(
      dashboardSource,
      /context\.mode === 'collecting'/u,
    );
    assert.match(
      dashboardSource,
      /Сбор рыночных данных/u,
    );
    assert.doesNotMatch(
      dashboardSource,
      /<FearGreed\s+value=\{null\}/u,
    );
    assert.doesNotMatch(
      dashboardSource,
      /resolveMarketMode\(\s*btcRealtime\.changePct/u,
    );
  },
);
