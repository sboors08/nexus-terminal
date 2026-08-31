import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspaceSource =
  fs
    .readFileSync(
      new URL(
        '../src/pages/WorkspacePage.tsx',
        import.meta.url,
      ),
      'utf8',
    )
    .replace(
      /\r\n/g,
      '\n',
    );

const workspaceStyles =
  fs
    .readFileSync(
      new URL(
        '../src/pages/WorkspacePage.module.css',
        import.meta.url,
      ),
      'utf8',
    )
    .replace(
      /\r\n/g,
      '\n',
    );

const compactSource =
  workspaceSource.replace(
    /\s+/gu,
    '',
  );

test(
  'keeps the dedicated order book stream as an internal NEXUS input',
  () => {
    assert.match(
      workspaceSource,
      /useOrderBookDepth/u,
    );

    assert.match(
      workspaceSource,
      /buildWorkspaceLiquidityMap/u,
    );

    assert.match(
      workspaceSource,
      /resolveWorkspaceLiquidityBucketSize/u,
    );

    assert.match(
      compactSource,
      /symbol:selectedSetup\.symbol/u,
    );

    assert.match(
      compactSource,
      /snapshot:orderBook\.snapshot/u,
    );

    assert.match(
      compactSource,
      /status:orderBook\.status/u,
    );

    assert.match(
      compactSource,
      /buildWorkspaceMarketDynamics\(\{tradeTape,liquidityMap,\}\)/u,
    );
  },
);

test(
  'replaces the visible depth panel with the liquidation heatmap',
  () => {
    assert.equal(
      (
        workspaceSource.match(
          /\{liquidationHeatmapPanel\}/gu,
        )
        ?? []
      ).length,
      2,
    );

    assert.match(
      workspaceSource,
      /NexusLiquidationHeatmap/u,
    );

    assert.doesNotMatch(
      workspaceSource,
      /const liquidityMapPanel/u,
    );
  },
);

test(
  'removes the fabricated Workspace liquidity rows and disconnected placeholder',
  () => {
    assert.doesNotMatch(
      workspaceSource,
      /liquidity\.slice/u,
    );

    assert.doesNotMatch(
      workspaceSource,
      /mapReferencePrice/u,
    );

    assert.doesNotMatch(
      workspaceSource,
      /Плотности и изменения стакана не показываются/u,
    );

    assert.doesNotMatch(
      workspaceSource,
      /НЕ ПОДКЛЮЧЕНО/u,
    );
  },
);

test(
  'keeps an adaptive panel slot for the liquidation heatmap',
  () => {
    assert.match(
      workspaceStyles,
      /\.liquidationHeatmapPanel\b/u,
    );

    assert.match(
      workspaceStyles,
      /@media \(max-width: 820px\)/u,
    );
  },
);
