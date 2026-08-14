import type {
  FastifyPluginAsync,
} from 'fastify';
import {
  apiContractRoutes,
} from './api-contract/api-contract.routes.js';
import type {
  FeedbackStore,
} from './api-contract/feedback-store.js';
import {
  healthRoutes,
} from './health/health.routes.js';
import type {
  MarketDataProvider,
} from './market-data/market-data.provider.js';
import {
  binanceSymbolUniverseRoutes,
} from './realtime-market-data/binance-symbol-universe.routes.js';
import type {
  BinanceSymbolUniverseService,
} from './realtime-market-data/binance-symbol-universe.service.js';
import type {
  MarketWideHistoryWarmupService,
} from './realtime-market-data/market-wide-history-warmup.service.js';
import {
  marketWideRealtimeRoutes,
} from './realtime-market-data/market-wide-realtime.routes.js';
import type {
  MarketWideRealtimeService,
} from './realtime-market-data/market-wide-realtime.service.js';
import {
  realtimeMarketDataRoutes,
} from './realtime-market-data/realtime-market-data.routes.js';
import type {
  RealtimeMarketDataService,
} from './realtime-market-data/realtime-market-data.types.js';
import {
  orderBookDepthRoutes,
} from './realtime-market-data/order-book-depth.routes.js';
import type {
  OrderBookDepthRuntimeService,
} from './realtime-market-data/order-book-depth-runtime.types.js';
import {
  setupReadRoutes,
} from './setup-engine/setup-read.routes.js';
import {
  setupEventHistoryRoutes,
} from './setup-engine/setup-event-history.routes.js';
import {
  setupLifecycleSseRoutes,
} from './setup-engine/setup-lifecycle-sse.routes.js';
import {
  levelV2ShadowReadRoutes,
} from './setup-engine/level-v2/level-v2-shadow-read.routes.js';
import {
  levelV2ShadowBreakReadRoutes,
} from './setup-engine/level-v2/level-v2-shadow-break-read.routes.js';
import {
  levelV2ShadowMarketEvidenceHistoryRoutes,
} from './setup-engine/level-v2/level-v2-shadow-market-evidence-history.routes.js';
import {
  levelV2ShadowMarketEvidenceBehaviorAnalysisRoutes,
} from './setup-engine/level-v2/level-v2-shadow-market-evidence-behavior-analysis.routes.js';
import {
  levelV2ShadowMarketEvidenceBehaviorHistoryRoutes,
} from './setup-engine/level-v2/level-v2-shadow-market-evidence-behavior-history.routes.js';
import {
  levelV2ShadowConfirmationCandidateRoutes,
} from './setup-engine/level-v2/level-v2-shadow-confirmation-candidate.routes.js';
import {
  levelV2ShadowConfirmationCandidateHistoryRoutes,
} from './setup-engine/level-v2/level-v2-shadow-confirmation-candidate-history.routes.js';
import {
  levelV2ShadowSetupOutcomeObservationRoutes,
} from './setup-engine/level-v2/level-v2-shadow-setup-outcome-observation.routes.js';
import {
  levelV2ShadowSetupOutcomeHistoryRoutes,
} from './setup-engine/level-v2/level-v2-shadow-setup-outcome-history.routes.js';
import {
  levelV2ShadowSetupQualitySampleRoutes,
} from './setup-engine/level-v2/level-v2-shadow-setup-quality-sample.routes.js';
import {
  levelV2ShadowSetupQualityDatasetRoutes,
} from './setup-engine/level-v2/level-v2-shadow-setup-quality-dataset.routes.js';
import type {
  LevelV2ShadowRuntimeReader,
} from './setup-engine/level-v2/level-v2-shadow-runtime.types.js';
import type {
  SetupDetectionRuntimeEventSource,
  SetupDetectionRuntimeReader,
} from './setup-engine/setup-detection-runtime.types.js';
import type {
  SetupEventHistoryReader,
} from './setup-engine/setup-event-history.types.js';
import {
  levelEngineFrozenSampleReadRoutes,
} from './level-engine/level-engine-frozen-sample-read.routes.js';
import type {
  LevelEngineFrozenSampleReader,
} from './level-engine/level-engine-frozen-sample-reader.js';
import {
  levelLinesRoutes,
} from './level-engine/level-lines.routes.js';
import {
  alertsRoutes,
} from './alerts/alerts.routes.js';
import type {
  AlertsRuntimeContract,
} from './alerts/alerts.types.js';
import type {
  UnifiedDecisionMarketContextReader,
} from './decision-engine/unified-decision.types.js';
import {
  unifiedDecisionLiveObservationRoutes,
} from './decision-engine/unified-decision-live-observation.routes.js';
import type {
  UnifiedDecisionLiveObservationRecorder,
} from './decision-engine/unified-decision-live-observation.types.js';
import {
  unifiedDecisionCoverageGapObservationRoutes,
} from './decision-engine/unified-decision-coverage-gap-observation.routes.js';
import type {
  UnifiedDecisionCoverageGapObserver,
} from './decision-engine/unified-decision-coverage-gap-observation.types.js';

