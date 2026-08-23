import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function readSource(relativePath) {
  return fs.readFileSync(
    new URL(
      relativePath,
      import.meta.url,
    ),
    'utf8',
  ).replace(
    /\r\n/g,
    '\n',
  );
}

function readSection(
  source,
  startMarker,
  endMarker,
) {
  const start =
    source.indexOf(
      startMarker,
    );

  const end =
    source.indexOf(
      endMarker,
      start,
    );

  assert.notEqual(
    start,
    -1,
    `Missing section start: ${startMarker}`,
  );

  assert.notEqual(
    end,
    -1,
    `Missing section end: ${endMarker}`,
  );

  return source.slice(
    start,
    end,
  );
}

const pageSource =
  readSource(
    '../src/pages/ReplayPage.tsx',
  );

const cssSource =
  readSource(
    '../src/pages/ReplayPage.module.css',
  );

const replaySource =
  readSource(
    '../src/features/replay/replayData.ts',
  );

const apiSource =
  readSource(
    '../src/shared/api/mock/nexusMockApi.ts',
  );

const badgeSource =
  readSource(
    '../src/shared/ui/SetupStageBadge.tsx',
  );

const configSource =
  readSection(
    replaySource,
    'const SESSION_CONFIGS',
    '\n];',
  );

const metricFunctionSource =
  readSection(
    replaySource,
    'function calculateDirectionalMoves(',
    '\nfunction createCandles(',
  );

