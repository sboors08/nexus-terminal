import type {
  ScannerWindow,
} from '../config/tradingPresets.js';
import type {
  MarketScannerMetrics,
} from './dashboardScannerMetrics.js';

export const SCANNER_SETUP_TABLE_SORT_KEYS = [
  'symbol',
  'direction',
  'kind',
  'stage',
  'timeframe',
  'level',
  'touches',
  'formation',
  'distance',
  'pullbacks',
  'volume',
  'trades',
  'btcStrength',
] as const;

export type ScannerSetupTableSortKey =
  (
    typeof SCANNER_SETUP_TABLE_SORT_KEYS
  )[number];

export type ScannerSetupTableSortDirection =
  | 'asc'
  | 'desc';

export interface ScannerSetupTableSortState {
  sortBy:
    ScannerSetupTableSortKey;
  sortDirection:
    ScannerSetupTableSortDirection;
}

export const DEFAULT_SCANNER_SETUP_TABLE_SORT_STATE:
ScannerSetupTableSortState = {
  sortBy:
    'distance',
  sortDirection:
    'asc',
};

export interface ScannerSetupTableRow {
  id: string;
  symbol: string;
  direction: string;
  kind: string;
  stage: string;
  timeframe: string;
  level: string;
  touches: number;
  formationMinutes: number;
  distancePercent: number;
  pullbackDepth: string;
  quoteVolume24h?: number | null;
  volumeAnomaly: number | null;
  tradesAnomaly: number | null;
  btcStrength: number | null;
  btcStrengthLabel: string;
  runtimeData?: boolean;
  source?: 'v1' | 'v2-shadow';
  price?: string;
  priceChange?: string;
  distanceLabel?: string;
  btcCorrelation?: string;
  tradeSpeed?: string;
  levelLow?: number;
  levelHigh?: number;
  levelReferencePrice?: number;
  shadowScore?: number;
  shadowStatus?: string;
}

export function isScannerSetupBelowKnownQuoteVolume(
  setup: Pick<
    ScannerSetupTableRow,
    'quoteVolume24h'
  >,
  minQuoteVolume24h: number,
): boolean {
  const quoteVolume24h =
    setup.quoteVolume24h;

  return (
    minQuoteVolume24h > 0
    && quoteVolume24h !== null
    && quoteVolume24h !== undefined
    && quoteVolume24h
      < minQuoteVolume24h
  );
}

export function parseScannerMinQuoteVolumeMillions(
  value: string,
): number {
  const millions =
    Number(
      value
        .trim()
        .replace(',', '.'),
    );

  if (
    !Number.isFinite(millions)
    || millions <= 0
  ) {
    return 0;
  }

  return millions * 1_000_000;
}

export type ScannerSetupMetricsIndex =
  Readonly<
    Record<
      string,
      MarketScannerMetrics
    >
  >;

const scannerSetupCollator =
  new Intl.Collator(
    'ru-RU',
    {
      numeric: true,
      sensitivity:
        'base',
    },
  );

function normalizeMetricSymbol(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/gu,
      '',
    );
}

export function buildScannerSetupMetricKey(
  symbol: string,
  timeframe: string,
): string {
  return (
    normalizeMetricSymbol(
      symbol,
    )
    + ':'
    + timeframe
        .trim()
        .toLowerCase()
  );
}

export function indexScannerSetupMetrics(
  metricGroups:
    readonly (
      Readonly<
        Record<
          string,
          MarketScannerMetrics
        >
      >
    )[],
): Record<
  string,
  MarketScannerMetrics
> {
  const result: Record<
    string,
    MarketScannerMetrics
  > = {};

  for (
    const metricGroup
    of metricGroups
  ) {
    for (
      const metric
      of Object.values(
        metricGroup,
      )
    ) {
      result[
        buildScannerSetupMetricKey(
          metric.symbol,
          metric.scannerWindow,
        )
      ] = {
        ...metric,
      };
    }
  }

  return result;
}

function formatRelativeStrength(
  value: number | null,
): string {
  if (value === null) {
    return '—';
  }

  return (
    (
      value > 0
        ? '+'
        : ''
    )
    + value.toFixed(2)
    + '%'
  );
}

