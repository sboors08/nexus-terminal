import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { buildMarketWorkspaceUrl } from '@/shared/routing/setupContext';
import { useFeedbackPageContext } from '@/shared/feedback/FeedbackProvider';
import {
  buildMarketRealtimeView,
  useRealtimeMarketData,
} from '@/shared/realtime';
import { nexusApi, useApiQuery, type MarketSymbol } from '@/shared/api';
import {
  NexusCandlestickChart,
  useMarketCandles,
  type MarketCandleTimeframe,
} from '@/shared/charts';
import {
  CausalLevelStateStrip,
  useCausalLevelLines,
} from '@/shared/level-lines';
import { AsyncDataState } from '@/shared/ui/AsyncDataState';
import { TokenLogo } from '@/shared/ui/TokenLogo';
import styles from './MarketPage.module.css';

type MarketTimeframe = MarketCandleTimeframe;
type DirectionFilter = 'all' | 'gainers' | 'losers';
type StrengthFilter = 'all' | 'positive' | 'negative';
type SortKey =
  | 'change'
  | 'volume'
  | 'volumeAnomaly'
  | 'trades'
  | 'strength'
  | 'correlation'
  | 'volatility';
type SortDirection = 'asc' | 'desc';
type SettingsTab =
  | 'columns'
  | 'filters'
  | 'levels'
  | 'densities'
  | 'slopes';
type MarketColumnKey =
  | 'volume'
  | 'volumeAnomaly'
  | 'change'
  | 'volatility'
  | 'correlation'
  | 'trades'
  | 'strength';
type MarketMarkerColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple';

interface MarketPreferences {
  favorites: string[];
  markers: Partial<Record<string, MarketMarkerColor>>;
  listWidth: number;
}

interface MarketColumnDefinition {
  key: MarketColumnKey;
  label: string;
  shortLabel: string;
  sortKey: SortKey;
  width: string;
}

const TIMEFRAMES: MarketTimeframe[] = [
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
  '1d',
];

const MARKET_PREFERENCES_STORAGE_KEY =
  'nexus.market.preferences.v1';
const DEFAULT_LIST_WIDTH = 430;
const MIN_LIST_WIDTH = 330;
const MAX_LIST_WIDTH = 720;

const MARKET_MARKER_COLORS: ReadonlyArray<{
  key: MarketMarkerColor;
  label: string;
  color: string;
  soft: string;
}> = [
  {
    key: 'red',
    label: 'Красный',
    color: '#ff526b',
    soft: 'rgb(255 82 107 / 14%)',
  },
  {
    key: 'orange',
    label: 'Оранжевый',
    color: '#ff8a34',
    soft: 'rgb(255 138 52 / 14%)',
  },
  {
    key: 'yellow',
    label: 'Жёлтый',
    color: '#e7c930',
    soft: 'rgb(231 201 48 / 14%)',
  },
  {
    key: 'green',
    label: 'Зелёный',
    color: '#32d583',
    soft: 'rgb(50 213 131 / 14%)',
  },
  {
    key: 'blue',
    label: 'Синий',
    color: '#4797ff',
    soft: 'rgb(71 151 255 / 14%)',
  },
  {
    key: 'purple',
    label: 'Фиолетовый',
    color: '#9a63ff',
    soft: 'rgb(154 99 255 / 14%)',
  },
];

const SETTINGS_TABS: ReadonlyArray<{
  key: SettingsTab;
  label: string;
}> = [
  { key: 'columns', label: 'Колонки' },
  { key: 'filters', label: 'Фильтры' },
  { key: 'levels', label: 'Уровни' },
  { key: 'densities', label: 'Плотности' },
  { key: 'slopes', label: 'Наклоны' },
];

const MARKET_COLUMNS: readonly MarketColumnDefinition[] = [
  {
    key: 'volume',
    label: 'Объём за 24 часа',
    shortLabel: 'Объём 24ч',
    sortKey: 'volume',
    width: 'minmax(0, .95fr)',
  },
  {
    key: 'volumeAnomaly',
    label: 'Аномалия объёма',
    shortLabel: 'Всплеск',
    sortKey: 'volumeAnomaly',
    width: 'minmax(0, .72fr)',
  },
  {
    key: 'change',
    label: 'Изменение цены за 24 часа',
    shortLabel: 'Цена 24ч',
    sortKey: 'change',
    width: 'minmax(0, .78fr)',
  },
  {
    key: 'volatility',
    label: 'Волатильность за 24 часа',
    shortLabel: 'Вол. 24ч',
    sortKey: 'volatility',
    width: 'minmax(0, .72fr)',
  },
  {
    key: 'correlation',
    label: 'Корреляция с BTC за 24 часа',
    shortLabel: 'Корр. BTC',
    sortKey: 'correlation',
    width: 'minmax(0, .78fr)',
  },
  {
    key: 'trades',
    label: 'Сделки за 24 часа',
    shortLabel: 'Сделки 24ч',
    sortKey: 'trades',
    width: 'minmax(0, .8fr)',
  },
  {
    key: 'strength',
    label: 'Сила относительно BTC',
    shortLabel: 'Сила к BTC',
    sortKey: 'strength',
    width: 'minmax(0, .8fr)',
  },
];

const DEFAULT_VISIBLE_COLUMNS: Record<MarketColumnKey, boolean> = {
  volume: true,
  volumeAnomaly: false,
  change: true,
  volatility: true,
  correlation: true,
  trades: false,
  strength: false,
};

