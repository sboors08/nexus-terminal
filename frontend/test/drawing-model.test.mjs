import assert from 'node:assert/strict';
import {
  readFileSync,
} from 'node:fs';
import test from 'node:test';
import {
  loadNexusDrawings,
  moveNexusDrawing,
  removeNexusDrawingById,
  saveNexusDrawings,
  toggleNexusDrawingLock,
  toggleNexusDrawingVisibility,
  updateNexusDrawingPoint,
} from '../node_modules/.tmp/realtime-test/charts/model/drawingModel.js';

function createTrend() {
  return {
    id: 'trend-1',
    type: 'trend',
    locked: false,
    hidden: false,
    points: [
      {
        time: 100,
        price: 10,
      },
      {
        time: 200,
        price: 20,
      },
    ],
  };
}

test(
  'moves a drawing without mutating the original',
  () => {
    const drawing =
      createTrend();

    const moved =
      moveNexusDrawing(
        drawing,
        5,
        2,
      );

    assert.deepEqual(
      moved.points,
      [
        {
          time: 105,
          price: 12,
        },
        {
          time: 205,
          price: 22,
        },
      ],
    );

    assert.deepEqual(
      drawing.points,
      [
        {
          time: 100,
          price: 10,
        },
        {
          time: 200,
          price: 20,
        },
      ],
    );
  },
);

test(
  'does not move or edit a locked drawing',
  () => {
    const drawing = {
      ...createTrend(),
      locked: true,
    };

    assert.strictEqual(
      moveNexusDrawing(
        drawing,
        10,
        5,
      ),
      drawing,
    );

    assert.strictEqual(
      updateNexusDrawingPoint(
        drawing,
        0,
        {
          time: 500,
          price: 50,
        },
      ),
      drawing,
    );
  },
);

test(
  'updates position targets and stop price',
  () => {
    const drawing = {
      id: 'long-1',
      type: 'longPosition',
      locked: false,
      hidden: false,
      points: [
        {
          time: 100,
          price: 20,
        },
        {
          time: 200,
          price: 25,
        },
      ],
      stopPrice: 18,
    };

    const targetUpdated =
      updateNexusDrawingPoint(
        drawing,
        1,
        {
          time: 220,
          price: 27,
        },
      );

    assert.deepEqual(
      targetUpdated.points[1],
      {
        time: 220,
        price: 27,
      },
    );

    const stopUpdated =
      updateNexusDrawingPoint(
        targetUpdated,
        2,
        {
          time: 220,
          price: 17,
        },
      );

    assert.equal(
      stopUpdated.stopPrice,
      17,
    );
  },
);

test(
  'toggles drawing lock and visibility',
  () => {
    const drawing =
      createTrend();

    assert.equal(
      toggleNexusDrawingLock(
        drawing,
      ).locked,
      true,
    );

    assert.equal(
      toggleNexusDrawingVisibility(
        drawing,
      ).hidden,
      true,
    );
  },
);

test(
  'removes only the targeted drawing without mutating the original list',
  () => {
    const first =
      createTrend();

    const second = {
      ...createTrend(),
      id: 'trend-2',
    };

    const drawings = [
      first,
      second,
    ];

    const result =
      removeNexusDrawingById(
        drawings,
        first.id,
      );

    assert.deepEqual(
      result,
      [
        second,
      ],
    );

    assert.deepEqual(
      drawings,
      [
        first,
        second,
      ],
    );
  },
);

