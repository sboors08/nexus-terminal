import type { MarketSymbol } from '@/shared/api';
import {
  formatScannerPrice,
  formatScannerQuantity,
  formatScannerTradeTime,
  type RealtimeLiquidation,
  type ScannerRealtimeMarketView,
} from '@/shared/realtime';
import styles from './ScannerPage.module.css';

export function findScannerMarketSymbol24h(
  marketSymbols: readonly MarketSymbol[],
  symbol: string,
): MarketSymbol | null {
  const normalizedSymbol =
    symbol
      .trim()
      .replace(/\//gu, '')
      .toUpperCase();

  return (
    marketSymbols.find(
      (marketSymbol) =>
        marketSymbol.symbol
          .trim()
          .replace(/\//gu, '')
          .toUpperCase()
        === normalizedSymbol,
    )
    ?? null
  );
}

export function formatScanner24hPercent(
  value: number | null | undefined,
  includeSign = true,
): string {
  if (
    value === null
    || value === undefined
    || !Number.isFinite(value)
  ) {
    return '—';
  }

  return (
    `${includeSign && value > 0 ? '+' : ''}`
    + `${value.toFixed(2)}%`
  );
}

function formatCompactValue(
  value: number | null | undefined,
): string {
  if (
    value === null
    || value === undefined
    || !Number.isFinite(value)
  ) {
    return '—';
  }

  return new Intl.NumberFormat(
    'en-US',
    {
      notation: 'compact',
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatCorrelation(
  value: number | null | undefined,
): string {
  if (
    value === null
    || value === undefined
    || !Number.isFinite(value)
  ) {
    return '—';
  }

  return value.toFixed(2);
}

function formatOpenInterest(
  value: number | null | undefined,
): string {
  if (
    value === null
    || value === undefined
    || !Number.isFinite(value)
  ) {
    return '—';
  }

  return new Intl.NumberFormat(
    'ru-RU',
    {
      notation: 'compact',
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatFundingRate(
  value: number | null | undefined,
): string {
  if (
    value === null
    || value === undefined
    || !Number.isFinite(value)
  ) {
    return '—';
  }

  return (
    `${value > 0 ? '+' : ''}`
    + `${value.toFixed(4)}%`
  );
}

function formatUpdatedAt(value: string | null): string {
  if (!value) {
    return 'нет данных';
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return 'обновлено';
  }

  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    },
  ).format(timestamp);
}

interface ScannerChartMarketOverlayProps {
  symbol: string;
  market24h: MarketSymbol | null;
  realtimeMarket: ScannerRealtimeMarketView;
  realtimeDotClassName: string;
  markPrice: number | null;
  fundingRatePct: number | null;
  openInterest: number | null | undefined;
  latestLiquidation: RealtimeLiquidation | null;
  liquidationStatus: string;
  hasRealtimeError: boolean;
  hasFuturesError: boolean;
  onReconnect: () => void;
  onRetryFutures: () => void;
}

export function ScannerChartMarketOverlay({
  symbol,
  market24h,
  realtimeMarket,
  realtimeDotClassName,
  markPrice,
  fundingRatePct,
  openInterest,
  latestLiquidation,
  liquidationStatus,
  hasRealtimeError,
  hasFuturesError,
  onReconnect,
  onRetryFutures,
}: ScannerChartMarketOverlayProps) {
  const priceChangeClassName =
    market24h === null
      ? undefined
      : market24h.priceChangePct < 0
        ? styles.negativeValue
        : styles.positiveValue;

  return (
    <aside
      className={styles.chartMarketOverlay}
      aria-label={`Рынок ${symbol} за 24 часа`}
    >
      <header className={styles.chartMarketOverlayHeader}>
        <strong>24Ч · BINANCE</strong>
        <small>{formatUpdatedAt(market24h?.updatedAt ?? null)}</small>
      </header>

      <dl className={styles.chartMarketStats}>
        <div>
          <dt>Объём</dt>
          <dd>
            {market24h
              ? `$${formatCompactValue(market24h.volumeQuote)}`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Изменение</dt>
          <dd className={priceChangeClassName}>
            {formatScanner24hPercent(market24h?.priceChangePct)}
          </dd>
        </div>
        <div>
          <dt>Волатильность</dt>
          <dd>
            {formatScanner24hPercent(
              market24h?.volatilityPct,
              false,
            )}
          </dd>
        </div>
        <div>
          <dt>Сделки</dt>
          <dd>{formatCompactValue(market24h?.tradesCount)}</dd>
        </div>
        <div>
          <dt>Корр. с BTC</dt>
          <dd>{formatCorrelation(market24h?.btcCorrelation)}</dd>
        </div>
      </dl>

      <details className={styles.chartLiveDetails}>
        <summary>
          <span className={realtimeDotClassName} />
          LIVE
          <i aria-hidden="true" />
        </summary>

        <section
          className={styles.chartLivePopover}
          aria-label={`Realtime и futures метрики ${symbol}`}
        >
          <div className={styles.chartLiveGrid}>
            <span>
              Bid
              <strong className={styles.positiveValue}>
                {realtimeMarket.bidLabel}
              </strong>
            </span>
            <span>
              Ask
              <strong className={styles.negativeValue}>
                {realtimeMarket.askLabel}
              </strong>
            </span>
            <span>
              Спред
              <strong>{realtimeMarket.spreadLabel}</strong>
            </span>
            <span>
              Mark Price
              <strong>
                {markPrice === null
                  ? '—'
                  : formatScannerPrice(markPrice)}
              </strong>
            </span>
            <span>
              Funding
              <strong
                className={
                  fundingRatePct !== null
                  && fundingRatePct < 0
                    ? styles.negativeValue
                    : styles.positiveValue
                }
              >
                {formatFundingRate(fundingRatePct)}
              </strong>
            </span>
            <span>
              Open Interest
              <strong>{formatOpenInterest(openInterest)}</strong>
            </span>
          </div>

          <footer className={styles.chartLiveFooter}>
            <span>
              {realtimeMarket.isLive
                ? `Рынок обновлён ${realtimeMarket.updatedAtLabel}`
                : `Для ${symbol} нет realtime-подписки`}
            </span>
            <span>
              {latestLiquidation
                ? (
                    `Ликвидация: `
                    + `${latestLiquidation.side.toUpperCase()} · `
                    + `${formatScannerQuantity(latestLiquidation.filledQuantity)} @ `
                    + `${formatScannerPrice(latestLiquidation.averagePrice || latestLiquidation.price)} · `
                    + formatScannerTradeTime(
                        latestLiquidation.tradeAt,
                      )
                  )
                : liquidationStatus === 'error'
                  ? 'Liquidation feed недоступен'
                  : 'В realtime-окне ликвидаций нет'}
            </span>

            {(hasRealtimeError || hasFuturesError) && (
              <button
                type="button"
                onClick={() => {
                  if (hasRealtimeError) {
                    onReconnect();
                  }

                  if (hasFuturesError) {
                    onRetryFutures();
                  }
                }}
              >
                Повторить подключение
              </button>
            )}
          </footer>
        </section>
      </details>
    </aside>
  );
}
