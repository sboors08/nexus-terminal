import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { useFeedbackPageContext } from '@/shared/feedback/FeedbackProvider';
import {
  buildWorkspaceLiquidityMap,
  buildWorkspaceMarketDynamics,
  buildWorkspaceRealtimeView,
  buildWorkspaceSetupConfirmation,
  buildWorkspaceTradeTape,
  resolveWorkspaceLiquidityBucketSize,
  useOrderBookDepth,
  useRealtimeMarketData,
} from '@/shared/realtime';
import {
  buildMarketWorkspaceSetupId,
  buildReplayUrl,
  isMarketWorkspaceSetupId,
  buildSetupSelectionUrl,
  isWorkspaceTimeframe,
} from '@/shared/routing/setupContext';
import {
  TRADING_PRESETS,
  isScannerWindow,
  isTradingPreset,
  type ScannerWindow,
  type TradingPreset,
  type TradingPresetDefinition,
} from '@/shared/config/tradingPresets';
import {
  nexusApi,
  useApiQuery,
  useSetupLifecycleRefresh,
  type PrintSide,
  type Setup,
  type WorkspaceViewData,
} from '@/shared/api';
import {
  NexusCandlestickChart,
  useMarketCandles,
  type NexusChartPriceLine,
} from '@/shared/charts';
import { AsyncDataState } from '@/shared/ui/AsyncDataState';
import { DirectionBadge } from '@/shared/ui/DirectionBadge';
import { SetupStageBadge } from '@/shared/ui/SetupStageBadge';
import styles from './WorkspacePage.module.css';

type Timeframe = '1m' | '5m' | '15m';
type TapeFilter = 'all' | PrintSide;

type WorkspacePageData = {
  contractSetup: Setup;
  view: WorkspaceViewData;
  replayAvailable: boolean;
};

function ChecklistIcon({ state }: { state: 'passed' | 'warning' | 'waiting' }) {
  if (state === 'passed') return <span aria-hidden="true">✓</span>;
  if (state === 'warning') return <span aria-hidden="true">!</span>;
  return <span aria-hidden="true">·</span>;
}

