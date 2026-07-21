import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countActiveScannerFilters,
  createDefaultScannerFilterState,
  filterAndSortScannerRows,
  hasActiveScannerFilters,
} from '../node_modules/.tmp/realtime-test/realtime/scannerFilters.js';

const rows = [
  {
    id: 'sol',
    view: {
      symbol: 'SOLUSDT',
      isLive: true,
      activityScore: 90,
      quoteVolumeValue: 100_000,
      tradesCountValue: 500,
      tradesPerMinuteValue: 500,
      volatilityPct: 0.2,
      liquidityScore: 8,
      btcCorrelation: 0.8,
      relativeStrengthPct: 0.1,
    },
  },
  {
    id: 'eth',
    view: {
      symbol: 'ETHUSDT',
      isLive: true,
      activityScore: 80,
      quoteVolumeValue: 200_000,
      tradesCountValue: 600,
      tradesPerMinuteValue: 600,
      volatilityPct: 0.3,
      liquidityScore: 7,
      btcCorrelation: 0.9,
      relativeStrengthPct: -0.2,
    },
  },
  {
    id: 'doge',
    view: {
      symbol: 'DOGEUSDT',
      isLive: false,
      activityScore: 95,
      quoteVolumeValue: null,
      tradesCountValue: null,
      tradesPerMinuteValue: null,
      volatilityPct: null,
      liquidityScore: 5,
      btcCorrelation: null,
      relativeStrengthPct: null,
    },
  },
];

test(
  'uses activity descending as the default Scanner order',
  () => {
    const result =
      filterAndSortScannerRows(
        rows,
        createDefaultScannerFilterState(),
      );

    assert.deepEqual(
      result.map(({ id }) => id),
      ['doge', 'sol', 'eth'],
    );
  },
);

test(
  'filters Scanner rows by search and live state',
  () => {
    const state =
      createDefaultScannerFilterState();

    state.query = 'sol/usdt';
    state.onlyLive = true;

    const result =
      filterAndSortScannerRows(
        rows,
        state,
      );

    assert.deepEqual(
      result.map(({ id }) => id),
      ['sol'],
    );
  },
);

test(
  'applies minimum Scanner metric thresholds',
  () => {
    const state =
      createDefaultScannerFilterState();

    state.minActivityScore = 85;
    state.minQuoteVolume = 50_000;
    state.minLiquidityScore = 8;
    state.minBtcCorrelation = 0.75;
    state.minRelativeStrengthPct = 0;

    const result =
      filterAndSortScannerRows(
        rows,
        state,
      );

    assert.deepEqual(
      result.map(({ id }) => id),
      ['sol'],
    );
  },
);

test(
  'keeps missing metrics last while sorting',
  () => {
    const state =
      createDefaultScannerFilterState();

    state.sortBy = 'relativeStrength';
    state.sortDirection = 'asc';

    const result =
      filterAndSortScannerRows(
        rows,
        state,
      );

    assert.deepEqual(
      result.map(({ id }) => id),
      ['eth', 'sol', 'doge'],
    );
  },
);

test(
  'counts active Scanner filters without counting sorting',
  () => {
    const state =
      createDefaultScannerFilterState();

    assert.equal(
      countActiveScannerFilters(state),
      0,
    );

    assert.equal(
      hasActiveScannerFilters(state),
      false,
    );

    state.query = 'SOL';
    state.onlyLive = true;
    state.minActivityScore = 70;
    state.sortBy = 'quoteVolume';

    assert.equal(
      countActiveScannerFilters(state),
      3,
    );

    assert.equal(
      hasActiveScannerFilters(state),
      true,
    );
  },
);