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
  'connects Workspace to the live setup confirmation model',
  () => {
    assert.match(
      workspaceSource,
      /buildWorkspaceSetupConfirmation/u,
    );

    assert.match(
      compactSource,
      /buildWorkspaceSetupConfirmation\(\{direction:selectedSetup\.direction,marketDynamics,\}\)/u,
    );

    assert.match(
      compactSource,
      /setupConfirmation\.freshness\.label/u,
    );

    assert.match(
      compactSource,
      /setupConfirmation\.statusLabel/u,
    );

    assert.match(
      compactSource,
      /setupConfirmation\.directionalPressurePct/u,
    );
  },
);

test(
  'replaces the disconnected trigger placeholder with live confirmation',
  () => {
    assert.doesNotMatch(
      workspaceSource,
      /Привязка потока принтов к сетапу будет добавлена отдельно/u,
    );

    assert.match(
      workspaceSource,
      /Live-поток подтверждает направление/u,
    );

    assert.match(
      compactSource,
      /setupConfirmation\.isLiveConfirmation\?'passed'/u,
    );

    assert.match(
      compactSource,
      /setupConfirmation\.blockingCount>0\?'warning':'waiting'/u,
    );
  },
);

test(
  'renders confirmation status, evidence, freshness, and reasons in the NEXUS panel',
  () => {
    assert.match(
      workspaceSource,
      /Live-подтверждение/u,
    );

    assert.match(
      compactSource,
      /setupConfirmation\.checks\.map/u,
    );

    assert.match(
      compactSource,
      /setupConfirmation\.supportCount/u,
    );

    assert.match(
      compactSource,
      /setupConfirmation\.blockingCount/u,
    );

    assert.match(
      workspaceSource,
      /Оценка не меняет стадию Setup Engine автоматически/u,
    );
  },
);

test(
  'supports stale, error, retry, and all setup confirmation visual tones',
  () => {
    assert.match(
      compactSource,
      /setupConfirmation\.freshness\.state==='stale'/u,
    );

    assert.match(
      compactSource,
      /setupConfirmation\.freshness\.state==='error'/u,
    );

    assert.match(
      compactSource,
      /onClick=\{reconnectMarketDynamics\}/u,
    );

    for (
      const className
      of [
        'setupConfirmationSection',
        'setupConfirmationHeader',
        'setupConfirmationBadge',
        'setupConfirmationBadge_positive',
        'setupConfirmationBadge_warning',
        'setupConfirmationBadge_negative',
        'setupConfirmationSummary',
        'setupConfirmationStats',
        'setupConfirmationChecks',
        'setupConfirmationCheck',
        'setupConfirmationDisclaimer',
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
