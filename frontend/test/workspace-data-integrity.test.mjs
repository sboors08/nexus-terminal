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
    '../src/pages/WorkspacePage.tsx',
  );

const cssSource =
  readSource(
    '../src/pages/WorkspacePage.module.css',
  );

const workspaceDataSource =
  readSource(
    '../src/features/workspace/workspaceData.ts',
  );

const apiSource =
  readSource(
    '../src/shared/api/mock/nexusMockApi.ts',
  );

const workspaceViewInterface =
  readSection(
    apiSource,
    'export interface WorkspaceViewData',
    '\nexport interface AlertsViewData',
  );

const workspaceViewMethod =
  readSection(
    apiSource,
    '  getWorkspaceView:',
    '\n  getAlertsView:',
  );

test(
  'uses backend candle data instead of a generated Workspace snapshot',
  () => {
    assert.match(
      pageSource,
      /buildWorkspaceRealtimeView\([\s\S]*?candlesQuery\.data \?\? \[\]/u,
    );

    assert.match(
      pageSource,
      /candlesQuery\.data,\s*realtime\.lifecycleState/u,
    );

    assert.doesNotMatch(
      pageSource,
      /\bWorkspaceSnapshot\b|snapshot\.candles|nexusApi\.getWorkspaceSnapshot\(/u,
    );
  },
);

test(
  'shows Replay only when a matching session exists',
  () => {
    assert.match(
      pageSource,
      /replayAvailable: boolean;/u,
    );

    assert.match(
      pageSource,
      /nexusApi\.getReplayView\(\s*null,\s*resolvedSetupId/u,
    );

    assert.match(
      pageSource,
      /replayAvailable\s*\?\s*\(/u,
    );

    assert.match(
      pageSource,
      /Replay недоступен/u,
    );

    assert.match(
      pageSource,
      /Для этого сетапа нет сохранённой Replay-сессии/u,
    );
  },
);

test(
  'does not imitate persistent alerts, notes, or terminal actions',
  () => {
    assert.match(
      pageSource,
      /Алерты пока недоступны/u,
    );

    assert.match(
      pageSource,
      /Создание пользовательских алертов из Workspace ещё не подключено/u,
    );

    assert.match(
      pageSource,
      /Текст существует только до закрытия страницы и не сохраняется/u,
    );

    assert.match(
      pageSource,
      /Закрыть без сохранения/u,
    );

    assert.match(
      pageSource,
      /Внешний терминал не подключён/u,
    );

    assert.match(
      pageSource,
      /Интеграция с внешним терминалом ещё не подключена/u,
    );

    assert.match(
      cssSource,
      /\.primaryButton:disabled,[\s\S]*?\.externalButton:disabled/u,
    );

    assert.match(
      cssSource,
      /\.noteDraftNotice \{/u,
    );

    assert.doesNotMatch(
      pageSource,
      /\balertCreated\b|\bsetAlertCreated\b|Алерт создан|Алерт активен|Сохранить заметку|Внешний терминал ↗/u,
    );
  },
);

test(
  'labels runtime and demonstration sources separately',
  () => {
    assert.match(
      pageSource,
      /Рабочее пространство · runtime-сетап Setup Engine/u,
    );

    assert.match(
      pageSource,
      /Свечи, лента и стакан загружаются через backend Binance Futures/u,
    );

    assert.match(
      pageSource,
      /Контекст сетапа демонстрационный/u,
    );

    assert.match(
      pageSource,
      /Level Engine подтвердил пробой/u,
    );

    assert.doesNotMatch(
      pageSource,
      /подтверждён Setup Engine/u,
    );

    assert.match(
      pageSource,
      /отмечен в демонстрационном сетапе/u,
    );

    assert.doesNotMatch(
      pageSource,
      /Рабочее пространство · реальный сетап Binance/u,
    );
  },
);

test(
  'keeps WorkspaceViewData free from obsolete fixture panels',
  () => {
    assert.match(
      workspaceViewInterface,
      /selectedSetup: ScannerSetup;/u,
    );

    assert.match(
      workspaceViewInterface,
      /stageFlow: typeof STAGE_FLOW;/u,
    );

    assert.doesNotMatch(
      workspaceViewInterface,
      /prints:|liquidity:|marketDynamics:/u,
    );

    assert.doesNotMatch(
      workspaceViewMethod,
      /WORKSPACE_PRINTS|WORKSPACE_LIQUIDITY|MARKET_DYNAMICS|marketDynamics:/u,
    );

    assert.doesNotMatch(
      workspaceDataSource,
      /\bMARKET_DYNAMICS\b/u,
    );
  },
);

test(
  'preserves generated snapshot fixtures only for the Replay contract',
  () => {
    assert.match(
      apiSource,
      /function createWorkspaceSnapshot\(/u,
    );

    assert.match(
      apiSource,
      /const prints: TradePrint\[\] = WORKSPACE_PRINTS\.map/u,
    );

    assert.match(
      apiSource,
      /const liquidity: LiquidityLevel\[\] = WORKSPACE_LIQUIDITY\.map/u,
    );

    assert.doesNotMatch(
      pageSource,
      /createWorkspaceSnapshot|WORKSPACE_PRINTS|WORKSPACE_LIQUIDITY/u,
    );
  },
);