function formatCompact(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatUsd(value: number) {
  return '$' + new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSigned(value: number | null, suffix = '') {
  if (value === null || !Number.isFinite(value)) return '—';
  const prefix = value > 0 ? '+' : '';
  return prefix + value.toFixed(2) + suffix;
}

function formatMarketPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '—';

  const maximumFractionDigits =
    value >= 1_000
      ? 2
      : value >= 1
        ? 4
        : 8;

  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function clampListWidth(value: number) {
  return Math.min(
    MAX_LIST_WIDTH,
    Math.max(MIN_LIST_WIDTH, Math.round(value)),
  );
}

function isMarketMarkerColor(
  value: unknown,
): value is MarketMarkerColor {
  return MARKET_MARKER_COLORS.some((marker) => marker.key === value);
}

function readMarketPreferences(): MarketPreferences {
  const fallback: MarketPreferences = {
    favorites: [],
    markers: {},
    listWidth: DEFAULT_LIST_WIDTH,
  };

  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(
      MARKET_PREFERENCES_STORAGE_KEY,
    );

    if (!stored) {
      return fallback;
    }

    const parsed = JSON.parse(stored) as {
      favorites?: unknown;
      markers?: unknown;
      listWidth?: unknown;
    };
    const favorites = Array.isArray(parsed.favorites)
      ? parsed.favorites.filter(
          (value): value is string =>
            typeof value === 'string' && value.length > 0,
        )
      : [];
    const markers: Partial<Record<string, MarketMarkerColor>> = {};

    if (
      parsed.markers
      && typeof parsed.markers === 'object'
      && !Array.isArray(parsed.markers)
    ) {
      for (const [symbol, marker] of Object.entries(parsed.markers)) {
        if (isMarketMarkerColor(marker)) {
          markers[symbol] = marker;
        }
      }
    }

    return {
      favorites: [...new Set(favorites)],
      markers,
      listWidth:
        typeof parsed.listWidth === 'number'
        && Number.isFinite(parsed.listWidth)
          ? clampListWidth(parsed.listWidth)
          : DEFAULT_LIST_WIDTH,
    };
  } catch {
    return fallback;
  }
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 4.5h10v15l-5-3.1-5 3.1z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  );
}

function readOptionalNumber(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.settingsSection}>
      <header>
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </header>
      <div className={styles.settingsSectionBody}>{children}</div>
    </section>
  );
}

