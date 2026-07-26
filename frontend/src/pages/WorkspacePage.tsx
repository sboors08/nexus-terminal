import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { useFeedbackPageContext } from '@/shared/feedback/FeedbackProvider';
import {
  buildWorkspaceRealtimeView,
  useRealtimeMarketData,
} from '@/shared/realtime';
import { buildReplayUrl, buildSetupSelectionUrl, isWorkspaceTimeframe } from '@/shared/routing/setupContext';
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

  const chartCurrentPrice =
    latestCandle?.close
    ?? contractSetup.currentPrice;

  const levelDistanceRatio =
    Math.abs(
      contractSetup.distanceToLevelPct,
    ) / 100;

  const chartLevelCenter =
    contractSetup.direction === 'short'
      ? chartCurrentPrice
        * (1 - levelDistanceRatio)
      : chartCurrentPrice
        * (1 + levelDistanceRatio);

  const originalLevelHalfWidthRatio =
    contractSetup.level.centerPrice > 0
      ? Math.max(
          contractSetup.level.centerPrice
            - contractSetup.level.zoneLow,
          contractSetup.level.zoneHigh
            - contractSetup.level.centerPrice,
        )
        / contractSetup.level.centerPrice
      : 0.0015;

  const chartZoneLow =
    chartLevelCenter
    * (1 - originalLevelHalfWidthRatio);

  const chartZoneHigh =
    chartLevelCenter
    * (1 + originalLevelHalfWidthRatio);

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
      () => [
        {
          price: chartZoneLow,
          color: '#d5a928',
          lineStyle: 'dashed',
          axisLabelVisible: false,
        },
        {
          price: chartLevelCenter,
          color: '#f0b90b',
          title: 'УРОВЕНЬ',
          lineStyle: 'solid',
        },
        {
          price: chartZoneHigh,
          color: '#d5a928',
          lineStyle: 'dashed',
          axisLabelVisible: false,
        },
        {
          price: chartCurrentPrice,
          color: '#4aa8ff',
          title: 'LAST',
          lineStyle: 'dashed',
        },
      ],
      [
        chartCurrentPrice,
        chartLevelCenter,
        chartZoneHigh,
        chartZoneLow,
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
  const baseAsset = selectedSetup.symbol.replace('USDT', '');
  const numericPrice = chartCurrentPrice;
  const priceDecimals = selectedSetup.price.includes('.') ? selectedSetup.price.split('.')[1].length : 2;
  const formatPrice = (value: number) => value.toLocaleString('ru-RU', {
    minimumFractionDigits: priceDecimals,
    maximumFractionDigits: priceDecimals,
  });
  const mapReferencePrice = (referencePrice: string) => {
    const ratio =
      Number(referencePrice)
      / contractSetup.currentPrice;
    return Number.isFinite(numericPrice) ? formatPrice(numericPrice * ratio) : referencePrice;
  };
  const workspaceChecklist = [
    {
      id: 'check-touches',
      label: 'Минимум 3 касания',
      detail: `Подтверждено касаний: ${selectedSetup.touches}.`,
      state: selectedSetup.touches >= 3 ? 'passed' : 'warning',
    },
    {
      id: 'check-pullbacks',
      label: 'Характер откатов',
      detail: `${selectedSetup.pullbackDepth} откаты возле найденной зоны.`,
      state: selectedSetup.pullbackDepth === 'Неглубокие' ? 'passed' : 'warning',
    },
    {
      id: 'check-activity',
      label: 'Активность выше средней',
      detail: `Объём ${selectedSetup.volumeAnomaly.toFixed(2)}×, сделки ${selectedSetup.tradesAnomaly.toFixed(2)}×.`,
      state: selectedSetup.volumeAnomaly >= 1.5 && selectedSetup.tradesAnomaly >= 1.5 ? 'passed' : 'warning',
    },
    {
      id: 'check-btc',
      label: 'BTC-контекст поддерживает',
      detail: `Сила относительно BTC: ${selectedSetup.btcStrengthLabel}, корреляция ${selectedSetup.btcCorrelation}.`,
      state: (selectedSetup.direction === 'long' && selectedSetup.btcStrength > 0)
        || (selectedSetup.direction === 'short' && selectedSetup.btcStrength < 0) ? 'passed' : 'warning',
    },
    {
      id: 'check-trigger',
      label: 'Поток принтов подтверждает вход',
      detail: 'Активность растёт, финальное подтверждение ещё формируется.',
      state: 'warning',
    },
    {
      id: 'check-result',
      label: `${resultLabel}: закрепление за зоной`,
      detail: `Ожидается подтверждение за границей зоны ${chartLevelLabel}.`,
      state: selectedSetup.stage === 'triggered' ? 'passed' : 'waiting',
    },
  ] as const;

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
            <p className={styles.eyebrow}>Рабочее пространство · тестовые данные</p>
            <div className={styles.symbolRow}>
              <h1>{selectedSetup.symbol}</h1>
              <DirectionBadge direction={selectedSetup.direction} />
              <span className={styles.exchangeBadge}>{selectedSetup.exchange}</span>
              <span className={styles.timeframeBadge}>{timeframe}</span>
            </div>
            <p className={styles.setupDescription}>{selectedSetup.kind} · зона {chartLevelLabel}</p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.priceBlock}>
            <span>Текущая цена</span>
            <strong>{formatChartPrice(chartCurrentPrice)}</strong>
            <em className={styles.priceSourceTest}>
              ПОСЛЕДНЯЯ СВЕЧА
            </em>
          </div>
          <div className={styles.headerActions}>
            <button
              className={alertCreated ? styles.alertButtonActive : styles.secondaryButton}
              type="button"
              onClick={() => setAlertCreated((current) => !current)}
            >
              {alertCreated ? 'Алерт создан ✓' : 'Создать алерт'}
            </button>
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
                <span><i className={styles.levelLegend} /> Уровень {chartLevelLabel}</span>
                <span><i className={styles.priceLegend} /> Цена {formatChartPrice(chartCurrentPrice)}</span>
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
              {candlesQuery.status === 'loading' && (
                <div className={styles.chartState}>
                  Загружаем реальные свечи…
                </div>
              )}

              {candlesQuery.status === 'error' && (
                <div className={styles.chartState}>
                  <span>Свечи не загрузились.</span>
                  <button
                    type="button"
                    onClick={candlesQuery.retry}
                  >
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
                )}
            </div>

            <div className={styles.chartMetrics}>
              <div><span>До уровня</span><strong className={styles.warningValue}>{selectedSetup.distanceLabel}</strong></div>
              <div><span>Касания</span><strong>{selectedSetup.touches}</strong></div>
              <div><span>Формирование</span><strong>{selectedSetup.formationLabel}</strong></div>
              <div><span>Откаты</span><strong>{selectedSetup.pullbackDepth}</strong></div>
              <div><span>Объём</span><strong>{selectedSetup.volumeAnomaly.toFixed(2)}×</strong></div>
              <div><span>Сделки</span><strong>{selectedSetup.tradesAnomaly.toFixed(2)}×</strong></div>
              <div><span>Сила к BTC</span><strong className={selectedSetup.btcStrength >= 0 ? styles.positive : styles.negative}>{selectedSetup.btcStrengthLabel}</strong></div>
            </div>
          </article>

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
                <span>Скорость <strong>42 сделки/с</strong></span>
                <span>Дельта <strong className={styles.positive}>+$184K</strong></span>
              </div>

              <div className={styles.tapeTable}>
                <div className={styles.tapeHeader}><span>Время</span><span>Цена</span><span>Размер</span><span>Сумма</span></div>
                {visiblePrints.map((print) => (
                  <div key={print.id} className={`${styles.tapeRow} ${print.side === 'buy' ? styles.buyRow : styles.sellRow}`}>
                    <span>{print.time}</span>
                    <strong>{Number.isFinite(numericPrice) ? formatPrice(numericPrice * (Number(print.price) / 187.42)) : print.price}</strong>
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
                <span className={styles.estimateBadge}>ОЦЕНКА NEXUS</span>
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
                <div className={styles.currentPriceDivider}><span>ТЕКУЩАЯ ЦЕНА</span><strong>{formatChartPrice(chartCurrentPrice)}</strong></div>
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
                <span className={styles.marketMode}>BTC: умеренно бычий</span>
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
        </div>

        <aside className={styles.nexusPanel}>
          <div className={styles.nexusPanelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Панель NEXUS</p>
              <h2>Сетап под наблюдением</h2>
            </div>
            <SetupStageBadge stage={selectedSetup.stage} resultLabel={resultLabel} />
          </div>

          <div className={styles.stageFlow}>
            {stageFlow.map((stage, index) => {
              const status = index < currentStageIndex ? styles.stageComplete : index === currentStageIndex ? styles.stageCurrent : styles.stagePending;
              return (
                <div key={stage.id} className={`${styles.stageItem} ${status}`}>
                  <span className={styles.stageNumber}>{index + 1}</span>
                  <div><strong>{stage.label}</strong><small>{stage.description}</small></div>
                </div>
              );
            })}
          </div>

          <section className={styles.nexusSection}>
            <div className={styles.sectionTitle}><h3>Почему в Scanner</h3><span>{selectedSetup.reasons.length}</span></div>
            <ul className={styles.reasonList}>
              {selectedSetup.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </section>

          <section className={styles.nexusSection}>
            <div className={styles.sectionTitle}><h3>Чек-лист сетапа</h3><span>4 / 6</span></div>
            <div className={styles.checklist}>
              {workspaceChecklist.map((item) => (
                <div key={item.id} className={`${styles.checkItem} ${styles[item.state]}`}>
                  <span className={styles.checkIcon}><ChecklistIcon state={item.state} /></span>
                  <div><strong>{item.label}</strong><small>{item.detail}</small></div>
                </div>
              ))}
            </div>
          </section>

          {noteOpen && (
            <section className={styles.noteEditor}>
              <label htmlFor="workspace-note">Заметка к сетапу</label>
              <textarea id="workspace-note" placeholder="Например: дождаться закрепления выше 188.42 и повторного теста зоны…" />
              <button type="button" onClick={() => setNoteOpen(false)}>Сохранить заметку</button>
            </section>
          )}

          <div className={styles.nexusActions}>
            <button className={styles.primaryButton} type="button" onClick={() => setAlertCreated(true)}>
              {alertCreated ? 'Алерт активен ✓' : 'Создать алерт'}
            </button>
            <Link className={styles.secondaryLink} to={buildReplayUrl(ROUTES.replay, {
              setupId: contractSetup.id,
              symbol: contractSetup.symbol,
              preset,
              scannerWindow,
              timeframe,
            })}>Открыть в Replay</Link>
            <button className={styles.externalButton} type="button" title="Интеграция с внешним терминалом будет подключена отдельным этапом">
              Внешний терминал ↗
            </button>
          </div>

          <p className={styles.testNotice}>Данные демонстрационные. NEXUS не выставляет ордера.</p>
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
      const view = await nexusApi.getWorkspaceView(requestedSetupId || null, requestedSymbol || null);
      if (!view) return null;

      const resolvedSetupId = requestedSetupId || view.selectedSetup.id;
      const [contractSetup, snapshot] = await Promise.all([
        nexusApi.getSetupById(resolvedSetupId),
        nexusApi.getWorkspaceSnapshot(resolvedSetupId),
      ]);

      if (!contractSetup || !snapshot) return null;
      return { contractSetup, snapshot, view };
    },
  );

  if (query.status === 'loading') return <AsyncDataState state="loading" />;
  if (query.status === 'error') {
    return <AsyncDataState state="error" message={query.error?.message} onRetry={query.retry} />;
  }
  if (!query.data) {
    return <AsyncDataState state="empty" title="Сетап не найден" message="Проверьте Setup ID или вернитесь в Scanner." />;
  }

  return <WorkspacePageContent data={query.data} />;
}
