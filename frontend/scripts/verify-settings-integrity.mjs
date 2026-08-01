import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root =
  process.cwd();

const requiredFiles = [
  'src/features/settings/settingsData.ts',
  'src/pages/SettingsPage.tsx',
  'src/pages/SettingsPage.module.css',
  'test/settings-data-integrity.test.mjs',
  'tsconfig.settings-test.json',
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

const legacyFile =
  'src/pages/settingsData.ts';

let legacyFileExists =
  false;

try {
  await access(
    resolve(
      root,
      legacyFile,
    ),
  );

  legacyFileExists =
    true;
} catch {
  legacyFileExists =
    false;
}

if (
  missingFiles.length > 0
) {
  console.error(
    `Missing Settings files: ${missingFiles.join(', ')}`,
  );

  process.exit(
    1,
  );
}

const [
  dataSource,
  pageSource,
  cssSource,
  testSource,
  packageSource,
] = await Promise.all([
  readFile(
    resolve(
      root,
      'src/features/settings/settingsData.ts',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'src/pages/SettingsPage.tsx',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'src/pages/SettingsPage.module.css',
    ),
    'utf8',
  ),

  readFile(
    resolve(
      root,
      'test/settings-data-integrity.test.mjs',
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
  dataSource,
  pageSource,
  cssSource,
  testSource,
  packageSource,
].join(
  '\n',
);

const requiredMarkers = [
  'export function normalizeSettings(',
  'Number.isFinite(',
  'new Set(',
  'Локальный прототип конфигурации · не подключён к runtime',
  'Локальный прототип настроек',
  'Они пока не передаются в Scanner, Workspace, Alerts',
  'Сохранение не меняет параметры работающих frontend- и backend-сервисов',
  'Рыночные потоки подключаются через backend runtime',
  'Эта страница не управляет соединением',
  'Флаг сохраняется локально, но текущая навигация Scanner пока его не использует',
  'пока не подключены к глобальным стилям терминала',
  'hasUnsavedChanges',
  'saveError',
  'disabled={!hasUnsavedChanges}',
  '.localNotice',
  'test/settings-data-integrity.test.mjs',
  '"verify:settings-integrity"',
];

const missingMarkers =
  requiredMarkers.filter(
    (marker) =>
      !corpus.includes(
        marker,
      ),
  );

const forbiddenMarkers = [
  'Подключение реальных потоков будет выполнено отдельным этапом.',
  '<div><span>Потоки</span><strong>Не подключены</strong></div>',
  '<div><span>Режим</span><strong>Тестовый контур</strong></div>',
  'При смене основного периода NEXUS будет пересчитывать активность и параметры сетапов.',
  'После выбора сетапа в Scanner сразу переходить в рабочее пространство.',
  'Тёмная тема и базовая дизайн-система NEXUS остаются неизменными.',
];

const presentForbiddenMarkers =
  forbiddenMarkers.filter(
    (marker) =>
      pageSource.includes(
        marker,
      ),
  );

if (
  legacyFileExists
  || missingMarkers.length > 0
  || presentForbiddenMarkers.length > 0
) {
  if (
    legacyFileExists
  ) {
    console.error(
      `Obsolete Settings file remains: ${legacyFile}`,
    );
  }

  if (
    missingMarkers.length > 0
  ) {
    console.error(
      `Missing Settings markers: ${missingMarkers.join(', ')}`,
    );
  }

  if (
    presentForbiddenMarkers.length > 0
  ) {
    console.error(
      `Misleading Settings markers remain: ${presentForbiddenMarkers.join(', ')}`,
    );
  }

  process.exitCode =
    1;
} else {
  console.log(
    'NEXUS frontend verified: Settings Data Integrity v0.1 is present.',
  );
}