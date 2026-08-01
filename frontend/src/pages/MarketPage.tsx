import { useEffect, useMemo, useState } from 'react';
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
import { AsyncDataState } from '@/shared/ui/AsyncDataState';
import styles from './MarketPage.module.css';

type MarketTimeframe = MarketCandleTimeframe;
type DirectionFilter = 'all' | 'gainers' | 'losers';
type StrengthFilter = 'all' | 'positive' | 'negative';
type CorrelationFilter = 'all' | 'low' | 'medium' | 'high';
type SortKey = 'change' | 'volume' | 'trades' | 'strength' | 'volatility';

const TIMEFRAMES: MarketTimeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

function formatCompact(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSigned(value: number | null, suffix = '') {
  if (value === null) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}${suffix}`;
}

function MarketPageContent({ symbols }: { symbols: MarketSymbol[] }) {
  const [timeframe, setTimeframe] = useState<MarketTimeframe>('5m');
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [minVolume, setMinVolume] = useState(0);
  const [volumeAnomaly, setVolumeAnomaly] = useState(0);
  const [minTrades, setMinTrades] = useState(0);
  const [tradesAnomaly, setTradesAnomaly] = useState(0);
  const [strength, setStrength] = useState<StrengthFilter>('all');
  const [correlation, setCorrelation] = useState<CorrelationFilter>('all');
  const [minVolatility, setMinVolatility] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('change');
  const [selectedSymbol, setSelectedSymbol] = useState(symbols[0]?.symbol ?? 'BTCUSDT');

  const medianVolume = useMemo(() => {
    const values = [...symbols].map((symbol) => symbol.volumeQuote).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)] ?? 1;
  }, [symbols]);

  const medianTrades = useMemo(() => {
    const values = [...symbols].map((symbol) => symbol.tradesCount).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)] ?? 1;
  }, [symbols]);

  const filteredSymbols = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase();
    const result = symbols.filter((symbol) => {
      const volumeRatio = symbol.volumeQuote / medianVolume;
      const tradesRatio = symbol.tradesCount / medianTrades;

      if (normalizedSearch && !symbol.symbol.includes(normalizedSearch) && !symbol.baseAsset.includes(normalizedSearch)) return false;
      if (direction === 'gainers' && symbol.priceChangePct <= 0) return false;
      if (direction === 'losers' && symbol.priceChangePct >= 0) return false;
      if (symbol.volumeQuote < minVolume) return false;
      if (volumeRatio < volumeAnomaly) return false;
      if (symbol.tradesCount < minTrades) return false;
      if (tradesRatio < tradesAnomaly) return false;
      if (strength === 'positive' && (symbol.btcRelativeStrength ?? 0) <= 0) return false;
      if (strength === 'negative' && (symbol.btcRelativeStrength ?? 0) >= 0) return false;
      if (correlation === 'low' && (symbol.btcCorrelation ?? 0) >= 0.35) return false;
      if (correlation === 'medium' && ((symbol.btcCorrelation ?? 0) < 0.35 || (symbol.btcCorrelation ?? 0) >= 0.7)) return false;
      if (correlation === 'high' && (symbol.btcCorrelation ?? 0) < 0.7) return false;
      if (symbol.volatilityPct < minVolatility) return false;
      return true;
    });

    return [...result].sort((a, b) => {
      if (sortKey === 'volume') return b.volumeQuote - a.volumeQuote;
      if (sortKey === 'trades') return b.tradesCount - a.tradesCount;
      if (sortKey === 'strength') return Math.abs(b.btcRelativeStrength ?? 0) - Math.abs(a.btcRelativeStrength ?? 0);
      if (sortKey === 'volatility') return b.volatilityPct - a.volatilityPct;
      return Math.abs(b.priceChangePct) - Math.abs(a.priceChangePct);
    });
  }, [correlation, direction, medianTrades, medianVolume, minTrades, minVolatility, minVolume, search, sortKey, strength, symbols, tradesAnomaly, volumeAnomaly]);

  useEffect(() => {
    if (filteredSymbols.length === 0) return;
    if (!filteredSymbols.some((symbol) => symbol.symbol === selectedSymbol)) {
      setSelectedSymbol(filteredSymbols[0].symbol);
    }
  }, [filteredSymbols, selectedSymbol]);

  const selected = symbols.find((symbol) => symbol.symbol === selectedSymbol) ?? symbols[0];

  const realtimeSymbols = useMemo(
    () => symbols.slice(0, 100).map((symbol) => symbol.symbol),
    [symbols],
  );

  const realtime = useRealtimeMarketData({
    symbols: realtimeSymbols,
    enabled: realtimeSymbols.length > 0,
  });

  const realtimeSnapshot = realtime.snapshots[selected.symbol];

  const realtimeLiveCount = useMemo(
    () =>
      realtimeSymbols.reduce((count, symbol) => {
        const snapshot = realtime.snapshots[symbol];
        return count + (snapshot?.lastTrade || snapshot?.bookTicker ? 1 : 0);
      }, 0),
    [realtime.snapshots, realtimeSymbols],
  );

  const realtimeMarket = useMemo(
    () =>
      buildMarketRealtimeView(
        realtimeSnapshot,
        realtime.lifecycleState,
        realtime.status?.state ?? null,
      ),
    [
      realtimeSnapshot,
      realtime.lifecycleState,
      realtime.status?.state,
    ],
  );

  const realtimeDotClass =
    realtimeMarket.connectionTone === 'live'
      ? styles.liveDotConnected
      : realtimeMarket.connectionTone === 'error'
        ? styles.liveDotError
        : styles.liveDotPending;

  useFeedbackPageContext({
    screen: 'Market',
    symbol: selected.symbol,
    timeframe,
  });
  const candlesQuery = useMarketCandles({
    symbol: selected.symbol,
    timeframe,
  });

  const resetFilters = () => {
    setSearch('');
    setDirection('all');
    setMinVolume(0);
    setVolumeAnomaly(0);
    setMinTrades(0);
    setTradesAnomaly(0);
    setStrength('all');
    setCorrelation('all');
    setMinVolatility(0);
    setSortKey('change');
  };

  const volumeRatio = selected.volumeQuote / medianVolume;
  const tradesRatio = selected.tradesCount / medianTrades;

  return (
    <section className={styles.market}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Ручной обзор рынка · данные backend NEXUS</p>
          <h1>Market</h1>
          <p className={styles.subtitle}>Просматривайте динамику монет, сравнивайте активность и открывайте выбранный инструмент в Workspace.</p>
        </div>
        <div className={styles.headerStatus}>
          <span
            className={`${styles.liveDot} ${realtimeDotClass}`}
            aria-hidden="true"
          />
          {realtimeMarket.connectionLabel} · {realtimeLiveCount}/{realtimeSymbols.length} монет · {selected.symbol}
        </div>
      </header>

      <section className={styles.controlPanel} aria-label="Фильтры Market">
        <div className={styles.controlHeader}>
          <div><span className={styles.panelKicker}>Фильтры и сортировка</span><strong>Монет найдено: {filteredSymbols.length}</strong></div>
          <button className={styles.resetButton} type="button" onClick={resetFilters}>Сбросить</button>
        </div>

        <div className={styles.timeframeRow} aria-label="Период графика">
          {TIMEFRAMES.map((value) => (
            <button key={value} type="button" className={timeframe === value ? styles.timeframeActive : ''} onClick={() => setTimeframe(value)}>{value}</button>
          ))}
        </div>

        <div className={styles.filtersGrid}>
          <label className={styles.searchField}><span>Поиск монеты</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Например, SOLUSDT" /></label>
          <label><span>Рост / падение</span><select value={direction} onChange={(event) => setDirection(event.target.value as DirectionFilter)}><option value="all">Все</option><option value="gainers">Только рост</option><option value="losers">Только падение</option></select></label>
          <label><span>Минимальный объём</span><select value={minVolume} onChange={(event) => setMinVolume(Number(event.target.value))}><option value="0">Любой</option><option value="50000000">50 млн</option><option value="100000000">100 млн</option><option value="150000000">150 млн</option></select></label>
          <label><span>Аномалия объёма</span><select value={volumeAnomaly} onChange={(event) => setVolumeAnomaly(Number(event.target.value))}><option value="0">Любая</option><option value="1.1">от 1.10×</option><option value="1.25">от 1.25×</option><option value="1.5">от 1.50×</option></select></label>
          <label><span>Минимум сделок</span><select value={minTrades} onChange={(event) => setMinTrades(Number(event.target.value))}><option value="0">Любое</option><option value="40000">40 тыс.</option><option value="60000">60 тыс.</option><option value="80000">80 тыс.</option></select></label>
          <label><span>Аномалия сделок</span><select value={tradesAnomaly} onChange={(event) => setTradesAnomaly(Number(event.target.value))}><option value="0">Любая</option><option value="1.1">от 1.10×</option><option value="1.25">от 1.25×</option><option value="1.5">от 1.50×</option></select></label>
          <label><span>Сила относительно BTC</span><select value={strength} onChange={(event) => setStrength(event.target.value as StrengthFilter)}><option value="all">Любая</option><option value="positive">Сильнее BTC</option><option value="negative">Слабее BTC</option></select></label>
          <label><span>Корреляция с BTC</span><select value={correlation} onChange={(event) => setCorrelation(event.target.value as CorrelationFilter)}><option value="all">Любая</option><option value="low">Низкая</option><option value="medium">Средняя</option><option value="high">Высокая</option></select></label>
          <label><span>Волатильность</span><select value={minVolatility} onChange={(event) => setMinVolatility(Number(event.target.value))}><option value="0">Любая</option><option value="2">от 2%</option><option value="3">от 3%</option><option value="4">от 4%</option></select></label>
          <label><span>Сортировка</span><select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}><option value="change">Изменение за период</option><option value="volume">Объём</option><option value="trades">Сделки</option><option value="strength">Сила к BTC</option><option value="volatility">Волатильность</option></select></label>
        </div>
      </section>

      <div className={styles.marketGrid}>
        <section className={styles.chartPanel}>
          <header className={styles.panelHeader}>
            <div className={styles.symbolTitle}><span className={styles.symbolIcon}>{selected.baseAsset.slice(0, 1)}</span><div><span className={styles.panelKicker}>График рынка</span><h2>{selected.baseAsset}<small>/{selected.quoteAsset}</small></h2></div></div>
            <div className={styles.priceBlock}>
              <strong>{realtimeMarket.priceLabel}</strong>

              <span
                className={
                  selected.priceChangePct >= 0
                    ? styles.positive
                    : styles.negative
                }
              >
                {formatSigned(selected.priceChangePct, '%')}
              </span>

              <small
                className={
                  realtimeMarket.isLive
                    ? styles.priceSourceLive
                    : styles.priceSourceUnavailable
                }
              >
                {realtimeMarket.isLive ? 'LIVE' : 'UNAVAILABLE'}
              </small>
            </div>
          </header>

          <section
            className={styles.realtimeStrip}
            aria-label={`Realtime рынок ${selected.symbol}`}
          >
            <article>
              <span>Bid</span>
              <strong className={styles.positive}>
                {realtimeMarket.bidLabel}
              </strong>
            </article>

            <article>
              <span>Ask</span>
              <strong className={styles.negative}>
                {realtimeMarket.askLabel}
              </strong>
            </article>

            <article>
              <span>Спред</span>
              <strong>{realtimeMarket.spreadLabel}</strong>
            </article>

            <footer>
              <span>
                {realtimeMarket.isLive
                  ? `Обновлено ${realtimeMarket.updatedAtLabel}`
                  : `Ожидание realtime для ${selected.symbol}`}
              </span>

              {realtime.error && (
                <button
                  type="button"
                  onClick={realtime.reconnect}
                >
                  Переподключить
                </button>
              )}
            </footer>
          </section>

          <div className={styles.chartCanvas}>
            {candlesQuery.status === 'loading' && <div className={styles.chartState}>Загружаем свечи…</div>}
            {candlesQuery.status === 'error' && <div className={styles.chartState}><span>Свечи не загрузились.</span><button type="button" onClick={candlesQuery.retry}>Повторить</button></div>}
            {candlesQuery.status === 'success' && candlesQuery.data?.length === 0 && (
              <div className={styles.chartEmpty}>
                Для выбранного периода нет свечей.
              </div>
            )}
            {candlesQuery.status === 'success' && candlesQuery.data && candlesQuery.data.length > 0 && (
              <NexusCandlestickChart
                candles={candlesQuery.data}
                symbol={selected.symbol}
                enableDrawingTools
                drawingScope={`market:${selected.symbol}:${timeframe}`}
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
            )}
          </div>

          <div className={styles.metricsGrid}>
            <article><span>Объём</span><strong>{formatCompact(selected.volumeQuote)}</strong><small>{volumeRatio.toFixed(2)}× медианы</small></article>
            <article><span>Сделки</span><strong>{formatCompact(selected.tradesCount)}</strong><small>{tradesRatio.toFixed(2)}× медианы</small></article>
            <article><span>Скорость</span><strong>{formatCompact(selected.tradeRate)}/мин</strong><small>по последнему периоду</small></article>
            <article><span>Сила к BTC</span><strong className={(selected.btcRelativeStrength ?? 0) >= 0 ? styles.positive : styles.negative}>{formatSigned(selected.btcRelativeStrength)}</strong><small>относительная динамика</small></article>
            <article><span>Корреляция</span><strong>{selected.btcCorrelation?.toFixed(2) ?? '—'}</strong><small>с движением BTC</small></article>
            <article><span>Волатильность</span><strong>{selected.volatilityPct.toFixed(2)}%</strong><small>амплитуда периода</small></article>
          </div>

          <div className={styles.workspaceBar}><div><span>Выбран {selected.symbol}</span><small>Откройте полный график, принты и ликвидность в рабочем пространстве.</small></div><Link
  className={styles.workspaceButton}
  to={buildMarketWorkspaceUrl(
    ROUTES.workspace,
    selected.symbol,
    timeframe,
  )}
>
  Открыть в Workspace
</Link></div>
        </section>

        <aside className={styles.listPanel}>
          <header className={styles.listHeader}><div><span className={styles.panelKicker}>Монеты</span><h2>{filteredSymbols.length} инструментов</h2></div><span>{timeframe} · LIVE {realtimeLiveCount}/{realtimeSymbols.length}</span></header>
          <p className={styles.listHint}>Нажмите строку, чтобы сменить инструмент на графике.</p>

          {filteredSymbols.length === 0 ? (
            <div className={styles.listEmpty}>Нет монет под выбранные фильтры.</div>
          ) : (
            <div className={styles.coinList}>
              {filteredSymbols.map((symbol, index) => {
                const isPositive = symbol.priceChangePct >= 0;
                const rowRealtime = buildMarketRealtimeView(
                  realtime.snapshots[symbol.symbol],
                  realtime.lifecycleState,
                  realtime.status?.state ?? null,
                );

                return (
                  <button key={symbol.symbol} className={`${styles.coinRow} ${selected.symbol === symbol.symbol ? styles.coinRowSelected : ''}`} type="button" onClick={() => setSelectedSymbol(symbol.symbol)}>
                    <span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span>
                    <span className={styles.coinIdentity}><i>{symbol.baseAsset.slice(0, 1)}</i><span><strong>{symbol.baseAsset}</strong><small>/{symbol.quoteAsset}</small></span></span>
                    <span className={styles.coinPrice}>
                      <strong>{rowRealtime.priceLabel}</strong>
                      <small
                        className={
                          rowRealtime.isLive
                            ? styles.priceSourceLive
                            : styles.priceSourceUnavailable
                        }
                      >
                        {rowRealtime.isLive ? 'LIVE' : 'UNAVAILABLE'} · {formatCompact(symbol.volumeQuote)}
                      </small>
                    </span>
                    <span className={styles.sparkUnavailable} aria-label="Мини-график недоступен">—</span>
                    <span className={isPositive ? styles.positive : styles.negative}>{formatSigned(symbol.priceChangePct, '%')}</span>
                    <span className={styles.rowMeta}><small>Сила {formatSigned(symbol.btcRelativeStrength)}</small><small>ρ {symbol.btcCorrelation?.toFixed(2) ?? '—'}</small><small>σ {symbol.volatilityPct.toFixed(2)}%</small></span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

export function MarketPage() {
  const marketQuery = useApiQuery('market-symbols', nexusApi.getMarketSymbols);

  if (marketQuery.status === 'loading') return <AsyncDataState state="loading" title="Загружаем обзор рынка" message="Получаем актуальные метрики Binance из backend NEXUS." />;
  if (marketQuery.status === 'error') return <AsyncDataState state="error" title="Market не загрузился" message={marketQuery.error?.message ?? 'Не удалось получить список монет из backend NEXUS.'} onRetry={marketQuery.retry} />;
  if (!marketQuery.data || marketQuery.data.length === 0) return <AsyncDataState state="empty" title="В Market пока нет монет" message="Backend NEXUS не вернул доступные торговые пары." />;

  return <MarketPageContent symbols={marketQuery.data} />;
}
