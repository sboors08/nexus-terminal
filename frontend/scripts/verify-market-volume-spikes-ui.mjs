import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const [
  dashboard,
  dashboardCss,
  scanner,
  market,
  client,
  hook,
  tests,
] = await Promise.all([
  readFile(resolve(root, 'src/pages/DashboardPage.tsx'), 'utf8'),
  readFile(resolve(root, 'src/pages/DashboardPage.module.css'), 'utf8'),
  readFile(resolve(root, 'src/pages/ScannerPage.tsx'), 'utf8'),
  readFile(resolve(root, 'src/pages/MarketPage.tsx'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/marketVolumeSpikes.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/useMarketVolumeSpikes.ts'), 'utf8'),
  readFile(resolve(root, 'test/market-volume-spikes.test.mjs'), 'utf8'),
]);

const markers = [
  [dashboard, 'data-testid="dashboard-volume-spikes"'],
  [dashboard, 'ВСПЛЕСКИ ОБЪЁМА'],
  [dashboard, 'useMarketVolumeSpikes'],
  [dashboard, 'DASHBOARD_VOLUME_SPIKE_STATUS_LABELS'],
  [dashboard, 'dashboardVolumeSpikes.status'],
  [dashboard, 'dashboardVolumeSpikes.retry'],
  [dashboard, 'dashboardVolumeSpikes.spikes'],
  [dashboard, 'spike.volumeRatio'],
  [dashboard, 'spike.currentQuoteVolume'],
  [dashboardCss, '.dashboardVolumeSpikesTable'],
  [dashboardCss, '.dashboardVolumeSpikeRow'],
  [dashboardCss, 'overflow: auto'],
  [client, '/api/v1/market/realtime/market-wide/volume-spikes'],
  [client, 'MARKET_VOLUME_SPIKES_PATH'],
  [client, 'MarketVolumeSpikePeriodMinutes'],
  [client, 'normalizePeriodMinutes'],
  [client, 'normalizeStatuses'],
  [client, "statuses.join(',')"],
  [hook, 'intervalMs = 5_000'],
  [hook, 'minCurrentQuoteVolume'],
  [hook, 'statuses'],
  [tests, 'builds a URL with volume spike filters'],
  [tests, 'minCurrentQuoteVolume: 250_000'],
  [tests, "statuses=new%2Cgrowing"],
];

const forbidden = [
  [scanner, 'aria-label="Всплески объёма"'],
  [market, 'aria-label="Всплески объёма"'],
  [scanner, '>ВСПЛЕСКИ ОБЪЁМА<'],
  [market, '>ВСПЛЕСКИ ОБЪЁМА<'],
];

const missing = markers
  .filter(([source, marker]) => !source.includes(marker))
  .map(([, marker]) => marker);
const misplaced = forbidden
  .filter(([source, marker]) => source.includes(marker))
  .map(([, marker]) => marker);

if (missing.length > 0 || misplaced.length > 0) {
  if (missing.length > 0) {
    console.error(`Missing Dashboard Volume Spikes markers: ${missing.join(', ')}`);
  }
  if (misplaced.length > 0) {
    console.error(`Volume Spikes visual block returned outside Dashboard: ${misplaced.join(', ')}`);
  }
  process.exit(1);
}

console.log('NEXUS frontend verified: Volume Spikes UI is on Dashboard and its shared filters/realtime contract is preserved.');
