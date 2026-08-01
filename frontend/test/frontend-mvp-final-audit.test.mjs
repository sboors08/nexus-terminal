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