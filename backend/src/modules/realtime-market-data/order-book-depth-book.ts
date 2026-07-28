import type {
  OrderBookDepthApplyResult,
  OrderBookDepthDelta,
  OrderBookDepthLevel,
  OrderBookDepthLevelInput,
  OrderBookDepthSnapshot,
  OrderBookDepthView,
} from './order-book-depth.types.js';

export interface OrderBookDepthBookOptions {
  symbol: string;
  maxLevelsPerSide?: number;
  maxBufferedDeltas?: number;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,20}$/u;

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value
      .trim()
      .toUpperCase();

  if (
    !SYMBOL_PATTERN.test(
      symbol,
    )
  ) {
    throw new Error(
      `Invalid order book symbol: ${value}`,
    );
  }

  return symbol;
}

function assertPositiveInteger(
  value: number,
  name: string,
): void {
  if (
    !Number.isSafeInteger(
      value,
    )
    || value < 1
  ) {
    throw new Error(
      `${name} must be a positive safe integer`,
    );
  }
}

function assertUpdateId(
  value: number,
  name: string,
): void {
  if (
    !Number.isSafeInteger(
      value,
    )
    || value < 0
  ) {
    throw new Error(
      `${name} must be a non-negative safe integer`,
    );
  }
}

function assertTimestamp(
  value: string,
  name: string,
): void {
  if (
    !Number.isFinite(
      Date.parse(
        value,
      ),
    )
  ) {
    throw new Error(
      `${name} must be a valid timestamp`,
    );
  }
}

function assertLevels(
  levels:
    readonly OrderBookDepthLevelInput[],
  name: string,
  allowZeroQuantity: boolean,
): void {
  for (
    const level
    of levels
  ) {
    if (
      !Number.isFinite(
        level.price,
      )
      || level.price <= 0
    ) {
      throw new Error(
        `${name} contains an invalid price`,
      );
    }

    if (
      !Number.isFinite(
        level.quantity,
      )
      || level.quantity < 0
      || (
        !allowZeroQuantity
        && level.quantity === 0
      )
    ) {
      throw new Error(
        `${name} contains an invalid quantity`,
      );
    }
  }
}

function cloneDelta(
  delta: OrderBookDepthDelta,
): OrderBookDepthDelta {
  return {
    ...delta,
    bids:
      delta.bids.map(
        (level) => ({
          ...level,
        }),
      ),
    asks:
      delta.asks.map(
        (level) => ({
          ...level,
        }),
      ),
  };
}

function toResult(
  status:
    OrderBookDepthApplyResult['status'],
  reason:
    string
    | null,
  lastUpdateId:
    number
    | null,
  synchronized: boolean,
): OrderBookDepthApplyResult {
  return {
    status,
    reason,
    lastUpdateId,
    synchronized,
  };
}

export class OrderBookDepthBook {
  private readonly symbol: string;
  private readonly maxLevelsPerSide:
    number;
  private readonly maxBufferedDeltas:
    number;

  private readonly bids =
    new Map<number, number>();

  private readonly asks =
    new Map<number, number>();

  private bufferedDeltas:
    OrderBookDepthDelta[] = [];

  private hasSnapshot = false;
  private synchronized = false;
  private lastUpdateId:
    number
    | null = null;

  private updatedAt:
    string
    | null = null;

  constructor(
    options:
      OrderBookDepthBookOptions,
  ) {
    this.symbol =
      normalizeSymbol(
        options.symbol,
      );

    const maxLevelsPerSide =
      options.maxLevelsPerSide
      ?? 1_000;

    const maxBufferedDeltas =
      options.maxBufferedDeltas
      ?? 2_000;

    assertPositiveInteger(
      maxLevelsPerSide,
      'maxLevelsPerSide',
    );

    assertPositiveInteger(
      maxBufferedDeltas,
      'maxBufferedDeltas',
    );

    this.maxLevelsPerSide =
      maxLevelsPerSide;

    this.maxBufferedDeltas =
      maxBufferedDeltas;
  }

  reset(): void {
    this.bids.clear();
    this.asks.clear();
    this.bufferedDeltas = [];
    this.hasSnapshot = false;
    this.synchronized = false;
    this.lastUpdateId = null;
    this.updatedAt = null;
  }

  getBufferedDeltaCount():
    number {
    return this.bufferedDeltas.length;
  }

