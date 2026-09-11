import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { useFeedbackPageContext } from '@/shared/feedback/FeedbackProvider';
import { buildWorkspaceUrl } from '@/shared/routing/setupContext';
import {
  NexusCandlestickChart,
  useMarketCandles,
  type NexusChartHorizontalSegment,
} from '@/shared/charts';
import { useCausalLevelLines } from '@/shared/level-lines';
import {
  DEFAULT_SCANNER_SETUP_TABLE_SORT_STATE,
  applyScannerSetupLiveMetrics,
  buildScannerSetupDistanceView,
  buildScannerRealtimeMarketView,
  formatScannerPrice,
  formatScannerTradeTime,
  getScannerRealtimeConnectionLabel,
  indexScannerSetupMetrics,
  nextScannerSetupSortState,
  parseScannerMinQuoteVolumeMillions,
  sortScannerSetupRows,
  useMarketVolumeSpikes,
  useMarketWideLiquidations,
  useMarketWideScannerMetrics,
  useRealtimeMarketData,
  type MarketVolumeSpikePeriodMinutes,
  type MarketVolumeSpikeStatus,
  type ScannerSetupTableSortKey,
  type ScannerSetupTableSortState,
} from '@/shared/realtime';
import {
  fetchRuntimeMarketSymbols,
  nexusApi,
  useApiQuery,
  useSetupLifecycleRefresh,
  type ScannerSetup,
  type ScannerSetupKind,
  type ScannerTimeframe,
} from '@/shared/api';
import { AsyncDataState } from '@/shared/ui/AsyncDataState';
import { TokenLogo } from '@/shared/ui/TokenLogo';
import { DirectionBadge, type TradeDirection } from '@/shared/ui/DirectionBadge';
import { SetupStageBadge, type SetupStage } from '@/shared/ui/SetupStageBadge';
import { LevelV2ShadowInspectionPanel } from '@/shared/ui/LevelV2ShadowInspectionPanel';
import {
  TRADING_PRESETS,
  isScannerWindow,
  isTradingPreset,
  type ScannerWindow,
  type TradingPresetDefinition,
  type TradingPreset,
} from '@/shared/config/tradingPresets';
import {
  ScannerChartMarketOverlay,
  findScannerMarketSymbol24h,
  formatScanner24hPercent,
} from './ScannerChartMarketOverlay';
import styles from './ScannerPage.module.css';

type DirectionFilter = 'all' | TradeDirection;
type StageFilter = 'all' | SetupStage;
type KindFilter = 'all' | ScannerSetupKind;
type DistanceFilter = 'all' | '0.5' | '1' | '2';
type TouchesFilter = 'all' | '2' | '3';
type BtcStrengthFilter = 'all' | 'positive' | 'negative';

const DEFAULT_SCANNER_MIN_QUOTE_VOLUME_MILLIONS =
  '100';

function resolveInitialScannerMinQuoteVolumeMillions(
  value: string | null,
): string {
  if (value === null) {
    return DEFAULT_SCANNER_MIN_QUOTE_VOLUME_MILLIONS;
  }

  const normalized =
    value.trim().replace(',', '.');
  const millions = Number(normalized);

  if (
    !Number.isFinite(millions)
    || millions < 0
  ) {
    return DEFAULT_SCANNER_MIN_QUOTE_VOLUME_MILLIONS;
  }

  return millions === 0
    ? ''
    : normalized;
}

const STAGE_OPTIONS: Array<{ value: StageFilter; label: string }> = [
  { value: 'all', label: 'Все стадии' },
  { value: 'observation', label: 'Наблюдение' },
  { value: 'approach', label: 'Подход' },
  { value: 'confirmation', label: 'Подтверждение' },
  { value: 'triggered', label: 'Пробой / отскок' },
];

const KIND_OPTIONS: Array<{ value: KindFilter; label: string }> = [
  { value: 'all', label: 'Все типы сетапов' },
  { value: 'Пробой сопротивления', label: 'Пробой сопротивления' },
  { value: 'Пробой поддержки', label: 'Пробой поддержки' },
  { value: 'Отскок от поддержки', label: 'Отскок от поддержки' },
  { value: 'Отскок от сопротивления', label: 'Отскок от сопротивления' },
];

const SORT_OPTIONS: Array<{
  value: ScannerSetupTableSortKey;
  label: string;
}> = [
  { value: 'distance', label: 'Расстояние' },
  { value: 'symbol', label: 'Инструмент' },
  { value: 'direction', label: 'Направление' },
  { value: 'kind', label: 'Тип сетапа' },
  { value: 'stage', label: 'Стадия' },
  { value: 'timeframe', label: 'Таймфрейм' },
  { value: 'level', label: 'Цена уровня' },
  { value: 'touches', label: 'Касания' },
  { value: 'formation', label: 'Формирование' },
  { value: 'pullbacks', label: 'Откаты' },
  { value: 'volume', label: 'Объём' },
  { value: 'trades', label: 'Сделки' },
  { value: 'btcStrength', label: 'Сила к BTC' },
];

const VOLUME_SPIKE_STATUSES:
readonly MarketVolumeSpikeStatus[] = [
  'new',
  'growing',
  'stable',
  'fading',
];

const SETUP_RUNTIME_TIMEFRAMES:
readonly ScannerTimeframe[] = [
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
];

const SELECTED_SETUP_LEVEL_COLORS = {
  support: '#32d583',
  resistance: '#ff6273',
} as const;

