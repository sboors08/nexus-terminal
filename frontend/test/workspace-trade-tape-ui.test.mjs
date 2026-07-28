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

const compactWorkspaceSource =
  workspaceSource.replace(
    /\s+/gu,
    '',
  );

test(
  'connects the Workspace panel to the live trade tape model',
  () => {
    assert.match(
      workspaceSource,
      /buildWorkspaceTradeTape/u,
    );

    assert.match(
      workspaceSource,
      /snapshot:\s*realtimeSnapshot/u,
    );

    assert.match(
      workspaceSource,
      /error:\s*realtime\.error/u,
    );

    assert.match(
      workspaceSource,
      /now:\s*tradeTapeNow/u,
    );

    assert.match(
      workspaceSource,
      /setInterval\([\s\S]*5_000/u,
    );

    assert.equal(
      (
        workspaceSource.match(
          /\{tradeTapePanel\}/gu,
        )
        ?? []
      ).length,
      2,
    );
  },
);

test(
  'removes fabricated tape metrics and the disconnected preview placeholder',
  () => {
    assert.doesNotMatch(
      workspaceSource,
      /42 сделки\/с/u,
    );

    assert.doesNotMatch(
      workspaceSource,
      /\+\$184K/u,
    );

    assert.doesNotMatch(
      workspaceSource,
      /Реальная лента принтов для произвольной монеты[\s\S]*ещё не подключена/u,
    );

    assert.match(
      compactWorkspaceSource,
      /tradeTape\.metrics\.tradeRate/u,
    );

    assert.match(
      compactWorkspaceSource,
      /tradeTape\.metrics\.deltaQuoteValue/u,
    );

    assert.match(
      compactWorkspaceSource,
      /tradeTape\.metrics\.accelerationPct/u,
    );

    assert.match(
      compactWorkspaceSource,
      /tradeTape\.metrics\.buySharePct/u,
    );

    assert.match(
      compactWorkspaceSource,
      /formatTapePercent\(tradeTape\.metrics\.buySharePct,false,\)/u,
    );
  },
);

test(
  'shows freshness, retry, empty, stale, and large-print UI states',
  () => {
    assert.match(
      compactWorkspaceSource,
      /tradeTape\.freshness\.label/u,
    );

    assert.match(
      compactWorkspaceSource,
      /tradeTape\.freshness\.lastUpdatedLabel/u,
    );

    assert.match(
      workspaceSource,
      /realtime\.reconnect/u,
    );

    assert.match(
      workspaceSource,
      /print\.isLarge/u,
    );

    for (
      const className
      of [
        'tapeStatus',
        'tapeNotice',
        'tapeEmpty',
        'tapeRetry',
        'largePrintRow',
        'largePrintBadge',
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
  },
);
