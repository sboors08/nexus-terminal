import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scannerPageUrl =
  new URL('../src/pages/ScannerPage.tsx', import.meta.url);

const scannerDataUrl =
  new URL('../src/features/scanner/scannerData.ts', import.meta.url);

const shadowMapperUrl =
  new URL('../src/shared/api/runtime/levelV2ShadowScanner.ts', import.meta.url);

const panelUrl =
  new URL('../src/shared/ui/LevelV2ShadowInspectionPanel.tsx', import.meta.url);

test(
  'connects the selected V2 shadow level to the inspection panel',
  async () => {
    const [
      scannerPage,
      scannerData,
      shadowMapper,
      panel,
    ] = await Promise.all([
      readFile(scannerPageUrl, 'utf8'),
      readFile(scannerDataUrl, 'utf8'),
      readFile(shadowMapperUrl, 'utf8'),
      readFile(panelUrl, 'utf8'),
    ]);

    assert.match(
      scannerData,
      /shadowLevelId\?: string;/u,
    );

    assert.match(
      shadowMapper,
      /shadowLevelId:\s*state\.level\.id/u,
    );

    assert.match(
      scannerPage,
      /<LevelV2ShadowInspectionPanel/u,
    );

    assert.match(
      scannerPage,
      /levelId=\{\s*selectedSetup\s*\.shadowLevelId\s*\?\? null\s*\}/u,
    );

    assert.match(
      scannerPage,
      /lifecycleStatus=\{\s*selectedSetup\s*\.shadowStatus\s*\?\? null\s*\}/u,
    );

    assert.match(
      panel,
      /fetchLevelV2ShadowInspection/u,
    );

    assert.match(
      panel,
      /не торговый сигнал и не исполнение сделки/u,
    );
  },
);
