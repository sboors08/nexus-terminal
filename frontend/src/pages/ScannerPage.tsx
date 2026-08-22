import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { useFeedbackPageContext } from '@/shared/feedback/FeedbackProvider';
import { buildWorkspaceUrl } from '@/shared/routing/setupContext';
import {
  NexusCandlestickChart,
  NexusMiniCandlestickChart,
  useMarketCandles,
} from '@/shared/charts';
import {
  CausalLevelStateStrip,
  useCausalLevelLines,
} from '@/shared/level-lines';
import {
  DEFAULT_SCANNER_SETUP_TABLE_SORT_STATE,
  applyScannerSetupLiveMetrics,
  buildScannerRealtimeMarketView,
  formatScannerPrice,
  formatScannerQuantity,
  formatScannerTradeTime,
  getScannerRealtimeConnectionLabel,
  indexScannerSetupMetrics,
  isScannerSetupBelowKnownQuoteVolume,
  nextScannerSetupSortState,
  sortScannerSetupRows,
  useMarketVolumeSpikes,
  useMarketWideScannerMetrics,
  useRealtimeMarketData,
  type MarketVolumeSpike,
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
import styles from './ScannerPage.module.css';

type DirectionFilter = 'all' | TradeDirection;
type StageFilter = 'all' | SetupStage;
type TimeframeFilter = 'all' | ScannerTimeframe;
type KindFilter = 'all' | ScannerSetupKind;
type DistanceFilter = 'all' | '0.5' | '1' | '2';
type TouchesFilter = 'all' | '2' | '3';
type BtcStrengthFilter = 'all' | 'positive' | 'negative';
type ScannerViewMode = 'list' | 'grid';

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

const VOLUME_SPIKE_STATUS_LABELS: Record<MarketVolumeSpikeStatus, string> = {
  new: 'НОВЫЙ',
  growing: 'РАСТЁТ',
  stable: 'СТАБИЛЬНЫЙ',
  fading: 'ЗАТУХАЕТ',
};

const VOLUME_SPIKE_PERIOD_OPTIONS:
readonly MarketVolumeSpikePeriodMinutes[] = [
  1,
  3,
  5,
  15,
];

const VOLUME_SPIKE_STATUSES:
readonly MarketVolumeSpikeStatus[] = [
  'new',
  'growing',
  'stable',
  'fading',
];

const DEFAULT_VOLUME_SPIKE_FILTERS = {
  periodMinutes: 5 as MarketVolumeSpikePeriodMinutes,
  baselinePeriods: 12,
  minVolumeRatio: 2,
  minTradesRatio: 1.5,
  minCurrentQuoteVolume: 50_000,
};

function getVolumeSpikeStatusClass(status: MarketVolumeSpikeStatus): string {
  if (status === 'new') return styles.volumeSpikeNew;
  if (status === 'growing') return styles.volumeSpikeGrowing;
  if (status === 'stable') return styles.volumeSpikeStable;
  return styles.volumeSpikeFading;
}

function formatVolumeSpikeQuoteVolume(value: number): string {
  return `${new Intl.NumberFormat('ru-RU', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)} USDT`;
}

function formatVolumeSpikePriceChange(value: number | null): string {
  if (value === null) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatVolumeSpikeUpdatedAt(value: string | null): string {
  if (!value) return 'ожидание данных';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'обновлено';

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);
}

function InfoHint({ label }: { label: string }) {
  return (
    <button className={styles.infoHint} type="button" aria-label={label} data-tooltip={label}>
      ?
    </button>
  );
}

type SortableTableHeaderProps = {
  label: string;
  sortKey: ScannerSetupTableSortKey;
  sortState: ScannerSetupTableSortState;
  onSort: (sortKey: ScannerSetupTableSortKey) => void;
  hint?: string;
};

function SortableTableHeader({
  label,
  sortKey,
  sortState,
  onSort,
  hint,
}: SortableTableHeaderProps) {
  const active =
    sortState.sortBy
    === sortKey;

  const ariaSort:
    'none'
    | 'ascending'
    | 'descending' =
      active
        ? sortState.sortDirection
          === 'desc'
            ? 'descending'
            : 'ascending'
        : 'none';

  const indicator =
    active
      ? sortState.sortDirection
        === 'desc'
          ? '↓'
          : '↑'
      : '↕';

  return (
    <span
      className={
        `${styles.sortableHeader} ${
          hint
            ? styles.headerWithHint
            : ''
        }`
      }
      role="columnheader"
      aria-sort={ariaSort}
    >
      <button
        type="button"
        className={
          active
            ? `${styles.sortButton} ${styles.sortButtonActive}`
            : styles.sortButton
        }
        onClick={() => onSort(sortKey)}
        aria-label={
          `Сортировать «${label}»: ${
            active
              ? sortState.sortDirection === 'desc'
                ? 'сейчас по убыванию'
                : 'сейчас по возрастанию'
              : 'первое нажатие по убыванию'
          }`
        }
      >
        <span>{label}</span>
        <span
          className={styles.sortIndicator}
          aria-hidden="true"
        >
          {indicator}
        </span>
      </button>

      {
        hint
          ? <InfoHint label={hint} />
          : null
      }
    </span>
  );
}

function ScannerPageContent({
  setups:
    v1Setups,

  setupsDataState,

  minQuoteVolumeMillions,

  setMinQuoteVolumeMillions,
}: {
  setups:
    ScannerSetup[];

  setupsDataState:
    | 'live'
    | 'retained-loading'
    | 'retained-error';

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
  const [
    viewMode,
    setViewMode,
  ] = useState<ScannerViewMode>(
    'list',
  );

  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [kind, setKind] = useState<KindFilter>('all');
  const [stage, setStage] = useState<StageFilter>('all');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');
  const [distance, setDistance] = useState<DistanceFilter>('all');
  const [touches, setTouches] = useState<TouchesFilter>('all');
  const [btcStrength, setBtcStrength] = useState<BtcStrengthFilter>('all');
  const [sortState, setSortState] =
    useState<ScannerSetupTableSortState>({
      ...DEFAULT_SCANNER_SETUP_TABLE_SORT_STATE,
    });

  const [
    volumeSpikePeriodMinutes,
    setVolumeSpikePeriodMinutes,
  ] = useState<MarketVolumeSpikePeriodMinutes>(
    DEFAULT_VOLUME_SPIKE_FILTERS.periodMinutes,
  );

  const [
    volumeSpikeBaselinePeriods,
    setVolumeSpikeBaselinePeriods,
  ] = useState(
    DEFAULT_VOLUME_SPIKE_FILTERS.baselinePeriods,
  );

  const [
    volumeSpikeMinVolumeRatio,
    setVolumeSpikeMinVolumeRatio,
  ] = useState(
    DEFAULT_VOLUME_SPIKE_FILTERS.minVolumeRatio,
  );

  const [
    volumeSpikeMinTradesRatio,
    setVolumeSpikeMinTradesRatio,
  ] = useState(
    DEFAULT_VOLUME_SPIKE_FILTERS.minTradesRatio,
  );

  const [
    volumeSpikeMinCurrentQuoteVolume,
    setVolumeSpikeMinCurrentQuoteVolume,
  ] = useState(
    DEFAULT_VOLUME_SPIKE_FILTERS.minCurrentQuoteVolume,
  );

  const [
    volumeSpikeStatuses,
    setVolumeSpikeStatuses,
  ] = useState<MarketVolumeSpikeStatus[]>(
    [...VOLUME_SPIKE_STATUSES],
  );

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
    useMemo(
      () =>
        (
          [
            '1m',
            '5m',
            '15m',
          ] as const
        ).filter(
          (value) =>
            runtimeTimeframes.has(
              value,
            ),
        ),
      [runtimeTimeframes],
    );

  useEffect(
    () => {
      if (
        timeframe !== 'all'
        && !runtimeTimeframes.has(
          timeframe,
        )
      ) {
        setTimeframe('all');
      }
    },
    [
      runtimeTimeframes,
      timeframe,
    ],
  );

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

  const displayedSetups =
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

  const filteredSetups = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase();
    const maxDistance = distance === 'all' ? null : Number(distance);
    const minTouches = touches === 'all' ? null : Number(touches);
    const parsedMinQuoteVolumeMillions =
      Number(
        minQuoteVolumeMillions
          .replace(',', '.'),
      );

    const minQuoteVolume =
      Number.isFinite(
        parsedMinQuoteVolumeMillions,
      )
      && parsedMinQuoteVolumeMillions > 0
        ? parsedMinQuoteVolumeMillions
            * 1_000_000
        : 0;

    const result = displayedSetups.filter((setup) => {
      if (normalizedSearch && !setup.symbol.includes(normalizedSearch)) return false;
      if (direction !== 'all' && setup.direction !== direction) return false;
      if (kind !== 'all' && setup.kind !== kind) return false;
      if (stage !== 'all' && setup.stage !== stage) return false;
      if (timeframe !== 'all' && setup.timeframe !== timeframe) return false;
      if (
        isScannerSetupBelowKnownQuoteVolume(
          setup,
          minQuoteVolume,
        )
      ) return false;
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
    minQuoteVolumeMillions,
    search,
    sortState,
    stage,
    timeframe,
    touches,
    displayedSetups,
  ]);

  const gridSetups =
    useMemo(
      () => {
        const uniqueSetups =
          new Map<
            string,
            ScannerSetup
          >();

        for (
          const setup
          of filteredSetups
        ) {
          if (
            !uniqueSetups.has(
              setup.symbol,
            )
          ) {
            uniqueSetups.set(
              setup.symbol,
              setup,
            );
          }

          if (
            uniqueSetups.size
            === 4
          ) {
            break;
          }
        }

        return [
          ...uniqueSetups.values(),
        ];
      },
      [
        filteredSetups,
      ],
    );

  const selectedSetup = useMemo(() => {
    return filteredSetups.find((setup) => setup.id === requestedSetupId)
      ?? displayedSetups.find((setup) => setup.id === requestedSetupId)
      ?? filteredSetups[0]
      ?? displayedSetups[0];
  }, [
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
  const isMarketPreview = selectedSymbol !== selectedSetup.symbol;
  const workspaceSetupId = isMarketPreview
    ? `market-${selectedSymbol.toLowerCase()}`
    : selectedSetup.id;

  const candlesQuery = useMarketCandles({
    symbol: selectedSymbol,
    timeframe: selectedSetup.timeframe,
  });
  const causalLevelLines = useCausalLevelLines({
    symbol: selectedSymbol,
    timeframe: selectedSetup.timeframe,
    candles: candlesQuery.data ?? [],
  });

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
      volumeSpikePeriodMinutes,
    baselinePeriods:
      volumeSpikeBaselinePeriods,
    minVolumeRatio:
      volumeSpikeMinVolumeRatio,
    minTradesRatio:
      volumeSpikeMinTradesRatio,
    minCurrentQuoteVolume:
      volumeSpikeMinCurrentQuoteVolume,
    statuses:
      volumeSpikeStatuses,
  });

  const selectedVolumeSpike =
    volumeSpikes.spikes.find(
      (spike) => spike.symbol === selectedSymbol,
    ) ?? null;

  const marketPreviewPriceChange =
    selectedVolumeSpike?.priceChangePct ?? null;

  const displayDirection: TradeDirection = isMarketPreview
    ? marketPreviewPriceChange !== null
      && marketPreviewPriceChange < 0
      ? 'short'
      : 'long'
    : selectedSetup.direction;

  const displayPriceChange = isMarketPreview
    ? marketPreviewPriceChange === null
      ? '—'
      : `${marketPreviewPriceChange >= 0 ? '+' : ''}${marketPreviewPriceChange.toFixed(2)}%`
    : selectedSetup.priceChange;
  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('setupId', selectedSetup.id);
    nextParams.set('preset', preset);
    nextParams.set('scannerWindow', scannerWindow);

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [preset, scannerWindow, searchParams, selectedSetup.id, setSearchParams]);

  const selectSetup = (setupId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('setupId', setupId);
    nextParams.delete('symbol');
    setSearchParams(nextParams);
  };

  const toggleVolumeSpikeStatus = (
    status: MarketVolumeSpikeStatus,
  ) => {
    setVolumeSpikeStatuses(
      (current) => {
        if (current.includes(status)) {
          if (current.length === 1) {
            return current;
          }

          return current.filter(
            (item) =>
              item !== status,
          );
        }

        return [
          ...current,
          status,
        ];
      },
    );
  };

  const resetVolumeSpikeFilters = () => {
    setVolumeSpikePeriodMinutes(
      DEFAULT_VOLUME_SPIKE_FILTERS.periodMinutes,
    );
    setVolumeSpikeBaselinePeriods(
      DEFAULT_VOLUME_SPIKE_FILTERS.baselinePeriods,
    );
    setVolumeSpikeMinVolumeRatio(
      DEFAULT_VOLUME_SPIKE_FILTERS.minVolumeRatio,
    );
    setVolumeSpikeMinTradesRatio(
      DEFAULT_VOLUME_SPIKE_FILTERS.minTradesRatio,
    );
    setVolumeSpikeMinCurrentQuoteVolume(
      DEFAULT_VOLUME_SPIKE_FILTERS
        .minCurrentQuoteVolume,
    );
    setVolumeSpikeStatuses(
      [...VOLUME_SPIKE_STATUSES],
    );
  };

  const selectVolumeSpike = (spike: MarketVolumeSpike) => {
    setSearch(spike.symbol);

    const matchingSetup = displayedSetups.find((setup) => setup.symbol === spike.symbol);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('symbol', spike.symbol);

    if (matchingSetup) {
      nextParams.set('setupId', matchingSetup.id);
    }

    setSearchParams(nextParams);
  };

  useFeedbackPageContext({
    screen: 'Scanner',
    symbol: selectedSymbol,
    timeframe: selectedSetup.timeframe,
    setupId: workspaceSetupId,
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
    setTimeframe('all');
    setDistance('all');
    setTouches('all');
    setBtcStrength('all');
    setMinQuoteVolumeMillions('0');
    setSortState({
      ...DEFAULT_SCANNER_SETUP_TABLE_SORT_STATE,
    });
  };

  return (
    <section className={styles.scanner}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
          {setupsSourceDescription}
        </p>
          <h1 className={styles.title}>Scanner</h1>
          <p className={styles.subtitle}>Полный список найденных ситуаций с фильтрацией, сортировкой и предпросмотром.</p>
        </div>
        <div className={styles.headerControls}>
          <div
            className={styles.shadowModeControl}
            aria-label="Источник уровней Scanner"
          >
            <div className={styles.shadowModeButtons}>
              <button
                type="button"
                className={
                  !shadowEnabled
                    ? styles.shadowModeActive
                    : ''
                }
                aria-pressed={!shadowEnabled}
                onClick={() =>
                  setShadowEnabled(
                    false,
                  )
                }
              >
                V1
              </button>

              <button
                type="button"
                className={
                  shadowEnabled
                    ? styles.shadowModeActive
                    : ''
                }
                aria-pressed={shadowEnabled}
                onClick={() =>
                  setShadowEnabled(
                    true,
                  )
                }
              >
                V1 + V2 Shadow
              </button>
            </div>

            <div className={styles.shadowModeMeta}>
              <span>{shadowStatusLabel}</span>

              {
                shadowEnabled
                && shadowStatus === 'error'
                  ? (
                      <button
                        type="button"
                        onClick={() =>
                          setShadowRetryToken(
                            (current) =>
                              current + 1,
                          )
                        }
                        title={
                          shadowError
                            ?.message
                        }
                      >
                        Повторить
                      </button>
                    )
                  : null
              }
            </div>
          </div>

          <div className={styles.headerStatus}>
            <span
              className={`${styles.liveDot} ${realtimeDotClass}`}
              aria-hidden="true"
            />
            {realtimeLabel} ? {selectedSymbol}
          </div>
        </div>
      </header>

      <section className={styles.filtersPanel} aria-label="Фильтры Scanner">
        <div className={styles.filterTopRow}>
          <label className={styles.searchField}>
            <span>Поиск инструмента</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Например, SOLUSDT"
            />
          </label>

                    <label className={styles.volumeFilterField}>
            <span>
              {'\u041e\u0431\u044a\u0451\u043c 24\u0447 \u043e\u0442, \u043c\u043b\u043d USDT'}
            </span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={minQuoteVolumeMillions}
              onChange={(event) =>
                setMinQuoteVolumeMillions(
                  event.target.value,
                )
              }
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
              {KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className={styles.selectField}>
            <span>Стадия</span>
            <select value={stage} onChange={(event) => setStage(event.target.value as StageFilter)}>
              {STAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className={styles.selectField}>
            <span title="Показаны только таймфреймы, на которых production Setup Engine вернул текущие кандидаты.">
              Таймфрейм сетапа
            </span>
            <select value={timeframe} onChange={(event) => setTimeframe(event.target.value as TimeframeFilter)}>
              <option value="all">Все TF</option>
              {availableTimeframes.map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        <div className={styles.filterBottomRow}>
          <label className={styles.compactSelect}>
            <span>До уровня <InfoHint label="Текущее расстояние цены до ближайшей границы ценовой зоны." /></span>
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

          <div className={styles.filterSummary}>
            <strong>{filteredSetups.length}</strong>
            <span>
              {
                hasRuntimeSetups
                  ? (
                      Number(
                        minQuoteVolumeMillions
                          .replace(',', '.'),
                      ) > 0
                        ? 'кандидатов после фильтров'
                        : `из ${setups.length} загружено`
                    )
                  : `из ${setups.length} сетапов`
              }
            </span>
          </div>

          <button className={styles.resetButton} type="button" onClick={resetFilters}>Сбросить фильтры</button>
        </div>
      </section>

      {
        viewMode === 'grid'
          ? (
              <section
                className={styles.chartGridPanel}
                aria-label="Сетка графиков кандидатов Scanner"
              >
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>
                      Результаты поиска
                    </p>
                    <h2>
                      Сетка кандидатов
                    </h2>
                  </div>

                  <div className={styles.panelHeaderActions}>
                    <span className={styles.testBadge}>
                      {setupsSourceLabel}
                    </span>

                    <div
                      className={styles.viewModeControl}
                      aria-label="Режим отображения кандидатов"
                    >
                      <button
                        type="button"
                        className={
                          false
                            ? styles.viewModeActive
                            : ''
                        }
                        aria-pressed={false}
                        onClick={() => setViewMode('list')}
                      >
                        Список
                      </button>

                      <button
                        type="button"
                        className={
                          viewMode === 'grid'
                            ? styles.viewModeActive
                            : ''
                        }
                        aria-pressed={viewMode === 'grid'}
                        onClick={() => setViewMode('grid')}
                      >
                        Сетка
                      </button>
                    </div>
                  </div>
                </div>

                {
                  gridSetups.length > 0
                    ? (
                        <div className={styles.chartGrid}>
                          {
                            gridSetups.map(
                              (setup) => {
                                const selected =
                                  setup.id
                                  === selectedSetup.id;

                                return (
                                  <button
                                    key={setup.id}
                                    type="button"
                                    className={`${styles.chartGridCard} ${selected ? styles.chartGridCardSelected : ''}`}
                                    aria-pressed={selected}
                                    aria-label={`Открыть ${setup.symbol} в основном графике`}
                                    onClick={() => {
                                      selectSetup(
                                        setup.id,
                                      );

                                      setViewMode(
                                        'list',
                                      );
                                    }}
                                  >
                                    <span className={styles.chartGridCardHeader}>
                                      <span className={styles.chartGridIdentity}>
                                        <strong>
                                          {setup.symbol}
                                        </strong>
                                        <small>
                                          {setup.exchange}
                                          {' · '}
                                          {setup.timeframe}
                                        </small>
                                      </span>

                                      <DirectionBadge
                                        direction={setup.direction}
                                      />
                                    </span>

                                    <span className={styles.chartGridSetupMeta}>
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

                                      <span>
                                        {setup.kind}
                                      </span>
                                    </span>

                                    <span className={styles.chartGridChart}>
                                      <NexusMiniCandlestickChart
                                        symbol={setup.symbol}
                                        timeframe={setup.timeframe}
                                      />
                                    </span>

                                    <span className={styles.chartGridMetrics}>
                                      <span>
                                        <small>До уровня</small>
                                        <strong>
                                          {setup.distanceLabel}
                                        </strong>
                                      </span>

                                      <span>
                                        <small>Касания</small>
                                        <strong>
                                          {setup.touches}
                                        </strong>
                                      </span>

                                      <span>
                                        <small>Объём</small>
                                        <strong>
                                          {
                                            setup.volumeAnomaly === null
                                              ? '—'
                                              : `${setup.volumeAnomaly.toFixed(2)}×`
                                          }
                                        </strong>
                                      </span>

                                      <span>
                                        <small>Сила к BTC</small>
                                        <strong>
                                          {setup.btcStrengthLabel}
                                        </strong>
                                      </span>
                                    </span>
                                  </button>
                                );
                              },
                            )
                          }
                        </div>
                      )
                    : (
                        <div className={styles.chartGridEmpty}>
                          <strong>
                            Сетапы не найдены
                          </strong>
                          <span>
                            Измени фильтры или сбрось их, чтобы вернуть кандидатов.
                          </span>
                          <button
                            type="button"
                            onClick={resetFilters}
                          >
                            Сбросить фильтры
                          </button>
                        </div>
                      )
                }
              </section>
            )
          : (
              <div className={styles.scannerGrid}>
        <article className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Результаты поиска</p>
              <h2>Кандидаты и уровни</h2>
            </div>

            <div className={styles.panelHeaderActions}>
              <span className={styles.testBadge}>
                {setupsSourceLabel}
              </span>

              <div
                className={styles.viewModeControl}
                aria-label="Режим отображения кандидатов"
              >
                <button
                  type="button"
                  className={
                    viewMode === 'list'
                      ? styles.viewModeActive
                      : ''
                  }
                  aria-pressed={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                >
                  Список
                </button>

                <button
                  type="button"
                  className={
                    false
                      ? styles.viewModeActive
                      : ''
                  }
                  aria-pressed={false}
                  onClick={() => setViewMode('grid')}
                >
                  Сетка
                </button>
              </div>
            </div>
          </div>
          <div className={styles.tableViewport}>
            <div
              className={styles.tableHeader}
              role="row"
              aria-label="Сортируемые столбцы Scanner"
            >
              <SortableTableHeader
                label="Инструмент"
                sortKey="symbol"
                sortState={sortState}
                onSort={selectTableSort}
              />
              <SortableTableHeader
                label="Напр."
                sortKey="direction"
                sortState={sortState}
                onSort={selectTableSort}
              />
              <SortableTableHeader
                label="Тип сетапа"
                sortKey="kind"
                sortState={sortState}
                onSort={selectTableSort}
              />
              <SortableTableHeader
                label="Стадия"
                sortKey="stage"
                sortState={sortState}
                onSort={selectTableSort}
              />
              <SortableTableHeader
                label="TF"
                sortKey="timeframe"
                sortState={sortState}
                onSort={selectTableSort}
              />
              <SortableTableHeader
                label="Уровень"
                sortKey="level"
                sortState={sortState}
                onSort={selectTableSort}
              />
              <SortableTableHeader
                label="Касания"
                sortKey="touches"
                sortState={sortState}
                onSort={selectTableSort}
              />
              <SortableTableHeader
                label="Формирование"
                sortKey="formation"
                sortState={sortState}
                onSort={selectTableSort}
              />
              <SortableTableHeader
                label="До уровня"
                sortKey="distance"
                sortState={sortState}
                onSort={selectTableSort}
              />
              <SortableTableHeader
                label="Откаты"
                sortKey="pullbacks"
                sortState={sortState}
                onSort={selectTableSort}
              />
              <SortableTableHeader
                label="Объём"
                sortKey="volume"
                sortState={sortState}
                onSort={selectTableSort}
                hint="Отношение текущего объёма к медиане предыдущих периодов для этого инструмента и таймфрейма."
              />
              <SortableTableHeader
                label="Сделки"
                sortKey="trades"
                sortState={sortState}
                onSort={selectTableSort}
                hint="Отношение текущего количества сделок к медиане предыдущих периодов."
              />
              <SortableTableHeader
                label="Сила к BTC"
                sortKey="btcStrength"
                sortState={sortState}
                onSort={selectTableSort}
                hint="Положительное значение означает, что инструмент сильнее BTC; отрицательное — слабее."
              />
            </div>

            <div className={styles.tableBody}>
              {filteredSetups.map((setup) => {
                const selected = setup.id === selectedSetup.id;
                return (
                  <button
                    key={setup.id}
                    type="button"
                    ref={selected ? selectedRowRef : undefined}
                    className={`${styles.tableRow} ${setup.source === 'v2-shadow' ? styles.tableRowShadow : ''} ${selected ? styles.tableRowSelected : ''}`}
                    onClick={() => selectSetup(setup.id)}
                    aria-pressed={selected}
                  >
                    <span className={styles.instrumentCell}>
                      <span className={styles.coinMark}>{setup.symbol.slice(0, 1)}</span>
                      <span>
                        <strong>{setup.symbol}</strong>
                        <small>{setup.exchange}</small>
                        <span
                          className={
                            setup.source === 'v2-shadow'
                              ? styles.shadowSourceBadge
                              : styles.v1SourceBadge
                          }
                        >
                          {
                            setup.source === 'v2-shadow'
                              ? 'V2 SHADOW'
                              : 'V1'
                          }
                        </span>
                      </span>
                    </span>
                    <DirectionBadge direction={setup.direction} />
                    <span className={styles.kindCell}>{setup.kind}</span>
                    <SetupStageBadge
                      stage={setup.stage}
                      resultLabel={
                      setup.source === 'v2-shadow'
                        ? '\u041e\u0442\u0441\u043a\u043e\u043a'
                        : setup.kind.includes(
                            '\u041e\u0442\u0441\u043a\u043e\u043a',
                          )
                          ? '\u041e\u0442\u0441\u043a\u043e\u043a'
                          : '\u041f\u0440\u043e\u0431\u043e\u0439'
                    }
                    />
                    <span className={styles.monoCell}>{setup.timeframe}</span>
                    <span className={styles.levelCell}>{setup.level}</span>
                    <strong className={styles.centerCell}>{setup.touches}</strong>
                    <span className={styles.monoCell}>{setup.formationLabel}</span>
                    <strong className={setup.stage === 'triggered' ? styles.triggeredValue : styles.distanceValue}>{setup.distanceLabel}</strong>
                    <span>{setup.pullbackDepth}</span>
                    <strong className={styles.monoCell}>
                      {
                        setup.volumeAnomaly
                          === null
                            ? '—'
                            : setup.volumeAnomaly
                                .toFixed(2)
                              + '×'
                      }
                    </strong>
                    <strong className={styles.monoCell}>
                      {
                        setup.tradesAnomaly
                          === null
                            ? '—'
                            : setup.tradesAnomaly
                                .toFixed(2)
                              + '×'
                      }
                    </strong>
                    <strong
                      className={
                        setup.btcStrength
                        === null
                          ? styles.monoCell
                          : setup.btcStrength >= 0
                            ? styles.positiveValue
                            : styles.negativeValue
                      }
                    >
                      {
                        setup.btcStrength
                        === null
                          ? '—'
                          : setup.btcStrengthLabel
                      }
                    </strong>
                  </button>
                );
              })}

              {filteredSetups.length === 0 && (
                <div className={styles.emptyState}>
                  <strong>Сетапы не найдены</strong>
                  <span>Измени фильтры или сбрось их, чтобы вернуть полный список.</span>
                  <button type="button" onClick={resetFilters}>Сбросить фильтры</button>
                </div>
              )}
            </div>
          </div>
        </article>

        <aside className={styles.previewPanel} aria-label="Предпросмотр выбранного сетапа">
          <div className={styles.chartColumn}>
            <div className={styles.previewHeader}>
              <div className={styles.setupHeaderLine}>
                <div className={styles.symbolLine}>
                  <h2>{selectedSymbol}</h2>
                  <DirectionBadge direction={displayDirection} />
                  <span className={styles.timeframeBadge}>
                    {selectedSetup.timeframe}
                  </span>
                  <span
                    className={
                      selectedSetup.source === 'v2-shadow'
                        ? styles.shadowSourceBadge
                        : styles.v1SourceBadge
                    }
                  >
                    {
                      selectedSetup.source === 'v2-shadow'
                        ? 'V2 SHADOW'
                        : 'V1'
                    }
                  </span>
                </div>

                <span className={styles.setupKindInline}>
                  {
                    isMarketPreview
                      ? '\u0420\u044b\u043d\u043e\u0447\u043d\u044b\u0439 \u043e\u0431\u0437\u043e\u0440'
                      : selectedSetup.kind
                  }
                </span>

                {
                  isMarketPreview
                    ? (
                          <span className={styles.marketPreviewInline}>
                            Volume Spike ? {'\u0441\u0435\u0442\u0430\u043f \u0435\u0449\u0451 \u043d\u0435 \u0441\u0444\u043e\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u043d'}
                          </span>
                        )
                    : (
                          <>
                            <SetupStageBadge
                              stage={selectedSetup.stage}
                              resultLabel={
                                selectedSetup.source === 'v2-shadow'
                                  ? '\u041e\u0442\u0441\u043a\u043e\u043a'
                                  : selectedSetup.kind.includes(
                                      '\u041e\u0442\u0441\u043a\u043e\u043a',
                                    )
                                    ? '\u041e\u0442\u0441\u043a\u043e\u043a'
                                    : '\u041f\u0440\u043e\u0431\u043e\u0439'
                              }
                            />

                            <span className={styles.setupZoneInline}>
                              {'\u0417\u043e\u043d\u0430'} {selectedSetup.level}
                            </span>
                          </>
                        )
                }
              </div>

              <div className={styles.priceBlock}>
                <strong>{realtimeMarket.priceLabel}</strong>
                <div className={styles.priceMeta}>
                  <span
                    className={
                      displayDirection === 'long'
                        ? styles.positiveValue
                        : styles.negativeValue
                    }
                  >
                    {displayPriceChange}
                  </span>
                  <span
                    className={`${styles.priceSourceBadge} ${
                      realtimeMarket.isLive
                        ? styles.priceSourceLive
                        : styles.priceSourceUnavailable
                    }`}
                  >
                    {realtimeMarket.isLive ? 'LIVE' : 'UNAVAILABLE'}
                  </span>
                </div>
              </div>
            </div>
            <section className={styles.realtimeStrip} aria-label={`Realtime рынок ${selectedSymbol}`}>
              <div>
                <span>Bid</span>
                <strong className={styles.positiveValue}>{realtimeMarket.bidLabel}</strong>
              </div>
              <div>
                <span>Ask</span>
                <strong className={styles.negativeValue}>{realtimeMarket.askLabel}</strong>
              </div>
              <div>
                <span>Спред</span>
                <strong>{realtimeMarket.spreadLabel}</strong>
              </div>
              <footer className={styles.realtimeStripFooter}>
                <span>
                  {realtimeMarket.isLive
                    ? `Обновлено ${realtimeMarket.updatedAtLabel}`
                    : `Для ${selectedSymbol} нет активной realtime-подписки`}
                </span>
                {realtime.error && (
                  <button type="button" onClick={realtime.reconnect}>Переподключить</button>
                )}
              </footer>
            </section>

            <div className={styles.chartCanvas}>
              {candlesQuery.status === 'loading' && (
                <div className={styles.chartState}>
                  Загружаем свечи…
                </div>
              )}

              {candlesQuery.status === 'error' && (
                <div className={styles.chartState}>
                  <span>Свечи не загрузились.</span>
                  <button type="button" onClick={candlesQuery.retry}>
                    Повторить
                  </button>
                </div>
              )}

              {candlesQuery.status === 'success'
                && candlesQuery.data?.length === 0 && (
                  <div className={styles.chartState}>
                    Для выбранного периода нет свечей.
                  </div>
                )}

              {candlesQuery.status === 'success'
                && candlesQuery.data
                && candlesQuery.data.length > 0 && (
                  <NexusCandlestickChart
                    candles={candlesQuery.data}
                    symbol={selectedSymbol}
                    horizontalSegments={causalLevelLines.horizontalSegments}
                    fillContainer
                    enableDrawingTools
                    drawingScope={`scanner:${selectedSymbol}:${selectedSetup.timeframe}`}
                    onLoadOlder={candlesQuery.loadOlder}
                    isLoadingOlder={candlesQuery.isLoadingOlder}
                    hasMore={candlesQuery.hasMore}
                  />
                )}
            </div>

            <CausalLevelStateStrip levels={causalLevelLines} />

            <section className={styles.tradesPanel} aria-label={`Последние сделки ${selectedSymbol}`}>
              <div className={styles.tradesHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Realtime tape</p>
                  <h3>Последние сделки</h3>
                </div>
                <span>{realtimeMarket.recentTrades.length > 0 ? `${realtimeMarket.recentTrades.length} последних` : 'нет данных'}</span>
              </div>

              {realtimeMarket.recentTrades.length > 0 ? (
                <div className={styles.tradesList}>
                  {realtimeMarket.recentTrades.map((trade) => (
                    <div className={styles.tradeRow} key={trade.id}>
                      <time dateTime={trade.timestamp}>{formatScannerTradeTime(trade.timestamp)}</time>
                      <span className={trade.side === 'buy' ? styles.tradeBuy : styles.tradeSell}>
                        {trade.side === 'buy' ? 'BUY' : 'SELL'}
                      </span>
                      <strong>{formatScannerPrice(trade.price)}</strong>
                      <span>{formatScannerQuantity(trade.quantity)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.tradesEmpty}>
                  Запусти backend, чтобы увидеть поток сделок по {selectedSymbol}.
                </p>
              )}
            </section>
          </div>

          <div className={styles.nexusColumn}>
            <div className={styles.nexusContextHeader}>
              <p className={styles.panelEyebrow}>NEXUS ? CONTEXT</p>
              <h3>
  {
    isMarketPreview
      ? '\u0420\u044b\u043d\u043e\u0447\u043d\u044b\u0439 \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442'
      : selectedSetup.source
        === 'v2-shadow'
          ? '\u041a\u043e\u043d\u0442\u0435\u043a\u0441\u0442 \u0443\u0440\u043e\u0432\u043d\u044f'
          : '\u041a\u043e\u043d\u0442\u0435\u043a\u0441\u0442 \u0441\u0435\u0442\u0430\u043f\u0430'
  }
</h3>
              <span>
                {
                  selectedSetup.source === 'v2-shadow'
                    ? 'V2 Shadow ? только наблюдение'
                    : 'Производственный контур V1'
                }
              </span>
            </div>

            {isMarketPreview ? (
              <div className={styles.previewMetrics}>
                <div>
                  <span>Период</span>
                  <strong>
                    {selectedVolumeSpike
                      ? `${selectedVolumeSpike.periodMinutes} мин`
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Объём</span>
                  <strong>
                    {selectedVolumeSpike
                      ? `${selectedVolumeSpike.volumeRatio.toFixed(2)}×`
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Сделки</span>
                  <strong>
                    {selectedVolumeSpike
                      ? `${selectedVolumeSpike.tradesRatio.toFixed(2)}×`
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Изменение</span>
                  <strong className={displayDirection === 'long' ? styles.positiveValue : styles.negativeValue}>
                    {displayPriceChange}
                  </strong>
                </div>
              </div>
            ) : (
              <div className={styles.previewMetrics}>
                <div>
                  <span>До уровня <InfoHint label="Расстояние от текущей цены до ближайшей границы зоны." /></span>
                  <strong className={styles.distanceValue}>{selectedSetup.distanceLabel}</strong>
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
                  <span>Объём</span>
                  <strong>
                    {
                      selectedSetup.volumeAnomaly
                      === null
                        ? '—'
                        : selectedSetup.volumeAnomaly
                            .toFixed(2)
                          + '×'
                    }
                  </strong>
                </div>
                <div>
                  <span>Сделки</span>
                  <strong>
                    {
                      selectedSetup.tradesAnomaly
                      === null
                        ? '—'
                        : selectedSetup.tradesAnomaly
                            .toFixed(2)
                          + '×'
                    }
                  </strong>
                </div>
                <div>
                  <span>Сила к BTC</span>
                  <strong
                    className={
                      selectedSetup.btcStrength
                      === null
                        ? styles.monoCell
                        : selectedSetup.btcStrength >= 0
                          ? styles.positiveValue
                          : styles.negativeValue
                    }
                  >
                    {
                      selectedSetup.btcStrength
                      === null
                        ? '—'
                        : selectedSetup.btcStrengthLabel
                    }
                  </strong>
                </div>
              </div>
            )}

            {
              selectedSetup.source === 'v2-shadow'
                ? (
                    <LevelV2ShadowInspectionPanel
                      symbol={selectedSymbol}
                      levelId={
                        selectedSetup
                          .shadowLevelId
                        ?? null
                      }
                      lifecycleStatus={
                        selectedSetup
                          .shadowStatus
                        ?? null
                      }
                    />
                  )
                : null
            }

            <section className={styles.reasonBlock}>
              <p className={styles.panelEyebrow}>
                {isMarketPreview ? 'Режим просмотра рынка' : 'Почему в Scanner'}
              </p>

              {isMarketPreview ? (
                <p>
                  Монета выбрана из Volume Spikes. Показаны реальные свечи и realtime-данные без подмены чужим торговым сетапом.
                </p>
              ) : (
                <ul>
                  {selectedSetup.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              )}
            </section>

            {
              selectedSetup.source === 'v2-shadow'
                ? (
                    <div className={styles.shadowOnlyNotice}>
                      <strong>V2 SHADOW · только наблюдение</strong>
                      <span>
                        Уровень не создаёт production-сетап,
                        Workspace или алерт.
                      </span>
                    </div>
                  )
                : (
                    <div className={styles.previewActions}>
                      <Link
                        className={styles.primaryLink}
                        to={buildWorkspaceUrl(
                          ROUTES.workspace,
                          {
                            setupId:
                              workspaceSetupId,
                            symbol:
                              selectedSymbol,
                            preset,
                            scannerWindow,
                            timeframe:
                              selectedSetup.timeframe,
                          },
                        )}
                      >
                        Открыть Workspace
                        <span aria-hidden="true">→</span>
                      </Link>

                      <button
                        className={styles.secondaryLink}
                        type="button"
                        disabled
                        title="Создание пользовательских алертов из Scanner ещё не подключено"
                      >
                        Алерты пока недоступны
                      </button>
                    </div>
                  )
            }
          </div>
        </aside>
      </div>
            )
      }

      {/* Scanner UX v2: secondary market pulse below workspace */}
      <section className={styles.volumeSpikesPanel} aria-label="Всплески объёма">
  <div className={styles.volumeSpikesHeader}>
    <div>
      <p className={styles.panelEyebrow}>Market-wide · Binance Futures</p>
      <h2>ВСПЛЕСКИ ОБЪЁМА</h2>
      <p>
        {volumeSpikePeriodMinutes} мин · медиана{' '}
        {volumeSpikeBaselinePeriods} предыдущих периодов
      </p>
    </div>
    <div className={styles.volumeSpikesConnection}>
      <span
        className={`${styles.volumeSpikesConnectionDot} ${
          volumeSpikes.status === 'error'
            ? styles.volumeSpikesConnectionError
            : volumeSpikes.status === 'ready'
              ? styles.volumeSpikesConnectionReady
              : styles.volumeSpikesConnectionPending
        }`}
        aria-hidden="true"
      />
      <span>
        <strong>{
          volumeSpikes.status === 'error'
            ? 'ОШИБКА API'
            : volumeSpikes.status === 'ready'
              ? 'LIVE'
              : 'ЗАГРУЗКА'
        }</strong>
        <small>{formatVolumeSpikeUpdatedAt(volumeSpikes.lastUpdatedAt)}</small>
      </span>
    </div>
  </div>

  <div
    className={styles.volumeSpikesFilters}
    aria-label="Фильтры всплесков объёма"
  >
    <label className={styles.volumeSpikesField}>
      <span>Период</span>
      <select
        value={volumeSpikePeriodMinutes}
        onChange={(event) => {
          setVolumeSpikePeriodMinutes(
            Number(
              event.currentTarget.value,
            ) as MarketVolumeSpikePeriodMinutes,
          );
        }}
      >
        {VOLUME_SPIKE_PERIOD_OPTIONS.map(
          (value) => (
            <option
              key={value}
              value={value}
            >
              {value} мин
            </option>
          ),
        )}
      </select>
    </label>

    <label className={styles.volumeSpikesField}>
      <span>База периодов</span>
      <input
        type="number"
        min="3"
        max="48"
        step="1"
        value={volumeSpikeBaselinePeriods}
        onChange={(event) => {
          const value =
            event.currentTarget.valueAsNumber;

          if (Number.isFinite(value)) {
            setVolumeSpikeBaselinePeriods(
              Math.min(
                48,
                Math.max(
                  3,
                  Math.trunc(value),
                ),
              ),
            );
          }
        }}
      />
    </label>

    <label className={styles.volumeSpikesField}>
      <span>Объём от</span>
      <input
        type="number"
        min="1"
        max="100"
        step="0.1"
        value={volumeSpikeMinVolumeRatio}
        onChange={(event) => {
          const value =
            event.currentTarget.valueAsNumber;

          if (Number.isFinite(value)) {
            setVolumeSpikeMinVolumeRatio(
              Math.min(
                100,
                Math.max(1, value),
              ),
            );
          }
        }}
      />
      <small>× к медиане</small>
    </label>

    <label className={styles.volumeSpikesField}>
      <span>Сделки от</span>
      <input
        type="number"
        min="0.1"
        max="100"
        step="0.1"
        value={volumeSpikeMinTradesRatio}
        onChange={(event) => {
          const value =
            event.currentTarget.valueAsNumber;

          if (Number.isFinite(value)) {
            setVolumeSpikeMinTradesRatio(
              Math.min(
                100,
                Math.max(0.1, value),
              ),
            );
          }
        }}
      />
      <small>× к медиане</small>
    </label>

    <label className={styles.volumeSpikesField}>
      <span>Мин. объём USDT</span>
      <input
        type="number"
        min="0"
        max="1000000000000"
        step="10000"
        value={
          volumeSpikeMinCurrentQuoteVolume
        }
        onChange={(event) => {
          const value =
            event.currentTarget.valueAsNumber;

          if (Number.isFinite(value)) {
            setVolumeSpikeMinCurrentQuoteVolume(
              Math.min(
                1_000_000_000_000,
                Math.max(0, value),
              ),
            );
          }
        }}
      />
    </label>

    <div className={styles.volumeSpikesStatusFilters}>
      <span>Статусы</span>
      <div>
        {VOLUME_SPIKE_STATUSES.map(
          (status) => {
            const active =
              volumeSpikeStatuses
                .includes(status);

            return (
              <button
                key={status}
                type="button"
                className={
                  active
                    ? styles.volumeSpikesStatusActive
                    : ''
                }
                aria-pressed={active}
                onClick={() =>
                  toggleVolumeSpikeStatus(
                    status,
                  )
                }
              >
                {
                  VOLUME_SPIKE_STATUS_LABELS[
                    status
                  ]
                }
              </button>
            );
          },
        )}
      </div>
    </div>

    <button
      type="button"
      className={styles.volumeSpikesReset}
      onClick={resetVolumeSpikeFilters}
    >
      Сбросить
    </button>
  </div>

  {volumeSpikes.status === 'loading' && volumeSpikes.spikes.length === 0 && (
    <div className={styles.volumeSpikesState}>
      <strong>Получаем всплески с backend…</strong>
      <span>Первый ответ обычно приходит сразу после запуска Scanner.</span>
    </div>
  )}

  {volumeSpikes.status === 'error' && (
    <div className={`${styles.volumeSpikesState} ${styles.volumeSpikesError}`}>
      <span>{volumeSpikes.error?.message ?? 'Не удалось загрузить всплески объёма.'}</span>
      <button type="button" onClick={volumeSpikes.retry}>Повторить запрос</button>
    </div>
  )}

  {volumeSpikes.status === 'ready' && volumeSpikes.spikes.length === 0 && (
    <div className={styles.volumeSpikesState}>
      <strong>Активных всплесков сейчас нет</strong>
      <span>Блок обновляется автоматически каждые 5 секунд.</span>
    </div>
  )}

  {volumeSpikes.spikes.length > 0 && (
    <div className={styles.volumeSpikesGrid}>
      {volumeSpikes.spikes.map((spike) => {
        const priceClass = spike.priceChangePct === null
          ? ''
          : spike.priceChangePct >= 0
            ? styles.positiveValue
            : styles.negativeValue;

        return (
          <button
            key={`${spike.symbol}-${spike.periodStartedAt}`}
            type="button"
            className={`${styles.volumeSpikeCard} ${getVolumeSpikeStatusClass(spike.status)}`}
            onClick={() => selectVolumeSpike(spike)}
            title={`Показать ${spike.symbol} в Scanner`}
          >
            <span className={styles.volumeSpikeCardHeader}>
              <span className={styles.volumeSpikeSymbol}>
                <span className={styles.volumeSpikeCoin}>{spike.symbol.slice(0, 1)}</span>
                <span>
                  <strong>{spike.symbol}</strong>
                  <small>BINANCE FUTURES</small>
                </span>
              </span>
              <span className={styles.volumeSpikeStatus}>
                {VOLUME_SPIKE_STATUS_LABELS[spike.status]}
              </span>
            </span>

            <span className={styles.volumeSpikeMetrics}>
              <span>
                <small>СИЛА ОБЪЁМА</small>
                <strong>{spike.volumeRatio.toFixed(2)}×</strong>
              </span>
              <span>
                <small>
                  ЦЕНА · {spike.periodMinutes}М
                </small>
                <strong className={priceClass}>{formatVolumeSpikePriceChange(spike.priceChangePct)}</strong>
              </span>
              <span>
                <small>ТЕКУЩИЙ ОБЪЁМ</small>
                <strong>{formatVolumeSpikeQuoteVolume(spike.currentQuoteVolume)}</strong>
              </span>
            </span>

            <span className={styles.volumeSpikeCardFooter}>
              <span>Сделки {spike.tradesRatio.toFixed(2)}×</span>
              <span>Показать в Scanner →</span>
            </span>
          </button>
        );
      })}
    </div>
  )}
</section>
    </section>
  );
}


export function ScannerPage() {
  const [
    minQuoteVolumeMillions,
    setMinQuoteVolumeMillions,
  ] = useState('0');

  const query =
    useApiQuery(
      'scanner-setups',
      () =>
        nexusApi.getScannerSetups(),
      {
        preserveData:
          true,
      },
    );

  const [
    retainedSetups,
    setRetainedSetups,
  ] = useState<ScannerSetup[]>([]);

  useEffect(
    () => {
      if (
        query.data
        && query.data.length > 0
      ) {
        setRetainedSetups(
          query.data,
        );
      }
    },
    [
      query.data,
    ],
  );

  useSetupLifecycleRefresh({
    onEvent:
      query.retry,
  });

  const currentSetups =
    query.data
    ?? [];

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
        ? retainedSetups
        : [];

  if (
    query.status === 'loading'
    && setupsForDisplay.length === 0
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
    && setupsForDisplay.length === 0
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
    setupsForDisplay.length === 0
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
        setupsForDisplay
      }
      setupsDataState={
        setupsDataState
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
