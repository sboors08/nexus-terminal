import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import {
  Link,
  useSearchParams,
} from 'react-router';
import {
  ROUTES,
} from '@/app/routing/routes';
import {
  fetchMarketHistoryRuntimeView,
  getMarketHistoryRuntimeSetupLabel,
  type MarketHistoryRuntimeItem,
  type MarketHistoryRuntimeResult,
  type MarketHistoryRuntimeStage,
  type MarketHistoryRuntimeViewData,
} from '@/shared/api/runtime/marketHistoryRuntimeApi';
import {
  useSetupLifecycleRefresh,
} from '@/shared/api/runtime/useSetupLifecycleRefresh';
import {
  useApiQuery,
} from '@/shared/api/useApiQuery';
import {
  useFeedbackPageContext,
} from '@/shared/feedback/FeedbackProvider';
import {
  buildReplayUrl,
  buildWorkspaceUrl,
} from '@/shared/routing/setupContext';
import {
  AsyncDataState,
} from '@/shared/ui/AsyncDataState';
import {
  DirectionBadge,
  type TradeDirection,
} from '@/shared/ui/DirectionBadge';
import {
  SetupStageBadge,
  type SetupStage,
  type SetupStageResultLabel,
} from '@/shared/ui/SetupStageBadge';
import styles from './MarketHistoryPage.module.css';

type ResultFilter =
  | 'all'
  | MarketHistoryRuntimeResult;

type DirectionFilter =
  | 'all'
  | TradeDirection;

type SetupTypeFilter =
  | 'all'
  | MarketHistoryRuntimeItem['setupType'];

type TimeframeFilter =
  | 'all'
  | string;

type SortKey =
  | 'latest'
  | 'detected'
  | 'events';

const TIMEFRAME_ORDER = [
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
] as const;

const UTC_DATE_FORMATTER =
  new Intl.DateTimeFormat(
    'ru-RU',
    {
      day:
        '2-digit',

      month:
        '2-digit',

      year:
        '2-digit',

      hour:
        '2-digit',

      minute:
        '2-digit',

      timeZone:
        'UTC',
    },
  );

function formatUtcDate(
  value: string | null,
): string {
  if (!value) {
    return '—';
  }

  return `${UTC_DATE_FORMATTER.format(new Date(value)).replace(',', '')} UTC`;
}

function formatPrice(
  value: number,
): string {
  if (value >= 1000) {
    return value.toLocaleString(
      'ru-RU',
      {
        maximumFractionDigits:
          2,
      },
    );
  }

  if (value >= 10) {
    return value.toLocaleString(
      'ru-RU',
      {
        minimumFractionDigits:
          2,

        maximumFractionDigits:
          2,
      },
    );
  }

  return value.toLocaleString(
    'ru-RU',
    {
      minimumFractionDigits:
        4,

      maximumFractionDigits:
        8,
    },
  );
}

function formatDistance(
  value: number,
): string {
  return `${value.toFixed(4)}%`;
}

function formatLevelZone(
  item: MarketHistoryRuntimeItem,
): string {
  return (
    formatPrice(
      item.level.zoneLow,
    )
    + '–'
    + formatPrice(
      item.level.zoneHigh,
    )
  );
}

function mapRuntimeStage(
  stage: MarketHistoryRuntimeStage,
): SetupStage {
  if (
    stage === 'LEVEL_CONFIRMED'
  ) {
    return 'observation';
  }

  if (
    stage === 'APPROACHING_THIRD_TOUCH'
  ) {
    return 'approach';
  }

  if (
    stage === 'THIRD_TOUCH_CONFIRMED'
  ) {
    return 'confirmation';
  }

  return 'triggered';
}

function getStageResultLabel(
  item: MarketHistoryRuntimeItem,
): SetupStageResultLabel {
  if (
    item.result
    === 'breakout_confirmed'
  ) {
    return 'Пробой';
  }

  if (
    item.result
    === 'rejection_confirmed'
  ) {
    return 'Отскок';
  }

  return 'Исход';
}

