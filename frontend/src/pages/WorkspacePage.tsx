import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { useFeedbackPageContext } from '@/shared/feedback/FeedbackProvider';
import {
  buildWorkspaceRealtimeView,
  useRealtimeMarketData,
} from '@/shared/realtime';
import {
  buildMarketWorkspaceSetupId,
  buildReplayUrl,
  isMarketWorkspaceSetupId,
  buildSetupSelectionUrl,
  isWorkspaceTimeframe,
} from '@/shared/routing/setupContext';
import {
  TRADING_PRESETS,
  isScannerWindow,
  isTradingPreset,
  type ScannerWindow,
  type TradingPreset,
  type TradingPresetDefinition,
} from '@/shared/config/tradingPresets';
import {
  nexusApi,
  useApiQuery,
  useSetupLifecycleRefresh,
  type PrintSide,
  type Setup,
  type WorkspaceSnapshot,
  type WorkspaceViewData,
} from '@/shared/api';
import {
  NexusCandlestickChart,
  useMarketCandles,
  type NexusChartPriceLine,
} from '@/shared/charts';
import { AsyncDataState } from '@/shared/ui/AsyncDataState';
import { DirectionBadge } from '@/shared/ui/DirectionBadge';
import { SetupStageBadge } from '@/shared/ui/SetupStageBadge';
import styles from './WorkspacePage.module.css';

type Timeframe = '1m' | '5m' | '15m';
type TapeFilter = 'all' | PrintSide;

type WorkspacePageData = {
  contractSetup: Setup;
  snapshot: WorkspaceSnapshot;
  view: WorkspaceViewData;
};

function ChecklistIcon({ state }: { state: 'passed' | 'warning' | 'waiting' }) {
  if (state === 'passed') return <span aria-hidden="true">✓</span>;
  if (state === 'warning') return <span aria-hidden="true">!</span>;
  return <span aria-hidden="true">·</span>;
}

