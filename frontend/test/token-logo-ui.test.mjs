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
const componentStyles =
  readSource(
    '../src/shared/ui/TokenLogo.module.css',
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
      2,
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

    assert.match(
      componentSource,
      /preferredSource/u,
    );
  },
);

test(
  'keeps an identified fallback visible until a remote logo has decoded',
  () => {
    assert.match(componentSource, /data-token-logo-state=/u);
    assert.match(componentSource, /data-token-logo-symbol=\{baseAsset\}/u);
    assert.match(componentSource, /onLoad=\{\(\) => setLoadedSource\(source\)\}/u);
    assert.match(componentSource, /loadedSource === source/u);
    assert.match(componentSource, /className=\{styles\.fallback\}[\s\S]*?\{baseAsset\.slice\(0, 2\)\}/u);
    assert.match(componentStyles, /\.image\s*\{[\s\S]*?opacity:\s*0;/u);
    assert.match(componentStyles, /\.imageLoaded\s*\{[\s\S]*?opacity:\s*1;/u);

    const dashboard = readSource('../src/pages/DashboardPage.tsx');
    assert.ok(
      (dashboard.match(/<TokenLogo[\s\S]*?eager[\s\S]*?\/>/gu) ?? []).length >= 3,
      'Dashboard logos must be requested eagerly in Hot List, Market Scanner and chart header',
    );
  },
);

test(
  'does not hide an already loaded cached logo after its load event',
  () => {
    assert.doesNotMatch(
      componentSource,
      /setImageLoaded\(false\)/u,
      'a post-render reset can overwrite a fast cached onLoad result',
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
test(
  'renders real token logos on the Market page',
  () => {
    const market =
      readSource(
        '../src/pages/MarketPage.tsx',
      );

    const uses =
      market.match(
        /<TokenLogo\b/gu,
      )
      ?? [];

    assert.ok(
      uses.length >= 2,
      `MarketPage expected at least 2 TokenLogo uses, received ${uses.length}`,
    );

    assert.doesNotMatch(
      market,
      /selected\.baseAsset\.slice\(0,\s*1\)/u,
    );

    assert.doesNotMatch(
      market,
      /symbol\.baseAsset\.slice\(0,\s*1\)/u,
    );

    const preferredSources =
      market.match(
        /preferredSource=\{/gu,
      )
      ?? [];

    assert.equal(
      preferredSources.length,
      2,
    );
  },
);