  applyDelta(
    delta: OrderBookDepthDelta,
  ): OrderBookDepthApplyResult {
    this.assertDelta(
      delta,
    );

    if (!this.hasSnapshot) {
      if (
        this.bufferedDeltas.length
        >= this.maxBufferedDeltas
      ) {
        this.bufferedDeltas = [];
        this.synchronized = false;

        return toResult(
          'gap',
          'delta-buffer-overflow',
          this.lastUpdateId,
          false,
        );
      }

      this.bufferedDeltas.push(
        cloneDelta(
          delta,
        ),
      );

      return toResult(
        'buffered',
        null,
        this.lastUpdateId,
        false,
      );
    }

    return this.applyLiveDelta(
      delta,
    );
  }

  applySnapshot(
    snapshot:
      OrderBookDepthSnapshot,
  ): OrderBookDepthApplyResult {
    this.assertSnapshot(
      snapshot,
    );

    this.bids.clear();
    this.asks.clear();

    this.applyLevels(
      this.bids,
      snapshot.bids,
    );

    this.applyLevels(
      this.asks,
      snapshot.asks,
    );

    this.hasSnapshot = true;
    this.synchronized = false;
    this.lastUpdateId =
      snapshot.lastUpdateId;

    this.updatedAt =
      snapshot.receivedAt;

    const pending =
      this.bufferedDeltas.filter(
        (delta) =>
          delta.finalUpdateId
          >= snapshot.lastUpdateId,
      );

    this.bufferedDeltas = [];

    if (
      pending.length === 0
    ) {
      return toResult(
        'snapshot-applied',
        'waiting-for-bridging-delta',
        this.lastUpdateId,
        false,
      );
    }

    const firstIndex =
      pending.findIndex(
        (delta) =>
          delta.firstUpdateId
            <= snapshot.lastUpdateId
          && delta.finalUpdateId
            >= snapshot.lastUpdateId,
      );

    if (
      firstIndex === -1
    ) {
      return this.markGap(
        'snapshot-update-id-not-bridged',
      );
    }

    const first =
      pending[
        firstIndex
      ];

    if (!first) {
      return this.markGap(
        'snapshot-update-id-not-bridged',
      );
    }

    this.applyDeltaLevels(
      first,
    );

    this.lastUpdateId =
      first.finalUpdateId;

    this.updatedAt =
      first.receivedAt;

    this.synchronized = true;

    for (
      let index =
        firstIndex + 1;
      index < pending.length;
      index += 1
    ) {
      const delta =
        pending[index];

      if (!delta) {
        continue;
      }

      const result =
        this.applySynchronizedDelta(
          delta,
        );

      if (
        result.status === 'gap'
      ) {
        return result;
      }
    }

    return toResult(
      'applied',
      null,
      this.lastUpdateId,
      true,
    );
  }

  getView():
    OrderBookDepthView {
    return {
      symbol:
        this.symbol,
      synchronized:
        this.synchronized,
      lastUpdateId:
        this.lastUpdateId,
      bids:
        this.toLevels(
          this.bids,
          'desc',
        ),
      asks:
        this.toLevels(
          this.asks,
          'asc',
        ),
      updatedAt:
        this.updatedAt,
    };
  }

  private applyLiveDelta(
    delta: OrderBookDepthDelta,
  ): OrderBookDepthApplyResult {
    const lastUpdateId =
      this.lastUpdateId;

    if (
      lastUpdateId === null
    ) {
      return this.markGap(
        'missing-local-update-id',
      );
    }

    if (
      delta.finalUpdateId
      <= lastUpdateId
    ) {
      return toResult(
        'ignored',
        'stale-delta',
        lastUpdateId,
        this.synchronized,
      );
    }

    if (!this.synchronized) {
      const bridgesSnapshot =
        delta.firstUpdateId
          <= lastUpdateId
        && delta.finalUpdateId
          >= lastUpdateId;

      if (!bridgesSnapshot) {
        return this.markGap(
          'snapshot-update-id-not-bridged',
        );
      }

      this.applyDeltaLevels(
        delta,
      );

      this.lastUpdateId =
        delta.finalUpdateId;

      this.updatedAt =
        delta.receivedAt;

      this.synchronized = true;

      return toResult(
        'applied',
        null,
        this.lastUpdateId,
        true,
      );
    }

    return this.applySynchronizedDelta(
      delta,
    );
  }

