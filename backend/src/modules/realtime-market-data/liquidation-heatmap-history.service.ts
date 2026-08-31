import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  rename,
} from 'node:fs/promises';
import {
  join,
  resolve,
} from 'node:path';
import type {
  MarketDataStorageQuotaController,
} from '../market-data/market-data-storage-quota.service.js';
import {
  LIQUIDATION_HEATMAP_HISTORY_VERSION,
  type LiquidationHeatmapSnapshot,
  type LiquidationHeatmapTimeBucket,
} from './liquidation-heatmap-contract.js';

const BUCKET_MS = 60_000;
const DEFAULT_HISTORY_LIMIT = 360;
const MAX_HISTORY_LIMIT = 1_440;
const RECENT_CACHE_LIMIT = 2;

export interface LiquidationHeatmapHistoryQuery {
  symbol: string;
  timeframe: string;
  limit?: number;
  from?: string;
  to?: string;
}

export interface LiquidationHeatmapHistoryContract {
  start(): Promise<void>;
  stop(): Promise<void>;
  recordSnapshot(
    snapshot: LiquidationHeatmapSnapshot,
  ): Promise<LiquidationHeatmapTimeBucket>;
  getBuckets(
    query: LiquidationHeatmapHistoryQuery,
  ): Promise<LiquidationHeatmapTimeBucket[]>;
}

export interface LiquidationHeatmapHistoryOptions {
  rootPath: string;
  quota?: Pick<
    MarketDataStorageQuotaController,
    'enforce' | 'protect'
  >;
  now?: () => number;
}

function normalizeStreamPart(
  value: string,
  label: string,
  casing: 'upper' | 'lower',
): string {
  const trimmed = value.trim();
  const normalized = casing === 'upper'
    ? trimmed.toUpperCase()
    : trimmed.toLowerCase();

  if (!/^[A-Za-z0-9]{1,30}$/u.test(normalized)) {
    throw new Error(`Invalid liquidation heatmap ${label}`);
  }

  return normalized;
}

function parseTimestamp(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    throw new Error('Invalid liquidation heatmap history timestamp');
  }

  return parsed;
}

function normalizeLimit(
  value: number | undefined,
): number {
  const limit = value ?? DEFAULT_HISTORY_LIMIT;

  if (
    !Number.isInteger(limit)
    || limit < 1
    || limit > MAX_HISTORY_LIMIT
  ) {
    throw new Error(
      `Liquidation heatmap history limit must be an integer from 1 to ${MAX_HISTORY_LIMIT}`,
    );
  }

  return limit;
}

function dateKey(timestamp: number): string {
  return new Date(timestamp)
    .toISOString()
    .slice(0, 10);
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'ENOENT'
  );
}

function isTimeBucket(
  value: unknown,
): value is LiquidationHeatmapTimeBucket {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
  ) return false;

  const record = value as Record<string, unknown>;

  return (
    record.historyVersion
      === LIQUIDATION_HEATMAP_HISTORY_VERSION
    && typeof record.symbol === 'string'
    && typeof record.timeframe === 'string'
    && typeof record.bucketStart === 'string'
    && Number.isFinite(Date.parse(record.bucketStart))
    && typeof record.bucketEnd === 'string'
    && Number.isFinite(Date.parse(record.bucketEnd))
    && Array.isArray(record.observedEvents)
    && Array.isArray(record.estimatedZones)
  );
}

