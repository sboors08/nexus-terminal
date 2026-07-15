import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import {
  COMPLETED_SETUPS,
  HOT_SETUPS,
  RECENT_EVENTS,
  type DashboardSetup,
} from '@/features/dashboard/dashboardData';
import { DirectionBadge } from '@/shared/ui/DirectionBadge';
import { SetupStageBadge } from '@/shared/ui/SetupStageBadge';
import styles from './DashboardPage.module.css';

const EVENT_TONE_CLASS = {
  info: styles.eventInfo,
  approach: styles.eventApproach,
  confirmation: styles.eventConfirmation,
  long: styles.eventLong,
  short: styles.eventShort,
} as const;

function MiniTrend({ setup }: { setup: DashboardSetup }) {
  return (
    <svg className={styles.miniTrend} viewBox="0 0 96 32" role="img" aria-label={`Динамика ${setup.symbol}`}>
      <path
        d={setup.direction === 'long' ? 'M2 27 C14 24 18 17 29 20 C40 23 45 12 57 15 C69 18 75 7 94 5' : 'M2 5 C15 8 21 15 31 12 C43 9 49 21 60 18 C73 15 80 25 94 27'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SetupChart({ setup }: { setup: DashboardSetup }) {
  const trendClass = setup.direction === 'long' ? styles.chartLong : styles.chartShort;

  return (
    <div className={`${styles.chartCanvas} ${trendClass}`}>
      <div className={styles.chartYAxis} aria-hidden="true">
        <span>{setup.level.split('–')[1]}</span>
        <span>{setup.price}</span>
        <span>{setup.level.split('–')[0]}</span>
      </div>
      <svg viewBox="0 0 640 210" preserveAspectRatio="none" role="img" aria-label={`Быстрый график ${setup.symbol}`}>
        <defs>
          <linearGradient id={`area-${setup.id}`} x1="0" y1="0" x2="0" y2="1">
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
        <path d={setup.areaPath} fill={`url(#area-${setup.id})`} />
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
      <div className={styles.chartXAxis} aria-hidden="true">
        <span>14:00</span>
        <span>15:00</span>
        <span>16:00</span>
        <span>17:00</span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [selectedSetupId, setSelectedSetupId] = useState(HOT_SETUPS[0].id);
  const selectedSetup = useMemo(
    () => HOT_SETUPS.find((setup) => setup.id === selectedSetupId) ?? HOT_SETUPS[0],
    [selectedSetupId],
  );

  return (
    <section className={styles.dashboard}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Обзор рынка · тестовые данные</p>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Сетапы, которые ближе всего к реализации прямо сейчас.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.updatedAt}>Обновлено 17:32:08</span>
          <Link className={styles.primaryLink} to={ROUTES.scanner}>
            Открыть Scanner
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <div className={styles.marketSummary}>
        <article className={`${styles.panel} ${styles.btcModeCard}`}>
          <div className={styles.panelHeadingRow}>
            <div>
              <p className={styles.panelEyebrow}>BTC Market Mode</p>
              <h2 className={styles.marketMode}>Умеренно бычий</h2>
            </div>
            <span className={styles.marketModeBadge}>LONG BIAS</span>
          </div>
          <div className={styles.marketMetrics}>
            <div>
              <span className={styles.metricLabel}>BTCUSDT</span>
              <strong className={styles.metricValue}>67 842.6</strong>
              <span className={styles.positiveValue}>+2.36%</span>
            </div>
            <div>
              <span className={styles.metricLabel}>Доминирование</span>
              <strong className={styles.metricValue}>54.2%</strong>
              <span className={styles.neutralValue}>+0.18%</span>
            </div>
            <div>
              <span className={styles.metricLabel}>Ширина рынка</span>
              <strong className={styles.metricValue}>63 / 37</strong>
              <span className={styles.positiveValue}>Покупатели</span>
            </div>
            <div>
              <span className={styles.metricLabel}>Активных сетапов</span>
              <strong className={styles.metricValue}>18</strong>
              <span className={styles.neutralValue}>6 близко к уровню</span>
            </div>
          </div>
        </article>

        <article className={`${styles.panel} ${styles.activityCard}`}>
          <div className={styles.panelHeadingRow}>
            <div>
              <p className={styles.panelEyebrow}>Период активности</p>
              <h2 className={styles.activityTitle}>Высокая активность</h2>
            </div>
            <span className={styles.livePulse} aria-label="Активный период">
              LIVE
            </span>
          </div>
          <div className={styles.activityTimeline}>
            <span className={styles.timelineFill} />
            <span className={styles.timelineMarker} />
          </div>
          <div className={styles.timelineLabels}>
            <span>14:00</span>
            <strong>17:32</strong>
            <span>20:00 UTC</span>
          </div>
          <p className={styles.activityHint}>Объём 1.7× выше среднего. Количество сделок продолжает расти.</p>
        </article>
      </div>

      <div className={styles.primaryGrid}>
        <article className={`${styles.panel} ${styles.hotListPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Главный приоритет</p>
              <h2 className={styles.panelTitle}>Hot List</h2>
            </div>
            <span className={styles.panelCounter}>{HOT_SETUPS.length} сетапов</span>
          </div>

          <div className={styles.hotListHeader} aria-hidden="true">
            <span>Инструмент</span>
            <span>Сетап</span>
            <span>Стадия</span>
            <span>Касания</span>
            <span>Формирование</span>
            <span>До уровня</span>
            <span>Откаты</span>
            <span>Сила к BTC</span>
          </div>

          <div className={styles.hotList}>
            {HOT_SETUPS.map((setup) => {
              const isSelected = setup.id === selectedSetup.id;

              return (
                <button
                  key={setup.id}
                  type="button"
                  className={`${styles.hotRow} ${isSelected ? styles.hotRowSelected : ''}`}
                  onClick={() => setSelectedSetupId(setup.id)}
                  aria-pressed={isSelected}
                >
                  <span className={styles.instrumentCell}>
                    <span className={styles.coinMark}>{setup.symbol.slice(0, 1)}</span>
                    <span>
                      <strong>{setup.symbol}</strong>
                      <small>{setup.exchange} · {setup.timeframe}</small>
                    </span>
                    <MiniTrend setup={setup} />
                  </span>
                  <span className={styles.setupCell}>
                    <DirectionBadge direction={setup.direction} />
                    <span>{setup.kind}</span>
                  </span>
                  <span><SetupStageBadge stage={setup.stage} resultLabel={setup.kind.includes('Отскок') ? 'Отскок' : 'Пробой'} /></span>
                  <strong className={styles.monoValue}>{setup.touches}</strong>
                  <span className={styles.monoValue}>{setup.formationTime}</span>
                  <strong className={styles.distanceValue}>{setup.distance}</strong>
                  <span>{setup.pullbackDepth}</span>
                  <strong className={setup.direction === 'long' ? styles.positiveValue : styles.negativeValue}>{setup.btcStrength}</strong>
                </button>
              );
            })}
          </div>
        </article>

        <article className={`${styles.panel} ${styles.chartPanel}`}>
          <div className={styles.chartHeader}>
            <div>
              <div className={styles.symbolLine}>
                <h2>{selectedSetup.symbol}</h2>
                <DirectionBadge direction={selectedSetup.direction} />
                <span className={styles.timeframeBadge}>{selectedSetup.timeframe}</span>
              </div>
              <p>{selectedSetup.kind} · зона {selectedSetup.level}</p>
            </div>
            <div className={styles.priceBlock}>
              <strong>{selectedSetup.price}</strong>
              <span className={selectedSetup.direction === 'long' ? styles.positiveValue : styles.negativeValue}>{selectedSetup.priceChange}</span>
            </div>
          </div>

          <SetupChart setup={selectedSetup} />

          <div className={styles.chartStats}>
            <div>
              <span>До уровня</span>
              <strong>{selectedSetup.distance}</strong>
            </div>
            <div>
              <span>Объём</span>
              <strong>{selectedSetup.volumeAnomaly}</strong>
            </div>
            <div>
              <span>Сделки</span>
              <strong>{selectedSetup.tradesAnomaly}</strong>
            </div>
            <div>
              <span>Активность</span>
              <strong>{selectedSetup.activity}</strong>
            </div>
          </div>

          <Link className={styles.workspaceLink} to={ROUTES.workspace}>
            Открыть Workspace
            <span aria-hidden="true">→</span>
          </Link>
        </article>

      </div>

      <div className={styles.secondaryGrid}>
        <article className={`${styles.panel} ${styles.scannerPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Быстрый обзор</p>
              <h2 className={styles.panelTitle}>Краткий Scanner</h2>
            </div>
            <Link className={styles.textLink} to={ROUTES.scanner}>Полный список</Link>
          </div>
          <div className={styles.scannerTable}>
            <div className={styles.scannerHeader} aria-hidden="true">
              <span>Тикер</span>
              <span>Направление</span>
              <span>Тип сетапа</span>
              <span>Стадия</span>
              <span>До уровня</span>
              <span>Активность</span>
            </div>
            {HOT_SETUPS.slice(0, 4).map((setup) => (
              <div key={`scanner-${setup.id}`} className={styles.scannerRow}>
                <strong>{setup.symbol}</strong>
                <DirectionBadge direction={setup.direction} />
                <span>{setup.kind}</span>
                <SetupStageBadge stage={setup.stage} resultLabel={setup.kind.includes('Отскок') ? 'Отскок' : 'Пробой'} />
                <strong className={styles.distanceValue}>{setup.distance}</strong>
                <span className={styles.activityValue}>{setup.activity}</span>
              </div>
            ))}
          </div>
        </article>

        <article className={`${styles.panel} ${styles.eventsPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Изменения рынка</p>
              <h2 className={styles.panelTitle}>Последние события</h2>
            </div>
            <Link className={styles.textLink} to={ROUTES.alerts}>Все алерты</Link>
          </div>
          <div className={styles.eventList}>
            {RECENT_EVENTS.map((event) => (
              <div key={event.id} className={styles.eventItem}>
                <span className={`${styles.eventDot} ${EVENT_TONE_CLASS[event.tone]}`} aria-hidden="true" />
                <div>
                  <div className={styles.eventMeta}>
                    <strong>{event.symbol}</strong>
                    <time>{event.time}</time>
                  </div>
                  <p>{event.text}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className={`${styles.panel} ${styles.completedPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Недавний результат</p>
              <h2 className={styles.panelTitle}>Отработавшие сетапы</h2>
            </div>
            <Link className={styles.textLink} to={ROUTES.marketHistory}>История</Link>
          </div>
          <div className={styles.completedList}>
            {COMPLETED_SETUPS.map((setup) => (
              <div key={setup.id} className={styles.completedItem}>
                <div>
                  <div className={styles.completedSymbol}>
                    <strong>{setup.symbol}</strong>
                    <DirectionBadge direction={setup.direction} />
                  </div>
                  <p>{setup.kind}</p>
                </div>
                <div className={styles.completedResult}>
                  <span className={setup.result === 'Отработал' ? styles.resultSuccess : styles.resultCancelled}>{setup.result}</span>
                  <strong>{setup.movement}</strong>
                  <small>{setup.timeToTarget}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
