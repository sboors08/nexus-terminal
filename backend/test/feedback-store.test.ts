import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises';
import {
  tmpdir,
} from 'node:os';
import {
  join,
} from 'node:path';
import test from 'node:test';
import type {
  FeedbackPayload,
  SetupFeedback,
} from '../src/contracts/nexus-api.js';
import {
  InMemoryFeedbackStore,
  JsonlFeedbackStore,
} from '../src/modules/api-contract/feedback-store.js';

const generalFeedback:
FeedbackPayload = {
  type:
    'data_issue',
  message:
    'Scanner price is stale',
  rating:
    2,
  contact:
    '@nexus-tester',
  context: {
    route:
      '/app/scanner?symbol=SOLUSDT',
    screen:
      'Scanner',
    symbol:
      'SOLUSDT',
    timeframe:
      '5m',
    setupId:
      'setup-sol-001',
    replayId:
      null,
    appVersion:
      'test-v0.1',
    userAgent:
      'node-test',
    createdAt:
      '2026-08-02T00:00:00.000Z',
  },
};

const setupFeedback:
SetupFeedback = {
  setupId:
    'setup-sol-001',
  useful:
    false,
  reasons: [
    'detected_too_late',
    'volume_issue',
  ],
  comment:
    'The impulse had already started.',
  createdAt:
    '2026-08-02T00:01:00.000Z',
};

test(
  'in-memory feedback store retains cloned payloads',
  async () => {
    let sequence =
      0;

    const store =
      new InMemoryFeedbackStore({
        now:
          () =>
            new Date(
              '2026-08-02T00:02:00.000Z',
            ),
        createId:
          (kind) => {
            sequence += 1;
            return `${kind}-${sequence}`;
          },
      });

    const payload =
      structuredClone(
        generalFeedback,
      );

    const result =
      await store.saveFeedback(
        payload,
      );

    payload.message =
      'mutated after save';

    assert.deepEqual(
      result,
      {
        id:
          'general-1',
        acceptedAt:
          '2026-08-02T00:02:00.000Z',
      },
    );

    const firstRead =
      store.getRecords();

    assert.equal(
      firstRead.length,
      1,
    );

    assert.equal(
      firstRead[0]?.kind,
      'general',
    );

    assert.equal(
      firstRead[0]?.payload.message,
      generalFeedback.message,
    );

    if (
      firstRead[0]?.kind
      === 'general'
    ) {
      firstRead[0].payload.message =
        'mutated read result';
    }

    assert.equal(
      store.getRecords()[0]
        ?.payload.message,
      generalFeedback.message,
    );
  },
);

test(
  'JSONL feedback store survives a new store instance',
  async (context) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'nexus-feedback-',
        ),
      );

    context.after(
      async () => {
        await rm(
          directory,
          {
            recursive:
              true,
            force:
              true,
          },
        );
      },
    );

    const filePath =
      join(
        directory,
        'feedback.jsonl',
      );

    let sequence =
      0;

    const writer =
      new JsonlFeedbackStore({
        filePath,
        now:
          () =>
            new Date(
              '2026-08-02T00:03:00.000Z',
            ),
        createId:
          (kind) => {
            sequence += 1;
            return `${kind}-${sequence}`;
          },
      });

    const generalResult =
      await writer.saveFeedback(
        generalFeedback,
      );

    const setupResult =
      await writer.saveSetupFeedback(
        setupFeedback,
      );

    assert.equal(
      generalResult.id,
      'general-1',
    );

    assert.equal(
      setupResult.id,
      'setup-2',
    );

    const reader =
      new JsonlFeedbackStore({
        filePath,
      });

    const records =
      await reader.getRecords();

    assert.equal(
      records.length,
      2,
    );

    assert.deepEqual(
      records[0],
      {
        id:
          'general-1',
        kind:
          'general',
        acceptedAt:
          '2026-08-02T00:03:00.000Z',
        payload:
          generalFeedback,
      },
    );

    assert.deepEqual(
      records[1],
      {
        id:
          'setup-2',
        kind:
          'setup',
        acceptedAt:
          '2026-08-02T00:03:00.000Z',
        payload:
          setupFeedback,
      },
    );

    const source =
      await readFile(
        filePath,
        'utf8',
      );

    assert.equal(
      source
        .trim()
        .split(/\r?\n/u)
        .length,
      2,
    );
  },
);

test(
  'JSONL feedback store returns an empty list before first write',
  async (context) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'nexus-feedback-empty-',
        ),
      );

    context.after(
      async () => {
        await rm(
          directory,
          {
            recursive:
              true,
            force:
              true,
          },
        );
      },
    );

    const store =
      new JsonlFeedbackStore({
        filePath:
          join(
            directory,
            'missing.jsonl',
          ),
      });

    assert.deepEqual(
      await store.getRecords(),
      [],
    );
  },
);