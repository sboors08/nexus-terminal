import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import {
  SCANNER_SETUPS,
  type ScannerSetup,
  type ScannerSetupKind,
  type ScannerTimeframe,
} from '@/features/scanner/scannerData';
import { DirectionBadge, type TradeDirection } from '@/shared/ui/DirectionBadge';
import { SetupStageBadge, type SetupStage } from '@/shared/ui/SetupStageBadge';
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

export function ScannerPage() {
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [kind, setKind] = useState<KindFilter>('all');
  const [stage, setStage] = useState<StageFilter>('all');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');
  const [distance, setDistance] = useState<DistanceFilter>('all');
  const [touches, setTouches] = useState<TouchesFilter>('all');
  const [btcStrength, setBtcStrength] = useState<BtcStrengthFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('distance');
  const [selectedId, setSelectedId] = useState(SCANNER_SETUPS[0].id);

  const filteredSetups = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase();
    const maxDistance = distance === 'all' ? null : Number(distance);
    const minTouches = touches === 'all' ? null : Number(touches);

    const result = SCANNER_SETUPS.filter((setup) => {
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
    return filteredSetups.find((setup) => setup.id === selectedId)
      ?? SCANNER_SETUPS.find((setup) => setup.id === selectedId)
      ?? filteredSetups[0]
      ?? SCANNER_SETUPS[0];
  }, [filteredSetups, selectedId]);

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
          <p className={styles.eyebrow}>Поиск сетапов · тестовые данные</p>
          <h1 className={styles.title}>Scanner</h1>
          <p className={styles.subtitle}>Полный список найденных ситуаций с фильтрацией, сортировкой и предпросмотром.</p>
        </div>
        <div className={styles.headerStatus}>
          <span className={styles.liveDot} aria-hidden="true" />
          Обновлено 17:32:14
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
            <span>из {SCANNER_SETUPS.length} сетапов</span>
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
            <span className={styles.testBadge}>TEST DATA</span>
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
                    onClick={() => setSelectedId(setup.id)}
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
              <strong>{selectedSetup.price}</strong>
              <span className={selectedSetup.direction === 'long' ? styles.positiveValue : styles.negativeValue}>{selectedSetup.priceChange}</span>
            </div>
          </div>

          <div className={styles.stageLine}>
            <SetupStageBadge stage={selectedSetup.stage} resultLabel={selectedSetup.kind.includes('Отскок') ? 'Отскок' : 'Пробой'} />
            <span>Зона {selectedSetup.level}</span>
          </div>

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

          <section className={styles.reasonBlock}>
            <p className={styles.panelEyebrow}>Почему в Scanner</p>
            <ul>
              {selectedSetup.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </section>

          <div className={styles.previewActions}>
            <Link className={styles.primaryLink} to={`${ROUTES.workspace}?symbol=${selectedSetup.symbol}`}>
              Открыть Workspace <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.secondaryLink} to={ROUTES.alerts}>Создать алерт</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
