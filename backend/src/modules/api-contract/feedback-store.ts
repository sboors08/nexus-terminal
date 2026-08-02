import {
  randomUUID,
} from 'node:crypto';
import {
  appendFile,
  mkdir,
  readFile,
} from 'node:fs/promises';
import {
  dirname,
  resolve,
} from 'node:path';
import type {
  ApiMutationResult,
  FeedbackPayload,
  SetupFeedback,
} from '../../contracts/nexus-api.js';

export type FeedbackKind =
  | 'general'
  | 'setup';

export type StoredFeedbackRecord =
  | {
      id: string;
      kind: 'general';
      acceptedAt: string;
      payload: FeedbackPayload;
    }
  | {
      id: string;
      kind: 'setup';
      acceptedAt: string;
      payload: SetupFeedback;
    };

export interface FeedbackStore {
  saveFeedback(
    payload: FeedbackPayload,
  ): Promise<ApiMutationResult>;

  saveSetupFeedback(
    payload: SetupFeedback,
  ): Promise<ApiMutationResult>;
}

interface FeedbackStoreRuntimeOptions {
  now?: () => Date;
  createId?: (
    kind: FeedbackKind,
  ) => string;
}

export interface JsonlFeedbackStoreOptions
  extends FeedbackStoreRuntimeOptions {
  filePath: string;
}

function defaultCreateId(
  kind: FeedbackKind,
): string {
  return `${kind}-feedback-${randomUUID()}`;
}

function clone<T>(
  value: T,
): T {
  return structuredClone(value);
}

function parseStoredRecord(
  value: unknown,
  index: number,
): StoredFeedbackRecord {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    throw new Error(
      `Invalid feedback record at line ${index + 1}`,
    );
  }

  const record =
    value as Record<string, unknown>;

  if (
    typeof record.id !== 'string'
    || (
      record.kind !== 'general'
      && record.kind !== 'setup'
    )
    || typeof record.acceptedAt !== 'string'
    || !record.payload
    || typeof record.payload !== 'object'
    || Array.isArray(record.payload)
  ) {
    throw new Error(
      `Invalid feedback record at line ${index + 1}`,
    );
  }

  return clone(
    value as StoredFeedbackRecord,
  );
}

abstract class BaseFeedbackStore {
  protected readonly now:
    () => Date;

  protected readonly createId:
    (
      kind: FeedbackKind,
    ) => string;

  constructor(
    options:
      FeedbackStoreRuntimeOptions = {},
  ) {
    this.now =
      options.now
      ?? (() => new Date());

    this.createId =
      options.createId
      ?? defaultCreateId;
  }

  protected createGeneralRecord(
    payload: FeedbackPayload,
  ): StoredFeedbackRecord {
    return {
      id:
        this.createId(
          'general',
        ),
      kind:
        'general',
      acceptedAt:
        this.now()
          .toISOString(),
      payload:
        clone(payload),
    };
  }

  protected createSetupRecord(
    payload: SetupFeedback,
  ): StoredFeedbackRecord {
    return {
      id:
        this.createId(
          'setup',
        ),
      kind:
        'setup',
      acceptedAt:
        this.now()
          .toISOString(),
      payload:
        clone(payload),
    };
  }

  protected toResult(
    record: StoredFeedbackRecord,
  ): ApiMutationResult {
    return {
      id:
        record.id,
      acceptedAt:
        record.acceptedAt,
    };
  }
}

export class InMemoryFeedbackStore
  extends BaseFeedbackStore
  implements FeedbackStore {
  private readonly records:
    StoredFeedbackRecord[] = [];

  async saveFeedback(
    payload: FeedbackPayload,
  ): Promise<ApiMutationResult> {
    const record =
      this.createGeneralRecord(
        payload,
      );

    this.records.push(
      record,
    );

    return this.toResult(
      record,
    );
  }

  async saveSetupFeedback(
    payload: SetupFeedback,
  ): Promise<ApiMutationResult> {
    const record =
      this.createSetupRecord(
        payload,
      );

    this.records.push(
      record,
    );

    return this.toResult(
      record,
    );
  }

  getRecords():
  StoredFeedbackRecord[] {
    return clone(
      this.records,
    );
  }
}

export class JsonlFeedbackStore
  extends BaseFeedbackStore
  implements FeedbackStore {
  readonly filePath:
    string;

  private writeQueue:
    Promise<void> =
      Promise.resolve();

  constructor(
    options:
      JsonlFeedbackStoreOptions,
  ) {
    super(options);

    const filePath =
      options.filePath
        .trim();

    if (!filePath) {
      throw new Error(
        'Feedback store file path is required',
      );
    }

    this.filePath =
      resolve(filePath);
  }

  async saveFeedback(
    payload: FeedbackPayload,
  ): Promise<ApiMutationResult> {
    const record =
      this.createGeneralRecord(
        payload,
      );

    await this.append(
      record,
    );

    return this.toResult(
      record,
    );
  }

  async saveSetupFeedback(
    payload: SetupFeedback,
  ): Promise<ApiMutationResult> {
    const record =
      this.createSetupRecord(
        payload,
      );

    await this.append(
      record,
    );

    return this.toResult(
      record,
    );
  }

  async getRecords():
  Promise<StoredFeedbackRecord[]> {
    await this.writeQueue;

    let source:
      string;

    try {
      source =
        await readFile(
          this.filePath,
          'utf8',
        );
    } catch (error) {
      if (
        (
          error as
            NodeJS.ErrnoException
        ).code === 'ENOENT'
      ) {
        return [];
      }

      throw error;
    }

    return source
      .split(/\r?\n/u)
      .filter(
        (line) =>
          line.trim().length > 0,
      )
      .map(
        (line, index) =>
          parseStoredRecord(
            JSON.parse(line) as unknown,
            index,
          ),
      );
  }

  private async append(
    record: StoredFeedbackRecord,
  ): Promise<void> {
    const write =
      async () => {
        await mkdir(
          dirname(
            this.filePath,
          ),
          {
            recursive:
              true,
          },
        );

        await appendFile(
          this.filePath,
          `${JSON.stringify(record)}\n`,
          'utf8',
        );
      };

    const nextWrite =
      this.writeQueue
        .catch(
          () => undefined,
        )
        .then(write);

    this.writeQueue =
      nextWrite;

    await nextWrite;
  }
}