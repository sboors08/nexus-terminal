import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildCausalLevelLinesView,
} from '../node_modules/.tmp/realtime-test/level-lines/model/causalLevelLines.js';

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

const appShellSource =
  readSource(
    '../src/app/layout/AppShell.tsx',
  );

const appShellStyles =
  readSource(
    '../src/app/layout/AppShell.module.css',
  );

const watchlistSource =
  readSource(
    '../src/pages/WatchlistPage.tsx',
  );

const scannerSource =
  readSource(
    '../src/pages/ScannerPage.tsx',
  );

const fullChartPageSources =
  new Map(
    [
      'DashboardPage.tsx',
      'MarketPage.tsx',
      'ScannerPage.tsx',
      'WorkspacePage.tsx',
    ].map(
      (page) => [
        page,
        readSource(
          `../src/pages/${page}`,
        ),
      ],
    ),
  );

test(
  'keeps the global shell honest about frontend and connection state',
  () => {
    assert.match(
      appShellSource,
      /MVP FRONTEND/u,
    );

    assert.match(
      appShellSource,
      /Состояние подключения показывается отдельно на каждой странице/u,
    );

    assert.match(
      appShellStyles,
      /\.environmentStatus \{/u,
    );

    assert.doesNotMatch(
      appShellSource,
      /<i \/>LIVE|styles\.live|styles\.topIcon|styles\.avatar|railCollapse/u,
    );

    assert.doesNotMatch(
      appShellStyles,
      /\.live \{|\.topIcon|\.avatar \{|\.railCollapse/u,
    );
  },
);

test(
  'uses the canonical Market Workspace URL helper from Watchlist',
  () => {
    assert.match(
      watchlistSource,
      /import \{ buildMarketWorkspaceUrl \} from '@\/shared\/routing\/setupContext';/u,
    );

    assert.match(
      watchlistSource,
      /buildMarketWorkspaceUrl\(\s*ROUTES\.workspace,\s*instrument\.symbol,\s*instrument\.timeframe,/u,
    );

    assert.doesNotMatch(
      watchlistSource,
      /\$\{ROUTES\.workspace\}\?symbol=/u,
    );
  },
);

test(
  'does not promise unavailable alert creation from Scanner',
  () => {
    assert.match(
      scannerSource,
      /Алерты пока недоступны/u,
    );

    assert.match(
      scannerSource,
      /Создание пользовательских алертов из Scanner ещё не подключено/u,
    );

    assert.doesNotMatch(
      scannerSource,
      /Создать алерт|to=\{ROUTES\.alerts\}/u,
    );
  },
);

test(
  'keeps obsolete frontend shell and placeholder files removed',
  () => {
    const obsoleteFiles = [
      '../src/pages/AppShell.tsx',
      '../src/shared/config/navigation.ts',
      '../src/shared/ui/RoutePlaceholder.tsx',
      '../src/shared/ui/RoutePlaceholder.module.css',
    ];

    for (const obsoleteFile of obsoleteFiles) {
      assert.equal(
        fs.existsSync(
          new URL(
            obsoleteFile,
            import.meta.url,
          ),
        ),
        false,
        `Obsolete frontend file remains: ${obsoleteFile}`,
      );
    }
  },
);

test(
  'connects one causal Level Lines layer to every full working chart',
  () => {
    for (
      const [
        page,
        source,
      ] of fullChartPageSources
    ) {
      assert.match(
        source,
        /useCausalLevelLines/u,
        `${page} must load causal Level Lines`,
      );
      assert.match(
        source,
        /horizontalSegments=\{[^}]*\.horizontalSegments/u,
        `${page} must render causal horizontal segments`,
      );
      assert.match(
        source,
        /CausalLevelStateStrip/u,
        `${page} must expose per-line state`,
      );
    }

    const workspaceSource =
      fullChartPageSources.get(
        'WorkspacePage.tsx',
      );

    assert.ok(workspaceSource);
    assert.doesNotMatch(
      scannerSource,
      /selectedLevelSegments/u,
    );
    assert.doesNotMatch(
      workspaceSource,
      /title:\s*'УРОВЕНЬ'/u,
    );
    assert.doesNotMatch(
      workspaceSource,
      /price:\s*chartZone(?:Low|High)/u,
    );
  },
);

test(
  'maps active backend lines to visible causal segments and per-line stages',
  () => {
    const candles = [
      0,
      1,
      2,
    ].map(
      (index) => ({
        openTime:
          `2026-08-10T12:0${index}:00.000Z`,
        closeTime:
          `2026-08-10T12:0${index}:59.999Z`,
        open:
          100,
        high:
          102,
        low:
          98,
        close:
          100.2,
        volume:
          1_000,
        tradesCount:
          100,
        isClosed:
          true,
      }),
    );
    const makeLine = (
      id,
      kind,
      price,
      status = 'confirmed',
    ) => ({
      id,
      symbol:
        'BTCUSDT',
      timeframe:
        '5m',
      price,
      kind,
      originCandleIndex:
        0,
      originExtremumAt:
        '2026-08-10T12:00:00.000Z',
      originExtremumPrice:
        price,
      activeFrom:
        '2026-08-10T12:01:00.000Z',
      confirmedAt:
        status === 'candidate'
          ? null
          : '2026-08-10T12:02:00.000Z',
      touchCount:
        status === 'candidate'
          ? 1
          : 2,
      status,
      workedAt:
        null,
      supersededAt:
        null,
      supersessionEvidence:
        null,
      brokenAt:
        null,
      breakEvidence:
        null,
    });
    const support =
      makeLine(
        'support',
        'support',
        99,
      );
    const resistance =
      makeLine(
        'resistance',
        'resistance',
        101,
        'candidate',
      );
    const distant =
      makeLine(
        'distant',
        'resistance',
        150,
      );
    const snapshot = {
      candles,
      activeLevels: [
        support,
        resistance,
        distant,
      ],
      observationTracking: {
        currentPrice:
          100.2,
        activeProgress: [
          {
            lineId:
              support.id,
            progress:
              0.7,
            stage:
              'OBSERVATION',
          },
          {
            lineId:
              resistance.id,
            progress:
              0.95,
            stage:
              'OBSERVATION',
          },
        ],
      },
      approachEvaluation: {
        currentPrice:
          100.2,
        evaluations: [
          {
            lineId:
              support.id,
            observationProgress:
              0.7,
            distanceToLevelPercent:
              1.212121,
            stage:
              null,
          },
          {
            lineId:
              resistance.id,
            observationProgress:
              0.95,
            distanceToLevelPercent:
              0.792079,
            stage:
              'APPROACH',
          },
        ],
      },
      realtimeConfirmation: {
        evaluations: [],
      },
    };
    const view =
      buildCausalLevelLinesView(
        snapshot,
        candles,
      );

    assert.deepEqual(
      view.primaryStates.map(
        (state) => state.line.id,
      ),
      [
        'support',
        'resistance',
      ],
    );
    assert.equal(
      view.states.find(
        (state) =>
          state.line.id === 'resistance',
      )?.stage,
      'APPROACH',
    );
    assert.equal(
      view.states.find(
        (state) =>
          state.line.id === 'support',
      )?.stage,
      'OBSERVATION',
    );
    assert.deepEqual(
      view.horizontalSegments.map(
        (segment) => ({
          price:
            segment.price,
          lineStyle:
            segment.lineStyle,
        }),
      ),
      [
        {
          price:
            101,
          lineStyle:
            'dashed',
        },
        {
          price:
            99,
          lineStyle:
            'solid',
        },
      ],
    );
  },
);
