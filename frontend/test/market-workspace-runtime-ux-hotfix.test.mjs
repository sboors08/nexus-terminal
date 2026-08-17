import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readSource(path) {
  return readFile(
    new URL(path, import.meta.url),
    'utf8',
  );
}

test(
  'Market automatically retries after an initial backend error',
  async () => {
    const source =
      await readSource(
        '../src/pages/MarketPage.tsx',
      );

    assert.match(
      source,
      /marketQuery\.status !== 'error'/u,
    );

    assert.match(
      source,
      /window\.setTimeout/u,
    );

    assert.match(
      source,
      /marketQuery\.retry\(\)/u,
    );
  },
);

test(
  'Dashboard selects a coin locally and exposes a separate Workspace action',
  async () => {
    const source =
      await readSource(
        '../src/pages/DashboardPage.tsx',
      );

    assert.match(
      source,
      /Показать \$\{String\(row\[0\]\)\} на графике/u,
    );

    assert.match(
      source,
      /setSelected\(\s*String\(row\[0\]\),?\s*\)/u,
    );

    assert.match(
      source,
      /className=\{styles\.chartWorkspaceButton\}/u,
    );

    assert.doesNotMatch(
      source,
      /Открыть \$\{String\(row\[0\]\)\} в Charts \/ Workspace/u,
    );
  },
);

test(
  'Workspace exposes Binance symbol selection',
  async () => {
    const source =
      await readSource(
        '../src/pages/WorkspacePage.tsx',
      );

    assert.match(
      source,
      /aria-label="Выбрать монету Workspace"/u,
    );

    assert.match(
      source,
      /workspaceSymbolUniverse/u,
    );

    assert.match(
      source,
      /buildMarketWorkspaceSetupId\(\s*symbol,\s*\)/u,
    );

    assert.match(
      source,
      /requestedWorkspaceSymbol/u,
    );
  },
);

test(
  'Market Insights and Workspace header are overflow safe and compact',
  async () => {
    const dashboardCss =
      await readSource(
        '../src/pages/DashboardPage.module.css',
      );

    const workspaceCss =
      await readSource(
        '../src/pages/WorkspacePage.module.css',
      );

    assert.match(
      dashboardCss,
      /overflow-wrap: anywhere;/u,
    );

    assert.match(
      dashboardCss,
      /\.insightList > div > div/u,
    );

    assert.match(
      workspaceCss,
      /\.symbolPicker select/u,
    );

    assert.match(
      workspaceCss,
      /@media \(min-width: 821px\)/u,
    );
  },
);