function formatStage(
  stage:
    MarketHistoryRuntimeStage
    | null,
): string {
  if (
    stage === null
  ) {
    return '—';
  }

  if (
    stage === 'LEVEL_CONFIRMED'
  ) {
    return 'Наблюдение';
  }

  if (
    stage === 'APPROACHING_THIRD_TOUCH'
  ) {
    return 'Подход';
  }

  if (
    stage === 'THIRD_TOUCH_CONFIRMED'
  ) {
    return 'Подтверждение';
  }

  if (
    stage === 'BREAKOUT_CONFIRMED'
  ) {
    return 'Пробой подтверждён';
  }

  if (
    stage === 'REJECTION_CONFIRMED'
  ) {
    return 'Реакция подтверждена';
  }

  return 'Истёк';
}

function formatEventType(
  type:
    MarketHistoryRuntimeItem['lifecycle'][number]['type'],
): string {
  if (
    type === 'candidate_created'
  ) {
    return 'Кандидат создан';
  }

  if (
    type === 'stage_transition'
  ) {
    return 'Смена стадии';
  }

  if (
    type === 'breakout_confirmed'
  ) {
    return 'Пробой подтверждён';
  }

  if (
    type === 'rejection_confirmed'
  ) {
    return 'Реакция подтверждена';
  }

  return 'Сетап истёк';
}

function resultExplanation(
  item: MarketHistoryRuntimeItem,
): string {
  if (
    item.result
    === 'breakout_confirmed'
  ) {
    return 'Setup Engine зафиксировал BREAKOUT_CONFIRMED. Это lifecycle-факт, а не оценка прибыльности сделки.';
  }

  if (
    item.result
    === 'rejection_confirmed'
  ) {
    return 'Setup Engine зафиксировал REJECTION_CONFIRMED. Это lifecycle-факт реакции уровня, а не оценка прибыли или убытка.';
  }

  if (
    item.result
    === 'expired'
  ) {
    return 'Setup Engine завершил этот episode по SETUP_EXPIRED без присвоения выдуманного торгового результата.';
  }

  return 'Setup episode остаётся активным. История показывает уже зафиксированные lifecycle-события без прогнозирования будущего исхода.';
}

function persistenceLabel(
  data: MarketHistoryRuntimeViewData,
): string {
  const persistence =
    data.source.persistence;

  if (!persistence) {
    return 'memory-only';
  }

  if (
    persistence.state
    === 'degraded'
  ) {
    return 'degraded';
  }

  if (
    persistence.state
      === 'ready'
    && persistence.hydrated
  ) {
    return 'persistent · ready';
  }

  return `persistent · ${persistence.state}`;
}