  private applySynchronizedDelta(
    delta: OrderBookDepthDelta,
  ): OrderBookDepthApplyResult {
    const lastUpdateId =
      this.lastUpdateId;

    if (
      lastUpdateId === null
    ) {
      return this.markGap(
        'missing-local-update-id',
      );
    }

    if (
      delta.finalUpdateId
      <= lastUpdateId
    ) {
      return toResult(
        'ignored',
        'stale-delta',
        lastUpdateId,
        true,
      );
    }

    if (
      delta.previousFinalUpdateId
      !== lastUpdateId
    ) {
      return this.markGap(
        'previous-final-update-id-mismatch',
      );
    }

    this.applyDeltaLevels(
      delta,
    );

    this.lastUpdateId =
      delta.finalUpdateId;

    this.updatedAt =
      delta.receivedAt;

    return toResult(
      'applied',
      null,
      this.lastUpdateId,
      true,
    );
  }

  private applyDeltaLevels(
    delta: OrderBookDepthDelta,
  ): void {
    this.applyLevels(
      this.bids,
      delta.bids,
    );

    this.applyLevels(
      this.asks,
      delta.asks,
    );
  }

  private applyLevels(
    target:
      Map<number, number>,
    levels:
      readonly OrderBookDepthLevelInput[],
  ): void {
    for (
      const level
      of levels
    ) {
      if (
        level.quantity === 0
      ) {
        target.delete(
          level.price,
        );

        continue;
      }

      target.set(
        level.price,
        level.quantity,
      );
    }
  }

  private toLevels(
    source:
      ReadonlyMap<number, number>,
    direction:
      'asc'
      | 'desc',
  ): OrderBookDepthLevel[] {
    const multiplier =
      direction === 'asc'
        ? 1
        : -1;

    return [
      ...source.entries(),
    ]
      .sort(
        (
          [leftPrice],
          [rightPrice],
        ) =>
          (
            leftPrice
            - rightPrice
          )
          * multiplier,
      )
      .slice(
        0,
        this.maxLevelsPerSide,
      )
      .map(
        (
          [
            price,
            quantity,
          ],
        ) => ({
          price,
          quantity,
          quoteValue:
            price
            * quantity,
        }),
      );
  }

  private markGap(
    reason: string,
  ): OrderBookDepthApplyResult {
    this.synchronized = false;

    return toResult(
      'gap',
      reason,
      this.lastUpdateId,
      false,
    );
  }

  private assertSnapshot(
    snapshot:
      OrderBookDepthSnapshot,
  ): void {
    if (
      normalizeSymbol(
        snapshot.symbol,
      )
      !== this.symbol
    ) {
      throw new Error(
        'Order book snapshot symbol does not match the book',
      );
    }

    assertUpdateId(
      snapshot.lastUpdateId,
      'snapshot.lastUpdateId',
    );

    assertTimestamp(
      snapshot.receivedAt,
      'snapshot.receivedAt',
    );

    assertLevels(
      snapshot.bids,
      'snapshot.bids',
      false,
    );

    assertLevels(
      snapshot.asks,
      'snapshot.asks',
      false,
    );
  }

  private assertDelta(
    delta:
      OrderBookDepthDelta,
  ): void {
    if (
      normalizeSymbol(
        delta.symbol,
      )
      !== this.symbol
    ) {
      throw new Error(
        'Order book delta symbol does not match the book',
      );
    }

    assertUpdateId(
      delta.firstUpdateId,
      'delta.firstUpdateId',
    );

    assertUpdateId(
      delta.finalUpdateId,
      'delta.finalUpdateId',
    );

    if (
      delta.finalUpdateId
      < delta.firstUpdateId
    ) {
      throw new Error(
        'delta.finalUpdateId must be greater than or equal to delta.firstUpdateId',
      );
    }

    if (
      delta.previousFinalUpdateId
      !== null
    ) {
      assertUpdateId(
        delta.previousFinalUpdateId,
        'delta.previousFinalUpdateId',
      );
    }

    assertTimestamp(
      delta.eventTime,
      'delta.eventTime',
    );

    assertTimestamp(
      delta.receivedAt,
      'delta.receivedAt',
    );

    assertLevels(
      delta.bids,
      'delta.bids',
      true,
    );

    assertLevels(
      delta.asks,
      'delta.asks',
      true,
    );
  }
}
