import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const [page, css, client, hook] = await Promise.all([
  readFile(resolve(root, 'src/pages/ScannerPage.tsx'), 'utf8'),
  readFile(resolve(root, 'src/pages/ScannerPage.module.css'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/marketVolumeSpikes.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/useMarketVolumeSpikes.ts'), 'utf8'),
]);

const markers = [
  [page, 'ВСПЛЕСКИ ОБЪЁМА'],
  [page, 'useMarketVolumeSpikes'],
  [page, 'VOLUME_SPIKE_STATUS_LABELS'],
  [page, "new: 'НОВЫЙ'"],
  [page, "growing: 'РАСТЁТ'"],
  [page, "stable: 'СТАБИЛЬНЫЙ'"],
  [page, "fading: 'ЗАТУХАЕТ'"],
  [page, 'spike.volumeRatio.toFixed(2)'],
  [page, 'spike.currentQuoteVolume'],
  [page, 'spike.priceChangePct'],
  [css, '.volumeSpikesPanel'],
  [css, '.volumeSpikeCard'],
  [css, '.volumeSpikeGrowing'],
  [css, '@media (max-width: 780px)'],
  [client, '/api/v1/market/realtime/market-wide/volume-spikes'],
  [hook, 'intervalMs = 5_000'],
];

const missing = markers
  .filter(([source, marker]) => !source.includes(marker))
  .map(([, marker]) => marker);

if (missing.length > 0) {
  console.error(`Missing Market Scanner Volume Spikes UI markers: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('NEXUS frontend verified: Market Scanner Volume Spikes Frontend v0.1 is present.');
