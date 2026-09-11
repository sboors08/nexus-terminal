import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import {
  nexusApi,
  useApiQuery,
  type ScannerSetup,
  type ScannerTimeframe,
} from '@/shared/api';
import { TokenLogo } from '@/shared/ui/TokenLogo';
import styles from './DashboardPage.module.css';

type RadarDirection =
  | 'all'
  | ScannerSetup['direction'];

type RadarKind =
  | 'all'
  | 'breakout'
  | 'bounce';

type RadarStage =
  | 'all'
  | 'active'
  | ScannerSetup['stage'];

type RadarTimeframe =
  | 'all'
  | ScannerTimeframe;

type RadarDistance =
  | 'all'
  | '0.5'
  | '1'
  | '2';

type RadarTouches =
  | 'all'
  | '2'
  | '3';

type RadarBtcStrength =
  | 'all'
  | 'positive'
  | 'negative';

type RadarFilters = {
  minVolumeMillions: string;
  direction: RadarDirection;
  kind: RadarKind;
  stage: RadarStage;
  timeframe: RadarTimeframe;
  distance: RadarDistance;
  touches: RadarTouches;
  btcStrength: RadarBtcStrength;
};

const DEFAULT_RADAR_FILTERS: RadarFilters = {
  minVolumeMillions: '100',
  direction: 'all',
  kind: 'all',
  stage: 'active',
  timeframe: 'all',
  distance: '0.5',
  touches: '2',
  btcStrength: 'all',
};

const RADAR_STAGE_PRIORITY:
Readonly<Record<ScannerSetup['stage'], number>> = {
  confirmation: 0,
  approach: 1,
  triggered: 2,
  observation: 3,
};

function parseRadarMinVolume(
  value: string,
): number {
  const millions = Number(
    value.trim().replace(',', '.'),
  );

  return Number.isFinite(millions)
    && millions > 0
    ? millions * 1_000_000
    : 0;
}

function matchesRadarKind(
  setup: ScannerSetup,
  kind: RadarKind,
): boolean {
  if (kind === 'all') {
    return true;
  }

  if (kind === 'breakout') {
    return setup.kind.startsWith('Пробой');
  }

  return setup.kind.startsWith('Отскок');
}

function matchesRadarStage(
  setup: ScannerSetup,
  stage: RadarStage,
): boolean {
  if (stage === 'all') {
    return true;
  }

  if (stage === 'active') {
    return setup.stage === 'approach'
      || setup.stage === 'confirmation';
  }

  return setup.stage === stage;
}

function formatRadarKind(
  kind: ScannerSetup['kind'],
): string {
  if (kind === 'Пробой сопротивления') {
    return 'Пробой сопр.';
  }

  if (kind === 'Пробой поддержки') {
    return 'Пробой подд.';
  }

  if (kind === 'Отскок от поддержки') {
    return 'Отскок от подд.';
  }

  if (kind === 'Отскок от сопротивления') {
    return 'Отскок от сопр.';
  }

  return kind;
}

function formatRadarStage(
  stage: ScannerSetup['stage'],
): string {
  if (stage === 'confirmation') {
    return 'Подтверждение';
  }

  if (stage === 'approach') {
    return 'Подход';
  }

  if (stage === 'triggered') {
    return 'Сработал';
  }

  return 'Наблюдение';
}

function buildLevelRadarScannerUrl(
  setup: ScannerSetup,
  filters: RadarFilters,
): string {
  const params = new URLSearchParams();
  params.set('setupId', setup.id);
  params.set('symbol', setup.symbol);
  params.set('timeframe', setup.timeframe);
  params.set(
    'minQuoteVolumeMillions',
    filters.minVolumeMillions || '0',
  );

  return `${ROUTES.scanner}?${params.toString()}`;
}

function countRadarFilters(
  filters: RadarFilters,
): number {
  return [
    filters.minVolumeMillions !== '',
    filters.direction !== 'all',
    filters.kind !== 'all',
    filters.stage !== 'all',
    filters.timeframe !== 'all',
    filters.distance !== 'all',
    filters.touches !== 'all',
    filters.btcStrength !== 'all',
  ].filter(Boolean).length;
}

