import {
  readFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';

const root = process.cwd();

const [
  page,
  css,
  packageSource,
] = await Promise.all([
  readFile(
    resolve(
      root,
      'src/pages/DashboardPage.tsx',
    ),
    'utf8',
  ),
  readFile(
    resolve(
      root,
      'src/pages/DashboardPage.module.css',
    ),
    'utf8',
  ),
  readFile(
    resolve(
      root,
      'package.json',
    ),
    'utf8',
  ),
]);

const markers = [
  [
    page,
    'Dashboard Volume Spikes Reference Layout v0.1',
  ],
  [page, 'useMarketVolumeSpikes'],
  [
    page,
    'DASHBOARD_VOLUME_SPIKE_STATUS_LABELS',
  ],
  [page, 'dashboardSidebar'],
  [page, 'ВСПЛЕСКИ ОБЪЁМА'],
  [page, 'СИЛА ОБЪЁМА'],
  [page, 'ОБЪЁМ (СЕЙЧАС)'],
  [page, 'dashboardVolumeSpikeBars'],
  [
    page,
    'buildDashboardVolumeSpikesScannerUrl',
  ],
  [css, '.dashboardSidebar'],
  [css, '.dashboardVolumeSpikesTable'],
  [css, '.dashboardVolumeSpikeRow'],
  [css, '.dashboardVolumeSpikeBars'],
  [css, '.dashboardVolumeSpike_growing'],
  [css, '@media (max-width: 820px)'],
  [
    packageSource,
    'verify:dashboard-volume-spikes',
  ],
];

const forbidden = [
  [
    page,
    '<section\n            className={styles.dashboardVolumeSpikes}',
  ],
];

const missing =
  markers
    .filter(
      ([source, marker]) =>
        !source.includes(marker),
    )
    .map(([, marker]) => marker);

const stillPresent =
  forbidden
    .filter(
      ([source, marker]) =>
        source.includes(marker),
    )
    .map(([, marker]) => marker);

if (
  missing.length > 0
  || stillPresent.length > 0
) {
  if (missing.length > 0) {
    console.error(
      `Missing Dashboard Volume Spikes markers: ${missing.join(', ')}`,
    );
  }

  if (stillPresent.length > 0) {
    console.error(
      `Old compact layout is still present: ${stillPresent.join(', ')}`,
    );
  }

  process.exit(1);
}

console.log(
  'NEXUS frontend verified: Dashboard Volume Spikes reference layout v0.1 is present.',
);
