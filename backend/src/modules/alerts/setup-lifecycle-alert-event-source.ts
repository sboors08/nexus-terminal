import type {
  SetupDetectionRuntimeEventSource,
} from '../setup-engine/setup-detection-runtime.types.js';
import type {
  SetupLifecycleEvent,
} from '../setup-engine/setup-lifecycle-events.types.js';
import type {
  AlertEventListener,
  AlertEventSourceContract,
  AlertEventType,
  AlertTriggerEvent,
  SetupAlertPayload,
} from './alerts.types.js';

function buildPayload(
  event: SetupLifecycleEvent,
): SetupAlertPayload {
  return {
    candidateId: event.candidateId,
    setupType: event.setupType,
    direction: event.direction,
    previousStage: event.previousStage,
    currentStage: event.currentStage,
    outcome: event.outcome ?? 'pending',
    currentPrice: event.candidate.currentPrice,
    distanceToLevelPct:
      event.candidate.distanceToLevelPct,
  };
}

function semanticEventType(
  event: SetupLifecycleEvent,
): AlertEventType | null {
  switch (event.type) {
    case 'breakout_confirmed':
      return 'setup_breakout';

    case 'rejection_confirmed':
      return 'setup_bounce';

    case 'setup_expired':
      return 'setup_invalidated';

    case 'stage_transition':
      if (
        event.currentStage
        === 'APPROACHING_THIRD_TOUCH'
      ) {
        return 'price_near_level';
      }

      if (
        event.currentStage
        === 'THIRD_TOUCH_CONFIRMED'
      ) {
        return 'setup_confirmation';
      }

      return null;

    case 'candidate_created':
      return null;
  }
}

export function mapSetupLifecycleEventToAlerts(
  event: SetupLifecycleEvent,
): AlertTriggerEvent[] {
  const payload = buildPayload(event);

  const events: AlertTriggerEvent[] = [
    {
      sourceEventId:
        `setup:${event.eventId}:stage`,
      source: 'setup_lifecycle',
      eventType: 'setup_stage_changed',
      occurredAt: event.occurredAt,
      symbol: event.symbol,
      timeframe: event.candidate.timeframe,
      entityId: event.candidateId,
      payload: { ...payload },
    },
  ];

  const semanticType =
    semanticEventType(event);

  if (semanticType) {
    events.push({
      sourceEventId:
        `setup:${event.eventId}:semantic`,
      source: 'setup_lifecycle',
      eventType: semanticType,
      occurredAt: event.occurredAt,
      symbol: event.symbol,
      timeframe: event.candidate.timeframe,
      entityId: event.candidateId,
      payload: { ...payload },
    });
  }

  return events;
}

export class SetupLifecycleAlertEventSource
implements AlertEventSourceContract {
  constructor(
    private readonly source:
      SetupDetectionRuntimeEventSource,
  ) {}

  subscribeAlertEvents(
    listener: AlertEventListener,
  ): () => void {
    return this.source
      .subscribeLifecycleEvents(
        (event) => {
          for (const alertEvent of
            mapSetupLifecycleEventToAlerts(event)) {
            try {
              listener(alertEvent);
            } catch {
              continue;
            }
          }
        },
      );
  }
}
