import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveNexusChartPriceFormat,
} from '../node_modules/.tmp/realtime-test/charts/model/priceFormat.js';

test(
  'uses standard precision for regular prices',
  () => {
    assert.deepEqual(
      resolveNexusChartPriceFormat([
        187.42,
        188.1,
      ]),
      {
        type:
          'price',

        precision:
          2,

        minMove:
          0.01,
      },
    );
  },
);

test(
  'preserves micro-price precision',
  () => {
    assert.deepEqual(
      resolveNexusChartPriceFormat([
        0.00045927,
        0.0004598,
        0.00046003,
      ]),
      {
        type:
          'price',

        precision:
          8,

        minMove:
          0.00000001,
      },
    );
  },
);

test(
  'ignores floating-point tails on large BTC prices',
  () => {
    assert.deepEqual(
      resolveNexusChartPriceFormat([
        78028.2,
        78028.199999999997,
        79492.8,
        77626.9,
      ]),
      {
        type:
          'price',

        precision:
          2,

        minMove:
          0.01,
      },
    );
  },
);

test(
  'ignores invalid price values',
  () => {
    assert.deepEqual(
      resolveNexusChartPriceFormat([
        0,
        Number.NaN,
        Number.POSITIVE_INFINITY,
      ]),
      {
        type:
          'price',

        precision:
          2,

        minMove:
          0.01,
      },
    );
  },
);
