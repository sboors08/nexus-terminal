import { useMemo } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { useFeedbackPageContext } from '@/shared/feedback/FeedbackProvider';
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

function getStatusClass(tone: WatchlistRealtimeTone): string {
  if (tone === 'live') return styles.statusLive;
  if (tone === 'error') return styles.statusError;
  return styles.statusPending;
}

function WatchlistRow({ instrument }: { instrument: WatchlistInstrument }) {
  const realtime = useRealtimeMarketData({
    symbol: instrument.symbol,
  });

  const snapshot = realtime.snapshots[instrument.symbol];

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
    `${ROUTES.workspace}?symbol=${encodeURIComponent(instrument.symbol)}`
    + `&timeframe=${encodeURIComponent(instrument.timeframe)}`;

  return (
    <article className={styles.instrumentRow}>
      <div className={styles.instrumentCell}>
        <span className={styles.symbolMark}>
          {instrument.symbol.slice(0, 1)}
        </span>

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
        <small>{view.isLive ? 'LIVE' : 'Ожидание данных'}</small>
      </div>

      <div className={styles.marketCell}>
        <span>Bid</span>
        <strong className={styles.bidValue}>{view.bidLabel}</strong>
      </div>

      <div className={styles.marketCell}>
        <span>Ask</span>
        <strong className={styles.askValue}>{view.askLabel}</strong>
      </div>

      <div className={styles.spreadCell}>
        <span>Спред</span>
        <strong>{view.spreadLabel}</strong>
      </div>

      <div className={styles.connectionCell}>
        <span className={`${styles.statusDot} ${getStatusClass(view.connectionTone)}`} />
        <span>
          <strong>{view.connectionLabel}</strong>
          <small>
            {view.isLive
              ? `Обновлено ${view.updatedAtLabel}`
              : instrument.symbol}
          </small>
        </span>
      </div>

      <Link className={styles.openButton} to={workspaceUrl}>
        Открыть
      </Link>

      {realtime.error && (
        <button
          className={styles.reconnectButton}
          type="button"
          onClick={realtime.reconnect}
        >
          Повторить
        </button>
      )}
    </article>
  );
}

export function WatchlistPage() {
  useFeedbackPageContext({
    screen: 'Watchlist',
  });

  return (
    <section className={styles.watchlistPage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
            Избранные инструменты · Binance Spot · realtime
          </p>
          <h1 className={styles.title}>Watchlist</h1>
          <p className={styles.subtitle}>
            Живые цены, Bid, Ask и спред по инструментам,
            за которыми ты следишь.
          </p>
        </div>

        <div className={styles.headerStatus}>
          <span className={styles.liveDot} />
          {WATCHLIST_INSTRUMENTS.length} инструментов
        </div>
      </header>

      <section className={styles.summaryGrid}>
        <article>
          <span>Инструменты</span>
          <strong>{WATCHLIST_INSTRUMENTS.length}</strong>
          <small>в текущем списке</small>
        </article>

        <article>
          <span>Источник</span>
          <strong>Binance</strong>
          <small>публичный Spot-поток</small>
        </article>

        <article>
          <span>Режим</span>
          <strong>Realtime</strong>
          <small>динамические подписки</small>
        </article>
      </section>

      <section className={styles.watchlistPanel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.panelEyebrow}>Рынок</p>
            <h2>Избранные инструменты</h2>
          </div>

          <span>LIVE MARKET DATA</span>
        </div>

        <div className={styles.tableHeader} aria-hidden="true">
          <span>Инструмент</span>
          <span>Цена</span>
          <span>Bid</span>
          <span>Ask</span>
          <span>Спред</span>
          <span>Соединение</span>
          <span>Действие</span>
        </div>

        <div className={styles.instrumentList}>
          {WATCHLIST_INSTRUMENTS.map((instrument) => (
            <WatchlistRow
              key={instrument.symbol}
              instrument={instrument}
            />
          ))}
        </div>
      </section>
    </section>
  );
}
