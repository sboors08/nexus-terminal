# NEXUS Futures Liquidations Runtime Foundation v0.1

**Статус:** `IMPLEMENTED_AND_LOCALLY_VALIDATED`

**Раздел Master Plan:** Stage 3 — Futures Market Metrics.

## 1. Цель

Добавить factual liquidation context Binance Futures в market-wide runtime NEXUS без изменения торговой логики.

Liquidations v0.1 является data foundation и не превращает liquidation order side в торговый сигнал.

## 2. Источник данных

Используется Binance Futures all-market liquidation stream:

`!forceOrder@arr`

Production transport:

`/market/stream`

Отдельный liquidation-only WebSocket не создаётся.

`!forceOrder@arr` разделяет первый активный market shard с `@kline_1m`.

## 3. Snapshot semantics

All-market liquidation stream является snapshot source.

Он не гарантирует полный tick-by-tick список всех liquidation trades.

NEXUS v0.1 не интерпретирует bounded history как полный liquidation tape.

Historical liquidation backfill отсутствует.

## 4. Фактически наблюдённая Binance wire schema

Во время real Binance smoke получен настоящий `!forceOrder@arr` event.

Фактическая форма:

- top-level keys: `e`, `E`, `o`;
- `ps` находился внутри `o`;
- `st` находился внутри `o`;
- фактический пример symbol: `ZROUSDT`;
- наблюдён `o.st = 1`.

Live форма:

- `o.ps`;
- `o.st`.

Parser также поддерживает documented fallback:

- top-level `ps`;
- top-level `st`.

Если metadata присутствует одновременно в обоих местах, значения обязаны совпадать.

Conflict отклоняется.

Symbol-name inference для UM / CM не используется.

## 5. USD-M / COIN-M boundary

`st = 1`:

- USDⓈ-M;
- событие может войти в NEXUS store только для tracked market-wide symbol.

`st = 2`:

- COIN-M;
- событие не входит в USDⓈ-M liquidation store.

## 6. NEXUS contract

Добавлен factual contract:

`RealtimeLiquidation`

Поля:

- `symbol`;
- `pairSymbol`;
- `side`;
- `orderType`;
- `timeInForce`;
- `originalQuantity`;
- `price`;
- `averagePrice`;
- `orderStatus`;
- `lastFilledQuantity`;
- `filledQuantity`;
- `tradeAt`;
- `updatedAt`.

`side` является factual order side.

BUY / SELL не переименовываются в LONG / SHORT liquidation signal.

## 7. Bounded store

Используется:

`MarketWideLiquidationStore`

Ограничения по умолчанию:

- per-symbol history: `100`;
- market-wide recent history: `1000`.

Store:

- принимает только tracked symbols;
- ограничивает память;
- защищает latest state от stale observations;
- удаляет историю symbol после удаления symbol из universe;
- возвращает defensive copies.

Permanent persistence отсутствует.

После restart in-memory liquidation history начинается заново.

## 8. Market-wide integration

`!forceOrder@arr` подключён к существующему market-wide realtime service.

Для liquidation stream резервируется один slot первого market shard.

Это сохраняет `maxStreamsPerSocket`.

Отдельный liquidation-only shard не создаётся, потому что liquidation stream может законно долго молчать.

Совместный shard с `@kline_1m` позволяет существующему watchdog контролировать transport health без ложных reconnect из-за отсутствия ликвидаций.

`!bookTicker` остаётся на отдельном `/public/stream`.

## 9. Stale protection

Transport event проверяется по Binance event time `E`.

Слишком старый event отбрасывается.

Store дополнительно не позволяет более старому liquidation observation заменить более свежий latest state.

Malformed payload не стирает предыдущую валидную историю.

## 10. Read-only HTTP API

Endpoint:

`GET /api/v1/market/realtime/market-wide/liquidations`

Query parameters:

- `symbol` — optional;
- `limit` — optional integer от `1` до `1000`.

Default limit:

`100`.

Ошибки:

- invalid symbol → `400 invalid_symbol`;
- invalid limit → `400 invalid_liquidation_limit`;
- symbol вне current market-wide universe → `404 market_wide_symbol_not_found`.

## 11. Real Binance validation

Фактически подтверждено:

- socket opened: `true`;
- BTCUSDT kline observed: `true`;
- forceOrder observed: `true`;
- USD-M liquidations parsed: `2`;
- COIN-M ignored в этом observation window: `0`;
- nested `o.ps/o.st` observed: `true`;
- top-level `ps/st` observed в этом smoke: `false`.

Таким образом реальный production transport и фактическая nested wire schema подтверждены.

## 12. Local validation

До commit уже подтверждены:

- Liquidation parser/store tests — `PASSED`;
- Market Wide WebSocket regression — `PASSED`;
- Market Wide route tests — `PASSED`;
- WebSocket → Store → HTTP integration — `PASSED`;
- backend typecheck — `PASSED`;
- real Binance smoke — `PASSED`;
- `git diff --check` — `PASSED`.

Полный backend check выполняется перед commit.

## 13. Safety / scope boundaries

Liquidations v0.1 не:

- меняет Level Lines;
- меняет Setup Engine;
- меняет causal stage thresholds;
- меняет Unified Decision;
- добавляет liquidation-derived Setup Score;
- меняет ranking;
- добавляет profitability labels;
- рассчитывает PnL;
- задаёт entry / stop / target;
- задаёт position sizing;
- открывает сделки;
- запускает training;
- запускает Self-Learning.

## 14. Out of scope

Не входят:

- historical liquidation backfill;
- permanent liquidation persistence;
- liquidation aggregation windows;
- liquidation imbalance;
- liquidation intensity;
- liquidation clusters;
- liquidation-derived ranking;
- liquidation-derived trading rules;
- frontend rendering.

## 15. Collector isolation

Разработка выполнялась в отдельном worktree.

Factual Setup Outcome collector:

- не перезапускался;
- не переключал branch;
- collecting `main` не обновлялся;
- collecting source не изменялся.

## 16. Следующий шаг

После commit / PR / merge Liquidations:

`Futures Metrics Terminal Exposure v0.1`

Следующая задача должна вывести factual Mark Price / Funding Rate / Open Interest / Liquidations в пользовательский терминал без изменения trading rules, Setup Score или Self-Learning.

Commit, PR, merge и CI должны подтверждаться отдельно после их фактического выполнения.