export function DashboardLevelRadar({
  volumeSpikeSymbols,
}: {
  volumeSpikeSymbols: ReadonlySet<string>;
}) {
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] =
    useState(false);
  const [filters, setFilters] =
    useState<RadarFilters>({
      ...DEFAULT_RADAR_FILTERS,
    });

  const minQuoteVolume24h =
    parseRadarMinVolume(
      filters.minVolumeMillions,
    );

  const queryKey =
    `dashboard-level-radar:${minQuoteVolume24h}`;

  const radarQuery = useApiQuery(
    queryKey,
    () =>
      nexusApi.getScannerSetups(
        minQuoteVolume24h > 0
          ? {
              minQuoteVolume24h,
            }
          : {},
      ),
    {
      intervalMs: 15_000,
      preserveData: true,
    },
  );

  const radarRows = useMemo(
    () => {
      const maxDistance =
        filters.distance === 'all'
          ? null
          : Number(filters.distance);
      const minTouches =
        filters.touches === 'all'
          ? null
          : Number(filters.touches);

      return [...(radarQuery.data ?? [])]
        .filter((setup) => {
          if (
            minQuoteVolume24h > 0
            && setup.quoteVolume24h !== null
            && setup.quoteVolume24h !== undefined
            && setup.quoteVolume24h
              < minQuoteVolume24h
          ) {
            return false;
          }

          if (
            filters.direction !== 'all'
            && setup.direction
              !== filters.direction
          ) {
            return false;
          }

          if (!matchesRadarKind(setup, filters.kind)) {
            return false;
          }

          if (!matchesRadarStage(setup, filters.stage)) {
            return false;
          }

          if (
            filters.timeframe !== 'all'
            && setup.timeframe
              !== filters.timeframe
          ) {
            return false;
          }

          if (
            maxDistance !== null
            && setup.distancePercent
              > maxDistance
          ) {
            return false;
          }

          if (
            minTouches !== null
            && setup.touches < minTouches
          ) {
            return false;
          }

          if (
            filters.btcStrength === 'positive'
            && (
              setup.btcStrength === null
              || setup.btcStrength <= 0
            )
          ) {
            return false;
          }

          if (
            filters.btcStrength === 'negative'
            && (
              setup.btcStrength === null
              || setup.btcStrength >= 0
            )
          ) {
            return false;
          }

          return true;
        })
        .sort((left, right) => {
          const stageDifference =
            RADAR_STAGE_PRIORITY[left.stage]
            - RADAR_STAGE_PRIORITY[right.stage];

          if (stageDifference !== 0) {
            return stageDifference;
          }

          const distanceDifference =
            left.distancePercent
            - right.distancePercent;

          if (distanceDifference !== 0) {
            return distanceDifference;
          }

          return right.touches - left.touches;
        });
    },
    [
      filters,
      minQuoteVolume24h,
      radarQuery.data,
    ],
  );

  const activeFilterCount =
    countRadarFilters(filters);

  return (
    <article
      className={
        `${styles.panel} ${styles.levelRadar}`
      }
      data-testid="dashboard-level-radar"
    >
      <header className={styles.levelRadarHeader}>
        <div>
          <h2>⌖ &nbsp; NEXUS LEVEL RADAR</h2>
          <small>КАНДИДАТЫ У УРОВНЕЙ ПРЯМО СЕЙЧАС</small>
        </div>

        <div className={styles.levelRadarHeaderTools}>
          <span
            className={
              radarQuery.status === 'error'
                ? styles.levelRadarError
                : radarQuery.status === 'success'
                  ? styles.levelRadarLive
                  : styles.levelRadarPending
            }
          >
            <i />
            {radarQuery.status === 'success'
              ? `${radarRows.length} LIVE`
              : radarQuery.status === 'error'
                ? 'ERROR'
                : 'LOADING'}
          </span>

          <button
            type="button"
            className={styles.levelRadarFilterButton}
            aria-expanded={filtersOpen}
            onClick={() => {
              setFiltersOpen((current) => !current);
            }}
          >
            ⚙ ФИЛЬТРЫ · {activeFilterCount}
          </button>
        </div>
      </header>

      {filtersOpen ? (
        <div className={styles.levelRadarFilters}>
          <label>
            <span>ОБЪЁМ 24Ч, МЛН</span>
            <select
              value={filters.minVolumeMillions}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  minVolumeMillions:
                    event.target.value,
                }));
              }}
            >
              <option value="">Любой</option>
              <option value="50">От 50</option>
              <option value="100">От 100</option>
              <option value="150">От 150</option>
            </select>
          </label>

          <label>
            <span>НАПРАВЛЕНИЕ</span>
            <select
              value={filters.direction}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  direction:
                    event.target.value as RadarDirection,
                }));
              }}
            >
              <option value="all">Все</option>
              <option value="long">LONG</option>
              <option value="short">SHORT</option>
            </select>
          </label>

          <label>
            <span>ТИП СЕТАПА</span>
            <select
              value={filters.kind}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  kind:
                    event.target.value as RadarKind,
                }));
              }}
            >
              <option value="all">Все</option>
              <option value="breakout">Пробой</option>
              <option value="bounce">Отскок</option>
            </select>
          </label>

          <label>
            <span>СТАДИЯ</span>
            <select
              value={filters.stage}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  stage:
                    event.target.value as RadarStage,
                }));
              }}
            >
              <option value="all">Все</option>
              <option value="active">Подход + подтв.</option>
              <option value="observation">Наблюдение</option>
              <option value="approach">Подход</option>
              <option value="confirmation">Подтверждение</option>
              <option value="triggered">Сработал</option>
            </select>
          </label>

          <label>
            <span>ТАЙМФРЕЙМ</span>
            <select
              value={filters.timeframe}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  timeframe:
                    event.target.value as RadarTimeframe,
                }));
              }}
            >
              <option value="all">Все</option>
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
            </select>
          </label>

          <label>
            <span>ДО УРОВНЯ</span>
            <select
              value={filters.distance}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  distance:
                    event.target.value as RadarDistance,
                }));
              }}
            >
              <option value="all">Любое</option>
              <option value="0.5">≤ 0.5%</option>
              <option value="1">≤ 1%</option>
              <option value="2">≤ 2%</option>
            </select>
          </label>

          <label>
            <span>КАСАНИЯ</span>
            <select
              value={filters.touches}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  touches:
                    event.target.value as RadarTouches,
                }));
              }}
            >
              <option value="all">Любое</option>
              <option value="2">От 2</option>
              <option value="3">От 3</option>
            </select>
          </label>

          <label>
            <span>СИЛА К BTC</span>
            <select
              value={filters.btcStrength}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  btcStrength:
                    event.target.value as RadarBtcStrength,
                }));
              }}
            >
              <option value="all">Любая</option>
              <option value="positive">Сильнее BTC</option>
              <option value="negative">Слабее BTC</option>
            </select>
          </label>

          <div className={styles.levelRadarFilterActions}>
            <button
              type="button"
              onClick={() => {
                setFilters({
                  ...DEFAULT_RADAR_FILTERS,
                });
              }}
            >
              СБРОСИТЬ
            </button>

            <button
              type="button"
              onClick={() => {
                setFiltersOpen(false);
              }}
            >
              ГОТОВО
            </button>
          </div>
        </div>
      ) : null}

      {radarQuery.status === 'loading'
      && radarQuery.data === null ? (
        <div className={styles.levelRadarState}>
          Загружаем кандидатов Setup Engine…
        </div>
      ) : radarQuery.status === 'error'
      && radarQuery.data === null ? (
        <div
          className={
            `${styles.levelRadarState} `
            + styles.levelRadarStateError
          }
        >
          <span>Кандидаты временно недоступны</span>
          <button
            type="button"
            onClick={radarQuery.retry}
          >
            ПОВТОРИТЬ
          </button>
        </div>
      ) : radarRows.length === 0 ? (
        <div className={styles.levelRadarState}>
          Нет кандидатов по выбранным условиям
        </div>
      ) : (
        <div className={styles.levelRadarTable}>
          <div className={styles.levelRadarTableHead}>
            <span>#</span>
            <span>ПАРА</span>
            <span>СЕТАП</span>
            <span>СТАДИЯ</span>
            <span>TF</span>
            <span>ДО УР.</span>
            <span>КАС.</span>
          </div>

          {radarRows.slice(0, 12).map((setup, index) => {
            const normalizedSymbol =
              setup.symbol
                .replace('/', '')
                .toUpperCase();
            const hasVolumeSpike =
              volumeSpikeSymbols.has(
                normalizedSymbol,
              );

            return (
              <button
                key={setup.id}
                type="button"
                className={styles.levelRadarRow}
                title={`Открыть ${setup.symbol} в Scanner`}
                onClick={() => {
                  navigate(
                    buildLevelRadarScannerUrl(
                      setup,
                      filters,
                    ),
                  );
                }}
              >
                <span>{index + 1}</span>

                <strong className={styles.levelRadarSymbol}>
                  <TokenLogo
                    symbol={setup.symbol}
                    size={16}
                    eager
                  />
                  <span>
                    {setup.symbol}
                    <small
                      className={
                        setup.direction === 'long'
                          ? styles.levelRadarLong
                          : styles.levelRadarShort
                      }
                    >
                      {setup.direction.toUpperCase()}
                      {' · BTC '}
                      {setup.btcStrengthLabel}
                    </small>
                  </span>
                </strong>

                <span
                  className={styles.levelRadarKind}
                  title={setup.kind}
                >
                  {formatRadarKind(setup.kind)}
                  {hasVolumeSpike ? (
                    <small>VOLUME</small>
                  ) : null}
                </span>

                <strong
                  className={
                    styles[
                      `levelRadarStage_${setup.stage}`
                    ]
                  }
                >
                  {formatRadarStage(setup.stage)}
                </strong>

                <span>{setup.timeframe}</span>
                <span>{setup.distanceLabel}</span>
                <span>{setup.touches}</span>
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}
