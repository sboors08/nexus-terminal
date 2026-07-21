import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { useFeedbackPageContext } from '@/shared/feedback/FeedbackProvider';
import { buildWorkspaceUrl } from '@/shared/routing/setupContext';
import {
  buildScannerRealtimeMarketView,
  formatScannerPrice,
  formatScannerQuantity,
  formatScannerTradeTime,
  getScannerRealtimeConnectionLabel,
  useRealtimeMarketData,
} from '@/shared/realtime';
import {
  nexusApi,
  useApiQuery,
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
type SortKey = 'distance' | 'btcStrength' | 'volume' | 'trades' | 'formation';

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

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'distance', label: 'Ближе к уровню' },
  { value: 'btcStrength', label: 'Сильнее относительно BTC' },
  { value: 'volume', label: 'Аномалия объёма' },
  { value: 'trades', label: 'Аномалия сделок' },
  { value: 'formation', label: 'Дольше формируется' },
];

function InfoHint({ label }: { label: string }) {
  return (
    <button className={styles.infoHint} type="button" aria-label={label} data-tooltip={label}>
      ?
    </button>
  );
}

function ScannerChart({ setup }: { setup: ScannerSetup }) {
  const directionClass = setup.direction === 'long' ? styles.chartLong : styles.chartShort;

  return (
    <div className={`${styles.chartCanvas} ${directionClass}`}>
      <svg viewBox="0 0 640 210" preserveAspectRatio="none" role="img" aria-label={`График ${setup.symbol}`}>
        <defs>
          <linearGradient id={`scanner-area-${setup.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className={styles.chartGrid}>
          <line x1="0" y1="42" x2="640" y2="42" />
          <line x1="0" y1="84" x2="640" y2="84" />
          <line x1="0" y1="126" x2="640" y2="126" />
          <line x1="0" y1="168" x2="640" y2="168" />
          <line x1="128" y1="0" x2="128" y2="210" />
          <line x1="256" y1="0" x2="256" y2="210" />
          <line x1="384" y1="0" x2="384" y2="210" />
          <line x1="512" y1="0" x2="512" y2="210" />
        </g>
        <rect className={styles.levelZone} x="0" y={setup.levelY - 7} width="640" height="14" rx="2" />
        <line className={styles.levelLine} x1="0" y1={setup.levelY} x2="640" y2={setup.levelY} />
        <path d={setup.areaPath} fill={`url(#scanner-area-${setup.id})`} />
        <path className={styles.chartLine} d={setup.chartPath} fill="none" vectorEffect="non-scaling-stroke" />
        {setup.touchPoints.map((point, index) => (
          <g key={`${point.x}-${point.y}`}>
            <circle className={styles.touchHalo} cx={point.x} cy={point.y} r="8" />
            <circle className={styles.touchPoint} cx={point.x} cy={point.y} r="3.5" />
            <text className={styles.touchLabel} x={point.x + 8} y={point.y - 10}>
              {index + 1}
            </text>
          </g>
        ))}
      </svg>
      <div className={styles.chartAxis} aria-hidden="true">
        <span>14:00</span>
        <span>15:00</span>
        <span>16:00</span>
        <span>17:00</span>
      </div>
    </div>
  );
}

function numericSort(setups: ScannerSetup[], sortKey: SortKey) {
  return [...setups].sort((a, b) => {
    if (sortKey === 'distance') return a.distancePercent - b.distancePercent;
    if (sortKey === 'btcStrength') return Math.abs(b.btcStrength) - Math.abs(a.btcStrength);
    if (sortKey === 'volume') return b.volumeAnomaly - a.volumeAnomaly;
    if (sortKey === 'trades') return b.tradesAnomaly - a.tradesAnomaly;
    return b.formationMinutes - a.formationMinutes;
  });
}

function ScannerPageContent({ setups }: { setups: ScannerSetup[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSetupId = searchParams.get('setupId');
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
  const [sortKey, setSortKey] = useState<SortKey>('distance');

  const filteredSetups = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase();
    const maxDistance = distance === 'all' ? null : Number(distance);
    const minTouches = touches === 'all' ? null : Number(touches);

    const result = setups.filter((setup) => {
      if (normalizedSearch && !setup.symbol.includes(normalizedSearch)) return false;
      if (direction !== 'all' && setup.direction !== direction) return false;
      if (kind !== 'all' && setup.kind !== kind) return false;
      if (stage !== 'all' && setup.stage !== stage) return false;
      if (timeframe !== 'all' && setup.timeframe !== timeframe) return false;
      if (maxDistance !== null && setup.distancePercent > maxDistance) return false;
      if (minTouches !== null && setup.touches < minTouches) return false;
      if (btcStrength === 'positive' && setup.btcStrength <= 0) return false;
      if (btcStrength === 'negative' && setup.btcStrength >= 0) return false;
      return true;
    });

    return numericSort(result, sortKey);
  }, [btcStrength, direction, distance, kind, search, sortKey, stage, timeframe, touches]);

  const selectedSetup = useMemo(() => {
    return filteredSetups.find((setup) => setup.id === requestedSetupId)
      ?? setups.find((setup) => setup.id === requestedSetupId)
      ?? filteredSetups[0]
      ?? setups[0];
  }, [filteredSetups, requestedSetupId, setups]);

  const realtime = useRealtimeMarketData({ symbol: selectedSetup.symbol });
  const realtimeSnapshot = realtime.snapshots[selectedSetup.symbol];
  const realtimeMarket = useMemo(
    () => buildScannerRealtimeMarketView(realtimeSnapshot, selectedSetup.price),
    [realtimeSnapshot, selectedSetup.price],
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

  useFeedbackPageContext({
    screen: 'Scanner',
    symbol: selectedSetup.symbol,
    timeframe: selectedSetup.timeframe,
    setupId: selectedSetup.id,
  });

  const resetFilters = () => {
    setSearch('');
    setDirection('all');
    setKind('all');
    setStage('all');
    setTimeframe('all');
    setDistance('all');
    setTouches('all');
    setBtcStrength('all');
    setSortKey('distance');
  };

  return (
    <section className={styles.scanner}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Поиск сетапов · тестовые сетапы · цены realtime</p>
          <h1 className={styles.title}>Scanner</h1>
          <p className={styles.subtitle}>Полный список найденных ситуаций с фильтрацией, сортировкой и предпросмотром.</p>
        </div>
        <div className={styles.headerStatus}>
          <span className={`${styles.liveDot} ${realtimeDotClass}`} aria-hidden="true" />
          {realtimeLabel} · {selectedSetup.symbol}
        </div>
      </header>

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

          <label className={styles.compactSelect}>
            <span>Сортировка</span>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <div className={styles.filterSummary}>
            <strong>{filteredSetups.length}</strong>
            <span>из {setups.length} сетапов</span>
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
            <span className={styles.testBadge}>TEST SETUPS · LIVE MARKET</span>
          </div>

          <div className={styles.tableViewport}>
            <div className={styles.tableHeader} aria-hidden="true">
              <span>Инструмент</span>
              <span>Напр.</span>
              <span>Тип сетапа</span>
              <span>Стадия</span>
              <span>TF</span>
              <span>Уровень</span>
              <span>Касания</span>
              <span>Формирование</span>
              <span>До уровня</span>
              <span>Откаты</span>
              <span className={styles.headerWithHint}>Объём <InfoHint label="Отношение текущего объёма к среднему значению для этого инструмента и таймфрейма." /></span>
              <span className={styles.headerWithHint}>Сделки <InfoHint label="Отношение текущего количества сделок к среднему значению." /></span>
              <span className={styles.headerWithHint}>Сила к BTC <InfoHint label="Положительное значение означает, что инструмент сильнее BTC; отрицательное — слабее." /></span>
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
                    <strong className={styles.monoCell}>{setup.volumeAnomaly.toFixed(2)}×</strong>
                    <strong className={styles.monoCell}>{setup.tradesAnomaly.toFixed(2)}×</strong>
                    <strong className={setup.btcStrength >= 0 ? styles.positiveValue : styles.negativeValue}>{setup.btcStrengthLabel}</strong>
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
                <h2>{selectedSetup.symbol}</h2>
                <DirectionBadge direction={selectedSetup.direction} />
                <span className={styles.timeframeBadge}>{selectedSetup.timeframe}</span>
              </div>
              <p>{selectedSetup.kind}</p>
            </div>
            <div className={styles.priceBlock}>
              <strong>{realtimeMarket.priceLabel}</strong>
              <div className={styles.priceMeta}>
                <span className={selectedSetup.direction === 'long' ? styles.positiveValue : styles.negativeValue}>
                  {selectedSetup.priceChange}
                </span>
                <span className={`${styles.priceSourceBadge} ${realtimeMarket.isLive ? styles.priceSourceLive : styles.priceSourceFallback}`}>
                  {realtimeMarket.isLive ? 'LIVE' : 'TEST'}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.stageLine}>
            <SetupStageBadge stage={selectedSetup.stage} resultLabel={selectedSetup.kind.includes('Отскок') ? 'Отскок' : 'Пробой'} />
            <span>Зона {selectedSetup.level}</span>
          </div>

          <section className={styles.realtimeStrip} aria-label={`Realtime рынок ${selectedSetup.symbol}`}>
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
                  : `Для ${selectedSetup.symbol} нет активной realtime-подписки`}
              </span>
              {realtime.error && (
                <button type="button" onClick={realtime.reconnect}>Переподключить</button>
              )}
            </footer>
          </section>

          <ScannerChart setup={selectedSetup} />

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
              <strong>{selectedSetup.volumeAnomaly.toFixed(2)}×</strong>
            </div>
            <div>
              <span>Сделки</span>
              <strong>{selectedSetup.tradesAnomaly.toFixed(2)}×</strong>
            </div>
            <div>
              <span>Сила к BTC</span>
              <strong className={selectedSetup.btcStrength >= 0 ? styles.positiveValue : styles.negativeValue}>{selectedSetup.btcStrengthLabel}</strong>
            </div>
          </div>

          <section className={styles.tradesPanel} aria-label={`Последние сделки ${selectedSetup.symbol}`}>
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
                Запусти backend и выбери BTCUSDT, ETHUSDT или SOLUSDT, чтобы увидеть поток сделок.
              </p>
            )}
          </section>

          <section className={styles.reasonBlock}>
            <p className={styles.panelEyebrow}>Почему в Scanner</p>
            <ul>
              {selectedSetup.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </section>

          <div className={styles.previewActions}>
            <Link className={styles.primaryLink} to={buildWorkspaceUrl(ROUTES.workspace, {
                setupId: selectedSetup.id,
                symbol: selectedSetup.symbol,
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
  const query = useApiQuery('scanner-setups', () => nexusApi.getScannerSetups());

  if (query.status === 'loading') return <AsyncDataState state="loading" />;
  if (query.status === 'error') {
    return <AsyncDataState state="error" message={query.error?.message} onRetry={query.retry} />;
  }
  if (!query.data || query.data.length === 0) return <AsyncDataState state="empty" />;

  return <ScannerPageContent setups={query.data} />;
}
