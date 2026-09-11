import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readSource(relativePath) {
  return readFileSync(
    new URL(relativePath, import.meta.url),
    'utf8',
  ).replace(/\r\n/gu, '\n');
}

const workspaceSource = readSource(
  '../src/pages/WorkspacePage.tsx',
);
const workspaceStyles = readSource(
  '../src/pages/WorkspacePage.module.css',
);
const appShellSource = readSource(
  '../src/app/layout/AppShell.tsx',
);
const appRoutesSource = readSource(
  '../src/app/routing/AppRoutes.tsx',
);
const routesSource = readSource(
  '../src/app/routing/routes.ts',
);

test(
  'renders one compact Workspace header row without breadcrumb or subtitle',
  () => {
    assert.match(
      workspaceSource,
      /<header[\s\S]*?data-workspace-header="compact"[\s\S]*?styles\.workspaceModeStatus/u,
    );
    assert.doesNotMatch(
      workspaceSource,
      /styles\.eyebrow/u,
    );
    assert.doesNotMatch(
      workspaceSource,
      /styles\.setupDescription/u,
    );
    assert.doesNotMatch(
      workspaceSource,
      /<span>Монета<\/span>/u,
    );
    assert.match(
      workspaceStyles,
      /Workspace Compact Header v0\.1[\s\S]*?\.pageHeader\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?\.instrumentHeader\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?flex-wrap:\s*nowrap;/u,
    );
    assert.match(
      workspaceStyles,
      /\.workspaceModeStatus\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/u,
    );
  },
);

test(
  'removes only the Workspace Causal Levels strip while retaining level consumers',
  () => {
    assert.doesNotMatch(
      workspaceSource,
      /<CausalLevelStateStrip/u,
    );
    assert.match(
      workspaceSource,
      /<NexusCandlestickChart[\s\S]*?horizontalSegments=\{causalLevelLines\.horizontalSegments\}/u,
    );
    assert.match(
      workspaceSource,
      /<UnifiedDecisionPanel[\s\S]*?levels=\{causalLevelLines\}/u,
    );
    assert.match(
      workspaceSource,
      /<CausalRealtimeConfirmationPanel[\s\S]*?levels=\{causalLevelLines\}/u,
    );
  },
);

test(
  'removes Levels only from the top navigation and keeps Level Preview routing',
  () => {
    const topNavigation = appShellSource.match(
      /const TOP_NAVIGATION = \[([\s\S]*?)\] as const;/u,
    )?.[1];

    assert.ok(topNavigation);
    assert.doesNotMatch(topNavigation, /LEVELS/u);
    assert.match(
      appShellSource,
      /label: 'Level Preview',[^\n]*ROUTES\.levelPreview/u,
    );
    assert.match(
      appRoutesSource,
      /path=\{APP_ROUTE_SEGMENTS\.levelPreview\}[\s\S]*?element=\{<LevelPreviewPage/u,
    );
    assert.match(
      routesSource,
      /levelPreview:\s*`\$\{APP_ROOT\}\/\$\{APP_ROUTE_SEGMENTS\.levelPreview\}`/u,
    );
  },
);

test(
  'retains the accepted 1920 and compact 1366 Workspace modes',
  () => {
    assert.match(
      workspaceStyles,
      /@media \(min-width: 1181px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 0\.95fr\) minmax\(0, 1\.18fr\) minmax\(0, 0\.87fr\);/u,
    );
    assert.match(
      workspaceStyles,
      /@media \(min-width: 1181px\) and \(max-width: 1500px\) and \(max-height: 820px\)[\s\S]*?\.chartCanvas\s*\{[\s\S]*?min-height:\s*280px;[\s\S]*?\.compactToolTabs\s*\{[\s\S]*?display:\s*flex;/u,
    );
  },
);
