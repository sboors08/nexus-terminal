import {
  type FormEvent,
  useMemo,
  useState,
} from 'react';

import {
  fetchLevelLines,
  LEVEL_LINES_TIMEFRAMES,
  type LevelLine,
  type LevelLinesTimeframe,
} from '@/shared/api/runtime/levelLinesApi';
import {
  useApiQuery,
} from '@/shared/api/useApiQuery';
import {
  NexusCandlestickChart,
  type NexusChartHorizontalSegment,
} from '@/shared/charts';

import styles from './LevelPreviewPage.module.css';

const LEVEL_COLORS = {
  support:
    '#32d583',
  resistance:
    '#ff6273',
  brokenSupport:
    'rgba(50, 213, 131, 0.45)',
  brokenResistance:
    'rgba(255, 98, 115, 0.45)',
} as const;

const CHART_WINDOW_CANDLES =
  160;

function formatPrice(
  value: number,
): string {
  const absolute =
    Math.abs(value);
  const maximumFractionDigits =
    absolute >= 1_000
      ? 2
      : absolute >= 1
        ? 4
        : 7;

  return new Intl.NumberFormat(
    'ru-RU',
    {
      maximumFractionDigits,
    },
  ).format(value);
}

function formatDateTime(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      day:
        '2-digit',
      month:
        '2-digit',
      hour:
        '2-digit',
      minute:
        '2-digit',
    },
  ).format(
    new Date(value),
  );
}

function kindLabel(
  line: LevelLine,
): string {
  return line.kind === 'support'
    ? 'Поддержка'
    : 'Сопротивление';
}

function statusLabel(
  line: LevelLine,
): string {
  if (line.status === 'broken') {
    return 'Пробит';
  }

  if (line.status === 'superseded') {
    return 'Снят новым экстремумом';
  }

  if (line.status === 'worked') {
    return 'Отработал · активен';
  }

  if (line.status === 'confirmed') {
    return 'Подтверждён';
  }

  return 'Кандидат';
}

