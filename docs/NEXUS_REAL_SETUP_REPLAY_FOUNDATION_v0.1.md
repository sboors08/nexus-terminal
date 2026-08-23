# NEXUS Real Setup Replay Foundation v0.1

## Статус

Production Replay foundation поверх `Persistent Setup Event History`.

Этап переводит пользовательский `/app/replay` с frontend fixture-сценария на фактическую последовательность сохранённых Setup Engine lifecycle events.

## Источник правды

Backend source:

`SetupEventHistoryReader`

HTTP:

`GET /api/v1/setups/candidates/:candidateId/replay`

Contract:

`real-setup-replay-v0.1`

Один Replay session соответствует одному restart-deterministic Setup candidate / episode identity.

## Что является кадром Replay

Один frame — один реально сохранённый lifecycle event вместе с candidate snapshot, который был записан History в этот момент.

Frame содержит:

- persistent History `eventId`;
- event type;
- фактический timestamp;
- previous/current Setup stage;
- factual Setup outcome;
- candidate current price;
- distance to level;
- level kind/center/zone/touches;
- candidate snapshot `updatedAt`;
- expiry;
- episode identity;
- causal `lineId`.

Frames сортируются по persistent History `eventId`.

Interpolation между событиями отсутствует.

## Factual result

Replay использует только lifecycle result:

- `active`;
- `breakout_confirmed`;
- `rejection_confirmed`;
- `expired`.

Эти значения не преобразуются в `successful/failed` и не являются PnL.

## Bounded retention

Если `candidate_created` ещё присутствует в retained buffer:

`historyComplete = true`

Если ранние events уже удалены capacity policy:

`historyComplete = false`

Replay в таком случае начинается с первого реально retained event и явно маркируется как partial.

Отсутствующие events не реконструируются.

## Data capabilities v0.1

Доступно:

- реальные lifecycle frames;
- реальные candidate snapshot prices в моменты lifecycle events;
- level snapshot;
- candidate/episode/line identity.

Недоступно и не синтезируется:

- historical OHLC candles;
- historical Binance aggTrade tape;
- historical order book;
- liquidity map;
- volume/trades time series;
- PnL;
- max favorable/adverse move;
- time-to-target;
- profitability classification.

Contract явно отдаёт capability flags для этих границ.

## Frontend

Пользовательский Replay route использует `ReplayRuntimePage`.

Страница:

- получает `setupId` из route context;
- загружает runtime Replay по candidate id;
- воспроизводит только factual lifecycle frames;
- позволяет first/back/play/forward и slider по retained events;
- показывает stage, price snapshot, distance, level, event time и identity;
- показывает frame-local lifecycle state и не раскрывает final session result до перехода playhead на terminal frame;
- показывает complete/partial history;
- сохраняет переходы обратно в Market History и Workspace;
- слушает Setup lifecycle SSE только как trigger для повторного чтения backend Replay.

Скорость `0.5×–4×` — скорость просмотра событий в UI, а не попытка воспроизвести исторические интервалы в масштабе времени.

Старый fixture `ReplayPage` и `replayData.ts` могут временно оставаться в кодовой базе для isolated legacy integrity coverage, но production `/app/replay` больше их не использует.

## Safety boundaries

Этап не меняет:

- Level Lines;
- Observation threshold;
- Approach threshold;
- realtime Confirmation;
- breakout/rejection/expiry;
- Setup candidate identity;
- episode rearm;
- ranking;
- touch rules;
- persistence retention.

Не создаются:

- signals;
- orders;
- trade execution;
- synthetic market history;
- profitability labels;
- Self-Learning.

## Проверки

Обязательные:

- backend replay projection;
- bounded-retention partial Replay;
- route 400/404/503 behavior;
- buildApp integration;
- frontend runtime parser/fetch;
- production Replay route source test;
- Market History → Replay navigation test;
- backend/frontend typecheck;
- production builds;
- full regression;
- audits;
- `git diff --check`.

## Следующий отдельный этап

После merge и зелёного post-merge CI:

`NEXUS Setup Outcome Dataset / Validation`

Profitability и Self-Learning не включаются автоматически. Они требуют отдельного контракта, достаточной реальной выборки и отдельного решения пользователя.
