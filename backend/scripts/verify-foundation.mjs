import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'package.json',
  'tsconfig.json',
  '.env.example',
  'src/app.ts',
  'src/server.ts',
  'src/config/env.ts',
  'src/modules/index.ts',
  'src/modules/health/health.routes.ts',
  'test/health.test.ts',
];

await Promise.all(requiredFiles.map((path) => access(resolve(root, path))));

const [packageSource, appSource, serverSource] = await Promise.all([
  readFile(resolve(root, 'package.json'), 'utf8'),
  readFile(resolve(root, 'src/app.ts'), 'utf8'),
  readFile(resolve(root, 'src/server.ts'), 'utf8'),
]);

const packageJson = JSON.parse(packageSource);
const errors = [];

if (packageJson.name !== 'nexus-terminal-backend') {
  errors.push('Unexpected backend package name');
}

for (const script of ['dev', 'build', 'typecheck', 'test', 'check']) {
  if (!packageJson.scripts?.[script]) errors.push(`Missing npm script: ${script}`);
}

if (!appSource.includes("prefix: env.apiPrefix")) {
  errors.push('API modules are not mounted under the configured prefix');
}

if (!serverSource.includes("process.once('SIGTERM'")) {
  errors.push('Graceful shutdown handler is missing');
}

const sourceText = `${appSource}\n${serverSource}`;
if (sourceText.includes('../frontend') || sourceText.includes('../../frontend')) {
  errors.push('Backend must not import frontend implementation files');
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('NEXUS backend foundation verified: isolated API, config, health route and shutdown flow are present.');