export class LiquidationHeatmapHistoryService
implements LiquidationHeatmapHistoryContract {
  private readonly rootPath: string;

  private readonly now: () => number;

  private readonly lastBucketByStream = new Map<string, number>();

  private readonly recentBucketsByStream = new Map<
    string,
    LiquidationHeatmapTimeBucket[]
  >();

  private readonly hydratedStreams = new Set<string>();

  private operationQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly options: LiquidationHeatmapHistoryOptions,
  ) {
    this.rootPath = resolve(
      options.rootPath,
      'liquidation-heatmap',
    );
    this.now = options.now ?? Date.now;
  }

  async start(): Promise<void> {
    await mkdir(this.rootPath, { recursive: true });
    await this.closeStaleActiveFiles(this.rootPath);
  }

  async stop(): Promise<void> {
    await this.operationQueue.catch(() => undefined);
  }

  async recordSnapshot(
    snapshot: LiquidationHeatmapSnapshot,
  ): Promise<LiquidationHeatmapTimeBucket> {
    return this.enqueue(async () => {
      const symbol = normalizeStreamPart(snapshot.symbol, 'symbol', 'upper');
      const timeframe = normalizeStreamPart(snapshot.timeframe, 'timeframe', 'lower');
      const generatedAtMs = parseTimestamp(
        snapshot.generatedAt,
        this.now(),
      );
      const bucketStartMs = Math.floor(generatedAtMs / BUCKET_MS) * BUCKET_MS;
      const bucketEndMs = bucketStartMs + BUCKET_MS;
      const streamKey = `${symbol}:${timeframe}`;
      const bucket = this.toBucket(
        snapshot,
        bucketStartMs,
        bucketEndMs,
      );

      if (
        this.lastBucketByStream.get(streamKey)
        === bucketStartMs
      ) return bucket;

      const directoryPath = join(
        this.rootPath,
        symbol,
        timeframe,
      );
      await mkdir(directoryPath, { recursive: true });
      await this.closeStaleActiveFiles(directoryPath);
      const filePath = join(
        directoryPath,
        `${dateKey(bucketStartMs)}.jsonl.active`,
      );

      if (!this.lastBucketByStream.has(streamKey)) {
        const existing = await this.readFileBuckets(filePath);
        const latestExisting = existing.at(-1);
        this.recentBucketsByStream.set(
          streamKey,
          existing.slice(-RECENT_CACHE_LIMIT),
        );
        this.hydratedStreams.add(streamKey);

        if (
          latestExisting
          && Date.parse(latestExisting.bucketStart)
            === bucketStartMs
        ) {
          this.lastBucketByStream.set(streamKey, bucketStartMs);
          return latestExisting;
        }
      }

      const serialized = `${JSON.stringify(bucket)}\n`;
      await this.options.quota?.enforce(
        Buffer.byteLength(serialized),
      );
      const releaseProtection =
        this.options.quota?.protect(filePath);

      try {
        await appendFile(filePath, serialized, 'utf8');
      } finally {
        releaseProtection?.();
      }

      this.lastBucketByStream.set(streamKey, bucketStartMs);
      this.rememberBucket(streamKey, bucket);
      return bucket;
    });
  }

  async getBuckets(
    query: LiquidationHeatmapHistoryQuery,
  ): Promise<LiquidationHeatmapTimeBucket[]> {
    return this.enqueue(async () => {
      const symbol = normalizeStreamPart(query.symbol, 'symbol', 'upper');
      const timeframe = normalizeStreamPart(query.timeframe, 'timeframe', 'lower');
      const limit = normalizeLimit(query.limit);
      const fromMs = parseTimestamp(query.from, Number.NEGATIVE_INFINITY);
      const toMs = parseTimestamp(query.to, Number.POSITIVE_INFINITY);

      if (fromMs > toMs) {
        throw new Error('Liquidation heatmap history range is reversed');
      }

      const streamKey = `${symbol}:${timeframe}`;
      const recent = this.recentBucketsByStream.get(streamKey) ?? [];

      if (
        query.from === undefined
        && query.to === undefined
        && limit <= RECENT_CACHE_LIMIT
        && this.hydratedStreams.has(streamKey)
      ) {
        return recent.slice(-limit);
      }

      const directoryPath = join(
        this.rootPath,
        symbol,
        timeframe,
      );
      let entries;

      try {
        entries = await readdir(directoryPath, { withFileTypes: true });
      } catch (error) {
        if (isMissingFileError(error)) return [];
        throw error;
      }

      const files = entries
        .filter(
          (entry) =>
            entry.isFile()
            && /^\d{4}-\d{2}-\d{2}\.jsonl(?:\.active)?$/u.test(entry.name),
        )
        .map((entry) => join(directoryPath, entry.name))
        .sort();
      const byBucket = new Map<number, LiquidationHeatmapTimeBucket>();

      for (const filePath of files) {
        const buckets = await this.readFileBuckets(filePath);

        for (const bucket of buckets) {
          const bucketStartMs = Date.parse(bucket.bucketStart);

          if (
            bucket.symbol !== symbol
            || bucket.timeframe !== timeframe
            || bucketStartMs < fromMs
            || bucketStartMs > toMs
          ) continue;

          byBucket.set(bucketStartMs, bucket);
        }
      }

      return [...byBucket.entries()]
        .sort((left, right) => left[0] - right[0])
        .slice(-limit)
        .map(([, bucket]) => bucket);
    });
  }

  private rememberBucket(
    streamKey: string,
    bucket: LiquidationHeatmapTimeBucket,
  ): void {
    const current = this.recentBucketsByStream.get(streamKey) ?? [];
    const withoutDuplicate = current.filter(
      (value) => value.bucketStart !== bucket.bucketStart,
    );
    this.recentBucketsByStream.set(
      streamKey,
      [...withoutDuplicate, bucket].slice(-RECENT_CACHE_LIMIT),
    );
    this.hydratedStreams.add(streamKey);
  }

  private toBucket(
    snapshot: LiquidationHeatmapSnapshot,
    bucketStartMs: number,
    bucketEndMs: number,
  ): LiquidationHeatmapTimeBucket {
    return {
      historyVersion: LIQUIDATION_HEATMAP_HISTORY_VERSION,
      symbol: snapshot.symbol,
      timeframe: snapshot.timeframe,
      bucketStart: new Date(bucketStartMs).toISOString(),
      bucketEnd: new Date(bucketEndMs).toISOString(),
      generatedAt: snapshot.generatedAt,
      status: snapshot.status,
      marketPrice: snapshot.marketPrice,
      inputs: { ...snapshot.inputs },
      observedEvents: snapshot.observedEvents.filter((event) => {
        const eventAt = Date.parse(event.eventAt);
        return eventAt >= bucketStartMs && eventAt < bucketEndMs;
      }),
      estimatedZones: snapshot.estimatedZones.map((zone) => ({
        ...zone,
        reasons: [...zone.reasons],
      })),
    };
  }

  private async readFileBuckets(
    filePath: string,
  ): Promise<LiquidationHeatmapTimeBucket[]> {
    let contents: string;

    try {
      contents = await readFile(filePath, 'utf8');
    } catch (error) {
      if (isMissingFileError(error)) return [];
      throw error;
    }

    const buckets: LiquidationHeatmapTimeBucket[] = [];

    for (const line of contents.split(/\r?\n/u)) {
      if (line.trim().length === 0) continue;

      try {
        const value: unknown = JSON.parse(line);
        if (isTimeBucket(value)) buckets.push(value);
      } catch {
        // A partially written final line is ignored and repaired by the next bucket.
      }
    }

    return buckets;
  }

  private async closeStaleActiveFiles(
    directoryPath: string,
  ): Promise<void> {
    let entries;

    try {
      entries = await readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      if (isMissingFileError(error)) return;
      throw error;
    }

    const today = dateKey(this.now());

    for (const entry of entries) {
      const entryPath = join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        await this.closeStaleActiveFiles(entryPath);
        continue;
      }

      if (
        !entry.isFile()
        || !entry.name.endsWith('.jsonl.active')
        || entry.name.startsWith(today)
      ) continue;

      const closedPath = entryPath.slice(0, -'.active'.length);

      try {
        await rename(entryPath, closedPath);
      } catch (error) {
        if (!isMissingFileError(error)) throw error;
      }
    }
  }

  private enqueue<TValue>(
    operation: () => Promise<TValue>,
  ): Promise<TValue> {
    const next = this.operationQueue.then(operation, operation);
    this.operationQueue = next;
    return next;
  }
}
