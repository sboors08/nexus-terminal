import type { MarketSymbol } from '../../contracts/nexus-api.js';

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface TokenLogoMetadataProvider {
  enrichMarketSymbols(
    symbols: readonly MarketSymbol[],
  ): Promise<MarketSymbol[]>;
}

export interface BinanceTokenLogoMetadataServiceOptions {
  baseUrl?: string;
  cacheTtlMs?: number;
  requestTimeoutMs?: number;
  fetchImpl?: FetchLike;
  now?: () => Date;
}

interface BinanceAlphaTokenListResponse {
  success?: unknown;
  data?: unknown;
}

interface TokenLogoCandidate {
  asset: string;
  iconUrl: string;
  score: number;
}

interface TokenLogoCache {
  expiresAtMs: number;
  urlsByAsset: ReadonlyMap<string, string>;
}

const BINANCE_ALPHA_TOKEN_LIST_PATH =
  '/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list';

const DEFAULT_BINANCE_TOKEN_METADATA_BASE_URL =
  'https://www.binance.com';

const DEFAULT_TOKEN_LOGO_CACHE_TTL_MS =
  12 * 60 * 60 * 1_000;

const DEFAULT_TOKEN_LOGO_REQUEST_TIMEOUT_MS =
  15_000;

const TOKEN_ASSET_PATTERN =
  /^[A-Z0-9]{1,20}$/u;

const TOKEN_MULTIPLIER_PREFIX =
  /^(?:1000000|10000|1000)(?=[A-Z])/u;

const BINANCE_IMAGE_HOST =
  'bin.bnbstatic.com';

function normalizeAsset(
  value: unknown,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized =
    value
      .trim()
      .toUpperCase()
      .replace(
        TOKEN_MULTIPLIER_PREFIX,
        '',
      );

  return TOKEN_ASSET_PATTERN.test(
    normalized,
  )
    ? normalized
    : null;
}

