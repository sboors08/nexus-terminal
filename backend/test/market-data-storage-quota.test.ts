import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { buildApp } from '../src/app.js';
import { readEnv, type AppEnv } from '../src/config/env.js';
import {
  MarketDataStorageQuotaExceededError,
  MarketDataStorageQuotaService,
  type MarketDataStorageQuotaLifecycle,
} from '../src/modules/market-data/market-data-storage-quota.service.js';

async function createTemporaryRoot(
  t: TestContext,
): Promise<string> {
  const rootPath = await mkdtemp(
    join(tmpdir(), 'nexus-market-data-quota-'),
  );
  t.after(async () => rm(rootPath, { recursive: true, force: true }));
  return rootPath;
}

async function writeSizedFile(
  path: string,
  size: number,
  modifiedAtMs: number,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.alloc(size, 1));
  await utimes(path, modifiedAtMs / 1_000, modifiedAtMs / 1_000);
}

test('deletes oldest closed market-data files down to the cleanup target', async (t) => {
  const rootPath = await createTemporaryRoot(t);
  await writeSizedFile(join(rootPath, 'oldest.jsonl'), 30, 1_000);
  await writeSizedFile(join(rootPath, 'middle.jsonl'), 30, 2_000);
  await writeSizedFile(join(rootPath, 'newest.jsonl'), 30, 3_000);

  const quota = new MarketDataStorageQuotaService({
    rootPath,
    maxBytes: 100,
    cleanupThresholdBytes: 80,
    cleanupTargetBytes: 50,
  });
  const result = await quota.enforce();

  assert.equal(result.thresholdReached, true);
  assert.equal(result.deletedFiles, 2);
  assert.equal(result.deletedBytes, 60);
  assert.equal(result.currentBytes, 30);
  assert.equal(
    (await readFile(join(rootPath, 'newest.jsonl'))).byteLength,
    30,
  );
  await assert.rejects(readFile(join(rootPath, 'oldest.jsonl')));
  await assert.rejects(readFile(join(rootPath, 'middle.jsonl')));
});

test('protects active files and never touches files outside the market-data root', async (t) => {
  const parentPath = await createTemporaryRoot(t);
  const rootPath = join(parentPath, 'market');
  const feedbackPath = join(parentPath, 'feedback.jsonl');
  await writeFile(feedbackPath, 'protected user feedback');
  await writeSizedFile(join(rootPath, 'current.active'), 40, 1_000);
  await writeSizedFile(join(rootPath, 'closed.jsonl'), 40, 2_000);

  const quota = new MarketDataStorageQuotaService({
    rootPath,
    maxBytes: 100,
    cleanupThresholdBytes: 70,
    cleanupTargetBytes: 45,
  });
  const result = await quota.enforce();

  assert.equal(result.deletedFiles, 1);
  assert.equal(result.currentBytes, 40);
  assert.equal(result.protectedFileCount, 1);
  assert.equal(await readFile(feedbackPath, 'utf8'), 'protected user feedback');
  assert.equal(
    (await readFile(join(rootPath, 'current.active'))).byteLength,
    40,
  );
  assert.throws(
    () => quota.protect('../feedback.jsonl'),
    /inside the market-data storage root/,
  );
});

test('rejects a write that cannot fit without deleting protected data', async (t) => {
  const rootPath = await createTemporaryRoot(t);
  await writeSizedFile(join(rootPath, 'current.active'), 90, 1_000);

  const quota = new MarketDataStorageQuotaService({
    rootPath,
    maxBytes: 100,
    cleanupThresholdBytes: 80,
    cleanupTargetBytes: 60,
  });

  await assert.rejects(
    quota.enforce(11),
    (error: unknown) => (
      error instanceof MarketDataStorageQuotaExceededError
      && error.currentBytes === 90
      && error.incomingBytes === 11
      && error.maxBytes === 100
    ),
  );
});

test('loads the local 20 GiB quota defaults and validates their order', () => {
  const env = readEnv({ NODE_ENV: 'production' });

  assert.equal(env.marketDataStorageQuotaEnabled, true);
  assert.equal(env.marketDataStorageRootPath, './data/market');
  assert.equal(env.marketDataStorageMaxGiB, 20);
  assert.equal(env.marketDataStorageCleanupThresholdGiB, 16);
  assert.equal(env.marketDataStorageCleanupTargetGiB, 14);

  assert.throws(
    () => readEnv({
      NODE_ENV: 'production',
      MARKET_DATA_STORAGE_MAX_GIB: '20',
      MARKET_DATA_STORAGE_CLEANUP_THRESHOLD_GIB: '16',
      MARKET_DATA_STORAGE_CLEANUP_TARGET_GIB: '16',
    }),
    /CLEANUP_TARGET_GIB must be less than/,
  );
});

test('starts and stops the quota lifecycle with the Fastify app', async () => {
  const events: string[] = [];
  const lifecycle: MarketDataStorageQuotaLifecycle = {
    async start(): Promise<void> {
      events.push('start');
    },
    async stop(): Promise<void> {
      events.push('stop');
    },
  };
  const env: AppEnv = {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 4100,
    apiPrefix: '/api/v1',
    corsOrigins: ['http://localhost:5173'],
    logLevel: 'silent',
  };
  const app = await buildApp({
    env,
    marketDataStorageQuotaService: lifecycle,
  });

  await app.ready();
  assert.deepEqual(events, ['start']);
  await app.close();
  assert.deepEqual(events, ['start', 'stop']);
});
