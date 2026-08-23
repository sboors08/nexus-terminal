import type {
  SetupLifecycleEvent,
} from './setup-lifecycle-events.types.js';
import type {
  SetupEventHistoryReader,
} from './setup-event-history.types.js';
import {
  SETUP_REPLAY_RUNTIME_CONTRACT_VERSION,
  type SetupReplayRuntimeFrame,
  type SetupReplayRuntimeResponse,
  type SetupReplayRuntimeResult,
} from './setup-replay-runtime.types.js';

function resolveResult(
  event: SetupLifecycleEvent,
): SetupReplayRuntimeResult {
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

function resolveEpisodeId(
  event: SetupLifecycleEvent,
): string | null {
  return event.candidate
    .episode
    ?.id
    ?? null;
}

function resolveLineId(
  event: SetupLifecycleEvent,
): string | null {
  return event.candidate
    .episode
    ?.lineId
    ?? event.candidate
      .causal
      ?.lineId
    ?? null;
}

function projectFrame(
  event: SetupLifecycleEvent,
  index: number,
): SetupReplayRuntimeFrame {
  return {
    index,
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
    currentPrice:
      event.candidate
        .currentPrice,
    distanceToLevelPct:
      event.candidate
        .distanceToLevelPct,
    snapshotUpdatedAt:
      event.candidate
        .updatedAt,
    expiresAt:
      event.candidate
        .expiresAt,
    level: {
      ...event.candidate
        .level,
    },
    episodeId:
      resolveEpisodeId(
        event,
      ),
    lineId:
      resolveLineId(
        event,
      ),
  };
}

export function buildSetupReplayRuntimeResponse(
  history: SetupEventHistoryReader,
  candidateId: string,
): SetupReplayRuntimeResponse | null {
  const ordered =
    history
      .getCandidateEvents(
        candidateId,
      )
      .slice()
      .sort(
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
    return null;
  }

  const candidateCreated =
    ordered.find(
      (event) =>
        event.type
        === 'candidate_created',
    );

  const identityEvent =
    [...ordered]
      .reverse()
      .find(
        (event) =>
          resolveEpisodeId(
            event,
          ) !== null
          || resolveLineId(
            event,
          ) !== null,
      );

  const status =
    history.getStatus();

  const persistence =
    status.persistence;

  const result =
    resolveResult(
      latest,
    );

  return {
    version:
      SETUP_REPLAY_RUNTIME_CONTRACT_VERSION,

    source: {
      state:
        status.state,

      eventsCount:
        status.eventsCount,

      droppedEventsCount:
        status.droppedEventsCount,

      persistence:
        persistence
          ? {
              state:
                persistence.state,

              version:
                persistence.version,

              hydrated:
                persistence.hydrated,

              writable:
                persistence.writable,

              lastPersistedAt:
                persistence
                  .lastPersistedAt,

              lastErrorCode:
                persistence
                  .lastErrorCode,
            }
          : null,
    },

    capabilities: {
      lifecycleFrames:
        true,

      eventSnapshotPrices:
        true,

      candles:
        false,

      aggTrades:
        false,

      orderBook:
        false,

      pnl:
        false,
    },

    session: {
      id:
        `setup-replay:${candidateId}`,

      setupId:
        candidateId,

      candidateId,

      symbol:
        latest.symbol,

      timeframe:
        latest.candidate
          .timeframe,

      setupType:
        latest.setupType,

      direction:
        latest.direction,

      detectedAt:
        (
          candidateCreated
          ?? first
        ).candidate
          .createdAt,

      firstRetainedAt:
        first.occurredAt,

      latestEventAt:
        latest.occurredAt,

      completedAt:
        result === 'active'
          ? null
          : latest.occurredAt,

      result,

      historyComplete:
        candidateCreated
        !== undefined,

      firstEventId:
        first.eventId,

      lastEventId:
        latest.eventId,

      frameCount:
        ordered.length,

      episodeId:
        identityEvent
          ? resolveEpisodeId(
              identityEvent,
            )
          : null,

      lineId:
        identityEvent
          ? resolveLineId(
              identityEvent,
            )
          : null,

      frames:
        ordered.map(
          projectFrame,
        ),
    },
  };
}
