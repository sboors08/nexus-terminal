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

test(
  'routes the user Market History screen to persistent runtime data',
  async () => {
    const routesSource =
      fs.readFileSync(
        new URL(
          '../src/app/routing/AppRoutes.tsx',
          import.meta.url,
        ),
        'utf8',
      ).replace(
        /\r\n/g,
        '\n',
      );

    const runtimePageSource =
      fs.readFileSync(
        new URL(
          '../src/pages/MarketHistoryRuntimePage.tsx',
          import.meta.url,
        ),
        'utf8',
      ).replace(
        /\r\n/g,
        '\n',
      );

    assert.match(
      routesSource,
      /MarketHistoryPage \} from '@\/pages\/MarketHistoryRuntimePage'/u,
    );

    assert.doesNotMatch(
      routesSource,
      /MarketHistoryPage \} from '@\/pages\/MarketHistoryPage'/u,
    );

    assert.match(
      runtimePageSource,
      /fetchMarketHistoryRuntimeView/u,
    );

    assert.match(
      runtimePageSource,
      /useSetupLifecycleRefresh/u,
    );

    assert.match(
      runtimePageSource,
      /REAL RUNTIME DATA: Setup lifecycle history/u,
    );

    assert.match(
      runtimePageSource,
      /buildReplayUrl/u,
    );

    assert.match(
      runtimePageSource,
      />\s*Replay\s*<\/Link>/u,
    );

    for (
      const forbidden
      of [
        'MARKET_HISTORY_ITEMS',
        'maxMovePct',
        'adverseMovePct',
        'timeToTargetSec',
        'chartPoints',
      ]
    ) {
      assert.equal(
        runtimePageSource.includes(
          forbidden,
        ),
        false,
        `Runtime Market History page must not use ${forbidden}`,
      );
    }
  },
);

test(
  'parses and fetches the versioned Market History runtime contract',
  async () => {
    const {
      buildMarketHistoryRuntimeUrl,
      fetchMarketHistoryRuntimeView,
      getMarketHistoryRuntimeSetupLabel,
      parseMarketHistoryRuntimeResponse,
    } = await import(
      '../node_modules/.tmp/realtime-test/api/runtime/marketHistoryRuntimeApi.js'
    );

    const payload = {
      version:
        'market-history-runtime-v0.1',

      source: {
        state:
          'running',

        eventsCount:
          2,

        droppedEventsCount:
          0,

        persistence: {
          state:
            'ready',

          version:
            1,

          hydrated:
            true,

          writable:
            true,

          lastPersistedAt:
            '2026-08-23T08:10:00.000Z',

          lastErrorCode:
            null,
        },
      },

      items: [
        {
          id:
            'setup-sol-runtime-history',

          setupId:
            'setup-sol-runtime-history',

          symbol:
            'SOLUSDT',

          timeframe:
            '1m',

          setupType:
            'level_breakout',

          direction:
            'long',

          detectedAt:
            '2026-08-23T08:00:00.000Z',

          latestEventAt:
            '2026-08-23T08:05:00.000Z',

          completedAt:
            '2026-08-23T08:05:00.000Z',

          expiresAt:
            '2026-08-23T09:00:00.000Z',

          result:
            'breakout_confirmed',

          stageAtDetection:
            'LEVEL_CONFIRMED',

          currentStage:
            'BREAKOUT_CONFIRMED',

          outcome:
            'breakout',

          detectedPrice:
            99.4,

          currentPrice:
            100.4,

          distanceToLevelPct:
            0.4,

          level: {
            kind:
              'resistance',

            centerPrice:
              100,

            zoneLow:
              99.8,

            zoneHigh:
              100.2,

            touches:
              3,

            confirmedAt:
              '2026-08-23T07:55:00.000Z',
          },

          firstEventId:
            1,

          lastEventId:
            2,

          lifecycleEventCount:
            2,

          historyComplete:
            true,

          episodeId:
            'setup-sol-runtime-history',

          lineId:
            'line-sol-runtime-history',

          lifecycle: [
            {
              eventId:
                1,

              type:
                'candidate_created',

              occurredAt:
                '2026-08-23T08:00:00.000Z',

              previousStage:
                null,

              currentStage:
                'LEVEL_CONFIRMED',

              outcome:
                null,
            },
            {
              eventId:
                2,

              type:
                'breakout_confirmed',

              occurredAt:
                '2026-08-23T08:05:00.000Z',

              previousStage:
                'THIRD_TOUCH_CONFIRMED',

              currentStage:
                'BREAKOUT_CONFIRMED',

              outcome:
                'breakout',
            },
          ],
        },
      ],
    };

    const parsed =
      parseMarketHistoryRuntimeResponse(
        payload,
      );

    assert.equal(
      parsed.items.length,
      1,
    );

    assert.equal(
      getMarketHistoryRuntimeSetupLabel(
        parsed.items[0],
      ),
      'Пробой сопротивления',
    );

    assert.equal(
      buildMarketHistoryRuntimeUrl({
        baseUrl:
          'http://localhost:4100/',

        limit:
          250,
      }),
      'http://localhost:4100/api/v1/setups/history?limit=250',
    );

    let requestedUrl = '';

    const fetched =
      await fetchMarketHistoryRuntimeView({
        baseUrl:
          'http://localhost:4100',

        fetcher:
          async (
            input,
            init,
          ) => {
            requestedUrl =
              String(input);

            assert.equal(
              init?.method,
              'GET',
            );

            return new Response(
              JSON.stringify(
                payload,
              ),
              {
                status:
                  200,

                headers: {
                  'content-type':
                    'application/json',
                },
              },
            );
          },
      });

    assert.equal(
      requestedUrl,
      'http://localhost:4100/api/v1/setups/history?limit=500',
    );

    assert.equal(
      fetched.source
        .persistence
        ?.state,
      'ready',
    );

    const unsupported = {
      ...payload,
      version:
        'market-history-runtime-v9',
    };

    assert.throws(
      () =>
        parseMarketHistoryRuntimeResponse(
          unsupported,
        ),
      /Unsupported Market History runtime contract version/u,
    );
  },
);
