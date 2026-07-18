import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { useFeedbackPageContext } from '@/shared/feedback/FeedbackProvider';
import {
  getReplayStageView,
  nexusApi,
  useApiQuery,
  type ReplayViewCandle,
  type ReplayViewLiquidityLevel,
  type ReplayViewSession,
} from '@/shared/api';
import { AsyncDataState } from '@/shared/ui/AsyncDataState';
import { DirectionBadge } from '@/shared/ui/DirectionBadge';
import { SetupStageBadge } from '@/shared/ui/SetupStageBadge';
import styles from './ReplayPage.module.css';

type ReplaySpeed = 0.5 | 1 | 2 | 4;
type ReplayTab = 'detection' | 'result' | null;

const SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 4];
const CHART_WIDTH = 960;
const CHART_HEIGHT = 360;
const CHART_TOP = 24;
const CHART_BOTTOM = 292;
const VOLUME_TOP = 302;
const VOLUME_BOTTOM = 346;

const TIME_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC',
});

function formatPrice(value: number, reference: number) {
  if (reference >= 1000) {
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (reference >= 10) {
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function formatCompactMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    notation: 'compact',
    maximumFractionDigits: 1,
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatTime(value: string) {
  return TIME_FORMATTER.format(new Date(value));
}

function getStageIndex(frameIndex: number) {
  if (frameIndex < 5) return 0;
  if (frameIndex < 9) return 1;
  if (frameIndex < 13) return 2;
  return 3;
}

function getLiquidityState(
  level: ReplayViewLiquidityLevel,
  frameIndex: number,
  session: ReplayViewSession,
) {
  const phase = frameIndex / Math.max(session.candles.length - 1, 1);
  if (level.side === 'ask' && level.price <= session.levelHigh * 1.001) {
    if (phase > 0.76) return session.direction === 'long' ? 'Снята' : 'Увеличивается';
    if (phase > 0.5) return 'Исполняется';
  }
  if (level.side === 'bid' && level.price >= session.levelLow * 0.999) {
    if (phase > 0.7 && session.direction === 'short') return 'Исполняется';
  }
  if (phase > 0.62 && level.baseState === 'Увеличивается') return 'Уменьшается';
  return level.baseState;
}

function getExecutedPct(
  level: ReplayViewLiquidityLevel,
  frameIndex: number,
  session: ReplayViewSession,
) {
  const state = getLiquidityState(level, frameIndex, session);
  if (state === 'Снята') return null;
  if (state !== 'Исполняется') return Math.min(9, Math.round(frameIndex * 0.7));
  return Math.min(94, Math.round((frameIndex / (session.candles.length - 1)) * 100));
}

function ReplayChart({
  session,
  frameIndex,
}: {
  session: ReplayViewSession;
  frameIndex: number;
}) {
  const visibleCandles = session.candles.slice(0, frameIndex + 1);
  const allPrices = session.candles.flatMap((candle) => [candle.low, candle.high]);
  const minPrice = Math.min(...allPrices, session.levelLow) * 0.9985;
  const maxPrice = Math.max(...allPrices, session.levelHigh) * 1.0015;
  const priceRange = Math.max(maxPrice - minPrice, Number.EPSILON);
  const candleStep = CHART_WIDTH / session.candles.length;
  const candleWidth = Math.max(5, candleStep * 0.52);
  const currentCandle = visibleCandles.at(-1) ?? session.candles[0];
  const currentX = Math.min(CHART_WIDTH, (frameIndex + 1) * candleStep);
  const maxVolume = Math.max(...session.candles.map((candle) => candle.volume));

  const mapY = (price: number) => (
    CHART_BOTTOM - ((price - minPrice) / priceRange) * (CHART_BOTTOM - CHART_TOP)
  );

  const zoneTop = mapY(session.levelHigh);
  const zoneBottom = mapY(session.levelLow);

  return (
    <div className={styles.chartCanvas}>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Replay графика ${session.symbol}. Будущие свечи скрыты.`}
      >
        <defs>
          <pattern id="replay-future-pattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="12" className={styles.futurePatternLine} />
          </pattern>
        </defs>

        <g className={styles.gridLines}>
          {[72, 128, 184, 240, 296].map((y) => (
            <line key={`h-${y}`} x1="0" x2={CHART_WIDTH} y1={y} y2={y} />
          ))}
          {[160, 320, 480, 640, 800].map((x) => (
            <line key={`v-${x}`} x1={x} x2={x} y1="0" y2={CHART_HEIGHT} />
          ))}
        </g>

        <rect
          x="0"
          y={Math.min(zoneTop, zoneBottom)}
          width={CHART_WIDTH}
          height={Math.max(8, Math.abs(zoneBottom - zoneTop))}
          className={styles.levelZone}
        />
        <line x1="0" x2={CHART_WIDTH} y1={zoneTop} y2={zoneTop} className={styles.levelLine} />
        <text x="12" y={Math.max(18, zoneTop - 8)} className={styles.levelLabel}>
          ЗОНА УРОВНЯ
        </text>

        <g className={styles.volumeBars}>
          {visibleCandles.map((candle, index) => {
            const height = (candle.volume / maxVolume) * (VOLUME_BOTTOM - VOLUME_TOP);
            return (
              <rect
                key={`volume-${candle.timestamp}`}
                x={index * candleStep + candleStep * 0.22}
                y={VOLUME_BOTTOM - height}
                width={candleWidth}
                height={height}
                rx="2"
                className={candle.close >= candle.open ? styles.volumeLong : styles.volumeShort}
              />
            );
          })}
        </g>

        <g>
          {visibleCandles.map((candle, index) => {
            const x = index * candleStep + candleStep / 2;
            const openY = mapY(candle.open);
            const closeY = mapY(candle.close);
            const highY = mapY(candle.high);
            const lowY = mapY(candle.low);
            const isLong = candle.close >= candle.open;
            return (
              <g key={candle.timestamp} className={isLong ? styles.candleLong : styles.candleShort}>
                <line x1={x} x2={x} y1={highY} y2={lowY} className={styles.candleWick} />
                <rect
                  x={x - candleWidth / 2}
                  y={Math.min(openY, closeY)}
                  width={candleWidth}
                  height={Math.max(3, Math.abs(closeY - openY))}
                  rx="1.5"
                  className={styles.candleBody}
                />
              </g>
            );
          })}
        </g>

        <rect
          x={currentX}
          y="0"
          width={Math.max(0, CHART_WIDTH - currentX)}
          height={CHART_HEIGHT}
          fill="url(#replay-future-pattern)"
          className={styles.futureMask}
        />
        {currentX < CHART_WIDTH - 70 && (
          <text x={currentX + 18} y="44" className={styles.futureLabel}>
            БУДУЩИЕ ДАННЫЕ СКРЫТЫ
          </text>
        )}

        <line x1={currentX} x2={currentX} y1="0" y2={CHART_HEIGHT} className={styles.playheadLine} />
        <line
          x1="0"
          x2={currentX}
          y1={mapY(currentCandle.close)}
          y2={mapY(currentCandle.close)}
          className={styles.currentPriceLine}
        />
        <g transform={`translate(${Math.max(0, currentX - 98)} ${mapY(currentCandle.close) - 14})`} className={styles.priceMarker}>
          <rect width="92" height="28" rx="5" />
          <text x="46" y="18">{formatPrice(currentCandle.close, session.candles[0].close)}</text>
        </g>
      </svg>

      <div className={styles.chartTimeAxis} aria-hidden="true">
        <span>{formatTime(session.candles[0].timestamp)}</span>
        <span>{formatTime(session.candles[Math.floor(session.candles.length * 0.25)].timestamp)}</span>
        <span>{formatTime(session.candles[Math.floor(session.candles.length * 0.5)].timestamp)}</span>
        <span>{formatTime(session.candles[Math.floor(session.candles.length * 0.75)].timestamp)}</span>
        <span>{formatTime(session.candles.at(-1)?.timestamp ?? session.endedAt)}</span>
      </div>
    </div>
  );
}

function ReplayMetrics({
  session,
  candle,
  frameIndex,
}: {
  session: ReplayViewSession;
  candle: ReplayViewCandle;
  frameIndex: number;
}) {
  const basePrice = session.candles[session.detectedFrameIndex].close;
  const movePct = ((candle.close - basePrice) / basePrice) * 100;
  const signedMove = session.direction === 'long' ? movePct : -movePct;
  const totalFrames = session.candles.length - 1;
  const volumeBaseline = session.candles.slice(0, 5).reduce((sum, item) => sum + item.volume, 0) / 5;
  const tradesBaseline = session.candles.slice(0, 5).reduce((sum, item) => sum + item.tradesCount, 0) / 5;

  return (
    <div className={styles.metricGrid}>
      <div><span>Текущая цена</span><strong>{formatPrice(candle.close, session.candles[0].close)}</strong></div>
      <div><span>Движение</span><strong className={signedMove >= 0 ? styles.positive : styles.negative}>{signedMove >= 0 ? '+' : ''}{signedMove.toFixed(2)}%</strong></div>
      <div><span>Объём</span><strong>{(candle.volume / volumeBaseline).toFixed(2)}×</strong></div>
      <div><span>Сделки</span><strong>{(candle.tradesCount / tradesBaseline).toFixed(2)}×</strong></div>
      <div><span>Кадр</span><strong>{frameIndex + 1} / {totalFrames + 1}</strong></div>
      <div><span>UTC</span><strong>{formatTime(candle.timestamp)}</strong></div>
    </div>
  );
}

function ReplayPageContent({ session }: { session: ReplayViewSession }) {
  const [frameIndex, setFrameIndex] = useState(session.detectedFrameIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const [activeTab, setActiveTab] = useState<ReplayTab>('detection');

  useFeedbackPageContext({
    screen: 'Replay',
    symbol: session.symbol,
    timeframe: session.timeframe,
    setupId: session.setupId,
    replayId: session.id,
  });

  const lastFrameIndex = session.candles.length - 1;
  const currentCandle = session.candles[frameIndex] ?? session.candles[0];
  const stage = getReplayStageView(frameIndex);
  const stageIndex = getStageIndex(frameIndex);
  const visiblePrints = session.prints
    .filter((print) => print.frameIndex <= frameIndex)
    .slice(-8)
    .reverse();
  const visibleLiquidity = session.liquidity.filter((level) => level.visibleFrom <= frameIndex);
  const visibleEvents = session.events.filter((event) => event.frameIndex <= frameIndex).slice().reverse();

  useEffect(() => {
    setFrameIndex(session.detectedFrameIndex);
    setIsPlaying(false);
    setActiveTab('detection');
  }, [session]);

  useEffect(() => {
    if (frameIndex === lastFrameIndex) {
      setActiveTab('result');
      return;
    }

    if (frameIndex === session.detectedFrameIndex) {
      setActiveTab('detection');
      return;
    }

    setActiveTab(null);
  }, [frameIndex, lastFrameIndex, session.detectedFrameIndex]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    if (frameIndex >= lastFrameIndex) {
      setIsPlaying(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setFrameIndex((current) => Math.min(lastFrameIndex, current + 1));
    }, 900 / speed);

    return () => window.clearTimeout(timer);
  }, [frameIndex, isPlaying, lastFrameIndex, speed]);

  const selectDetection = () => {
    setIsPlaying(false);
    setFrameIndex(session.detectedFrameIndex);
    setActiveTab('detection');
  };

  const selectResult = () => {
    setIsPlaying(false);
    setFrameIndex(lastFrameIndex);
    setActiveTab('result');
  };

  const stepBackward = () => {
    setIsPlaying(false);
    setFrameIndex((current) => Math.max(0, current - 1));
  };

  const stepForward = () => {
    setIsPlaying(false);
    setFrameIndex((current) => Math.min(lastFrameIndex, current + 1));
  };

  const togglePlayback = () => {
    if (frameIndex >= lastFrameIndex) {
      setFrameIndex(0);
    }
    setActiveTab('detection');
    setIsPlaying((current) => !current);
  };

  const resetReplay = () => {
    setIsPlaying(false);
    setFrameIndex(0);
    setActiveTab('detection');
  };

  const stageLabels = [
    'Наблюдение',
    'Подход',
    'Подтверждение',
    session.setupKind === 'bounce' ? 'Отскок' : 'Пробой',
  ];

  return (
    <section className={styles.replayPage}>
      <header className={styles.pageHeader}>
        <div className={styles.headerIdentity}>
          <Link className={styles.backButton} to={ROUTES.marketHistory} aria-label="Вернуться в Market History">←</Link>
          <div>
            <p className={styles.eyebrow}>Историческое воспроизведение · тестовые данные</p>
            <div className={styles.symbolLine}>
              <h1>{session.symbol}</h1>
              <DirectionBadge direction={session.direction} />
              <span className={styles.exchangeBadge}>{session.exchange}</span>
              <span className={styles.timeframeBadge}>{session.timeframe}</span>
            </div>
            <p className={styles.subtitle}>{session.setupLabel} · зона {formatPrice(session.levelLow, session.candles[0].close)}–{formatPrice(session.levelHigh, session.candles[0].close)}</p>
          </div>
        </div>

        <div className={styles.headerResult}>
          <span>Итог Replay</span>
          <strong className={session.result === 'successful' ? styles.positive : styles.negative}>{session.resultLabel}</strong>
          <small>{session.result === 'successful' ? `+${session.maxMovePct.toFixed(2)}% макс.` : `${Math.abs(session.adverseMovePct).toFixed(2)}% против сценария`}</small>
        </div>
      </header>

      <section className={styles.playerPanel} aria-label="Управление Replay">
        <div className={styles.viewTabs}>
          <button type="button" className={activeTab === 'detection' ? styles.tabActive : ''} onClick={selectDetection}>
            На момент обнаружения
          </button>
          <button type="button" className={activeTab === 'result' ? styles.tabActive : ''} onClick={selectResult}>
            Результат
          </button>
        </div>

        <div className={styles.playbackControls}>
          <button type="button" onClick={resetReplay} title="В начало" aria-label="В начало">↺</button>
          <button type="button" onClick={stepBackward} disabled={frameIndex === 0} title="Шаг назад" aria-label="Шаг назад">‹</button>
          <button type="button" className={styles.playButton} onClick={togglePlayback} aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}>
            {isPlaying ? 'Ⅱ' : '▶'}
          </button>
          <button type="button" onClick={stepForward} disabled={frameIndex === lastFrameIndex} title="Шаг вперёд" aria-label="Шаг вперёд">›</button>
        </div>

        <div className={styles.timelineControl}>
          <span>{formatTime(session.candles[0].timestamp)}</span>
          <input
            type="range"
            min="0"
            max={lastFrameIndex}
            value={frameIndex}
            onChange={(event) => {
              setIsPlaying(false);
              setActiveTab('detection');
              setFrameIndex(Number(event.target.value));
            }}
            aria-label="Позиция Replay"
          />
          <span>{formatTime(session.endedAt)}</span>
        </div>

        <div className={styles.speedControl} aria-label="Скорость Replay">
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              className={speed === value ? styles.speedActive : ''}
              onClick={() => setSpeed(value)}
            >
              {value}×
            </button>
          ))}
        </div>
      </section>

      <div className={styles.replayGrid}>
        <div className={styles.leftColumn}>
          <article className={styles.chartPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelEyebrow}>График и объём</p>
                <h2>История без будущих данных</h2>
              </div>
              <div className={styles.chartLegend}>
                <span><i className={styles.levelLegend} /> Уровень</span>
                <span><i className={styles.priceLegend} /> Текущая цена</span>
                <span className={styles.replayIndicator}><i /> REPLAY</span>
              </div>
            </div>
            <ReplayChart session={session} frameIndex={frameIndex} />
            <ReplayMetrics session={session} candle={currentCandle} frameIndex={frameIndex} />
          </article>

          <div className={styles.marketPanels}>
            <article className={styles.printsPanel}>
              <div className={styles.compactPanelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Поток сделок</p>
                  <h2>Лента принтов</h2>
                </div>
                <span>{visiblePrints.length} последних</span>
              </div>
              <div className={styles.tableHeadPrints}>
                <span>Время</span>
                <span>Цена</span>
                <span>Размер</span>
                <span>Сумма</span>
              </div>
              <div className={styles.printRows}>
                {visiblePrints.map((print) => (
                  <div key={print.id} className={`${styles.printRow} ${print.side === 'buy' ? styles.printBuy : styles.printSell}`}>
                    <span>{formatTime(print.timestamp)}</span>
                    <strong>{formatPrice(print.price, session.candles[0].close)}</strong>
                    <span>{print.quantity.toLocaleString('ru-RU')} {session.symbol.replace('USDT', '')}</span>
                    <span>{formatCompactMoney(print.quoteValue)}{print.isLarge ? ' · КРУПНЫЙ' : ''}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.liquidityPanel}>
              <div className={styles.compactPanelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Значимые плотности</p>
                  <h2>Карта ликвидности</h2>
                </div>
                <span>Оценка NEXUS</span>
              </div>
              <div className={styles.tableHeadLiquidity}>
                <span>Цена</span>
                <span>Размер</span>
                <span>Состояние</span>
                <span>Исполнено</span>
              </div>
              <div className={styles.liquidityRows}>
                {visibleLiquidity.map((level) => {
                  const state = getLiquidityState(level, frameIndex, session);
                  const executedPct = getExecutedPct(level, frameIndex, session);
                  return (
                    <div key={level.id} className={`${styles.liquidityRow} ${level.side === 'ask' ? styles.liquidityAsk : styles.liquidityBid}`}>
                      <strong>{formatPrice(level.price, session.candles[0].close)}</strong>
                      <span>{formatCompactMoney(level.quoteValue)}</span>
                      <span>{state}</span>
                      <span>{executedPct === null ? 'оценка недоступна' : `${executedPct}%`}</span>
                    </div>
                  );
                })}
              </div>
              <p className={styles.confidenceNote}>Состояния «исполняется» и процент исполнения являются оценкой, а не точным фактом.</p>
            </article>
          </div>
        </div>

        <aside className={styles.nexusPanel} aria-label="Состояние NEXUS в Replay">
          <section className={styles.nexusSection}>
            <div className={styles.nexusHeader}>
              <div>
                <p className={styles.panelEyebrow}>Панель NEXUS</p>
                <h2>Состояние в кадре</h2>
              </div>
              <SetupStageBadge
                stage={stage}
                resultLabel={session.setupKind === 'bounce' ? 'Отскок' : 'Пробой'}
              />
            </div>

            <div className={styles.stageFlow}>
              {stageLabels.map((label, index) => (
                <div key={label} className={`${styles.stageStep} ${index < stageIndex ? styles.stagePassed : ''} ${index === stageIndex ? styles.stageCurrent : ''}`}>
                  <span>{index + 1}</span>
                  <small>{label}</small>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.nexusSection}>
            <div className={styles.sectionTitleRow}>
              <h3>События Replay</h3>
              <span>{visibleEvents.length}</span>
            </div>
            <div className={styles.eventList}>
              {visibleEvents.map((event) => (
                <article key={event.id} className={`${styles.eventItem} ${styles[`event_${event.tone}`]}`}>
                  <div>
                    <strong>{event.title}</strong>
                    <span>{formatTime(event.timestamp)} UTC</span>
                  </div>
                  <p>{event.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.nexusSection}>
            <p className={styles.panelEyebrow}>Снимок контекста</p>
            <div className={styles.snapshotGrid}>
              <div><span>Сетап</span><strong>{session.setupLabel}</strong></div>
              <div><span>ID сетапа</span><strong>{session.setupId}</strong></div>
              <div><span>Обнаружен</span><strong>{formatTime(session.detectedAt)} UTC</strong></div>
              <div><span>Касания</span><strong>3</strong></div>
              <div><span>Сила к BTC</span><strong className={session.direction === 'long' ? styles.positive : styles.negative}>{session.direction === 'long' ? '+2.7%' : '-1.9%'}</strong></div>
              <div><span>Корреляция BTC</span><strong>0.82</strong></div>
            </div>
          </section>

          <section className={styles.resultCard}>
            <p className={styles.panelEyebrow}>Результат сессии</p>
            <h3>{session.result === 'successful' ? 'Сценарий реализован' : 'Сценарий не реализован'}</h3>
            <p>
              {session.result === 'successful'
                ? `Максимальное движение после реализации составило +${session.maxMovePct.toFixed(2)}%.`
                : `Цена пошла против сценария на ${Math.abs(session.adverseMovePct).toFixed(2)}%.`}
            </p>
            <button
              type="button"
              onClick={selectResult}
              disabled={frameIndex === lastFrameIndex}
            >
              {frameIndex === lastFrameIndex ? 'Результат открыт ✓' : 'Перейти к результату →'}
            </button>
          </section>
        </aside>
      </div>
    </section>
  );
}


export function ReplayPage() {
  const [searchParams] = useSearchParams();
  const requestedSessionId = searchParams.get('session') ?? '';
  const query = useApiQuery(
    `replay-view:${requestedSessionId}`,
    () => nexusApi.getReplayView(requestedSessionId),
  );

  if (query.status === 'loading') return <AsyncDataState state="loading" />;
  if (query.status === 'error') {
    return <AsyncDataState state="error" message={query.error?.message} onRetry={query.retry} />;
  }
  if (!query.data) return <AsyncDataState state="empty" />;

  return <ReplayPageContent session={query.data} />;
}