function normalizeBinanceIconUrl(
  value: unknown,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const url =
      new URL(
        value.trim(),
      );

    if (
      url.protocol !== 'https:'
      || url.hostname !== BINANCE_IMAGE_HOST
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function finiteNumber(
  value: unknown,
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : 0;

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function candidateScore(
  record: Record<string, unknown>,
): number {
  const cexBoost =
    record.listingCex === true
      ? 1_000_000_000_000_000
      : 0;

  const onlineBoost =
    record.offline === true
      ? 0
      : 100_000_000_000_000;

  const marketCap =
    Math.max(
      0,
      finiteNumber(
        record.marketCap,
      ),
    );

  const volume =
    Math.max(
      0,
      finiteNumber(
        record.volume24h,
      ),
    );

  return (
    cexBoost
    + onlineBoost
    + Math.min(
        marketCap,
        99_000_000_000_000,
      )
    + Math.min(
        volume,
        999_999_999_999,
      )
  );
}

function readCandidates(
  payload: unknown,
): TokenLogoCandidate[] {
  if (
    !payload
    || typeof payload !== 'object'
    || Array.isArray(payload)
  ) {
    throw new Error(
      'Binance token metadata returned an invalid response',
    );
  }

  const response =
    payload as BinanceAlphaTokenListResponse;

  if (
    response.success !== true
    || !Array.isArray(response.data)
  ) {
    throw new Error(
      'Binance token metadata returned an unsuccessful response',
    );
  }

  if (response.data.length > 10_000) {
    throw new Error(
      'Binance token metadata exceeded the safe item limit',
    );
  }

  return response.data.flatMap(
    (item): TokenLogoCandidate[] => {
      if (
        !item
        || typeof item !== 'object'
        || Array.isArray(item)
      ) {
        return [];
      }

      const record =
        item as Record<string, unknown>;

      const iconUrl =
        normalizeBinanceIconUrl(
          record.iconUrl,
        );

      if (!iconUrl) {
        return [];
      }

      const assets =
        new Set(
          [
            normalizeAsset(
              record.symbol,
            ),
            normalizeAsset(
              record.cexCoinName,
            ),
          ].filter(
            (asset): asset is string =>
              asset !== null,
          ),
        );

      const score =
        candidateScore(
          record,
        );

      return Array.from(
        assets,
        (asset) => ({
          asset,
          iconUrl,
          score,
        }),
      );
    },
  );
}

function selectLogoUrls(
  candidates: readonly TokenLogoCandidate[],
): ReadonlyMap<string, string> {
  const selected =
    new Map<
      string,
      TokenLogoCandidate
    >();

  for (const candidate of candidates) {
    const current =
      selected.get(
        candidate.asset,
      );

    if (
      !current
      || candidate.score > current.score
    ) {
      selected.set(
        candidate.asset,
        candidate,
      );
    }
  }

  return new Map(
    Array.from(
      selected,
      ([asset, candidate]) => [
        asset,
        candidate.iconUrl,
      ],
    ),
  );
}

export class BinanceTokenLogoMetadataService
implements TokenLogoMetadataProvider {
  private readonly baseUrl: string;
  private readonly cacheTtlMs: number;
  private readonly requestTimeoutMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;

  private cache: TokenLogoCache | null = null;
  private refreshPromise:
    Promise<ReadonlyMap<string, string>>
    | null = null;

  constructor(
    options:
      BinanceTokenLogoMetadataServiceOptions = {},
  ) {
    this.baseUrl =
      (
        options.baseUrl
        ?? DEFAULT_BINANCE_TOKEN_METADATA_BASE_URL
      ).replace(
        /\/+$/u,
        '',
      );

    this.cacheTtlMs =
      options.cacheTtlMs
      ?? DEFAULT_TOKEN_LOGO_CACHE_TTL_MS;

    this.requestTimeoutMs =
      options.requestTimeoutMs
      ?? DEFAULT_TOKEN_LOGO_REQUEST_TIMEOUT_MS;

    this.fetchImpl =
      options.fetchImpl
      ?? globalThis.fetch;

    this.now =
      options.now
      ?? (() => new Date());

    if (
      this.cacheTtlMs < 1
      || !Number.isSafeInteger(
        this.cacheTtlMs,
      )
    ) {
      throw new Error(
        'Token-logo cache TTL must be a positive safe integer',
      );
    }

    if (
      this.requestTimeoutMs < 1
      || !Number.isSafeInteger(
        this.requestTimeoutMs,
      )
    ) {
      throw new Error(
        'Token-logo request timeout must be a positive safe integer',
      );
    }
  }

  async enrichMarketSymbols(
    symbols: readonly MarketSymbol[],
  ): Promise<MarketSymbol[]> {
    const urlsByAsset =
      await this.getLogoUrls();

    return symbols.map(
      (symbol) => {
        const asset =
          normalizeAsset(
            symbol.baseAsset,
          );

        return {
          ...symbol,
          logoUrl:
            asset === null
              ? null
              : urlsByAsset.get(
                  asset,
                )
                ?? null,
        };
      },
    );
  }

  private async getLogoUrls():
  Promise<ReadonlyMap<string, string>> {
    const nowMs =
      this.now().getTime();

    if (
      this.cache
      && this.cache.expiresAtMs > nowMs
    ) {
      return this.cache.urlsByAsset;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise =
      this.refresh();

    try {
      return await this.refreshPromise;
    } catch (error) {
      if (this.cache) {
        return this.cache.urlsByAsset;
      }

      throw error;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async refresh():
  Promise<ReadonlyMap<string, string>> {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => {
          controller.abort();
        },
        this.requestTimeoutMs,
      );

    try {
      const response =
        await this.fetchImpl(
          this.baseUrl
          + BINANCE_ALPHA_TOKEN_LIST_PATH,
          {
            method:
              'GET',
            headers: {
              accept:
                'application/json',
            },
            signal:
              controller.signal,
          },
        );

      if (!response.ok) {
        throw new Error(
          `Binance token metadata request failed with status ${response.status}`,
        );
      }

      const payload:
        unknown =
          await response.json();

      const urlsByAsset =
        selectLogoUrls(
          readCandidates(
            payload,
          ),
        );

      this.cache = {
        expiresAtMs:
          this.now().getTime()
          + this.cacheTtlMs,
        urlsByAsset,
      };

      return urlsByAsset;
    } finally {
      clearTimeout(
        timeout,
      );
    }
  }
}
