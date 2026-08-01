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