function WorkspacePageContent({ data }: { data: WorkspacePageData }) {
  const { contractSetup, snapshot, view } = data;
  const { selectedSetup, prints, liquidity, marketDynamics, stageFlow } = view;
  const isMarketPreview =
    isMarketWorkspaceSetupId(
      contractSetup.id,
    );
  const [searchParams, setSearchParams] = useSearchParams();
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
  const requestedTimeframe = searchParams.get('timeframe');
  const defaultTimeframe: Timeframe = isWorkspaceTimeframe(selectedSetup.timeframe) ? selectedSetup.timeframe : '5m';
  const timeframe: Timeframe = isWorkspaceTimeframe(requestedTimeframe) ? requestedTimeframe : defaultTimeframe;

  const candlesQuery = useMarketCandles({
    symbol: contractSetup.symbol,
    timeframe,
  });

  const latestCandle =
    candlesQuery.status === 'success'
    && candlesQuery.data?.length
      ? candlesQuery.data[
          candlesQuery.data.length - 1
        ]
      : undefined;

  const candleFreshness =
    candlesQuery.freshness;

  const hasCandleData =
    Boolean(
      candlesQuery.data?.length,
    );

  const hasCandlePrice =
    latestCandle !== undefined;

  const chartCurrentPrice =
    latestCandle?.close
    ?? contractSetup.currentPrice;

  const chartPriceHeading =
    hasCandlePrice
      ? candleFreshness.state
          === 'live'
        ? 'Текущая цена'
        : 'Последняя цена'
      : 'Цена сетапа';

  const chartPriceLineTitle =
    hasCandlePrice
      ? candleFreshness.label
      : 'SETUP';

  const chartPriceLineColor =
    hasCandlePrice
    && candleFreshness.state
      === 'stale'
      ? '#d5a928'
      : '#4aa8ff';

  const chartUpdatedAtLabel = (() => {
    if (
      candleFreshness.lastUpdatedAt
      === null
    ) {
      return 'время неизвестно';
    }

    const timestamp =
      new Date(
        candleFreshness.lastUpdatedAt,
      );

    if (
      !Number.isFinite(
        timestamp.getTime(),
      )
    ) {
      return 'время неизвестно';
    }

    return timestamp.toLocaleTimeString(
      'ru-RU',
      {
        hour:
          '2-digit',
        minute:
          '2-digit',
        second:
          '2-digit',
      },
    );
  })();

  const chartPriceSource =
    hasCandlePrice
      ? [
          candleFreshness.label,
          candleFreshness
            .lastUpdatedLabel,
          chartUpdatedAtLabel,
        ].join(
          ' · ',
        )
      : candleFreshness.state
          === 'collecting'
        ? 'COLLECTING · ожидаем свечи'
        : [
            candleFreshness.label,
            'свечи недоступны',
          ].join(
            ' · ',
          );

  const chartLevelCenter =
    contractSetup.level
      .centerPrice;

  const chartZoneLow =
    contractSetup.level
      .zoneLow;

  const chartZoneHigh =
    contractSetup.level
      .zoneHigh;

  const formatChartPrice = (
    value: number,
  ) =>
    value.toLocaleString(
      'ru-RU',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      },
    );

  const chartLevelLabel =
    `${formatChartPrice(chartZoneLow)}–${formatChartPrice(chartZoneHigh)}`;

  const chartPriceLines =
    useMemo<readonly NexusChartPriceLine[]>(
      () => {
        const currentPriceLine:
        NexusChartPriceLine = {
          price:
            chartCurrentPrice,

          color:
            chartPriceLineColor,

          title:
            chartPriceLineTitle,

          lineStyle:
            'dashed',
        };

        if (isMarketPreview) {
          return [
            currentPriceLine,
          ];
        }

        return [
          {
            price:
              chartZoneLow,

            color:
              '#d5a928',

            lineStyle:
              'dashed',

            axisLabelVisible:
              false,
          },
          {
            price:
              chartLevelCenter,

            color:
              '#f0b90b',

            title:
              'УРОВЕНЬ',

            lineStyle:
              'solid',
          },
          {
            price:
              chartZoneHigh,

            color:
              '#d5a928',

            lineStyle:
              'dashed',

            axisLabelVisible:
              false,
          },

          currentPriceLine,
        ];
      },
      [
        chartCurrentPrice,
        chartPriceLineColor,
        chartPriceLineTitle,
        chartLevelCenter,
        chartZoneHigh,
        chartZoneLow,
        isMarketPreview,
      ],
    );
  const [tapeFilter, setTapeFilter] = useState<TapeFilter>('all');
  const [alertCreated, setAlertCreated] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const realtime = useRealtimeMarketData({
    symbol: selectedSetup.symbol,
  });

  const realtimeSnapshot =
    realtime.snapshots[selectedSetup.symbol];

  const realtimeWorkspace = useMemo(
    () => buildWorkspaceRealtimeView(
      realtimeSnapshot,
      selectedSetup.price,
      snapshot.candles,
      realtime.lifecycleState,
      realtime.status?.state ?? null,
    ),
    [
      realtimeSnapshot,
      selectedSetup.price,
      snapshot.candles,
      realtime.lifecycleState,
      realtime.status?.state,
    ],
  );

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('setup');
    nextParams.set('setupId', contractSetup.id);
    nextParams.set('symbol', contractSetup.symbol);
    nextParams.set('preset', preset);
    nextParams.set('scannerWindow', scannerWindow);
    nextParams.set('timeframe', timeframe);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [contractSetup.id, contractSetup.symbol, preset, scannerWindow, searchParams, setSearchParams, timeframe]);

  const selectTimeframe = (value: Timeframe) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('setupId', contractSetup.id);
    nextParams.set('symbol', contractSetup.symbol);
    nextParams.set('timeframe', value);
    setSearchParams(nextParams);
  };

  useFeedbackPageContext({
    screen: 'Workspace',
    symbol: contractSetup.symbol,
    timeframe,
    setupId: contractSetup.id,
  });

  const visiblePrints = prints.filter((print) => tapeFilter === 'all' || print.side === tapeFilter);
  const resultLabel = selectedSetup.kind.includes('Отскок') ? 'Отскок' : 'Пробой';
  const currentStageIndex = { observation: 0, approach: 1, confirmation: 2, triggered: 3 }[selectedSetup.stage];

  const isRuntimeSetup =
    selectedSetup.runtimeData
    === true;

  const usesDemoWorkspaceContext =
    isRuntimeSetup
    || isMarketPreview;

  const displayedStageFlow =
    stageFlow.map(
      (stage, index) =>
        index === 3
          ? {
              ...stage,

              label:
                resultLabel,

              description:
                resultLabel === 'Отскок'
                  ? 'Подтверждён отскок от зоны'
                  : 'Подтверждён выход за зону',
            }
          : stage,
    );
  const baseAsset = selectedSetup.symbol.replace('USDT', '');
  const numericPrice = chartCurrentPrice;
  const priceDecimals = selectedSetup.price.includes('.') ? selectedSetup.price.split('.')[1].length : 2;
  const formatPrice = (value: number) => value.toLocaleString('ru-RU', {
    minimumFractionDigits: priceDecimals,
    maximumFractionDigits: priceDecimals,
  });
  const WORKSPACE_REFERENCE_PRICE =
    187.42;

  const mapReferencePrice = (
    referencePrice: string,
  ) => {
    const referenceValue =
      Number(
        referencePrice,
      );

    const ratio =
      referenceValue
      / WORKSPACE_REFERENCE_PRICE;

    return (
      Number.isFinite(
        numericPrice,
      )
      && Number.isFinite(
        ratio,
      )
    )
      ? formatPrice(
          numericPrice
          * ratio,
        )
      : referencePrice;
  };

  const volumeAnomaly =
    selectedSetup.volumeAnomaly;

  const tradesAnomaly =
    selectedSetup.tradesAnomaly;

  const btcStrengthValue =
    selectedSetup.btcStrength;

  const hasActivityMetrics =
    volumeAnomaly !== null
    && tradesAnomaly !== null;

  const hasBtcStrengthMetric =
    btcStrengthValue !== null;

  const workspaceChecklist = [
    {
      id:
        'check-touches',

      label:
        'Минимум 3 касания',

      detail:
        `Подтверждено касаний: ${selectedSetup.touches}.`,

      state:
        selectedSetup.touches >= 3
          ? 'passed'
          : 'warning',
    },
    {
      id:
        'check-pullbacks',

      label:
        'Характер откатов',

      detail:
        isRuntimeSetup
          ? 'Метрика откатов ещё не подключена к кандидату.'
          : `${selectedSetup.pullbackDepth} откаты возле найденной зоны.`,

      state:
        isRuntimeSetup
          ? 'waiting'
          : selectedSetup.pullbackDepth
              === 'Неглубокие'
            ? 'passed'
            : 'warning',
    },
    {
      id:
        'check-activity',

      label:
        'Активность выше средней',

      detail:
        !hasActivityMetrics
          ? 'Данные объёма и количества сделок пока собираются.'
          : `Объём ${volumeAnomaly.toFixed(2)}×, сделки ${tradesAnomaly.toFixed(2)}×.`,

      state:
        !hasActivityMetrics
          ? 'waiting'
          : volumeAnomaly >= 1.5
            && tradesAnomaly >= 1.5
            ? 'passed'
            : 'warning',
    },
    {
      id:
        'check-btc',

      label:
        'BTC-контекст поддерживает',

      detail:
        !hasBtcStrengthMetric
          ? 'BTC-контекст пока собирается.'
          : `Сила относительно BTC: ${selectedSetup.btcStrengthLabel}, корреляция ${selectedSetup.btcCorrelation}.`,

      state:
        !hasBtcStrengthMetric
          ? 'waiting'
          : (
              selectedSetup.direction
                === 'long'
              && btcStrengthValue > 0
            )
            || (
              selectedSetup.direction
                === 'short'
              && btcStrengthValue < 0
            )
            ? 'passed'
            : 'warning',
    },
    {
      id:
        'check-trigger',

      label:
        'Поток принтов подтверждает вход',

      detail:
        isRuntimeSetup
          ? 'Привязка потока принтов к сетапу будет добавлена отдельно.'
          : 'Активность растёт, финальное подтверждение ещё формируется.',

      state:
        isRuntimeSetup
          ? 'waiting'
          : 'warning',
    },
    {
      id:
        'check-result',

      label:
        `${resultLabel}: подтверждение результата`,

      detail:
        selectedSetup.stage
          === 'triggered'
          ? `${resultLabel} подтверждён Setup Engine.`
          : `Ожидается подтверждение возле зоны ${chartLevelLabel}.`,

      state:
        selectedSetup.stage
          === 'triggered'
          ? 'passed'
          : 'waiting',
    },
  ] as const;

  const checklistPassedCount =
    workspaceChecklist.filter(
      (item) =>
        item.state
        === 'passed',
    ).length;

  return (
    <section className={styles.workspace}>
      <header className={styles.pageHeader}>
        <div className={styles.instrumentHeader}>
          <Link
            className={styles.backLink}
            to={buildSetupSelectionUrl(ROUTES.scanner, contractSetup.id, {
              symbol: contractSetup.symbol,
              preset,
              scannerWindow,
              timeframe,
            })}
            aria-label="Вернуться в Scanner"
          >
            ←
          </Link>
          <div>
            <p className={styles.eyebrow}>
              {
                isMarketPreview
                  ? 'Рабочее пространство · рыночный обзор Binance'
                  : isRuntimeSetup
                    ? 'Рабочее пространство · реальный сетап Binance'
                    : 'Рабочее пространство · тестовые данные'
              }
            </p>
            <div className={styles.symbolRow}>
              <h1>{selectedSetup.symbol}</h1>
              {!isMarketPreview && (
                <DirectionBadge
                  direction={
                    selectedSetup.direction
                  }
                />
              )}
              <span className={styles.exchangeBadge}>{selectedSetup.exchange}</span>
              <span className={styles.timeframeBadge}>{timeframe}</span>
            </div>
            <p className={styles.setupDescription}>
              {
                isMarketPreview
                  ? 'Рыночный обзор · сетап ещё не сформирован'
                  : `${selectedSetup.kind} · зона ${chartLevelLabel}`
              }
            </p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.priceBlock}>
            <span>{chartPriceHeading}</span>
            <strong>
              {formatChartPrice(chartCurrentPrice)}
            </strong>
            <em
              className={[
                styles.priceSource,
                styles[
                  `priceSource_${candleFreshness.tone}`
                ],
              ].join(' ')}
              title={
                [
                  candleFreshness.message,
                  chartUpdatedAtLabel,
                ].join(' ')
              }
            >
              {chartPriceSource}
            </em>
          </div>
          <div className={styles.headerActions}>
            {!isMarketPreview && (
              <button
                className={alertCreated ? styles.alertButtonActive : styles.secondaryButton}
                type="button"
                onClick={() => setAlertCreated((current) => !current)}
              >
                {alertCreated ? 'Алерт создан ✓' : 'Создать алерт'}
              </button>
            )}
            <button className={styles.primaryButton} type="button" onClick={() => setNoteOpen((current) => !current)}>
              {noteOpen ? 'Закрыть заметку' : 'Добавить заметку'}
            </button>
          </div>
        </div>
      </header>

      <div className={styles.workspaceGrid}>
        <div className={styles.leftColumn}>
          <article className={styles.chartPanel}>
            <div className={styles.panelToolbar}>
              <div className={styles.timeframeControl} aria-label="Таймфрейм графика">
                {(['1m', '5m', '15m'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={timeframe === value ? styles.timeframeActive : ''}
                    onClick={() => selectTimeframe(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className={styles.chartLegend}>
                {!isMarketPreview && (
                  <span>
                    <i className={styles.levelLegend} />
                    {' '}
                    Уровень {chartLevelLabel}
                  </span>
                )}
                <span>
                  <i className={styles.priceLegend} />
                  {' '}
                  Цена {formatChartPrice(chartCurrentPrice)}
                </span>
                <span
                  className={[
                    styles.freshnessBadge,
                    styles[
                      `freshnessBadge_${candleFreshness.tone}`
                    ],
                  ].join(' ')}
                  title={
                    [
                      candleFreshness.message,
                      chartUpdatedAtLabel,
                    ].join(' ')
                  }
                  aria-live="polite"
                >
                  <i />
                  {candleFreshness.label}
                  {' · '}
                  {
                    candleFreshness
                      .lastUpdatedLabel
                  }
                </span>
                <span
                  className={[
                    styles.liveIndicator,
                    styles[`liveIndicator_${realtimeWorkspace.connectionTone}`],
                  ].join(' ')}
                >
                  <i /> {realtimeWorkspace.connectionLabel}
                </span>
              </div>
            </div>

            <div className={styles.chartCanvas}>
              {!hasCandleData
                && (
                  candleFreshness.state
                    === 'error'
                  || candleFreshness.state
                    === 'offline'
                ) && (
                  <div
                    className={[
                      styles.chartState,
                      styles.chartStateError,
                    ].join(' ')}
                  >
                    <strong>
                      {candleFreshness.label}
                    </strong>
                    <span>
                      {candleFreshness.message}
                    </span>
                    <button
                      type="button"
                      onClick={candlesQuery.retry}
                    >
                      Повторить
                    </button>
                  </div>
                )}

              {!hasCandleData
                && candleFreshness.state
                  === 'collecting'
                && candlesQuery.status
                  !== 'success' && (
                  <div className={styles.chartState}>
                    <strong>COLLECTING</strong>
                    <span>
                      {candleFreshness.message}
                    </span>
                  </div>
                )}

              {!hasCandleData
                && candlesQuery.status
                  === 'success'
                && candleFreshness.state
                  === 'collecting' && (
                  <div className={styles.chartState}>
                    Для выбранного периода нет свечей.
                  </div>
                )}

              {candlesQuery.data
                && candlesQuery.data.length > 0 && (
                  <>
                    {candleFreshness.state
                      === 'stale' && (
                        <div
                          className={
                            styles.chartFreshnessNotice
                          }
                          role="status"
                        >
                          <strong>STALE</strong>
                          <span>
                            {candleFreshness.message}
                            {' '}
                            {
                              candleFreshness
                                .lastUpdatedLabel
                            }
                            {' · '}
                            {chartUpdatedAtLabel}
                          </span>
                          <button
                            type="button"
                            onClick={
                              candlesQuery.retry
                            }
                          >
                            Обновить
                          </button>
                        </div>
                      )}

                    <NexusCandlestickChart
                      candles={candlesQuery.data}
                      symbol={contractSetup.symbol}
                      fillContainer
                      priceLines={chartPriceLines}
                      showSeriesPriceLine={false}
                      enableDrawingTools
                      drawingScope={`${contractSetup.symbol}:${timeframe}`}
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
                  </>
                )}
            </div>

            <div className={styles.chartMetrics}>
              {
                isMarketPreview
                  ? (
                    <>
                      <div>
                        <span>Режим</span>
                        <strong>
                          Рыночный обзор
                        </strong>
                      </div>
                      <div>
                        <span>Сетап</span>
                        <strong>
                          Не обнаружен
                        </strong>
                      </div>
                      <div>
                        <span>Свечи</span>
                        <strong>
                          Binance
                        </strong>
                      </div>
                      <div>
                        <span>Realtime</span>
                        <strong>
                          {
                            realtimeWorkspace
                              .connectionLabel
                          }
                        </strong>
                      </div>
                    </>
                  )
                  : (
                    <>
                      <div>
                        <span>До уровня</span>
                        <strong className={styles.warningValue}>
                          {selectedSetup.distanceLabel}
                        </strong>
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
                        <span>Откаты</span>
                        <strong>{selectedSetup.pullbackDepth}</strong>
                      </div>
                      <div>
                        <span>Объём</span>
                        <strong>
                          {
                            volumeAnomaly
                            === null
                              ? '—'
                              : volumeAnomaly
                                  .toFixed(2)
                                + '×'
                          }
                        </strong>
                      </div>
                      <div>
                        <span>Сделки</span>
                        <strong>
                          {
                            tradesAnomaly
                            === null
                              ? '—'
                              : tradesAnomaly
                                  .toFixed(2)
                                + '×'
                          }
                        </strong>
                      </div>
                      <div>
                        <span>Сила к BTC</span>
                        <strong
                          className={
                            btcStrengthValue
                            === null
                              ? ''
                              : btcStrengthValue >= 0
                                ? styles.positive
                                : styles.negative
                          }
                        >
                          {
                            btcStrengthValue
                            === null
                              ? '—'
                              : selectedSetup.btcStrengthLabel
                          }
                        </strong>
                      </div>
                    </>
                  )
              }
            </div>
          </article>

          {
            isMarketPreview
              ? (
          <div className={styles.lowerGrid}>
            <article className={styles.dataPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>
                    Поток сделок
                  </p>
                  <h2>Лента принтов</h2>
                </div>
                <span className={styles.estimateBadge}>
                  НЕ ПОДКЛЮЧЕНО
                </span>
              </div>
              <p className={styles.testNotice}>
                Реальная лента принтов для произвольной монеты
                в Workspace ещё не подключена.
              </p>
            </article>

            <article className={styles.dataPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>
                    Значимые плотности
                  </p>
                  <h2>Карта ликвидности</h2>
                </div>
                <span className={styles.estimateBadge}>
                  НЕ ПОДКЛЮЧЕНО
                </span>
              </div>
              <p className={styles.testNotice}>
                Плотности и изменения стакана не показываются,
                пока для монеты не сформирован реальный сетап.
              </p>
            </article>

            <article className={styles.dataPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>
                    Контекст
                  </p>
                  <h2>Динамика рынка</h2>
                </div>
                <span className={styles.marketMode}>
                  ОЖИДАНИЕ ДАННЫХ
                </span>
              </div>
              <p className={styles.testNotice}>
                Торговая оценка, давление и BTC-контекст
                для этого режима ещё не рассчитаны.
              </p>
            </article>
          </div>
                )
              : (
          <div className={styles.lowerGrid}>
            <article className={styles.dataPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Поток сделок</p>
                  <h2>Лента принтов</h2>
                </div>
                <div className={styles.tapeFilters}>
                  {(['all', 'buy', 'sell'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={tapeFilter === value ? styles.tapeFilterActive : ''}
                      onClick={() => setTapeFilter(value)}
                    >
                      {value === 'all' ? 'Все' : value === 'buy' ? 'Покупки' : 'Продажи'}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.tapeSummary}>
                <span>
                  Скорость{' '}
                  <strong>
                    {
                      isRuntimeSetup
                        ? '—'
                        : '42 сделки/с'
                    }
                  </strong>
                </span>

                <span>
                  Дельта{' '}
                  <strong className={styles.positive}>
                    {
                      isRuntimeSetup
                        ? '—'
                        : '+$184K'
                    }
                  </strong>
                </span>
              </div>

              <div className={styles.tapeTable}>
                <div className={styles.tapeHeader}><span>Время</span><span>Цена</span><span>Размер</span><span>Сумма</span></div>
                {visiblePrints.map((print) => (
                  <div key={print.id} className={`${styles.tapeRow} ${print.side === 'buy' ? styles.buyRow : styles.sellRow}`}>
                    <span>{print.time}</span>
                    <strong>{Number.isFinite(numericPrice) ? formatPrice(numericPrice * (Number(print.price) / WORKSPACE_REFERENCE_PRICE)) : print.price}</strong>
                    <span>{print.size.replace('SOL', baseAsset)}</span>
                    <span>{print.value}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.dataPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Значимые плотности</p>
                  <h2>Карта ликвидности</h2>
                </div>
                <span className={styles.estimateBadge}>
                  {
                    isRuntimeSetup
                      ? 'ДЕМО-КОНТЕКСТ'
                      : 'ОЦЕНКА NEXUS'
                  }
                </span>
              </div>

              <div className={styles.liquidityHeader}>
                <span>Цена</span><span>Размер</span><span>Возраст</span><span>Состояние</span><span>Исполнено</span>
              </div>
              <div className={styles.liquidityMap}>
                {liquidity.slice(0, 5).map((level) => (
                  <div key={level.id} className={`${styles.liquidityRow} ${styles.sellerRow}`}>
                    <span className={styles.liquidityBar} style={{ width: `${level.intensity * 100}%` }} />
                    <strong>{mapReferencePrice(level.price)}</strong><span>{level.size}</span><span>{level.age}</span><span>{level.state}</span><span>{level.fillPercent}%</span>
                  </div>
                ))}
                <div className={styles.currentPriceDivider}><span>{chartPriceHeading.toLocaleUpperCase('ru-RU')}</span><strong>{formatChartPrice(chartCurrentPrice)}</strong></div>
                {liquidity.slice(5).map((level) => (
                  <div key={level.id} className={`${styles.liquidityRow} ${styles.buyerRow}`}>
                    <span className={styles.liquidityBar} style={{ width: `${level.intensity * 100}%` }} />
                    <strong>{mapReferencePrice(level.price)}</strong><span>{level.size}</span><span>{level.age}</span><span>{level.state}</span><span>{level.fillPercent}%</span>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.dataPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Контекст</p>
                  <h2>Динамика рынка</h2>
                </div>
                <span className={styles.marketMode}>
                  {
                    isRuntimeSetup
                      ? 'ДЕМО-КОНТЕКСТ'
                      : 'BTC: умеренно бычий'
                  }
                </span>
              </div>

              <div className={styles.dynamicsList}>
                {marketDynamics.map((metric) => (
                  <div key={metric.label} className={styles.dynamicMetric}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <em className={metric.tone === 'positive' ? styles.positive : styles.neutralValue}>{metric.change}</em>
                  </div>
                ))}
              </div>

              <div className={styles.pressureBlock}>
                <div className={styles.pressureHeader}><span>Баланс давления</span><strong>68 / 32</strong></div>
                <div className={styles.pressureTrack}><span style={{ width: '68%' }} /></div>
                <div className={styles.pressureLabels}><span>Покупатели</span><span>Продавцы</span></div>
              </div>
            </article>
          </div>
                )
          }

        </div>

        <aside className={styles.nexusPanel}>
          <div className={styles.nexusPanelHeader}>
            <div>
              <p className={styles.panelEyebrow}>
                Панель NEXUS
              </p>
              <h2>
                {
                  isMarketPreview
                    ? 'Рыночный обзор'
                    : 'Сетап под наблюдением'
                }
              </h2>
            </div>

            {!isMarketPreview && (
              <SetupStageBadge
                stage={selectedSetup.stage}
                resultLabel={resultLabel}
              />
            )}
          </div>

          {
            isMarketPreview
              ? (
                <>
                  <section className={styles.nexusSection}>
                    <div className={styles.sectionTitle}>
                      <h3>Сетап не обнаружен</h3>
                      <span>MARKET</span>
                    </div>
                    <p className={styles.testNotice}>
                      Монета открыта из Market Scanner.
                      NEXUS не обнаружил для неё подтверждённый
                      торговый сетап, поэтому направление,
                      уровень и стадия не показываются.
                    </p>
                  </section>

                  <section className={styles.nexusSection}>
                    <div className={styles.sectionTitle}>
                      <h3>Доступно сейчас</h3>
                      <span>LIVE</span>
                    </div>
                    <ul className={styles.reasonList}>
                      <li>Реальные свечи Binance Futures.</li>
                      <li>Цена со статусом свежести и realtime-подключение.</li>
                      <li>Инструменты ручного анализа графика.</li>
                    </ul>
                  </section>
                </>
              )
              : (
                <>
                  <div className={styles.stageFlow}>
                    {displayedStageFlow.map((stage, index) => {
                      const status =
                        index < currentStageIndex
                          ? styles.stageComplete
                          : index === currentStageIndex
                            ? styles.stageCurrent
                            : styles.stagePending;

                      return (
                        <div
                          key={stage.id}
                          className={
                            `${styles.stageItem} ${status}`
                          }
                        >
                          <span className={styles.stageNumber}>
                            {index + 1}
                          </span>
                          <div>
                            <strong>{stage.label}</strong>
                            <small>{stage.description}</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <section className={styles.nexusSection}>
                    <div className={styles.sectionTitle}>
                      <h3>Почему в Scanner</h3>
                      <span>{selectedSetup.reasons.length}</span>
                    </div>
                    <ul className={styles.reasonList}>
                      {selectedSetup.reasons.map(
                        (reason) => (
                          <li key={reason}>
                            {reason}
                          </li>
                        ),
                      )}
                    </ul>
                  </section>

                  <section className={styles.nexusSection}>
                    <div className={styles.sectionTitle}>
                      <h3>Чек-лист сетапа</h3>
                      <span>
                        {checklistPassedCount}
                        {' / '}
                        {workspaceChecklist.length}
                      </span>
                    </div>
                    <div className={styles.checklist}>
                      {workspaceChecklist.map(
                        (item) => (
                          <div
                            key={item.id}
                            className={
                              `${styles.checkItem} ${styles[item.state]}`
                            }
                          >
                            <span className={styles.checkIcon}>
                              <ChecklistIcon state={item.state} />
                            </span>
                            <div>
                              <strong>{item.label}</strong>
                              <small>{item.detail}</small>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </section>
                </>
              )
          }

          {noteOpen && (
            <section className={styles.noteEditor}>
              <label htmlFor="workspace-note">
                {
                  isMarketPreview
                    ? 'Заметка к рыночному обзору'
                    : 'Заметка к сетапу'
                }
              </label>
              <textarea
                id="workspace-note"
                placeholder={
                  isMarketPreview
                    ? 'Запишите собственное наблюдение по монете…'
                    : 'Например: дождаться закрепления и повторного теста зоны…'
                }
              />
              <button
                type="button"
                onClick={() => setNoteOpen(false)}
              >
                Сохранить заметку
              </button>
            </section>
          )}

          {!isMarketPreview && (
            <div className={styles.nexusActions}>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => setAlertCreated(true)}
              >
                {
                  alertCreated
                    ? 'Алерт активен ✓'
                    : 'Создать алерт'
                }
              </button>

              <Link
                className={styles.secondaryLink}
                to={buildReplayUrl(
                  ROUTES.replay,
                  {
                    setupId:
                      contractSetup.id,

                    symbol:
                      contractSetup.symbol,

                    preset,
                    scannerWindow,
                    timeframe,
                  },
                )}
              >
                Открыть в Replay
              </Link>

              <button
                className={styles.externalButton}
                type="button"
                title="Интеграция с внешним терминалом будет подключена отдельным этапом"
              >
                Внешний терминал ↗
              </button>
            </div>
          )}

          <p className={styles.testNotice}>
            {
              isMarketPreview
                ? 'Рыночный режим не является торговым сигналом. NEXUS не выставляет ордера.'
                : usesDemoWorkspaceContext
                  ? 'Сетап, стадия и ценовая зона получены из Setup Engine. Лента и ликвидность пока демонстрационные. NEXUS не выставляет ордера.'
                  : 'Данные демонстрационные. NEXUS не выставляет ордера.'
            }
          </p>
        </aside>
      </div>
    </section>
  );
}


export function WorkspacePage() {
  const [searchParams] = useSearchParams();
  const requestedSetupId = searchParams.get('setupId') ?? searchParams.get('setup') ?? '';
  const requestedSymbol = searchParams.get('symbol')?.toUpperCase() ?? '';
  const query = useApiQuery(
    `workspace-context:${requestedSetupId}:${requestedSymbol}`,
    async (): Promise<WorkspacePageData | null> => {
      const shouldPreferRuntimeSetup =
        isMarketWorkspaceSetupId(
          requestedSetupId,
        )
        && requestedSymbol.length > 0;

      const runtimeView =
        shouldPreferRuntimeSetup
          ? await nexusApi.getWorkspaceView(
              null,
              requestedSymbol,
            )
          : null;

      const primaryView =
        runtimeView
        ?? await nexusApi.getWorkspaceView(
          requestedSetupId || null,
          requestedSymbol || null,
        );

      const marketFallbackSetupId =
        requestedSymbol
          ? buildMarketWorkspaceSetupId(
              requestedSymbol,
            )
          : null;

      const view =
        primaryView
        ?? (
          marketFallbackSetupId
            ? await nexusApi.getWorkspaceView(
                marketFallbackSetupId,
                requestedSymbol,
              )
            : null
        );

      if (!view) {
        return null;
      }

      const resolvedSetupId =
        view.selectedSetup.id;

      const [
        contractSetup,
        snapshot,
      ] = await Promise.all([
        nexusApi.getSetupById(
          resolvedSetupId,
        ),

        nexusApi.getWorkspaceSnapshot(
          resolvedSetupId,
        ),
      ]);

      if (
        !contractSetup
        || !snapshot
      ) {
        return null;
      }

      return {
        contractSetup,
        snapshot,
        view,
      };
    },
    {
      preserveData:
        true,
    },
  );


  useSetupLifecycleRefresh({
    candidateId:
      requestedSetupId,

    enabled:
      requestedSetupId.length > 0
      && !requestedSetupId.startsWith(
        'market-',
      ),

    onEvent:
      query.retry,
  });

  if (query.status === 'loading') return <AsyncDataState state="loading" />;
  if (query.status === 'error') {
    return <AsyncDataState state="error" message={query.error?.message} onRetry={query.retry} />;
  }
  if (!query.data) {
    return <AsyncDataState state="empty" title="Сетап не найден" message="Проверьте Setup ID или вернитесь в Scanner." />;
  }

  return <WorkspacePageContent data={query.data} />;
}