function WorkspacePageContent({ data }: { data: WorkspacePageData }) {
  const { contractSetup, view, replayAvailable } = data;
  const { selectedSetup, stageFlow } = view;
  const isMarketPreview =
    isMarketWorkspaceSetupId(
      contractSetup.id,
    );
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPreset = searchParams.get('preset');
  const preset: TradingPreset = isTradingPreset(requestedPreset)
    ? requestedPreset
    : 'scalping';
  const presetDefinition: TradingPresetDefinition = TRADING_PRESETS[preset];
  const requestedScannerWindow = searchParams.get('scannerWindow');
  const scannerWindow: ScannerWindow =
    isScannerWindow(requestedScannerWindow)
    && presetDefinition.scannerWindows.includes(requestedScannerWindow)
      ? requestedScannerWindow
      : presetDefinition.defaultScannerWindow;
  const requestedTimeframe = searchParams.get('timeframe');
  const defaultTimeframe: Timeframe = isWorkspaceTimeframe(selectedSetup.timeframe) ? selectedSetup.timeframe : '5m';
  const timeframe: Timeframe = isWorkspaceTimeframe(requestedTimeframe) ? requestedTimeframe : defaultTimeframe;

  const candlesQuery = useMarketCandles({
    symbol: contractSetup.symbol,
    timeframe,
  });

  const latestCandle =
    candlesQuery.status === 'success'
    && candlesQuery.data?.length
      ? candlesQuery.data[
          candlesQuery.data.length - 1
        ]
      : undefined;

  const candleFreshness =
    candlesQuery.freshness;

  const hasCandleData =
    Boolean(
      candlesQuery.data?.length,
    );

  const hasCandlePrice =
    latestCandle !== undefined;

  const chartCurrentPrice =
    latestCandle?.close
    ?? contractSetup.currentPrice;

  const chartPriceHeading =
    hasCandlePrice
      ? candleFreshness.state
          === 'live'
        ? 'Текущая цена'
        : 'Последняя цена'
      : 'Цена сетапа';

  const chartPriceLineTitle =
    hasCandlePrice
      ? candleFreshness.label
      : 'SETUP';

  const chartPriceLineColor =
    hasCandlePrice
    && candleFreshness.state
      === 'stale'
      ? '#d5a928'
      : '#4aa8ff';

  const chartUpdatedAtLabel = (() => {
    if (
      candleFreshness.lastUpdatedAt
      === null
    ) {
      return 'время неизвестно';
    }

    const timestamp =
      new Date(
        candleFreshness.lastUpdatedAt,
      );

    if (
      !Number.isFinite(
        timestamp.getTime(),
      )
    ) {
      return 'время неизвестно';
    }

    return timestamp.toLocaleTimeString(
      'ru-RU',
      {
        hour:
          '2-digit',
        minute:
          '2-digit',
        second:
          '2-digit',
      },
    );
  })();

  const chartPriceSource =
    hasCandlePrice
      ? [
          candleFreshness.label,
          candleFreshness
            .lastUpdatedLabel,
          chartUpdatedAtLabel,
        ].join(
          ' · ',
        )
      : candleFreshness.state
          === 'collecting'
        ? 'COLLECTING · ожидаем свечи'
        : [
            candleFreshness.label,
            'свечи недоступны',
          ].join(
            ' · ',
          );

  const chartLevelCenter =
    contractSetup.level
      .centerPrice;

  const chartZoneLow =
    contractSetup.level
      .zoneLow;

  const chartZoneHigh =
    contractSetup.level
      .zoneHigh;

  const formatChartPrice = (
    value: number,
  ) =>
    value.toLocaleString(
      'ru-RU',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      },
    );

  const chartLevelLabel =
    `${formatChartPrice(chartZoneLow)}–${formatChartPrice(chartZoneHigh)}`;

  const chartPriceLines =
    useMemo<readonly NexusChartPriceLine[]>(
      () => {
        const currentPriceLine:
        NexusChartPriceLine = {
          price:
            chartCurrentPrice,

          color:
            chartPriceLineColor,

          title:
            chartPriceLineTitle,

          lineStyle:
            'dashed',
        };

        if (isMarketPreview) {
          return [
            currentPriceLine,
          ];
        }

        return [
          {
            price:
              chartZoneLow,

            color:
              '#d5a928',

            lineStyle:
              'dashed',

            axisLabelVisible:
              false,
          },
          {
            price:
              chartLevelCenter,

            color:
              '#f0b90b',

            title:
              'УРОВЕНЬ',

            lineStyle:
              'solid',
          },
          {
            price:
              chartZoneHigh,

            color:
              '#d5a928',

            lineStyle:
              'dashed',

            axisLabelVisible:
              false,
          },

          currentPriceLine,
        ];
      },
      [
        chartCurrentPrice,
        chartPriceLineColor,
        chartPriceLineTitle,
        chartLevelCenter,
        chartZoneHigh,
        chartZoneLow,
        isMarketPreview,
      ],
    );
  const [tapeFilter, setTapeFilter] = useState<TapeFilter>('all');
  const [noteOpen, setNoteOpen] = useState(false);

  const realtime = useRealtimeMarketData({
    symbol: selectedSetup.symbol,
  });

  const realtimeSnapshot =
    realtime.snapshots[selectedSetup.symbol];

  const realtimeWorkspace = useMemo(
    () => buildWorkspaceRealtimeView(
      realtimeSnapshot,
      selectedSetup.price,
      candlesQuery.data ?? [],
      realtime.lifecycleState,
      realtime.status?.state ?? null,
    ),
    [
      realtimeSnapshot,
      selectedSetup.price,
      candlesQuery.data,
      realtime.lifecycleState,
      realtime.status?.state,
    ],
  );

  const [tradeTapeNow, setTradeTapeNow] = useState(
    () => Date.now(),
  );

  useEffect(() => {
    const intervalId =
      window.setInterval(
        () => {
          setTradeTapeNow(
            Date.now(),
          );
        },
        5_000,
      );

    return () => {
      window.clearInterval(
        intervalId,
      );
    };
  }, []);

  const tradeTape = useMemo(
    () => buildWorkspaceTradeTape({
      snapshot:
        realtimeSnapshot,
      lifecycleState:
        realtime.lifecycleState,
      backendState:
        realtime.status?.state
        ?? null,
      error:
        realtime.error,
      now:
        tradeTapeNow,
    }),
    [
      realtime.error,
      realtime.lifecycleState,
      realtime.status?.state,
      realtimeSnapshot,
      tradeTapeNow,
    ],
  );

  const liquidityBucketSize =
    useMemo(
      () =>
        resolveWorkspaceLiquidityBucketSize(
          chartCurrentPrice,
        ),
      [
        chartCurrentPrice,
      ],
    );

  const orderBook =
    useOrderBookDepth({
      symbol:
        selectedSetup.symbol,
      levelsLimit:
        60,
      depthRangePct:
        0.2,
      bucketSize:
        liquidityBucketSize,
      maxBucketsPerSide:
        20,
    });

  const liquidityMap =
    useMemo(
      () =>
        buildWorkspaceLiquidityMap({
          snapshot:
            orderBook.snapshot,
          lifecycleState:
            orderBook.lifecycleState,
          status:
            orderBook.status,
          error:
            orderBook.error,
          now:
            tradeTapeNow,
          maxRowsPerSide:
            5,
        }),
      [
        orderBook.error,
        orderBook.lifecycleState,
        orderBook.snapshot,
        orderBook.status,
        tradeTapeNow,
      ],
    );

  const marketDynamics =
    useMemo(
      () =>
        buildWorkspaceMarketDynamics({
          tradeTape,
          liquidityMap,
        }),
      [
        liquidityMap,
        tradeTape,
      ],
    );

  const setupConfirmation =
    useMemo(
      () =>
        buildWorkspaceSetupConfirmation({
          direction:
            selectedSetup.direction,
          marketDynamics,
        }),
      [
        marketDynamics,
        selectedSetup.direction,
      ],
    );

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('setup');
    nextParams.set('setupId', contractSetup.id);
    nextParams.set('symbol', contractSetup.symbol);
    nextParams.set('preset', preset);
    nextParams.set('scannerWindow', scannerWindow);
    nextParams.set('timeframe', timeframe);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [contractSetup.id, contractSetup.symbol, preset, scannerWindow, searchParams, setSearchParams, timeframe]);

  const selectTimeframe = (value: Timeframe) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('setupId', contractSetup.id);
    nextParams.set('symbol', contractSetup.symbol);
    nextParams.set('timeframe', value);
    setSearchParams(nextParams);
  };

  useFeedbackPageContext({
    screen: 'Workspace',
    symbol: contractSetup.symbol,
    timeframe,
    setupId: contractSetup.id,
  });

  const visiblePrints =
    tradeTape.prints.filter(
      (print) =>
        tapeFilter === 'all'
        || print.side
          === tapeFilter,
    );
  const resultLabel = selectedSetup.kind.includes('Отскок') ? 'Отскок' : 'Пробой';
  const currentStageIndex = { observation: 0, approach: 1, confirmation: 2, triggered: 3 }[selectedSetup.stage];

  const isRuntimeSetup =
    selectedSetup.runtimeData
    === true;

  const hasRuntimeSetupContext =
    isRuntimeSetup;

  const displayedStageFlow =
    stageFlow.map(
      (stage, index) =>
        index === 3
          ? {
              ...stage,

              label:
                resultLabel,

              description:
                resultLabel === 'Отскок'
                  ? 'Подтверждён отскок от зоны'
                  : 'Подтверждён выход за зону',
            }
          : stage,
    );
  const baseAsset = selectedSetup.symbol.replace('USDT', '');
  const priceDecimals = selectedSetup.price.includes('.') ? selectedSetup.price.split('.')[1].length : 2;
  const formatPrice = (value: number) => value.toLocaleString('ru-RU', {
    minimumFractionDigits: priceDecimals,
    maximumFractionDigits: priceDecimals,
  });

  const formatTapeTime = (
    timestamp: string,
  ) =>
    new Date(
      timestamp,
    ).toLocaleTimeString(
      'ru-RU',
      {
        hour:
          '2-digit',
        minute:
          '2-digit',
        second:
          '2-digit',
      },
    );

  const formatTapeQuantity = (
    quantity: number,
  ) =>
    [
      quantity.toLocaleString(
        'ru-RU',
        {
          maximumFractionDigits:
            8,
        },
      ),
      baseAsset,
    ].join(
      ' ',
    );

  const formatTapeQuoteValue = (
    value: number,
    includePositiveSign = false,
  ) => {
    const sign =
      includePositiveSign
      && value > 0
        ? '+'
        : '';

    return [
      sign
      + value.toLocaleString(
        'ru-RU',
        {
          notation:
            'compact',
          maximumFractionDigits:
            1,
        },
      ),
      'USDT',
    ].join(
      ' ',
    );
  };

  const formatTapePercent = (
    value: number | null,
    includePositiveSign = true,
  ) => {
    if (value === null) {
      return '—';
    }

    const sign =
      includePositiveSign
      && value > 0
        ? '+'
        : '';

    return sign
      + value.toLocaleString(
        'ru-RU',
        {
          maximumFractionDigits:
            1,
        },
      )
      + '%';
  };
  const formatLiquidityDistance = (
    value: number | null,
  ) => {
    if (value === null) {
      return '—';
    }

    const normalizedValue =
      Math.abs(
        value,
      ) < 0.005
        ? 0
        : value;

    const sign =
      normalizedValue > 0
        ? '+'
        : '';

    return sign
      + normalizedValue.toLocaleString(
          'ru-RU',
          {
            minimumFractionDigits:
              2,
            maximumFractionDigits:
              2,
          },
        )
      + '%';
  };

  const formatLiquidityDepth = (
    value: number,
  ) =>
    formatTapeQuoteValue(
      value,
    );

  const volumeAnomaly =
    selectedSetup.volumeAnomaly;

  const tradesAnomaly =
    selectedSetup.tradesAnomaly;

  const btcStrengthValue =
    selectedSetup.btcStrength;

  const hasActivityMetrics =
    volumeAnomaly !== null
    && tradesAnomaly !== null;

  const hasBtcStrengthMetric =
    btcStrengthValue !== null;

  const workspaceChecklist = [
    {
      id:
        'check-touches',

      label:
        'Минимум 3 касания',

      detail:
        `Подтверждено касаний: ${selectedSetup.touches}.`,

      state:
        selectedSetup.touches >= 3
          ? 'passed'
          : 'warning',
    },
    {
      id:
        'check-pullbacks',

      label:
        'Характер откатов',

      detail:
        isRuntimeSetup
          ? 'Метрика откатов ещё не подключена к кандидату.'
          : `${selectedSetup.pullbackDepth} откаты возле найденной зоны.`,

      state:
        isRuntimeSetup
          ? 'waiting'
          : selectedSetup.pullbackDepth
              === 'Неглубокие'
            ? 'passed'
            : 'warning',
    },
    {
      id:
        'check-activity',

      label:
        'Активность выше средней',

      detail:
        !hasActivityMetrics
          ? 'Данные объёма и количества сделок пока собираются.'
          : `Объём ${volumeAnomaly.toFixed(2)}×, сделки ${tradesAnomaly.toFixed(2)}×.`,

      state:
        !hasActivityMetrics
          ? 'waiting'
          : volumeAnomaly >= 1.5
            && tradesAnomaly >= 1.5
            ? 'passed'
            : 'warning',
    },
    {
      id:
        'check-btc',

      label:
        'BTC-контекст поддерживает',

      detail:
        !hasBtcStrengthMetric
          ? 'BTC-контекст пока собирается.'
          : `Сила относительно BTC: ${selectedSetup.btcStrengthLabel}, корреляция ${selectedSetup.btcCorrelation}.`,

      state:
        !hasBtcStrengthMetric
          ? 'waiting'
          : (
              selectedSetup.direction
                === 'long'
              && btcStrengthValue > 0
            )
            || (
              selectedSetup.direction
                === 'short'
              && btcStrengthValue < 0
            )
            ? 'passed'
            : 'warning',
    },
    {
      id:
        'check-trigger',

      label:
        'Live-поток подтверждает направление',

      detail:
        [
          setupConfirmation
            .freshness
            .label,
          setupConfirmation
            .summary,
        ].join(
          ' · ',
        ),

      state:
        setupConfirmation
          .isLiveConfirmation
          ? 'passed'
          : setupConfirmation
              .blockingCount > 0
            ? 'warning'
            : 'waiting',
    },
    {
      id:
        'check-result',

      label:
        `${resultLabel}: подтверждение результата`,

      detail:
        selectedSetup.stage
          === 'triggered'
          ? isRuntimeSetup
            ? `${resultLabel} подтверждён Setup Engine.`
            : `${resultLabel} отмечен в демонстрационном сетапе.`
          : `Ожидается подтверждение возле зоны ${chartLevelLabel}.`,

      state:
        selectedSetup.stage
          === 'triggered'
          ? 'passed'
          : 'waiting',
    },
  ] as const;

  const checklistPassedCount =
    workspaceChecklist.filter(
      (item) =>
        item.state
        === 'passed',
    ).length;

  const tapeDeltaClass =
    tradeTape.metrics
      .deltaQuoteValue > 0
      ? styles.positive
      : tradeTape.metrics
          .deltaQuoteValue < 0
        ? styles.negative
        : styles.neutralValue;

  const tapeAccelerationClass =
    tradeTape.metrics
      .accelerationPct === null
      ? styles.neutralValue
      : tradeTape.metrics
          .accelerationPct > 0
        ? styles.positive
        : tradeTape.metrics
            .accelerationPct < 0
          ? styles.negative
          : styles.neutralValue;

  const tapeStatusClass =
    [
      styles.tapeStatus,
      styles[
        `tapeStatus_${
          tradeTape.freshness
            .tone
        }`
      ],
    ].join(
      ' ',
    );

  const liquidityStatusClass =
    [
      styles.tapeStatus,
      styles[
        `tapeStatus_${
          liquidityMap.freshness
            .tone
        }`
      ],
    ].join(
      ' ',
    );

  const liquidityImbalanceClass =
    liquidityMap.imbalancePct === null
      ? styles.neutralValue
      : liquidityMap.imbalancePct > 0
        ? styles.positive
        : liquidityMap.imbalancePct < 0
          ? styles.negative
          : styles.neutralValue;

  const liquidityBuyerPressure =
    liquidityMap.buyerPressurePct;

  const liquiditySellerPressure =
    liquidityBuyerPressure === null
      ? null
      : 100
        - liquidityBuyerPressure;

  const marketDynamicsStatusClass =
    [
      styles.tapeStatus,
      styles[
        `tapeStatus_${
          marketDynamics.freshness
            .tone
        }`
      ],
    ].join(
      ' ',
    );

  const marketDynamicsModeClass =
    [
      styles.marketMode,
      styles[
        `marketMode_${
          marketDynamics.modeTone
        }`
      ],
    ].join(
      ' ',
    );

  const marketDynamicsPressureClass =
    marketDynamics.pressureScore === null
      ? styles.neutralValue
      : marketDynamics.pressureScore > 0
        ? styles.positive
        : marketDynamics.pressureScore < 0
          ? styles.negative
          : styles.neutralValue;

  const marketDynamicsAccelerationClass =
    marketDynamics.accelerationPct === null
      ? styles.neutralValue
      : marketDynamics.accelerationPct > 0
        ? styles.positive
        : marketDynamics.accelerationPct < 0
          ? styles.negative
          : styles.neutralValue;

  const marketDynamicsDeltaClass =
    marketDynamics.deltaQuoteValue === null
      ? styles.neutralValue
      : marketDynamics.deltaQuoteValue > 0
        ? styles.positive
        : marketDynamics.deltaQuoteValue < 0
          ? styles.negative
          : styles.neutralValue;

  const marketDynamicsBookClass =
    marketDynamics.bookImbalancePct === null
      ? styles.neutralValue
      : marketDynamics.bookImbalancePct > 0
        ? styles.positive
        : marketDynamics.bookImbalancePct < 0
          ? styles.negative
          : styles.neutralValue;

  const marketActivityLabel = {
    accelerating:
      'Активность ускоряется',
    slowing:
      'Активность замедляется',
    stable:
      'Скорость стабильна',
    unknown:
      'Нет предыдущего окна',
  }[marketDynamics.activityTrend];

  const marketAgreementLabel = {
    aligned:
      'Лента и стакан согласованы',
    mixed:
      'Лента и стакан расходятся',
    neutral:
      'Один источник близок к балансу',
    unavailable:
      'Согласованность ещё не рассчитана',
  }[marketDynamics.agreement];

  const reconnectMarketDynamics =
    () => {
      realtime.reconnect();
      orderBook.reconnect();
    };

  const setupConfirmationFreshnessClass =
    [
      styles.tapeStatus,
      styles[
        `tapeStatus_${
          setupConfirmation
            .freshness
            .tone
        }`
      ],
    ].join(
      ' ',
    );

  const setupConfirmationBadgeClass =
    [
      styles.setupConfirmationBadge,
      styles[
        `setupConfirmationBadge_${
          setupConfirmation.tone
        }`
      ],
    ].join(
      ' ',
    );

  const setupConfirmationPressureClass =
    setupConfirmation
      .directionalPressurePct === null
      ? styles.neutralValue
      : setupConfirmation
          .directionalPressurePct > 0
        ? styles.positive
        : setupConfirmation
            .directionalPressurePct < 0
          ? styles.negative
          : styles.neutralValue;

  const setupConfirmationCheckStates = {
    supports:
      'passed',
    opposes:
      'warning',
    neutral:
      'waiting',
    unavailable:
      'waiting',
  } as const;

  const tradeTapePanel = (
    <article className={styles.dataPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelEyebrow}>
            Поток сделок
          </p>
          <h2>Лента принтов</h2>
        </div>

        <div className={styles.tapeHeaderActions}>
          <span
            className={tapeStatusClass}
            title={
              [
                tradeTape.freshness
                  .message,
                tradeTape.freshness
                  .lastUpdatedLabel,
              ].join(
                ' ',
              )
            }
          >
            {tradeTape.freshness.label}
          </span>

          <div className={styles.tapeFilters}>
            {
              (['all', 'buy', 'sell'] as const)
                .map(
                  (value) => (
                    <button
                      key={value}
                      type="button"
                      className={
                        tapeFilter
                          === value
                          ? styles
                              .tapeFilterActive
                          : ''
                      }
                      onClick={() =>
                        setTapeFilter(
                          value,
                        )
                      }
                    >
                      {
                        value
                          === 'all'
                          ? 'Все'
                          : value
                              === 'buy'
                            ? 'Покупки'
                            : 'Продажи'
                      }
                    </button>
                  ),
                )
            }
          </div>
        </div>
      </div>

      <div className={styles.tapeSummary}>
        <span>
          Скорость{' '}
          <strong>
            {
              tradeTape.metrics
                .tradeRate
                .toLocaleString(
                  'ru-RU',
                  {
                    maximumFractionDigits:
                      2,
                  },
                )
              + ' сдел./с'
            }
          </strong>
        </span>

        <span>
          Ускорение{' '}
          <strong className={tapeAccelerationClass}>
            {
              formatTapePercent(
                tradeTape.metrics
                  .accelerationPct,
              )
            }
          </strong>
        </span>

        <span>
          Дельта{' '}
          <strong className={tapeDeltaClass}>
            {
              formatTapeQuoteValue(
                tradeTape.metrics
                  .deltaQuoteValue,
                true,
              )
            }
          </strong>
        </span>

        <span>
          Покупки{' '}
          <strong>
            {
              tradeTape.metrics
                .buySharePct === null
                ? '—'
                : formatTapePercent(
                    tradeTape.metrics
                      .buySharePct,
                    false,
                  )
            }
          </strong>
        </span>

        <span className={styles.tapeAge}>
          {
            tradeTape.freshness
              .lastUpdatedLabel
          }
        </span>
      </div>

      {
        tradeTape.freshness.state
          === 'stale'
        && (
          <div className={styles.tapeNotice}>
            <span>
              {tradeTape.freshness.message}
            </span>
            <button
              type="button"
              className={styles.tapeRetry}
              onClick={realtime.reconnect}
            >
              Переподключить
            </button>
          </div>
        )
      }

      <div className={styles.tapeTable}>
        <div className={styles.tapeHeader}>
          <span>Время</span>
          <span>Цена</span>
          <span>Размер</span>
          <span>Сумма</span>
        </div>

        {
          visiblePrints.length > 0
            ? visiblePrints.map(
                (print) => (
                  <div
                    key={print.id}
                    className={
                      [
                        styles.tapeRow,
                        print.side
                          === 'buy'
                          ? styles.buyRow
                          : styles.sellRow,
                        print.isLarge
                          ? styles.largePrintRow
                          : '',
                      ].join(
                        ' ',
                      )
                    }
                    title={
                      print.tradesCount
                      + ' исходных сделок Binance'
                    }
                  >
                    <span>
                      {
                        formatTapeTime(
                          print.timestamp,
                        )
                      }
                    </span>

                    <strong>
                      {formatPrice(print.price)}
                    </strong>

                    <span>
                      {
                        formatTapeQuantity(
                          print.quantity,
                        )
                      }
                    </span>

                    <span className={styles.tapeValue}>
                      <span>
                        {
                          formatTapeQuoteValue(
                            print.quoteValue,
                          )
                        }
                      </span>

                      {
                        print.isLarge
                        && (
                          <small
                            className={
                              styles.largePrintBadge
                            }
                          >
                            КРУПНЫЙ
                          </small>
                        )
                      }
                    </span>
                  </div>
                ),
              )
            : (
              <div className={styles.tapeEmpty}>
                <strong>
                  {tradeTape.freshness.label}
                </strong>
                <span>
                  {tradeTape.freshness.message}
                </span>

                {
                  (
                    tradeTape.freshness.state
                      === 'error'
                    || tradeTape.freshness.state
                      === 'offline'
                  )
                  && (
                    <button
                      type="button"
                      className={styles.tapeRetry}
                      onClick={realtime.reconnect}
                    >
                      Повторить подключение
                    </button>
                  )
                }
              </div>
            )
        }
      </div>
    </article>
  );

  const liquidityMapPanel = (
    <article className={styles.dataPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelEyebrow}>
            Binance Futures · depth ±0,2%
          </p>
          <h2>Карта ликвидности</h2>
        </div>

        <div className={styles.tapeHeaderActions}>
          <span
            className={liquidityStatusClass}
            title={
              [
                liquidityMap.freshness
                  .message,
                liquidityMap.freshness
                  .lastUpdatedLabel,
              ].join(
                ' ',
              )
            }
          >
            {liquidityMap.freshness.label}
          </span>
        </div>
      </div>

      <div className={styles.liquiditySummary}>
        <div>
          <span>Спред</span>
          <strong>
            {
              liquidityMap.spread === null
                ? '—'
                : formatChartPrice(
                    liquidityMap.spread,
                  )
            }
          </strong>
        </div>

        <div>
          <span>Дисбаланс</span>
          <strong className={liquidityImbalanceClass}>
            {
              liquidityMap.imbalancePct === null
                ? '—'
                : formatTapePercent(
                    liquidityMap.imbalancePct,
                  )
            }
          </strong>
        </div>

        <div>
          <span>Bid depth</span>
          <strong className={styles.positive}>
            {
              formatLiquidityDepth(
                liquidityMap.bidDepthQuote,
              )
            }
          </strong>
        </div>

        <div>
          <span>Ask depth</span>
          <strong className={styles.negative}>
            {
              formatLiquidityDepth(
                liquidityMap.askDepthQuote,
              )
            }
          </strong>
        </div>

        <span className={styles.tapeAge}>
          {
            liquidityMap.freshness
              .lastUpdatedLabel
          }
        </span>
      </div>

      {
        liquidityMap.freshness.state
          === 'stale'
        && (
          <div className={styles.tapeNotice}>
            <span>
              {liquidityMap.freshness.message}
            </span>
            <button
              type="button"
              className={styles.tapeRetry}
              onClick={orderBook.reconnect}
            >
              Переподключить
            </button>
          </div>
        )
      }

      <div className={styles.liquidityHeader}>
        <span>Цена</span>
        <span>Размер</span>
        <span>Объём</span>
        <span>До mid</span>
      </div>

      <div className={styles.liquidityMap}>
        {
          liquidityMap.asks.length > 0
          || liquidityMap.bids.length > 0
            ? (
                <>
                  {
                    liquidityMap.asks.map(
                      (row) => (
                        <div
                          key={`ask-${row.price}`}
                          className={
                            `${styles.liquidityRow} ${styles.sellerRow}`
                          }
                        >
                          <span
                            className={styles.liquidityBar}
                            style={{
                              width:
                                `${row.intensity * 100}%`,
                            }}
                          />
                          <strong>
                            {formatChartPrice(row.price)}
                          </strong>
                          <span>
                            {
                              formatTapeQuantity(
                                row.quantity,
                              )
                            }
                          </span>
                          <span className={styles.liquidityQuote}>
                            {
                              formatLiquidityDepth(
                                row.quoteValue,
                              )
                            }
                          </span>
                          <span className={styles.liquidityDistance}>
                            {
                              formatLiquidityDistance(
                                row.distancePct,
                              )
                            }
                          </span>
                        </div>
                      ),
                    )
                  }

                  <div className={styles.currentPriceDivider}>
                    <span>
                      {
                        liquidityMap.midpoint === null
                          ? chartPriceHeading
                              .toLocaleUpperCase(
                                'ru-RU',
                              )
                          : 'MIDPOINT'
                      }
                    </span>
                    <strong>
                      {
                        formatChartPrice(
                          liquidityMap.midpoint
                          ?? chartCurrentPrice,
                        )
                      }
                    </strong>
                  </div>

                  {
                    liquidityMap.bids.map(
                      (row) => (
                        <div
                          key={`bid-${row.price}`}
                          className={
                            `${styles.liquidityRow} ${styles.buyerRow}`
                          }
                        >
                          <span
                            className={styles.liquidityBar}
                            style={{
                              width:
                                `${row.intensity * 100}%`,
                            }}
                          />
                          <strong>
                            {formatChartPrice(row.price)}
                          </strong>
                          <span>
                            {
                              formatTapeQuantity(
                                row.quantity,
                              )
                            }
                          </span>
                          <span className={styles.liquidityQuote}>
                            {
                              formatLiquidityDepth(
                                row.quoteValue,
                              )
                            }
                          </span>
                          <span className={styles.liquidityDistance}>
                            {
                              formatLiquidityDistance(
                                row.distancePct,
                              )
                            }
                          </span>
                        </div>
                      ),
                    )
                  }
                </>
              )
            : (
                <div className={styles.tapeEmpty}>
                  <strong>
                    {liquidityMap.freshness.label}
                  </strong>
                  <span>
                    {liquidityMap.freshness.message}
                  </span>

                  {
                    liquidityMap.freshness.state
                      === 'error'
                    && (
                      <button
                        type="button"
                        className={styles.tapeRetry}
                        onClick={orderBook.reconnect}
                      >
                        Повторить подключение
                      </button>
                    )
                  }
                </div>
              )
        }
      </div>

      <div className={styles.pressureBlock}>
        <div className={styles.pressureHeader}>
          <span>Баланс глубины</span>
          <strong>
            {
              liquidityBuyerPressure === null
              || liquiditySellerPressure === null
                ? '— / —'
                : [
                    Math.round(
                      liquidityBuyerPressure,
                    ),
                    Math.round(
                      liquiditySellerPressure,
                    ),
                  ].join(
                    ' / ',
                  )
            }
          </strong>
        </div>
        <div className={styles.pressureTrack}>
          <span
            style={{
              width:
                `${liquidityBuyerPressure ?? 0}%`,
            }}
          />
        </div>
        <div className={styles.pressureLabels}>
          <span>Покупатели</span>
          <span>Продавцы</span>
        </div>
      </div>
    </article>
  );

  const marketDynamicsPanel = (
    <article
      className={
        `${styles.dataPanel} ${styles.marketDynamicsPanel}`
      }
    >
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelEyebrow}>
            Поток сделок + глубина стакана
          </p>
          <h2>Динамика рынка</h2>
        </div>

        <div className={styles.marketDynamicsHeaderActions}>
          <span
            className={marketDynamicsStatusClass}
            title={
              [
                marketDynamics.freshness
                  .message,
                marketDynamics.freshness
                  .lastUpdatedLabel,
              ].join(
                ' ',
              )
            }
          >
            {marketDynamics.freshness.label}
          </span>

          <span className={marketDynamicsModeClass}>
            {marketDynamics.modeLabel}
          </span>
        </div>
      </div>

      <p className={styles.marketDynamicsDescription}>
        {marketDynamics.modeDescription}
      </p>

      {
        (
          marketDynamics.freshness.state
            === 'stale'
          || marketDynamics.freshness.state
            === 'error'
        )
        && (
          <div className={styles.tapeNotice}>
            <span>
              {marketDynamics.freshness.message}
            </span>
            <button
              type="button"
              className={styles.tapeRetry}
              onClick={reconnectMarketDynamics}
            >
              Переподключить источники
            </button>
          </div>
        )
      }

      <div className={styles.dynamicsList}>
        <div className={styles.dynamicMetric}>
          <span>Скорость сделок</span>
          <strong>
            {
              marketDynamics.tradeRate === null
                ? '—'
                : marketDynamics.tradeRate
                    .toLocaleString(
                      'ru-RU',
                      {
                        maximumFractionDigits:
                          2,
                      },
                    )
                  + ' сдел./с'
            }
          </strong>
          <em className={styles.neutralValue}>
            {marketActivityLabel}
          </em>
        </div>

        <div className={styles.dynamicMetric}>
          <span>Ускорение</span>
          <strong className={marketDynamicsAccelerationClass}>
            {
              formatTapePercent(
                marketDynamics.accelerationPct,
              )
            }
          </strong>
          <em className={styles.neutralValue}>
            к предыдущим 10 секундам
          </em>
        </div>

        <div className={styles.dynamicMetric}>
          <span>Дельта потока</span>
          <strong className={marketDynamicsDeltaClass}>
            {
              marketDynamics.deltaQuoteValue === null
                ? '—'
                : formatTapeQuoteValue(
                    marketDynamics.deltaQuoteValue,
                    true,
                  )
            }
          </strong>
          <em className={styles.neutralValue}>
            покупки минус продажи
          </em>
        </div>

        <div className={styles.dynamicMetric}>
          <span>Доля покупок</span>
          <strong>
            {
              formatTapePercent(
                marketDynamics.buySharePct,
                false,
              )
            }
          </strong>
          <em className={styles.neutralValue}>
            агрессивные сделки за 10 секунд
          </em>
        </div>

        <div className={styles.dynamicMetric}>
          <span>Дисбаланс стакана</span>
          <strong className={marketDynamicsBookClass}>
            {
              formatTapePercent(
                marketDynamics.bookImbalancePct,
              )
            }
          </strong>
          <em className={styles.neutralValue}>
            глубина Binance Futures ±0,2%
          </em>
        </div>

        <div className={styles.dynamicMetric}>
          <span>Спред</span>
          <strong>
            {
              marketDynamics.spread === null
                ? '—'
                : formatChartPrice(
                    marketDynamics.spread,
                  )
            }
          </strong>
          <em className={styles.neutralValue}>
            {
              marketDynamics.spreadPct === null
                ? 'процент пока не рассчитан'
                : formatTapePercent(
                    marketDynamics.spreadPct,
                    false,
                  )
            }
          </em>
        </div>
      </div>

      <div className={styles.pressureBlock}>
        <div className={styles.pressureHeader}>
          <span>Сводное давление</span>
          <strong className={marketDynamicsPressureClass}>
            {
              formatTapePercent(
                marketDynamics.pressureScore,
              )
            }
          </strong>
        </div>
        <div className={styles.pressureTrack}>
          <span
            style={{
              width:
                `${marketDynamics.buyerPressurePct ?? 0}%`,
            }}
          />
        </div>
        <div className={styles.pressureLabels}>
          <span>
            Покупатели {
              marketDynamics.buyerPressurePct === null
                ? '—'
                : Math.round(
                    marketDynamics.buyerPressurePct,
                  )
                  + '%'
            }
          </span>
          <span>
            Продавцы {
              marketDynamics.sellerPressurePct === null
                ? '—'
                : Math.round(
                    marketDynamics.sellerPressurePct,
                  )
                  + '%'
            }
          </span>
        </div>
      </div>

      <div className={styles.marketDynamicsFooter}>
        <div>
          <span>Bid depth</span>
          <strong className={styles.positive}>
            {
              marketDynamics.bidDepthQuote === null
                ? '—'
                : formatLiquidityDepth(
                    marketDynamics.bidDepthQuote,
                  )
            }
          </strong>
        </div>

        <div>
          <span>Ask depth</span>
          <strong className={styles.negative}>
            {
              marketDynamics.askDepthQuote === null
                ? '—'
                : formatLiquidityDepth(
                    marketDynamics.askDepthQuote,
                  )
            }
          </strong>
        </div>

        <div className={styles.marketDynamicsSource}>
          <span>Источники</span>
          <strong>{marketAgreementLabel}</strong>
        </div>
      </div>

      <p className={styles.marketDynamicsUpdated}>
        {
          marketDynamics.freshness
            .lastUpdatedLabel
        }
      </p>
    </article>
  );

  return (
    <section className={styles.workspace}>
      <header className={styles.pageHeader}>
        <div className={styles.instrumentHeader}>
          <Link
            className={styles.backLink}
            to={buildSetupSelectionUrl(ROUTES.scanner, contractSetup.id, {
              symbol: contractSetup.symbol,
              preset,
              scannerWindow,
              timeframe,
            })}
            aria-label="Вернуться в Scanner"
          >
            ←
          </Link>
          <div>
            <p className={styles.eyebrow}>
              {
                isMarketPreview
                  ? 'Рабочее пространство · рыночный обзор Binance'
                  : isRuntimeSetup
                    ? 'Рабочее пространство · runtime-сетап Setup Engine'
                    : 'Рабочее пространство · тестовые данные'
              }
            </p>
            <div className={styles.symbolRow}>
              <h1>{selectedSetup.symbol}</h1>
              {!isMarketPreview && (
                <DirectionBadge
                  direction={
                    selectedSetup.direction
                  }
                />
              )}
              <span className={styles.exchangeBadge}>{selectedSetup.exchange}</span>
              <span className={styles.timeframeBadge}>{timeframe}</span>
            </div>
            <p className={styles.setupDescription}>
              {
                isMarketPreview
                  ? 'Рыночный обзор · сетап ещё не сформирован'
                  : `${selectedSetup.kind} · зона ${chartLevelLabel}`
              }
            </p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.priceBlock}>
            <span>{chartPriceHeading}</span>
            <strong>
              {formatChartPrice(chartCurrentPrice)}
            </strong>
            <em
              className={[
                styles.priceSource,
                styles[
                  `priceSource_${candleFreshness.tone}`
                ],
              ].join(' ')}
              title={
                [
                  candleFreshness.message,
                  chartUpdatedAtLabel,
                ].join(' ')
              }
            >
              {chartPriceSource}
            </em>
          </div>
          <div className={styles.headerActions}>
            {!isMarketPreview && (
              <button
                className={styles.secondaryButton}
                type="button"
                disabled
                title="Создание пользовательских алертов из Workspace ещё не подключено"
              >
                Алерты пока недоступны
              </button>
            )}
            <button className={styles.primaryButton} type="button" onClick={() => setNoteOpen((current) => !current)}>
              {noteOpen ? 'Закрыть черновик' : 'Открыть черновик заметки'}
            </button>
          </div>
        </div>
      </header>

      <div className={styles.workspaceGrid}>
        <div className={styles.leftColumn}>
          <article className={styles.chartPanel}>
            <div className={styles.panelToolbar}>
              <div className={styles.timeframeControl} aria-label="Таймфрейм графика">
                {(['1m', '5m', '15m'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={timeframe === value ? styles.timeframeActive : ''}
                    onClick={() => selectTimeframe(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className={styles.chartLegend}>
                {!isMarketPreview && (
                  <span>
                    <i className={styles.levelLegend} />
                    {' '}
                    Уровень {chartLevelLabel}
                  </span>
                )}
                <span>
                  <i className={styles.priceLegend} />
                  {' '}
                  Цена {formatChartPrice(chartCurrentPrice)}
                </span>
                <span
                  className={[
                    styles.freshnessBadge,
                    styles[
                      `freshnessBadge_${candleFreshness.tone}`
                    ],
                  ].join(' ')}
                  title={
                    [
                      candleFreshness.message,
                      chartUpdatedAtLabel,
                    ].join(' ')
                  }
                  aria-live="polite"
                >
                  <i />
                  {candleFreshness.label}
                  {' · '}
                  {
                    candleFreshness
                      .lastUpdatedLabel
                  }
                </span>
                <span
                  className={[
                    styles.liveIndicator,
                    styles[`liveIndicator_${realtimeWorkspace.connectionTone}`],
                  ].join(' ')}
                >
                  <i /> {realtimeWorkspace.connectionLabel}
                </span>
              </div>
            </div>

            <div className={styles.chartCanvas}>
              {!hasCandleData
                && (
                  candleFreshness.state
                    === 'error'
                  || candleFreshness.state
                    === 'offline'
                ) && (
                  <div
                    className={[
                      styles.chartState,
                      styles.chartStateError,
                    ].join(' ')}
                  >
                    <strong>
                      {candleFreshness.label}
                    </strong>
                    <span>
                      {candleFreshness.message}
                    </span>
                    <button
                      type="button"
                      onClick={candlesQuery.retry}
                    >
                      Повторить
                    </button>
                  </div>
                )}

              {!hasCandleData
                && candleFreshness.state
                  === 'collecting'
                && candlesQuery.status
                  !== 'success' && (
                  <div className={styles.chartState}>
                    <strong>COLLECTING</strong>
                    <span>
                      {candleFreshness.message}
                    </span>
                  </div>
                )}

              {!hasCandleData
                && candlesQuery.status
                  === 'success'
                && candleFreshness.state
                  === 'collecting' && (
                  <div className={styles.chartState}>
                    Для выбранного периода нет свечей.
                  </div>
                )}

              {candlesQuery.data
                && candlesQuery.data.length > 0 && (
                  <>
                    {candleFreshness.state
                      === 'stale' && (
                        <div
                          className={
                            styles.chartFreshnessNotice
                          }
                          role="status"
                        >
                          <strong>STALE</strong>
                          <span>
                            {candleFreshness.message}
                            {' '}
                            {
                              candleFreshness
                                .lastUpdatedLabel
                            }
                            {' · '}
                            {chartUpdatedAtLabel}
                          </span>
                          <button
                            type="button"
                            onClick={
                              candlesQuery.retry
                            }
                          >
                            Обновить
                          </button>
                        </div>
                      )}

                    <NexusCandlestickChart
                      candles={candlesQuery.data}
                      symbol={contractSetup.symbol}
                      fillContainer
                      priceLines={chartPriceLines}
                      showSeriesPriceLine={false}
                      enableDrawingTools
                      drawingScope={`${contractSetup.symbol}:${timeframe}`}
                      onLoadOlder={
                        candlesQuery.loadOlder
                      }
                      isLoadingOlder={
                        candlesQuery.isLoadingOlder
                      }
                      hasMore={
                        candlesQuery.hasMore
                      }
                    />
                  </>
                )}
            </div>

            <div className={styles.chartMetrics}>
              {
                isMarketPreview
                  ? (
                    <>
                      <div>
                        <span>Режим</span>
                        <strong>
                          Рыночный обзор
                        </strong>
                      </div>
                      <div>
                        <span>Сетап</span>
                        <strong>
                          Не обнаружен
                        </strong>
                      </div>
                      <div>
                        <span>Свечи</span>
                        <strong>
                          Binance
                        </strong>
                      </div>
                      <div>
                        <span>Realtime</span>
                        <strong>
                          {
                            realtimeWorkspace
                              .connectionLabel
                          }
                        </strong>
                      </div>
                    </>
                  )
                  : (
                    <>
                      <div>
                        <span>До уровня</span>
                        <strong className={styles.warningValue}>
                          {selectedSetup.distanceLabel}
                        </strong>
                      </div>
                      <div>
                        <span>Касания</span>
                        <strong>{selectedSetup.touches}</strong>
                      </div>
                      <div>
                        <span>Формирование</span>
                        <strong>{selectedSetup.formationLabel}</strong>
                      </div>
                      <div>
                        <span>Откаты</span>
                        <strong>{selectedSetup.pullbackDepth}</strong>
                      </div>
                      <div>
                        <span>Объём</span>
                        <strong>
                          {
                            volumeAnomaly
                            === null
                              ? '—'
                              : volumeAnomaly
                                  .toFixed(2)
                                + '×'
                          }
                        </strong>
                      </div>
                      <div>
                        <span>Сделки</span>
                        <strong>
                          {
                            tradesAnomaly
                            === null
                              ? '—'
                              : tradesAnomaly
                                  .toFixed(2)
                                + '×'
                          }
                        </strong>
                      </div>
                      <div>
                        <span>Сила к BTC</span>
                        <strong
                          className={
                            btcStrengthValue
                            === null
                              ? ''
                              : btcStrengthValue >= 0
                                ? styles.positive
                                : styles.negative
                          }
                        >
                          {
                            btcStrengthValue
                            === null
                              ? '—'
                              : selectedSetup.btcStrengthLabel
                          }
                        </strong>
                      </div>
                    </>
                  )
              }
            </div>
          </article>

          {
            isMarketPreview
              ? (
          <div className={styles.lowerGrid}>
            {tradeTapePanel}

            {liquidityMapPanel}

            {marketDynamicsPanel}
          </div>
                )
              : (
          <div className={styles.lowerGrid}>
            {tradeTapePanel}

            {liquidityMapPanel}

            {marketDynamicsPanel}
          </div>
                )
          }

        </div>

        <aside className={styles.nexusPanel}>
          <div className={styles.nexusPanelHeader}>
            <div>
              <p className={styles.panelEyebrow}>
                Панель NEXUS
              </p>
              <h2>
                {
                  isMarketPreview
                    ? 'Рыночный обзор'
                    : 'Сетап под наблюдением'
                }
              </h2>
            </div>

            {!isMarketPreview && (
              <SetupStageBadge
                stage={selectedSetup.stage}
                resultLabel={resultLabel}
              />
            )}
          </div>

          {
            isMarketPreview
              ? (
                <>
                  <section className={styles.nexusSection}>
                    <div className={styles.sectionTitle}>
                      <h3>Сетап не обнаружен</h3>
                      <span>MARKET</span>
                    </div>
                    <p className={styles.testNotice}>
                      Монета открыта из Market Scanner.
                      NEXUS не обнаружил для неё подтверждённый
                      торговый сетап, поэтому направление,
                      уровень и стадия не показываются.
                    </p>
                  </section>

                  <section className={styles.nexusSection}>
                    <div className={styles.sectionTitle}>
                      <h3>Доступно сейчас</h3>
                      <span>LIVE</span>
                    </div>
                    <ul className={styles.reasonList}>
                      <li>Реальные свечи Binance Futures.</li>
                      <li>Цена со статусом свежести и realtime-подключение.</li>
                      <li>Живая лента сделок со скоростью и дельтой.</li>
                      <li>Живая карта глубины и дисбаланса стакана.</li>
                      <li>Сводная динамика потока сделок и стакана.</li>
                      <li>Инструменты ручного анализа графика.</li>
                    </ul>
                  </section>
                </>
              )
              : (
                <>
                  <div className={styles.stageFlow}>
                    {displayedStageFlow.map((stage, index) => {
                      const status =
                        index < currentStageIndex
                          ? styles.stageComplete
                          : index === currentStageIndex
                            ? styles.stageCurrent
                            : styles.stagePending;

                      return (
                        <div
                          key={stage.id}
                          className={
                            `${styles.stageItem} ${status}`
                          }
                        >
                          <span className={styles.stageNumber}>
                            {index + 1}
                          </span>
                          <div>
                            <strong>{stage.label}</strong>
                            <small>{stage.description}</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <section className={styles.nexusSection}>
                    <div className={styles.sectionTitle}>
                      <h3>Почему в Scanner</h3>
                      <span>{selectedSetup.reasons.length}</span>
                    </div>
                    <ul className={styles.reasonList}>
                      {selectedSetup.reasons.map(
                        (reason) => (
                          <li key={reason}>
                            {reason}
                          </li>
                        ),
                      )}
                    </ul>
                  </section>

                  <section
                    className={
                      `${styles.nexusSection} ${styles.setupConfirmationSection}`
                    }
                  >
                    <div className={styles.setupConfirmationHeader}>
                      <div>
                        <h3>Live-подтверждение</h3>
                        <span
                          className={setupConfirmationFreshnessClass}
                          title={
                            [
                              setupConfirmation
                                .freshness
                                .message,
                              setupConfirmation
                                .freshness
                                .lastUpdatedLabel,
                            ].join(
                              ' ',
                            )
                          }
                          aria-live="polite"
                        >
                          {
                            setupConfirmation
                              .freshness
                              .label
                          }
                        </span>
                      </div>

                      <strong
                        className={setupConfirmationBadgeClass}
                        aria-live="polite"
                      >
                        {setupConfirmation.statusLabel}
                      </strong>
                    </div>

                    <p className={styles.setupConfirmationSummary}>
                      {setupConfirmation.summary}
                    </p>

                    {
                      (
                        setupConfirmation
                          .freshness
                          .state
                          === 'stale'
                        || setupConfirmation
                            .freshness
                            .state
                            === 'error'
                      )
                      && (
                        <div className={styles.tapeNotice}>
                          <span>
                            {
                              setupConfirmation
                                .freshness
                                .message
                            }
                          </span>
                          <button
                            type="button"
                            className={styles.tapeRetry}
                            onClick={reconnectMarketDynamics}
                          >
                            Переподключить источники
                          </button>
                        </div>
                      )
                    }

                    <div className={styles.setupConfirmationStats}>
                      <div>
                        <span>Поддерживают</span>
                        <strong className={styles.positive}>
                          {setupConfirmation.supportCount}
                          {' / '}
                          {setupConfirmation.checks.length}
                        </strong>
                      </div>

                      <div>
                        <span>Против</span>
                        <strong
                          className={
                            setupConfirmation.blockingCount > 0
                              ? styles.negative
                              : styles.neutralValue
                          }
                        >
                          {setupConfirmation.blockingCount}
                        </strong>
                      </div>

                      <div>
                        <span>Давление к направлению</span>
                        <strong className={setupConfirmationPressureClass}>
                          {
                            formatTapePercent(
                              setupConfirmation
                                .directionalPressurePct,
                            )
                          }
                        </strong>
                      </div>
                    </div>

                    <div className={styles.setupConfirmationChecks}>
                      {
                        setupConfirmation.checks.map(
                          (check) => {
                            const checkState =
                              setupConfirmationCheckStates[
                                check.state
                              ];

                            return (
                              <div
                                key={check.id}
                                className={
                                  `${styles.setupConfirmationCheck} ${styles[checkState]}`
                                }
                              >
                                <span className={styles.checkIcon}>
                                  <ChecklistIcon state={checkState} />
                                </span>
                                <div>
                                  <strong>{check.label}</strong>
                                  <small>{check.detail}</small>
                                </div>
                              </div>
                            );
                          },
                        )
                      }
                    </div>

                    <p className={styles.setupConfirmationDisclaimer}>
                      Оценка не меняет стадию Setup Engine автоматически
                      и не является торговым сигналом.
                    </p>
                  </section>

                  <section className={styles.nexusSection}>
                    <div className={styles.sectionTitle}>
                      <h3>Чек-лист сетапа</h3>
                      <span>
                        {checklistPassedCount}
                        {' / '}
                        {workspaceChecklist.length}
                      </span>
                    </div>
                    <div className={styles.checklist}>
                      {workspaceChecklist.map(
                        (item) => (
                          <div
                            key={item.id}
                            className={
                              `${styles.checkItem} ${styles[item.state]}`
                            }
                          >
                            <span className={styles.checkIcon}>
                              <ChecklistIcon state={item.state} />
                            </span>
                            <div>
                              <strong>{item.label}</strong>
                              <small>{item.detail}</small>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </section>
                </>
              )
          }

          {noteOpen && (
            <section className={styles.noteEditor}>
              <label htmlFor="workspace-note">
                {
                  isMarketPreview
                    ? 'Черновик наблюдения по рынку'
                    : 'Черновик заметки к сетапу'
                }
              </label>
              <span className={styles.noteDraftNotice}>
                Текст существует только до закрытия страницы и не сохраняется.
              </span>
              <textarea
                id="workspace-note"
                placeholder={
                  isMarketPreview
                    ? 'Запишите собственное наблюдение по монете…'
                    : 'Например: дождаться закрепления и повторного теста зоны…'
                }
              />
              <button
                type="button"
                onClick={() => setNoteOpen(false)}
              >
                Закрыть без сохранения
              </button>
            </section>
          )}

          {!isMarketPreview && (
            <div className={styles.nexusActions}>
              <button
                className={styles.primaryButton}
                type="button"
                disabled
                title="Создание пользовательских алертов из Workspace ещё не подключено"
              >
                Алерты пока недоступны
              </button>

              {
                replayAvailable
                  ? (
                      <Link
                        className={styles.secondaryLink}
                        to={buildReplayUrl(
                          ROUTES.replay,
                          {
                            setupId:
                              contractSetup.id,

                            symbol:
                              contractSetup.symbol,

                            preset,
                            scannerWindow,
                            timeframe,
                          },
                        )}
                      >
                        Открыть в Replay
                      </Link>
                    )
                  : (
                      <button
                        className={styles.externalButton}
                        type="button"
                        disabled
                        title="Для этого сетапа нет сохранённой Replay-сессии"
                      >
                        Replay недоступен
                      </button>
                    )
              }

              <button
                className={styles.externalButton}
                type="button"
                disabled
                title="Интеграция с внешним терминалом ещё не подключена"
              >
                Внешний терминал не подключён
              </button>
            </div>
          )}

          <p className={styles.testNotice}>
            {
              isMarketPreview
                ? 'Рыночный режим не является торговым сигналом. NEXUS не выставляет ордера.'
                : hasRuntimeSetupContext
                  ? 'Сетап, стадия и ценовая зона получены из Setup Engine. Свечи, лента и стакан загружаются через backend Binance Futures; динамика и live-подтверждение рассчитываются из этих realtime-источников. NEXUS не выставляет ордера.'
                  : 'Контекст сетапа демонстрационный. Свечи, лента и стакан загружаются через backend Binance Futures; динамика и live-подтверждение рассчитываются из этих realtime-источников. NEXUS не выставляет ордера.'
            }
          </p>
        </aside>
      </div>
    </section>
  );
}


export function WorkspacePage() {
  const [searchParams] = useSearchParams();
  const requestedSetupId = searchParams.get('setupId') ?? searchParams.get('setup') ?? '';
  const requestedSymbol = searchParams.get('symbol')?.toUpperCase() ?? '';
  const query = useApiQuery(
    `workspace-context:${requestedSetupId}:${requestedSymbol}`,
    async (): Promise<WorkspacePageData | null> => {
      const shouldPreferRuntimeSetup =
        isMarketWorkspaceSetupId(
          requestedSetupId,
        )
        && requestedSymbol.length > 0;

      const runtimeView =
        shouldPreferRuntimeSetup
          ? await nexusApi.getWorkspaceView(
              null,
              requestedSymbol,
            )
          : null;

      const primaryView =
        runtimeView
        ?? await nexusApi.getWorkspaceView(
          requestedSetupId || null,
          requestedSymbol || null,
        );

      const marketFallbackSetupId =
        requestedSymbol
          ? buildMarketWorkspaceSetupId(
              requestedSymbol,
            )
          : null;

      const view =
        primaryView
        ?? (
          marketFallbackSetupId
            ? await nexusApi.getWorkspaceView(
                marketFallbackSetupId,
                requestedSymbol,
              )
            : null
        );

      if (!view) {
        return null;
      }

      const resolvedSetupId =
        view.selectedSetup.id;

      const [
        contractSetup,
        replayView,
      ] = await Promise.all([
        nexusApi.getSetupById(
          resolvedSetupId,
        ),

        nexusApi.getReplayView(
          null,
          resolvedSetupId,
        ),
      ]);

      if (!contractSetup) {
        return null;
      }

      return {
        contractSetup,
        view,
        replayAvailable:
          replayView !== null,
      };
    },
    {
      preserveData:
        true,
    },
  );


  useSetupLifecycleRefresh({
    candidateId:
      requestedSetupId,

    enabled:
      requestedSetupId.length > 0
      && !requestedSetupId.startsWith(
        'market-',
      ),

    onEvent:
      query.retry,
  });

  if (query.status === 'loading') return <AsyncDataState state="loading" />;
  if (query.status === 'error') {
    return <AsyncDataState state="error" message={query.error?.message} onRetry={query.retry} />;
  }
  if (!query.data) {
    return <AsyncDataState state="empty" title="Сетап не найден" message="Проверьте Setup ID или вернитесь в Scanner." />;
  }

  return <WorkspacePageContent data={query.data} />;
}