function MarketHistoryRuntimeContent({
  data,
}: {
  data: MarketHistoryRuntimeViewData;
}) {
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const requestedHistoryId =
    searchParams.get(
      'historyId',
    );

  const requestedSetupId =
    searchParams.get(
      'setupId',
    );

  const historyItems =
    data.items;

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    result,
    setResult,
  ] = useState<ResultFilter>(
    'all',
  );

  const [
    direction,
    setDirection,
  ] = useState<DirectionFilter>(
    'all',
  );

  const [
    setupType,
    setSetupType,
  ] = useState<SetupTypeFilter>(
    'all',
  );

  const [
    timeframe,
    setTimeframe,
  ] = useState<TimeframeFilter>(
    'all',
  );

  const [
    sortKey,
    setSortKey,
  ] = useState<SortKey>(
    'latest',
  );

  const availableTimeframes =
    useMemo(
      () => {
        const present =
          new Set(
            historyItems.map(
              (item) =>
                item.timeframe,
            ),
          );

        const canonical =
          TIMEFRAME_ORDER.filter(
            (value) =>
              present.has(
                value,
              ),
          );

        const extra =
          [...present]
            .filter(
              (value) =>
                !TIMEFRAME_ORDER.includes(
                  value as typeof TIMEFRAME_ORDER[number],
                ),
            )
            .sort();

        return [
          ...canonical,
          ...extra,
        ];
      },
      [
        historyItems,
      ],
    );

  const filteredItems =
    useMemo(
      () => {
        const normalizedSearch =
          search
            .trim()
            .toUpperCase();

        const items =
          historyItems.filter(
            (item) => {
              const setupLabel =
                getMarketHistoryRuntimeSetupLabel(
                  item,
                );

              const resultLabel =
                data.resultLabels[
                  item.result
                ];

              if (
                normalizedSearch
                && !(
                  item.symbol
                  + ' '
                  + setupLabel
                  + ' '
                  + resultLabel
                  + ' '
                  + item.setupId
                )
                  .toUpperCase()
                  .includes(
                    normalizedSearch,
                  )
              ) {
                return false;
              }

              if (
                result !== 'all'
                && item.result
                  !== result
              ) {
                return false;
              }

              if (
                direction !== 'all'
                && item.direction
                  !== direction
              ) {
                return false;
              }

              if (
                setupType !== 'all'
                && item.setupType
                  !== setupType
              ) {
                return false;
              }

              if (
                timeframe !== 'all'
                && item.timeframe
                  !== timeframe
              ) {
                return false;
              }

              return true;
            },
          );

        return [
          ...items,
        ].sort(
          (
            left,
            right,
          ) => {
            if (
              sortKey === 'events'
            ) {
              return (
                right.lifecycleEventCount
                - left.lifecycleEventCount
              );
            }

            if (
              sortKey === 'detected'
            ) {
              return (
                Date.parse(
                  right.detectedAt,
                )
                - Date.parse(
                    left.detectedAt,
                  )
              );
            }

            return (
              right.lastEventId
              - left.lastEventId
            );
          },
        );
      },
      [
        data.resultLabels,
        direction,
        historyItems,
        result,
        search,
        setupType,
        sortKey,
        timeframe,
      ],
    );

  const selectedItem =
    useMemo(
      () => (
        filteredItems.find(
          (item) =>
            item.id
            === requestedHistoryId,
        )
        ?? historyItems.find(
          (item) =>
            item.id
            === requestedHistoryId,
        )
        ?? filteredItems.find(
          (item) =>
            item.setupId
            === requestedSetupId,
        )
        ?? historyItems.find(
          (item) =>
            item.setupId
            === requestedSetupId,
        )
        ?? filteredItems[0]
        ?? historyItems[0]
        ?? null
      ),
      [
        filteredItems,
        historyItems,
        requestedHistoryId,
        requestedSetupId,
      ],
    );

  useEffect(
    () => {
      if (!selectedItem) {
        return;
      }

      if (
        requestedHistoryId
          === selectedItem.id
        && requestedSetupId
          === selectedItem.setupId
      ) {
        return;
      }

      const nextParams =
        new URLSearchParams(
          searchParams,
        );

      nextParams.set(
        'historyId',
        selectedItem.id,
      );

      nextParams.set(
        'setupId',
        selectedItem.setupId,
      );

      setSearchParams(
        nextParams,
        {
          replace:
            true,
        },
      );
    },
    [
      requestedHistoryId,
      requestedSetupId,
      searchParams,
      selectedItem,
      setSearchParams,
    ],
  );

  useFeedbackPageContext({
    screen:
      'Market History',

    symbol:
      selectedItem
        ?.symbol
      ?? null,

    timeframe:
      selectedItem
        ?.timeframe
      ?? null,

    setupId:
      selectedItem
        ?.setupId
      ?? null,

    replayId:
      null,
  });

  if (!selectedItem) {
    return null;
  }

  const selectHistoryItem =
    (
      item: MarketHistoryRuntimeItem,
    ) => {
      const nextParams =
        new URLSearchParams(
          searchParams,
        );

      nextParams.set(
        'historyId',
        item.id,
      );

      nextParams.set(
        'setupId',
        item.setupId,
      );

      setSearchParams(
        nextParams,
      );
    };

  const terminalCount =
    historyItems.filter(
      (item) =>
        item.result
        !== 'active',
    ).length;

  const activeCount =
    historyItems.length
    - terminalCount;

  const completeCount =
    historyItems.filter(
      (item) =>
        item.historyComplete,
    ).length;

  const degraded =
    data.source.persistence
      ?.state
    === 'degraded';

  const resetFilters =
    () => {
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
          <p className={styles.eyebrow}>Persistent Setup lifecycle history · production facts</p>
          <h1 className={styles.title}>Market History</h1>
          <p className={styles.subtitle}>Сохранённая история реальных Setup episodes и их lifecycle-событий.</p>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.testBadge}>RUNTIME</span>
          <span>{persistenceLabel(data)}</span>
        </div>
      </header>

      <section
        className={styles.dataNotice}
        aria-label="Источник данных Market History"
      >
        <strong>
          {degraded
            ? 'DEGRADED: runtime History продолжает bounded in-memory сбор'
            : 'REAL RUNTIME DATA: Setup lifecycle history'}
        </strong>
        <span>
          Показатели max move, adverse move, time-to-target и Replay не рассчитываются в этом этапе.
          Страница показывает только сохранённые backend-факты без synthetic outcome-метрик.
        </span>
      </section>

      <section className={styles.summaryGrid} aria-label="Сводка истории сетапов">
        <article className={styles.summaryCard}>
          <p>Setup episodes</p>
          <strong>{historyItems.length}</strong>
          <span>реальных candidate histories</span>
        </article>
        <article className={styles.summaryCard}>
          <p>Terminal lifecycle</p>
          <strong>{terminalCount}</strong>
          <span>пробой / реакция / expiry</span>
        </article>
        <article className={styles.summaryCard}>
          <p>Активные</p>
          <strong>{activeCount}</strong>
          <span>ещё без terminal lifecycle</span>
        </article>
        <article className={styles.summaryCard}>
          <p>Сохранённые события</p>
          <strong>{data.source.eventsCount}</strong>
          <span>{completeCount}/{historyItems.length} histories с candidate_created</span>
        </article>
      </section>

      <section className={styles.filtersPanel} aria-label="Фильтры истории">
        <label className={styles.searchField}>
          <span>Поиск</span>
          <input
            type="search"
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
            placeholder="Тикер, setup ID или lifecycle result"
          />
        </label>

        <label className={styles.selectField}>
          <span>Lifecycle result</span>
          <select value={result} onChange={(event: ChangeEvent<HTMLSelectElement>) => setResult(event.target.value as ResultFilter)}>
            <option value="all">Все состояния</option>
            {(Object.entries(data.resultLabels) as Array<[MarketHistoryRuntimeResult, string]>).map(([value, label]) => (
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
            <option value="level_breakout">Пробой уровня</option>
            <option value="level_bounce">Отскок от уровня</option>
          </select>
        </label>

        <label className={styles.selectField}>
          <span>Таймфрейм</span>
          <select value={timeframe} onChange={(event: ChangeEvent<HTMLSelectElement>) => setTimeframe(event.target.value)}>
            <option value="all">Все TF</option>
            {availableTimeframes.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        <label className={styles.selectField}>
          <span>Сортировка</span>
          <select value={sortKey} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSortKey(event.target.value as SortKey)}>
            <option value="latest">По последнему событию</option>
            <option value="detected">По обнаружению</option>
            <option value="events">По числу событий</option>
          </select>
        </label>

        <div className={styles.filterResult}>
          <strong>{filteredItems.length}</strong>
          <span>из {historyItems.length}</span>
        </div>

        <button className={styles.resetButton} type="button" onClick={resetFilters}>Сбросить</button>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.tablePanel} aria-label="Таблица истории сетапов">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Persistent candidate episodes</p>
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
              <span>Lifecycle result</span>
              <span>Последнее событие</span>
              <span>События</span>
            </div>

            <div className={styles.historyRows}>
              {filteredItems.length > 0 ? filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.historyRow} ${selectedItem.id === item.id ? styles.historyRowSelected : ''}`}
                  onClick={() => selectHistoryItem(item)}
                >
                  <span className={styles.instrumentCell}>
                    <span className={styles.symbolMark}>{item.symbol.slice(0, 1)}</span>
                    <span>
                      <strong>{item.symbol}</strong>
                      <small>BINANCE · {item.timeframe}</small>
                    </span>
                  </span>
                  <span className={styles.setupCell}>
                    <DirectionBadge direction={item.direction} />
                    <span>{getMarketHistoryRuntimeSetupLabel(item)}</span>
                  </span>
                  <span className={styles.dateCell}>{formatUtcDate(item.detectedAt)}</span>
                  <span>
                    <SetupStageBadge
                      stage={mapRuntimeStage(item.currentStage)}
                      resultLabel={getStageResultLabel(item)}
                    />
                  </span>
                  <span className={styles.resultBadge}>{data.resultLabels[item.result]}</span>
                  <span className={styles.durationCell}>{formatUtcDate(item.latestEventAt)}</span>
                  <strong>{item.lifecycleEventCount}</strong>
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
              <p>{getMarketHistoryRuntimeSetupLabel(selectedItem)}</p>
            </div>
            <span className={styles.resultBadge}>
              {data.resultLabels[selectedItem.result]}
            </span>
          </div>

          <div className={styles.detailMetrics}>
            <div><span>Зона уровня</span><strong>{formatLevelZone(selectedItem)}</strong></div>
            <div><span>Касания</span><strong>{selectedItem.level.touches}</strong></div>
            <div><span>{selectedItem.historyComplete ? 'Цена обнаружения' : 'Цена первого retained event'}</span><strong>{formatPrice(selectedItem.detectedPrice)}</strong></div>
            <div><span>Последняя цена</span><strong>{formatPrice(selectedItem.currentPrice)}</strong></div>
            <div><span>Расстояние до уровня</span><strong>{formatDistance(selectedItem.distanceToLevelPct)}</strong></div>
            <div><span>Lifecycle events</span><strong>{selectedItem.lifecycleEventCount}</strong></div>
          </div>

          <section className={styles.resultSection}>
            <p className={styles.sectionLabel}>Фактический lifecycle result</p>
            <h3>{data.resultLabels[selectedItem.result]}</h3>
            <p>{resultExplanation(selectedItem)}</p>
          </section>

          <section className={styles.noteSection}>
            <p className={styles.sectionLabel}>Identity</p>
            <p>Setup ID: {selectedItem.setupId}</p>
            <p>Episode ID: {selectedItem.episodeId ?? '—'}</p>
            <p>Line ID: {selectedItem.lineId ?? '—'}</p>
            <p>
              История: {selectedItem.historyComplete ? 'полная в retained buffer' : 'частичная из-за bounded retention'}.
            </p>
          </section>

          <section className={styles.noteSection}>
            <p className={styles.sectionLabel}>Lifecycle</p>
            <ol>
              {selectedItem.lifecycle.map((event) => (
                <li key={event.eventId}>
                  <strong>{formatEventType(event.type)}</strong>
                  {' · '}
                  {formatUtcDate(event.occurredAt)}
                  {' · '}
                  {formatStage(event.previousStage)}
                  {' → '}
                  {formatStage(event.currentStage)}
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.noteSection}>
            <p className={styles.sectionLabel}>Границы текущих данных</p>
            <p>
              Profit/loss, max move, adverse move и time-to-target здесь намеренно отсутствуют.
              Replay воспроизводит только сохранённые lifecycle events и candidate snapshots без synthetic candles, tape или стакана.
            </p>
          </section>

          <div className={styles.detailActions}>
            <Link className={styles.primaryButton} to={buildReplayUrl(ROUTES.replay, {
              setupId: selectedItem.setupId,
              symbol: selectedItem.symbol,
              timeframe: selectedItem.timeframe,
            })}>
              Replay
            </Link>
            <Link className={styles.secondaryButton} to={buildWorkspaceUrl(ROUTES.workspace, {
              setupId: selectedItem.setupId,
              symbol: selectedItem.symbol,
              timeframe: selectedItem.timeframe,
            })}>
              Workspace
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

export function MarketHistoryPage() {
  const query =
    useApiQuery(
      'market-history-runtime-view',
      () =>
        fetchMarketHistoryRuntimeView(),
      {
        preserveData:
          true,
      },
    );

  useSetupLifecycleRefresh({
    onEvent:
      query.retry,
  });

  if (
    query.status === 'loading'
    && !query.data
  ) {
    return <AsyncDataState state="loading" />;
  }

  if (
    query.status === 'error'
    && !query.data
  ) {
    return (
      <AsyncDataState
        state="error"
        message={query.error?.message}
        onRetry={query.retry}
      />
    );
  }

  if (
    !query.data
    || query.data.items.length === 0
  ) {
    return <AsyncDataState state="empty" />;
  }

  return (
    <MarketHistoryRuntimeContent
      data={query.data}
    />
  );
}
