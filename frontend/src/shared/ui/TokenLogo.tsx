import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import styles from './TokenLogo.module.css';

const TOKEN_LOGO_QUOTE_ASSETS = [
  'FDUSD',
  'USDT',
  'USDC',
  'BUSD',
  'TUSD',
  'USD',
  'BTC',
  'ETH',
  'BNB',
] as const;

export function getTokenBaseAsset(
  symbol: string,
): string {
  const normalized =
    symbol
      .trim()
      .toUpperCase()
      .replace(
        /[^A-Z0-9]/gu,
        '',
      );

  const quoteAsset =
    TOKEN_LOGO_QUOTE_ASSETS.find(
      (quote) =>
        normalized.endsWith(quote)
        && normalized.length > quote.length,
    );

  const rawBaseAsset =
    quoteAsset
      ? normalized.slice(
          0,
          -quoteAsset.length,
        )
      : normalized;

  const baseAsset =
    rawBaseAsset.replace(
      /^(?:1000000|10000|1000)(?=[A-Z])/u,
      '',
    );

  return (
    baseAsset
    || rawBaseAsset
    || normalized
    || '?'
  );
}

export function getTokenLogoSources(
  symbol: string,
  preferredSource?: string | null,
): string[] {
  const baseAsset =
    getTokenBaseAsset(symbol)
      .toLowerCase();

  if (
    baseAsset.length === 0
    || baseAsset === '?'
  ) {
    return [];
  }

  const encodedAsset =
    encodeURIComponent(baseAsset);

  const fallbackSources = [
    `https://assets.coincap.io/assets/icons/${encodedAsset}@2x.png`,
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${encodedAsset}.png`,
  ];

  if (!preferredSource) {
    return fallbackSources;
  }

  try {
    const url = new URL(preferredSource);

    if (url.protocol !== 'https:') {
      return fallbackSources;
    }

    return Array.from(
      new Set([
        url.toString(),
        ...fallbackSources,
      ]),
    );
  } catch {
    return fallbackSources;
  }
}

interface TokenLogoProps {
  symbol: string;
  preferredSource?: string | null;
  size?: number;
  className?: string;
  eager?: boolean;
}

export function TokenLogo({
  symbol,
  preferredSource = null,
  size = 32,
  className = '',
  eager = false,
}: TokenLogoProps) {
  const baseAsset =
    getTokenBaseAsset(symbol);

  const sources =
    useMemo(
      () =>
        getTokenLogoSources(
          symbol,
          preferredSource,
        ),
      [
        preferredSource,
        symbol,
      ],
    );

  const [
    sourceIndex,
    setSourceIndex,
  ] = useState(0);

  useEffect(
    () => {
      setSourceIndex(0);
    },
    [
      baseAsset,
      preferredSource,
    ],
  );

  const source =
    sources[sourceIndex]
    ?? null;

  const classNames = [
    styles.root,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={classNames}
      style={{
        '--token-logo-size': `${size}px`,
      } as CSSProperties}
      role="img"
      aria-label={`${baseAsset} logo`}
      title={baseAsset}
    >
      {
        source
          ? (
              <img
                key={source}
                className={styles.image}
                src={source}
                alt=""
                loading={
                  eager
                    ? 'eager'
                    : 'lazy'
                }
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => {
                  setSourceIndex(
                    (current) =>
                      current + 1,
                  );
                }}
              />
            )
          : (
              <span
                className={styles.fallback}
                aria-hidden="true"
              >
                {baseAsset.slice(0, 2)}
              </span>
            )
      }
    </span>
  );
}