function formatScannerMetricPrice(
  value: number,
): string {
  const absolute =
    Math.abs(value);

  const digits =
    absolute >= 1000
      ? 2
      : absolute >= 1
        ? 4
        : 8;

  return value.toLocaleString(
    'en-US',
    {
      useGrouping:
        false,
      maximumFractionDigits:
        digits,
    },
  );
}

function calculateDistanceToZonePct(
  price: number,
  low: number,
  high: number,
): number {
  if (price <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (price < low) {
    return (
      (
        low
        - price
      )
      / price
    ) * 100;
  }

  if (price > high) {
    return (
      (
        price
        - high
      )
      / price
    ) * 100;
  }

  return 0;
}

export function applyScannerSetupLiveMetrics<
  T extends ScannerSetupTableRow,
>(
  setups:
    readonly T[],
  metrics:
    ScannerSetupMetricsIndex,
  quoteVolumes24h:
    Readonly<
      Record<string, number>
    > = {},
): T[] {
  return setups.map(
    (setup) => {
      if (
        setup.runtimeData
        !== true
      ) {
        return setup;
      }

      const metric =
        metrics[
          buildScannerSetupMetricKey(
            setup.symbol,
            setup.timeframe,
          )
        ];

      const quoteVolume24h =
        quoteVolumes24h[
          normalizeMetricSymbol(
            setup.symbol,
          )
        ]
        ?? null;

      const btcStrength =
        metric
          ?.relativeStrengthPct
        ?? null;

      const shadowPatch:
      Partial<ScannerSetupTableRow> = {};

      if (
        setup.source === 'v2-shadow'
        && metric?.price !== null
        && metric?.price !== undefined
        && setup.levelLow !== undefined
        && setup.levelHigh !== undefined
      ) {
        const distancePercent =
          calculateDistanceToZonePct(
            metric.price,
            setup.levelLow,
            setup.levelHigh,
          );

        shadowPatch.price =
          formatScannerMetricPrice(
            metric.price,
          );

        shadowPatch.priceChange =
          metric.priceChangePct === null
            ? '\u2014'
            : (
                metric.priceChangePct > 0
                  ? '+'
                  : ''
              )
              + metric.priceChangePct
                  .toFixed(2)
              + '%';

        shadowPatch.distancePercent =
          distancePercent;

        shadowPatch.distanceLabel =
          distancePercent
            .toFixed(4)
          + '%';

        shadowPatch.btcCorrelation =
          metric.btcCorrelation === null
            ? '\u2014'
            : metric.btcCorrelation
                .toFixed(2);

        shadowPatch.tradeSpeed =
          metric.tradesPerMinute
            .toFixed(1)
          + ' \u0441\u0434\u0435\u043b/\u043c\u0438\u043d';
      }

      return {
        ...setup,
        ...shadowPatch,

        quoteVolume24h,
        volumeAnomaly:
          metric
            ?.volumeAnomaly
          ?? null,

        tradesAnomaly:
          metric
            ?.tradesAnomaly
          ?? null,

        btcStrength,

        btcStrengthLabel:
          formatRelativeStrength(
            btcStrength,
          ),
      };
    },
  );
}

function parseLevelValue(
  value: string,
): number | null {
  const firstBoundary =
    value.split(
      /[–—-]/u,
    )[0]
    ?? '';

  const normalized =
    firstBoundary
      .replace(
        /s/gu,
        '',
      )
      .replace(
        ',',
        '.',
      );

  const parsed =
    Number(
      normalized,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

function timeframeToMinutes(
  value: string,
): number | null {
  const match =
    /^([0-9]+)(m|h|d|w)$/u
      .exec(
        value
          .trim()
          .toLowerCase(),
      );

  if (!match) {
    return null;
  }

  const amount =
    Number(
      match[1],
    );

  if (
    !Number.isFinite(
      amount,
    )
    || amount <= 0
  ) {
    return null;
  }

  const unit =
    match[2];

  if (unit === 'm') {
    return amount;
  }

  if (unit === 'h') {
    return amount * 60;
  }

  if (unit === 'd') {
    return amount * 1_440;
  }

  return amount * 10_080;
}

function stageRank(
  stage: string,
): number | null {
  const ranks: Record<
    string,
    number
  > = {
    observation: 1,
    approach: 2,
    confirmation: 3,
    triggered: 4,
  };

  return ranks[stage]
    ?? null;
}

function pullbackRank(
  pullbackDepth: string,
): number | null {
  if (
    pullbackDepth
    === 'Глубокие'
  ) {
    return 2;
  }

  if (
    pullbackDepth
    === 'Неглубокие'
  ) {
    return 1;
  }

  return null;
}

function sortableText(
  value: string,
): string | null {
  const normalized =
    value.trim();

  return normalized.length > 0
    ? normalized
    : null;
}

type ScannerSetupSortValue =
  | number
  | string
  | null;

function getScannerSetupSortValue(
  setup:
    ScannerSetupTableRow,
  sortBy:
    ScannerSetupTableSortKey,
): ScannerSetupSortValue {
  switch (sortBy) {
    case 'symbol':
      return sortableText(
        setup.symbol,
      );

    case 'direction':
      return sortableText(
        setup.direction,
      );

    case 'kind':
      return sortableText(
        setup.kind,
      );

    case 'stage':
      return stageRank(
        setup.stage,
      );

    case 'timeframe':
      return timeframeToMinutes(
        setup.timeframe,
      );

    case 'level':
      return parseLevelValue(
        setup.level,
      );

    case 'touches':
      return setup.touches;

    case 'formation':
      return setup
        .formationMinutes;

    case 'distance':
      return setup
        .distancePercent;

    case 'pullbacks':
      return pullbackRank(
        setup.pullbackDepth,
      );

    case 'volume':
      return setup
        .volumeAnomaly;

    case 'trades':
      return setup
        .tradesAnomaly;

    case 'btcStrength':
      return setup
        .btcStrength;
  }
}

function isMissingSortValue(
  value:
    ScannerSetupSortValue,
): boolean {
  return (
    value === null
    || (
      typeof value
      === 'number'
      && !Number.isFinite(
        value,
      )
    )
  );
}

export function sortScannerSetupRows<
  T extends ScannerSetupTableRow,
>(
  setups:
    readonly T[],
  state:
    ScannerSetupTableSortState,
): T[] {
  return setups
    .map(
      (
        setup,
        originalIndex,
      ) => ({
        setup,
        originalIndex,
        sortValue:
          getScannerSetupSortValue(
            setup,
            state.sortBy,
          ),
      }),
    )
    .sort(
      (
        left,
        right,
      ) => {
        const leftMissing =
          isMissingSortValue(
            left.sortValue,
          );

        const rightMissing =
          isMissingSortValue(
            right.sortValue,
          );

        if (
          leftMissing
          && rightMissing
        ) {
          return (
            left.originalIndex
            - right.originalIndex
          );
        }

        if (leftMissing) {
          return 1;
        }

        if (rightMissing) {
          return -1;
        }

        let difference = 0;

        if (
          typeof left.sortValue
            === 'number'
          && typeof right.sortValue
            === 'number'
        ) {
          difference =
            left.sortValue
            - right.sortValue;
        } else {
          difference =
            scannerSetupCollator
              .compare(
                String(
                  left.sortValue,
                ),
                String(
                  right.sortValue,
                ),
              );
        }

        if (difference === 0) {
          return (
            left.originalIndex
            - right.originalIndex
          );
        }

        return (
          state.sortDirection
          === 'asc'
            ? difference
            : -difference
        );
      },
    )
    .map(
      ({ setup }) =>
        setup,
    );
}

export function nextScannerSetupSortState(
  current:
    ScannerSetupTableSortState,
  sortBy:
    ScannerSetupTableSortKey,
): ScannerSetupTableSortState {
  if (
    current.sortBy
    !== sortBy
  ) {
    return {
      sortBy,
      sortDirection:
        'desc',
    };
  }

  return {
    sortBy,
    sortDirection:
      current.sortDirection
      === 'desc'
        ? 'asc'
        : 'desc',
  };
}

export function isScannerSetupMetricTimeframe(
  value: string,
): value is ScannerWindow {
  return [
    '1m',
    '5m',
    '15m',
  ].includes(
    value,
  );
}
