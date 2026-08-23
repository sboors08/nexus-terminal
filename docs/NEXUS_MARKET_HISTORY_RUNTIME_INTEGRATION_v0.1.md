# NEXUS Market History Runtime Integration v0.1

## Статус

Runtime read-model и frontend-интеграция поверх `NEXUS Persistent Setup Event History Foundation v0.1`.

Этап переводит пользовательский маршрут Market History с fixture archive на реальные сохранённые Setup lifecycle facts.

## Источник данных

Backend source of truth:

`SetupEventHistoryReader`

HTTP read-model:

`GET /api/v1/setups/history`

Contract:

`market-history-runtime-v0.1`

Источник уже переживает restart через Persistent Setup Event History Foundation v0.1.

## Одна запись History

Одна runtime-запись соответствует одному restart-deterministic Setup candidate / episode identity.

Read-model группирует persistent lifecycle events по `candidateId` и отдаёт:

- setup / episode identity;
- symbol;
- timeframe;
- setup type;
- LONG / SHORT direction;
- Level kind и zone;
- touches;
- detected/current price из сохранённых candidate snapshots;
- current distance to level;
- first / last persistent History event id;
- detected/latest/completed timestamps;
- current Setup Engine stage;
- factual lifecycle result;
- episode id;
- causal line id;
- ordered lifecycle events;
- признак полного retained lifecycle (`candidate_created` присутствует) или partial history из-за bounded retention.

## Factual lifecycle result

Runtime History использует только факты Setup Engine:

- `active`;
- `breakout_confirmed`;
- `rejection_confirmed`;
- `expired`.

Эти состояния не преобразуются в `successful/failed` и не считаются PnL.

`BREAKOUT_CONFIRMED` и `REJECTION_CONFIRMED` являются lifecycle outcomes текущего Setup Engine, а не доказательством прибыльности сделки.

## Bounded retention

Persistent Setup Event History остаётся bounded.

Если старые events уже удалены capacity policy, candidate history может не содержать `candidate_created`.

В таком случае:

`historyComplete = false`

Frontend показывает такую запись как partial retained history и не дорисовывает отсутствующие lifecycle facts.

## Persistence diagnostics

Runtime response включает безопасный subset статуса source:

- History state;
- events count;
- dropped events count;
- persistence state;
- persistence version;
- hydrated;
- writable;
- last persisted timestamp;
- safe last error code.

Raw filesystem errors, adapter paths и credentials наружу не выводятся.

## Frontend

Пользовательский маршрут Market History использует `MarketHistoryRuntimePage` и больше не читает fixture archive как штатный источник.

Страница показывает:

- реальные persisted candidate histories;
- result / direction / setup type / timeframe filters;
- current lifecycle stage;
- factual lifecycle result;
- level zone / touches;
- detected/current price;
- distance to level;
- episode / line identity;
- ordered lifecycle timeline;
- degraded persistence state.

Lifecycle SSE используется только как trigger для повторного чтения backend History; frontend не пересчитывает Setup lifecycle.

Переход в Workspace сохраняет `setupId`, `symbol` и `timeframe`.

Старый fixture `MarketHistoryPage` может временно оставаться в кодовой базе для isolated fixture/integrity coverage, но пользовательский route его больше не использует.

## Что намеренно отсутствует

Этот этап не вычисляет и не подделывает:

- `maxMovePct`;
- adverse move;
- time-to-target;
- PnL;
- success rate;
- profitability;
- historical candles around the outcome;
- historical aggTrade;
- historical order book;
- Replay frames.

## Safety boundaries

Этап не меняет:

- Observation `progress >= 0.50`;
- Approach threshold;
- realtime Confirmation rules;
- breakout / rejection / expiry rules;
- ranking;
- `lineId`;
- Level touch / pivot rules;
- candidate / episode identity;
- persistence retention policy.

Не создаются signals, orders, execution или Self-Learning.

Future candles не используются.

## Проверки

Обязательные проверки:

- backend projection unit tests;
- backend route filters / validation;
- buildApp API integration;
- existing persistent Setup Event History regression;
- frontend runtime parser / fetch tests;
- frontend route/UI source test;
- backend/frontend typecheck;
- backend/frontend production build;
- full relevant test suites;
- audit;
- `git diff --check`.

## Следующий отдельный этап

После merge и зелёного post-merge CI:

`NEXUS Real Setup Replay Foundation v0.1`

Outcome dataset / validation выполняется после Replay foundation.

Self-Learning остаётся заблокирован до History + Replay + достаточной реальной выборки и отдельного решения пользователя.