test(
  'keeps chart tools one-shot and protects locked drawings from right-click deletion',
  () => {
    const overlaySource =
      readFileSync(
        new URL(
          '../src/shared/charts/ui/NexusChartDrawingOverlay.tsx',
          import.meta.url,
        ),
        'utf8',
      );

    const overlayStyles =
      readFileSync(
        new URL(
          '../src/shared/charts/ui/NexusChartDrawingOverlay.module.css',
          import.meta.url,
        ),
        'utf8',
      );

    const completeDrawingStart =
      overlaySource.indexOf(
        'const completeDrawing =',
      );

    const pointerDownStart =
      overlaySource.indexOf(
        'const handlePointerDown =',
      );

    const completeDrawingSource =
      overlaySource.slice(
        completeDrawingStart,
        pointerDownStart,
      );

    assert.ok(
      completeDrawingStart >= 0,
    );

    assert.ok(
      pointerDownStart
      > completeDrawingStart,
    );

    assert.match(
      completeDrawingSource,
      /setActiveTool\('cursor'\);/,
    );

    assert.equal(
      overlaySource.match(
        /completeDrawing\(drawing\);/g,
      )?.length,
      6,
    );

    assert.match(
      overlaySource,
      /onContextMenu=\{/,
    );

    assert.match(
      overlaySource,
      /addEventListener\(\s*'contextmenu'/,
    );

    assert.match(
      overlaySource,
      /if \(hit\.locked\)/,
    );

    assert.match(
      overlaySource,
      /removeNexusDrawingById\(/,
    );

    assert.match(
      overlaySource,
      /quickMeasureDraft/,
    );

    assert.match(
      overlaySource,
      /if \(event\.shiftKey\)/,
    );

    assert.match(
      overlaySource,
      /Shift \+ ЛКМ/,
    );

    assert.match(
      overlaySource,
      /id: 'horizontalRay',\s*label: 'Горизонтальная линия',\s*shortcut: 'Alt \+ H'/,
    );

    assert.doesNotMatch(
      overlaySource,
      /id: 'horizontal',\s*label: 'Горизонтальная линия'/,
    );

    assert.match(
      overlaySource,
      /\['h', 'horizontalRay'\]/,
    );

    assert.match(
      overlaySource,
      /x1=\{start\.x\}[\s\S]*x2=\{width\}[\s\S]*y2=\{start\.y\}/,
    );

    assert.match(
      overlaySource,
      /styles\.measureArea/,
    );

    assert.match(
      overlaySource,
      /styles\.measureBadge/,
    );

    assert.match(
      overlaySource,
      /Бары: \{measuredCandleCount\}/,
    );

    assert.doesNotMatch(
      overlaySource,
      /styles\.measureLine/,
    );

    assert.match(
      overlayStyles,
      /\.measureGuide \{/,
    );

    assert.match(
      overlayStyles,
      /\.measureArea \{/,
    );

    assert.match(
      overlaySource,
      /quickMeasureDragging/,
    );

    assert.match(
      overlaySource,
      /quickMeasureDraft\s*&& !event\.shiftKey/,
    );

    assert.match(
      overlaySource,
      /event\.shiftKey\s*\|\| activeTool === 'measure'/,
    );

    assert.match(
      overlaySource,
      /drawing\.type\s*!=+ 'measure'/,
    );

    assert.doesNotMatch(
      overlaySource,
      /'fibRetracement',\s*'measure',\s*'longPosition'/,
    );

    assert.doesNotMatch(
      overlaySource,
      /label: 'Коррекция Fibonacci'/,
    );

    assert.doesNotMatch(
      overlaySource,
      /label: 'Расширение Fibonacci'/,
    );

    assert.match(
      overlayStyles,
      /\.toolFlyout \{/,
    );

    assert.match(
      overlayStyles,
      /flex-direction: column;/,
    );
  },
);

test(
  'persists drawings separately for each scope',
  () => {
    const storage =
      new Map();

    const previousWindow =
      globalThis.window;

    globalThis.window = {
      localStorage: {
        getItem(key) {
          return storage.has(key)
            ? storage.get(key)
            : null;
        },

        setItem(key, value) {
          storage.set(
            key,
            String(value),
          );
        },
      },
    };

    try {
      const drawing =
        createTrend();

      saveNexusDrawings(
        'SOLUSDT:5m',
        [
          drawing,
        ],
      );

      assert.deepEqual(
        loadNexusDrawings(
          'SOLUSDT:5m',
        ),
        [
          drawing,
        ],
      );

      assert.deepEqual(
        loadNexusDrawings(
          'BTCUSDT:5m',
        ),
        [],
      );

      storage.set(
        'nexus:chart-drawings:v1:invalid',
        JSON.stringify([
          {
            id: 'broken',
          },
        ]),
      );

      assert.deepEqual(
        loadNexusDrawings(
          'invalid',
        ),
        [],
      );
    } finally {
      if (
        previousWindow
        === undefined
      ) {
        delete globalThis.window;
      } else {
        globalThis.window =
          previousWindow;
      }
    }
  },
);
