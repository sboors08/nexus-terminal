# NEXUS Unified Decision Coverage-Gap Reachability Diagnostics v0.1

**Статус:** диагностика завершена, три редкие ветви заблокированы upstream

**Ветка:** `backend-unified-decision-coverage-gap-reachability-diagnostics-v0-1`

**Базовый merge-коммит:** `a99071340ca50f383aa652981878c06d49b88d5a`

**Production decision rules changed:** `false`

## Цель

Объяснить, почему после первой 12-часовой cohort и дополнительного 24-часового collection ни разу не появились:

- `market_context_single_conflict`;
- `market_context_double_conflict`;
- `terminal_setup_outcome`.

Диагностика читает уже сохранённый bounded live-observation dataset offline. Она не открывает Binance connections, не вызывает production readers/producers, не пересчитывает source metrics и не создаёт synthetic observations.

## Источник

| Параметр | Фактическое значение |
| --- | --- |
| Dataset | `unified-decision-live-observation-dataset-v0.1` |
| Persistence schema | `nexus.unified-decision.live-observations` v1 |
| Observations | `5 000` |
| Sequence | `993–5992` |
| Период | `2026-08-14T00:38:23.613Z` — `2026-08-15T15:45:42.879Z` |
| BTCUSDT | `1 663` |
| ETHUSDT | `1 667` |
| SOLUSDT | `1 670` |
| Report status | `diagnosed_with_unreached_gaps` |
| Contract/safety violations | `0` |

Подтверждённые пользователем отключения интернета не объясняют результат diagnostics. Неуспешные collector requests не создавали observations, а все `5 000` проанализированных записей имеют доступные Setup и market-context snapshots. Диагностика анализирует только успешно сохранённые causal observations.

## Market-context reachability

| Узел | Observations |
| --- | ---: |
| Directional realtime precursor | `243` |
| Market-context read available | `243` |
| BTC context computable | `241` |
| Impulse context computable | `160` |
| Оба context computable | `160` |
| BTC opposed | `0` |
| Impulse opposed | `0` |
| Single-conflict condition | `0` |
| Double-conflict condition | `0` |
| Alignment mismatches | `0` |

Production pipeline действительно сформировал `146 possible_long` и `97 possible_short`. Контексты не пропали полностью: BTC был вычислим для `241` directional observations, impulse — для `160`, оба одновременно — для `160`. Фактический cutoff находится позже availability и computability: ни один вычислимый BTC/impulse context не принял значение `opposed` относительно directional precursor.

Состав исходных состояний объясняет отсутствие конфликтов:

- BTC mode: `neutral=4 991`, `risk_on=6`, `risk_off=3`;
- symbol impulse direction: `none=5 000`;
- derived BTC alignment на directional path: `neutral=241`, `opposed=0`;
- derived impulse alignment на directional path: `neutral=160`, `opposed=0`.

Поэтому обе market gaps имеют `blocked_upstream` с cutoff `opposing_market_context_not_observed`. Это не contract violation и не основание ослаблять фильтры.

## Setup lifecycle reachability

| Узел | Фактическое значение |
| --- | ---: |
| Setup source available observations | `5 000` |
| Observations с candidate snapshots | `1 059` |
| Candidate occurrences | `12 708` |
| Unique candidates | `36` |
| `APPROACHING_THIRD_TOUCH` | `0` |
| `THIRD_TOUCH_CONFIRMED` | `0` |
| Terminal outcome captured | `0` |
| Current terminal outcome | `0` |
| `setup_confirmed` | `0` |

Все `12 708` candidate occurrences и все `36` уникальных candidates находились в `SETUP_EXPIRED`. Ни один сохранённый кандидат не был виден в `LEVEL_CONFIRMED` или `APPROACHING_THIRD_TOUCH`, поэтому terminal branch физически не могла дойти до breakout/rejection outcome и `setup_confirmed`.

`terminal_setup_outcome` имеет `blocked_upstream` с первым cutoff `setup_approach_not_observed`. Это более ранний и более приоритетный cutoff, чем отсутствие terminal outcome.

## Assessment

| Gap | Status | Первый cutoff | Cases |
| --- | --- | --- | ---: |
| `market_context_single_conflict` | `blocked_upstream` | `opposing_market_context_not_observed` | 0 |
| `market_context_double_conflict` | `blocked_upstream` | `opposing_market_context_not_observed` | 0 |
| `terminal_setup_outcome` | `blocked_upstream` | `setup_approach_not_observed` | 0 |

Итоговый `nextAction` отчёта: `inspect_setup_lifecycle_reachability`.

## Проверки

- focused Reachability/Coverage-Gap/Live Observation/Unified Decision regression: `40/40`;
- полный backend regression: `565/565`;
- frontend realtime tests: `272/272`;
- backend/frontend typecheck: успешно;
- backend/frontend production build: успешно;
- contract/safety violations в реальном dataset: `0`.

## Зафиксированное решение

- не повторять идентичный blind collection до проверки upstream reachability;
- не менять thresholds, ranking, Setup lifecycle или Unified Decision rules по отсутствующим cases;
- следующей отдельной задачей выполнить `NEXUS Unified Decision Setup Lifecycle Reachability Diagnostics v0.1`;
- проследить живой candidate от создания через causal Setup adapter/runtime/read snapshot до Unified Decision и определить, почему recorder видит только `SETUP_EXPIRED`;
- market-context variation исследовать отдельно после Setup lifecycle diagnostics: текущий dataset доказывает availability/computability, но не содержит ни одного opposed source state;
- не создавать trade order, signal, score, learning или profitability estimate.

## Safety

Диагностика и этот отчёт являются diagnostic-only:

- `diagnosticOnly: true`;
- `createsTradeOrder: false`;
- `createsSignal: false`;
- `createsScore: false`;
- `decisionRulesChangeRecommended: false`;
- `thresholdsChanged: false`;
- `rankingChanged: false`;
- `setupLifecycleChanged: false`;
- `usesFutureData: false`.
