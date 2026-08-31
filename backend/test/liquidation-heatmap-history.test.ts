import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
  mkdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type {
  LiquidationHeatmapSnapshot,
} from '../src/modules/realtime-market-data/liquidation-heatmap-contract.js';
import {
  LiquidationHeatmapHistoryService,
} from '../src/modules/realtime-market-data/liquidation-heatmap-history.service.js';

async function temporaryRoot(
  t: TestContext,
): Promise<string> {
  const root = await mkdtemp(
    join(tmpdir(), 'nexus-heatmap-history-'),
  );
  t.after(async () => rm(root, { recursive: true, force: true }));
  return root;
}

function snapshot(
  generatedAt: string,
): LiquidationHeatmapSnapshot {
  return {
    contractVersion: 'liquidation-heatmap-v0.1',
    modelVersion: 'nexus-liquidation-zones-v0.1',
    symbol: 'BTCUSDT',
    timeframe: '1m',
    status: 'ready',
    marketPrice: 80_000,
    generatedAt,
    inputs: {
      forceOrder: 'live',
      openInterest: 'live',
      marketDepth: 'live',
      candles: 'live',
      markPrice: 'live',
    },
    observedEvents: [
      {
        id: `force:${generatedAt}`,
        kind: 'observed',
        source: 'binance_force_order',
        isEstimate: false,
        symbol: 'BTCUSDT',
        liquidatedPositionSide: 'long',
        executionSide: 'sell',
        price: 79_900,
        quantity: 1,
        notional: 79_900,
        eventAt: generatedAt,
        receivedAt: generatedAt,
      },
    ],
    estimatedZones: [
      {
        id: `zone:${generatedAt}`,
        kind: 'estimated',
        source: 'nexus_model',
        isEstimate: true,
        modelVersion: 'nexus-liquidation-zones-v0.1',
        symbol: 'BTCUSDT',
        liquidatedPositionSide: 'short',
        priceLow: 81_000,
        priceHigh: 81_100,
        centerPrice: 81_050,
        estimatedNotional: 1_000_000,
        intensity: 0.8,
        confidence: 0.6,
        leverageBand: 25,
        startedAt: generatedAt,
        updatedAt: generatedAt,
        reasons: ['open_interest_distribution'],
      },
    ],
    historyBuckets: [],
    disclosure: {
      observed: 'BINANCE_FORCE_ORDER_EXECUTED',
      estimated: 'NEXUS_MODEL_NOT_EXCHANGE_FACT',
    },
  };
}

test(
  'stores at most one time-price bucket per minute and reads it chronologically',
  async (t) => {
    const rootPath = await temporaryRoot(t);
    const incomingBytes: number[] = [];
    const protectedPaths: string[] = [];
    const service = new LiquidationHeatmapHistoryService({
      rootPath,
      now: () => Date.parse('2026-08-30T10:01:30.000Z'),
      quota: {
        async enforce(bytes = 0) {
          incomingBytes.push(bytes);
          return {
            currentBytes: 0,
            fileCount: 0,
            protectedFileCount: 0,
            deletedBytes: 0,
            deletedFiles: 0,
            thresholdReached: false,
          };
        },
        protect(path) {
          protectedPaths.push(path);
          return () => undefined;
        },
      },
    });

    await service.start();
    await service.recordSnapshot(snapshot('2026-08-30T10:00:05.000Z'));
    await service.recordSnapshot(snapshot('2026-08-30T10:00:55.000Z'));
    await service.recordSnapshot(snapshot('2026-08-30T10:01:05.000Z'));

    const buckets = await service.getBuckets({
      symbol: 'BTCUSDT',
      timeframe: '1m',
      limit: 10,
    });

    assert.deepEqual(
      buckets.map((bucket) => bucket.bucketStart),
      [
        '2026-08-30T10:00:00.000Z',
        '2026-08-30T10:01:00.000Z',
      ],
    );
    assert.equal(incomingBytes.length, 2);
    assert.equal(protectedPaths.length, 2);
    assert.ok(incomingBytes.every((bytes) => bytes > 0));

    const activePath = join(
      rootPath,
      'liquidation-heatmap',
      'BTCUSDT',
      '1m',
      '2026-08-30.jsonl.active',
    );
    const lines = (await readFile(activePath, 'utf8'))
      .trim()
      .split(/\r?\n/u);
    assert.equal(lines.length, 2);
    await service.stop();
  },
);

test(
  'closes stale active files so the quota can evict old history',
  async (t) => {
    const rootPath = await temporaryRoot(t);
    const directory = join(
      rootPath,
      'liquidation-heatmap',
      'BTCUSDT',
      '1m',
    );
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, '2026-08-29.jsonl.active'),
      `${JSON.stringify({ marker: true })}\n`,
    );
    const service = new LiquidationHeatmapHistoryService({
      rootPath,
      now: () => Date.parse('2026-08-30T00:00:05.000Z'),
    });

    await service.start();
    const files = await readdir(directory);

    assert.deepEqual(files, ['2026-08-29.jsonl']);
    await service.stop();
  },
);

test(
  'filters history by range and keeps only the requested latest buckets',
  async (t) => {
    const rootPath = await temporaryRoot(t);
    const service = new LiquidationHeatmapHistoryService({ rootPath });
    await service.start();

    for (const minute of ['00', '01', '02']) {
      await service.recordSnapshot(
        snapshot(`2026-08-30T10:${minute}:05.000Z`),
      );
    }

    const buckets = await service.getBuckets({
      symbol: 'BTCUSDT',
      timeframe: '1m',
      from: '2026-08-30T10:01:00.000Z',
      limit: 1,
    });

    assert.deepEqual(
      buckets.map((bucket) => bucket.bucketStart),
      ['2026-08-30T10:02:00.000Z'],
    );
    await service.stop();
  },
);
