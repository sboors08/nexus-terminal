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
  'connects Workspace to the live market dynamics model',
  () => {
    assert.match(
      workspaceSource,
      /buildWorkspaceMarketDynamics/u,
    );

    assert.match(
      compactSource,
      /buildWorkspaceMarketDynamics\(\{tradeTape,liquidityMap,\}\)/u,
    );

    assert.match(
      compactSource,
      /marketDynamics\.freshness\.label/u,
    );

    assert.match(
      compactSource,
      /marketDynamics\.modeLabel/u,
    );

    assert.match(
      compactSource,
      /marketDynamics\.pressureScore/u,
    );

    assert.match(
      workspaceSource,
      /reconnectMarketDynamics/u,
    );
  },
);

test(
  'renders one live dynamics panel in Market preview and Setup Workspace',
  () => {
    assert.equal(
      (
        workspaceSource.match(
          /\{marketDynamicsPanel\}/gu,
        )
        ?? []
      ).length,
      2,
    );

    assert.match(
      compactSource,
      /marketDynamics\.tradeRate/u,
    );

    assert.match(
      compactSource,
      /marketDynamics\.accelerationPct/u,
    );

    assert.match(
      compactSource,
      /marketDynamics\.deltaQuoteValue/u,
    );

    assert.match(
      compactSource,
      /marketDynamics\.buySharePct/u,
    );

    assert.match(
      compactSource,
      /marketDynamics\.bookImbalancePct/u,
    );

    assert.match(
      compactSource,
      /marketDynamics\.spread/u,
    );

    assert.match(
      compactSource,
      /marketDynamics\.buyerPressurePct/u,
    );
  },
);

test(
  'removes fabricated market dynamics after the visible depth panel replacement',
  () => {
    assert.doesNotMatch(
      workspaceSource,
      /ОЖИДАНИЕ ДАННЫХ/u,
    );

    assert.doesNotMatch(
      workspaceSource,
      /ДЕМО-КОНТЕКСТ/u,
    );

    assert.doesNotMatch(
      workspaceSource,
      /marketDynamics\.map/u,
    );

    assert.doesNotMatch(
      workspaceSource,
      /68 \/ 32/u,
    );

    assert.doesNotMatch(
      workspaceSource,
      /const liquidityMapPanel/u,
    );

    assert.match(
      workspaceSource,
      /NexusLiquidationHeatmap/u,
    );
  },
);

test(
  'includes mode, status, pressure, source, and responsive dynamics styles',
  () => {
    for (
      const className
      of [
        'marketDynamicsPanel',
        'marketDynamicsHeaderActions',
        'marketDynamicsDescription',
        'marketMode_positive',
        'marketMode_negative',
        'marketMode_neutral',
        'marketMode_pending',
        'marketMode_error',
        'marketDynamicsFooter',
        'marketDynamicsSource',
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
      compactSource,
      /marketDynamics\.freshness\.state==='stale'/u,
    );

    assert.match(
      compactSource,
      /marketDynamics\.freshness\.state==='error'/u,
    );

    assert.match(
      compactSource,
      /onClick=\{reconnectMarketDynamics\}/u,
    );
  },
);
