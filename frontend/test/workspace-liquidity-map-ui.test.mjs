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
  'connects Workspace to the dedicated order book stream',
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
      workspaceSource,
      /orderBook\.reconnect/u,
    );
  },
);

test(
  'renders the same live liquidity panel in Market preview and Setup Workspace',
  () => {
    assert.equal(
      (
        workspaceSource.match(
          /\{liquidityMapPanel\}/gu,
        )
        ?? []
      ).length,
      2,
    );

    assert.match(
      compactSource,
      /liquidityMap\.asks\.map/u,
    );

    assert.match(
      compactSource,
      /liquidityMap\.bids\.map/u,
    );

    assert.match(
      compactSource,
      /liquidityMap\.freshness\.label/u,
    );

    assert.match(
      compactSource,
      /liquidityMap\.imbalancePct/u,
    );

    assert.match(
      compactSource,
      /liquidityMap\.bidDepthQuote/u,
    );

    assert.match(
      compactSource,
      /liquidityMap\.askDepthQuote/u,
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
  'includes live, collecting, stale, error, retry, and depth visualization styles',
  () => {
    for (
      const className
      of [
        'liquiditySummary',
        'liquidityHeader',
        'liquidityMap',
        'liquidityRow',
        'liquidityBar',
        'liquidityQuote',
        'liquidityDistance',
        'currentPriceDivider',
        'pressureBlock',
      ]
    ) {
      assert.match(
        workspaceStyles,
        new RegExp(
          `\\.${className}\\b`,
          'u',
        ),
      );
    }

    assert.match(
      workspaceSource,
      /COLLECTING/u,
    );

    assert.match(
      workspaceSource,
      /STALE/u,
    );

    assert.match(
      compactSource,
      /liquidityMap\.freshness\.state==='error'/u,
    );

    assert.match(
      compactSource,
      /liquidityMap\.freshness\.label/u,
    );
  },
);
