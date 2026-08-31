import {
  mkdir,
  readdir,
  stat,
  unlink,
} from 'node:fs/promises';
import {
  basename,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

export interface MarketDataStorageQuotaOptions {
  rootPath: string;
  maxBytes: number;
  cleanupThresholdBytes: number;
  cleanupTargetBytes: number;
  sweepIntervalMs?: number;
  now?: () => number;
}

export interface MarketDataStorageQuotaStatus {
  rootPath: string;
  maxBytes: number;
  cleanupThresholdBytes: number;
  cleanupTargetBytes: number;
  currentBytes: number;
  fileCount: number;
  protectedFileCount: number;
  lastSweepAt: string | null;
  lastDeletedBytes: number;
  lastDeletedFiles: number;
  lastError: string | null;
}

export interface MarketDataStorageQuotaSweepResult {
  currentBytes: number;
  fileCount: number;
  protectedFileCount: number;
  deletedBytes: number;
  deletedFiles: number;
  thresholdReached: boolean;
}

export interface MarketDataStorageQuotaLifecycle {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface MarketDataStorageQuotaController
extends MarketDataStorageQuotaLifecycle {
  protect(filePath: string): () => void;
  enforce(
    incomingBytes?: number,
  ): Promise<MarketDataStorageQuotaSweepResult>;
}

interface StoredFile {
  path: string;
  size: number;
  modifiedAtMs: number;
}

const DEFAULT_SWEEP_INTERVAL_MS = 60_000;

export class MarketDataStorageQuotaExceededError extends Error {
  readonly code = 'MARKET_DATA_STORAGE_QUOTA_EXCEEDED';

  constructor(
    readonly currentBytes: number,
    readonly incomingBytes: number,
    readonly maxBytes: number,
  ) {
    super(
      `Market-data storage quota would be exceeded: ${currentBytes} + ${incomingBytes} > ${maxBytes}`,
    );
    this.name = 'MarketDataStorageQuotaExceededError';
  }
}

function assertSafeInteger(
  value: number,
  name: string,
  minimum: number,
): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be a safe integer greater than or equal to ${minimum}`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'ENOENT'
  );
}

export class MarketDataStorageQuotaService
implements MarketDataStorageQuotaController {
  private readonly rootPath: string;

  private readonly protectedPaths = new Set<string>();

  private readonly sweepIntervalMs: number;

  private readonly now: () => number;

  private sweepTimer: NodeJS.Timeout | null = null;

  private sweepInProgress: Promise<MarketDataStorageQuotaSweepResult> | null = null;

  private status: MarketDataStorageQuotaStatus;

  constructor(
    private readonly options: MarketDataStorageQuotaOptions,
  ) {
    this.rootPath = resolve(options.rootPath);
    this.sweepIntervalMs = options.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
    this.now = options.now ?? Date.now;

    assertSafeInteger(options.maxBytes, 'maxBytes', 1);
    assertSafeInteger(options.cleanupThresholdBytes, 'cleanupThresholdBytes', 1);
    assertSafeInteger(options.cleanupTargetBytes, 'cleanupTargetBytes', 0);
    assertSafeInteger(this.sweepIntervalMs, 'sweepIntervalMs', 1_000);

    if (options.cleanupTargetBytes >= options.cleanupThresholdBytes) {
      throw new Error('cleanupTargetBytes must be less than cleanupThresholdBytes');
    }

    if (options.cleanupThresholdBytes >= options.maxBytes) {
      throw new Error('cleanupThresholdBytes must be less than maxBytes');
    }

    this.status = {
      rootPath: this.rootPath,
      maxBytes: options.maxBytes,
      cleanupThresholdBytes: options.cleanupThresholdBytes,
      cleanupTargetBytes: options.cleanupTargetBytes,
      currentBytes: 0,
      fileCount: 0,
      protectedFileCount: 0,
      lastSweepAt: null,
      lastDeletedBytes: 0,
      lastDeletedFiles: 0,
      lastError: null,
    };
  }

  async start(): Promise<void> {
    await mkdir(this.rootPath, { recursive: true });
    await this.enforce();

    if (this.sweepTimer) return;

    this.sweepTimer = setInterval(() => {
      void this.enforce().catch(() => undefined);
    }, this.sweepIntervalMs);
    this.sweepTimer.unref();
  }

  async stop(): Promise<void> {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }

    await this.sweepInProgress?.catch(() => undefined);
  }

  getStatus(): MarketDataStorageQuotaStatus {
    return { ...this.status };
  }

  protect(filePath: string): () => void {
    const safePath = this.resolveManagedPath(filePath);
    this.protectedPaths.add(safePath);

    return () => {
      this.protectedPaths.delete(safePath);
    };
  }

  async enforce(
    incomingBytes = 0,
  ): Promise<MarketDataStorageQuotaSweepResult> {
    assertSafeInteger(incomingBytes, 'incomingBytes', 0);

    if (incomingBytes > this.options.maxBytes) {
      throw new MarketDataStorageQuotaExceededError(
        0,
        incomingBytes,
        this.options.maxBytes,
      );
    }

    while (this.sweepInProgress) {
      await this.sweepInProgress;
    }

    const sweep = this.runSweep(incomingBytes);
    this.sweepInProgress = sweep;

    try {
      return await sweep;
    } finally {
      if (this.sweepInProgress === sweep) {
        this.sweepInProgress = null;
      }
    }
  }

  private async runSweep(
    incomingBytes: number,
  ): Promise<MarketDataStorageQuotaSweepResult> {
    try {
      await mkdir(this.rootPath, { recursive: true });
      const before = await this.collectFiles(this.rootPath);
      const initialBytes = before.reduce((sum, file) => sum + file.size, 0);
      const thresholdReached = (
        initialBytes + incomingBytes
        >= this.options.cleanupThresholdBytes
      );
      let currentBytes = initialBytes;
      let deletedBytes = 0;
      let deletedFiles = 0;

      if (thresholdReached) {
        const desiredExistingBytes = Math.max(
          0,
          this.options.cleanupTargetBytes - incomingBytes,
        );
        const candidates = before
          .filter((file) => !this.isProtected(file.path))
          .sort((left, right) => (
            left.modifiedAtMs - right.modifiedAtMs
            || left.path.localeCompare(right.path)
          ));

        for (const file of candidates) {
          if (currentBytes <= desiredExistingBytes) break;

          try {
            await unlink(file.path);
            currentBytes -= file.size;
            deletedBytes += file.size;
            deletedFiles += 1;
          } catch (error) {
            if (!isMissingFileError(error)) throw error;
          }
        }
      }

      const after = await this.collectFiles(this.rootPath);
      currentBytes = after.reduce((sum, file) => sum + file.size, 0);
      const currentProtectedFileCount = after.filter((file) => this.isProtected(file.path)).length;

      if (currentBytes + incomingBytes > this.options.maxBytes) {
        throw new MarketDataStorageQuotaExceededError(
          currentBytes,
          incomingBytes,
          this.options.maxBytes,
        );
      }

      const result: MarketDataStorageQuotaSweepResult = {
        currentBytes,
        fileCount: after.length,
        protectedFileCount: currentProtectedFileCount,
        deletedBytes,
        deletedFiles,
        thresholdReached,
      };

      this.status = {
        ...this.status,
        currentBytes,
        fileCount: after.length,
        protectedFileCount: currentProtectedFileCount,
        lastSweepAt: new Date(this.now()).toISOString(),
        lastDeletedBytes: deletedBytes,
        lastDeletedFiles: deletedFiles,
        lastError: null,
      };

      return result;
    } catch (error) {
      this.status = {
        ...this.status,
        lastSweepAt: new Date(this.now()).toISOString(),
        lastError: errorMessage(error),
      };
      throw error;
    }
  }

  private async collectFiles(directoryPath: string): Promise<StoredFile[]> {
    const files: StoredFile[] = [];
    const entries = await readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(directoryPath, entry.name);

      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        files.push(...await this.collectFiles(entryPath));
        continue;
      }

      if (!entry.isFile()) continue;

      try {
        const fileStat = await stat(entryPath);
        files.push({
          path: resolve(entryPath),
          size: fileStat.size,
          modifiedAtMs: fileStat.mtimeMs,
        });
      } catch (error) {
        if (!isMissingFileError(error)) throw error;
      }
    }

    return files;
  }

  private isProtected(filePath: string): boolean {
    const fileName = basename(filePath).toLowerCase();
    return (
      this.protectedPaths.has(resolve(filePath))
      || fileName.endsWith('.active')
      || fileName.endsWith('.tmp')
      || fileName.endsWith('.lock')
    );
  }

  private resolveManagedPath(filePath: string): string {
    const candidate = resolve(
      isAbsolute(filePath)
        ? filePath
        : join(this.rootPath, filePath),
    );
    const relativePath = relative(this.rootPath, candidate);

    if (
      relativePath === '..'
      || relativePath.startsWith(`..${sep}`)
      || isAbsolute(relativePath)
    ) {
      throw new Error('Protected path must be inside the market-data storage root');
    }

    return candidate;
  }
}