function buildSelectedSetupHorizontalSegments(
  setup: ScannerSetup,
  isMarketPreview: boolean,
  horizontalSegments:
    readonly NexusChartHorizontalSegment[],
): readonly NexusChartHorizontalSegment[] {
  const price =
    setup.levelReferencePrice;
  const startTime =
    setup.levelActiveFrom;
  const startTimeMs =
    startTime
      ? Date.parse(startTime)
      : Number.NaN;

  if (
    isMarketPreview
    || price === undefined
    || !Number.isFinite(price)
    || price <= 0
    || !startTime
    || !Number.isFinite(startTimeMs)
  ) {
    return horizontalSegments;
  }

  const levelKind =
    setup.kind.includes(
      'поддержки',
    )
      ? 'support'
      : 'resistance';
  const color =
    SELECTED_SETUP_LEVEL_COLORS[
      levelKind
    ];
  const priceTolerance =
    Math.max(
      price * 1e-10,
      1e-12,
    );

  const backgroundSegments =
    horizontalSegments.filter(
      (segment) => {
        if (
          segment.endTime
          !== undefined
        ) {
          return true;
        }

        const sameColor =
          segment.color.toLowerCase()
          === color;
        const sameStartTime =
          Date.parse(
            segment.startTime,
          ) === startTimeMs;
        const samePrice =
          Math.abs(
            segment.price - price,
          ) <= priceTolerance;
        const sameDisplayedPrice =
          formatScannerPrice(
            segment.price,
          )
          === formatScannerPrice(
            price,
          );

        return !(
          sameColor
          && (
            sameStartTime
            || samePrice
            || sameDisplayedPrice
          )
        );
      },
    );

  return [
    ...backgroundSegments,
    {
      price,
      startTime,
      color,
      title:
        levelKind === 'support'
          ? 'СЕТАП · ПОДДЕРЖКА'
          : 'СЕТАП · СОПРОТИВЛЕНИЕ',
      lineStyle: 'solid',
      axisLabelVisible: true,
    },
  ];
}

const DEFAULT_VOLUME_SPIKE_FILTERS = {
  periodMinutes: 5 as MarketVolumeSpikePeriodMinutes,
  baselinePeriods: 12,
  minVolumeRatio: 2,
  minTradesRatio: 1.5,
  minCurrentQuoteVolume: 50_000,
};

function createMarketPreviewAnchor(
  symbol:
    string,
): ScannerSetup {
  return {
    id:
      `market-preview:${symbol.toLowerCase()}`,

    symbol,

    exchange:
      'BINANCE',

    direction:
      'long',

    kind:
      'Уровень поддержки',

    stage:
      'observation',

    timeframe:
      '1m',

    price:
      '—',

    priceChange:
      '—',

    level:
      '—',

    distancePercent:
      Number.POSITIVE_INFINITY,

    distanceLabel:
      '—',

    touches:
      0,

    formationMinutes:
      0,

    formationLabel:
      '—',

    pullbackDepth:
      '—',

    quoteVolume24h:
      null,

    volumeAnomaly:
      null,

    tradesAnomaly:
      null,

    tradeSpeed:
      'Данные собираются',

    btcCorrelation:
      '—',

    btcStrength:
      null,

    btcStrengthLabel:
      '—',

    activity:
      'Средняя',

    reasons:
      [],

    chartPath:
      '',

    areaPath:
      '',

    levelY:
      0,

    touchPoints:
      [],

    runtimeData:
      false,
  };
}

function InfoHint({ label }: { label: string }) {
  return (
    <button className={styles.infoHint} type="button" aria-label={label} data-tooltip={label}>
      ?
    </button>
  );
}

