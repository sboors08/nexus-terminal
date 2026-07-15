import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const requiredTokens = [
  '--nexus-font-family-sans',
  '--nexus-space-1',
  '--nexus-radius-sm',
  '--nexus-color-long',
  '--nexus-color-short',
  '--nexus-color-stage-observation',
  '--nexus-color-stage-approach',
  '--nexus-color-stage-confirmation',
  '--nexus-color-stage-triggered',
  '--nexus-color-info',
];

const requiredRoutes = [
  "dashboard: '/'",
  "scanner: '/scanner'",
  "workspace: '/workspace'",
  "alerts: '/alerts'",
  "marketHistory: '/market-history'",
  "replay: '/replay'",
  "settings: '/settings'",
];

const [tokensCss, routesSource] = await Promise.all([
  readFile(resolve(root, 'src/styles/tokens.css'), 'utf8'),
  readFile(resolve(root, 'src/app/routing/routes.ts'), 'utf8'),
]);

const missingTokens = requiredTokens.filter((token) => !tokensCss.includes(token));
const missingRoutes = requiredRoutes.filter((route) => !routesSource.includes(route));

if (missingTokens.length > 0 || missingRoutes.length > 0) {
  if (missingTokens.length > 0) {
    console.error(`Missing design tokens: ${missingTokens.join(', ')}`);
  }

  if (missingRoutes.length > 0) {
    console.error(`Missing routes: ${missingRoutes.join(', ')}`);
  }

  process.exit(1);
}

console.log('NEXUS foundation verified: routes and mandatory design tokens are present.');
