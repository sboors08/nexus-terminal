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
  nexusApi,
  useApiQuery,
  type PrintSide,
  type Setup,
  type WorkspaceSnapshot,
  type WorkspaceViewData,
} from '@/shared/api';
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

function WorkspaceChart({
  setupId,
  chartPath,
  areaPath,
  levelY,
  touchPoints,
  direction,
  price,
  priceY,
  axisLabels,
  showCurrentPrice,
}: {
  setupId: string;
  chartPath: string;
  areaPath: string;
  levelY: number;
  touchPoints: Array<{ x: number; y: number }>;
  direction: 'long' | 'short';
  price: string;
  priceY: number;
  axisLabels: string[];
  showCurrentPrice: boolean;
}) {
  const chartTone = direction === 'long' ? styles.chartLong : styles.chartShort;

  return (
    <div className={`${styles.chartCanvas} ${chartTone}`}>
      <svg viewBox="0 0 900 390" preserveAspectRatio="none" role="img" aria-label="Рабочий график выбранного сетапа">
        <defs>
          <linearGradient id={`workspace-area-${setupId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`workspace-volume-${setupId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        <g className={styles.chartGrid}>
          {[65, 130, 195, 260, 325].map((y) => <line key={`h-${y}`} x1="0" y1={y} x2="900" y2={y} />)}
          {[150, 300, 450, 600, 750].map((x) => <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="390" />)}
        </g>

        <rect className={styles.levelZone} x="0" y={levelY * 1.45 - 11} width="900" height="22" rx="3" />
        <line className={styles.levelLine} x1="0" y1={levelY * 1.45} x2="900" y2={levelY * 1.45} />
        <text className={styles.levelLabel} x="12" y={Math.max(18, levelY * 1.45 - 16)}>ЗОНА УРОВНЯ</text>

        <g className={styles.volumeBars}>
          {[44, 31, 54, 38, 63, 51, 78, 58, 89, 67, 106, 84, 126, 97, 148, 121, 171, 142, 194, 165, 218, 189, 246, 213, 276, 238, 304, 269].map((height, index) => (
            <rect
              key={`${height}-${index}`}
              x={index * 32 + 4}
              y={378 - height * 0.34}
              width="18"
              height={height * 0.34}
              rx="2"
              fill={`url(#workspace-volume-${setupId})`}
            />
          ))}
        </g>

        <g transform="scale(1.40625 1.45)">
          <path d={areaPath} fill={`url(#workspace-area-${setupId})`} />
          <path className={styles.chartLine} d={chartPath} fill="none" vectorEffect="non-scaling-stroke" />
          {touchPoints.map((point, index) => (
            <g key={`${point.x}-${point.y}`}>
              <circle className={styles.touchHalo} cx={point.x} cy={point.y} r="7" />
              <circle className={styles.touchPoint} cx={point.x} cy={point.y} r="3.2" />
              <text className={styles.touchLabel} x={point.x + 8} y={point.y - 9}>{index + 1}</text>
            </g>
          ))}
        </g>

        {showCurrentPrice && (
          <>
            <line
              className={styles.currentPriceLine}
              x1="0"
              y1={priceY}
              x2="900"
              y2={priceY}
            />
            <g
              className={styles.priceMarker}
              transform={`translate(810 ${priceY - 14})`}
            >
              <rect width="84" height="28" rx="5" />
              <text x="42" y="18">{price}</text>
            </g>
          </>
        )}
      </svg>

      <div className={styles.chartBottomAxis} aria-hidden="true">
        <span>14:00</span>
        <span>14:45</span>
        <span>15:30</span>
        <span>16:15</span>
        <span>17:00</span>
        <span>17:32</span>
      </div>
      <div className={styles.chartRightAxis} aria-hidden="true">
        {axisLabels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function ChecklistIcon({ state }: { state: 'passed' | 'warning' | 'waiting' }) {
  if (state === 'passed') return <span aria-hidden="true">✓</span>;
  if (state === 'warning') return <span aria-hidden="true">!</span>;
  return <span aria-hidden="true">·</span>;
}

function WorkspacePageContent({ data }: { data: WorkspacePageData }) {
  const { contractSetup, snapshot, view } = data;
  const { selectedSetup, prints, liquidity, marketDynamics, stageFlow } = view;
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTimeframe = searchParams.get('timeframe');
  const defaultTimeframe: Timeframe = isWorkspaceTimeframe(selectedSetup.timeframe) ? selectedSetup.timeframe : '5m';
  const timeframe: Timeframe = isWorkspaceTimeframe(requestedTimeframe) ? requestedTimeframe : defaultTimeframe;
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
    nextParams.set('timeframe', timeframe);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [contractSetup.id, contractSetup.symbol, searchParams, setSearchParams, timeframe]);

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
  const numericPrice = Number(selectedSetup.price.replace(/\s/g, ''));
  const priceDecimals = selectedSetup.price.includes('.') ? selectedSetup.price.split('.')[1].length : 2;
  const formatPrice = (value: number) => value.toLocaleString('ru-RU', {
    minimumFractionDigits: priceDecimals,
    maximumFractionDigits: priceDecimals,
  });
  const mapReferencePrice = (referencePrice: string) => {
    const ratio = Number(referencePrice) / 187.42;
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
      detail: `Ожидается подтверждение за границей зоны ${selectedSetup.level}.`,
      state: selectedSetup.stage === 'triggered' ? 'passed' : 'waiting',
    },
  ] as const;

  return (
    <section className={styles.workspace}>
      <header className={styles.pageHeader}>
        <div className={styles.instrumentHeader}>
          <Link className={styles.backLink} to={buildSetupSelectionUrl(ROUTES.scanner, contractSetup.id)} aria-label="Вернуться в Scanner">←</Link>
          <div>
            <p className={styles.eyebrow}>Рабочее пространство · тестовые данные</p>
            <div className={styles.symbolRow}>
              <h1>{selectedSetup.symbol}</h1>
              <DirectionBadge direction={selectedSetup.direction} />
              <span className={styles.exchangeBadge}>{selectedSetup.exchange}</span>
              <span className={styles.timeframeBadge}>{timeframe}</span>
            </div>
            <p className={styles.setupDescription}>{selectedSetup.kind} · зона {selectedSetup.level}</p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.priceBlock}>
            <span>Текущая цена</span>
            <strong>{realtimeWorkspace.priceLabel}</strong>
            <em
              className={
                realtimeWorkspace.isLive
                  ? styles.priceSourceLive
                  : styles.priceSourceTest
              }
            >
              {realtimeWorkspace.isLive
                ? `LIVE ? ${realtimeWorkspace.updatedAtLabel}`
                : 'TEST DATA'}
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
                <span><i className={styles.levelLegend} /> Уровень {selectedSetup.level}</span>
                <span><i className={styles.priceLegend} /> Цена {realtimeWorkspace.priceLabel}</span>
                <span
                  className={[
                    styles.liveIndicator,
                    styles[`liveIndicator_${realtimeWorkspace.connectionTone}`],
                  ].join(' ')}
                >
                  <i /> {realtimeWorkspace.connectionLabel}
                </span>
                {realtimeWorkspace.rangePosition !== 'inside'
                  && realtimeWorkspace.rangePosition !== 'unknown'
                  && (
                    <span className={styles.rangeWarning}>
                      LIVE-цена вне диапазона тестового графика
                    </span>
                  )}
              </div>
            </div>

            <WorkspaceChart
              setupId={selectedSetup.id}
              chartPath={selectedSetup.chartPath}
              areaPath={selectedSetup.areaPath}
              levelY={selectedSetup.levelY}
              touchPoints={selectedSetup.touchPoints}
              direction={selectedSetup.direction}
              price={realtimeWorkspace.priceLabel}
              priceY={realtimeWorkspace.priceY}
              axisLabels={realtimeWorkspace.axisLabels}
              showCurrentPrice={realtimeWorkspace.rangePosition === 'inside'}
            />

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
                <div className={styles.currentPriceDivider}><span>ТЕКУЩАЯ ЦЕНА</span><strong>{selectedSetup.price}</strong></div>
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