function ScannerPageContent({
  setups:
    v1Setups,

  setupsDataState,

  resultsMode,

  minQuoteVolumeMillions,

  setMinQuoteVolumeMillions,
}: {
  setups:
    ScannerSetup[];

  setupsDataState:
    | 'live'
    | 'retained-loading'
    | 'retained-error';

  resultsMode:
    | 'setups'
    | 'loading'
    | 'empty'
    | 'error';

  minQuoteVolumeMillions:
    string;

  setMinQuoteVolumeMillions:
    (value: string) => void;
}) {
  const selectedRowRef =
    useRef<HTMLButtonElement | null>(
      null,
    );

  const [
    shadowEnabled,
    setShadowEnabled,
  ] = useState(false);

  const [
    shadowSetups,
    setShadowSetups,
  ] = useState<ScannerSetup[]>([]);

  const [
    shadowStatus,
    setShadowStatus,
  ] = useState<
    | 'idle'
    | 'loading'
    | 'success'
    | 'error'
  >('idle');

  const [
    shadowError,
    setShadowError,
  ] = useState<Error | null>(
    null,
  );

  const [
    shadowRetryToken,
    setShadowRetryToken,
  ] = useState(0);

  useEffect(
    () => {
      let active =
        true;

      if (!shadowEnabled) {
        setShadowSetups([]);
        setShadowStatus('idle');
        setShadowError(null);

        return () => {
          active =
            false;
        };
      }

      const loadShadowSetups =
        async () => {
          setShadowStatus(
            (current) =>
              current === 'success'
                ? current
                : 'loading',
          );

          try {
            const nextSetups =
              await nexusApi
                .getLevelV2ShadowScannerSetups();

            if (!active) {
              return;
            }

            setShadowSetups(
              nextSetups,
            );

            setShadowStatus(
              'success',
            );

            setShadowError(
              null,
            );
          } catch (
            error:
              unknown
          ) {
            if (!active) {
              return;
            }

            setShadowStatus(
              'error',
            );

            setShadowError(
              error instanceof Error
                ? error
                : new Error(
                    'Level v2 Shadow request failed',
                  ),
            );
          }
        };

      void loadShadowSetups();

      const timer =
        globalThis.setInterval(
          () => {
            void loadShadowSetups();
          },
          15_000,
        );

      return () => {
        active =
          false;

        globalThis.clearInterval(
          timer,
        );
      };
    },
    [
      shadowEnabled,
      shadowRetryToken,
    ],
  );

  const setups =
    useMemo(
      () =>
        shadowEnabled
          ? [
              ...v1Setups,
              ...shadowSetups,
            ]
          : v1Setups,
      [
        shadowEnabled,
        shadowSetups,
        v1Setups,
      ],
    );

  const shadowStatusLabel =
    !shadowEnabled
      ? 'V1 production'
      : shadowStatus === 'loading'
        ? 'V2 loading'
        : shadowStatus === 'error'
          ? 'V2 error'
          : `V2 \u2265 90: ${shadowSetups.length}`;
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSetupId = searchParams.get('setupId');
  const requestedSymbol = searchParams.get('symbol')?.trim().toUpperCase() ?? null;
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
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [kind, setKind] = useState<KindFilter>('all');
  const [stage, setStage] = useState<StageFilter>('all');
  const [
    chartTimeframe,
    setChartTimeframe,
  ] = useState<ScannerTimeframe>(
    () => {
      const requestedTimeframe =
        searchParams.get(
          'timeframe',
        );

      return SETUP_RUNTIME_TIMEFRAMES.includes(
        requestedTimeframe as
          ScannerTimeframe,
      )
        ? requestedTimeframe as
            ScannerTimeframe
        : '1m';
    },
  );
  const [distance, setDistance] = useState<DistanceFilter>('all');
  const [touches, setTouches] = useState<TouchesFilter>('all');
  const [btcStrength, setBtcStrength] = useState<BtcStrengthFilter>('all');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [sortState, setSortState] =
    useState<ScannerSetupTableSortState>({
      ...DEFAULT_SCANNER_SETUP_TABLE_SORT_STATE,
    });

  const hasRuntimeSetups =
    setups.some(
      (setup) =>
        setup.runtimeData
        === true,
    );

  const setupsSourceLabel =
    setupsDataState === 'retained-error'
      ? 'SAVED SETUPS · UPDATE ERROR'
      : setupsDataState === 'retained-loading'
        ? 'SAVED SETUPS · REFRESHING'
        : 'REAL SETUPS · BINANCE';

  const setupsSourceDescription =
    setupsDataState === 'retained-error'
      ? 'Поиск сетапов · сохранённые кандидаты · ошибка обновления · цены realtime'
      : setupsDataState === 'retained-loading'
        ? 'Поиск сетапов · сохранённые кандидаты · обновляем Setup Engine · цены realtime'
        : 'Поиск сетапов · реальные кандидаты Setup Engine · цены realtime';

  const runtimeTimeframes =
    useMemo(
      () =>
        new Set(
          setups
            .filter(
              (setup) =>
                setup.runtimeData
                === true,
            )
            .map(
              (setup) =>
                setup.timeframe,
            ),
        ),
      [setups],
    );

  const availableTimeframes =
    SETUP_RUNTIME_TIMEFRAMES;

  const oneMinuteMetrics =
    useMarketWideScannerMetrics({
      enabled:
        hasRuntimeSetups
        && runtimeTimeframes
          .has('1m'),
      scannerWindow:
        '1m',
    });

  const fiveMinuteMetrics =
    useMarketWideScannerMetrics({
      enabled:
        hasRuntimeSetups
        && runtimeTimeframes
          .has('5m'),
      scannerWindow:
        '5m',
    });

  const fifteenMinuteMetrics =
    useMarketWideScannerMetrics({
      enabled:
        hasRuntimeSetups
        && runtimeTimeframes
          .has('15m'),
      scannerWindow:
        '15m',
    });

  const marketSymbols24hQuery =
    useApiQuery(
      'scanner-market-symbols-24h',
      () =>
        fetchRuntimeMarketSymbols(),
      {
        intervalMs:
          15_000,

        preserveData:
          true,
      },
    );

  const quoteVolumes24h =
    useMemo<
      Readonly<
        Record<string, number>
      >
    >(
      () => {
        const index:
        Record<string, number> = {};

        for (
          const symbol
          of marketSymbols24hQuery.data
            ?? []
        ) {
          index[
            symbol.symbol
              .trim()
              .replace(
                /\//gu,
                '',
              )
              .toUpperCase()
          ] =
            symbol.volumeQuote;
        }

        return index;
      },
      [
        marketSymbols24hQuery.data,
      ],
    );

  const setupMetrics =
    useMemo(
      () =>
        indexScannerSetupMetrics([
          oneMinuteMetrics.metrics,
          fiveMinuteMetrics.metrics,
          fifteenMinuteMetrics.metrics,
        ]),
      [
        oneMinuteMetrics.metrics,
        fiveMinuteMetrics.metrics,
        fifteenMinuteMetrics.metrics,
      ],
    );

  const anchorSetups =
    useMemo(
      () =>
        applyScannerSetupLiveMetrics(
          setups,
          setupMetrics,
          quoteVolumes24h,
        ),
      [
        setups,
        setupMetrics,
        quoteVolumes24h,
      ],
    );

  const displayedSetups =
    resultsMode === 'setups'
      ? anchorSetups
      : [];

  const filteredSetups = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase();
    const maxDistance = distance === 'all' ? null : Number(distance);
    const minTouches = touches === 'all' ? null : Number(touches);
    const result = displayedSetups.filter((setup) => {
      if (normalizedSearch && !setup.symbol.includes(normalizedSearch)) return false;
      if (direction !== 'all' && setup.direction !== direction) return false;
      if (kind !== 'all' && setup.kind !== kind) return false;
      if (stage !== 'all' && setup.stage !== stage) return false;
      if (maxDistance !== null && setup.distancePercent > maxDistance) return false;
      if (minTouches !== null && setup.touches < minTouches) return false;
      if (
        btcStrength === 'positive'
        && (
          setup.btcStrength === null
          || setup.btcStrength <= 0
        )
      ) return false;

      if (
        btcStrength === 'negative'
        && (
          setup.btcStrength === null
          || setup.btcStrength >= 0
        )
      ) return false;
      return true;
    });

    return sortScannerSetupRows(
      result,
      sortState,
    );
  }, [
    btcStrength,
    direction,
    distance,
    kind,
    search,
    sortState,
    stage,
    touches,
    displayedSetups,
  ]);

  const selectedSetup = useMemo(() => {
    return filteredSetups.find((setup) => setup.id === requestedSetupId)
      ?? displayedSetups.find((setup) => setup.id === requestedSetupId)
      ?? anchorSetups.find((setup) => setup.id === requestedSetupId)
      ?? filteredSetups[0]
      ?? displayedSetups[0]
      ?? anchorSetups[0];
  }, [
    anchorSetups,
    displayedSetups,
    filteredSetups,
    requestedSetupId,
  ]);

  useEffect(() => {
    if (
      typeof globalThis.matchMedia !== 'function'
      || !globalThis
        .matchMedia('(min-width: 1280px)')
        .matches
    ) {
      return;
    }

    selectedRowRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [selectedSetup.id]);

  const selectedSymbol = requestedSymbol ?? selectedSetup.symbol;
  const isMarketPreview =
    selectedSetup.id.startsWith(
      'market-preview:',
    )
    || selectedSymbol !== selectedSetup.symbol;
  const workspaceSetupId = isMarketPreview
    ? `market-${selectedSymbol.toLowerCase()}`
    : selectedSetup.id;

  const candlesQuery = useMarketCandles({
    symbol: selectedSymbol,
    timeframe: chartTimeframe,
  });
  const causalLevelLines = useCausalLevelLines({
    symbol: selectedSymbol,
    timeframe: chartTimeframe,
    candles: candlesQuery.data ?? [],
  });
  const chartHorizontalSegments =
    useMemo(
      () =>
        buildSelectedSetupHorizontalSegments(
          selectedSetup,
          isMarketPreview,
          causalLevelLines
            .horizontalSegments,
        ),
      [
        causalLevelLines
          .horizontalSegments,
        isMarketPreview,
        selectedSetup,
      ],
    );

  const realtime = useRealtimeMarketData({
    symbol:
      selectedSymbol,
    enabled:
      candlesQuery.status
      === 'success',
  });
  const realtimeSnapshot = realtime.snapshots[selectedSymbol];
  const realtimeMarket = useMemo(
    () => buildScannerRealtimeMarketView(
      realtimeSnapshot,
    ),
    [realtimeSnapshot],
  );
  const realtimeIsCurrent =
    realtime.lifecycleState
      === 'open'
    && realtime.status?.state
      === 'connected'
    && realtimeMarket.price
      !== null;
  const selectedDistance =
    useMemo(
      () =>
        buildScannerSetupDistanceView(
          selectedSetup,
          {
            price:
              realtimeMarket.price,
            updatedAt:
              realtimeMarket.updatedAt,
            isCurrent:
              realtimeIsCurrent,
          },
        ),
      [
        realtimeIsCurrent,
        realtimeMarket.price,
        realtimeMarket.updatedAt,
        selectedSetup,
      ],
    );
  const selectedDistanceTimeLabel =
    selectedDistance.calculatedAt
      ? formatScannerTradeTime(
          selectedDistance.calculatedAt,
        )
      : 'время неизвестно';
  const selectedDistanceSourceLabel =
    selectedDistance.source
      === 'current'
      ? `Текущее · ${selectedDistanceTimeLabel}`
      : selectedDistance.source
          === 'market-snapshot'
        ? `Рыночный снимок · ${selectedDistanceTimeLabel}`
        : selectedDistance.source
            === 'candidate-snapshot'
          ? `Снимок Setup Engine · ${selectedDistanceTimeLabel}`
          : 'Расстояние недоступно';

  const selectedFuturesMetrics =
    useMarketWideScannerMetrics({
      enabled:
        resultsMode === 'setups'
        || isMarketPreview,
      intervalMs:
        5_000,
      scannerWindow:
        '1m',
      symbol:
        selectedSymbol,
    });

  const selectedFuturesMetric =
    selectedFuturesMetrics
      .metrics[
        selectedSymbol
      ]
    ?? null;

  const liquidationHistory =
    useMarketWideLiquidations({
      enabled:
        resultsMode === 'setups'
        || isMarketPreview,
      intervalMs:
        2_000,
      limit:
        6,
      symbol:
        selectedSymbol,
    });

  const latestLiquidation =
    liquidationHistory
      .liquidations[0]
    ?? null;

  const markPrice =
    realtimeSnapshot
      ?.markPrice
    ?? null;

  const realtimeLabel = getScannerRealtimeConnectionLabel(
    realtime.lifecycleState,
    realtime.status?.state ?? null,
  );
  const realtimeDotClass = realtime.lifecycleState === 'open'
    && realtime.status?.state === 'connected'
    ? styles.liveDotConnected
    : realtime.lifecycleState === 'error'
      ? styles.liveDotError
      : styles.liveDotPending;

  const volumeSpikes = useMarketVolumeSpikes({
    limit: 12,
    intervalMs: 5_000,
    periodMinutes:
      DEFAULT_VOLUME_SPIKE_FILTERS.periodMinutes,
    baselinePeriods:
      DEFAULT_VOLUME_SPIKE_FILTERS.baselinePeriods,
    minVolumeRatio:
      DEFAULT_VOLUME_SPIKE_FILTERS.minVolumeRatio,
    minTradesRatio:
      DEFAULT_VOLUME_SPIKE_FILTERS.minTradesRatio,
    minCurrentQuoteVolume:
      DEFAULT_VOLUME_SPIKE_FILTERS.minCurrentQuoteVolume,
    statuses:
      VOLUME_SPIKE_STATUSES,
  });

  const selectedVolumeSpike =
    volumeSpikes.spikes.find(
      (spike) => spike.symbol === selectedSymbol,
    ) ?? null;

  const selectedMarket24h = useMemo(
    () =>
      findScannerMarketSymbol24h(
        marketSymbols24hQuery.data ?? [],
        selectedSymbol,
      ),
    [
      marketSymbols24hQuery.data,
      selectedSymbol,
    ],
  );

  const marketPreviewPriceChange =
    selectedVolumeSpike?.priceChangePct ?? null;

  const displayDirection: TradeDirection = isMarketPreview
    ? marketPreviewPriceChange !== null
      && marketPreviewPriceChange < 0
      ? 'short'
      : 'long'
    : selectedSetup.direction;

  const selectedPriceChange24h =
    selectedMarket24h
      ?.priceChangePct
    ?? null;

  const displayPriceChange =
    formatScanner24hPercent(
      selectedPriceChange24h,
    );

  const displayPriceChangeClass =
    selectedPriceChange24h === null
      ? undefined
      : selectedPriceChange24h < 0
        ? styles.negativeValue
        : styles.positiveValue;
  useEffect(() => {
    if (resultsMode !== 'setups') {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('setupId', selectedSetup.id);
    nextParams.set('preset', preset);
    nextParams.set('scannerWindow', scannerWindow);

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [preset, resultsMode, scannerWindow, searchParams, selectedSetup.id, setSearchParams]);

  const selectSetup = (setupId: string) => {
    const nextSetup =
      displayedSetups.find(
        (setup) =>
          setup.id === setupId,
      );

    if (nextSetup) {
      setChartTimeframe(
        nextSetup.timeframe,
      );
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('setupId', setupId);
    nextParams.delete('symbol');
    setSearchParams(nextParams);
  };

  const { openSetupFeedback } = useFeedbackPageContext({
    screen: 'Scanner',
    symbol: selectedSymbol,
    timeframe: chartTimeframe,
    setupId: workspaceSetupId,
    dock: 'hidden',
  });

  const selectTableSort = (
    sortKey:
      ScannerSetupTableSortKey,
  ) => {
    setSortState(
      (current) =>
        nextScannerSetupSortState(
          current,
          sortKey,
        ),
    );
  };

  const resetFilters = () => {
    setSearch('');
    setDirection('all');
    setKind('all');
    setStage('all');
    setDistance('all');
    setTouches('all');
    setBtcStrength('all');
    setMinQuoteVolumeMillions(
      DEFAULT_SCANNER_MIN_QUOTE_VOLUME_MILLIONS,
    );
    setSortState({
      ...DEFAULT_SCANNER_SETUP_TABLE_SORT_STATE,
    });
  };

  const advancedFilterCount = [
    distance !== 'all',
    touches !== 'all',
    btcStrength !== 'all',
  ].filter(Boolean).length;

  const candidatesStateLabel =
    resultsMode === 'loading'
      ? 'Обновление списка'
      : resultsMode === 'error'
        ? 'Ошибка обновления'
        : setupsDataState === 'retained-loading'
          ? 'Сохранённые · обновление'
          : setupsDataState === 'retained-error'
            ? 'Сохранённые · ошибка'
            : 'Список актуален';

  return (
    <section className={styles.scanner} data-scanner-layout="focus">
      <header className={styles.pageHeader} title={setupsSourceDescription}>
        <div className={styles.headerSummary}>
          <h1 className={styles.title}>Scanner</h1>
          <span className={styles.candidateCount}>
            <strong>{filteredSetups.length}</strong> кандидатов
          </span>
          <span className={styles.listState}>{candidatesStateLabel}</span>
        </div>

        <div className={styles.headerControls}>
          <div
            className={styles.shadowModeControl}
            aria-label="Источник уровней Scanner"
          >
            <div className={styles.shadowModeButtons}>
              <button
                type="button"
                className={!shadowEnabled ? styles.shadowModeActive : ''}
                aria-pressed={!shadowEnabled}
                onClick={() => setShadowEnabled(false)}
              >
                V1
              </button>
              <button
                type="button"
                className={shadowEnabled ? styles.shadowModeActive : ''}
                aria-pressed={shadowEnabled}
                onClick={() => setShadowEnabled(true)}
              >
                V1 + V2 Shadow
              </button>
            </div>
            <span className={styles.shadowModeMeta}>
              {shadowStatusLabel}
              {shadowEnabled && shadowStatus === 'error' ? (
                <button
                  type="button"
                  onClick={() => setShadowRetryToken((current) => current + 1)}
                  title={shadowError?.message}
                >
                  Повторить
                </button>
              ) : null}
            </span>
          </div>

          <div className={styles.headerStatus}>
            <span
              className={`${styles.liveDot} ${realtimeDotClass}`}
              aria-hidden="true"
            />
            {resultsMode === 'setups'
              ? `${realtimeLabel} · ${selectedSymbol}`
              : resultsMode === 'loading'
                ? 'Обновляем кандидатов'
                : resultsMode === 'error'
                  ? 'Ошибка обновления'
                  : '0 кандидатов'}
          </div>
        </div>
      </header>

      <section className={styles.filtersPanel} aria-label="Фильтры Scanner">
        <div className={styles.filterPrimaryRow}>
          <label className={styles.searchField}>
            <span>Инструмент</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="SOLUSDT"
            />
          </label>

          <label className={styles.volumeFilterField}>
            <span>Объём 24ч от, млн</span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={minQuoteVolumeMillions}
              onChange={(event) => setMinQuoteVolumeMillions(event.target.value)}
              placeholder="0"
            />
          </label>

          <div className={styles.directionFilter}>
            <span className={styles.controlLabel}>Направление</span>
            <div className={styles.segmentedControl}>
              {(['all', 'long', 'short'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={direction === value ? styles.segmentActive : ''}
                  onClick={() => setDirection(value)}
                >
                  {value === 'all' ? 'Все' : value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.selectField}>
            <span>Тип сетапа</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as KindFilter)}>
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className={styles.selectField}>
            <span>Стадия</span>
            <select value={stage} onChange={(event) => setStage(event.target.value as StageFilter)}>
              {STAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className={styles.selectField}>
            <span title="Меняет свечи и уровни открытого графика, сохраняя выбранный инструмент и сетап.">
              Таймфрейм графика
            </span>
            <select
              value={chartTimeframe}
              onChange={(event) => setChartTimeframe(event.target.value as ScannerTimeframe)}
            >
              {availableTimeframes.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>

          <button
            className={styles.moreFiltersButton}
            type="button"
            aria-expanded={advancedFiltersOpen}
            aria-controls="scanner-advanced-filters"
            onClick={() => setAdvancedFiltersOpen((open) => !open)}
          >
            Ещё фильтры
            {advancedFilterCount > 0 ? <strong>{advancedFilterCount}</strong> : null}
          </button>

          <button className={styles.resetButton} type="button" onClick={resetFilters}>
            Сбросить
          </button>
        </div>

        {advancedFiltersOpen ? (
          <div
            className={styles.advancedFilters}
            id="scanner-advanced-filters"
            data-testid="scanner-advanced-filters"
          >
            <label className={styles.compactSelect}>
              <span>
                До уровня · снимок
                <InfoHint label="Сохранённое Setup Engine расстояние: |цена снимка − центральная цена уровня| / центральная цена уровня × 100%. Единица — процентные пункты." />
              </span>
              <select value={distance} onChange={(event) => setDistance(event.target.value as DistanceFilter)}>
                <option value="all">Любое</option>
                <option value="0.5">≤ 0.5%</option>
                <option value="1">≤ 1%</option>
                <option value="2">≤ 2%</option>
              </select>
            </label>

            <label className={styles.compactSelect}>
              <span>Касания <InfoHint label="Количество подтверждённых взаимодействий цены с найденной зоной." /></span>
              <select value={touches} onChange={(event) => setTouches(event.target.value as TouchesFilter)}>
                <option value="all">Любое</option>
                <option value="2">От 2</option>
                <option value="3">От 3</option>
              </select>
            </label>

            <label className={styles.compactSelect}>
              <span>Сила к BTC <InfoHint label="Насколько инструмент сильнее или слабее BTC за сопоставимый период." /></span>
              <select value={btcStrength} onChange={(event) => setBtcStrength(event.target.value as BtcStrengthFilter)}>
                <option value="all">Любая</option>
                <option value="positive">Сильнее BTC</option>
                <option value="negative">Слабее BTC</option>
              </select>
            </label>
          </div>
        ) : null}
      </section>

      {filteredSetups.length === 0 && !isMarketPreview ? (
        <section className={styles.chartGridPanel} aria-label="Пустой результат Scanner">
          <div className={styles.chartGridEmpty}>
            <strong>
              {resultsMode === 'loading'
                ? 'Обновляем кандидатов'
                : resultsMode === 'error'
                  ? 'Кандидаты не загрузились'
                  : 'Сетапы не найдены'}
            </strong>
            <span>
              {resultsMode === 'loading'
                ? 'Ждём ответ Setup Engine для нового порога объёма.'
                : resultsMode === 'error'
                  ? 'Измени фильтры или повтори запрос после восстановления backend.'
                  : 'Измени фильтры или сбрось их, чтобы вернуть кандидатов.'}
            </span>
            {resultsMode !== 'loading' ? (
              <button type="button" onClick={resetFilters}>Сбросить фильтры</button>
            ) : null}
          </div>
        </section>
      ) : (
        <div className={styles.scannerGrid} data-testid="scanner-focus-grid">
          <article className={styles.tablePanel} aria-label="Кандидаты Scanner">
            <div className={styles.candidatePanelHeader}>
              <div>
                <p className={styles.panelEyebrow}>Кандидаты</p>
                <strong>{setupsSourceLabel}</strong>
              </div>
              <div className={styles.sortControl}>
                <select
                  aria-label="Сортировка кандидатов"
                  value={sortState.sortBy}
                  onChange={(event) => selectTableSort(event.target.value as ScannerSetupTableSortKey)}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => selectTableSort(sortState.sortBy)}
                  aria-label={sortState.sortDirection === 'asc' ? 'По возрастанию' : 'По убыванию'}
                  title={sortState.sortDirection === 'asc' ? 'По возрастанию' : 'По убыванию'}
                >
                  {sortState.sortDirection === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

            <div className={styles.tableBody} data-testid="scanner-candidate-list">
              {filteredSetups.map((setup) => {
                const selected = setup.id === selectedSetup.id;
                const levelCenterLabel =
                  setup.levelReferencePrice !== undefined
                  && Number.isFinite(setup.levelReferencePrice)
                    ? formatScannerPrice(setup.levelReferencePrice)
                    : null;
                const snapshotDistanceLabel =
                  Number.isFinite(setup.distancePercent)
                  && setup.distanceLabel !== '—'
                    ? setup.distanceLabel
                    : null;

                return (
                  <button
                    key={setup.id}
                    type="button"
                    ref={selected ? selectedRowRef : undefined}
                    className={`${styles.tableRow} ${setup.source === 'v2-shadow' ? styles.tableRowShadow : ''} ${selected ? styles.tableRowSelected : ''}`}
                    onClick={() => selectSetup(setup.id)}
                    aria-pressed={selected}
                    data-setup-id={setup.id}
                    data-direction={setup.direction}
                  >
                    <span className={styles.cardPrimaryRow}>
                      <span className={styles.instrumentCell}>
                        <TokenLogo symbol={setup.symbol} size={26} className={styles.coinMark} />
                        <strong data-testid="scanner-card-symbol">{setup.symbol}</strong>
                      </span>
                      <span className={styles.cardDirectionBadge}>
                        <DirectionBadge direction={setup.direction} />
                      </span>
                      <span className={styles.cardStageBadge}>
                        <SetupStageBadge
                          stage={setup.stage}
                          resultLabel={
                            setup.source === 'v2-shadow'
                              ? 'Отскок'
                              : setup.kind.includes('Отскок')
                                ? 'Отскок'
                                : 'Пробой'
                          }
                        />
                      </span>
                    </span>

                    <span className={styles.cardSecondaryRow}>
                      <span className={styles.kindCell}>{setup.kind}</span>
                      <span className={styles.cardMetaValue}>{setup.timeframe}</span>
                      <span className={styles.cardMetaValue}>{setup.touches} кас.</span>
                      {setup.source === 'v2-shadow' ? (
                        <span className={styles.shadowSourceBadge}>V2 SHADOW</span>
                      ) : null}
                    </span>

                    <span className={styles.cardMetricRow}>
                      {levelCenterLabel ? (
                        <span><small>Центр</small><strong>{levelCenterLabel}</strong></span>
                      ) : null}
                      {snapshotDistanceLabel ? (
                        <span><small>До уровня · снимок</small><strong className={styles.distanceValue}>{snapshotDistanceLabel}</strong></span>
                      ) : null}
                      {setup.btcStrength !== null ? (
                        <span>
                          <small>К BTC</small>
                          <strong className={setup.btcStrength >= 0 ? styles.positiveValue : styles.negativeValue}>
                            {setup.btcStrengthLabel}
                          </strong>
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </article>

          <aside className={styles.previewPanel} aria-label="Выбранный кандидат и контекст">
            <div className={styles.chartColumn}>
              <div className={styles.previewHeader}>
                <div className={styles.setupHeaderLine}>
                  <div className={styles.symbolLine}>
                    <TokenLogo symbol={selectedSymbol} size={30} className={styles.previewLogo} eager />
                    <h2>{selectedSymbol}</h2>
                    <DirectionBadge direction={displayDirection} />
                  </div>
                  <span className={styles.timeframeBadge} title="Таймфрейм открытого графика">
                    График · {chartTimeframe}
                  </span>
                  {!isMarketPreview ? (
                    <span className={styles.timeframeBadge} title="Таймфрейм выбранного кандидата">
                      Сетап · {selectedSetup.timeframe}
                    </span>
                  ) : null}
                  <span className={styles.setupKindInline}>
                    {isMarketPreview ? 'Рыночный обзор' : selectedSetup.kind}
                  </span>
                  {!isMarketPreview ? (
                    <>
                      <SetupStageBadge
                        stage={selectedSetup.stage}
                        resultLabel={
                          selectedSetup.source === 'v2-shadow'
                            ? 'Отскок'
                            : selectedSetup.kind.includes('Отскок')
                              ? 'Отскок'
                              : 'Пробой'
                        }
                      />
                      <span className={styles.setupZoneInline}>Зона {selectedSetup.level}</span>
                    </>
                  ) : null}
                </div>

                <div className={styles.priceBlock}>
                  <strong>{realtimeMarket.priceLabel}</strong>
                  <div className={styles.priceMeta}>
                    <span className={displayPriceChangeClass} title="Изменение цены за 24 часа по Binance">
                      {displayPriceChange} · 24Ч
                    </span>
                    <span className={`${styles.priceSourceBadge} ${realtimeIsCurrent ? styles.priceSourceLive : styles.priceSourceUnavailable}`}>
                      {realtimeIsCurrent
                        ? 'LIVE'
                        : realtimeMarket.price !== null
                          ? 'SNAPSHOT'
                          : 'UNAVAILABLE'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.chartCanvas} data-testid="scanner-chart-canvas">
                <ScannerChartMarketOverlay
                  symbol={selectedSymbol}
                  market24h={selectedMarket24h}
                  realtimeMarket={realtimeMarket}
                  realtimeDotClassName={realtimeDotClass}
                  markPrice={markPrice?.price ?? null}
                  fundingRatePct={markPrice?.fundingRatePct ?? null}
                  openInterest={selectedFuturesMetric?.openInterest}
                  latestLiquidation={latestLiquidation}
                  liquidationStatus={liquidationHistory.status}
                  hasRealtimeError={Boolean(realtime.error)}
                  hasFuturesError={Boolean(liquidationHistory.error || selectedFuturesMetrics.error)}
                  onReconnect={realtime.reconnect}
                  onRetryFutures={() => {
                    liquidationHistory.retry();
                    selectedFuturesMetrics.retry();
                  }}
                />

                {candlesQuery.status === 'loading' ? (
                  <div className={styles.chartState}>Загружаем свечи…</div>
                ) : null}
                {candlesQuery.status === 'error' ? (
                  <div className={styles.chartState}>
                    <span>Свечи не загрузились.</span>
                    <button type="button" onClick={candlesQuery.retry}>Повторить</button>
                  </div>
                ) : null}
                {candlesQuery.status === 'success' && candlesQuery.data?.length === 0 ? (
                  <div className={styles.chartState}>Для выбранного периода нет свечей.</div>
                ) : null}
                {candlesQuery.status === 'success' && candlesQuery.data && candlesQuery.data.length > 0 ? (
                  <NexusCandlestickChart
                    candles={candlesQuery.data}
                    symbol={selectedSymbol}
                    horizontalSegments={chartHorizontalSegments}
                    fillContainer
                    enableDrawingTools
                    drawingScope={`scanner:${selectedSymbol}:${chartTimeframe}`}
                    onLoadOlder={candlesQuery.loadOlder}
                    isLoadingOlder={candlesQuery.isLoadingOlder}
                    hasMore={candlesQuery.hasMore}
                  />
                ) : null}
              </div>
            </div>

            <div className={styles.nexusColumn} data-testid="scanner-context-panel">
              <div className={styles.nexusContextHeader}>
                <p className={styles.panelEyebrow}>NEXUS · CONTEXT</p>
                <h3>{isMarketPreview ? 'Рыночный контекст' : 'Контекст сетапа'}</h3>
                {!isMarketPreview ? (
                  <div className={styles.contextIdentity}>
                    <span>{selectedSetup.kind}</span>
                    <DirectionBadge direction={selectedSetup.direction} />
                    <SetupStageBadge
                      stage={selectedSetup.stage}
                      resultLabel={selectedSetup.kind.includes('Отскок') ? 'Отскок' : 'Пробой'}
                    />
                  </div>
                ) : null}
              </div>

              {isMarketPreview ? (
                <div className={styles.previewMetrics}>
                  {selectedVolumeSpike ? (
                    <>
                      <div><span>Период</span><strong>{selectedVolumeSpike.periodMinutes} мин</strong></div>
                      <div><span>Объём</span><strong>{selectedVolumeSpike.volumeRatio.toFixed(2)}×</strong></div>
                      <div><span>Сделки</span><strong>{selectedVolumeSpike.tradesRatio.toFixed(2)}×</strong></div>
                    </>
                  ) : null}
                  <div><span>Изменение 24ч</span><strong className={displayPriceChangeClass}>{displayPriceChange}</strong></div>
                </div>
              ) : (
                <>
                  <div className={styles.contextDistance}>
                    <span>
                      Расстояние до centerPrice
                      <InfoHint label="Формула: |показанная цена − центральная опорная цена выбранного уровня| / центральная опорная цена × 100%. Единица — процентные пункты. Границы диапазона зоны в этом расчёте не выбираются." />
                    </span>
                    <strong
                      className={styles.distanceValue}
                      title={
                        selectedDistance.price !== null && selectedDistance.levelReferencePrice !== null
                          ? `${formatScannerPrice(selectedDistance.price)} → ${formatScannerPrice(selectedDistance.levelReferencePrice)}`
                          : undefined
                      }
                    >
                      {selectedDistance.distanceLabel}
                    </strong>
                    <small>{selectedDistanceSourceLabel}</small>
                  </div>

                  <div className={styles.previewMetrics}>
                    <div><span>Касания</span><strong>{selectedSetup.touches}</strong></div>
                    <div><span>Формирование</span><strong>{selectedSetup.formationLabel}</strong></div>
                    {selectedSetup.volumeAnomaly !== null ? (
                      <div><span>Объём</span><strong>{selectedSetup.volumeAnomaly.toFixed(2)}×</strong></div>
                    ) : null}
                    {selectedSetup.tradesAnomaly !== null ? (
                      <div><span>Сделки</span><strong>{selectedSetup.tradesAnomaly.toFixed(2)}×</strong></div>
                    ) : null}
                    {selectedSetup.btcStrength !== null ? (
                      <div>
                        <span>Сила к BTC</span>
                        <strong className={selectedSetup.btcStrength >= 0 ? styles.positiveValue : styles.negativeValue}>
                          {selectedSetup.btcStrengthLabel}
                        </strong>
                      </div>
                    ) : null}
                  </div>
                </>
              )}

              {selectedSetup.source === 'v2-shadow' ? (
                <LevelV2ShadowInspectionPanel
                  symbol={selectedSymbol}
                  levelId={selectedSetup.shadowLevelId ?? null}
                  lifecycleStatus={selectedSetup.shadowStatus ?? null}
                />
              ) : null}

              <section className={styles.reasonBlock}>
                <p className={styles.panelEyebrow}>
                  {isMarketPreview ? 'Режим просмотра рынка' : 'Почему в Scanner'}
                </p>
                {isMarketPreview ? (
                  <p>Показаны реальные свечи и realtime-данные без подмены чужим торговым сетапом.</p>
                ) : (
                  <ul>{selectedSetup.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                )}
              </section>

              {selectedSetup.source === 'v2-shadow' ? (
                <div className={styles.shadowOnlyNotice}>
                  <strong>V2 SHADOW · только наблюдение</strong>
                  <span>Уровень не создаёт production-сетап, Workspace или алерт.</span>
                </div>
              ) : (
                <div className={styles.previewActions}>
                  <Link
                    className={styles.primaryLink}
                    to={buildWorkspaceUrl(ROUTES.workspace, {
                      setupId: workspaceSetupId,
                      symbol: selectedSymbol,
                      preset,
                      scannerWindow,
                      timeframe: chartTimeframe,
                    })}
                  >
                    Открыть Workspace <span aria-hidden="true">→</span>
                  </Link>
                  <button className={styles.secondaryLink} type="button" onClick={openSetupFeedback}>
                    Оценить сетап
                  </button>
                  <button
                    className={styles.disabledAction}
                    type="button"
                    disabled
                    title="Создание пользовательских алертов из Scanner ещё не подключено"
                  >
                    Алерты пока недоступны
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}


export function ScannerPage() {
  const [
    searchParams,
  ] = useSearchParams();

  const requestedSymbol =
    searchParams
      .get(
        'symbol',
      )
      ?.trim()
      .toUpperCase()
    ?? null;

  const requestedMinQuoteVolumeMillions =
    searchParams.get(
      'minQuoteVolumeMillions',
    );

  const [
    minQuoteVolumeMillions,
    setMinQuoteVolumeMillions,
  ] = useState(
    () =>
      resolveInitialScannerMinQuoteVolumeMillions(
        requestedMinQuoteVolumeMillions,
      ),
  );

  const minQuoteVolume24h =
    parseScannerMinQuoteVolumeMillions(
      minQuoteVolumeMillions,
    );

  const setupQueryKey =
    `scanner-setups:${minQuoteVolume24h}`;

  const query =
    useApiQuery(
      setupQueryKey,
      async () => ({
        key:
          setupQueryKey,

        setups:
          await nexusApi.getScannerSetups(
            minQuoteVolume24h > 0
              ? {
                  minQuoteVolume24h,
                }
              : {},
          ),
      }),
      {
        preserveData:
          false,
      },
    );

  const queryDataForCurrentKey =
    query.data?.key
    === setupQueryKey
      ? query.data
      : null;

  const [
    retainedSetupSnapshot,
    setRetainedSetupSnapshot,
  ] = useState<{
    key: string;
    setups: ScannerSetup[];
  } | null>(null);

  const [
    lastNonEmptySetups,
    setLastNonEmptySetups,
  ] = useState<ScannerSetup[]>([]);

  useEffect(
    () => {
      if (queryDataForCurrentKey !== null) {
        setRetainedSetupSnapshot({
          key:
            setupQueryKey,

          setups:
            queryDataForCurrentKey
              .setups,
        });

        if (
          queryDataForCurrentKey
            .setups.length > 0
        ) {
          setLastNonEmptySetups(
            queryDataForCurrentKey
              .setups,
          );
        }
      }
    },
    [
      queryDataForCurrentKey,
      setupQueryKey,
    ],
  );

  useSetupLifecycleRefresh({
    onEvent:
      query.retry,
  });

  const currentSetups =
    queryDataForCurrentKey
      ?.setups
    ?? [];

  const retainedSetups =
    retainedSetupSnapshot?.key
    === setupQueryKey
      ? retainedSetupSnapshot.setups
      : [];

  const hasDisplayableSetups =
    currentSetups.length > 0
    || retainedSetups.length > 0;

  const setupsDataState:
    | 'live'
    | 'retained-loading'
    | 'retained-error' =
      query.status === 'error'
      && hasDisplayableSetups
        ? 'retained-error'
        : query.status === 'loading'
          && hasDisplayableSetups
            ? 'retained-loading'
            : 'live';

  const setupsForDisplay =
    currentSetups.length > 0
      ? currentSetups
      : setupsDataState !== 'live'
        && retainedSetups.length > 0
        ? retainedSetups
        : lastNonEmptySetups;

  const resultsMode:
    | 'setups'
    | 'loading'
    | 'empty'
    | 'error' =
      currentSetups.length > 0
      || (
        setupsDataState !== 'live'
        && retainedSetups.length > 0
      )
        ? 'setups'
        : queryDataForCurrentKey !== null
          ? 'empty'
          : query.status === 'error'
            ? 'error'
            : 'loading';

  const marketPreviewAnchor =
    requestedSymbol
      ? createMarketPreviewAnchor(
          requestedSymbol,
        )
      : null;

  const contentSetups =
    setupsForDisplay.length > 0
      ? setupsForDisplay
      : marketPreviewAnchor
        ? [
            marketPreviewAnchor,
          ]
        : [];

  if (
    query.status === 'loading'
    && contentSetups.length === 0
  ) {
    return (
      <AsyncDataState
        state="loading"
        title="Загружаем кандидатов Scanner"
        message="Получаем активные сетапы из Setup Engine."
      />
    );
  }

  if (
    query.status === 'error'
    && contentSetups.length === 0
  ) {
    return (
      <AsyncDataState
        state="error"
        title="Кандидаты Scanner не загрузились"
        message={
          query.error?.message
          ?? 'Не удалось получить активные сетапы из Setup Engine.'
        }
        onRetry={
          query.retry
        }
      />
    );
  }

  if (
    contentSetups.length === 0
  ) {
    return (
      <AsyncDataState
        state="empty"
        title="Активных сетапов сейчас нет"
        message="Setup Engine не вернул кандидатов для текущего порога объёма."
      />
    );
  }

  return (
    <ScannerPageContent
      setups={
        contentSetups
      }
      setupsDataState={
        setupsDataState
      }
      resultsMode={
        resultsMode
      }
      minQuoteVolumeMillions={
        minQuoteVolumeMillions
      }
      setMinQuoteVolumeMillions={
        setMinQuoteVolumeMillions
      }
    />
  );
}
