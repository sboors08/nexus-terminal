# NEXUS Persistent Setup Event History Foundation v0.1

## Статус

Backend persistence foundation для production Setup lifecycle history.

Этап не подключает frontend Market History и не создаёт полный Replay.

## Причина

До этого этапа `SetupEventHistoryService` хранил lifecycle events только в bounded memory buffer. После restart backend история исчезала, а runtime lifecycle `eventId` снова начинался с `1`.

Это блокировало честную постоянную Setup History и дальнейшие отдельные этапы Market History Runtime Integration, Real Setup Replay и outcome dataset.

## Storage contract

Schema:

`nexus.setup-event-history`

Version:

`1`

Snapshot содержит:

- `savedAt`;
- `droppedEventsCount`;
- bounded ordered `events`;
- полную сохранённую копию `SetupLifecycleEvent`;
- candidate identity;
- episode identity при наличии;
- causal context при наличии;
- terminal `breakout` / `rejection` outcome.

Snapshot проходит строгую normalization до применения.

## Atomic JSON persistence

Production adapter:

`JsonFileSetupEventHistoryPersistence`

Default path:

`./data/setup-event-history-v1.json`

Запись выполняется через:

1. создание parent directory;
2. запись полного normalized snapshot во временный файл;
3. atomic rename temporary file в целевой path;
4. cleanup временного файла при ошибке.

## Restart-safe event identity

`SetupDetectionRuntimeService` runtime `eventId` является process-local и после restart снова начинается с `1`.

Поэтому постоянная History не использует incoming runtime `eventId` как restart identity.

`SetupEventHistoryService`:

- назначает собственный monotonic history `eventId`;
- после hydration продолжает с `last persisted eventId + 1`;
- строит semantic dedupe key из:
  - `candidateId`;
  - lifecycle `type`;
  - `occurredAt`;
  - `previousStage`;
  - `currentStage`;
  - `outcome`;
- не добавляет повторно тот же lifecycle fact после restart/replay.

Candidate/episode identity сохраняется без изменения.

## Hydration order

При включённой persistence:

1. storage загружается;
2. snapshot проверяется;
3. bounded history и dedupe state восстанавливаются;
4. только затем History подписывается на live Setup lifecycle events;
5. `buildApp` ожидает завершения History start до запуска Setup Detection Runtime.

Таким образом startup lifecycle events не могут обогнать hydration.

## Bounded retention

Default runtime capacity остаётся:

`50_000 events`

Если snapshot больше runtime capacity, сохраняются newest events в детерминированном порядке, а overflow увеличивает `droppedEventsCount`.

## Failure policy

Persistence failure не останавливает Setup runtime.

Corrupt, unsupported или unreadable storage:

- не применяется;
- не перезаписывается текущим процессом;
- History переходит в `degraded`;
- продолжает bounded in-memory collection;
- `writable = false`.

Write failure:

- lifecycle event остаётся в памяти;
- runtime продолжает работу;
- diagnostics содержат только safe error code.

Raw filesystem/error text наружу через History status не выводится.

## Diagnostics

При включённой persistence `SetupEventHistoryStatus` добавляет:

- adapter;
- state;
- version;
- hydrated;
- writable;
- load/save attempts;
- successful saves;
- persistence errors;
- hydrated events;
- duplicate lifecycle events;
- pending writes;
- last persisted timestamp;
- safe `lastErrorCode`.

## Environment

- `SETUP_EVENT_HISTORY_PERSISTENCE_ENABLED`
- `SETUP_EVENT_HISTORY_PERSISTENCE_PATH`

В test environment persistence по умолчанию отключена, если явно не передана через `buildApp` options.

## Проверки этапа

Focused suite должна покрывать:

- существующий in-memory History API;
- hydration before subscription;
- atomic JSON round-trip через production adapter;
- restart hydration;
- monotonic History event IDs после restart;
- semantic dedupe после replay/restart;
- сохранение episode identity;
- сохранение terminal outcome;
- bounded retention;
- corrupt storage degraded mode;
- unsupported storage degraded mode;
- отсутствие overwrite corrupt/unsupported storage;
- write failure degraded mode;
- отсутствие raw sensitive error text.

Перед commit дополнительно обязательны:

- `git diff --check`;
- focused tests;
- full backend tests;
- backend typecheck;
- backend production build;
- audit по затронутому package tree;
- проверка staged scope.

## Не входит в v0.1

Этот этап не:

- меняет production thresholds;
- меняет Observation `progress >= 0.50`;
- меняет Approach/Confirmation rules;
- меняет breakout/bounce/outcome rules;
- меняет ranking;
- меняет `lineId`;
- объединяет близкие уровни;
- удаляет history прошлых episodes;
- создаёт order execution;
- создаёт автоторговлю;
- применяет Self-Learning;
- синтезирует отсутствующие historical tape/order-book данные;
- использует future candles;
- подключает frontend Market History;
- строит полный Replay.

## Следующие отдельные этапы

После закрытия foundation:

1. `NEXUS Market History Runtime Integration v0.1`;
2. `NEXUS Real Setup Replay Foundation v0.1`;
3. outcome dataset/validation;
4. Self-Learning только после History + Replay и достаточной выборки.