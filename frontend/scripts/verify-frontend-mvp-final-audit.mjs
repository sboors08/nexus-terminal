import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root =
  process.cwd();

const requiredFiles = [
  'src/app/layout/AppShell.tsx',
  'src/app/layout/AppShell.module.css',
  'src/pages/ScannerPage.tsx',
  'src/pages/WatchlistPage.tsx',
  'test/frontend-mvp-final-audit.test.mjs',
];

const obsoleteFiles = [
  'src/pages/AppShell.tsx',
  'src/shared/config/navigation.ts',
  'src/shared/ui/RoutePlaceholder.tsx',
  'src/shared/ui/RoutePlaceholder.module.css',
];

const missingFiles = [];

for (
  const file
  of requiredFiles
) {
  try {
    await access(
      resolve(
        root,
        file,
      ),
    );
  } catch {
    missingFiles.push(
      file,
    );
  }
}

const remainingObsoleteFiles = [];

for (
  const file
  of obsoleteFiles
) {
  try {
    await access(
      resolve(
        root,
        file,
      ),
    );

    remainingObsoleteFiles.push(
      file,
    );
  } catch {
    // Expected: obsolete file is absent.
  }
}

if (
  missingFiles.length > 0
) {
  console.error(
    `Missing final frontend audit files: ${missingFiles.join(', ')}`,
  );

  process.exit(
    1,
  );
}

const [
  appShellSource,
  appShellStyles,
  scannerSource,
  watchlistSource,
  testSource,
] = await Promise.all([
  readFile(
    resolve(
      root,
      'src/app/layout/AppShell.tsx',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'src/app/layout/AppShell.module.css',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'src/pages/ScannerPage.tsx',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'src/pages/WatchlistPage.tsx',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'test/frontend-mvp-final-audit.test.mjs',
    ),
    'utf8',
  ),
]);

const corpus = [
  appShellSource,
  appShellStyles,
  scannerSource,
  watchlistSource,
  testSource,
].join(
  '\n',
);

const requiredMarkers = [
  'MVP FRONTEND',
  'Состояние подключения показывается отдельно на каждой странице',
  'environmentStatus',
  'buildMarketWorkspaceUrl(',
  'Алерты пока недоступны',
  'Создание пользовательских алертов из Scanner ещё не подключено',
];

const forbiddenShellMarkers = [
  '<i />LIVE',
  'styles.live',
  'styles.topIcon',
  'styles.avatar',
  'railCollapse',
];

const forbiddenScannerMarkers = [
  'Создать алерт',
  'to={ROUTES.alerts}',
];

const forbiddenWatchlistMarkers = [
  '`${ROUTES.workspace}?symbol=',
];

const missingMarkers =
  requiredMarkers.filter(
    (marker) =>
      !corpus.includes(
        marker,
      ),
  );

const presentShellMarkers =
  forbiddenShellMarkers.filter(
    (marker) =>
      appShellSource.includes(
        marker,
      )
      || appShellStyles.includes(
        marker,
      ),
  );

const presentScannerMarkers =
  forbiddenScannerMarkers.filter(
    (marker) =>
      scannerSource.includes(
        marker,
      ),
  );

const presentWatchlistMarkers =
  forbiddenWatchlistMarkers.filter(
    (marker) =>
      watchlistSource.includes(
        marker,
      ),
  );

if (
  remainingObsoleteFiles.length > 0
  || missingMarkers.length > 0
  || presentShellMarkers.length > 0
  || presentScannerMarkers.length > 0
  || presentWatchlistMarkers.length > 0
) {
  if (
    remainingObsoleteFiles.length > 0
  ) {
    console.error(
      `Obsolete frontend files remain: ${remainingObsoleteFiles.join(', ')}`,
    );
  }

  if (
    missingMarkers.length > 0
  ) {
    console.error(
      `Missing final frontend audit markers: ${missingMarkers.join(', ')}`,
    );
  }

  if (
    presentShellMarkers.length > 0
  ) {
    console.error(
      `Misleading AppShell markers remain: ${presentShellMarkers.join(', ')}`,
    );
  }

  if (
    presentScannerMarkers.length > 0
  ) {
    console.error(
      `Misleading Scanner markers remain: ${presentScannerMarkers.join(', ')}`,
    );
  }

  if (
    presentWatchlistMarkers.length > 0
  ) {
    console.error(
      `Manual Watchlist routing markers remain: ${presentWatchlistMarkers.join(', ')}`,
    );
  }

  process.exitCode =
    1;
} else {
  console.log(
    'NEXUS frontend verified: Frontend MVP Final Audit v0.1 protections are present.',
  );
}