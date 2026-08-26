import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function readSource(relativePath) {
  return fs
    .readFileSync(
      new URL(
        relativePath,
        import.meta.url,
      ),
      'utf8',
    )
    .replace(
      /\r\n/gu,
      '\n',
    );
}

const componentSource =
  readSource(
    '../src/shared/ui/TokenLogo.tsx',
  );

const pageContracts = [
  {
    path:
      '../src/pages/DashboardPage.tsx',
    minimumUses:
      3,
  },
  {
    path:
      '../src/pages/ScannerPage.tsx',
    minimumUses:
      4,
  },
  {
    path:
      '../src/pages/WatchlistPage.tsx',
    minimumUses:
      1,
  },
  {
    path:
      '../src/pages/WorkspacePage.tsx',
    minimumUses:
      1,
  },
];

test(
  'uses bounded token-logo sources with a final initials fallback',
  () => {
    assert.match(
      componentSource,
      /assets\.coincap\.io/u,
    );

    assert.match(
      componentSource,
      /cdn\.jsdelivr\.net/u,
    );

    assert.match(
      componentSource,
      /onError/u,
    );

    assert.match(
      componentSource,
      /className=\{styles\.fallback\}/u,
    );

    assert.match(
      componentSource,
      /loading=/u,
    );

    assert.match(
      componentSource,
      /1000000\|10000\|1000/u,
    );
  },
);

test(
  'renders the shared token logo across primary market screens',
  () => {
    for (
      const contract
      of pageContracts
    ) {
      const source =
        readSource(contract.path);

      const uses =
        source.match(
          /<TokenLogo\b/gu,
        )
        ?? [];

      assert.ok(
        uses.length
          >= contract.minimumUses,
        `${
          contract.path
        } expected at least ${
          contract.minimumUses
        } TokenLogo uses, received ${
          uses.length
        }`,
      );
    }
  },
);

test(
  'removes the previous single-letter market placeholders',
  () => {
    const dashboard =
      readSource(
        '../src/pages/DashboardPage.tsx',
      );

    const scanner =
      readSource(
        '../src/pages/ScannerPage.tsx',
      );

    const watchlist =
      readSource(
        '../src/pages/WatchlistPage.tsx',
      );

    assert.doesNotMatch(
      dashboard,
      /getDashboardSymbolIcon/u,
    );

    assert.doesNotMatch(
      scanner,
      /setup\.symbol\.slice\(0,\s*1\)/u,
    );

    assert.doesNotMatch(
      scanner,
      /spike\.symbol\.slice\(0,\s*1\)/u,
    );

    assert.doesNotMatch(
      watchlist,
      /instrument\.symbol\.slice\(0,\s*1\)/u,
    );
  },
);