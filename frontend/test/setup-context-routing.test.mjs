import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMarketWorkspaceSetupId,
  buildMarketWorkspaceUrl,
  isMarketWorkspaceSetupId,
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
