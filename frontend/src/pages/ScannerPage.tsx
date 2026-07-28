import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { useFeedbackPageContext } from '@/shared/feedback/FeedbackProvider';
import { buildWorkspaceUrl } from '@/shared/routing/setupContext';
import {
  NexusCandlestickChart,
  useMarketCandles,
} from '@/shared/charts';
import {
  DEFAULT_SCANNER_SETUP_TABLE_SORT_STATE,
  applyScannerSetupLiveMetrics,
  buildScannerRealtimeMarketView,
  formatScannerPrice,
  formatScannerQuantity,
  formatScannerTradeTime,
  getScannerRealtimeConnectionLabel,
  indexScannerSetupMetrics,
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
import {
  TRADING_PRESET_IDS,
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

function ScannerPageContent({ setups }: { setups: ScannerSetup[] }) {
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
        ),
      [
        setups,
        setupMetrics,
      ],
    );

  const filteredSetups = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase();
    const maxDistance = distance === 'all' ? null : Number(distance);
    const minTouches = touches === 'all' ? null : Number(touches);

    const result = displayedSetups.filter((setup) => {
      if (normalizedSearch && !setup.symbol.includes(normalizedSearch)) return false;
      if (direction !== 'all' && setup.direction !== direction) return false;
      if (kind !== 'all' && setup.kind !== kind) return false;
      if (stage !== 'all' && setup.stage !== stage) return false;
      if (timeframe !== 'all' && setup.timeframe !== timeframe) return false;
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
    timeframe,
    touches,
    displayedSetups,
  ]);

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

  const selectedSymbol = requestedSymbol ?? selectedSetup.symbol;
  const isMarketPreview = selectedSymbol !== selectedSetup.symbol;
  const workspaceSetupId = isMarketPreview
    ? `market-${selectedSymbol.toLowerCase()}`
    : selectedSetup.id;

  const candlesQuery = useMarketCandles({
    symbol: selectedSymbol,
    timeframe: selectedSetup.timeframe,
  });

  const realtime = useRealtimeMarketData({ symbol: selectedSymbol });
  const realtimeSnapshot = realtime.snapshots[selectedSymbol];
  const realtimeMarket = useMemo(
    () => buildScannerRealtimeMarketView(
      realtimeSnapshot,
      isMarketPreview ? '—' : selectedSetup.price,
    ),
    [isMarketPreview, realtimeSnapshot, selectedSetup.price],
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

  const selectPreset = (value: TradingPreset) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('setupId', selectedSetup.id);
    nextParams.set('preset', value);
    nextParams.set('scannerWindow', TRADING_PRESETS[value].defaultScannerWindow);
    setSearchParams(nextParams);
  };

  const selectScannerWindow = (value: ScannerWindow) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('setupId', selectedSetup.id);
    nextParams.set('preset', preset);
    nextParams.set('scannerWindow', value);
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
    setSortState({
      ...DEFAULT_SCANNER_SETUP_TABLE_SORT_STATE,
    });
  };

  return (
    <section className={styles.scanner}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
          {
            hasRuntimeSetups
              ? 'Поиск сетапов · реальные кандидаты Setup Engine · цены realtime'
              : 'Поиск сетапов · тестовые сетапы · цены realtime'
          }
        </p>
          <h1 className={styles.title}>Scanner</h1>
          <p className={styles.subtitle}>Полный список найденных ситуаций с фильтрацией, сортировкой и предпросмотром.</p>
        </div>
        <div className={styles.headerStatus}>
          <span className={`${styles.liveDot} ${realtimeDotClass}`} aria-hidden="true" />
          {realtimeLabel} · {selectedSymbol}
        </div>
      </header>

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

      <section className={styles.filtersPanel} aria-label="Фильтры Scanner">
        <div className={styles.presetFilter}>
          <span className={styles.controlLabel}>Торговый пресет</span>
          <div
            className={`${styles.segmentedControl} ${styles.presetControl}`}
            aria-label="Торговый пресет Scanner"
          >
            {TRADING_PRESET_IDS.map((value) => (
              <button
                key={value}
                type="button"
                className={preset === value ? styles.segmentActive : ''}
                onClick={() => selectPreset(value)}
                aria-pressed={preset === value}
              >
                {TRADING_PRESETS[value].label}
              </button>
            ))}
          </div>
          <span className={styles.controlLabel}>Период анализа</span>
          <div
            className={`${styles.segmentedControl} ${styles.scannerWindowControl}`}
            aria-label="Период анализа Scanner"
          >
            {presetDefinition.scannerWindows.map((value) => (
              <button
                key={value}
                type="button"
                className={scannerWindow === value ? styles.segmentActive : ''}
                onClick={() => selectScannerWindow(value)}
                aria-pressed={scannerWindow === value}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

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
            <span>Таймфрейм</span>
            <select value={timeframe} onChange={(event) => setTimeframe(event.target.value as TimeframeFilter)}>
              <option value="all">Все TF</option>
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
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
                  ? `из ${setups.length} загружено`
                  : `из ${setups.length} сетапов`
              }
            </span>
          </div>

          <button className={styles.resetButton} type="button" onClick={resetFilters}>Сбросить фильтры</button>
        </div>
      </section>

      <div className={styles.scannerGrid}>
        <article className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Результаты поиска</p>
              <h2>Найденные сетапы</h2>
            </div>
            <span className={styles.testBadge}>
              {
                hasRuntimeSetups
                  ? 'REAL SETUPS · BINANCE'
                  : 'TEST SETUPS · LIVE MARKET'
              }
            </span>
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
                    className={`${styles.tableRow} ${selected ? styles.tableRowSelected : ''}`}
                    onClick={() => selectSetup(setup.id)}
                    aria-pressed={selected}
                  >
                    <span className={styles.instrumentCell}>
                      <span className={styles.coinMark}>{setup.symbol.slice(0, 1)}</span>
                      <span>
                        <strong>{setup.symbol}</strong>
                        <small>{setup.exchange}</small>
                      </span>
                    </span>
                    <DirectionBadge direction={setup.direction} />
                    <span className={styles.kindCell}>{setup.kind}</span>
                    <SetupStageBadge stage={setup.stage} resultLabel={setup.kind.includes('Отскок') ? 'Отскок' : 'Пробой'} />
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
          <div className={styles.previewHeader}>
            <div>
              <div className={styles.symbolLine}>
                <h2>{selectedSymbol}</h2>
                <DirectionBadge direction={displayDirection} />
                <span className={styles.timeframeBadge}>{selectedSetup.timeframe}</span>
              </div>
              <p>{isMarketPreview ? 'Рыночный обзор из Volume Spikes' : selectedSetup.kind}</p>
            </div>
            <div className={styles.priceBlock}>
              <strong>{realtimeMarket.priceLabel}</strong>
              <div className={styles.priceMeta}>
                <span className={displayDirection === 'long' ? styles.positiveValue : styles.negativeValue}>
                  {displayPriceChange}
                </span>
                <span className={`${styles.priceSourceBadge} ${realtimeMarket.isLive ? styles.priceSourceLive : styles.priceSourceFallback}`}>
                  {
                     realtimeMarket.isLive
                       ? 'LIVE'
                       : isMarketPreview
                         ? 'WAIT'
                         : selectedSetup.runtimeData
                           ? 'API'
                           : 'TEST'
                   }
                </span>
              </div>
            </div>
          </div>

          {isMarketPreview ? (
            <div className={styles.stageLine}>
              <span>Volume Spike</span>
              <span>Сетап ещё не сформирован</span>
            </div>
          ) : (
            <div className={styles.stageLine}>
              <SetupStageBadge stage={selectedSetup.stage} resultLabel={selectedSetup.kind.includes('Отскок') ? 'Отскок' : 'Пробой'} />
              <span>Зона {selectedSetup.level}</span>
            </div>
          )}

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
                  fillContainer
                  enableDrawingTools
                  drawingScope={`scanner:${selectedSymbol}:${selectedSetup.timeframe}`}
                  onLoadOlder={candlesQuery.loadOlder}
                  isLoadingOlder={candlesQuery.isLoadingOlder}
                  hasMore={candlesQuery.hasMore}
                />
              )}
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

          <div className={styles.previewActions}>
            <Link className={styles.primaryLink} to={buildWorkspaceUrl(ROUTES.workspace, {
                setupId: workspaceSetupId,
                symbol: selectedSymbol,
                preset,
                scannerWindow,
                timeframe: selectedSetup.timeframe,
              })}>
              Открыть Workspace <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.secondaryLink} to={ROUTES.alerts}>Создать алерт</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}


export function ScannerPage() {
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

  useSetupLifecycleRefresh({
    onEvent:
      query.retry,
  });

  if (query.status === 'loading') return <AsyncDataState state="loading" />;
  if (query.status === 'error') {
    return <AsyncDataState state="error" message={query.error?.message} onRetry={query.retry} />;
  }
  if (!query.data || query.data.length === 0) return <AsyncDataState state="empty" />;

  return <ScannerPageContent setups={query.data} />;
}
