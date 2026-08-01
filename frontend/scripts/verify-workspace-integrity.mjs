import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root =
  process.cwd();

const requiredFiles = [
  'src/pages/WorkspacePage.tsx',
  'src/pages/WorkspacePage.module.css',
  'src/features/workspace/workspaceData.ts',
  'src/shared/api/mock/nexusMockApi.ts',
  'test/workspace-data-integrity.test.mjs',
];

const missingFiles = [];

for (
  const file
  of requiredFiles
) {
  try {
    await access(
      resolve(
        root,
        file,
      ),
    );
  } catch {
    missingFiles.push(
      file,
    );
  }
}

if (
  missingFiles.length > 0
) {
  console.error(
    `Missing Workspace integrity files: ${missingFiles.join(', ')}`,
  );

  process.exit(
    1,
  );
}

const [
  pageSource,
  cssSource,
  dataSource,
  apiSource,
  testSource,
  packageSource,
] = await Promise.all([
  readFile(
    resolve(
      root,
      'src/pages/WorkspacePage.tsx',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'src/pages/WorkspacePage.module.css',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'src/features/workspace/workspaceData.ts',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'src/shared/api/mock/nexusMockApi.ts',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'test/workspace-data-integrity.test.mjs',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'package.json',
    ),
    'utf8',
  ),
]);

const corpus = [
  pageSource,
  cssSource,
  dataSource,
  apiSource,
  testSource,
  packageSource,
].join(
  '\n',
);

const requiredMarkers = [
  'candlesQuery.data ?? []',
  'replayAvailable: boolean;',
  'nexusApi.getReplayView(',
  'Replay недоступен',
  'Алерты пока недоступны',
  'Текст существует только до закрытия страницы и не сохраняется',
  'Закрыть без сохранения',
  'Внешний терминал не подключён',
  'Рабочее пространство · runtime-сетап Setup Engine',
  'backend Binance Futures',
  'отмечен в демонстрационном сетапе',
  'export interface WorkspaceViewData',
  'stageFlow: typeof STAGE_FLOW;',
  '.noteDraftNotice',
  'test/workspace-data-integrity.test.mjs',
  '"verify:workspace-integrity"',
];

const missingMarkers =
  requiredMarkers.filter(
    (marker) =>
      !corpus.includes(
        marker,
      ),
  );

const forbiddenPageMarkers = [
  'WorkspaceSnapshot',
  'snapshot.candles',
  'nexusApi.getWorkspaceSnapshot(',
  'alertCreated',
  'setAlertCreated',
  'Алерт создан',
  'Алерт активен',
  'Сохранить заметку',
  'Внешний терминал ↗',
  'Рабочее пространство · реальный сетап Binance',
];

const presentForbiddenPageMarkers =
  forbiddenPageMarkers.filter(
    (marker) =>
      pageSource.includes(
        marker,
      ),
  );

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

  if (
    start < 0
    || end < 0
  ) {
    return '';
  }

  return source.slice(
    start,
    end,
  );
}

const interfaceSource =
  readSection(
    apiSource,
    'export interface WorkspaceViewData',
    '\nexport interface AlertsViewData',
  );

const methodSource =
  readSection(
    apiSource,
    '  getWorkspaceView:',
    '\n  getAlertsView:',
  );

const forbiddenInterfaceMarkers = [
  'prints:',
  'liquidity:',
  'marketDynamics:',
];

const forbiddenMethodMarkers = [
  'WORKSPACE_PRINTS',
  'WORKSPACE_LIQUIDITY',
  'MARKET_DYNAMICS',
  'marketDynamics:',
];

const presentInterfaceMarkers =
  forbiddenInterfaceMarkers.filter(
    (marker) =>
      interfaceSource.includes(
        marker,
      ),
  );

const presentMethodMarkers =
  forbiddenMethodMarkers.filter(
    (marker) =>
      methodSource.includes(
        marker,
      ),
  );

const marketDynamicsRemains =
  dataSource.includes(
    'MARKET_DYNAMICS',
  );

if (
  missingMarkers.length > 0
  || presentForbiddenPageMarkers.length > 0
  || presentInterfaceMarkers.length > 0
  || presentMethodMarkers.length > 0
  || marketDynamicsRemains
  || interfaceSource.length === 0
  || methodSource.length === 0
) {
  if (
    missingMarkers.length > 0
  ) {
    console.error(
      `Missing Workspace integrity markers: ${missingMarkers.join(', ')}`,
    );
  }

  if (
    presentForbiddenPageMarkers.length > 0
  ) {
    console.error(
      `Misleading Workspace markers remain: ${presentForbiddenPageMarkers.join(', ')}`,
    );
  }

  if (
    presentInterfaceMarkers.length > 0
  ) {
    console.error(
      `WorkspaceViewData fixture fields remain: ${presentInterfaceMarkers.join(', ')}`,
    );
  }

  if (
    presentMethodMarkers.length > 0
  ) {
    console.error(
      `Workspace view fixture values remain: ${presentMethodMarkers.join(', ')}`,
    );
  }

  if (
    marketDynamicsRemains
  ) {
    console.error(
      'Obsolete MARKET_DYNAMICS fixture remains.',
    );
  }

  if (
    interfaceSource.length === 0
    || methodSource.length === 0
  ) {
    console.error(
      'Unable to resolve Workspace source sections.',
    );
  }

  process.exitCode =
    1;
} else {
  console.log(
    'NEXUS frontend verified: Workspace Data Integrity v0.1 is present.',
  );
}