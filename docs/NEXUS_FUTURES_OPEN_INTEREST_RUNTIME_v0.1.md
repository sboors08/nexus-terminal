# NEXUS Futures Open Interest Runtime Foundation v0.1

**Статус:** `IMPLEMENTED_AND_LOCALLY_VALIDATED`

**Раздел Master Plan:** Stage 3 — Futures Market Metrics.

## 1. Цель

Добавить factual current Open Interest Binance USDⓈ-M Futures в market-wide runtime NEXUS без изменения торговой логики.

Open Interest используется как дополнительный фактический derivatives context.

Этот этап не интерпретирует высокий или низкий OI как LONG/SHORT сигнал.

## 2. Источник данных

Текущий Open Interest загружается через официальный Binance USDⓈ-M Futures REST endpoint:

`GET /fapi/v1/openInterest?symbol=<SYMBOL>`

Используемые поля ответа:

- `symbol`;
- `openInterest`;
- `time`.

`openInterest` преобразуется в конечное числовое значение.

`time` преобразуется в ISO timestamp `updatedAt`.

## 3. Контракт NEXUS

Добавлен factual contract:

`RealtimeOpenInterest`

Поля:

- `symbol`;
- `openInterest`;
- `updatedAt`.

Current OI хранится отдельно для каждого symbol внутри существующего market-wide symbol state.

## 4. Market-wide integration

Open Interest реализован на `MarketWideRealtimeService` / `MarketWideOneMinuteMetricsStore`, а не внутри selected-symbol generic WebSocket runtime.

Причина:

- Scanner и Market используют market-wide symbol universe;
- `MarketWideRuntimeCoordinator` уже синхронизирует Binance Symbol Universe через `replaceSymbols()`;
- отдельный OI universe не создаётся;
- добавленные/удалённые Binance symbols автоматически учитываются следующим OI sweep.

Open Interest не создаёт новый WebSocket stream.

Существующий WebSocket `streamCount` не увеличивается из-за OI.

## 5. Scanner exposure

`MarketScannerMetrics` дополнен backward-compatible factual полями:

- `openInterest`;
- `openInterestUpdatedAt`.

До первого успешного OI observation значение отсутствует/null.

OI не участвует в `activityScore`, `liquidityScore`, setup score или trading decision.

## 6. Stale protection

Store принимает OI observation только для отслеживаемого symbol.

Observation с timestamp старше последнего сохранённого OI не заменяет более свежий factual state.

Некорректное отрицательное или non-finite значение отвергается.

Transient REST failure не должен стирать последний валидный OI.

## 7. Polling runtime

Используется отдельный `MarketWideOpenInterestPoller`.

Свойства v0.1:

- один market-wide sweep;
- bounded concurrency;
- overlapping sweeps запрещены;
- следующий sweep планируется только после завершения предыдущего;
- один symbol failure не прерывает остальные symbol requests;
- symbol universe читается заново для каждого sweep;
- lifecycle принадлежит `MarketWideRuntimeCoordinator`.

Production defaults:

- enabled: `true`;
- interval: `60_000 ms`;
- max concurrency: `4`;
- HTTP timeout: общий `BINANCE_REQUEST_TIMEOUT_MS`.

В `NODE_ENV=test` runtime по умолчанию выключен.

Config:

- `BINANCE_MARKET_WIDE_OPEN_INTEREST_ENABLED`;
- `BINANCE_MARKET_WIDE_OPEN_INTEREST_INTERVAL_MS`;
- `BINANCE_MARKET_WIDE_OPEN_INTEREST_MAX_CONCURRENCY`.

## 8. Lifecycle

Порядок startup:

1. Binance Symbol Universe стартует;
2. universe snapshot синхронизируется в Market Wide;
3. Market Wide realtime стартует;
4. Open Interest runtime стартует;
5. первый OI sweep использует уже синхронизированный symbol universe.

При shutdown OI runtime останавливается coordinator-ом.

При startup failure выполняется cleanup OI runtime.

## 9. Validation

До commit выполнены:

- focused Open Interest tests — `PASSED`;
- Market Wide Runtime Coordinator tests — `PASSED`;
- Market Wide regression — `PASSED`;
- backend typecheck — `PASSED`;
- полный backend check — `PASSED`;
- production backend build — `PASSED`;
- `npm audit --audit-level=high` — `PASSED`;
- real Binance OI smoke — `PASSED`;
- `git diff --check` — `PASSED`.

Real smoke использует только несколько контролируемых symbol requests и не запускает отдельный backend runtime.

## 10. Safety / scope boundaries

Open Interest v0.1 является factual data foundation.

Этот этап не:

- меняет Setup Engine;
- меняет Level Lines;
- меняет Observation / Approach / Confirmation thresholds;
- меняет Unified Decision;
- добавляет Setup score;
- меняет ranking;
- применяет success/failure labels;
- рассчитывает profitability;
- рассчитывает PnL;
- открывает сделки;
- запускает training;
- запускает Self-Learning.

## 11. Out of scope

Не входят в v0.1:

- historical Open Interest Statistics;
- OI delta / OI change analytics;
- OI-derived ranking;
- OI-derived trading rules;
- liquidation stream;
- liquidation analytics.

## 12. Collector isolation

Factual Setup Outcome collector работает независимо в исходном checkout.

Ради этой feature:

- collector не перезапускался;
- collecting `main` не обновлялся;
- collecting source не изменялся;
- разработка велась в отдельном worktree.

## 13. Следующий Stage 3 derivatives-metrics шаг

После закрытия Open Interest Runtime Foundation v0.1 отдельной задачей остаётся:

`Liquidations Runtime Foundation v0.1`

Commit, PR, merge и CI подтверждаются отдельно после их фактического выполнения.
