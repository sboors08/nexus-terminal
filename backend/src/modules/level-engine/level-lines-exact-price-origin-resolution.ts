import {
  LEVEL_LINES_EXACT_PRICE_ORIGIN_RESOLUTION_VERSION,
} from './level-lines-exact-price-origin-resolution.types.js';
import type {
  LevelLinesExactPriceOriginResolutionDecision,
  LevelLinesExactPriceOriginResolutionInput,
  LevelLinesExactPriceOriginResolutionResult,
} from './level-lines-exact-price-origin-resolution.types.js';
import type {
  LevelLine,
  LevelLineStatus,
} from './level-lines.types.js';

function fail(
  message: string,
): never {
  throw new Error(
    `Level Lines exact-price origin resolution: ${message}`,
  );
}

function timestamp(
  value: string,
  label: string,
): number {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    fail(`${label} must be an ISO timestamp`);
  }

  return parsed;
}

function groupKey(
  line: LevelLine,
): string {
  return [
    line.symbol,
    line.timeframe,
    line.kind,
    String(line.price),
  ].join('|');
}

function statusAt(
  line: LevelLine,
  at: string,
): LevelLineStatus {
  const atMs = timestamp(at, 'resolution time');

  if (
    line.workedAt
    && timestamp(
      line.workedAt,
      'line.workedAt',
    ) <= atMs
  ) {
    return 'worked';
  }

  if (
    line.confirmedAt
    && timestamp(
      line.confirmedAt,
      'line.confirmedAt',
    ) <= atMs
  ) {
    return 'confirmed';
  }

  return 'candidate';
}

function validateInput(
  input:
    LevelLinesExactPriceOriginResolutionInput,
): void {
  const historyById =
    new Map<string, LevelLine>();

  for (const line of input.lines) {
    if (historyById.has(line.id)) {
      fail(`duplicate history line id: ${line.id}`);
    }

    if (
      line.symbol !== input.symbol
      || line.timeframe !== input.timeframe
    ) {
      fail(
        `history line ${line.id} does not match the input market`,
      );
    }

    if (
      !Number.isFinite(line.price)
      || line.price <= 0
    ) {
      fail(`line ${line.id} has invalid price`);
    }

    timestamp(
      line.originExtremumAt,
      'line.originExtremumAt',
    );
    timestamp(
      line.activeFrom,
      'line.activeFrom',
    );
    historyById.set(line.id, line);
  }

  const currentIds = new Set<string>();

  for (const line of input.currentLevels) {
    if (currentIds.has(line.id)) {
      fail(`duplicate current line id: ${line.id}`);
    }

    if (!historyById.has(line.id)) {
      fail(
        `current line ${line.id} is missing from history`,
      );
    }

    if (
      line.status !== 'candidate'
      && line.status !== 'confirmed'
      && line.status !== 'worked'
    ) {
      fail(
        `current line ${line.id} has terminal status ${line.status}`,
      );
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        input.currentLevelVisibleFrom,
        line.id,
      )
    ) {
      fail(
        `current line ${line.id} is missing its visibility boundary`,
      );
    }

    const visibleFrom =
      input.currentLevelVisibleFrom[
        line.id
      ];

    if (visibleFrom === undefined) {
      fail(
        `current line ${line.id} has an undefined visibility boundary`,
      );
    }

    const visibleFromMs = timestamp(
      visibleFrom,
      `currentLevelVisibleFrom.${line.id}`,
    );

    if (
      visibleFromMs
      < timestamp(
          line.activeFrom,
          'line.activeFrom',
        )
    ) {
      fail(
        `current line ${line.id} visibility precedes activeFrom`,
      );
    }

    currentIds.add(line.id);
  }
}

function compareOrigins(
  left: LevelLine,
  right: LevelLine,
): number {
  return timestamp(
    left.originExtremumAt,
    'left.originExtremumAt',
  ) - timestamp(
    right.originExtremumAt,
    'right.originExtremumAt',
  ) || left.id.localeCompare(right.id);
}

function decisionKey(
  older: LevelLine,
  newer: LevelLine,
): string {
  return `${groupKey(older)}|${older.id}|${newer.id}`;
}

