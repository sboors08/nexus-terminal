import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSetupCandidate,
} from '../src/modules/setup-engine/setup-candidate-factory.js';
import type {
  DetectedSetupLevel,
  SetupLevelKind,
} from '../src/modules/setup-engine/setup-level-detector.types.js';
import type {
  SetupDirection,
  SetupEngineSetupType,
} from '../src/modules/setup-engine/setup-engine.types.js';

const FIRST_TOUCH_AT =
  '2026-07-26T12:00:00.000Z';

const CONFIRMED_AT =
  '2026-07-26T12:05:00.000Z';

function buildLevel(
  kind: SetupLevelKind,
): DetectedSetupLevel {
  return {
    id:
      `SOLUSDT-5m-${kind}-1753531200000`,
    symbol: 'SOLUSDT',
    timeframe: '5m',
    kind,
    zoneLow: 99.8,
    zoneHigh: 100.2,
    centerPrice: 100,
    touchesCount: 2,
    firstTouchAt:
      FIRST_TOUCH_AT,
    lastTouchAt:
      CONFIRMED_AT,
    formedAt:
      CONFIRMED_AT,
    confirmedAt:
      CONFIRMED_AT,
    formationDurationSec: 300,
    touches: [
      {
        candleIndex: 2,
        price: 100,
        occurredAt:
          FIRST_TOUCH_AT,
      },
      {
        candleIndex: 8,
        price: 100.1,
        occurredAt:
          CONFIRMED_AT,
      },
    ],
  };
}

const directionCases:
  readonly {
    kind: SetupLevelKind;
    setupType:
      SetupEngineSetupType;
    direction:
      SetupDirection;
  }[] = [
    {
      kind: 'resistance',
      setupType:
        'level_breakout',
      direction: 'long',
    },
    {
      kind: 'resistance',
      setupType:
        'level_bounce',
      direction: 'short',
    },
    {
      kind: 'support',
      setupType:
        'level_breakout',
      direction: 'short',
    },
    {
      kind: 'support',
      setupType:
        'level_bounce',
      direction: 'long',
    },
  ];

for (const item of directionCases) {
  test(
    `creates ${item.direction} ${item.setupType} candidate from ${item.kind}`,
    () => {
      const level =
        buildLevel(item.kind);

      const currentPrice =
        item.kind === 'resistance'
          ? 99
          : 101;

      const candidate =
        createSetupCandidate(
          level,
          item.setupType,
          currentPrice,
        );

      assert.equal(
        candidate.id,
        `setup-${level.id}-${item.setupType}`,
      );

      assert.equal(
        candidate.setupType,
        item.setupType,
      );

      assert.equal(
        candidate.direction,
        item.direction,
      );

      assert.equal(
        candidate.stage,
        'LEVEL_CONFIRMED',
      );

      assert.equal(
        candidate.outcome,
        null,
      );

      assert.equal(
        candidate.level.kind,
        item.kind,
      );

      assert.equal(
        candidate.level.touches,
        2,
      );

      assert.equal(
        candidate.distanceToLevelPct,
        1,
      );

      assert.equal(
        candidate.createdAt,
        CONFIRMED_AT,
      );

      assert.equal(
        candidate.updatedAt,
        CONFIRMED_AT,
      );

      assert.equal(
        candidate.expiresAt,
        '2026-07-26T13:05:00.000Z',
      );
    },
  );
}

test(
  'supports a custom candidate lifetime',
  () => {
    const candidate =
      createSetupCandidate(
        buildLevel(
          'resistance',
        ),
        'level_breakout',
        99,
        {
          expiresAfterSec: 900,
        },
      );

    assert.equal(
      candidate.expiresAt,
      '2026-07-26T12:20:00.000Z',
    );
  },
);

test(
  'rejects a level whose center is outside its zone',
  () => {
    const level = {
      ...buildLevel(
        'support',
      ),
      centerPrice: 101,
    };

    assert.throws(
      () =>
        createSetupCandidate(
          level,
          'level_bounce',
          101,
        ),
      /center must be inside/,
    );
  },
);

test(
  'rejects mismatched level touch counts',
  () => {
    const level = {
      ...buildLevel(
        'resistance',
      ),
      touchesCount: 3,
    };

    assert.throws(
      () =>
        createSetupCandidate(
          level,
          'level_breakout',
          99,
        ),
      /touch count does not match/,
    );
  },
);

test(
  'rejects an invalid candidate lifetime',
  () => {
    assert.throws(
      () =>
        createSetupCandidate(
          buildLevel(
            'support',
          ),
          'level_bounce',
          101,
          {
            expiresAfterSec: 0,
          },
        ),
      /expiration must be a positive integer/,
    );
  },
);
