import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const requiredFiles = [
  'src/shared/realtime/scannerFilters.ts',
  'src/pages/DashboardScannerFilters.tsx',
  'src/pages/DashboardScannerFilters.module.css',
  'test/scanner-filters-sorting.test.mjs',
];

const checks = [
  {
    file: 'src/shared/realtime/scannerFilters.ts',
    markers: [
      'export interface ScannerFilterState',
      'createDefaultScannerFilterState',
      'filterAndSortScannerRows',
      'countActiveScannerFilters',
      'minActivityScore',
      'minQuoteVolume',
      'minTradesCount',
      'minTradesPerMinute',
      'minVolatilityPct',
      'minLiquidityScore',
      'minBtcCorrelation',
      'minRelativeStrengthPct',
    ],
  },
  {
    file: 'src/pages/DashboardScannerFilters.tsx',
    markers: [
      'ФИЛЬТРЫ И СОРТИРОВКА',
      'Только монеты с LIVE-данными',
      'СОРТИРОВАТЬ ПО',
      'ПРИМЕНИТЬ',
      'СБРОСИТЬ',
    ],
  },
  {
    file: 'src/pages/DashboardPage.tsx',
    markers: [
      'DashboardScannerFilters',
      'filteredDashboardScannerRows',
      'filterAndSortScannerRows',
      'aria-label="Поиск монеты в Market Scanner"',
      'activeScannerFilterCount',
    ],
  },
  {
    file: 'src/shared/realtime/dashboardScannerMetrics.ts',
    markers: [
      'tradesCountValue',
      'tradesPerMinuteValue',
    ],
  },
  {
    file: 'test/scanner-filters-sorting.test.mjs',
    markers: [
      'uses activity descending as the default Scanner order',
      'filters Scanner rows by search and live state',
      'applies minimum Scanner metric thresholds',
      'keeps missing metrics last while sorting',
      'counts active Scanner filters without counting sorting',
    ],
  },
];

const errors = [];

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    errors.push(`Отсутствует файл: ${relativePath}`);
  }
}

for (const check of checks) {
  const absolutePath = path.join(root, check.file);

  if (!fs.existsSync(absolutePath)) {
    continue;
  }

  const content = fs.readFileSync(absolutePath, 'utf8');

  for (const marker of check.markers) {
    if (!content.includes(marker)) {
      errors.push(
        `В ${check.file} отсутствует маркер: ${marker}`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(
    'NEXUS Scanner Filters & Sorting verification failed:',
  );

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log(
  'NEXUS frontend verified: Scanner Live Filters & Sorting v0.1 are present.',
);