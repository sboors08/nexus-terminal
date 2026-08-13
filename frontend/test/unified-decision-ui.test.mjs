import assert from 'node:assert/strict';
import {
  readFile,
} from 'node:fs/promises';
import test from 'node:test';

const workspacePath =
  new URL(
    '../src/pages/WorkspacePage.tsx',
    import.meta.url,
  );
const panelPath =
  new URL(
    '../src/shared/level-lines/ui/UnifiedDecisionPanel.tsx',
    import.meta.url,
  );
const apiPath =
  new URL(
    '../src/shared/api/runtime/levelLinesApi.ts',
    import.meta.url,
  );

test(
  'renders one backend Unified Decision before detailed confirmation',
  async () => {
    const workspace =
      await readFile(
        workspacePath,
        'utf8',
      );
    const decisionIndex =
      workspace.indexOf(
        '<UnifiedDecisionPanel',
      );
    const confirmationIndex =
      workspace.indexOf(
        '<CausalRealtimeConfirmationPanel',
      );

    assert.ok(decisionIndex > 0);
    assert.ok(
      confirmationIndex
        > decisionIndex,
    );
    assert.match(
      workspace,
      /levels=\{causalLevelLines\}/u,
    );
  },
);

test(
  'shows beginner-facing long short wait confirmed and skip states',
  async () => {
    const panel =
      await readFile(
        panelPath,
        'utf8',
      );

    assert.match(panel, /ВОЗМОЖЕН LONG/u);
    assert.match(panel, /ВОЗМОЖЕН SHORT/u);
    assert.match(panel, /ЖДАТЬ ПОДТВЕРЖДЕНИЯ/u);
    assert.match(panel, /СЕТАП ПОДТВЕРЖДЁН/u);
    assert.match(panel, /ПРОПУСТИТЬ/u);
    assert.match(panel, /Пробой/u);
    assert.match(panel, /Отскок/u);
    assert.match(
      panel,
      /не приказ купить или продать/u,
    );
  },
);

test(
  'displays only parsed backend decisions and enforces safety flags',
  async () => {
    const [panel, api] =
      await Promise.all([
        readFile(panelPath, 'utf8'),
        readFile(apiPath, 'utf8'),
      ]);

    assert.match(
      panel,
      /snapshot\s*\?\.unifiedDecision/u,
    );
    assert.doesNotMatch(
      panel,
      /priceChangePct|volumeAnomaly|tradesAnomaly/u,
    );
    assert.match(
      api,
      /createsTradeOrder/u,
    );
    assert.match(
      api,
      /estimatesProfitability/u,
    );
    assert.match(
      api,
      /Invalid Unified Decision safety flags/u,
    );
  },
);
