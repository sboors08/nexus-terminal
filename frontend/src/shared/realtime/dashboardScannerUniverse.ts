import type {
  BinanceSymbolUniverseEntry,
} from './binanceSymbolUniverse';

export type DashboardScannerUniverseRow =
  readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    number,
  ];

export type DashboardScannerUniverseSource =
  | 'fallback'
  | 'registry'
  | 'collecting';

export interface DashboardScannerUniverseItem {
  row: DashboardScannerUniverseRow;
  source: DashboardScannerUniverseSource;
}

function normalizeSymbol(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function cloneRow(
  row: DashboardScannerUniverseRow,
): DashboardScannerUniverseRow {
  return [
    row[0],
    row[1],
    row[2],
    row[3],
    row[4],
    row[5],
    row[6],
    row[7],
    row[8],
    row[9],
  ];
}

function createRegistryRow(
  entry: BinanceSymbolUniverseEntry,
): DashboardScannerUniverseRow {
  return [
    `${entry.baseAsset}/${entry.quoteAsset}`,
    '0',
    'нет данных',
    'нет данных',
    'нет данных',
    'нет данных',
    'нет данных',
    'нет данных',
    'нет данных',
    0,
  ];
}

export function buildDashboardScannerUniverseRows(
  fallbackRows:
    readonly DashboardScannerUniverseRow[],
  entries:
    readonly BinanceSymbolUniverseEntry[],
): DashboardScannerUniverseItem[] {
  const fallbackBySymbol =
    new Map<
      string,
      DashboardScannerUniverseRow
    >();

  for (const row of fallbackRows) {
    fallbackBySymbol.set(
      normalizeSymbol(row[0]),
      row,
    );
  }

  if (entries.length === 0) {
    return fallbackRows.map((row) => ({
      row: cloneRow(row),
      source: 'fallback',
    }));
  }

  const includedSymbols =
    new Set<string>();

  const items:
    DashboardScannerUniverseItem[] = [];

  for (const entry of entries) {
    const symbol =
      normalizeSymbol(entry.symbol);

    if (includedSymbols.has(symbol)) {
      continue;
    }

    includedSymbols.add(symbol);

    const fallbackRow =
      fallbackBySymbol.get(symbol);

    items.push({
      row: fallbackRow
        ? cloneRow(fallbackRow)
        : createRegistryRow(entry),
      source:
        entry.status === 'collecting'
          ? 'collecting'
          : fallbackRow
            ? 'fallback'
            : 'registry',
    });
  }

  for (const row of fallbackRows) {
    const symbol =
      normalizeSymbol(row[0]);

    if (includedSymbols.has(symbol)) {
      continue;
    }

    items.push({
      row: cloneRow(row),
      source: 'fallback',
    });
  }

  return items;
}