import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { nexusApi, useApiQuery, type Candle, type MarketSymbol } from '@/shared/api';
import { AsyncDataState } from '@/shared/ui/AsyncDataState';
import styles from './MarketPage.module.css';

type MarketTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '24h';
type DirectionFilter = 'all' | 'gainers' | 'losers';
type StrengthFilter = 'all' | 'positive' | 'negative';
type CorrelationFilter = 'all' | 'low' | 'medium' | 'high';
type SortKey = 'change' | 'volume' | 'trades' | 'strength' | 'volatility';

const TIMEFRAMES: MarketTimeframe[] = ['1m', '5m', '15m', '1h', '4h', '24h'];

function formatPrice(value: number) {
  const fractionDigits = value >= 1000 ? 2 : value >= 1 ? 4 : 6;
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

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

function getTimeLabel(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function getSparklinePath(symbol: MarketSymbol, index: number) {
  const points = Array.from({ length: 20 }, (_, pointIndex) => {
    const x = (pointIndex / 19) * 92;
    const trend = symbol.priceChangePct * 1.7 * (pointIndex / 19);
    const wave = Math.sin(pointIndex * 0.82 + index * 0.64) * 4.2;
    return { x, value: trend + wave };
  });

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.001);

  return points
    .map((point, pointIndex) => {
      const y = 25 - ((point.value - min) / range) * 21;
      return `${pointIndex === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function MarketChart({ candles, symbol }: { candles: Candle[]; symbol: MarketSymbol }) {
  if (candles.length === 0) {
    return <div className={styles.chartEmpty}>Для выбранного периода нет свечей.</div>;
  }

  const chartWidth = 920;
  const plotRight = 860;
  const top = 16;
  const bottom = 332;
  const volumeBottom = 440;
  const volumeHeight = 72;
  const prices = candles.flatMap((candle) => [candle.high, candle.low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = Math.max(maxPrice - minPrice, Math.abs(maxPrice) * 0.0001, 1e-8);
  const maxVolume = Math.max(...candles.map((candle) => candle.volume), 1);
  const step = (plotRight - 18) / candles.length;
  const candleWidth = Math.max(3, Math.min(8, step * 0.52));
  const yForPrice = (price: number) => top + ((maxPrice - price) / priceRange) * (bottom - top);
  const last = candles[candles.length - 1];
  const lastY = yForPrice(last.close);
  const axisPrices = Array.from({ length: 5 }, (_, index) => maxPrice - (priceRange * index) / 4);
  const timeIndexes = [0, Math.floor(candles.length / 3), Math.floor((candles.length * 2) / 3), candles.length - 1];

  return (
    <svg className={styles.chartSvg} viewBox={`0 0 ${chartWidth} 462`} preserveAspectRatio="none" role="img" aria-label={`Свечной график ${symbol.symbol}`}>
      <g className={styles.chartGrid}>
        {Array.from({ length: 5 }, (_, index) => {
          const y = top + ((bottom - top) * index) / 4;
          return <line key={`h-${y}`} x1="18" y1={y} x2={plotRight} y2={y} />;
        })}
        {Array.from({ length: 5 }, (_, index) => {
          const x = 18 + ((plotRight - 18) * index) / 4;
          return <line key={`v-${x}`} x1={x} y1={top} x2={x} y2={volumeBottom} />;
        })}
      </g>

      {candles.map((candle, index) => {
        const x = 18 + step * index + step / 2;
        const openY = yForPrice(candle.open);
        const closeY = yForPrice(candle.close);
        const highY = yForPrice(candle.high);
        const lowY = yForPrice(candle.low);
        const isPositive = candle.close >= candle.open;
        const bodyY = Math.min(openY, closeY);
        const bodyHeight = Math.max(2, Math.abs(closeY - openY));
        const volumeBarHeight = (candle.volume / maxVolume) * volumeHeight;

        return (
          <g key={candle.openTime} className={isPositive ? styles.candlePositive : styles.candleNegative}>
            <line className={styles.candleWick} x1={x} x2={x} y1={highY} y2={lowY} />
            <rect className={styles.candleBody} x={x - candleWidth / 2} y={bodyY} width={candleWidth} height={bodyHeight} rx="1" />
            <rect className={styles.volumeBar} x={x - candleWidth / 2} y={volumeBottom - volumeBarHeight} width={candleWidth} height={volumeBarHeight} rx="1" />
          </g>
        );
      })}

      <g className={styles.currentPriceMarker}>
        <line x1="18" y1={lastY} x2={plotRight} y2={lastY} />
        <rect x="864" y={lastY - 10} width="56" height="20" rx="4" />
        <text x="892" y={lastY + 4} textAnchor="middle">{formatPrice(last.close)}</text>
      </g>

      <g className={styles.chartAxisLabels}>
        {axisPrices.map((price, index) => {
          const y = top + ((bottom - top) * index) / 4;
          return <text key={price} x="912" y={y + 4} textAnchor="end">{formatPrice(price)}</text>;
        })}
        {timeIndexes.map((candleIndex, index) => {
          const candle = candles[candleIndex];
          const x = 40 + ((800 - 40) * index) / 3;
          return <text key={`${candle.openTime}-${index}`} x={x} y="458">{getTimeLabel(candle.openTime).slice(0, 5)}</text>;
        })}
      </g>
    </svg>
  );
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
  const candlesQuery = useApiQuery(
    `market-candles:${selected.symbol}:${timeframe}`,
    () => nexusApi.getMarketCandles(selected.symbol, timeframe),
  );

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
          <p className={styles.eyebrow}>Ручной обзор рынка · тестовые данные</p>
          <h1>Market</h1>
          <p className={styles.subtitle}>Просматривайте динамику монет, сравнивайте активность и открывайте выбранный инструмент в Workspace.</p>
        </div>
        <div className={styles.headerStatus}><span className={styles.liveDot} aria-hidden="true" />Обновлено {getTimeLabel(selected.updatedAt)}</div>
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
            <div className={styles.priceBlock}><strong>{formatPrice(selected.price)}</strong><span className={selected.priceChangePct >= 0 ? styles.positive : styles.negative}>{formatSigned(selected.priceChangePct, '%')}</span></div>
          </header>

          <div className={styles.chartCanvas}>
            {candlesQuery.status === 'loading' && <div className={styles.chartState}>Загружаем свечи…</div>}
            {candlesQuery.status === 'error' && <div className={styles.chartState}><span>Свечи не загрузились.</span><button type="button" onClick={candlesQuery.retry}>Повторить</button></div>}
            {candlesQuery.status === 'success' && candlesQuery.data && <MarketChart candles={candlesQuery.data} symbol={selected} />}
          </div>

          <div className={styles.metricsGrid}>
            <article><span>Объём</span><strong>{formatCompact(selected.volumeQuote)}</strong><small>{volumeRatio.toFixed(2)}× медианы</small></article>
            <article><span>Сделки</span><strong>{formatCompact(selected.tradesCount)}</strong><small>{tradesRatio.toFixed(2)}× медианы</small></article>
            <article><span>Скорость</span><strong>{formatCompact(selected.tradeRate)}/мин</strong><small>по последнему периоду</small></article>
            <article><span>Сила к BTC</span><strong className={(selected.btcRelativeStrength ?? 0) >= 0 ? styles.positive : styles.negative}>{formatSigned(selected.btcRelativeStrength)}</strong><small>относительная динамика</small></article>
            <article><span>Корреляция</span><strong>{selected.btcCorrelation?.toFixed(2) ?? '—'}</strong><small>с движением BTC</small></article>
            <article><span>Волатильность</span><strong>{selected.volatilityPct.toFixed(2)}%</strong><small>амплитуда периода</small></article>
          </div>

          <div className={styles.workspaceBar}><div><span>Выбран {selected.symbol}</span><small>Откройте полный график, принты и ликвидность в рабочем пространстве.</small></div><Link className={styles.workspaceButton} to={`${ROUTES.workspace}?symbol=${selected.symbol}`}>Открыть в Workspace</Link></div>
        </section>

        <aside className={styles.listPanel}>
          <header className={styles.listHeader}><div><span className={styles.panelKicker}>Монеты</span><h2>{filteredSymbols.length} инструментов</h2></div><span>{timeframe}</span></header>
          <p className={styles.listHint}>Нажмите строку, чтобы сменить инструмент на графике.</p>

          {filteredSymbols.length === 0 ? (
            <div className={styles.listEmpty}>Нет монет под выбранные фильтры.</div>
          ) : (
            <div className={styles.coinList}>
              {filteredSymbols.map((symbol, index) => {
                const isPositive = symbol.priceChangePct >= 0;
                return (
                  <button key={symbol.symbol} className={`${styles.coinRow} ${selected.symbol === symbol.symbol ? styles.coinRowSelected : ''}`} type="button" onClick={() => setSelectedSymbol(symbol.symbol)}>
                    <span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span>
                    <span className={styles.coinIdentity}><i>{symbol.baseAsset.slice(0, 1)}</i><span><strong>{symbol.baseAsset}</strong><small>/{symbol.quoteAsset}</small></span></span>
                    <span className={styles.coinPrice}><strong>{formatPrice(symbol.price)}</strong><small>{formatCompact(symbol.volumeQuote)}</small></span>
                    <svg className={isPositive ? styles.sparkPositive : styles.sparkNegative} viewBox="0 0 92 28" aria-hidden="true"><path d={getSparklinePath(symbol, index)} fill="none" /></svg>
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

  if (marketQuery.status === 'loading') return <AsyncDataState state="loading" title="Загружаем обзор рынка" />;
  if (marketQuery.status === 'error') return <AsyncDataState state="error" title="Market не загрузился" message={marketQuery.error?.message} onRetry={marketQuery.retry} />;
  if (!marketQuery.data || marketQuery.data.length === 0) return <AsyncDataState state="empty" title="В Market пока нет монет" />;

  return <MarketPageContent symbols={marketQuery.data} />;
}