test(
  'labels Replay as deterministic frontend fixture data',
  () => {
    assert.match(
      pageSource,
      /Сценарный Replay · программно сгенерированные TEST DATA/u,
    );

    assert.match(
      pageSource,
      /TEST DATA: программно сгенерированный Replay/u,
    );

    assert.match(
      pageSource,
      /Это не сохранённая запись Binance и не архив потока Setup Engine/u,
    );

    assert.match(
      pageSource,
      /Fixture-график без будущих кадров/u,
    );

    assert.match(
      pageSource,
      /Fixture-лента принтов/u,
    );

    assert.match(
      pageSource,
      /Fixture-карта ликвидности/u,
    );

    assert.match(
      cssSource,
      /\.dataNotice \{/u,
    );

    assert.doesNotMatch(
      pageSource,
      /Историческое воспроизведение · тестовые данные/u,
    );

    assert.doesNotMatch(
      pageSource,
      /<span>Касания<\/span>|<span>Сила к BTC<\/span>|<span>Корреляция BTC<\/span>|\+2\.7%|-1\.9%|<strong>0\.82<\/strong>/u,
    );
  },
);

test(
  'prevents future candles from affecting chart price and volume scales',
  () => {
    assert.match(
      pageSource,
      /const allPrices = visibleCandles\.flatMap/u,
    );

    assert.match(
      pageSource,
      /const maxVolume = Math\.max\(\.\.\.visibleCandles\.map/u,
    );

    assert.doesNotMatch(
      pageSource,
      /const allPrices = session\.candles/u,
    );

    assert.doesNotMatch(
      pageSource,
      /const maxVolume = Math\.max\(\.\.\.session\.candles/u,
    );
  },
);

test(
  'aligns Replay candles and detection event to the declared timeframe',
  () => {
    assert.match(
      replaySource,
      /const DETECTED_FRAME_INDEX = 5;/u,
    );

    assert.match(
      replaySource,
      /timeframeToMinutes\(\s*config\.timeframe,?\s*\)/u,
    );

    assert.match(
      replaySource,
      /addMinutes\(\s*config\.detectedAt,\s*-DETECTED_FRAME_INDEX\s*\*\s*timeframeMinutes/u,
    );

    assert.match(
      replaySource,
      /addMinutes\(\s*startedAt,\s*index\s*\*\s*timeframeMinutes/u,
    );

    assert.match(
      replaySource,
      /frameIndex: DETECTED_FRAME_INDEX,/u,
    );

    assert.match(
      replaySource,
      /timestamp: candles\[DETECTED_FRAME_INDEX\]\.timestamp,/u,
    );

    assert.match(
      apiSource,
      /timeframeToMinutes\(\s*viewSession\.timeframe,?\s*\)\s*\*\s*60_000\s*-\s*1/u,
    );
  },
);

test(
  'derives favorable and adverse moves from post-detection candle extremes',
  () => {
    assert.match(
      metricFunctionSource,
      /detectedFrameIndex \+ 1/u,
    );

    assert.match(
      metricFunctionSource,
      /\? candle\.high\s*: candle\.low/u,
    );

    assert.match(
      metricFunctionSource,
      /\? candle\.low\s*: candle\.high/u,
    );

    assert.match(
      metricFunctionSource,
      /\.\.\.favorableMoves/u,
    );

    assert.match(
      metricFunctionSource,
      /\.\.\.adverseMoves/u,
    );

    assert.doesNotMatch(
      metricFunctionSource,
      /\bcandle\.close\b/u,
    );

    assert.doesNotMatch(
      configSource,
      /\b(?:maxMovePct|adverseMovePct):/u,
    );
  },
);

test(
  'keeps Replay fixture and setup identifiers unique',
  () => {
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

    assert.equal(
      replayIds.length,
      6,
    );

    assert.equal(
      setupIds.length,
      6,
    );

    assert.equal(
      new Set(
        replayIds,
      ).size,
      replayIds.length,
    );

    assert.equal(
      new Set(
        setupIds,
      ).size,
      setupIds.length,
    );
  },
);

test(
  'shows failed result labels only after the triggered stage',
  () => {
    assert.match(
      badgeSource,
      /\| 'Ложный пробой'/u,
    );

    assert.match(
      badgeSource,
      /\| 'Уровень удержан'/u,
    );

    assert.match(
      pageSource,
      /stage === 'triggered'\s*\? session\.resultLabel/u,
    );

    assert.match(
      pageSource,
      /resultLabel=\{stageResultLabel\}/u,
    );

    assert.match(
      pageSource,
      /Открыть текущий Workspace/u,
    );
  },
);

test(
  'routes production Replay to factual persistent lifecycle runtime data',
  () => {
    const routesSource =
      readSource(
        '../src/app/routing/AppRoutes.tsx',
      );

    const runtimePageSource =
      readSource(
        '../src/pages/ReplayRuntimePage.tsx',
      );

    assert.match(
      routesSource,
      /ReplayPage \} from '@\/pages\/ReplayRuntimePage'/u,
    );

    assert.doesNotMatch(
      routesSource,
      /ReplayPage \} from '@\/pages\/ReplayPage'/u,
    );

    assert.match(
      runtimePageSource,
      /fetchSetupReplayRuntimeView/u,
    );

    assert.match(
      runtimePageSource,
      /REAL RUNTIME DATA: persisted Setup lifecycle frames/u,
    );

    assert.match(
      runtimePageSource,
      /Свечи, aggTrade, исторический стакан и PnL/u,
    );

    for (
      const forbidden
      of [
        'REPLAY_SESSIONS',
        'createCandles',
        'maxMovePct',
        'adverseMovePct',
        'session.candles',
        'session.result',
        'Fixture-график',
        'Fixture-лента',
        'Fixture-карта',
      ]
    ) {
      assert.equal(
        runtimePageSource.includes(
          forbidden,
        ),
        false,
        `Runtime Replay page must not use ${forbidden}`,
      );
    }
  },
);

test(
  'parses and fetches the versioned factual Setup Replay runtime contract',
  async () => {
    const {
      buildSetupReplayRuntimeUrl,
      fetchSetupReplayRuntimeView,
      getSetupReplayRuntimeSetupLabel,
      parseSetupReplayRuntimeResponse,
    } = await import(
      '../node_modules/.tmp/realtime-test/api/runtime/setupReplayRuntimeApi.js'
    );

    const payload = {
      version:
        'real-setup-replay-v0.1',

      source: {
        state:
          'running',

        eventsCount:
          3,

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
            '2026-08-23T09:30:00.000Z',

          lastErrorCode:
            null,
        },
      },

      capabilities: {
        lifecycleFrames:
          true,

        eventSnapshotPrices:
          true,

        candles:
          false,

        aggTrades:
          false,

        orderBook:
          false,

        pnl:
          false,
      },

      session: {
        id:
          'setup-replay:setup-sol-runtime-replay',

        setupId:
          'setup-sol-runtime-replay',

        candidateId:
          'setup-sol-runtime-replay',

        symbol:
          'SOLUSDT',

        timeframe:
          '1m',

        setupType:
          'level_breakout',

        direction:
          'long',

        detectedAt:
          '2026-08-23T09:20:00.000Z',

        firstRetainedAt:
          '2026-08-23T09:20:00.000Z',

        latestEventAt:
          '2026-08-23T09:25:00.000Z',

        completedAt:
          '2026-08-23T09:25:00.000Z',

        result:
          'breakout_confirmed',

        historyComplete:
          true,

        firstEventId:
          1,

        lastEventId:
          2,

        frameCount:
          2,

        episodeId:
          'setup-sol-runtime-replay',

        lineId:
          'line-sol-runtime-replay',

        frames: [
          {
            index:
              0,

            eventId:
              1,

            type:
              'candidate_created',

            occurredAt:
              '2026-08-23T09:20:00.000Z',

            previousStage:
              null,

            currentStage:
              'LEVEL_CONFIRMED',

            outcome:
              null,

            currentPrice:
              99.4,

            distanceToLevelPct:
              0.6,

            snapshotUpdatedAt:
              '2026-08-23T09:20:00.000Z',

            expiresAt:
              '2026-08-23T10:20:00.000Z',

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
                2,

              confirmedAt:
                '2026-08-23T09:15:00.000Z',
            },

            episodeId:
              'setup-sol-runtime-replay',

            lineId:
              'line-sol-runtime-replay',
          },
          {
            index:
              1,

            eventId:
              2,

            type:
              'breakout_confirmed',

            occurredAt:
              '2026-08-23T09:25:00.000Z',

            previousStage:
              'THIRD_TOUCH_CONFIRMED',

            currentStage:
              'BREAKOUT_CONFIRMED',

            outcome:
              'breakout',

            currentPrice:
              100.4,

            distanceToLevelPct:
              0.4,

            snapshotUpdatedAt:
              '2026-08-23T09:25:00.000Z',

            expiresAt:
              '2026-08-23T10:20:00.000Z',

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
                '2026-08-23T09:15:00.000Z',
            },

            episodeId:
              'setup-sol-runtime-replay',

            lineId:
              'line-sol-runtime-replay',
          },
        ],
      },
    };

    const parsed =
      parseSetupReplayRuntimeResponse(
        payload,
      );

    assert.equal(
      parsed.session.frameCount,
      2,
    );

    assert.equal(
      parsed.session.frames[1].currentPrice,
      100.4,
    );

    assert.equal(
      parsed.capabilities.candles,
      false,
    );

    assert.equal(
      getSetupReplayRuntimeSetupLabel(
        parsed.session,
        parsed.session.frames[0],
      ),
      'Пробой сопротивления',
    );

    assert.equal(
      buildSetupReplayRuntimeUrl(
        'setup-sol-runtime-replay',
        {
          baseUrl:
            'http://localhost:4100/',
        },
      ),
      'http://localhost:4100/api/v1/setups/candidates/setup-sol-runtime-replay/replay',
    );

    let requestedUrl =
      '';

    const fetched =
      await fetchSetupReplayRuntimeView(
        'setup-sol-runtime-replay',
        {
          baseUrl:
            'http://localhost:4100',

          fetcher:
            async (
              url,
            ) => {
              requestedUrl =
                String(
                  url,
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
        },
      );

    assert.equal(
      requestedUrl,
      'http://localhost:4100/api/v1/setups/candidates/setup-sol-runtime-replay/replay',
    );

    assert.equal(
      fetched.session.result,
      'breakout_confirmed',
    );

    assert.throws(
      () =>
        parseSetupReplayRuntimeResponse({
          ...payload,
          version:
            'real-setup-replay-v9',
        }),
      /Unsupported Setup Replay runtime contract version/u,
    );
  },
);
