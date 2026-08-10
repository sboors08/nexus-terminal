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

const feedbackProviderSource =
  fs.readFileSync(
    new URL(
      '../src/shared/feedback/FeedbackProvider.tsx',
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
        'ВЗАИМОДЕЙСТВИЕ ПОДТВЕРЖДЕНО',
        'ПОПЫТКА ПРОБОЯ',
        'ПРОБОЙ ПОДТВЕРЖДЁН',
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
  'uses one causal level for Workspace zone, touches, and confirmation panels',
  () => {
    assert.match(
      workspaceSource,
      /const activeWorkspaceCausalState =\s*causalLevelLines\.focusState/u,
    );
    assert.doesNotMatch(
      workspaceSource,
      /workspaceLevelKind|closestToSetupLevel|setupLevelMidpoint/u,
    );
    assert.match(
      workspaceSource,
      /workspaceCausalState\?\.zoneLow/u,
    );
    assert.match(
      workspaceSource,
      /workspaceCausalState\?\.line\s*\.touchCount/u,
    );
    assert.doesNotMatch(
      workspaceSource,
      /selectedSetup\.touches/u,
    );
    assert.match(
      workspaceSource,
      /workspaceScannerReasons\.map/u,
    );
    assert.doesNotMatch(
      workspaceSource,
      /selectedSetup\.reasons\.map/u,
    );
    assert.match(
      workspaceSource,
      /workspaceBadgeStage/u,
    );
    assert.doesNotMatch(
      workspaceSource,
      /<SetupStageBadge[\s\S]*?stage=\{[\s\S]*?selectedSetup\.stage[\s\S]*?\}/u,
    );
    assert.equal(
      workspaceSource.match(
        /focusState=\{workspaceCausalState\}/gu,
      )?.length,
      2,
    );
  },
);

test(
  'keeps Workspace feedback actions in normal panel flow instead of covering causal data',
  () => {
    assert.match(
      workspaceSource,
      /dock:\s*'hidden'/u,
    );
    assert.match(
      workspaceSource,
      /feedbackActions\.openSetupFeedback/u,
    );
    assert.match(
      workspaceSource,
      /feedbackActions\.openGeneralFeedback/u,
    );
    assert.match(
      feedbackProviderSource,
      /pageContext\?\.dock !== 'hidden'/u,
    );
  },
);

test(
  'keeps repeated touches and breakout attempts observational',
  () => {
    assert.match(
      workspaceSource,
      /уровень ослаблен, риск пробоя повышен/u,
    );
    assert.match(
      workspaceSource,
      /Пробой, отскок и ложный пробой определяются отдельным outcome-анализом/u,
    );
    assert.match(
      panelSource,
      /Пробой, ложный пробой или возврат определяются отдельно по закрытым свечам/u,
    );
    assert.match(
      workspaceSource,
      /уровень больше не активен/u,
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
      /без сигнала, score и исхода/u,
    );
    assert.match(
      panelSource,
      /Пробой подтверждается только Level Engine/u,
    );
  },
);
