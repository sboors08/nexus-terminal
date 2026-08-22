# NEXUS Level Lines Exact-Price Origin Collision Classification v0.1

## Зачем нужен этот этап

Exact-Price Origin Collision Diagnostics v0.1 доказал, что несколько production Level Lines могут одновременно иметь одинаковые `symbol + timeframe + kind + price`. Простое объединение по цене опасно: новый origin может быть либо повторным подтверждением текущего уровня, либо новым episode после уже отработавшего уровня.

Classification v0.1 разделяет эти случаи до изменения production identity.

## Источник

Классификатор читает неизменённый versioned report:

`backend/.tmp/level-lines-exact-price-origin-collision-diagnostics/latest.json`

Проверенный пользовательский источник:

- generated at: `2026-08-21T17:19:42.136Z`;
- SHA256: `bc55be6fd9cdc65bbcb519efa71da4278bcaf90863a6b09b322a6265a8116f3e`;
- datasets: `5`;
- реальные закрытые свечи: `4 995`;
- exact-price groups: `37`;
- coactive origin pairs: `42`;
- source violations: `0`.

## Классы

### `active_origin_reconfirmation`

Новый origin появляется на точной цене уже существующей линии, наследует её prior exact-price confirmation, а старая линия в момент совместной активности ещё имеет статус `candidate` или `confirmed`.

Направление будущего resolution contract: сохранить текущую exact-price identity и применить новое структурное подтверждение к ней, не создавая вторую current identity.

### `worked_origin_retention_rearm`

Новый origin наследует prior exact-price confirmation, но прежняя линия уже имеет статус `worked` и всё ещё остаётся совместно активной.

Направление будущего resolution contract: сохранить отработавшую identity в History, вывести её из current projection и только затем разрешить новый episode/rearm.

### `post_work_independent_origin_candidate`

Старый уровень уже `worked`, а новый origin не наследует prior confirmation. Это только кандидат на независимую структуру; классификатор не подтверждает независимость автоматически.

### `unresolved_coactive_origin`

Старый уровень ещё текущий, но inherited evidence отсутствует. Доступных данных недостаточно для выбора reuse или independent identity.

## Фактический результат

| Symbol | Groups | Pairs | Active identity reuse | Worked retention rearm | Independent candidates | Unresolved |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| AVAXUSDT | 14 | 14 | 12 | 2 | 0 | 0 |
| BTCUSDT | 2 | 2 | 2 | 0 | 0 | 0 |
| DOGEUSDT | 9 | 11 | 4 | 7 | 0 | 0 |
| ETHUSDT | 2 | 2 | 2 | 0 | 0 | 0 |
| SOLUSDT | 10 | 13 | 12 | 1 | 0 | 0 |
| **Итого** | **37** | **42** | **32** | **10** | **0** | **0** |

Дополнительные измерения:

- все `42/42` пары наследовали prior exact-price evidence;
- origin gap: минимум `4`, медиана `18,5`, максимум `198` закрытых свечей;
- gap `1–9`: `13` пар;
- gap `10–29`: `12` пар;
- gap `30–59`: `7` пар;
- gap `60+`: `10` пар;
- coactivity `1` observation: `1` пара;
- coactivity `2–10`: `20` пар;
- coactivity `11–59`: `12` пар;
- coactivity `60+`: `9` пар;
- independent candidates: `0`;
- unresolved pairs: `0`;
- invariant violations: `0`;
- status: `classified_with_split_resolution`.

## Вывод

Одна глобальная операция «объединить линии по цене» отклонена. Данные требуют двух разных lifecycle-действий:

1. `32` active-origin reconfirmations должны переиспользовать существующую current identity.
2. `10` worked-origin retention rearms должны сначала удалить старую worked identity из current projection, сохранив её в History, и затем создать новый episode.

Расстояние между origins не используется как искусственный порог: обе причины встречаются в диапазоне от нескольких минут до нескольких часов.

## Граница безопасности

Classification v0.1:

- не меняет `lineId`;
- не объединяет линии;
- не удаляет History;
- не меняет pivot, touch, break, Observation, Approach или Setup thresholds;
- не создаёт setup, signal или trade order;
- не использует будущие свечи;
- не подтверждает независимый origin без отдельного evidence.

## Проверки

- focused detector/diagnostic/classification tests: `28/28`;
- полный backend: `615/615`;
- typecheck: passed;
- production build: passed;
- security audit: `0 vulnerabilities`;
- classification violations: `0`.

## Следующий этап

`NEXUS Level Lines Exact-Price Origin Resolution Contract v0.1` должен реализовать две классифицированные ветви отдельно и проверить их replay-equivalence до подключения в production runtime.