function ToggleRow({
  checked,
  disabled = false,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={[
        styles.toggleRow,
        disabled ? styles.toggleRowDisabled : '',
      ].filter(Boolean).join(' ')}
    >
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}

function RangeControl({
  label,
  from,
  to,
  step = 1,
  suffix,
  onFromChange,
  onToChange,
}: {
  label: string;
  from: number | null;
  to: number | null;
  step?: number;
  suffix: string;
  onFromChange: (value: number | null) => void;
  onToChange: (value: number | null) => void;
}) {
  return (
    <div className={styles.rangeControl}>
      <span>{label}</span>
      <div>
        <label>
          <small>От</small>
          <input
            type="number"
            value={from ?? ''}
            step={step}
            placeholder="Любое"
            onChange={(event) => onFromChange(readOptionalNumber(event.currentTarget.value))}
          />
          <em>{suffix}</em>
        </label>
        <label>
          <small>До</small>
          <input
            type="number"
            value={to ?? ''}
            step={step}
            placeholder="Любое"
            onChange={(event) => onToChange(readOptionalNumber(event.currentTarget.value))}
          />
          <em>{suffix}</em>
        </label>
      </div>
    </div>
  );
}

function MarketMetricCell({
  column,
  symbol,
  medianVolume,
}: {
  column: MarketColumnKey;
  symbol: MarketSymbol;
  medianVolume: number;
}) {
  if (column === 'volume') {
    return <span className={styles.metricVolume}>{formatUsd(symbol.volumeQuote)}</span>;
  }

  if (column === 'volumeAnomaly') {
    const ratio = medianVolume > 0
      ? symbol.volumeQuote / medianVolume
      : 0;
    return <span>{ratio.toFixed(2)}×</span>;
  }

  if (column === 'change') {
    return (
      <span className={symbol.priceChangePct >= 0 ? styles.positive : styles.negative}>
        {formatSigned(symbol.priceChangePct, '%')}
      </span>
    );
  }

  if (column === 'volatility') {
    return <span>{symbol.volatilityPct.toFixed(2)}%</span>;
  }

  if (column === 'correlation') {
    return (
      <span className={(symbol.btcCorrelation ?? 0) >= 0 ? styles.positiveMuted : styles.negative}>
        {formatSigned(
          symbol.btcCorrelation === null
            ? null
            : symbol.btcCorrelation * 100,
          '%',
        )}
      </span>
    );
  }

  if (column === 'trades') {
    return <span>{formatCompact(symbol.tradesCount)}</span>;
  }

  return (
    <span className={(symbol.btcRelativeStrength ?? 0) >= 0 ? styles.positive : styles.negative}>
      {formatSigned(symbol.btcRelativeStrength, '%')}
    </span>
  );
}

function MarketPageContent({ symbols }: { symbols: MarketSymbol[] }) {
  const [timeframe, setTimeframe] = useState<MarketTimeframe>('5m');
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [minVolume, setMinVolume] = useState<number | null>(null);
  const [maxVolume, setMaxVolume] = useState<number | null>(null);
  const [minPriceChange, setMinPriceChange] = useState<number | null>(null);
  const [maxPriceChange, setMaxPriceChange] = useState<number | null>(null);
  const [volumeAnomaly, setVolumeAnomaly] = useState(0);
  const [minTrades, setMinTrades] = useState<number | null>(null);
  const [maxTrades, setMaxTrades] = useState<number | null>(null);
  const [tradesAnomaly, setTradesAnomaly] = useState(0);
  const [strength, setStrength] = useState<StrengthFilter>('all');
  const [minCorrelation, setMinCorrelation] = useState<number | null>(null);
  const [maxCorrelation, setMaxCorrelation] = useState<number | null>(null);
  const [minVolatility, setMinVolatility] = useState<number | null>(null);
  const [maxVolatility, setMaxVolatility] = useState<number | null>(null);
  const [liveOnly, setLiveOnly] = useState(false);
  const [blacklist, setBlacklist] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [sortDirection, setSortDirection] =
    useState<SortDirection>('desc');
  const [selectedSymbol, setSelectedSymbol] = useState(
    symbols[0]?.symbol ?? 'BTCUSDT',
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('columns');
  const [visibleColumns, setVisibleColumns] = useState(
    DEFAULT_VISIBLE_COLUMNS,
  );
  const [preferences, setPreferences] = useState<MarketPreferences>(
    readMarketPreferences,
  );
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [colorMenuSymbol, setColorMenuSymbol] = useState<string | null>(null);
  const [resizeOrigin, setResizeOrigin] = useState<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [showHorizontalLevels, setShowHorizontalLevels] = useState(true);
  const [showLevelSummary, setShowLevelSummary] = useState(false);
  const [showSessionExtremes, setShowSessionExtremes] = useState(false);
  const [candleWindow, setCandleWindow] = useState(800);

  const medianVolume = useMemo(() => {
    const values = [...symbols]
      .map((symbol) => symbol.volumeQuote)
      .sort((left, right) => left - right);
    return values[Math.floor(values.length / 2)] ?? 1;
  }, [symbols]);

  const medianTrades = useMemo(() => {
    const values = [...symbols]
      .map((symbol) => symbol.tradesCount)
      .sort((left, right) => left - right);
    return values[Math.floor(values.length / 2)] ?? 1;
  }, [symbols]);

  const realtimeSymbols = useMemo(
    () => symbols.slice(0, 100).map((symbol) => symbol.symbol),
    [symbols],
  );

  const realtime = useRealtimeMarketData({
    symbols: realtimeSymbols,
    enabled: realtimeSymbols.length > 0,
  });

  const realtimeLiveCount = useMemo(
    () =>
      realtimeSymbols.reduce((count, symbol) => {
        const snapshot = realtime.snapshots[symbol];
        return count + (snapshot?.lastTrade || snapshot?.bookTicker ? 1 : 0);
      }, 0),
    [realtime.snapshots, realtimeSymbols],
  );

  const blacklistedSymbols = useMemo(
    () =>
      new Set(
        blacklist
          .toUpperCase()
          .split(/[\s,;]+/u)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    [blacklist],
  );
  const favoriteSet = useMemo(
    () => new Set(preferences.favorites),
    [preferences.favorites],
  );

  const filteredSymbols = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/gu, '');

    const result = symbols.filter((symbol) => {
      const volumeRatio =
        medianVolume > 0
          ? symbol.volumeQuote / medianVolume
          : 0;
      const tradesRatio =
        medianTrades > 0
          ? symbol.tradesCount / medianTrades
          : 0;
      const correlationPct =
        symbol.btcCorrelation === null
          ? null
          : symbol.btcCorrelation * 100;
      const snapshot = realtime.snapshots[symbol.symbol];
      const symbolIsLive = Boolean(snapshot?.lastTrade || snapshot?.bookTicker);

      if (
        normalizedSearch
        && !symbol.symbol.includes(normalizedSearch)
        && !symbol.baseAsset.includes(normalizedSearch)
      ) return false;
      if (
        blacklistedSymbols.has(symbol.symbol)
        || blacklistedSymbols.has(symbol.baseAsset)
      ) return false;
      if (favoritesOnly && !favoriteSet.has(symbol.symbol)) return false;
      if (liveOnly && !symbolIsLive) return false;
      if (direction === 'gainers' && symbol.priceChangePct <= 0) return false;
      if (direction === 'losers' && symbol.priceChangePct >= 0) return false;
      if (minVolume !== null && symbol.volumeQuote < minVolume) return false;
      if (maxVolume !== null && symbol.volumeQuote > maxVolume) return false;
      if (
        minPriceChange !== null
        && symbol.priceChangePct < minPriceChange
      ) return false;
      if (
        maxPriceChange !== null
        && symbol.priceChangePct > maxPriceChange
      ) return false;
      if (volumeRatio < volumeAnomaly) return false;
      if (minTrades !== null && symbol.tradesCount < minTrades) return false;
      if (maxTrades !== null && symbol.tradesCount > maxTrades) return false;
      if (tradesRatio < tradesAnomaly) return false;
      if (
        strength === 'positive'
        && (symbol.btcRelativeStrength ?? 0) <= 0
      ) return false;
      if (
        strength === 'negative'
        && (symbol.btcRelativeStrength ?? 0) >= 0
      ) return false;
      if (
        minCorrelation !== null
        && (correlationPct === null || correlationPct < minCorrelation)
      ) return false;
      if (
        maxCorrelation !== null
        && (correlationPct === null || correlationPct > maxCorrelation)
      ) return false;
      if (
        minVolatility !== null
        && symbol.volatilityPct < minVolatility
      ) return false;
      if (
        maxVolatility !== null
        && symbol.volatilityPct > maxVolatility
      ) return false;
      return true;
    });

    const readSortValue = (symbol: MarketSymbol): number | null => {
      if (sortKey === 'volume') return symbol.volumeQuote;
      if (sortKey === 'volumeAnomaly') {
        return symbol.volumeQuote / Math.max(medianVolume, 1);
      }
      if (sortKey === 'trades') return symbol.tradesCount;
      if (sortKey === 'strength') return symbol.btcRelativeStrength;
      if (sortKey === 'correlation') return symbol.btcCorrelation;
      if (sortKey === 'volatility') return symbol.volatilityPct;
      return symbol.priceChangePct;
    };

    return [...result].sort((left, right) => {
      const leftValue = readSortValue(left);
      const rightValue = readSortValue(right);

      if (leftValue === null && rightValue === null) {
        return left.symbol.localeCompare(right.symbol);
      }
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;

      const comparison = leftValue - rightValue;
      const directedComparison =
        sortDirection === 'asc' ? comparison : -comparison;

      if (directedComparison !== 0) {
        return directedComparison;
      }

      return (
        right.volumeQuote - left.volumeQuote
        || left.symbol.localeCompare(right.symbol)
      );
    });
  }, [
    blacklistedSymbols,
    direction,
    favoriteSet,
    favoritesOnly,
    liveOnly,
    maxCorrelation,
    maxPriceChange,
    maxTrades,
    maxVolatility,
    maxVolume,
    medianTrades,
    medianVolume,
    minCorrelation,
    minPriceChange,
    minTrades,
    minVolatility,
    minVolume,
    realtime.snapshots,
    search,
    sortDirection,
    sortKey,
    strength,
    symbols,
    tradesAnomaly,
    volumeAnomaly,
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MARKET_PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences),
      );
    } catch {
      // The page still works when browser storage is disabled.
    }
  }, [preferences]);

  useEffect(() => {
    if (filteredSymbols.length === 0) return;
    if (!filteredSymbols.some((symbol) => symbol.symbol === selectedSymbol)) {
      setSelectedSymbol(filteredSymbols[0].symbol);
    }
  }, [filteredSymbols, selectedSymbol]);

  useEffect(() => {
    if (!settingsOpen && colorMenuSymbol === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSettingsOpen(false);
        setColorMenuSymbol(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [colorMenuSymbol, settingsOpen]);

  const selected =
    symbols.find((symbol) => symbol.symbol === selectedSymbol)
    ?? symbols[0];
  const realtimeSnapshot = realtime.snapshots[selected.symbol];
  const realtimeMarket = useMemo(
    () =>
      buildMarketRealtimeView(
        realtimeSnapshot,
        realtime.lifecycleState,
        realtime.status?.state ?? null,
      ),
    [
      realtime.lifecycleState,
      realtime.status?.state,
      realtimeSnapshot,
    ],
  );
  const displayedPrice =
    realtimeMarket.isLive
      ? realtimeMarket.priceLabel
      : formatMarketPrice(selected.price);

  useFeedbackPageContext({
    screen: 'Market',
    symbol: selected.symbol,
    timeframe,
  });

  const candlesQuery = useMarketCandles({
    symbol: selected.symbol,
    timeframe,
  });
  const visibleCandles = useMemo(
    () => (candlesQuery.data ?? []).slice(-candleWindow),
    [candleWindow, candlesQuery.data],
  );
  const causalLevelLines = useCausalLevelLines({
    symbol: selected.symbol,
    timeframe,
    candles: visibleCandles,
  });
  const sessionPriceLines = useMemo(() => {
    if (!showSessionExtremes || visibleCandles.length === 0) {
      return [];
    }

    const latestCandle = visibleCandles[visibleCandles.length - 1];
    const latestTimestamp = Date.parse(latestCandle.closeTime);
    const cutoff = latestTimestamp - 24 * 60 * 60 * 1_000;
    const sessionCandles = visibleCandles.filter(
      (candle) => Date.parse(candle.closeTime) >= cutoff,
    );

    if (sessionCandles.length === 0) {
      return [];
    }

    return [
      {
        price: Math.max(...sessionCandles.map((candle) => candle.high)),
        color: '#ff8da0',
        title: '24Ч HIGH',
        lineStyle: 'dashed' as const,
      },
      {
        price: Math.min(...sessionCandles.map((candle) => candle.low)),
        color: '#55dca0',
        title: '24Ч LOW',
        lineStyle: 'dashed' as const,
      },
    ];
  }, [showSessionExtremes, visibleCandles]);

  const hiddenFilterCount = [
    direction !== 'all',
    minVolume !== null,
    maxVolume !== null,
    minPriceChange !== null,
    maxPriceChange !== null,
    volumeAnomaly > 0,
    minTrades !== null,
    maxTrades !== null,
    tradesAnomaly > 0,
    strength !== 'all',
    minCorrelation !== null,
    maxCorrelation !== null,
    minVolatility !== null,
    maxVolatility !== null,
    liveOnly,
    favoritesOnly,
    blacklist.trim().length > 0,
    sortKey !== 'volume',
    sortDirection !== 'desc',
  ].filter(Boolean).length;

  const visibleMarketColumns = useMemo(
    () => MARKET_COLUMNS.filter((column) => visibleColumns[column.key]),
    [visibleColumns],
  );
  const listGridTemplate = useMemo(
    () =>
      [
        '48px',
        'minmax(0, 1.35fr)',
        ...visibleMarketColumns.map((column) => column.width),
      ].join(' '),
    [visibleMarketColumns],
  );
  const listGridStyle = useMemo(
    () => ({ gridTemplateColumns: listGridTemplate }) satisfies CSSProperties,
    [listGridTemplate],
  );
  const marketGridStyle = useMemo(
    () => ({
      '--market-list-width': preferences.listWidth + 'px',
    }) as CSSProperties,
    [preferences.listWidth],
  );

  const resetFilters = () => {
    setSearch('');
    setDirection('all');
    setMinVolume(null);
    setMaxVolume(null);
    setMinPriceChange(null);
    setMaxPriceChange(null);
    setVolumeAnomaly(0);
    setMinTrades(null);
    setMaxTrades(null);
    setTradesAnomaly(0);
    setStrength('all');
    setMinCorrelation(null);
    setMaxCorrelation(null);
    setMinVolatility(null);
    setMaxVolatility(null);
    setLiveOnly(false);
    setFavoritesOnly(false);
    setBlacklist('');
    setSortKey('volume');
    setSortDirection('desc');
  };

  const resetAllSettings = () => {
    resetFilters();
    setVisibleColumns({ ...DEFAULT_VISIBLE_COLUMNS });
    setShowHorizontalLevels(true);
    setShowLevelSummary(false);
    setShowSessionExtremes(false);
    setCandleWindow(800);
  };

  const toggleColumn = (key: MarketColumnKey, checked: boolean) => {
    const visibleCount = Object.values(visibleColumns).filter(Boolean).length;

    if (!checked && visibleCount <= 1) {
      return;
    }

    setVisibleColumns((current) => ({
      ...current,
      [key]: checked,
    }));
  };

  const selectSortColumn = (nextSortKey: SortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((current) =>
        current === 'desc' ? 'asc' : 'desc'
      );
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection('desc');
  };

  const toggleFavorite = (symbol: string) => {
    setPreferences((current) => ({
      ...current,
      favorites: current.favorites.includes(symbol)
        ? current.favorites.filter((value) => value !== symbol)
        : [...current.favorites, symbol],
    }));
  };

  const setSymbolMarker = (
    symbol: string,
    marker: MarketMarkerColor | null,
  ) => {
    setPreferences((current) => {
      const markers = { ...current.markers };

      if (marker === null) {
        delete markers[symbol];
      } else {
        markers[symbol] = marker;
      }

      return { ...current, markers };
    });
  };

  const updateListWidth = (value: number) => {
    setPreferences((current) => ({
      ...current,
      listWidth: clampListWidth(value),
    }));
  };

  const startListResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizeOrigin({
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: preferences.listWidth,
    });
  };

  const moveListResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeOrigin || event.pointerId !== resizeOrigin.pointerId) return;

    updateListWidth(
      resizeOrigin.startWidth + resizeOrigin.startX - event.clientX,
    );
  };

  const stopListResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeOrigin || event.pointerId !== resizeOrigin.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setResizeOrigin(null);
  };

  const resizeListWithKeyboard = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      updateListWidth(preferences.listWidth + 20);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      updateListWidth(preferences.listWidth - 20);
    } else if (event.key === 'Home') {
      event.preventDefault();
      updateListWidth(MIN_LIST_WIDTH);
    } else if (event.key === 'End') {
      event.preventDefault();
      updateListWidth(MAX_LIST_WIDTH);
    }
  };

  const listHasActiveState =
    search.trim().length > 0 || hiddenFilterCount > 0;

  return (
    <section
      className={[
        styles.market,
        resizeOrigin ? styles.marketResizing : '',
      ].filter(Boolean).join(' ')}
    >
      <h1 className={styles.srOnly}>Market</h1>

      <div className={styles.marketGrid} style={marketGridStyle}>
        <section className={styles.chartPanel}>
          <header className={styles.chartToolbar}>
            <div className={styles.symbolTitle}>
              <TokenLogo
                symbol={selected.symbol}
                preferredSource={selected.logoUrl}
                size={32}
                className={styles.symbolIcon}
                eager
              />
              <div>
                <strong>{selected.baseAsset}</strong>
                <small>/{selected.quoteAsset}</small>
              </div>
            </div>

            <div className={styles.timeframeRow} aria-label="Период графика">
              {TIMEFRAMES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={timeframe === value ? styles.timeframeActive : ''}
                  onClick={() => setTimeframe(value)}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className={styles.toolbarQuote}>
              <strong>{displayedPrice}</strong>
              <span
                className={
                  selected.priceChangePct >= 0
                    ? styles.positive
                    : styles.negative
                }
              >
                {formatSigned(selected.priceChangePct, '% · 24ч')}
              </span>
            </div>

            <Link
              className={styles.workspaceButton}
              to={buildMarketWorkspaceUrl(
                ROUTES.workspace,
                selected.symbol,
                timeframe,
              )}
            >
              Workspace ↗
            </Link>
          </header>

          <div className={styles.chartCanvas}>
            {candlesQuery.status === 'loading' && (
              <div className={styles.chartState}>Загружаем свечи…</div>
            )}
            {candlesQuery.status === 'error' && (
              <div className={styles.chartState}>
                <span>Свечи не загрузились.</span>
                <button type="button" onClick={candlesQuery.retry}>
                  Повторить
                </button>
              </div>
            )}
            {candlesQuery.status === 'success' && visibleCandles.length === 0 && (
              <div className={styles.chartEmpty}>
                Для выбранного периода нет свечей.
              </div>
            )}
            {candlesQuery.status === 'success' && visibleCandles.length > 0 && (
              <NexusCandlestickChart
                candles={visibleCandles}
                symbol={selected.symbol}
                fillContainer
                priceLines={sessionPriceLines}
                horizontalSegments={
                  showHorizontalLevels
                    ? causalLevelLines.horizontalSegments
                    : []
                }
                enableDrawingTools
                drawingScope={'market:' + selected.symbol + ':' + timeframe}
                onLoadOlder={candlesQuery.loadOlder}
                isLoadingOlder={candlesQuery.isLoadingOlder}
                hasMore={candlesQuery.hasMore}
              />
            )}
          </div>

          {showLevelSummary && (
            <CausalLevelStateStrip levels={causalLevelLines} />
          )}
        </section>

        <aside className={styles.listPanel}>
          <div
            className={styles.listResizeHandle}
            role="separator"
            aria-orientation="vertical"
            aria-label="Изменить ширину списка монет"
            aria-valuemin={MIN_LIST_WIDTH}
            aria-valuemax={MAX_LIST_WIDTH}
            aria-valuenow={preferences.listWidth}
            tabIndex={0}
            title={
              'Ширина списка: '
              + preferences.listWidth
              + ' px. Перетащите или используйте стрелки.'
            }
            onPointerDown={startListResize}
            onPointerMove={moveListResize}
            onPointerUp={stopListResize}
            onPointerCancel={stopListResize}
            onLostPointerCapture={() => setResizeOrigin(null)}
            onKeyDown={resizeListWithKeyboard}
            onDoubleClick={() => updateListWidth(DEFAULT_LIST_WIDTH)}
          >
            <span aria-hidden="true" />
          </div>

          <header className={styles.listTopbar}>
            <div className={styles.exchangeTitle}>
              <span aria-hidden="true">◆</span>
              <div>
                <strong>BINANCE FUTURES</strong>
                <small>
                  {filteredSymbols.length} монет · LIVE {realtimeLiveCount}/{realtimeSymbols.length}
                </small>
              </div>
            </div>
            <button
              type="button"
              className={styles.settingsButton}
              aria-expanded={settingsOpen}
              aria-controls="market-settings-drawer"
              onClick={() => setSettingsOpen(true)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />
              </svg>
              <span>Настройки</span>
              {hiddenFilterCount > 0 && <b>{hiddenFilterCount}</b>}
            </button>
          </header>

          <div className={styles.listTools}>
            <label className={styles.searchField}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10" cy="10" r="5.5" />
                <path d="m14.5 14.5 5 5" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Поиск монеты"
              />
            </label>
            <button
              type="button"
              className={[
                styles.favoritesFilter,
                favoritesOnly ? styles.favoritesFilterActive : '',
              ].filter(Boolean).join(' ')}
              title="Показывать только избранные монеты"
              aria-label="Показывать только избранные монеты"
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly((current) => !current)}
            >
              <BookmarkIcon filled={favoritesOnly} />
              <span>{preferences.favorites.length}</span>
            </button>
            {listHasActiveState && (
              <button type="button" onClick={resetFilters}>
                Сбросить
              </button>
            )}
          </div>

          {filteredSymbols.length === 0 ? (
            <div className={styles.listEmpty}>
              <strong>Монеты не найдены</strong>
              <span>Измените параметры в скрытых настройках.</span>
              <button type="button" onClick={resetFilters}>Сбросить фильтры</button>
            </div>
          ) : (
            <div className={styles.coinTable} role="table" aria-label="Монеты рынка">
              <div
                className={styles.coinTableHeader}
                role="row"
                style={listGridStyle}
              >
                <span role="columnheader" title="Избранное и цветная метка">
                  ★
                </span>
                <span role="columnheader">Монета</span>
                {visibleMarketColumns.map((column) => (
                  <button
                    key={column.key}
                    type="button"
                    role="columnheader"
                    title={
                      column.label
                      + (sortKey === column.sortKey
                        ? sortDirection === 'desc'
                          ? ': большее сверху'
                          : ': меньшее сверху'
                        : ': сортировать')
                    }
                    aria-sort={
                      sortKey === column.sortKey
                        ? sortDirection === 'desc'
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                    }
                    className={sortKey === column.sortKey ? styles.sortActive : ''}
                    onClick={() => selectSortColumn(column.sortKey)}
                  >
                    {column.shortLabel}
                    {sortKey === column.sortKey && (
                      <i aria-hidden="true">
                        {sortDirection === 'desc' ? '↓' : '↑'}
                      </i>
                    )}
                  </button>
                ))}
              </div>

              <div className={styles.coinList} role="rowgroup">
                {filteredSymbols.map((symbol) => {
                  const rowRealtime = buildMarketRealtimeView(
                    realtime.snapshots[symbol.symbol],
                    realtime.lifecycleState,
                    realtime.status?.state ?? null,
                  );
                  const rowPrice =
                    rowRealtime.isLive
                      ? rowRealtime.priceLabel
                      : formatMarketPrice(symbol.price);
                  const isFavorite = favoriteSet.has(symbol.symbol);
                  const markerKey = preferences.markers[symbol.symbol];
                  const markerDefinition = MARKET_MARKER_COLORS.find(
                    (marker) => marker.key === markerKey,
                  );
                  const rowStyle = {
                    ...listGridStyle,
                    '--market-row-marker':
                      markerDefinition?.color ?? 'transparent',
                    '--market-row-marker-soft':
                      markerDefinition?.soft ?? 'transparent',
                  } as CSSProperties;

                  return (
                    <div
                      key={symbol.symbol}
                      className={[
                        styles.coinRow,
                        markerDefinition ? styles.coinRowMarked : '',
                        selected.symbol === symbol.symbol
                          ? styles.coinRowSelected
                          : '',
                      ].filter(Boolean).join(' ')}
                      role="row"
                      style={rowStyle}
                      tabIndex={0}
                      aria-selected={selected.symbol === symbol.symbol}
                      onClick={() => {
                        setColorMenuSymbol(null);
                        setSelectedSymbol(symbol.symbol);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setColorMenuSymbol(null);
                          setSelectedSymbol(symbol.symbol);
                        }
                      }}
                    >
                      <span
                        className={styles.rowActions}
                        role="cell"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className={[
                            styles.favoriteButton,
                            isFavorite ? styles.favoriteButtonActive : '',
                          ].filter(Boolean).join(' ')}
                          title={
                            isFavorite
                              ? 'Убрать из избранного'
                              : 'Добавить в избранное'
                          }
                          aria-label={
                            isFavorite
                              ? 'Убрать ' + symbol.baseAsset + ' из избранного'
                              : 'Добавить ' + symbol.baseAsset + ' в избранное'
                          }
                          aria-pressed={isFavorite}
                          onClick={() => {
                            setColorMenuSymbol(null);
                            toggleFavorite(symbol.symbol);
                          }}
                        >
                          <BookmarkIcon filled={isFavorite} />
                        </button>
                        <button
                          type="button"
                          className={styles.markerButton}
                          title="Цветная метка"
                          aria-label={'Выбрать цвет для ' + symbol.baseAsset}
                          aria-expanded={colorMenuSymbol === symbol.symbol}
                          onClick={() => setColorMenuSymbol((current) =>
                            current === symbol.symbol ? null : symbol.symbol
                          )}
                        >
                          <i
                            aria-hidden="true"
                            style={{
                              background:
                                markerDefinition?.color ?? '#52645e',
                            }}
                          />
                        </button>

                        {colorMenuSymbol === symbol.symbol && (
                          <span
                            className={styles.markerPalette}
                            role="menu"
                            aria-label={'Цветная метка для ' + symbol.baseAsset}
                          >
                            {MARKET_MARKER_COLORS.map((marker) => (
                              <button
                                key={marker.key}
                                type="button"
                                role="menuitem"
                                className={
                                  marker.key === markerKey
                                    ? styles.markerSwatchActive
                                    : ''
                                }
                                title={marker.label}
                                aria-label={marker.label}
                                style={{ background: marker.color }}
                                onClick={() => {
                                  setSymbolMarker(symbol.symbol, marker.key);
                                  setColorMenuSymbol(null);
                                }}
                              />
                            ))}
                            <button
                              type="button"
                              role="menuitem"
                              className={styles.clearMarker}
                              title="Убрать цвет"
                              aria-label="Убрать цвет"
                              onClick={() => {
                                setSymbolMarker(symbol.symbol, null);
                                setColorMenuSymbol(null);
                              }}
                            >
                              ×
                            </button>
                          </span>
                        )}
                      </span>
                      <span className={styles.coinIdentity} role="cell">
                        <TokenLogo
                          symbol={symbol.symbol}
                          preferredSource={symbol.logoUrl}
                          size={25}
                          className={styles.coinLogo}
                        />
                        <span>
                          <strong>{symbol.baseAsset}</strong>
                          <small>
                            {rowPrice}
                            <i
                              className={
                                rowRealtime.isLive
                                  ? styles.rowLive
                                  : styles.rowSnapshot
                              }
                              aria-label={rowRealtime.isLive ? 'LIVE' : 'SNAPSHOT'}
                            />
                          </small>
                        </span>
                      </span>
                      {visibleMarketColumns.map((column) => (
                        <span className={styles.metricCell} role="cell" key={column.key}>
                          <MarketMetricCell
                            column={column.key}
                            symbol={symbol}
                            medianVolume={medianVolume}
                          />
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>

      {settingsOpen && (
        <>
          <button
            type="button"
            className={styles.settingsBackdrop}
            aria-label="Закрыть настройки Market"
            onClick={() => setSettingsOpen(false)}
          />
          <aside
            id="market-settings-drawer"
            className={styles.settingsDrawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="market-settings-title"
          >
            <header className={styles.settingsHeader}>
              <div>
                <span>MARKET CONTROL</span>
                <h2 id="market-settings-title">Настройки рынка</h2>
              </div>
              <button
                type="button"
                aria-label="Закрыть настройки"
                onClick={() => setSettingsOpen(false)}
              >
                ×
              </button>
            </header>

            <nav className={styles.settingsTabs} aria-label="Разделы настроек">
              {SETTINGS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={settingsTab === tab.key ? styles.settingsTabActive : ''}
                  aria-pressed={settingsTab === tab.key}
                  onClick={() => setSettingsTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className={styles.settingsBody}>
              {settingsTab === 'columns' && (
                <>
                  <SettingsSection
                    title="Колонки списка"
                    description="Выберите данные, которые видны справа от названия монеты."
                  >
                    <div className={styles.columnSettings}>
                      {MARKET_COLUMNS.map((column) => (
                        <ToggleRow
                          key={column.key}
                          checked={visibleColumns[column.key]}
                          label={column.label}
                          onChange={(checked) => toggleColumn(column.key, checked)}
                        />
                      ))}
                    </div>
                  </SettingsSection>
                  <SettingsSection
                    title="Дополнительные источники"
                    description="Эти поля не входят в текущий ответ /api/v1/market/symbols."
                  >
                    <ToggleRow
                      checked={false}
                      disabled
                      label="Открытый интерес"
                      description="Нужен отдельный market-wide поток OI."
                      onChange={() => undefined}
                    />
                    <ToggleRow
                      checked={false}
                      disabled
                      label="Плотности"
                      description="Нужна агрегация стакана для каждой монеты."
                      onChange={() => undefined}
                    />
                    <ToggleRow
                      checked={false}
                      disabled
                      label="Трендовые уровни"
                      description="Нужен backend-контур наклонных уровней."
                      onChange={() => undefined}
                    />
                  </SettingsSection>
                </>
              )}

              {settingsTab === 'filters' && (
                <>
                  <SettingsSection title="Направление и активность">
                    <div className={styles.segmentedControl}>
                      {([
                        ['all', 'Все'],
                        ['gainers', 'LONG'],
                        ['losers', 'SHORT'],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={direction === value ? styles.segmentedActive : ''}
                          aria-pressed={direction === value}
                          onClick={() => setDirection(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <ToggleRow
                      checked={liveOnly}
                      label="Только монеты с realtime"
                      description="Оставить пары, для которых уже пришёл trade или book ticker."
                      onChange={setLiveOnly}
                    />
                    <ToggleRow
                      checked={favoritesOnly}
                      label="Только избранные"
                      description="Показать монеты, отмеченные закладкой в таблице."
                      onChange={setFavoritesOnly}
                    />
                  </SettingsSection>

                  <SettingsSection title="Источник данных">
                    <label className={styles.exchangeOption}>
                      <input type="checkbox" checked readOnly />
                      <span aria-hidden="true">◆</span>
                      <strong>Binance Futures</strong>
                      <small>Единственный подключённый источник</small>
                    </label>
                  </SettingsSection>

                  <SettingsSection title="Диапазоны за 24 часа">
                    <div className={styles.rangesGrid}>
                      <RangeControl
                        label="Объём"
                        from={minVolume}
                        to={maxVolume}
                        suffix="$"
                        onFromChange={setMinVolume}
                        onToChange={setMaxVolume}
                      />
                      <RangeControl
                        label="Изменение цены"
                        from={minPriceChange}
                        to={maxPriceChange}
                        step={0.1}
                        suffix="%"
                        onFromChange={setMinPriceChange}
                        onToChange={setMaxPriceChange}
                      />
                      <RangeControl
                        label="Волатильность"
                        from={minVolatility}
                        to={maxVolatility}
                        step={0.1}
                        suffix="%"
                        onFromChange={setMinVolatility}
                        onToChange={setMaxVolatility}
                      />
                      <RangeControl
                        label="Сделки"
                        from={minTrades}
                        to={maxTrades}
                        suffix="шт."
                        onFromChange={setMinTrades}
                        onToChange={setMaxTrades}
                      />
                      <RangeControl
                        label="Корреляция с BTC"
                        from={minCorrelation}
                        to={maxCorrelation}
                        step={0.1}
                        suffix="%"
                        onFromChange={setMinCorrelation}
                        onToChange={setMaxCorrelation}
                      />
                    </div>
                  </SettingsSection>

                  <SettingsSection title="Аномалии и сила">
                    <div className={styles.selectGrid}>
                      <label>
                        <span>Аномалия объёма</span>
                        <select
                          value={volumeAnomaly}
                          onChange={(event) => setVolumeAnomaly(Number(event.currentTarget.value))}
                        >
                          <option value="0">Любая</option>
                          <option value="1.1">от 1.10×</option>
                          <option value="1.25">от 1.25×</option>
                          <option value="1.5">от 1.50×</option>
                          <option value="2">от 2.00×</option>
                        </select>
                      </label>
                      <label>
                        <span>Аномалия сделок</span>
                        <select
                          value={tradesAnomaly}
                          onChange={(event) => setTradesAnomaly(Number(event.currentTarget.value))}
                        >
                          <option value="0">Любая</option>
                          <option value="1.1">от 1.10×</option>
                          <option value="1.25">от 1.25×</option>
                          <option value="1.5">от 1.50×</option>
                          <option value="2">от 2.00×</option>
                        </select>
                      </label>
                      <label>
                        <span>Сила относительно BTC</span>
                        <select
                          value={strength}
                          onChange={(event) => setStrength(event.currentTarget.value as StrengthFilter)}
                        >
                          <option value="all">Любая</option>
                          <option value="positive">Сильнее BTC</option>
                          <option value="negative">Слабее BTC</option>
                        </select>
                      </label>
                      <label>
                        <span>Сортировка</span>
                        <select
                          value={sortKey}
                          onChange={(event) => {
                            setSortKey(event.currentTarget.value as SortKey);
                            setSortDirection('desc');
                          }}
                        >
                          <option value="volume">Объём 24ч</option>
                          <option value="change">Изменение 24ч</option>
                          <option value="volumeAnomaly">Аномалия объёма</option>
                          <option value="trades">Сделки 24ч</option>
                          <option value="volatility">Волатильность 24ч</option>
                          <option value="correlation">Корреляция с BTC</option>
                          <option value="strength">Сила к BTC</option>
                        </select>
                      </label>
                      <label>
                        <span>Порядок сортировки</span>
                        <select
                          value={sortDirection}
                          onChange={(event) => setSortDirection(
                            event.currentTarget.value as SortDirection
                          )}
                        >
                          <option value="desc">Большее сверху</option>
                          <option value="asc">Меньшее сверху</option>
                        </select>
                      </label>
                    </div>
                  </SettingsSection>

                  <SettingsSection
                    title="Чёрный список"
                    description="Введите тикеры через пробел, запятую или новую строку."
                  >
                    <textarea
                      value={blacklist}
                      onChange={(event) => setBlacklist(event.currentTarget.value)}
                      placeholder="Например: BTCUSDT, ETHUSDT"
                      rows={3}
                    />
                  </SettingsSection>
                </>
              )}

              {settingsTab === 'levels' && (
                <>
                  <SettingsSection title="Настройки графика">
                    <label className={styles.selectField}>
                      <span>Количество свечей на графике</span>
                      <select
                        value={candleWindow}
                        onChange={(event) => setCandleWindow(Number(event.currentTarget.value))}
                      >
                        <option value="200">200</option>
                        <option value="500">500</option>
                        <option value="800">800</option>
                        <option value="1000">1000</option>
                      </select>
                    </label>
                  </SettingsSection>
                  <SettingsSection title="Горизонтальные уровни">
                    <ToggleRow
                      checked={showHorizontalLevels}
                      label="Показывать уровни"
                      description="Активные Causal Level Lines для выбранного символа и TF."
                      onChange={setShowHorizontalLevels}
                    />
                    <ToggleRow
                      checked={showSessionExtremes}
                      label="Показывать High / Low за 24 часа"
                      description="Пунктирные экстремумы рассчитываются по загруженным свечам."
                      onChange={setShowSessionExtremes}
                    />
                    <ToggleRow
                      checked={showLevelSummary}
                      label="Показывать карточки уровней"
                      description="Строка Causal Levels под графиком."
                      onChange={setShowLevelSummary}
                    />
                  </SettingsSection>
                  <SettingsSection
                    title="Таймфреймы"
                    description="Активный таймфрейм меняется в компактной панели над графиком."
                  >
                    <div className={styles.timeframeChips}>
                      {TIMEFRAMES.map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={timeframe === value ? styles.timeframeChipActive : ''}
                          onClick={() => setTimeframe(value)}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </SettingsSection>
                  <p className={styles.backendNote}>
                    Касания, погрешность и время жизни берутся из Level Lines backend.
                    Так график Market не расходится со Scanner и Workspace.
                  </p>
                </>
              )}

              {settingsTab === 'densities' && (
                <>
                  <SettingsSection title="Отображение">
                    <ToggleRow
                      checked={false}
                      disabled
                      label="Показывать плотности на графике"
                      description="Ожидает market-wide данные стакана."
                      onChange={() => undefined}
                    />
                    <ToggleRow
                      checked={false}
                      disabled
                      label="Показывать бюджет с плотностью"
                      description="Ожидает оценку лимитного объёма."
                      onChange={() => undefined}
                    />
                  </SettingsSection>
                  <SettingsSection title="Параметры плотности">
                    <div className={styles.unavailablePanel}>
                      <strong>Источник пока не подключён</strong>
                      <p>
                        Текущий Market API не возвращает снимки стакана для всех монет.
                        Поэтому объём плотности, расстояние, lifetime и decay не имитируются.
                      </p>
                    </div>
                  </SettingsSection>
                </>
              )}

              {settingsTab === 'slopes' && (
                <>
                  <SettingsSection title="Отображение">
                    <ToggleRow
                      checked={false}
                      disabled
                      label="Показывать трендовые уровни"
                      description="Ожидает backend-контур наклонных уровней."
                      onChange={() => undefined}
                    />
                  </SettingsSection>
                  <SettingsSection title="Параметры">
                    <div className={styles.unavailablePanel}>
                      <strong>Наклонные уровни пока недоступны</strong>
                      <p>
                        В текущем контракте нет периода и источника High / Low для
                        построения подтверждённых трендовых линий.
                      </p>
                    </div>
                  </SettingsSection>
                </>
              )}
            </div>

            <footer className={styles.settingsFooter}>
              <button type="button" onClick={resetAllSettings}>
                Сбросить настройки
              </button>
              <button
                type="button"
                className={styles.settingsDone}
                onClick={() => setSettingsOpen(false)}
              >
                Готово
              </button>
            </footer>
          </aside>
        </>
      )}
    </section>
  );
}

export function MarketPage() {
  const marketQuery = useApiQuery('market-symbols', nexusApi.getMarketSymbols);

  useEffect(() => {
    if (marketQuery.status !== 'error') {
      return;
    }

    const retryTimer = window.setTimeout(
      () => {
        marketQuery.retry();
      },
      3_000,
    );

    return () => {
      window.clearTimeout(retryTimer);
    };
  }, [marketQuery.status]);

  if (marketQuery.status === 'loading') {
    return (
      <AsyncDataState
        state="loading"
        title="Загружаем обзор рынка"
        message="Получаем актуальные метрики Binance из backend NEXUS."
      />
    );
  }

  if (marketQuery.status === 'error') {
    return (
      <AsyncDataState
        state="error"
        title="Market не загрузился"
        message={
          marketQuery.error?.message
          ?? 'Не удалось получить список монет из backend NEXUS.'
        }
        onRetry={marketQuery.retry}
      />
    );
  }

  if (!marketQuery.data || marketQuery.data.length === 0) {
    return (
      <AsyncDataState
        state="empty"
        title="В Market пока нет монет"
        message="Backend NEXUS не вернул доступные торговые пары."
      />
    );
  }

  return <MarketPageContent symbols={marketQuery.data} />;
}
