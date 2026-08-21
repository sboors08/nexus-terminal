# NEXUS Level Lines Exact-Price Origin Collision Diagnostics v0.1

## Зачем нужен этот этап

Current-Episode Projection устранил повторение прошлых Setup episodes, но live-проверка Scanner показала другую границу: у `ARKMUSDT` одновременно существовали пять support `lineId` с одной точной ценой `0.106`. Каждый `lineId` создавал отдельные bounce и breakout hypotheses.

Этот этап не исправляет и не скрывает линии. Он должен доказательно определить, почему production Level Lines сохраняет несколько разных origins на одной точной цене и насколько часто это происходит на реальных свечах.

## Что считается collision

Collision фиксируется только когда в одном causal snapshot одновременно активны как минимум две линии с полностью одинаковыми:

- `symbol`;
- `timeframe`;
- `kind` (`support` или `resistance`);
- числовым `price` без округления.

Линии, которые только выглядят одинаково из-за форматирования цены в интерфейсе, в этот отчёт не включаются.

## Что измеряет диагностика

Для каждого exact-price group сохраняются:

- все distinct `lineId`;
- `originCandleIndex` и `originExtremumAt` каждой линии;
- `activeFrom`, `confirmedAt`, `workedAt`, status и touch count;
- последовательные collision episodes и изменения состава группы;
- максимальное число одновременно активных линий;
- каждая пара старого и нового origin, расстояние между ними в свечах и длительность совместной активности;
- признак того, что новая линия получила confirmation из предыдущего exact-price rejection;
- causal-инварианты line ID, origin price и отсутствие будущих данных.

## Источник данных

CLI повторно использует сохранённый отчёт:

`backend/.tmp/causal-setup-validation/latest.json`

Из него берутся реальные Binance `1m` свечи и production `LevelLinesDetectionOptions`. Каждый закрытый prefix повторно проходит через действующий `detectLevelLines`.

Запуск:

```powershell
Set-Location C:\scriner\nexus-terminal-git\backend
npm.cmd run diagnose:level-lines-exact-price-origin-collisions
```

Отчёт записывается в:

`backend/.tmp/level-lines-exact-price-origin-collision-diagnostics/latest.json`

## Граница безопасности

Диагностика:

- не объединяет линии;
- не меняет формулу `lineId`;
- не меняет pivot, departure, touch, break или supersession rules;
- не меняет Observation, Approach или Confirmation thresholds;
- не меняет Setup episode boundary или current-episode projection;
- не создаёт setup, signal или trade order;
- не использует будущие свечи;
- не утверждает, что линии независимы или являются дублями, пока нет результата real-data replay.

## Критерии завершения

- focused tests и полный backend проходят;
- отчёт детерминирован для одного source dataset и timestamp;
- exact-price groups измерены на сохранённых реальных datasets;
- invariant violations равны нулю;
- результат отдельно фиксирует распространённость и происхождение collision pairs;
- production identity не меняется в этой ветке;
- следующий шаг выбирается по результату, а не по визуальному сходству карточек Scanner.

## Текущий статус

Диагностика выполнена `2026-08-21T17:19:42.136Z` на пяти сохранённых реальных `1m` datasets:

| Symbol | Закрытые свечи | Collision observations | Groups | Episodes | Pairs | Colliding lines | Inherited evidence | Max concurrent |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| AVAXUSDT | 999 | 1 337 | 14 | 14 | 14 | 28 | 22 | 2 |
| BTCUSDT | 999 | 227 | 2 | 3 | 2 | 4 | 2 | 2 |
| DOGEUSDT | 999 | 617 | 9 | 10 | 11 | 19 | 15 | 3 |
| ETHUSDT | 999 | 129 | 2 | 3 | 2 | 4 | 2 | 2 |
| SOLUSDT | 999 | 402 | 10 | 12 | 13 | 22 | 17 | 3 |

Итог:

- воспроизведено `4 995` реальных закрытых свечей и `4 905` causal prefixes;
- exact-price collisions обнаружены во всех пяти datasets: `37` групп, `42` одновременно активные пары и `2 712` collision observations;
- в collision groups участвовали `77` distinct production lines;
- максимум одновременно существовали три линии с одним `symbol + timeframe + kind + price`;
- у `58` новых линий обнаружено inherited prior exact-origin evidence, то есть новая origin-линия получила подтверждающую историю уже существовавшего exact-price origin;
- invariant violations — `0`;
- статус — `diagnosed_with_collisions`;
- production identity, Setup mapping и decision rules не изменены;
- немедленное объединение по цене не рекомендовано: точное совпадение цены доказывает collision, но ещё не классифицирует каждый новый origin как независимую структуру или ошибочный повтор.

Следующий отдельный этап — `NEXUS Level Lines Exact-Price Origin Collision Classification v0.1`: классифицировать все `42` пары по origin gap, inherited evidence, touch history и совместной активности до проектирования resolution contract.
