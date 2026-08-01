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
  'labels fixture events and local-only controls honestly',
  () => {
    assert.match(
      pageSource,
      /TEST DATA: события, причины, метрики и правила/u,
    );

    assert.match(
      pageSource,
      /фиксированный сценарий интерфейса/u,
    );

    assert.match(
      pageSource,
      /локально до перезагрузки/u,
    );

    assert.match(
      pageSource,
      /сбрасываются после перезагрузки/u,
    );

    assert.match(
      pageSource,
      /Тестовые правила/u,
    );

    assert.doesNotMatch(
      pageSource,
      /Сработали сегодня/u,
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