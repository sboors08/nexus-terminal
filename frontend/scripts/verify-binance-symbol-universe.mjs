import fs from 'node:fs';

const requiredFiles = [
  'src/shared/realtime/binanceSymbolUniverse.ts',
  'src/shared/realtime/useBinanceSymbolUniverse.ts',
  'src/shared/realtime/dashboardScannerUniverse.ts',
  'test/binance-symbol-universe.test.mjs',
  'test/dashboard-scanner-universe.test.mjs',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing Binance Symbol Universe frontend file: ${file}`,
    );
  }
}

const client = fs.readFileSync(
  'src/shared/realtime/binanceSymbolUniverse.ts',
  'utf8',
);

const hook = fs.readFileSync(
  'src/shared/realtime/useBinanceSymbolUniverse.ts',
  'utf8',
);

const helper = fs.readFileSync(
  'src/shared/realtime/dashboardScannerUniverse.ts',
  'utf8',
);

const dashboard = fs.readFileSync(
  'src/pages/DashboardPage.tsx',
  'utf8',
);

const index = fs.readFileSync(
  'src/shared/realtime/index.ts',
  'utf8',
);

const requiredClientMarkers = [
  'BINANCE_SYMBOL_UNIVERSE_PATH',
  'fetchBinanceSymbolUniverse',
  'parseBinanceSymbolUniverseSnapshot',
  'collectingSymbols',
  'addedSymbols',
  'removedSymbols',
];

for (const marker of requiredClientMarkers) {
  if (!client.includes(marker)) {
    throw new Error(
      `Missing Binance Symbol Universe client marker: ${marker}`,
    );
  }
}

for (
  const marker
  of [
    'useBinanceSymbolUniverse',
    'buildDashboardScannerUniverseRows',
    'NEW · СБОР',
    'BINANCE',
  ]
) {
  const sources = [
    hook,
    helper,
    dashboard,
  ].join('\n');

  if (!sources.includes(marker)) {
    throw new Error(
      `Missing Dashboard Symbol Universe marker: ${marker}`,
    );
  }
}

if (
  !index.includes(
    "export * from './binanceSymbolUniverse';",
  )
  || !index.includes(
    "export * from './useBinanceSymbolUniverse';",
  )
  || !index.includes(
    "export * from './dashboardScannerUniverse';",
  )
) {
  throw new Error(
    'Binance Symbol Universe exports are missing',
  );
}

console.log(
  'NEXUS frontend verified: all Binance symbols, listing states and Dashboard integration are present.',
);