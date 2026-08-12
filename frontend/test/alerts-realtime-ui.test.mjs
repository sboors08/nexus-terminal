import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource =
  fs
    .readFileSync(
      new URL(
        '../src/pages/AlertsPage.tsx',
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
        '../src/pages/AlertsPage.module.css',
        import.meta.url,
      ),
      'utf8',
    )
    .replace(
      /\r\n/g,
      '\n',
    );

const shellSource =
  fs
    .readFileSync(
      new URL(
        '../src/app/layout/AppShell.tsx',
        import.meta.url,
      ),
      'utf8',
    )
    .replace(
      /\r\n/g,
      '\n',
    );

const compactPageSource =
  pageSource.replace(
    /\s+/gu,
    '',
  );

test(
  'uses one shared Binance realtime stream for Alerts symbols',
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
      compactPageSource,
      /symbols:realtimeSymbols/u,
    );

    assert.match(
      pageSource,
      /Binance USDⓈ-M Futures/u,
    );

    assert.match(
      compactPageSource,
      /onClick=\{realtime\.reconnect\}/u,
    );
  },
);

test(
  'labels backend runtime events and persistence boundary honestly',
  () => {
    assert.match(
      pageSource,
      /Backend Alerts runtime/u,
    );

    assert.match(
      pageSource,
      /PERSISTENT v/u,
    );

    assert.match(
      pageSource,
      /RUNTIME ONLY/u,
    );

    assert.match(
      pageSource,
      /сбрасываются при перезапуске backend/u,
    );

    assert.match(
      pageSource,
      /только в этой вкладке/u,
    );

    assert.match(
      pageSource,
      /Правила Alerts/u,
    );

    assert.doesNotMatch(
      pageSource,
      /TEST DATA/u,
    );

    assert.doesNotMatch(
      pageSource,
      /nexusApi\.getAlertsView/u,
    );
  },
);

test(
  'does not advertise an unavailable AI analysis feature',
  () => {
    assert.match(
      shellSource,
      /\{ label: 'ALERTS', path: ROUTES\.alerts/u,
    );

    assert.doesNotMatch(
      shellSource,
      /AI ANALYSIS/u,
    );
  },
);

test(
  'includes explicit source notice and realtime state styles',
  () => {
    for (
      const className
      of [
        'dataNotice',
        'liveStatus_live',
        'liveStatus_pending',
        'liveStatus_error',
        'testBadge',
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

    assert.match(
      pageSource,
      /Повторить поток/u,
    );
  },
);
