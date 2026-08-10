import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspaceSource =
  fs.readFileSync(
    new URL(
      '../src/pages/WorkspacePage.tsx',
      import.meta.url,
    ),
    'utf8',
  ).replace(/\r\n/gu, '\n');

const panelSource =
  fs.readFileSync(
    new URL(
      '../src/shared/level-lines/ui/CausalRealtimeConfirmationPanel.tsx',
      import.meta.url,
    ),
    'utf8',
  ).replace(/\r\n/gu, '\n');

const apiSource =
  fs.readFileSync(
    new URL(
      '../src/shared/api/runtime/levelLinesApi.ts',
      import.meta.url,
    ),
    'utf8',
  ).replace(/\r\n/gu, '\n');

test(
  'renders backend confirmation in the main Workspace NEXUS panel',
  () => {
    const panelIndex =
      workspaceSource.indexOf(
        '<CausalRealtimeConfirmationPanel',
      );
    const nexusPanelIndex =
      workspaceSource.indexOf(
        '<aside className={styles.nexusPanel}>',
      );

    assert.ok(nexusPanelIndex >= 0);
    assert.ok(panelIndex > nexusPanelIndex);
    assert.match(
      workspaceSource,
      /levels=\{causalLevelLines\}/u,
    );
  },
);

test(
  'shows the exact backend status matrix and causal stage chain',
  () => {
    for (
      const label
      of [
        'СБОР ДАННЫХ',
        'НЕ ГОТОВО',
        'ЧАСТИЧНО',
        'ПОДТВЕРЖДЕНО',
      ]
    ) {
      assert.match(
        panelSource,
        new RegExp(label, 'u'),
      );
    }

    assert.match(
      panelSource,
      /Наблюдение/u,
    );
    assert.match(
      panelSource,
      /Подход/u,
    );
    assert.match(
      panelSource,
      /Подтверждение/u,
    );
    assert.match(
      panelSource,
      /directionalTapePressurePercent/u,
    );
    assert.match(
      panelSource,
      /directionalOrderBookPressurePercent/u,
    );
  },
);

test(
  'removes frontend confirmation calculations and enforces backend safety flags',
  () => {
    assert.doesNotMatch(
      workspaceSource,
      /buildWorkspaceSetupConfirmation/u,
    );
    assert.doesNotMatch(
      workspaceSource,
      /setupConfirmation\./u,
    );

    for (
      const flag
      of [
        'evaluatesBreakout',
        'evaluatesBounce',
        'createsSetup',
        'createsSignal',
        'createsScore',
        'learnsFromOutcome',
      ]
    ) {
      assert.match(
        apiSource,
        new RegExp(
          `readBoolean\\(record, '${flag}'\\) !== false`,
          'u',
        ),
      );
    }

    assert.match(
      panelSource,
      /без сигнала, score,/u,
    );
    assert.match(
      panelSource,
      /пробоя или отскока/u,
    );
  },
);
