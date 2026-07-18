export type SetupRouteContext = {
  setupId: string;
  symbol?: string | null;
  timeframe?: string | null;
};

export type ReplayRouteContext = SetupRouteContext & {
  sessionId?: string | null;
};

export function buildWorkspaceUrl(route: string, context: SetupRouteContext) {
  const params = new URLSearchParams();
  params.set('setupId', context.setupId);
  if (context.symbol) params.set('symbol', context.symbol.toUpperCase());
  if (context.timeframe) params.set('timeframe', context.timeframe);
  return `${route}?${params.toString()}`;
}

export function buildReplayUrl(route: string, context: ReplayRouteContext) {
  const params = new URLSearchParams();
  if (context.sessionId) params.set('session', context.sessionId);
  params.set('setupId', context.setupId);
  if (context.symbol) params.set('symbol', context.symbol.toUpperCase());
  if (context.timeframe) params.set('timeframe', context.timeframe);
  return `${route}?${params.toString()}`;
}

export function isWorkspaceTimeframe(value: string | null): value is '1m' | '5m' | '15m' {
  return value === '1m' || value === '5m' || value === '15m';
}

export function buildSetupSelectionUrl(route: string, setupId: string) {
  const params = new URLSearchParams();
  params.set('setupId', setupId);
  return `${route}?${params.toString()}`;
}