function distanceToPrice(
  line: LevelLine,
  currentPrice: number,
): number {
  if (currentPrice <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(
    line.price - currentPrice,
  ) / currentPrice * 100;
}

function lineColor(
  line: LevelLine,
): string {
  if (
    line.status === 'broken'
    || line.status === 'superseded'
  ) {
    return line.kind === 'support'
      ? LEVEL_COLORS.brokenSupport
      : LEVEL_COLORS.brokenResistance;
  }

  return LEVEL_COLORS[line.kind];
}

function lineEndedAt(
  line: LevelLine,
): string | null {
  return line.supersededAt
    ?? line.brokenAt;
}

export function LevelPreviewPage() {
  const [
    symbol,
    setSymbol,
  ] = useState(
    'BTCUSDT',
  );
  const [
    symbolDraft,
    setSymbolDraft,
  ] = useState(
    'BTCUSDT',
  );
  const [
    timeframe,
    setTimeframe,
  ] = useState<
    LevelLinesTimeframe
  >('5m');
  const [
    showHistory,
    setShowHistory,
  ] = useState(false);

  const query =
    useApiQuery(
      `level-lines:${symbol}:${timeframe}`,
      () =>
        fetchLevelLines({
          symbol,
          timeframe,
          limit: 500,
        }),
      {
        preserveData: true,
      },
    );

  const snapshot =
    query.data;
  const currentPrice =
    snapshot
      ?.candles
      .at(-1)
      ?.close
    ?? 0;

  const activeLevels =
    useMemo(
      () =>
        [...(
          snapshot
            ?.activeLevels
          ?? []
        )].sort(
          (left, right) =>
            distanceToPrice(
              left,
              currentPrice,
            )
            - distanceToPrice(
                right,
                currentPrice,
              ),
        ),
      [
        currentPrice,
        snapshot,
      ],
    );

  const axisLabelLineIds =
    useMemo(
      () => {
        const nearestSupport =
          activeLevels.find(
            (line) =>
              line.kind === 'support',
          );
        const nearestResistance =
          activeLevels.find(
            (line) =>
              line.kind === 'resistance',
          );

        return new Set(
          [
            nearestSupport?.id,
            nearestResistance?.id,
          ].filter(
            (id): id is string =>
              Boolean(id),
          ),
        );
      },
      [activeLevels],
    );

  const chartLines =
    useMemo(
      () => {
        if (!snapshot) {
          return [];
        }

        const visibleCandles =
          snapshot.candles.slice(
            -CHART_WINDOW_CANDLES,
          );
        const firstVisible =
          visibleCandles.at(0);
        const lastVisible =
          visibleCandles.at(-1);

        if (
          !firstVisible
          || !lastVisible
        ) {
          return [];
        }

        const minimum =
          Math.min(
            ...visibleCandles.map(
              (candle) =>
                candle.low,
            ),
          );
        const maximum =
          Math.max(
            ...visibleCandles.map(
              (candle) =>
                candle.high,
            ),
          );
        const range =
          Math.max(
            maximum - minimum,
            maximum * 0.001,
          );
        const paddedMinimum =
          minimum - range * 0.18;
        const paddedMaximum =
          maximum + range * 0.18;
        const firstVisibleMs =
          Date.parse(
            firstVisible.openTime,
          );
        const activeLineIds =
          new Set(
            snapshot.activeLevels.map(
              (line) =>
                line.id,
            ),
          );

        return snapshot.lines.filter(
          (line) => {
            if (
              line.price < paddedMinimum
              || line.price > paddedMaximum
            ) {
              return false;
            }

            const endedAt =
              lineEndedAt(line);

            if (!endedAt) {
              return activeLineIds.has(
                line.id,
              );
            }

            return Boolean(
              showHistory
              && line.touchCount >= 2
              && Date.parse(
                endedAt,
              ) >= firstVisibleMs,
            );
          },
        );
      },
      [
        showHistory,
        snapshot,
      ],
    );

  const horizontalSegments =
    useMemo<
      NexusChartHorizontalSegment[]
    >(
      () =>
        chartLines.map(
          (line) => {
            const endedAt =
              lineEndedAt(line);
            const showAxisLabel =
              axisLabelLineIds.has(
                line.id,
              );

            return {
              price:
                line.price,
              startTime:
                line.originExtremumAt,
              ...(endedAt
                ? {
                    endTime:
                      endedAt,
                  }
                : {}),
              color:
                lineColor(line),
              lineStyle:
                line.status === 'candidate'
                  ? 'dashed'
                  : 'solid',
              ...(showAxisLabel
                ? {
                    title:
                      `${line.kind === 'support' ? 'S' : 'R'} · ${statusLabel(line)}`,
                  }
                : {}),
              axisLabelVisible:
                showAxisLabel,
            };
          },
        ),
      [
        axisLabelLineIds,
        chartLines,
      ],
    );

  const supportCount =
    activeLevels.filter(
      (line) =>
        line.kind === 'support',
    ).length;
  const resistanceCount =
    activeLevels.length
    - supportCount;

  const applySymbol = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const nextSymbol =
      symbolDraft
        .trim()
        .toUpperCase();

    if (
      /^[A-Z0-9]{5,30}$/u.test(
        nextSymbol,
      )
    ) {
      setSymbolDraft(
        nextSymbol,
      );
      setSymbol(
        nextSymbol,
      );
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>
            NEXUS · LEVEL ENGINE · LEVEL LINES V0.1
          </p>
          <h1>Уровни рынка</h1>
          <p className={styles.subtitle}>
            Движок отслеживает каждый значимый origin отдельно. Сильный свежий экстремум появляется пунктирным кандидатом, повторное касание подтверждает линию, а более экстремальная свеча справа снимает неподтверждённый origin.
          </p>
        </div>

        <div className={styles.heroBadges}>
          <span className={styles.binanceBadge}>
            BINANCE FUTURES
          </span>
          <span className={styles.causalBadge}>
            CLOSED CANDLES · CAUSAL
          </span>
        </div>
      </header>

      <div className={styles.controls}>
        <form
          className={styles.symbolForm}
          onSubmit={applySymbol}
        >
          <label htmlFor="level-lines-symbol">
            Инструмент
          </label>
          <div>
            <input
              id="level-lines-symbol"
              value={symbolDraft}
              maxLength={30}
              spellCheck={false}
              onChange={(event) => {
                setSymbolDraft(
                  event.target.value
                    .toUpperCase(),
                );
              }}
              aria-label="Инструмент Binance"
            />
            <button type="submit">
              Открыть
            </button>
          </div>
        </form>

        <div className={styles.timeframeControl}>
          <span>Таймфрейм</span>
          <div>
            {LEVEL_LINES_TIMEFRAMES.map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    timeframe === value
                      ? styles.timeframeActive
                      : styles.timeframeButton
                  }
                  onClick={() => {
                    setTimeframe(value);
                  }}
                >
                  {value}
                </button>
              ),
            )}
          </div>
        </div>

        <label className={styles.brokenToggle}>
          <input
            type="checkbox"
            checked={showHistory}
            onChange={(event) => {
              setShowHistory(
                event.target.checked,
              );
            }}
          />
          <span>
            Показывать историю завершённых линий
          </span>
        </label>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={query.retry}
          disabled={
            query.status === 'loading'
            && !snapshot
          }
        >
          Обновить
        </button>
      </div>

      {query.status === 'error'
        ? (
          <div
            className={styles.errorBanner}
            role="alert"
          >
            <strong>Данные недоступны</strong>
            <span>
              {query.error?.message}
            </span>
            <button
              type="button"
              onClick={query.retry}
            >
              Повторить
            </button>
          </div>
        )
        : null}

      {!snapshot
        ? (
          <div
            className={styles.loadingPanel}
            aria-live="polite"
          >
            <span />
            Загружаем реальные свечи Binance и строим Level Lines…
          </div>
        )
        : (
          <>
            <div className={styles.marketStrip}>
              <div>
                <span>Инструмент</span>
                <strong>{snapshot.symbol}</strong>
              </div>
              <div>
                <span>Таймфрейм</span>
                <strong>{snapshot.timeframe}</strong>
              </div>
              <div>
                <span>Текущая цена</span>
                <strong>
                  {formatPrice(currentPrice)}
                </strong>
              </div>
              <div>
                <span>Активные линии</span>
                <strong>{activeLevels.length}</strong>
              </div>
              <div>
                <span>Поддержка / сопротивление</span>
                <strong>
                  <i className={styles.supportText}>
                    {supportCount}
                  </i>
                  {' / '}
                  <i className={styles.resistanceText}>
                    {resistanceCount}
                  </i>
                </strong>
              </div>
            </div>

            <div className={styles.mainGrid}>
              <article className={styles.chartPanel}>
                <header className={styles.panelHeader}>
                  <div>
                    <p>REAL BINANCE CANDLES</p>
                    <h2>
                      {snapshot.symbol}
                      {' · '}
                      {snapshot.timeframe}
                    </h2>
                  </div>

                  <div className={styles.legend}>
                    <span>
                      <i className={styles.supportLegend} />
                      Поддержка
                    </span>
                    <span>
                      <i className={styles.resistanceLegend} />
                      Сопротивление
                    </span>
                    <span>
                      <i className={styles.brokenLegend} />
                      Завершённая
                    </span>
                  </div>
                </header>

                <div className={styles.chartFrame}>
                  <NexusCandlestickChart
                    candles={snapshot.candles}
                    symbol={snapshot.symbol}
                    horizontalSegments={horizontalSegments}
                    showSeriesPriceLine
                  />
                </div>

                <footer className={styles.chartFooter}>
                  <span>
                    На графике: {chartLines.length} линий в текущем ценовом диапазоне
                  </span>
                  <span>
                    {snapshot.closedCandlesCount} закрытых свечей
                    {snapshot.ignoredOpenCandlesCount > 0
                      ? ` · ${snapshot.ignoredOpenCandlesCount} открытая свеча исключена`
                      : ''}
                  </span>
                  <span>
                    Обновлено {formatDateTime(snapshot.generatedAt)}
                  </span>
                </footer>
              </article>

              <aside className={styles.levelsPanel}>
                <header>
                  <div>
                    <p>ACTIVE LEVEL REGISTRY</p>
                    <h2>Активные уровни</h2>
                  </div>
                  <span>{activeLevels.length}</span>
                </header>

                <div className={styles.levelList}>
                  {activeLevels.length === 0
                    ? (
                      <div className={styles.emptyLevels}>
                        На выбранном таймфрейме активных структур сейчас нет.
                      </div>
                    )
                    : activeLevels.map(
                        (line) => (
                          <article
                            key={line.id}
                            className={
                              line.kind === 'support'
                                ? styles.supportLevel
                                : styles.resistanceLevel
                            }
                          >
                            <div className={styles.levelTopline}>
                              <span>
                                {kindLabel(line)}
                              </span>
                              <em>
                                {statusLabel(line)}
                              </em>
                            </div>
                            <strong>
                              {formatPrice(line.price)}
                            </strong>
                            <div className={styles.levelMeta}>
                              <span>
                                Дистанция
                                <b>
                                  {distanceToPrice(
                                    line,
                                    currentPrice,
                                  ).toFixed(2)}%
                                </b>
                              </span>
                              <span>
                                Origin
                                <b>
                                  {formatDateTime(
                                    line.originExtremumAt,
                                  )}
                                </b>
                              </span>
                              <span>
                                Active from
                                <b>
                                  {formatDateTime(
                                    line.activeFrom,
                                  )}
                                </b>
                              </span>
                            </div>
                          </article>
                        ),
                      )}
                </div>
              </aside>
            </div>

            <section className={styles.contractStrip}>
              <div>
                <span>01</span>
                <strong>Один origin → одна линия</strong>
                <p>
                  Близкие самостоятельные экстремумы не склеиваются в ATR-зону.
                </p>
              </div>
              <div>
                <span>02</span>
                <strong>Сильный origin сразу</strong>
                <p>
                  Свежий кандидат показывается после сильного причинного отхода; слабые и устаревшие origin остаются внутри движка.
                </p>
              </div>
              <div>
                <span>03</span>
                <strong>Только вправо</strong>
                <p>
                  До исходного экстремума линия на графике не существует.
                </p>
              </div>
              <div>
                <span>04</span>
                <strong>Проверка справа</strong>
                <p>
                  Более высокий high снимает неподтверждённое сопротивление; более низкий low зеркально снимает поддержку.
                </p>
              </div>
            </section>

            <div className={styles.scopeNotice}>
              <strong>Текущий срез v0.1</strong>
              <span>
                Пунктиром отображаются только сильные свежие кандидаты, сплошной линией — уровни после повторного касания. Подтверждённые уровни остаются активными до пробоя; неподтверждённые снимаются новым экстремумом справа.
              </span>
            </div>
          </>
        )}
    </section>
  );
}
