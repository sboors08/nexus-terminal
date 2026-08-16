# NEXUS Unified Decision Setup Lifecycle Reachability Diagnostics v0.1

## Назначение

Этот versioned offline diagnostic локализует фактический cutoff Setup lifecycle внутри уже сохранённого Unified Decision Live Observation Dataset. Он не вызывает Binance, Level Lines, Setup runtime или Unified Decision повторно и не создаёт синтетические observations.

Диагностика отвечает на отдельные вопросы:

1. сколько уникальных Setup candidates действительно присутствует, а сколько snapshot occurrences являются повторным чтением тех же terminal/expired records;
2. был ли candidate впервые виден до `expiresAt` или recorder увидел только сохранённый terminal snapshot;
3. до какой стадии дошёл causal context Level Lines adapter;
4. совпадает ли causal stage с применённой stage Setup runtime;
5. где именно остановился путь до terminal breakout/rejection outcome.

## Вход

Поддерживаются два существующих source contract:

- `unified-decision-live-observation-dataset-v0.1`;
- persistence snapshot `nexus.unified-decision.live-observations` version `1`.

Файл выбирается в порядке:

1. `UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_PATH`;
2. `UNIFIED_DECISION_REACHABILITY_PATH`;
3. `UNIFIED_DECISION_LIVE_OBSERVATION_PATH`;
4. `backend/data/unified-decision-live-observations-v1.json`.

Опциональные границы:

- `UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_START_SEQUENCE`;
- `UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_END_SEQUENCE`;
- `UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_MIN_OBSERVATIONS`.

## Измеряемый путь

Report строит последовательность:

1. Setup source available;
2. candidate snapshot captured;
3. candidate впервые виден до `expiresAt`;
4. causal `OBSERVATION` captured;
5. causal `APPROACH` captured;
6. Setup runtime показал `APPROACHING_THIRD_TOUCH` или более позднюю stage;
7. causal `CONFIRMATION` captured;
8. Setup runtime показал `THIRD_TOUCH_CONFIRMED` или более позднюю stage;
9. captured terminal breakout/rejection outcome.

Для каждого `candidateId` отдельно восстанавливаются:

- первая видимость и currentness;
- неизменяемые identity/lifetime поля;
- Setup stage history;
- causal stage history;
- фактические переходы между соседними snapshots;
- длительность retention после `expiresAt`.

`candidateOccurrenceCount` нельзя интерпретировать как количество созданных setups. Один сохранённый `SETUP_EXPIRED` candidate может присутствовать во множестве последующих Unified Decision observations. Для reachability первичен `uniqueCandidateCount` и история каждого `candidateId`.

## Диагностические cutoff

- `setup_source_not_available` — read source не был доступен;
- `setup_candidate_not_captured` — source доступен, но candidate snapshots отсутствуют;
- `candidate_first_seen_after_expiry` — recorder впервые увидел все candidates уже истёкшими;
- `causal_observation_not_captured` — current candidates не содержат causal observation context;
- `causal_approach_not_observed` — production Approach boundary не встретилась;
- `runtime_approach_stage_not_captured` — causal Approach есть, но retained snapshots не показывают соответствующую live runtime stage; без targeted capture это ещё не считается wiring defect;
- `causal_confirmation_not_observed` — Approach достигнут, realtime Confirmation отсутствует;
- `runtime_third_touch_stage_not_captured` — causal Confirmation есть, но retained snapshots не показывают third-touch-or-later runtime stage; требуется короткий targeted capture;
- `terminal_outcome_not_observed` — third touch достигнут, breakout/rejection outcome не встретился;
- `contract_violation` — нарушены timestamp, identity, monotonicity, causal/runtime или safety invariants.

## Фактический результат 2026-08-16

Diagnostic выполнен на текущем bounded persistence store без повторного вызова production readers:

- `5 000` observations, sequence `993–5992`;
- период `2026-08-14T00:38:23.613Z` — `2026-08-15T15:45:42.879Z`;
- Setup source был `available` во всех `5 000` observations;
- candidate snapshots присутствовали в `1 059` observations: `12 708` occurrences, но только `36` unique candidates;
- все `36` candidates были созданы до начала выбранного bounded window и впервые видны в нём уже после `expiresAt`;
- все `12 708` occurrences — retained `SETUP_EXPIRED` snapshots; максимальная retention после expiry составила `39 739` секунд;
- causal `OBSERVATION` сохранён у всех `36` candidates, causal `APPROACH` — у `28`, causal `CONFIRMATION` — у `0`;
- видимые runtime stages внутри выбранного window: только `SETUP_EXPIRED`; runtime transitions внутри window отсутствуют;
- terminal breakout/rejection outcomes — `0`;
- contract/safety violations — `0`.

Report status: `diagnosed_with_unreached_stages`. Фактический cutoff: `candidate_first_seen_after_expiry`, diagnosis: `retention_currentness_mismatch`. Это уточняет предыдущий aggregate report: production causal Approach не отсутствовал — он был достигнут у `28/36` candidates, но соответствующая активная runtime history была вытеснена из bounded dataset до sequence `993`.

Короткая targeted live-проверка не требуется (`targetedLiveCheckRecommended: false`): текущий dataset уже локализовал retention cutoff, а повторное слепое окно не восстановит вытесненную историю.

## Дополнительная проверка production path

Проверка существующего кода и regression tests выявила отдельное подтверждённое ограничение episode reachability:

1. causal adapter строит candidate ID как `setup-${line.id}-${setupType}`;
2. `SetupDetectionPipeline` хранит process-lifetime `emittedCandidateIds` и на повторном scan не эмитит тот же ID;
3. runtime сохраняет `SETUP_EXPIRED` candidate как terminal record;
4. последующие causal updates для terminal candidate игнорируются.

Следовательно, пока сохраняется тот же `line.id`, после первого expiry новый Setup episode того же `setupType` не может быть создан или rearm-нут. Существующие regression tests подтверждают отдельно duplicate suppression и terminal expiry; совместная проверка production/diagnostic path прошла `29/29`.

Это не основание менять threshold или автоматически переиспользовать старый candidate: безопасное исправление требует отдельного episode-aware identity/rearm contract, который одновременно разрешает новый causal episode и не возвращает duplicate emission на каждом scan.

## Запуск

Из `backend`:

```powershell
npm.cmd run diagnose:unified-decision-setup-lifecycle-reachability
```

Report сохраняется в:

```text
backend/.tmp/unified-decision-setup-lifecycle-reachability-diagnostics/
```

Создаются timestamped report и `latest.json`.

## Safety boundary

Диагностика:

- `diagnosticOnly: true`;
- не создаёт trade order, setup, signal или score;
- не меняет `progress >= 0.50`;
- не меняет Approach threshold;
- не меняет Setup lifecycle;
- не меняет Unified Decision, ranking или production behavior;
- не использует future data;
- не рекомендует изменение decision rules только по отсутствию редкой stage.

Сначала должен быть выполнен offline report на текущем bounded store. Короткая targeted live-проверка допустима только после локализации cutoff; ещё одно blind 24-часовое окно не требуется.

По фактическому report короткая targeted live-проверка не назначена. Следующая отдельная задача — `NEXUS Setup Candidate Episode Rearm Contract v0.1`; production fix не входит в эту diagnostic ветку.
