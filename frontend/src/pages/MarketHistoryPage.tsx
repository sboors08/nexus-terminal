import { useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import {
  HISTORY_RESULT_LABELS,
  MARKET_HISTORY_ITEMS,
  type HistoryResult,
  type HistorySetupType,
  type MarketHistoryItem,
} from '@/features/market-history/marketHistoryData';
import { DirectionBadge, type TradeDirection } from '@/shared/ui/DirectionBadge';
import { SetupStageBadge } from '@/shared/ui/SetupStageBadge';
import styles from './MarketHistoryPage.module.css';

type ResultFilter = 'all' | HistoryResult;
type DirectionFilter = 'all' | TradeDirection;
type SetupTypeFilter = 'all' | HistorySetupType;
type TimeframeFilter = 'all' | MarketHistoryItem['timeframe'];
type SortKey = 'latest' | 'maxMove' | 'fastest';

const UTC_DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

function formatUtcDate(value: string | null) {
  if (!value) return '—';
  return `${UTC_DATE_FORMATTER.format(new Date(value)).replace(',', '')} UTC`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds} сек`;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) return remainingMinutes > 0 ? `${hours}ч ${remainingMinutes}м` : `${hours}ч`;
  return `${minutes}м`;
}

function formatPrice(value: number) {
  if (value >= 1000) return value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  if (value >= 10) return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function formatSignedPercent(value: number | null) {
  if (value === null) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getResultToneClass(result: HistoryResult) {
  return styles[`result_${result}`];
}

function buildPolyline(points: number[]) {
  const width = 640;
  const height = 176;
  const step = width / Math.max(points.length - 1, 1);
  return points
    .map((point, index) => `${(index * step).toFixed(1)},${(height - (point / 100) * height).toFixed(1)}`)
    .join(' ');
}

export function MarketHistoryPage() {
  const [selectedId, setSelectedId] = useState(MARKET_HISTORY_ITEMS[0].id);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<ResultFilter>('all');
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [setupType, setSetupType] = useState<SetupTypeFilter>('all');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('latest');

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase();
    const items = MARKET_HISTORY_ITEMS.filter((item) => {
      if (normalizedSearch && !`${item.symbol} ${item.setupLabel} ${item.resultLabel}`.toUpperCase().includes(normalizedSearch)) return false;
      if (result !== 'all' && item.result !== result) return false;
      if (direction !== 'all' && item.direction !== direction) return false;
      if (setupType !== 'all' && item.setupType !== setupType) return false;
      if (timeframe !== 'all' && item.timeframe !== timeframe) return false;
      return true;
    });

    return [...items].sort((a, b) => {
      if (sortKey === 'maxMove') return (b.maxMovePct ?? -Infinity) - (a.maxMovePct ?? -Infinity);
      if (sortKey === 'fastest') return (a.timeToTargetSec ?? Infinity) - (b.timeToTargetSec ?? Infinity);
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });
  }, [direction, result, search, setupType, sortKey, timeframe]);

  const selectedItem = useMemo(() => (
    filteredItems.find((item) => item.id === selectedId)
      ?? MARKET_HISTORY_ITEMS.find((item) => item.id === selectedId)
      ?? filteredItems[0]
      ?? MARKET_HISTORY_ITEMS[0]
  ), [filteredItems, selectedId]);

  const successfulCount = MARKET_HISTORY_ITEMS.filter((item) => item.result === 'successful').length;
  const completedCount = MARKET_HISTORY_ITEMS.filter((item) => ['successful', 'failed'].includes(item.result)).length;
  const averageMove = MARKET_HISTORY_ITEMS
    .filter((item) => item.result === 'successful' && item.maxMovePct !== null)
    .reduce((sum, item) => sum + (item.maxMovePct ?? 0), 0) / successfulCount;
  const replayCount = MARKET_HISTORY_ITEMS.filter((item) => item.replayAvailable).length;
  const successRate = completedCount > 0 ? Math.round((successfulCount / completedCount) * 100) : 0;

  const resetFilters = () => {
    setSearch('');
    setResult('all');
    setDirection('all');
    setSetupType('all');
    setTimeframe('all');
    setSortKey('latest');
  };

  return (
    <section className={styles.historyPage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Архив сетапов · тестовые данные</p>
          <h1 className={styles.title}>Market History</h1>
          <p className={styles.subtitle}>История обнаружения, реализации и отмены торговых сетапов NEXUS.</p>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.testBadge}>TEST DATA</span>
          <span>Обновлено 15.07.26 · 17:32 UTC</span>
        </div>
      </header>

      <section className={styles.summaryGrid} aria-label="Сводка истории сетапов">
        <article className={styles.summaryCard}>
          <p>Всего сетапов</p>
          <strong>{MARKET_HISTORY_ITEMS.length}</strong>
          <span>в текущей тестовой выборке</span>
        </article>
        <article className={styles.summaryCard}>
          <p>Успешные реализации</p>
          <strong className={styles.positiveValue}>{successRate}%</strong>
          <span>{successfulCount} из {completedCount} завершённых</span>
        </article>
        <article className={styles.summaryCard}>
          <p>Среднее движение</p>
          <strong className={styles.positiveValue}>+{averageMove.toFixed(2)}%</strong>
          <span>по успешным сетапам</span>
        </article>
        <article className={styles.summaryCard}>
          <p>Доступен Replay</p>
          <strong>{replayCount}</strong>
          <span>историй с полным воспроизведением</span>
        </article>
      </section>

      <section className={styles.filtersPanel} aria-label="Фильтры истории">
        <label className={styles.searchField}>
          <span>Поиск</span>
          <input
            type="search"
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
            placeholder="Тикер, сетап или результат"
          />
        </label>

        <label className={styles.selectField}>
          <span>Результат</span>
          <select value={result} onChange={(event: ChangeEvent<HTMLSelectElement>) => setResult(event.target.value as ResultFilter)}>
            <option value="all">Все результаты</option>
            {(Object.entries(HISTORY_RESULT_LABELS) as Array<[HistoryResult, string]>).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className={styles.selectField}>
          <span>Направление</span>
          <select value={direction} onChange={(event: ChangeEvent<HTMLSelectElement>) => setDirection(event.target.value as DirectionFilter)}>
            <option value="all">LONG и SHORT</option>
            <option value="long">LONG</option>
            <option value="short">SHORT</option>
          </select>
        </label>

        <label className={styles.selectField}>
          <span>Тип сетапа</span>
          <select value={setupType} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSetupType(event.target.value as SetupTypeFilter)}>
            <option value="all">Все типы</option>
            <option value="breakout">Пробой уровня</option>
            <option value="bounce">Отскок от уровня</option>
          </select>
        </label>

        <label className={styles.selectField}>
          <span>Таймфрейм</span>
          <select value={timeframe} onChange={(event: ChangeEvent<HTMLSelectElement>) => setTimeframe(event.target.value as TimeframeFilter)}>
            <option value="all">Все TF</option>
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
          </select>
        </label>

        <label className={styles.selectField}>
          <span>Сортировка</span>
          <select value={sortKey} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSortKey(event.target.value as SortKey)}>
            <option value="latest">Сначала новые</option>
            <option value="maxMove">По движению</option>
            <option value="fastest">По времени до цели</option>
          </select>
        </label>

        <div className={styles.filterResult}>
          <strong>{filteredItems.length}</strong>
          <span>из {MARKET_HISTORY_ITEMS.length}</span>
        </div>

        <button className={styles.resetButton} type="button" onClick={resetFilters}>Сбросить</button>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.tablePanel} aria-label="Таблица истории сетапов">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Найденные ситуации</p>
              <h2>История сетапов</h2>
            </div>
            <span>{filteredItems.length} записей</span>
          </div>

          <div className={styles.tableScroll}>
            <div className={styles.tableHead} aria-hidden="true">
              <span>Инструмент</span>
              <span>Сетап</span>
              <span>Обнаружен</span>
              <span>Стадия</span>
              <span>Результат</span>
              <span>Макс. движение</span>
              <span>До цели</span>
            </div>

            <div className={styles.historyRows}>
              {filteredItems.length > 0 ? filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.historyRow} ${selectedItem.id === item.id ? styles.historyRowSelected : ''}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className={styles.instrumentCell}>
                    <span className={styles.symbolMark}>{item.symbol.slice(0, 1)}</span>
                    <span>
                      <strong>{item.symbol}</strong>
                      <small>{item.exchange} · {item.timeframe}</small>
                    </span>
                  </span>
                  <span className={styles.setupCell}>
                    <DirectionBadge direction={item.direction} />
                    <span>{item.setupLabel}</span>
                  </span>
                  <span className={styles.dateCell}>{formatUtcDate(item.detectedAt)}</span>
                  <span><SetupStageBadge stage={item.stageAtDetection} /></span>
                  <span className={`${styles.resultBadge} ${getResultToneClass(item.result)}`}>{HISTORY_RESULT_LABELS[item.result]}</span>
                  <strong className={item.maxMovePct !== null ? styles.moveValue : styles.mutedValue}>{formatSignedPercent(item.maxMovePct)}</strong>
                  <span className={styles.durationCell}>{formatDuration(item.timeToTargetSec)}</span>
                </button>
              )) : (
                <div className={styles.emptyState}>
                  <strong>История не найдена</strong>
                  <span>Измени фильтры или сбрось их.</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className={styles.detailPanel} aria-label="Подробности выбранного сетапа">
          <div className={styles.detailHeader}>
            <div>
              <div className={styles.detailSymbolLine}>
                <h2>{selectedItem.symbol}</h2>
                <DirectionBadge direction={selectedItem.direction} />
                <span className={styles.timeframe}>{selectedItem.timeframe}</span>
              </div>
              <p>{selectedItem.setupLabel}</p>
            </div>
            <span className={`${styles.resultBadge} ${getResultToneClass(selectedItem.result)}`}>
              {HISTORY_RESULT_LABELS[selectedItem.result]}
            </span>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div>
                <span>Цена при обнаружении</span>
                <strong>{formatPrice(selectedItem.detectedPrice)}</strong>
              </div>
              <div className={styles.chartMove}>
                <span>Макс. движение</span>
                <strong>{formatSignedPercent(selectedItem.maxMovePct)}</strong>
              </div>
            </div>
            <svg viewBox="0 0 640 176" role="img" aria-label={`Движение ${selectedItem.symbol} после обнаружения сетапа`}>
              <defs>
                <linearGradient id="history-chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[44, 88, 132].map((value) => <line key={value} x1="0" y1={value} x2="640" y2={value} className={styles.gridLine} />)}
              {[128, 256, 384, 512].map((value) => <line key={value} x1={value} y1="0" x2={value} y2="176" className={styles.gridLine} />)}
              <polygon
                points={`0,176 ${buildPolyline(selectedItem.chartPoints)} 640,176`}
                className={selectedItem.result === 'successful' ? styles.chartAreaPositive : selectedItem.result === 'failed' ? styles.chartAreaNegative : styles.chartAreaNeutral}
              />
              <polyline
                points={buildPolyline(selectedItem.chartPoints)}
                className={selectedItem.result === 'successful' ? styles.chartLinePositive : selectedItem.result === 'failed' ? styles.chartLineNegative : styles.chartLineNeutral}
              />
              <line x1="0" y1="88" x2="640" y2="88" className={styles.detectedLine} />
            </svg>
            <div className={styles.chartLegend}>
              <span>Обнаружение</span>
              <span>{formatUtcDate(selectedItem.completedAt)}</span>
            </div>
          </div>

          <div className={styles.detailMetrics}>
            <div><span>Зона уровня</span><strong>{selectedItem.levelZone}</strong></div>
            <div><span>Касания</span><strong>{selectedItem.touchesCount}</strong></div>
            <div><span>Формирование</span><strong>{formatDuration(selectedItem.formationDurationSec)}</strong></div>
            <div><span>Откаты</span><strong>{selectedItem.pullbackLabel}</strong></div>
            <div><span>Сила к BTC</span><strong className={(selectedItem.btcRelativeStrength ?? 0) >= 0 ? styles.positiveValue : styles.negativeValue}>{formatSignedPercent(selectedItem.btcRelativeStrength)}</strong></div>
            <div><span>Против движения</span><strong className={styles.negativeValue}>{formatSignedPercent(selectedItem.adverseMovePct)}</strong></div>
          </div>

          <section className={styles.resultSection}>
            <p className={styles.sectionLabel}>Почему такой результат</p>
            <h3>{selectedItem.resultLabel}</h3>
            <p>{selectedItem.resultReason}</p>
          </section>

          <section className={styles.noteSection}>
            <p className={styles.sectionLabel}>Итог NEXUS</p>
            <p>{selectedItem.resultNote}</p>
          </section>

          <div className={styles.detailActions}>
            {selectedItem.replayAvailable && selectedItem.replayId ? (
              <Link className={styles.primaryButton} to={`${ROUTES.replay}?session=${selectedItem.replayId}`}>
                Открыть Replay →
              </Link>
            ) : (
              <button className={styles.primaryButton} type="button" disabled>Replay недоступен</button>
            )}
            <Link className={styles.secondaryButton} to={`${ROUTES.workspace}?symbol=${selectedItem.symbol}&setup=${selectedItem.setupId}`}>
              Workspace
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
