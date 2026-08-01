import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root =
  process.cwd();

const requiredFiles = [
  'src/pages/MarketHistoryPage.tsx',
  'src/pages/MarketHistoryPage.module.css',
  'src/features/market-history/marketHistoryData.ts',
  'src/features/replay/replayData.ts',
  'test/market-history-data-integrity.test.mjs',
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

const [
  pageSource,
  cssSource,
  historySource,
  replaySource,
  testSource,
  packageSource,
] = await Promise.all([
  readFile(
    resolve(
      root,
      'src/pages/MarketHistoryPage.tsx',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'src/pages/MarketHistoryPage.module.css',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'src/features/market-history/marketHistoryData.ts',
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
      'test/market-history-data-integrity.test.mjs',
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

const requiredMarkers = [
  'Fixture-архив сетапов · тестовые результаты и Replay',
  'Fixture-снимок: 15.07.26 · 17:32 UTC',
  'TEST DATA: результаты, метрики, графики, выводы и Replay',
  'Lifecycle-события Setup Engine пока не преобразуются',
  '[direction, historyItems, result, search, setupType, sortKey, timeframe]',
  'successfulMoves.length > 0',
  'formatSignedPercent(averageMove)',
  'доступных тестовых сценариев',
  'Открыть тестовый Replay →',
  '.dataNotice',
  'test/market-history-data-integrity.test.mjs',
  '"verify:market-history-integrity"',
];

const corpus = [
  pageSource,
  cssSource,
  historySource,
  replaySource,
  testSource,
  packageSource,
].join(
  '\n',
);

const missingMarkers =
  requiredMarkers.filter(
    (marker) =>
      !corpus.includes(
        marker,
      ),
  );

const legacyMarkers = [
  'Обновлено 15.07.26 · 17:32 UTC',
  'историй с полным воспроизведением',
  '                Открыть Replay →',
];

const presentLegacyMarkers =
  legacyMarkers.filter(
    (marker) =>
      pageSource.includes(
        marker,
      ),
  );

const historyReplayIds = [
  ...historySource.matchAll(
    /replayId: '(replay-[^']+)'/gu,
  ),
].map(
  (match) =>
    match[1],
);

const replaySessionIds = [
  ...replaySource.matchAll(
    /\bid: '(replay-[^']+)'/gu,
  ),
].map(
  (match) =>
    match[1],
);

const missingReplaySessions =
  historyReplayIds.filter(
    (id) =>
      !replaySessionIds.includes(
        id,
      ),
  );

const historyBlocks = [
  ...historySource.matchAll(
    /\{\n\s+id: '(history-[^']+)',([\s\S]*?)\n\s+\},/gu,
  ),
];

const inconsistentHistoryItems =
  historyBlocks.flatMap(
    (match) => {
      const id =
        match[1];

      const block =
        match[2];

      const replayId =
        block.match(
          /replayId: ('[^']+'|null)/u,
        )?.[1];

      const replayAvailable =
        block.match(
          /replayAvailable: (true|false)/u,
        )?.[1];

      if (
        !replayId
        || !replayAvailable
      ) {
        return [
          id,
        ];
      }

      const hasReplayId =
        replayId
          !== 'null';

      const isAvailable =
        replayAvailable
          === 'true';

      return hasReplayId
        === isAvailable
        ? []
        : [
            id,
          ];
    },
  );

if (
  missingFiles.length > 0
  || missingMarkers.length > 0
  || presentLegacyMarkers.length > 0
  || missingReplaySessions.length > 0
  || inconsistentHistoryItems.length > 0
  || historyReplayIds.length !== 6
  || historyBlocks.length !== 12
) {
  if (
    missingFiles.length > 0
  ) {
    console.error(
      `Missing Market History files: ${missingFiles.join(', ')}`,
    );
  }

  if (
    missingMarkers.length > 0
  ) {
    console.error(
      `Missing Market History markers: ${missingMarkers.join(', ')}`,
    );
  }

  if (
    presentLegacyMarkers.length > 0
  ) {
    console.error(
      `Legacy Market History markers remain: ${presentLegacyMarkers.join(', ')}`,
    );
  }

  if (
    missingReplaySessions.length > 0
  ) {
    console.error(
      `Missing Replay sessions: ${missingReplaySessions.join(', ')}`,
    );
  }

  if (
    inconsistentHistoryItems.length > 0
  ) {
    console.error(
      `Inconsistent Replay flags: ${inconsistentHistoryItems.join(', ')}`,
    );
  }

  if (
    historyReplayIds.length !== 6
  ) {
    console.error(
      `Expected 6 valid history Replay links, found ${historyReplayIds.length}`,
    );
  }

  if (
    historyBlocks.length !== 12
  ) {
    console.error(
      `Expected 12 Market History fixtures, found ${historyBlocks.length}`,
    );
  }

  process.exitCode = 1;
} else {
  console.log(
    'NEXUS frontend verified: Market History Data Integrity v0.1 is present.',
  );
}