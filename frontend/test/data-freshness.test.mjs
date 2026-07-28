import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyDataError,
  formatDataFreshnessAge,
  resolveDataFreshness,
} from '../node_modules/.tmp/realtime-test/realtime/dataFreshness.js';

const now =
  Date.parse(
    '2026-07-28T18:00:30.000Z',
  );

test(
  'marks recent data from an open source as LIVE',
  () => {
    const freshness =
      resolveDataFreshness({
        hasData:
          true,
        sourceState:
          'open',
        updatedAt:
          '2026-07-28T18:00:25.000Z',
        error:
          null,
        staleAfterMs:
          15_000,
        now,
      });

    assert.equal(
      freshness.state,
      'live',
    );

    assert.equal(
      freshness.label,
      'LIVE',
    );

    assert.equal(
      freshness.tone,
      'live',
    );
  },
);

test(
  'marks a source without initial data as COLLECTING',
  () => {
    const freshness =
      resolveDataFreshness({
        hasData:
          false,
        sourceState:
          'connecting',
        updatedAt:
          null,
        error:
          null,
        staleAfterMs:
          15_000,
        now,
      });

    assert.equal(
      freshness.state,
      'collecting',
    );

    assert.equal(
      freshness.label,
      'COLLECTING',
    );
  },
);

test(
  'keeps cached data visible as STALE when the source fails',
  () => {
    const freshness =
      resolveDataFreshness({
        hasData:
          true,
        sourceState:
          'error',
        updatedAt:
          '2026-07-28T18:00:20.000Z',
        error:
          new TypeError(
            'Failed to fetch',
          ),
        staleAfterMs:
          15_000,
        now,
      });

    assert.equal(
      freshness.state,
      'stale',
    );

    assert.equal(
      freshness.hasData,
      true,
    );

    assert.equal(
      freshness.errorKind,
      'network',
    );
  },
);

test(
  'uses ERROR when loading fails without cached data',
  () => {
    const freshness =
      resolveDataFreshness({
        hasData:
          false,
        sourceState:
          'error',
        updatedAt:
          null,
        error:
          new Error(
            '500 server error',
          ),
        staleAfterMs:
          15_000,
        now,
      });

    assert.equal(
      freshness.state,
      'error',
    );

    assert.equal(
      freshness.errorKind,
      'server',
    );
  },
);

test(
  'uses OFFLINE when no data and no source connection exist',
  () => {
    const freshness =
      resolveDataFreshness({
        hasData:
          false,
        sourceState:
          'offline',
        updatedAt:
          null,
        error:
          null,
        staleAfterMs:
          15_000,
        now,
      });

    assert.equal(
      freshness.state,
      'offline',
    );

    assert.equal(
      freshness.label,
      'OFFLINE',
    );
  },
);

test(
  'marks old data as STALE even while the connection is open',
  () => {
    const freshness =
      resolveDataFreshness({
        hasData:
          true,
        sourceState:
          'open',
        updatedAt:
          '2026-07-28T17:59:30.000Z',
        error:
          null,
        staleAfterMs:
          15_000,
        now,
      });

    assert.equal(
      freshness.state,
      'stale',
    );

    assert.equal(
      freshness.ageMs,
      60_000,
    );
  },
);

test(
  'does not claim LIVE when the update timestamp is unknown',
  () => {
    const freshness =
      resolveDataFreshness({
        hasData:
          true,
        sourceState:
          'open',
        updatedAt:
          null,
        error:
          null,
        staleAfterMs:
          15_000,
        now,
      });

    assert.equal(
      freshness.state,
      'stale',
    );

    assert.equal(
      freshness.lastUpdatedLabel,
      'время обновления неизвестно',
    );
  },
);

test(
  'classifies timeout, rate-limit and invalid payload errors',
  () => {
    assert.equal(
      classifyDataError(
        new Error(
          'Request timeout',
        ),
      ),
      'timeout',
    );

    assert.equal(
      classifyDataError({
        status:
          429,
        message:
          'Too many requests',
      }),
      'rate-limit',
    );

    assert.equal(
      classifyDataError(
        new Error(
          'Invalid JSON payload',
        ),
      ),
      'invalid-data',
    );
  },
);

test(
  'formats freshness age for seconds, minutes and hours',
  () => {
    assert.equal(
      formatDataFreshnessAge(
        4_000,
      ),
      'обновлено только что',
    );

    assert.equal(
      formatDataFreshnessAge(
        12_000,
      ),
      'обновлено 12 сек. назад',
    );

    assert.equal(
      formatDataFreshnessAge(
        120_000,
      ),
      'обновлено 2 мин. назад',
    );

    assert.equal(
      formatDataFreshnessAge(
        7_200_000,
      ),
      'обновлено 2 ч назад',
    );
  },
);
