export type SetupRouteContext = {
  setupId: string;
  symbol?: string | null;
  preset?: string | null;
  scannerWindow?: string | null;
  timeframe?: string | null;
};

export type ReplayRouteContext = SetupRouteContext & {
  sessionId?: string | null;
};

export function buildWorkspaceUrl(route: string, context: SetupRouteContext) {
  const params = new URLSearchParams();
  params.set('setupId', context.setupId);
  if (context.symbol) params.set('symbol', context.symbol.toUpperCase());
  if (context.preset) params.set('preset', context.preset);
  if (context.scannerWindow) params.set('scannerWindow', context.scannerWindow);
  if (context.timeframe) params.set('timeframe', context.timeframe);
  return `${route}?${params.toString()}`;
}

export function buildReplayUrl(route: string, context: ReplayRouteContext) {
  const params = new URLSearchParams();
  if (context.sessionId) params.set('session', context.sessionId);
  params.set('setupId', context.setupId);
  if (context.symbol) params.set('symbol', context.symbol.toUpperCase());
  if (context.preset) params.set('preset', context.preset);
  if (context.scannerWindow) params.set('scannerWindow', context.scannerWindow);
  if (context.timeframe) params.set('timeframe', context.timeframe);
  return `${route}?${params.toString()}`;
}

export function isWorkspaceTimeframe(value: string | null): value is '1m' | '5m' | '15m' {
  return value === '1m' || value === '5m' || value === '15m';
}

export function buildSetupSelectionUrl(
  route: string,
  setupId: string,
  context: Omit<SetupRouteContext, 'setupId'> = {},
) {
  const params = new URLSearchParams();
  params.set('setupId', setupId);
  if (context.symbol) params.set('symbol', context.symbol.toUpperCase());
  if (context.preset) params.set('preset', context.preset);
  if (context.scannerWindow) params.set('scannerWindow', context.scannerWindow);
  if (context.timeframe) params.set('timeframe', context.timeframe);
  return `${route}?${params.toString()}`;
}
