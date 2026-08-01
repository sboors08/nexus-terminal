import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  DEFAULT_SETTINGS,
  cloneSettings,
  normalizeSettings,
} from '../node_modules/.tmp/settings-test/settings/settingsData.js';

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

const pageSource =
  readSource(
    '../src/pages/SettingsPage.tsx',
  );

const cssSource =
  readSource(
    '../src/pages/SettingsPage.module.css',
  );

test(
  'returns an independent default configuration for invalid storage values',
  () => {
    const normalized =
      normalizeSettings(
        null,
      );

    assert.deepEqual(
      normalized,
      DEFAULT_SETTINGS,
    );

    assert.notStrictEqual(
      normalized.additionalTimeframes,
      DEFAULT_SETTINGS.additionalTimeframes,
    );

    normalized.additionalTimeframes.length =
      0;

    assert.deepEqual(
      DEFAULT_SETTINGS.additionalTimeframes,
      [
        '1m',
        '15m',
        '1h',
      ],
    );
  },
);

test(
  'normalizes enums, booleans, timeframes, and numeric limits',
  () => {
    const normalized =
      normalizeSettings({
        primaryTimeframe:
          '30m',

        additionalTimeframes: [
          '1m',
          '1m',
          '5m',
          '30m',
          null,
        ],

        breakoutEnabled:
          false,

        bounceEnabled:
          'yes',

        levelTolerancePct:
          99,

        minTouches:
          4.6,

        formationMinutes:
          -20,

        minLevelStrength:
          Number.POSITIVE_INFINITY,

        minActivity:
          0.2,

        pullbackDepth:
          'medium',

        externalTerminal:
          'unknown',

        compactMode:
          true,
      });

    assert.equal(
      normalized.primaryTimeframe,
      '5m',
    );

    assert.deepEqual(
      normalized.additionalTimeframes,
      [
        '1m',
      ],
    );

    assert.equal(
      normalized.breakoutEnabled,
      false,
    );

    assert.equal(
      normalized.bounceEnabled,
      DEFAULT_SETTINGS.bounceEnabled,
    );

    assert.equal(
      normalized.levelTolerancePct,
      1,
    );

    assert.equal(
      normalized.minTouches,
      5,
    );

    assert.equal(
      normalized.formationMinutes,
      15,
    );

    assert.equal(
      normalized.minLevelStrength,
      DEFAULT_SETTINGS.minLevelStrength,
    );

    assert.equal(
      normalized.minActivity,
      0.5,
    );

    assert.equal(
      normalized.pullbackDepth,
      DEFAULT_SETTINGS.pullbackDepth,
    );

    assert.equal(
      normalized.externalTerminal,
      DEFAULT_SETTINGS.externalTerminal,
    );

    assert.equal(
      normalized.compactMode,
      true,
    );
  },
);

test(
  'removes the primary timeframe and duplicates from additional timeframes',
  () => {
    const normalized =
      normalizeSettings({
        ...DEFAULT_SETTINGS,

        primaryTimeframe:
          '15m',

        additionalTimeframes: [
          '15m',
          '1m',
          '5m',
          '1m',
          '1h',
        ],
      });

    assert.deepEqual(
      normalized.additionalTimeframes,
      [
        '1m',
        '5m',
        '1h',
      ],
    );
  },
);

test(
  'clones mutable settings fields',
  () => {
    const clone =
      cloneSettings(
        DEFAULT_SETTINGS,
      );

    assert.deepEqual(
      clone,
      DEFAULT_SETTINGS,
    );

    assert.notStrictEqual(
      clone.additionalTimeframes,
      DEFAULT_SETTINGS.additionalTimeframes,
    );
  },
);

test(
  'labels Settings as a local prototype that is not connected to runtime configuration',
  () => {
    assert.match(
      pageSource,
      /Локальный прототип конфигурации · не подключён к runtime/u,
    );

    assert.match(
      pageSource,
      /Локальный прототип настроек/u,
    );

    assert.match(
      pageSource,
      /Они пока не передаются в Scanner, Workspace, Alerts/u,
    );

    assert.match(
      pageSource,
      /Сохранение не меняет параметры работающих frontend- и backend-сервисов/u,
    );

    assert.match(
      pageSource,
      /Рыночные потоки подключаются через backend runtime/u,
    );

    assert.match(
      pageSource,
      /Эта страница не управляет соединением/u,
    );

    assert.match(
      pageSource,
      /Флаг сохраняется локально, но текущая навигация Scanner пока его не использует/u,
    );

    assert.match(
      pageSource,
      /пока не подключены к глобальным стилям терминала/u,
    );

    assert.match(
      cssSource,
      /\.localNotice \{/u,
    );

    assert.doesNotMatch(
      pageSource,
      /Подключение реальных потоков будет выполнено отдельным этапом/u,
    );

    assert.doesNotMatch(
      pageSource,
      /<strong>Не подключены<\/strong>/u,
    );

    assert.doesNotMatch(
      pageSource,
      /При смене основного периода NEXUS будет пересчитывать/u,
    );
  },
);

test(
  'tracks unsaved changes and handles local storage failures',
  () => {
    assert.match(
      pageSource,
      /const \[hasUnsavedChanges, setHasUnsavedChanges\]/u,
    );

    assert.match(
      pageSource,
      /const \[saveError, setSaveError\]/u,
    );

    assert.match(
      pageSource,
      /setHasUnsavedChanges\(true\)/u,
    );

    assert.match(
      pageSource,
      /setHasUnsavedChanges\(false\)/u,
    );

    assert.match(
      pageSource,
      /Браузер не разрешил сохранить локальную конфигурацию/u,
    );

    assert.match(
      pageSource,
      /disabled=\{!hasUnsavedChanges\}/u,
    );

    assert.match(
      pageSource,
      /normalizeSettings\(\s*JSON\.parse/u,
    );
  },
);

test(
  'does not keep the obsolete duplicate settings data module',
  () => {
    assert.equal(
      fs.existsSync(
        new URL(
          '../src/pages/settingsData.ts',
          import.meta.url,
        ),
      ),
      false,
    );
  },
);