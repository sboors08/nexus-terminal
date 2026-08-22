# NEXUS Level Lines Exact-Price Origin Resolution Contract v0.1

## Для чего нужен этап

Scanner мог показывать несколько визуально одинаковых карточек, когда разные структурные origin-свечи создавали отдельные `lineId` на одной и той же точной цене.

Предыдущая real-data классификация доказала, что один общий merge по цене был бы неправильным:

- `32` пары являются повторным подтверждением ещё активной identity;
- `10` пар возникают после того, как прежняя identity уже отработала;
- независимых exact-price origin-пар в исследованной когорте не обнаружено.

Resolution Contract применяет две разные causal lifecycle-ветви и не использует округление UI.

## Production contract

Version:

`level-lines-exact-price-origin-resolution-v0.1`

Resolution выполняется после построения полного реестра `lines`, но до Departure, Observation, Approach и Setup Candidate pipeline.

Группа определяется только точным совпадением:

`symbol + timeframe + kind + exact price`

Близкие, но не равные цены и разные `support/resistance` остаются независимыми.

### 1. Active identity reuse

Если прежняя exact-price identity ещё не достигла `worked` к моменту активации нового origin:

- прежний `lineId` остаётся единственной current identity;
- новый origin сохраняется в полном историческом `lines`;
- новый origin не попадает второй строкой в `activeLevels`;
- downstream-трекеры и Setup Engine получают только текущую identity.

Action:

`reuse_active_exact_price_identity`

### 2. Worked identity rearm

Если прежняя identity достигла `worked` до активации нового origin:

- прежняя запись сохраняется в полном `lines` как History evidence;
- прежняя identity удаляется только из current projection;
- новый origin становится current identity нового episode;
- старые данные не удаляются и `lineId` не переписывается.

Action:

`retire_worked_identity_before_rearm`

## Порядок обработки цепочки

Для нескольких exact-price origins решения применяются последовательно по causal времени origin:

1. пока текущая identity не отработала, новые origins подтверждают её;
2. первый origin после `workedAt` начинает новый current episode;
3. последующие origins снова сравниваются уже с новой current identity.

Это позволяет оставить одну current line даже при трёх одновременно найденных origins.

## Сохранность данных

Contract не удаляет элементы из `LevelLinesDetectionResult.lines`.

Он изменяет только current projection `activeLevels`, которая используется:

- Departure Extremum Tracker;
- Observation Tracker;
- Approach Engine;
- causal Setup adapter;
- Scanner и Workspace runtime snapshots.

Поэтому визуальные и Setup-дубли подавляются до downstream-расчётов, а история origin-линий остаётся доступной для будущих History/Replay и самообучения.

## Неизменённые правила

- pivot detection;
- touch/departure rules;
- формула стабильного `lineId`;
- Observation threshold;
- Approach и Realtime Confirmation;
- bounce/breakout mapping;
- Unified Decision;
- сигналы, алерты и торговые заявки.

## Safety boundary

- `preservesFullHistory = true`;
- `usesExactPriceOnly = true`;
- `mergesNearbyPrices = false`;
- `changesTradingRules = false`;
- `createsSetup = false`;
- `createsSignal = false`;
- `createsTradeOrder = false`;
- `usesFutureCandles = false`.

## Проверки контракта

Тесты обязаны подтверждать:

- reuse активной identity;
- retirement/rearm после `worked`;
- causal обработку цепочки из трёх origins;
- независимость близких цен и разных kinds;
- сохранение полного исторического реестра;
- отсутствие скрытой линии в downstream tracking;
- детерминированность и immutable output;
- отклонение дублированных или отсутствующих history identities.

## Следующий этап

`NEXUS Level Lines Exact-Price Origin Resolution Real-Data Validation v0.1`

Он должен повторить сохранённые `4 995` реальных свечей через новый production path и доказать:

- отсутствие coactive exact-price current collisions;
- сохранность всех исторических origin records;
- детерминированность после restart/replay;
- отсутствие побочных изменений для близких независимых уровней;
- отсутствие contract violations.
