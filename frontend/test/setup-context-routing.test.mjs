import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCanonicalWorkspaceSearchParams,
  buildMarketWorkspaceSetupId,
  buildMarketWorkspaceUrl,
  isMarketWorkspaceSetupId,
  isWorkspaceTimeframe,
  resolveWorkspaceViewRequest,
} from '../node_modules/.tmp/realtime-test/routing/setupContext.js';

test(
  'builds a synthetic Market Workspace setup id',
  () => {
    assert.equal(
      buildMarketWorkspaceSetupId(
        'SOLUSDT',
      ),
      'market-solusdt',
    );
  },
);

test(
  'normalizes slash-separated symbols',
  () => {
    assert.equal(
      buildMarketWorkspaceSetupId(
        ' bank/usdt ',
      ),
      'market-bankusdt',
    );
  },
);

test(
  'identifies Market Workspace ids',
  () => {
    assert.equal(
      isMarketWorkspaceSetupId(
        'market-bankusdt',
      ),
      true,
    );

    assert.equal(
      isMarketWorkspaceSetupId(
        'runtime-candidate-1',
      ),
      false,
    );
  },
);

test(
  'builds a complete Market Workspace URL',
  () => {
    assert.equal(
      buildMarketWorkspaceUrl(
        '/app/workspace',
        'BANKUSDT',
        '1m',
      ),
      '/app/workspace?setupId=market-bankusdt&symbol=BANKUSDT&timeframe=1m',
    );
  },
);

test(
  'rejects an empty Market Workspace symbol',
  () => {
    assert.throws(
      () =>
        buildMarketWorkspaceSetupId(
          '   ',
        ),
      /Market workspace symbol is required/,
    );
  },
);

test(
  'preserves a synthetic Market setup id when resolving Workspace data',
  () => {
    assert.deepEqual(
      resolveWorkspaceViewRequest(
        'market-btcusdt',
        'btc/usdt',
      ),
      {
        setupId:
          'market-btcusdt',
        symbol:
          'BTCUSDT',
      },
    );
  },
);

test(
  'keeps Market Workspace search params separate from Scanner context',
  () => {
    const current =
      new URLSearchParams(
        'setup=legacy&preset=scalping&scannerWindow=1m',
      );

    const result =
      buildCanonicalWorkspaceSearchParams(
        current,
        {
          setupId:
            'market-btcusdt',
          symbol:
            'BTCUSDT',
          preset:
            'scalping',
          scannerWindow:
            '1m',
          timeframe:
            '1h',
        },
      );

    assert.equal(
      result.toString(),
      'setupId=market-btcusdt&symbol=BTCUSDT&timeframe=1h',
    );
  },
);

test(
  'preserves Scanner context for a runtime setup',
  () => {
    const result =
      buildCanonicalWorkspaceSearchParams(
        new URLSearchParams(),
        {
          setupId:
            'setup-BTCUSDT-runtime',
          symbol:
            'BTCUSDT',
          preset:
            'scalping',
          scannerWindow:
            '1m',
          timeframe:
            '5m',
        },
      );

    assert.equal(
      result.toString(),
      'setupId=setup-BTCUSDT-runtime&symbol=BTCUSDT&preset=scalping&scannerWindow=1m&timeframe=5m',
    );
  },
);

test(
  'accepts every timeframe offered by Market',
  () => {
    for (
      const timeframe of
        ['1m', '5m', '15m', '1h', '4h', '1d']
    ) {
      assert.equal(
        isWorkspaceTimeframe(
          timeframe,
        ),
        true,
      );
    }

    assert.equal(
      isWorkspaceTimeframe(
        '30m',
      ),
      false,
    );
  },
);