interface ApiModulesOptions {
  marketDataProvider:
    MarketDataProvider;

  feedbackStore:
    FeedbackStore;

  realtimeMarketDataService?:
    RealtimeMarketDataService;

  orderBookDepthService?:
    OrderBookDepthRuntimeService;

  binanceSymbolUniverseService?:
    BinanceSymbolUniverseService;

  marketWideRealtimeService?:
    MarketWideRealtimeService;

  marketWideHistoryWarmupService?:
    MarketWideHistoryWarmupService;

  setupDetectionRuntimeReader?:
    SetupDetectionRuntimeReader;

  setupDetectionRuntimeEventSource?:
    SetupDetectionRuntimeEventSource;

  levelV2ShadowRuntimeReader?:
    LevelV2ShadowRuntimeReader;

  setupEventHistoryReader?:
    SetupEventHistoryReader;

  alertsRuntime?:
    AlertsRuntimeContract;

  unifiedDecisionMarketContextReader?:
    UnifiedDecisionMarketContextReader;

  unifiedDecisionLiveObservationRecorder?:
    UnifiedDecisionLiveObservationRecorder;

  unifiedDecisionCoverageGapObserver?:
    UnifiedDecisionCoverageGapObserver;

  levelEngineFrozenSampleReader?:
    LevelEngineFrozenSampleReader;
}

export const apiModules:
FastifyPluginAsync<
  ApiModulesOptions
