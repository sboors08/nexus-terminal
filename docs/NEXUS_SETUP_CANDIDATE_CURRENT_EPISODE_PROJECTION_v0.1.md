# NEXUS Setup Candidate Current-Episode Projection v0.1

**Статус:** live verified with upstream exact-price line collisions observed
**Дата:** 2026-08-21
**Ветка:** `backend-setup-candidate-current-episode-projection-v0-1`
**База:** `f269890a927ea953b3de63ab788e6b338325c05d`
**Контракт:** `setup-candidate-current-episode-projection-v0.1`

## 1. Для чего сделан этап

Episode Rearm Contract правильно сохраняет несколько причинных episodes одной и той же пары Level Line + Setup Type. Это необходимо для History и последующего анализа, но текущий Scanner раньше выводил все сохранённые episodes как одновременно актуальные карточки.

В результате трейдер видел несколько визуально одинаковых строк одной монеты, уровня и типа сетапа. Эти строки не были same-episode duplicates: у них были разные `episodeId`. Ошибка находилась в read projection, а не в создании candidates.

Current-Episode Projection разделяет два представления:

- **Scanner/read list** — только последний episode каждой точной пары;
- **History/detail** — все сохранённые episodes, включая предыдущие terminal records.

## 2. Ключ проекции

Текущий episode выбирается по ключу:

```text
symbol + lineId + setupType
```

Для каждой такой пары выбирается candidate с максимальным `episode.startedAt`. При равной границе используются детерминированные tie-breakers: `updatedAt`, затем `candidate.id`.

Ключ намеренно не использует округлённую цену, `centerPrice` или визуальную zone. Поэтому две независимые Level Lines остаются двумя карточками, даже когда на экране их цена выглядит одинаково.

Legacy candidates без episode identity не объединяются и продолжают отображаться как раньше.

## 3. Порядок обработки запроса

Публичный `GET /api/v1/setups/candidates` выполняет операции в следующем порядке:

1. читает полный runtime snapshot;
2. строит current-episode projection;
3. применяет `setupType`, `direction`, `levelKind` и volume filters;
4. применяет `limit`.

Projection выполняется до пользовательских фильтров. Поэтому superseded episode не может снова появиться только потому, что текущий episode не подходит под выбранный фильтр.

`GET /api/v1/setups/candidates/:candidateId` не использует проекцию. Старый `candidateId` остаётся доступным для detail/History.

## 4. Что изменится для пользователя

- Scanner перестанет показывать прошлые episodes одной и той же пары как несколько текущих карточек;
- выбор карточки и переход в Workspace продолжат использовать настоящий candidate ID;
- разные реальные уровни не будут ошибочно склеены;
- исторические episodes не удаляются.

## 5. Что не изменено

Этап не меняет:

- episode boundary `observation_threshold_reentry`;
- Observation threshold `progress >= 0.50`;
- Approach и Realtime Confirmation thresholds;
- breakout/bounce classification;
- LONG/SHORT direction;
- ranking, Unified Decision или market-context rules;
- lifecycle persistence и terminal History;
- создание сигналов или торговых приказов.

## 6. Проверяемые инварианты

- один текущий candidate на `symbol + lineId + setupType`;
- последний episode выбирается независимо от входного порядка;
- разные `lineId` сохраняются даже при одинаковой отображаемой цене;
- breakout и bounce одной линии не объединяются;
- разные symbols не объединяются;
- legacy candidates сохраняются;
- detail superseded candidate остаётся доступным;
- filters применяются после projection;
- входной runtime snapshot не мутируется;
- контракт не создаёт trade orders и не меняет decision rules.

## 7. Фактическая live-проверка

Локальная проверка реализации:

- focused projection/API tests: `22/22` passed;
- полный backend: `607/607` passed;
- backend typecheck: passed;
- backend production build: passed;
- projection/detail/history regression violations: `0`.

После Docker rebuild production read path был проверен через backend и frontend proxy:

- backend candidates: `352`;
- frontend proxy candidates: `352`;
- episode-aware candidates: `352`;
- legacy candidates: `0`;
- duplicate current pairs по `symbol + lineId + setupType`: `0`.

Current-Episode Projection подтверждена: один и тот же `lineId + setupType` не появляется в Scanner несколько раз.

Live-проверка также обнаружила отдельную upstream-границу. У `ARKMUSDT` одновременно присутствовали пять разных support `lineId` с одной точной zone `0.106–0.106` и одной границей текущего episode `2026-08-21T15:54:59.999Z`. Каждая линия сформировала две отдельные гипотезы — bounce LONG и breakout SHORT — поэтому Scanner показал десять визуально одинаковых карточек при нулевых current-episode duplicates.

Projection намеренно не объединяет такие `lineId`: она не может безопасно решить, являются они независимыми структурами или collision повторных exact-price origins. Скрытие по округлённой цене замаскировало бы возможный дефект Level Lines и могло бы удалить реальный отдельный уровень.

## 8. Следующий шаг

После commit/PR/CI/merge требуется отдельная **NEXUS Level Lines Exact-Price Origin Collision Diagnostics v0.1**. Диагностика должна определить, разделяют ли одновременные active `lineId` одной точной цены одинаковые touch episodes, departure/observation evidence и lifecycle, прежде чем менять production identity или active-level projection.
