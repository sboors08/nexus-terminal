import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource =
  fs
    .readFileSync(
      new URL(
        '../src/pages/WatchlistPage.tsx',
        import.meta.url,
      ),
      'utf8',
    )
    .replace(
      /\r\n/g,
      '\n',
    );

const stylesSource =
  fs
    .readFileSync(
      new URL(
        '../src/pages/WatchlistPage.module.css',
        import.meta.url,
      ),
      'utf8',
    )
    .replace(
      /\r\n/g,
      '\n',
    );

const compactSource =
  pageSource.replace(
    /\s+/gu,
    '',
  );

test(
  'uses one shared realtime stream for every Watchlist row',
  () => {
    assert.equal(
      (
        pageSource.match(
          /useRealtimeMarketData\(/gu,
        )
        ?? []
      ).length,
      1,
    );

    assert.match(
      compactSource,
      /symbols:WATCHLIST_SYMBOLS/u,
    );

    assert.match(
      compactSource,
      /realtime=\{realtime\}/u,
    );

    assert.doesNotMatch(
      compactSource,
      /symbol:instrument\.symbol/u,
    );
  },
);

test(
  'labels the preset list and Binance Futures source honestly',
  () => {
    assert.match(
      pageSource,
      /Предустановленный список/u,
    );

    assert.match(
      pageSource,
      /Binance USDⓈ-M Futures/u,
    );

    assert.match(
      pageSource,
      /USDⓈ-M perpetual futures/u,
    );

    assert.doesNotMatch(
      pageSource,
      /Binance Spot/u,
    );

    assert.doesNotMatch(
      pageSource,
      /за которыми ты следишь/u,
    );
  },
);

test(
  'renders live, pending, error, and shared retry states',
  () => {
    assert.match(
      pageSource,
      /LIVE MARKET DATA/u,
    );

    assert.match(
      pageSource,
      /ОЖИДАНИЕ ПОТОКА/u,
    );

    assert.match(
      pageSource,
      /ОШИБКА ПОТОКА/u,
    );

    assert.match(
      compactSource,
      /onClick=\{realtime\.reconnect\}/u,
    );

    for (
      const className
      of [
        'statusLive',
        'statusPending',
        'statusError',
        'panelStatus',
        'panelStatusLive',
        'panelStatusPending',
        'panelStatusError',
      ]
    ) {
      assert.match(
        stylesSource,
        new RegExp(
          `\\.${className}\\b`,
          'u',
        ),
      );
    }
  },
);