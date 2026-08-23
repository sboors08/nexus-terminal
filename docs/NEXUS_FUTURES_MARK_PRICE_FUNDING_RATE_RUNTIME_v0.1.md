# NEXUS Futures Mark Price + Funding Rate Runtime Foundation v0.1

Дата: 2026-08-23

## 1. Статус

`IMPLEMENTED_AND_LOCALLY_VALIDATED`

На текущем этапе подтверждено локально:

- focused WebSocket tests: `9/9 PASSED`;
- backend typecheck: `PASSED`;
- полный backend check: `PASSED`;
- production backend build: `PASSED`;
- `git diff --check`: `PASSED`.

Commit, push, PR, merge и GitHub CI пока не считаются выполненными.

---

## 2. Цель

Добавить factual derivatives context Binance USDⓈ-M Futures в существующий NEXUS realtime market-data runtime:

- Mark Price;
- Index Price;
- Funding Rate;
- Next Funding Time.

Этот этап не создаёт торговый сигнал и не меняет Setup Engine.

---

## 3. Binance realtime source

Используется stream:

`<symbol>@markPrice@1s`

Из Binance event используются factual поля:

- `s` — symbol;
- `p` — Mark Price;
- `i` — Index Price;
- `r` — Funding Rate;
- `T` — Next Funding Time;
- `E` — exchange event timestamp.

Funding Rate не вычисляется NEXUS самостоятельно.

---

## 4. NEXUS realtime contract

Добавлен:

`RealtimeMarkPrice`

с полями:

- `symbol`;
- `price`;
- `indexPrice`;
- `fundingRatePct`;
- `nextFundingAt`;
- `updatedAt`.

Он включён в существующий:

`RealtimeSymbolSnapshot.markPrice`.

Production snapshot инициализируется значением `null`, пока factual Binance Mark Price event ещё не получен.

---

## 5. Funding Rate representation

Binance `r` приходит как decimal fraction.

Пример:

`0.00012345`

NEXUS сохраняет:

`fundingRatePct = 0.012345`

по формуле:

`fundingRatePct = r × 100`.

Это только преобразование единицы измерения в проценты.

Никакая bullish/bearish или LONG/SHORT интерпретация здесь не выполняется.

---

## 6. Existing API reused

Новый endpoint не создаётся.

Mark Price/Funding Rate передаются через существующий `RealtimeSymbolSnapshot`, поэтому становятся частью уже существующих contracts:

- `GET /api/v1/market/realtime/snapshot`;
- `GET /api/v1/market/realtime/stream`.

Таким образом сохраняется один realtime source of truth.

---

## 7. WebSocket topology

До v0.1 generic realtime service использовал 2 streams на symbol:

1. `@aggTrade`;
2. `@bookTicker`.

После v0.1 используется 3 streams:

1. `@aggTrade`;
2. `@bookTicker`;
3. `@markPrice@1s`.

Следовательно:

`streamCount = activeSymbols × 3`.

Проверенные случаи:

- 1 symbol → 3 streams;
- 2 symbols → 6 streams;
- 3 symbols → 9 streams.

Dynamic subscription reference counting сохраняется.

---

## 8. Data validation

Mark Price event игнорируется при отсутствии или невалидности обязательных factual данных:

- symbol;
- positive Mark Price;
- positive Index Price;
- Funding Rate;
- valid Next Funding Time.

Для event timestamp применяется существующая stale-event защита realtime service.

Невалидный event не должен заменять последний корректный snapshot.

---

## 9. Setup Engine boundary

В рамках v0.1 не изменены:

- Level Lines;
- Observation;
- Approach;
- Realtime Confirmation;
- Setup Detection Pipeline;
- Setup lifecycle;
- Unified Decision rules.

Mark Price и Funding Rate пока являются только factual market context.

---

## 10. Что НЕ входит в v0.1

Не добавляются:

- Open Interest;
- Open Interest history;
- liquidation stream;
- `forceOrder`;
- liquidation map;
- funding-based Setup filter;
- funding-based score;
- funding-based ranking;
- profitability labels;
- PnL;
- trade execution;
- training;
- Self-Learning.

---

## 11. Validation evidence

Focused tests:

- `binance-websocket.test.ts`;
- `dynamic-subscriptions.test.ts`.

Результат:

- tests: `9`;
- pass: `9`;
- fail: `0`.

Также подтверждены:

- backend typecheck;
- полный backend regression;
- production build;
- `git diff --check`.

---

## 12. Collector isolation

Feature разрабатывается в отдельном worktree.

Работающий factual Setup Outcome collector:

- не перезапускался;
- исходный checkout не изменялся;
- остаётся на своём local `main`;
- продолжает factual collection.

Новая feature не используется collector до отдельного безопасного sync/restart этапа.

---

## 13. Следующие части Stage 3

После этого foundation Stage 3 остаётся частично завершённым.

Следующие отдельные derivatives metrics:

1. Open Interest;
2. ликвидации.

Их подключение само по себе также не должно автоматически менять trading rules.
