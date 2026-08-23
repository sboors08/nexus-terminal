import type {
  SetupLifecycleEvent,
} from './setup-lifecycle-events.types.js';
import type {
  SetupEventHistoryReader,
} from './setup-event-history.types.js';
import {
  MARKET_HISTORY_RUNTIME_CONTRACT_VERSION,
  type MarketHistoryRuntimeFilters,
  type MarketHistoryRuntimeItem,
  type MarketHistoryRuntimeResponse,
  type MarketHistoryRuntimeResult,
} from './market-history-runtime.types.js';

export const DEFAULT_MARKET_HISTORY_RUNTIME_LIMIT =
  200;

function resolveResult(
  event: SetupLifecycleEvent,
): MarketHistoryRuntimeResult {
  if (
    event.currentStage
    === 'BREAKOUT_CONFIRMED'
  ) {
    return 'breakout_confirmed';
  }

  if (
    event.currentStage
    === 'REJECTION_CONFIRMED'
  ) {
    return 'rejection_confirmed';
  }

  if (
    event.currentStage
    === 'SETUP_EXPIRED'
  ) {
    return 'expired';
  }

  return 'active';
}

function projectCandidateHistory(
  events: readonly SetupLifecycleEvent[],
): MarketHistoryRuntimeItem {
  const ordered = [
    ...events,
  ].sort(
    (
      left,
      right,
    ) =>
      left.eventId
      - right.eventId,
  );

  const first =
    ordered[0];

  const latest =
    ordered[
      ordered.length - 1
    ];

  if (
    !first
    || !latest
  ) {
    throw new Error(
      'Market History candidate projection requires at least one lifecycle event',
    );
  }

  const candidateCreated =
    ordered.find(
      (event) =>
        event.type
        === 'candidate_created',
    );

  const detectionEvent =
    candidateCreated
    ?? first;

  const result =
    resolveResult(
      latest,
    );

  const identityEvent =
    [...ordered]
      .reverse()
      .find(
        (event) =>
          event.candidate.episode
          !== undefined
          || event.candidate.causal
            !== undefined,
      );

  return {
    id:
      latest.candidateId,

    setupId:
      latest.candidateId,

    symbol:
      latest.symbol,

    timeframe:
      latest.candidate.timeframe,

    setupType:
      latest.setupType,

    direction:
      latest.direction,

    detectedAt:
      detectionEvent
        .candidate
        .createdAt,

    latestEventAt:
      latest.occurredAt,

    completedAt:
      result === 'active'
        ? null
        : latest.occurredAt,

    expiresAt:
      latest.candidate
        .expiresAt,

    result,

    stageAtDetection:
      detectionEvent
        .currentStage,

    currentStage:
      latest.currentStage,

    outcome:
      latest.outcome,

    detectedPrice:
      detectionEvent
        .candidate
        .currentPrice,

    currentPrice:
      latest.candidate
        .currentPrice,

    distanceToLevelPct:
      latest.candidate
        .distanceToLevelPct,

    level: {
      ...latest.candidate
        .level,
    },

    firstEventId:
      first.eventId,

    lastEventId:
      latest.eventId,

    lifecycleEventCount:
      ordered.length,

    historyComplete:
      candidateCreated
      !== undefined,

    episodeId:
      identityEvent
        ?.candidate
        .episode
        ?.id
      ?? null,

    lineId:
      identityEvent
        ?.candidate
        .episode
        ?.lineId
      ?? identityEvent
        ?.candidate
        .causal
        ?.lineId
      ?? null,

    lifecycle:
      ordered.map(
        (event) => ({
          eventId:
            event.eventId,

          type:
            event.type,

          occurredAt:
            event.occurredAt,

          previousStage:
            event.previousStage,

          currentStage:
            event.currentStage,

          outcome:
            event.outcome,
        }),
      ),
  };
}

function matchesFilters(
  item: MarketHistoryRuntimeItem,
  filters: MarketHistoryRuntimeFilters,
): boolean {
  if (
    filters.symbol
    !== undefined
    && item.symbol
      !== filters.symbol
  ) {
    return false;
  }

  if (
    filters.timeframe
    !== undefined
    && item.timeframe
      !== filters.timeframe
  ) {
    return false;
  }

  if (
    filters.setupType
    !== undefined
    && item.setupType
      !== filters.setupType
  ) {
    return false;
  }

  if (
    filters.direction
    !== undefined
    && item.direction
      !== filters.direction
  ) {
    return false;
  }

  if (
    filters.result
    !== undefined
    && item.result
      !== filters.result
  ) {
    return false;
  }

  return true;
}

export function buildMarketHistoryRuntimeResponse(
  history: SetupEventHistoryReader,
  filters: MarketHistoryRuntimeFilters = {},
): MarketHistoryRuntimeResponse {
  const limit =
    filters.limit
    ?? DEFAULT_MARKET_HISTORY_RUNTIME_LIMIT;

  if (
    !Number.isInteger(limit)
    || limit < 1
    || limit > 500
  ) {
    throw new Error(
      'Market History runtime limit must be an integer from 1 to 500',
    );
  }

  const grouped =
    new Map<
      string,
      SetupLifecycleEvent[]
    >();

  for (
    const event
    of history.getEvents()
  ) {
    const candidateEvents =
      grouped.get(
        event.candidateId,
      );

    if (candidateEvents) {
      candidateEvents.push(
        event,
      );
    } else {
      grouped.set(
        event.candidateId,
        [
          event,
        ],
      );
    }
  }

  const items =
    [...grouped.values()]
      .map(
        projectCandidateHistory,
      )
      .filter(
        (item) =>
          matchesFilters(
            item,
            filters,
          ),
      )
      .sort(
        (
          left,
          right,
        ) => {
          if (
            right.lastEventId
            !== left.lastEventId
          ) {
            return (
              right.lastEventId
              - left.lastEventId
            );
          }

          return left.setupId
            .localeCompare(
              right.setupId,
            );
        },
      )
      .slice(
        0,
        limit,
      );

  const status =
    history.getStatus();

  return {
    version:
      MARKET_HISTORY_RUNTIME_CONTRACT_VERSION,

    source: {
      state:
        status.state,

      eventsCount:
        status.eventsCount,

      droppedEventsCount:
        status.droppedEventsCount,

      persistence:
        status.persistence
          ? {
              state:
                status.persistence
                  .state,

              version:
                status.persistence
                  .version,

              hydrated:
                status.persistence
                  .hydrated,

              writable:
                status.persistence
                  .writable,

              lastPersistedAt:
                status.persistence
                  .lastPersistedAt,

              lastErrorCode:
                status.persistence
                  .lastErrorCode,
            }
          : null,
    },

    items,
  };
}
