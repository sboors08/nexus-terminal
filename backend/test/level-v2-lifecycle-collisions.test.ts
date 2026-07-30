import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveLevelV2LifecycleCollisions,
} from '../src/modules/setup-engine/level-v2/level-v2-lifecycle-collisions.js';
import type {
  LevelV2LifecycleCollisionState,
} from '../src/modules/setup-engine/level-v2/level-v2-lifecycle-collisions.js';
import type {
  LevelV2Kind,
} from '../src/modules/setup-engine/level-v2/level-v2-zones-score.types.js';

interface TestStateValues {
  id: string;
  originalKind: LevelV2Kind;
  currentKind: LevelV2Kind;
  status?: LevelV2LifecycleCollisionState['status'];
  eligible?: boolean;
  referencePrice: number;
  outerLow: number;
  outerHigh: number;
  score?: number;
  touches?: number;
  lastTouch?: number;
}

function state(
  values: TestStateValues,
): LevelV2LifecycleCollisionState {
  return {
    originalKind: values.originalKind,
    currentKind: values.currentKind,
    status: values.status ?? 'active',
    eligibleForSetups: values.eligible ?? true,
    level: {
      id: values.id,
      touchesCount: values.touches ?? 3,
      lastTouchCandleIndex: values.lastTouch ?? 100,
      score: {
        total: values.score ?? 80,
      },
      zone: {
        referencePrice: values.referencePrice,
        outerLow: values.outerLow,
        outerHigh: values.outerHigh,
      },
    },
  };
}

test(
  'keeps overlapping native levels because proximity alone is not a duplicate',
  () => {
    const result = resolveLevelV2LifecycleCollisions([
      state({
        id: 'native-a',
        originalKind: 'resistance',
        currentKind: 'resistance',
        referencePrice: 100,
        outerLow: 99.9,
        outerHigh: 100.1,
      }),
      state({
        id: 'native-b',
        originalKind: 'resistance',
        currentKind: 'resistance',
        referencePrice: 100.02,
        outerLow: 99.95,
        outerHigh: 100.15,
      }),
    ]);

    assert.equal(result.length, 2);
  },
);

test(
  'keeps non-overlapping native and flipped levels',
  () => {
    const result = resolveLevelV2LifecycleCollisions([
      state({
        id: 'native',
        originalKind: 'resistance',
        currentKind: 'resistance',
        referencePrice: 100,
        outerLow: 99.9,
        outerHigh: 100.1,
      }),
      state({
        id: 'flipped',
        originalKind: 'support',
        currentKind: 'resistance',
        status: 'flipped',
        referencePrice: 100.5,
        outerLow: 100.4,
        outerHigh: 100.6,
      }),
    ]);

    assert.equal(result.length, 2);
  },
);

test(
  'resolves an overlapping native and flipped level to the flipped state',
  () => {
    const result = resolveLevelV2LifecycleCollisions([
      state({
        id: 'native',
        originalKind: 'resistance',
        currentKind: 'resistance',
        status: 'active',
        referencePrice: 100,
        outerLow: 99.9,
        outerHigh: 100.1,
        score: 90,
        touches: 5,
        lastTouch: 120,
      }),
      state({
        id: 'flipped',
        originalKind: 'support',
        currentKind: 'resistance',
        status: 'flipped',
        referencePrice: 100.02,
        outerLow: 99.95,
        outerHigh: 100.15,
        score: 70,
        touches: 3,
        lastTouch: 80,
      }),
    ]);

    assert.equal(result.length, 1);
    assert.equal(result[0]?.level.id, 'flipped');
  },
);