export function resolveLevelLinesExactPriceOrigins(
  input:
    LevelLinesExactPriceOriginResolutionInput,
): LevelLinesExactPriceOriginResolutionResult {
  validateInput(input);

  const grouped =
    new Map<string, LevelLine[]>();

  for (const line of input.currentLevels) {
    const key = groupKey(line);
    const values = grouped.get(key) ?? [];

    values.push(line);
    grouped.set(key, values);
  }

  const decisions:
    LevelLinesExactPriceOriginResolutionDecision[] = [];
  const selectedIds = new Set<string>();
  let collisionGroupCount = 0;
  let activeIdentityReuseCount = 0;
  let workedIdentityRearmCount = 0;

  const sortedGroups = [...grouped.entries()].sort(
    ([left], [right]) => left.localeCompare(right),
  );

  for (const [key, values] of sortedGroups) {
    const ordered = [...values].sort(compareOrigins);
    let current = ordered[0];

    if (!current) {
      continue;
    }

    if (ordered.length > 1) {
      collisionGroupCount += 1;
    }

    for (
      let index = 1;
      index < ordered.length;
      index += 1
    ) {
      const newer = ordered[index];

      if (!newer) {
        continue;
      }

      const older = current;
      const newerVisibleFrom =
        input.currentLevelVisibleFrom[
          newer.id
        ];

      if (newerVisibleFrom === undefined) {
        fail(
          `current line ${newer.id} has an undefined visibility boundary`,
        );
      }
      const olderStatusAtResolution =
        statusAt(
          older,
          newerVisibleFrom,
        );

      if (olderStatusAtResolution === 'worked') {
        workedIdentityRearmCount += 1;
        current = newer;
        decisions.push(
          Object.freeze({
            key:
              decisionKey(older, newer),
            groupKey: key,
            symbol: older.symbol,
            timeframe: older.timeframe,
            kind: older.kind,
            price: older.price,
            olderLineId: older.id,
            newerLineId: newer.id,
            olderStatusAtResolution,
            action:
              'retire_worked_identity_before_rearm',
            effectiveAt:
              newerVisibleFrom,
            currentLineId: newer.id,
            suppressedCurrentLineId:
              older.id,
            retainedHistoryLineId:
              older.id,
            rationale: Object.freeze([
              'older_exact_price_identity_worked_before_new_origin_became_active',
              'worked_identity_is_retained_in_history_but_removed_from_current_projection',
              'new_origin_starts_the_current_exact_price_episode',
            ]),
          }),
        );
        continue;
      }

      activeIdentityReuseCount += 1;
      decisions.push(
        Object.freeze({
          key:
            decisionKey(older, newer),
          groupKey: key,
          symbol: older.symbol,
          timeframe: older.timeframe,
          kind: older.kind,
          price: older.price,
          olderLineId: older.id,
          newerLineId: newer.id,
          olderStatusAtResolution,
          action:
            'reuse_active_exact_price_identity',
          effectiveAt:
            newerVisibleFrom,
          currentLineId: older.id,
          suppressedCurrentLineId:
            newer.id,
          retainedHistoryLineId:
            newer.id,
          rationale: Object.freeze([
            'older_exact_price_identity_was_still_candidate_or_confirmed',
            'new_origin_reconfirms_the_existing_current_identity',
            'new_origin_is_retained_in_history_without_a_second_current_line',
          ]),
        }),
      );
    }

    selectedIds.add(current.id);
  }

  const currentLevels = Object.freeze(
    input.currentLevels.filter(
      (line) => selectedIds.has(line.id),
    ),
  );
  const frozenDecisions = Object.freeze([
    ...decisions,
  ]);

  return Object.freeze({
    version:
      LEVEL_LINES_EXACT_PRICE_ORIGIN_RESOLUTION_VERSION,
    symbol: input.symbol,
    timeframe: input.timeframe,
    currentLevels,
    decisions: frozenDecisions,
    totals: Object.freeze({
      historyLineCount: input.lines.length,
      inputCurrentLineCount:
        input.currentLevels.length,
      resolvedCurrentLineCount:
        currentLevels.length,
      exactPriceGroupCount: grouped.size,
      collisionGroupCount,
      decisionCount:
        frozenDecisions.length,
      activeIdentityReuseCount,
      workedIdentityRearmCount,
      suppressedCurrentLineCount:
        input.currentLevels.length
        - currentLevels.length,
      retainedHistoryLineCount:
        input.lines.length,
    }),
    preservesFullHistory: true,
    usesExactPriceOnly: true,
    mergesNearbyPrices: false,
    changesTradingRules: false,
    createsSetup: false,
    createsSignal: false,
    createsTradeOrder: false,
    usesFutureCandles: false,
  });
}
