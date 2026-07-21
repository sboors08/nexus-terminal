import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePearsonCorrelation,
  calculateScannerBtcCorrelation,
  calculateScannerRelativeStrengthPct,
  type ScannerPriceSample,
} from '../src/modules/realtime-market-data/scanner-btc-comparison.js';

function samples(
  prices: readonly number[],
  startTimestampMs = 1_000,
  intervalMs = 1_000,
): ScannerPriceSample[] {
  return prices.map(
    (closePrice, index) => ({
      timestampMs:
        startTimestampMs
        + index * intervalMs,
      closePrice,
    }),
  );
}

test(
  'calculates perfect positive BTC correlation',
  () => {
    const btc = samples([
      100,
      110,
      104.5,
      125.4,
    ]);

    const symbol = samples([
      200,
      220,
      209,
      250.8,
    ]);

    const correlation =
      calculateScannerBtcCorrelation(
        symbol,
        btc,
      );

    assert.ok(correlation !== null);

    assert.ok(
      Math.abs(correlation - 1)
      < 1e-12,
    );
  },
);

test(
  'calculates perfect negative BTC correlation',
  () => {
    const btc = samples([
      100,
      110,
      104.5,
      125.4,
    ]);

    const symbol = samples([
      200,
      180,
      189,
      151.2,
    ]);

    const correlation =
      calculateScannerBtcCorrelation(
        symbol,
        btc,
      );

    assert.ok(correlation !== null);

    assert.ok(
      Math.abs(correlation + 1)
      < 1e-12,
    );
  },
);

test(
  'aligns symbol and BTC samples by timestamp',
  () => {
    const btc = [
      ...samples([
        100,
        110,
        104.5,
        125.4,
      ]),
      {
        timestampMs: 99_000,
        closePrice: 500,
      },
    ];

    const symbol = [
      {
        timestampMs: 500,
        closePrice: 190,
      },
      ...samples([
        200,
        220,
        209,
        250.8,
      ]),
    ];

    const correlation =
      calculateScannerBtcCorrelation(
        symbol,
        btc,
      );

    assert.ok(correlation !== null);

    assert.ok(
      Math.abs(correlation - 1)
      < 1e-12,
    );
  },
);

test(
  'returns null when aligned history is insufficient',
  () => {
    assert.equal(
      calculateScannerBtcCorrelation(
        samples([100, 101, 102]),
        samples([200, 201, 202]),
      ),
      null,
    );
  },
);

test(
  'returns null when either return series has no variance',
  () => {
    assert.equal(
      calculatePearsonCorrelation(
        [0.01, 0.01, 0.01],
        [0.02, -0.01, 0.03],
      ),
      null,
    );
  },
);

test(
  'calculates relative strength against BTC',
  () => {
    assert.equal(
      calculateScannerRelativeStrengthPct(
        5.5,
        2,
      ),
      3.5,
    );

    assert.equal(
      calculateScannerRelativeStrengthPct(
        null,
        2,
      ),
      null,
    );

    assert.equal(
      calculateScannerRelativeStrengthPct(
        5.5,
        null,
      ),
      null,
    );
  },
);