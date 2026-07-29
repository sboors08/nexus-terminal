import assert from 'node:assert/strict';
import {
  readFileSync,
} from 'node:fs';
import test from 'node:test';

test(
  'shadow evaluation maps the current lifecycle role',
  () => {
    const source =
      readFileSync(
        new URL(
          '../src/modules/setup-engine/level-v2/level-v2-shadow-runtime.ts',
          import.meta.url,
        ),
        'utf8',
      );

    assert.match(
      source,
      /kind:\s*\r?\n\s*state\.currentKind,/u,
    );

    assert.doesNotMatch(
      source,
      /kind:\s*\r?\n\s*state\.level\.kind,/u,
    );
  },
);