import { useMemo } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { useFeedbackPageContext } from '@/shared/feedback/FeedbackProvider';
import { buildMarketWorkspaceUrl } from '@/shared/routing/setupContext';
import { TokenLogo } from '@/shared/ui/TokenLogo';
import {
  buildWatchlistRealtimeView,
  useRealtimeMarketData,
  type WatchlistRealtimeTone,
} from '@/shared/realtime';
import styles from './WatchlistPage.module.css';

interface WatchlistInstrument {
  symbol: string;
  name: string;
  exchange: string;
  timeframe: string;
}

const WATCHLIST_INSTRUMENTS: WatchlistInstrument[] = [
  {
    symbol: 'BTCUSDT',
    name: 'Bitcoin',
    exchange: 'Binance',
    timeframe: '1m',
  },
  {
    symbol: 'ETHUSDT',
    name: 'Ethereum',
    exchange: 'Binance',
    timeframe: '1m',
  },
  {
    symbol: 'SOLUSDT',
    name: 'Solana',
    exchange: 'Binance',
    timeframe: '1m',
  },
  {
    symbol: 'INJUSDT',
    name: 'Injective',
    exchange: 'Binance',
    timeframe: '1m',
  },
];

const WATCHLIST_SYMBOLS =
  WATCHLIST_INSTRUMENTS.map(
    (instrument) => instrument.symbol,
  );

type WatchlistRealtimeState =
  ReturnType<typeof useRealtimeMarketData>;

interface WatchlistRowProps {
  instrument: WatchlistInstrument;
  realtime: WatchlistRealtimeState;
}

function getStatusClass(
  tone: WatchlistRealtimeTone,
): string {
  if (tone === 'live') return styles.statusLive;
  if (tone === 'error') return styles.statusError;
  return styles.statusPending;
}

function getPanelStatusClass(
  tone: WatchlistRealtimeTone,
): string {
  if (tone === 'live') return styles.panelStatusLive;
  if (tone === 'error') return styles.panelStatusError;
  return styles.panelStatusPending;
}

function getPanelStatusLabel(
  tone: WatchlistRealtimeTone,
): string {
  if (tone === 'live') return 'LIVE MARKET DATA';
  if (tone === 'error') return 'ОШИБКА ПОТОКА';
  return 'ОЖИДАНИЕ ПОТОКА';
}

function WatchlistRow({
  instrument,
  realtime,
}: WatchlistRowProps) {
  const snapshot =
    realtime.snapshots[instrument.symbol];

  const view = useMemo(
    () => buildWatchlistRealtimeView(
      snapshot,
      realtime.lifecycleState,
      realtime.status?.state ?? null,
    ),
    [
      snapshot,
      realtime.lifecycleState,
      realtime.status?.state,
    ],
  );

  const workspaceUrl =
    buildMarketWorkspaceUrl(
      ROUTES.workspace,
      instrument.symbol,
      instrument.timeframe,
    );

  return (
    <article className={styles.instrumentRow}>
      <div className={styles.instrumentCell}>
        <TokenLogo
          symbol={instrument.symbol}
          size={36}
          className={styles.symbolMark}
        />

        <span>
          <strong>{instrument.symbol}</strong>
          <small>
            {instrument.name} · {instrument.exchange}
          </small>
        </span>
      </div>

      <div className={styles.priceCell}>
        <span>Цена</span>
        <strong>{view.priceLabel}</strong>
        <small>
          {view.isLive ? 'LIVE' : 'Ожидание данных'}
        </small>
      </div>

      <div className={styles.marketCell}>
        <span>Bid</span>
        <strong className={styles.bidValue}>
          {view.bidLabel}
        </strong>
      </div>

      <div className={styles.marketCell}>
        <span>Ask</span>
        <strong className={styles.askValue}>
          {view.askLabel}
        </strong>
      </div>

      <div className={styles.spreadCell}>
        <span>Спред</span>
        <strong>{view.spreadLabel}</strong>
      </div>

      <div className={styles.connectionCell}>
        <span
          className={
            `${styles.statusDot} `
            + getStatusClass(view.connectionTone)
          }
        />

        <span>
          <strong>{view.connectionLabel}</strong>
          <small>
            {view.isLive
              ? `Обновлено ${view.updatedAtLabel}`
              : instrument.symbol}
          </small>
        </span>
      </div>

      <Link
        className={styles.openButton}
        to={workspaceUrl}
      >
        Открыть
      </Link>
    </article>
  );
}

export function WatchlistPage() {
  useFeedbackPageContext({
    screen: 'Watchlist',
  });

  const realtime = useRealtimeMarketData({
    symbols: WATCHLIST_SYMBOLS,
  });

  const connectionView = useMemo(
    () => buildWatchlistRealtimeView(
      undefined,
      realtime.lifecycleState,
      realtime.status?.state ?? null,
    ),
    [
      realtime.lifecycleState,
      realtime.status?.state,
    ],
  );

  return (
    <section className={styles.watchlistPage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
            Предустановленный список · Binance USDⓈ-M Futures · realtime
          </p>

          <h1 className={styles.title}>
            Watchlist
          </h1>

          <p className={styles.subtitle}>
            Живые цены, Bid, Ask и спред по предустановленным инструментам.
          </p>
        </div>

        <div className={styles.headerStatus}>
          <span
            className={
              `${styles.statusDot} `
              + getStatusClass(
                connectionView.connectionTone,
              )
            }
          />

          <span>
            {connectionView.connectionLabel}
            {' · '}
            {WATCHLIST_INSTRUMENTS.length}
            {' инструментов'}
          </span>

          {realtime.error && (
            <button
              className={styles.reconnectButton}
              type="button"
              onClick={realtime.reconnect}
            >
              Повторить
            </button>
          )}
        </div>
      </header>

      <section className={styles.summaryGrid}>
        <article>
          <span>Инструменты</span>
          <strong>
            {WATCHLIST_INSTRUMENTS.length}
          </strong>
          <small>предустановленный список</small>
        </article>

        <article>
          <span>Источник</span>
          <strong>Binance</strong>
          <small>USDⓈ-M perpetual futures</small>
        </article>

        <article>
          <span>Режим</span>
          <strong>Один поток</strong>
          <small>групповая SSE-подписка</small>
        </article>
      </section>

      <section className={styles.watchlistPanel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.panelEyebrow}>
              Рынок
            </p>
            <h2>Предустановленные инструменты</h2>
          </div>

          <span
            className={
              `${styles.panelStatus} `
              + getPanelStatusClass(
                connectionView.connectionTone,
              )
            }
          >
            {getPanelStatusLabel(
              connectionView.connectionTone,
            )}
          </span>
        </div>

        <div
          className={styles.tableHeader}
          aria-hidden="true"
        >
          <span>Инструмент</span>
          <span>Цена</span>
          <span>Bid</span>
          <span>Ask</span>
          <span>Спред</span>
          <span>Соединение</span>
          <span>Действие</span>
        </div>

        <div className={styles.instrumentList}>
          {WATCHLIST_INSTRUMENTS.map(
            (instrument) => (
              <WatchlistRow
                key={instrument.symbol}
                instrument={instrument}
                realtime={realtime}
              />
            ),
          )}
        </div>
      </section>
    </section>
  );
}