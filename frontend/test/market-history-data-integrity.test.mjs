import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource =
  fs.readFileSync(
    new URL(
      '../src/pages/MarketHistoryPage.tsx',
      import.meta.url,
    ),
    'utf8',
  ).replace(
    /\r\n/g,
    '\n',
  );

const historySource =
  fs.readFileSync(
    new URL(
      '../src/features/market-history/marketHistoryData.ts',
      import.meta.url,
    ),
    'utf8',
  ).replace(
    /\r\n/g,
    '\n',
  );

const replaySource =
  fs.readFileSync(
    new URL(
      '../src/features/replay/replayData.ts',
      import.meta.url,
    ),
    'utf8',
  ).replace(
    /\r\n/g,
    '\n',
  );

function readReplayIds(
  source,
  pattern,
) {
  return [
    ...source.matchAll(
      pattern,
    ),
  ].map(
    (match) =>
      match[1],
  );
}

function readHistoryBlocks() {
  return [
    ...historySource.matchAll(
      /\{\n\s+id: '(history-[^']+)',([\s\S]*?)\n\s+\},/gu,
    ),
  ].map(
    (match) => ({
      id:
        match[1],

      source:
        match[2],
    }),
  );
}

test(
  'labels Market History as a fixed fixture archive',
  () => {
    assert.match(
      pageSource,
      /Fixture-архив сетапов · тестовые результаты и Replay/u,
    );

    assert.match(
      pageSource,
      /Fixture-снимок: 15\.07\.26 · 17:32 UTC/u,
    );

    assert.match(
      pageSource,
      /TEST DATA: результаты, метрики, графики, выводы и Replay/u,
    );

    assert.match(
      pageSource,
      /Lifecycle-события Setup Engine пока не преобразуются/u,
    );

    assert.doesNotMatch(
      pageSource,
      /Обновлено 15\.07\.26/u,
    );
  },
);

test(
  'keeps Market History summaries safe for empty result groups',
  () => {
    assert.match(
      pageSource,
      /successfulMoves\.length > 0/u,
    );

    assert.match(
      pageSource,
      /: null;/u,
    );

    assert.match(
      pageSource,
      /formatSignedPercent\(averageMove\)/u,
    );

    assert.match(
      pageSource,
      /\[direction, historyItems, result, search, setupType, sortKey, timeframe\]/u,
    );
  },
);

test(
  'links only to Replay sessions that actually exist',
  () => {
    const historyReplayIds =
      readReplayIds(
        historySource,
        /replayId: '(replay-[^']+)'/gu,
      );

    const sessionReplayIds =
      readReplayIds(
        replaySource,
        /\bid: '(replay-[^']+)'/gu,
      );

    assert.equal(
      new Set(
        historyReplayIds,
      ).size,
      historyReplayIds.length,
    );

    assert.deepEqual(
      historyReplayIds.filter(
        (id) =>
          !sessionReplayIds.includes(
            id,
          ),
      ),
      [],
    );

    assert.equal(
      historyReplayIds.length,
      6,
    );
  },
);

test(
  'keeps replayAvailable consistent with every history replayId',
  () => {
    const blocks =
      readHistoryBlocks();

    assert.equal(
      blocks.length,
      12,
    );

    for (
      const block
      of blocks
    ) {
      const replayIdMatch =
        block.source.match(
          /replayId: ('[^']+'|null)/u,
        );

      const availableMatch =
        block.source.match(
          /replayAvailable: (true|false)/u,
        );

      assert.ok(
        replayIdMatch,
        `${block.id} must define replayId`,
      );

      assert.ok(
        availableMatch,
        `${block.id} must define replayAvailable`,
      );

      const hasReplayId =
        replayIdMatch[1]
          !== 'null';

      const isAvailable =
        availableMatch[1]
          === 'true';

      assert.equal(
        isAvailable,
        hasReplayId,
        `${block.id} has inconsistent Replay availability`,
      );
    }

    assert.match(
      pageSource,
      /Открыть тестовый Replay →/u,
    );

    assert.match(
      pageSource,
      /доступных тестовых сценариев/u,
    );
  },
);