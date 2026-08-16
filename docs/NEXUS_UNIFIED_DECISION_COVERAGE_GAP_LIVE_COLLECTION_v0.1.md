# NEXUS Unified Decision Coverage-Gap Live Collection v0.1

**Статус:** завершённый фактический сбор с незакрытыми coverage gaps

**Ветка:** `backend-unified-decision-coverage-gap-live-collection-v0-1`

**Базовый merge-коммит:** `e40cb22cb511732c600aae9e1a66b1682c4c0525`

**Production decision rules changed:** `false`

## Цель

Проверить на новых реальных Unified Decision observations три редкие ветви, которые не встретились в первой 12-часовой live cohort:

- `market_context_single_conflict`;
- `market_context_double_conflict`;
- `terminal_setup_outcome`.

Сбор использовал уже объединённый persistent Coverage-Gap Observer v0.1. Он не открывал дополнительные Binance connections, не пересчитывал source metrics и не создавал synthetic observations.

## Окно сбора

| Параметр | Фактическое значение |
| --- | --- |
| Начало | `2026-08-14 18:45:41` local time |
| Завершение | `2026-08-15 18:46:37` local time |
| Причина завершения | `duration_elapsed` |
| Длительность | 24 часа wall-clock |
| Символы | `BTCUSDT`, `ETHUSDT`, `SOLUSDT` |
| Timeframe | `1m` |
| Интервал | 60 секунд |
| Раунды | `1 430` |
| Успешные запросы collector | `3 940` |
| Неуспешные запросы | `350` |
| Стартовый live store | `2 051` observations |
| Финальный live store | `5 000` observations, достигнут configured capacity |

Пользователь подтвердил, что неуспешные запросы пришлись на отключения интернета. Collector пережил разрывы, продолжил сбор после восстановления соединения и завершился с `Recorder=ready`, `Observer=ready`, без persistence error. Поэтому `350` failed requests фиксируются как transport gaps внутри wall-clock окна, а не как дефект Coverage-Gap Observer. Неуспешные запросы не создавали observations.

`FinalObservations=5000` означает достижение bounded capacity, а не потерю persistence. Из разницы между начальным и финальным размером нельзя вычислять количество новых observations после заполнения кольцевого хранилища; источником точного controlled-request count остаётся `SuccessfulRequests=3940`.

## Результат coverage

| Coverage gap | State | Cases |
| --- | --- | ---: |
| `market_context_single_conflict` | `not_observed` | 0 |
| `market_context_double_conflict` | `not_observed` | 0 |
| `terminal_setup_outcome` | `not_observed` | 0 |

Дополнительные показатели:

- captured case transitions: `0`;
- captured case contract violations: `0`;
- persistence error: отсутствует;
- итоговый versioned report: `nexus-unified-decision-coverage-gaps-2026-08-15-184637.report.json`.

`Violations=0` не считается успешной проверкой редких контрактов: cases не появились, поэтому validator не получил фактического входа для этих ветвей. Корректный итоговый статус — `collected_with_unobserved_gaps`, а не `validated`.

## Совместная интерпретация двух live-окон

Первая 12-часовая cohort содержала `2 042` observations и также не содержала market-context conflict или terminal Setup outcome. Новый controlled collector добавил ещё `3 940` успешных запросов. Таким образом, как минимум `5 982` контролируемых real observations в двух последовательных окнах не дали ни одного фактического coverage-gap case.

Это не доказывает невозможность ветвей и не разрешает удалять соответствующие safety rules. Но простое повторение такого же blind collection больше не является лучшим следующим шагом: сначала нужна проверка достижимости предусловий в текущем production pipeline.

## Зафиксированное решение

- не менять thresholds, ranking, lifecycle или Unified Decision rules;
- не создавать trade order, signal, score, learning или profitability estimate;
- не считать отсутствие case подтверждением корректности ветви;
- не повторять идентичный сбор только из-за transport failures, так как их причиной было подтверждённое отключение интернета, а collector восстановился;
- следующей отдельной задачей выполнить `NEXUS Unified Decision Coverage-Gap Reachability Diagnostics v0.1`;
- diagnostics должны определить, какие реальные предусловия доходят до production Unified Decision, где именно обрывается causal path и является ли каждая редкая ветвь достижимой при текущих contracts.

## Safety

Сбор и этот отчёт являются diagnostic-only:

- `createsTradeOrder: false`;
- `createsSignal: false`;
- `changesDecisionRules: false`;
- future data не используется;
- production behavior не изменён.
