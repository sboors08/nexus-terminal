import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root =
  process.cwd();

const requiredFiles = [
  'src/pages/ReplayPage.tsx',
  'src/pages/ReplayPage.module.css',
  'src/features/replay/replayData.ts',
  'src/shared/api/mock/nexusMockApi.ts',
  'src/shared/ui/SetupStageBadge.tsx',
  'test/replay-data-integrity.test.mjs',
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

if (
  missingFiles.length > 0
) {
  console.error(
    `Missing Replay files: ${missingFiles.join(', ')}`,
  );

  process.exit(
    1,
  );
}

const [
  pageSource,
  cssSource,
  replaySource,
  apiSource,
  badgeSource,
  testSource,
  packageSource,
] = await Promise.all([
  readFile(
    resolve(
      root,
      'src/pages/ReplayPage.tsx',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'src/pages/ReplayPage.module.css',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'src/features/replay/replayData.ts',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'src/shared/api/mock/nexusMockApi.ts',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'src/shared/ui/SetupStageBadge.tsx',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'test/replay-data-integrity.test.mjs',
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

const corpus = [
  pageSource,
  cssSource,
  replaySource,
  apiSource,
  badgeSource,
  testSource,
  packageSource,
].join(
  '\n',
);

const requiredMarkers = [
  'Сценарный Replay · программно сгенерированные TEST DATA',
  'TEST DATA: программно сгенерированный Replay',
  'Это не сохранённая запись Binance и не архив потока Setup Engine',
  'Fixture-график без будущих кадров',
  'Fixture-лента принтов',
  'Fixture-карта ликвидности',
  '.dataNotice',
  'const DETECTED_FRAME_INDEX = 5;',
  'frameIndex: DETECTED_FRAME_INDEX',
  'timestamp: candles[DETECTED_FRAME_INDEX].timestamp',
  'detectedFrameIndex + 1',
  '? candle.high',
  ': candle.low',
  '? candle.low',
  ': candle.high',
  'visibleCandles.flatMap',
  'visibleCandles.map',
  'timeframeToMinutes(',
  'viewSession.timeframe',
  "'Ложный пробой'",
  "'Уровень удержан'",
  'stageResultLabel',
  'test/replay-data-integrity.test.mjs',
  '"verify:replay-integrity"',
];

const missingMarkers =
  requiredMarkers.filter(
    (marker) =>
      !corpus.includes(
        marker,
      ),
  );

const forbiddenPageMarkers = [
  'Историческое воспроизведение · тестовые данные',
  '<span>Касания</span>',
  '<span>Сила к BTC</span>',
  '<span>Корреляция BTC</span>',
  '+2.7%',
  '-1.9%',
  '<strong>0.82</strong>',
  'const allPrices = session.candles',
  'const maxVolume = Math.max(...session.candles',
];

const presentForbiddenMarkers =
  forbiddenPageMarkers.filter(
    (marker) =>
      pageSource.includes(
        marker,
      ),
  );

const configStart =
  replaySource.indexOf(
    'const SESSION_CONFIGS',
  );

const configEnd =
  replaySource.indexOf(
    '\n];',
    configStart,
  );

const configSource =
  configStart >= 0
    && configEnd >= 0
    ? replaySource.slice(
        configStart,
        configEnd,
      )
    : '';

const duplicateMetrics = [
  ...configSource.matchAll(
    /\b(?:maxMovePct|adverseMovePct):/gu,
  ),
];

const replayIds = [
  ...configSource.matchAll(
    /^\s{4}id: '(replay-[^']+)',/gmu,
  ),
].map(
  (match) =>
    match[1],
);

const setupIds = [
  ...configSource.matchAll(
    /^\s{4}setupId: '([^']+)',/gmu,
  ),
].map(
  (match) =>
    match[1],
);

const hasUniqueReplayIds =
  replayIds.length === 6
    && new Set(
      replayIds,
    ).size === replayIds.length;

const hasUniqueSetupIds =
  setupIds.length === 6
    && new Set(
      setupIds,
    ).size === setupIds.length;

if (
  missingMarkers.length > 0
  || presentForbiddenMarkers.length > 0
  || duplicateMetrics.length > 0
  || !hasUniqueReplayIds
  || !hasUniqueSetupIds
) {
  if (
    missingMarkers.length > 0
  ) {
    console.error(
      `Missing Replay markers: ${missingMarkers.join(', ')}`,
    );
  }

  if (
    presentForbiddenMarkers.length > 0
  ) {
    console.error(
      `Forbidden Replay markers remain: ${presentForbiddenMarkers.join(', ')}`,
    );
  }

  if (
    duplicateMetrics.length > 0
  ) {
    console.error(
      'Replay SESSION_CONFIGS still contains duplicated result metrics.',
    );
  }

  if (
    !hasUniqueReplayIds
  ) {
    console.error(
      `Expected 6 unique Replay IDs, found ${replayIds.length}.`,
    );
  }

  if (
    !hasUniqueSetupIds
  ) {
    console.error(
      `Expected 6 unique Replay setup IDs, found ${setupIds.length}.`,
    );
  }

  process.exitCode = 1;
} else {
  console.log(
    'NEXUS frontend verified: Replay Data Integrity v0.1 is present.',
  );
}