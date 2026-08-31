import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const componentSource = fs.readFileSync(
  new URL(
    '../src/shared/charts/ui/NexusLiquidationHeatmap.tsx',
    import.meta.url,
  ),
  'utf8',
);
const componentStyles = fs.readFileSync(
  new URL(
    '../src/shared/charts/ui/NexusLiquidationHeatmap.module.css',
    import.meta.url,
  ),
  'utf8',
);
const workspaceSource = fs.readFileSync(
  new URL(
    '../src/pages/WorkspacePage.tsx',
    import.meta.url,
  ),
  'utf8',
);
const hookSource = fs.readFileSync(
  new URL(
    '../src/shared/realtime/useLiquidationHeatmap.ts',
    import.meta.url,
  ),
  'utf8',
);

test(
  'renders time-price heat cells with market candles and observed forceOrder events',
  () => {
    assert.match(componentSource, /visibleCandles\.map/u);
    assert.match(componentSource, /heatCells\.map/u);
    assert.match(componentSource, /visibleHistoryBuckets/u);
    assert.match(componentSource, /observedEvents\.map/u);
    assert.match(componentSource, /resolveLiquidationHeatColor/u);
    assert.match(componentSource, /Карта ликвидаций/u);
  },
);

test(
  'discloses facts and estimates without claiming CoinGlass data',
  () => {
    assert.match(componentSource, /Binance forceOrder \+ NEXUS model/u);
    assert.match(componentSource, /ОЦЕНКА NEXUS/u);
    assert.match(
      componentSource,
      /Будущие зоны — оценка модели NEXUS, не биржевой факт/u,
    );
    assert.doesNotMatch(componentSource, /CoinGlass/u);
    assert.doesNotMatch(componentSource, /Math\.random/u);
  },
);

test(
  'supports collecting, degraded, live, and error states',
  () => {
    for (const marker of [
      'СБОР ДАННЫХ',
      'ДАННЫЕ УСТАРЕЛИ',
      'LIVE',
      'НЕТ ДАННЫХ',
    ]) {
      assert.match(componentSource, new RegExp(marker, 'u'));
    }

    assert.match(componentSource, /onRetry/u);
  },
);

test(
  'keeps the heatmap responsive and the depth map internal',
  () => {
    assert.match(componentSource, /viewBox/u);
    assert.match(componentStyles, /@media \(max-width: 620px\)/u);
    assert.match(workspaceSource, /buildWorkspaceLiquidityMap/u);
    assert.match(workspaceSource, /buildWorkspaceMarketDynamics/u);
    assert.match(workspaceSource, /NexusLiquidationHeatmap/u);
  },
);

test(
  'supports TradingView-style pan, wheel zoom, price scaling, and reset',
  () => {
    assert.match(componentSource, /onWheel=\{handleWheel\}/u);
    assert.match(componentSource, /onPointerDown=\{handlePointerDown\}/u);
    assert.match(componentSource, /mode: 'pan' \| 'price-scale'/u);
    assert.match(componentSource, /setPointerCapture/u);
    assert.match(componentSource, /onDoubleClick=\{resetViewport\}/u);
    assert.match(componentSource, /ЛКМ — двигать/u);
    assert.match(componentSource, /шкала цены — высота/u);
    assert.match(componentStyles, /touch-action: none/u);
    assert.match(componentStyles, /cursor: ns-resize/u);
  },
);

test(
  'uses a candle-focused scale and maps finite history buckets to time',
  () => {
    assert.match(componentSource, /relevantDistance/u);
    assert.match(componentSource, /bucketStart/u);
    assert.match(componentSource, /bucketEnd/u);
    assert.match(componentSource, /timeX/u);
    assert.doesNotMatch(componentSource, /width=\{scene\.plotWidth\}[\s\S]{0,160}zone\.intensity/u);
    assert.match(componentSource, /clipPath/u);
  },
);

test(
  'loads history once and merges bounded two-bucket polling deltas',
  () => {
    assert.match(hookSource, /initial[\s\S]*historyLimit[\s\S]*: 2/u);
    assert.match(hookSource, /new Map/u);
    assert.match(hookSource, /slice\(-historyLimit\)/u);
  },
);