> = async (
  app,
  options,
) => {
  await app.register(
    healthRoutes,
  );

  await app.register(
    levelLinesRoutes,
    {
      marketDataProvider:
        options.marketDataProvider,
      ...(
        options
          .realtimeMarketDataService
          ? {
              realtimeMarketDataService:
                options
                  .realtimeMarketDataService,
            }
          : {}
      ),
      ...(
        options
          .orderBookDepthService
          ? {
              orderBookDepthService:
                options
                  .orderBookDepthService,
            }
          : {}
      ),
      ...(
        options
          .setupDetectionRuntimeReader
          ? {
              setupDetectionRuntimeReader:
                options
                  .setupDetectionRuntimeReader,
            }
          : {}
      ),
      ...(
        options
          .unifiedDecisionMarketContextReader
          ? {
              unifiedDecisionMarketContextReader:
                options
                  .unifiedDecisionMarketContextReader,
            }
          : {}
      ),
      ...(
        options
          .unifiedDecisionLiveObservationRecorder
          ? {
              unifiedDecisionLiveObservationRecorder:
                options
                  .unifiedDecisionLiveObservationRecorder,
            }
          : {}
      ),
    },
  );

  if (
    options
      .levelEngineFrozenSampleReader
  ) {
    await app.register(
      levelEngineFrozenSampleReadRoutes,
      {
        levelEngineFrozenSampleReader:
          options
            .levelEngineFrozenSampleReader,
      },
    );
  }

  await app.register(
    apiContractRoutes,
    {
      marketDataProvider:
        options.marketDataProvider,

      feedbackStore:
        options.feedbackStore,
    },
  );

  await app.register(
    setupReadRoutes,
    {
      marketDataProvider:
        options.marketDataProvider,

      ...(
        options
          .setupDetectionRuntimeReader
          ? {
              setupDetectionRuntimeReader:
                options
                  .setupDetectionRuntimeReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    levelV2ShadowReadRoutes,
    {
      ...(
        options
          .levelV2ShadowRuntimeReader
          ? {
              levelV2ShadowRuntimeReader:
                options
                  .levelV2ShadowRuntimeReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    levelV2ShadowBreakReadRoutes,
    {
      ...(
        options
          .levelV2ShadowRuntimeReader
          ? {
              levelV2ShadowRuntimeReader:
                options
                  .levelV2ShadowRuntimeReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    levelV2ShadowMarketEvidenceHistoryRoutes,
    {
      ...(
        options
          .levelV2ShadowRuntimeReader
          ? {
              levelV2ShadowRuntimeReader:
                options
                  .levelV2ShadowRuntimeReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    levelV2ShadowMarketEvidenceBehaviorAnalysisRoutes,
    {
      ...(
        options
          .levelV2ShadowRuntimeReader
          ? {
              levelV2ShadowRuntimeReader:
                options
                  .levelV2ShadowRuntimeReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    levelV2ShadowMarketEvidenceBehaviorHistoryRoutes,
    {
      ...(
        options
          .levelV2ShadowRuntimeReader
          ? {
              levelV2ShadowRuntimeReader:
                options
                  .levelV2ShadowRuntimeReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    levelV2ShadowConfirmationCandidateRoutes,
    {
      ...(
        options
          .levelV2ShadowRuntimeReader
          ? {
              levelV2ShadowRuntimeReader:
                options
                  .levelV2ShadowRuntimeReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    levelV2ShadowConfirmationCandidateHistoryRoutes,
    {
      ...(
        options
          .levelV2ShadowRuntimeReader
          ? {
              levelV2ShadowRuntimeReader:
                options
                  .levelV2ShadowRuntimeReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    levelV2ShadowSetupOutcomeObservationRoutes,
    {
      ...(
        options
          .levelV2ShadowRuntimeReader
          ? {
              levelV2ShadowRuntimeReader:
                options
                  .levelV2ShadowRuntimeReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    levelV2ShadowSetupOutcomeHistoryRoutes,
    {
      ...(
        options
          .levelV2ShadowRuntimeReader
          ? {
              levelV2ShadowRuntimeReader:
                options
                  .levelV2ShadowRuntimeReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    levelV2ShadowSetupQualitySampleRoutes,
    {
      ...(
        options
          .levelV2ShadowRuntimeReader
          ? {
              levelV2ShadowRuntimeReader:
                options
                  .levelV2ShadowRuntimeReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    levelV2ShadowSetupQualityDatasetRoutes,
    {
      ...(
        options
          .levelV2ShadowRuntimeReader
          ? {
              levelV2ShadowRuntimeReader:
                options
                  .levelV2ShadowRuntimeReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    setupEventHistoryRoutes,
    {
      ...(
        options
          .setupEventHistoryReader
          ? {
              setupEventHistoryReader:
                options
                  .setupEventHistoryReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    alertsRoutes,
    {
      ...(
        options.alertsRuntime
          ? {
              alertsRuntime:
                options.alertsRuntime,
            }
          : {}
      ),
    },
  );

  await app.register(
    unifiedDecisionLiveObservationRoutes,
    {
      ...(
        options
          .unifiedDecisionLiveObservationRecorder
          ? {
              recorder:
                options
                  .unifiedDecisionLiveObservationRecorder,
            }
          : {}
      ),
    },
  );

  await app.register(
    unifiedDecisionCoverageGapObservationRoutes,
    {
      ...(options.unifiedDecisionCoverageGapObserver
        ? { observer: options.unifiedDecisionCoverageGapObserver }
        : {}),
    },
  );

  await app.register(
    setupLifecycleSseRoutes,
    {
      ...(
        options
          .setupEventHistoryReader
          ? {
              setupEventHistoryReader:
                options
                  .setupEventHistoryReader,
            }
          : {}
      ),

      ...(
        options
          .setupDetectionRuntimeEventSource
          ? {
              setupDetectionRuntimeEventSource:
                options
                  .setupDetectionRuntimeEventSource,
            }
          : {}
      ),
    },
  );

  if (
    options
      .realtimeMarketDataService
  ) {
    await app.register(
      realtimeMarketDataRoutes,
      {
        realtimeMarketDataService:
          options
            .realtimeMarketDataService,
        ...(
          options
            .marketWideRealtimeService
            ? {
                marketWideRealtimeService:
                  options
                    .marketWideRealtimeService,
              }
            : {}
        ),
      },
    );
  }

  if (
    options
      .orderBookDepthService
  ) {
    await app.register(
      orderBookDepthRoutes,
      {
        orderBookDepthService:
          options
            .orderBookDepthService,
      },
    );
  }

  if (
    options
      .binanceSymbolUniverseService
  ) {
    await app.register(
      binanceSymbolUniverseRoutes,
      {
        binanceSymbolUniverseService:
          options
            .binanceSymbolUniverseService,
      },
    );
  }

  if (
    options
      .marketWideRealtimeService
  ) {
    await app.register(
      marketWideRealtimeRoutes,
      {
        marketWideRealtimeService:
          options
            .marketWideRealtimeService,
        ...(
          options
            .marketWideHistoryWarmupService
            ? {
                marketWideHistoryWarmupService:
                  options
                    .marketWideHistoryWarmupService,
              }
            : {}
        ),
      },
    );
  }
};
