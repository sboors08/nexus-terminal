# NEXUS Master Plan v1

**Статус:** основной источник правды по продукту и разработке
**Репозиторий:** `sboors08/nexus-terminal`
**Дата фиксации:** 2026-08-23
**Язык работы:** русский
**Базовое состояние:** `main` / `origin/main` на merge-коммите `d4aa844895aeadc95c975a053b0a82930186d34f`, PR #184
**Текущая ориентировочная готовность:** числовой процент не подтверждён; фактический статус 13 этапов зафиксирован в разделах 25–26

---

## 1. Правила документа

1. Все новые задачи сверяются с этим планом.
2. Последнее явное решение пользователя важнее более старого пункта.
3. Обязательны `NEXUS Frontend Addendum v1` и `NEXUS Data Contract v1`.
4. Новые идеи фиксируются, но не прерывают текущую задачу без необходимости.
5. В работе одновременно одна техническая задача.
6. Выполненной считается только задача, подтверждённая кодом, тестами и фактическим результатом.
7. После каждого этапа обновляются статус, зависимости и следующий шаг.
8. Вложенные технические задачи не создают новый глобальный Roadmap и не меняют порядок официальных 13 этапов.
9. Автоматические тесты подтверждают реализацию правил, но не прибыльность торговой логики.
10. Числовая готовность проекта публикуется только после отдельного пересчёта по критериям этапов.

---

## 2. Видение продукта

NEXUS — веб-терминал для криптовалютных скальперов и интрадей-трейдеров.

Основная ценность:

- находить активные монеты и рыночные аномалии;
- определять формирующиеся сетапы;
- показывать их развитие по стадиям;
- объединять график, объём, сделки, стакан и ликвидность;
- учитывать рыночный режим BTC;
- сохранять историю и Replay;
- оценивать фактический результат;
- постепенно улучшать рейтинг сетапов и фильтров.

Ориентир первой версии — около **1000 пользователей**.

Первый практический запуск — закрытая beta на **5–10 трейдеров** после готовности ключевых Setup, Alerts и data-flow этапов.

Основная платформа v1.0 — веб-приложение. Desktop-версия рассматривается после стабилизации веб-версии.

---

## 3. Навигация

Основное меню:

1. Dashboard
2. Charts
3. Scanner
4. Watchlist
5. Alerts
6. Market
7. History
8. Settings

Постоянную нижнюю панель не делать.

Отдельную пользовательскую вкладку `Levels` не создавать. Уровни являются частью анализа внутри `Market`, `Scanner` и `Workspace`, а не самостоятельным пользовательским разделом. Диагностический маршрут `/app/level-preview` остаётся внутренним инструментом проверки Level Engine и не включается в основное меню.

Отдельные зоны:

- `/:locale/*` — публичная часть;
- `/app/*` — закрытый терминал;
- `/admin` — защищённая админ-панель.

---

## 4. Маршруты, i18n и SEO

### Публичная часть

- отдельный `PublicLayout`;
- лендинг;
- возможности;
- тарифы;
- документация;
- блог;
- SSR/SSG-готовность;
- индексируемый контент;
- локализованные мета-теги;
- `hreflang`;
- sitemap;
- корректный `robots.txt`.

### Закрытая часть

- отдельный `AppLayout`;
- авторизация;
- `noindex`;
- исключение терминала из поисковой выдачи.

### Языки

На старте:

- русский;
- английский;
- китайский.

Архитектура должна позволять добавлять другие языки:

- отдельные словари;
- параметр локали в маршруте;
- `htmlLang`;
- LTR/RTL;
- локализованные мета-теги;
- автоматические `hreflang` и sitemap для активных локалей.

---

## 5. Design System v1

- тёмная тема;
- зелёный LONG;
- красный SHORT;
- отдельные цвета стадий;
- Inter;
- сетка 8 px;
- единые карточки, таблицы и фильтры;
- состояния загрузки, ошибки и пустого результата;
- подсветка обновившихся значений;
- интерактивные подсказки;
- варианты плотности интерфейса;
- минималистичный и полный режимы с переключением.

---

## 6. Рыночные данные

Основной источник — Binance USDⓈ-M Futures.

Нужны:

- список фьючерсных символов;
- исторические и realtime-свечи;
- цена;
- объём;
- количество сделок;
- волатильность;
- Mark Price;
- Funding Rate;
- Open Interest;
- стакан;
- лента принтов;
- ликвидность;
- позднее — ликвидации и расширенные фьючерсные данные;
- BTC-контекст;
- несколько временных окон;
- данные для Scanner, Dashboard, Market, Workspace, History и Replay.

Frontend и backend обязаны работать через `NEXUS Data Contract v1`.

---

## 7. Dashboard

Утверждён первый основной концепт.

Блоки:

- BTC Market Mode;
- Hot List;
- Market Scanner;
- NEXUS AI Insights;
- график выбранной монеты;
- Volume Spikes;
- быстрые переходы к Scanner, Market и Charts.

### Volume Spikes

Показывать:

- символ;
- коэффициент роста объёма;
- текущий объём;
- коэффициент сделок;
- статус;
- период;
- время обновления.

Статусы:

- `new`;
- `growing`;
- `stable`;
- `fading`.

Переход по строке открывает монету в Scanner или Market.

---

## 8. Charts Core

Единый повторно используемый модуль для Dashboard, Charts, Market, Scanner, Workspace, History и Replay.

Обязательное:

- свечной график;
- исторические данные;
- realtime-обновление;
- таймфреймы;
- масштабирование;
- прокрутка;
- курсор;
- цена;
- объём;
- выбор символа;
- догрузка истории;
- обработка разрывов данных;
- состояния загрузки и ошибки.

Расширения:

- уровни S/R;
- импульсы;
- метки и зоны сетапов;
- стадии сетапа;
- Alerts;
- BTC-контекст;
- ликвидность;
- Replay.

---

## 9. Market

Текущее состояние после PR #133–#134: базовая end-to-end работоспособность `Market` и канонический переход `Market → Workspace` восстановлены. Раздел считается реализованным v0.1 и продолжает развиваться. Наличие causal Level Lines contract само по себе не означает завершение всех расширенных Market-фильтров и визуализаций.

Компоновка:

- слева — график выбранной монеты;
- справа — список монет.

Функции:

- выбор таймфрейма;
- сортировка и фильтры;
- рост/падение;
- объём;
- количество сделок;
- импульс;
- волатильность;
- корреляция с BTC;
- сила относительно BTC;
- уровни поддержки и сопротивления;
- переход в Scanner;
- переход в Workspace;
- добавление в Watchlist.

Market дополняет Scanner и не должен его дублировать.

`Market Recovery v0.1` больше не является ближайшей обязательной задачей. В объединённых работах PR #133–#134 уже зафиксированы Market Recovery и восстановление канонического `Market → Workspace` path.

Дальнейшее развитие Market сохраняет требования:

- реальные market-wide данные без штатной зависимости от mock;
- согласованность списка монет, выбранного symbol, timeframe и графика;
- корректные loading, error, empty и degraded состояния;
- сохранение symbol/timeframe при переходе `Market → Workspace`;
- ближайшие поддержку/сопротивление, расстояние до уровня, независимые касания и causal-стадию;
- фильтры «около поддержки», «около сопротивления» и «2+ касания» без отдельной пользовательской вкладки `Levels`.

Развитие Market не должно незаметно менять торговые пороги, создавать новые Setup rules, вводить probability/profitability labels, обучение или новый Setup Score.

---
## 10. Scanner

Scanner ищет аномалии и торговые сетапы.

Фильтры:

- Volume Spikes;
- количество сделок;
- импульсы;
- волатильность;
- рост/падение;
- корреляция с BTC;
- сила относительно BTC;
- уровни S/R;
- расстояние до уровня;
- стадия сетапа;
- ликвидность;
- Open Interest;
- Funding Rate;
- LONG/SHORT;
- таймфрейм.

Требования:

- пересчёт при смене таймфрейма и параметров;
- сортировка по силе и активности;
- сохранённые пресеты;
- пользовательские настройки;
- переход к графику и Workspace;
- состояния загрузки, ошибки и пустого результата.

### Volume Spikes Filters API

Уже поддерживаются:

- `periodMinutes`;
- `baselinePeriods`;
- `minVolumeRatio`;
- `minTradesRatio`;
- `minCurrentQuoteVolume`;
- `statuses`;
- `symbol`;
- `limit`.

Frontend подключил эти параметры без изменения backend-математики в PR #36.

---

## 11. Watchlist

- выбранные монеты;
- realtime-изменения;
- цена;
- процент изменения;
- объём;
- сделки;
- волатильность;
- стадия сетапа;
- пользовательская сортировка;
- переход к Charts, Scanner и Workspace.

---

## 12. Alerts

Типы:

- пользовательское условие;
- Volume Spike;
- аномальное число сделок;
- импульс;
- приближение к уровню;
- изменение стадии;
- подтверждение;
- пробой;
- отскок;
- отмена сетапа;
- изменение BTC Market Mode;
- изменение рейтинга.

Нужны:

- создание и редактирование;
- включение/выключение;
- история срабатываний;
- защита от повторов;
- связь с символом и таймфреймом;
- переход к графику и Replay.

---

## 13. Уровни и логика сетапов

### Level Lines v0.1 — канонический пользовательский контракт

- каждый таймфрейм `1m`, `5m`, `15m`, `1h` и `4h` анализируется независимо;
- каждый значимый причинно подтверждённый локальный экстремум может создать отдельную линию;
- линия начинается в точке исходного экстремума и становится видимой не раньше causal confirmation;
- линия никогда не дорисовывается назад и продолжается только вправо;
- близкие самостоятельные экстремумы на разных ценах не объединяются автоматически в одну ATR-зону;
- ATR разрешён для внутренних допусков и нормализации, но не как широкая пользовательская зона;
- соседние свечи одного контакта считаются одним touch episode;
- первый origin создаёт `candidate`, два независимых взаимодействия подтверждают рабочий уровень;
- третье независимое взаимодействие может перевести линию в `worked`, но само по себе не является торговым сигналом;
- после подтверждённого пробоя линия заканчивается и удаляется из Active Levels;
- непробитая линия может быть завершена как `superseded`, если справа причинно появился более экстремальный самостоятельный уровень;
- пробитая старая линия не переворачивается автоматически в новую пользовательскую поддержку или сопротивление;
- алгоритм не создаёт фиксированное количество уровней: допустимо `0`, `1`, `2` или больше реальных структур;
- пользователь видит тонкие линии, а cluster IDs, диагностические зоны и внутренний lifecycle остаются в debug/manual review;
- Level Lines остаётся `observationalOnly`, не создаёт setup, LONG/SHORT-сигнал, вероятность или quality score.

Реализованные статусы линии:

- `candidate`;
- `confirmed`;
- `worked`;
- `superseded`;
- `broken`.

Полный ручной review dataset пока не завершён. Наличие автоматических тестов и нескольких ручных проверок не означает, что качество всех уровней уже доказано.

### Пробой уровня

Зафиксировано:

- два независимых взаимодействия подтверждают рабочий уровень;
- новый подход к подтверждённому уровню является ранним сетапом до третьего касания;
- уровень выше текущей цены даёт potential LONG breakout bias;
- уровень ниже текущей цены даёт potential SHORT breakout bias;
- третье касание усиливает уже обнаруженный сетап, а не начинает ожидание с нуля;
- важны глубокий и неглубокий откат, поджатие, объём, сделки, BTC-контекст, стакан и лента принтов;
- ориентир расстояния `0,3–0,5%` остаётся контекстным признаком, а не универсальным жёстким порогом;
- пробой, отскок, ложный пробой, пропуск и отмена должны сохраняться как разные исходы;
- если движение уже состоялось до первого сигнала, исход отмечается как `missed`, а не как позднее подтверждение.

Пользовательские стадии:

1. Наблюдение
2. Подход
3. Подтверждение
4. Пробой

Базовый backend lifecycle Setup Engine:

1. `LEVEL_CONFIRMED`
2. `APPROACHING_THIRD_TOUCH`
3. `THIRD_TOUCH_CONFIRMED`
4. `BREAKOUT_CONFIRMED` или `REJECTION_CONFIRMED`
5. `SETUP_EXPIRED` при потере актуальности

### LONG «Отскок»

Стадии:

1. Наблюдение
2. Подход
3. Подтверждение
4. Отскок

Пробой и отскок используют общую архитектуру, но breakout bias и bounce bias не смешиваются.

### Последовательность после Level Lines

1. зафиксировать Departure Extremum `E` после реакции от конкретной подтверждённой линии `L`;
2. для каждой линии отдельно считать `progress = |P - E| / |L - E|`;
3. стартовый тестовый порог `0,50` переводит инструмент в «Наблюдение»;
4. Approach Engine оценивает поджатие, откаты, скорость, объём, сделки, силу относительно BTC и BTC-контекст;
5. realtime confirmation использует ленту, стакан, ликвидность и агрессию ближе к уровню.

Порог `0,50` меняется только после Replay и проверки, а не по ощущению.

Текущее состояние causal-цепочки после PR #125–#136 и Causal Setup Real-Data Validation v0.1:

- Departure Extremum Tracker v0.1 реализован отдельно для каждой активной подтверждённой/рабочей линии;
- Observation Tracker v0.1 причинно считает `progress` по последней закрытой свече и использует включительную границу `progress >= 0,50`;
- Approach Engine v0.1 причинно считает `distance = |P - L| / L × 100` и входит в `APPROACH` при `distance <= 0,50%` только после `OBSERVATION`;
- Realtime Confirmation Engine v0.1 оценивает свежие `@aggTrade` и синхронизированный стакан, возвращая `collecting`, `not_ready`, `partial` или `confirmed`;
- общий frontend-контракт causal Level Lines доступен Dashboard, Market, Scanner и Workspace, но сам по себе не подтверждает end-to-end работоспособность каждого раздела;
- Workspace показывает единую цепочку «Наблюдение → Подход → Подтверждение», не подменяет подтверждённое взаимодействие исходом и выбирает актуальный уровень по текущему рыночному контакту;
- цепочка по-прежнему не создаёт торговый сигнал, probability, profitability или Setup Score сама по себе;
- production Setup Detection Pipeline больше не запускает отдельный legacy `setup-level-detector`, а получает линии и per-line состояние из канонического Level Lines contract;
- causal-to-setup adapter создаёт кандидата только после `OBSERVATION` при `progress >= 0,50`, сохраняет `lineId/symbol/timeframe/stage/reason` и начинает срок жизни кандидата с момента входа в наблюдение;
- `APPROACH` при `distance <= 0,50%` переводит существующий lifecycle в `APPROACHING_THIRD_TOUCH`, а подтверждённое realtime-взаимодействие — в `THIRD_TOUCH_CONFIRMED`;
- realtime confirmation не объявляет breakout или bounce: существующий closed-candle Setup Stage Evaluator по-прежнему отдельно определяет `BREAKOUT_CONFIRMED` или `REJECTION_CONFIRMED` по прежним правилам.
- отдельный offline validator последовательно проигрывает реальные закрытые Binance `1m` свечи через production Setup Detection Pipeline, сохраняет candidate tracks, causal-стадии, задержки и нарушения инвариантов в JSON;
- исторические `aggTrade` и снимки стакана в OHLC-датасете отсутствуют и не синтезируются: этот validator проверяет `OBSERVATION` и `APPROACH`, но честно помечает realtime `CONFIRMATION` и итог breakout/rejection как не проверенные.
- фактический отчёт от `2026-08-11T18:01:05.684Z` содержит `311` уникальных candidate lines без нарушений инвариантов и pair anomalies, но `303` линии (`97,4%`) достигли `APPROACH` на той же закрытой свече, что и `OBSERVATION`; позднее подошли `6`, не подошли `2`;
- lifecycle churn зафиксирован отдельно: `215` из `311` линий повторно появлялись, `151` — более одного раза; эти данные требуют последующего lifecycle-разбора, но churn не исправляется вместе с границей стадий.
- Causal Stage Boundary Analysis v0.1 сравнил три политики на тех же `311` уникальных линиях: текущая сохранила `309` подходов, `next_closed_candle` — `274`, `outside_to_inside_crossing` — `36`;
- `300` из `303` same-bar переходов возникли уже после того, как предыдущая закрытая свеча находилась внутри границы Approach, и только `3` действительно пересекли её на свече рождения Observation;
- искусственная задержка на следующую свечу отклонена: она задерживает `268` текущих подходов и теряет `35`; crossing-only также отклонён: он теряет `273` текущих подхода и имеет медианную задержку `150` свечей;
- production-правило не изменено: анализ доказал, что первопричина находится в слишком позднем causal-входе в `OBSERVATION` относительно фиксированной границы Approach, а не в разрешении same-snapshot перехода как таковом.
- Causal Observation Entry Geometry Analysis v0.1 точно воспроизвёл текущий вход в Observation для всех `311` уникальных candidate lines: `0` candidate-pair anomalies и `0` replay anomalies;
- текущий порог `progress >= 0,50` сохранил `309` Approach, но `303` из них появились на той же свече; пороги `0,40 / 0,30 / 0,20 / 0,10` также сохранили все `309` Approach и снизили same-bar количество соответственно до `146 / 79 / 51 / 34`, с медианным опережением `1 / 3 / 4 / 5` свечей;
- geometry-only политика отклонена: она сохранила только `35` текущих Approach и потеряла `274`; существование валидной геометрии само по себе не является достаточным правилом входа в Observation;
- `1042` replay-disappearance полностью совпали с источником: `785` (`75,3%`) объясняются регрессом progress ниже `0,50`, ещё `257` — временной потерей доступной геометрии; следовательно, перенос порога без отдельной проверки lifecycle stability не считается достаточным исправлением;
- ранний progress-порог пока не выбран: исходные `311` линий условно отобраны текущим `progress >= 0,50`, поэтому одинаковые `2` false-early случая измеряют только исходные current candidates и не учитывают дополнительные линии, которые ранний порог допустил бы, но которые никогда не достигли бы `0,50`;
- production-правило не изменено: следующий counterfactual-анализ должен расширить universe до всех причинно доступных подтверждённых/рабочих линий с валидным departure extremum, включая линии без текущего Observation, и только после этого выбрать порог по дополнительным входам, последующим Approach и churn каждой политики.
- Causal Observation Threshold Counterfactual Validation v0.1 расширил causal universe до `342` подтверждённых/рабочих линий с валидным departure extremum: `311` current candidate lines и `31` линия вне исходной выборки; replay/identity anomalies — `0`;
- текущий `progress >= 0,50` точно воспроизвёл baseline: `311` entries, `309` последующих Approach, `2` без Approach, `303` same-bar перехода, `1042` disappearance и `740` reappearance;
- пороги `0,40 / 0,30 / 0,20 / 0,10` допустили соответственно `10 / 19 / 28 / 28` дополнительных линий, однако при отдельном причинном пересчёте Approach для каждой политики не уменьшили схлопывание стадий: same-bar составил `316 из 319 / 325 из 328 / 334 из 339 / 338 из 339`, а медианное время до Approach осталось `0` свечей для каждого порога;
- прежний entry-geometry результат с медианным опережением `1 / 3 / 4 / 5` свечей измерял ранний вход относительно неизменённого current Approach; полный counterfactual уточнил вывод, потому что более ранний Observation причинно разрешает и более ранний пересчёт Approach;
- lifecycle churn монотонно ухудшился при снижении порога: disappearance на entry line вырос с `3,350482` при `0,50` до `4,018692 / 4,948485 / 5,333333 / 5,778761`, а reappearance на entry line — с `2,379421` до `3,052960 / 4,021212 / 4,471976 / 4,932153`;
- ранний progress-порог отклонён: ни один вариант не выполнил обязательный критерий уменьшения same-bar `OBSERVATION → APPROACH`, а churn у всех вариантов выше текущего baseline; дополнительные линии сами по себе не компенсируют это ухудшение;
- production-порог обоснованно сохранён на `progress >= 0,50`; production detector, Observation Tracker, Approach Engine, Setup pipeline/runtime, realtime confirmation, outcome, score, обучение и frontend не изменены.

---

## 14. Workspace

Компоновка:

- большой график сверху;
- снизу лента принтов;
- единая карта ликвидности;
- блок динамики;
- справа панель NEXUS.

Панель NEXUS:

- тип и направление сетапа;
- стадия;
- рейтинг;
- подтверждения;
- риски;
- BTC-контекст;
- уровни;
- объём;
- сделки;
- ликвидность;
- причина изменения стадии.

Поддержать:

- режим «Пробой»;
- режим LONG «Отскок»;
- минималистичный режим;
- полный режим;
- ручную оценку результата;
- сохранение полного контекста.

Текущее causal-поведение Workspace:

- тип уровня, зона, касания, расстояние и стадия берутся из одного выбранного causal-состояния;
- ближайший к живой цене актуальный уровень имеет приоритет перед устаревшим направлением ранее выбранного сетапа;
- поддержка и сопротивление остаются отдельными линиями;
- два независимых касания показываются как подтверждённый рабочий уровень;
- realtime confirmation означает подтверждение взаимодействия, но не объявляет пробой или отскок;
- пробой показывается как факт только после подтверждения Level Engine закрытыми свечами;
- оценка сетапа и Feedback встроены в правую панель и не перекрывают causal-данные.

---

## 15. History

Для каждого завершённого или отменённого сетапа хранить:

- идентификатор;
- символ;
- направление;
- тип;
- таймфрейм;
- время обнаружения и завершения;
- стадии;
- итог;
- рейтинг;
- максимальное движение;
- просадку;
- параметры фильтров;
- BTC-контекст;
- свечи;
- объём;
- сделки;
- уровни;
- ликвидность;
- принты;
- версию алгоритма;
- версию модели;
- пользовательскую оценку;
- причину отмены.

---

## 16. Replay

Replay обязателен для v1.0.

Функции:

- воспроизведение рыночных данных;
- пауза;
- перемещение по времени;
- скорость;
- свечи и объём;
- стадии;
- уровни;
- принты;
- стакан и ликвидность при наличии данных;
- решения NEXUS;
- сравнение рейтинга с фактическим исходом.

---

## 17. Самообучение NEXUS

Самообучение — обязательный отдельный блок.

После завершения каждого сетапа система должна:

- определить исход;
- сохранить полный контекст;
- сравнить прогноз с результатом;
- искать признаки успешных и неуспешных случаев;
- корректировать рейтинг;
- постепенно улучшать веса фильтров.

Этапы:

1. сбор данных;
2. разметка исходов;
3. метрики качества;
4. анализ признаков;
5. адаптивный рейтинг;
6. осторожная корректировка весов;
7. контроль деградации;
8. возможность отката.

Сохранять:

- символ;
- время;
- тип;
- направление;
- таймфрейм;
- стадию;
- рейтинг;
- фильтры;
- свечи;
- объём;
- сделки;
- BTC-контекст;
- уровень;
- расстояние до уровня;
- глубину отката;
- принты;
- стакан;
- ликвидность;
- итоговое движение;
- максимальное благоприятное и неблагоприятное движение;
- причину отмены;
- версию алгоритма;
- версию модели.

Защита:

- версионирование;
- журнал изменений;
- сравнение до/после;
- минимальный размер выборки;
- ограничение величины изменений;
- тестирование на отложенной выборке;
- ручное подтверждение опасных изменений;
- откат;
- мониторинг деградации.

Сбор данных для самообучения закладывается заранее в Scanner, Alerts, Workspace, History, Replay, backend-события и Data Contract.

При начале реального накопления обучающего датасета пользователь должен получить отдельное уведомление.

---

## 18. NEXUS AI Insights

Должен:

- объяснять рыночный контекст;
- выделять важные изменения;
- объяснять рейтинг;
- показывать риски;
- связывать BTC и альткоин;
- объяснять появление сетапа и изменение стадии.

Нельзя показывать необъяснимую оценку без связи с конкретными метриками.

---

## 19. Пользователи, тарифы и настройки

Нужны:

- регистрация;
- вход и выход;
- восстановление доступа;
- профиль;
- управление сессиями;
- роли;
- тарифы;
- подписки;
- ограничения функций по тарифу;
- настройки языка, темы и плотности;
- минималистичный/полный режим;
- настройки уведомлений;
- Scanner presets;
- Watchlist;
- Alerts;
- безопасность.

---

## 20. Обратная связь

Типы:

- ошибка;
- предложение функции;
- неудобство интерфейса;
- оценка качества сетапа;
- другое.

Автоматически прикладывать:

- пользователя;
- экран;
- символ;
- таймфрейм;
- фильтры;
- стадию;
- ID сетапа;
- версии frontend/backend;
- версию алгоритма;
- данные ошибки;
- скриншот при согласии пользователя.

---

## 21. Админ-панель

Отдельный маршрут `/admin`.

Обязательны:

- ролевой доступ;
- аудит действий;
- управление пользователями;
- роли и подписки;
- обращения и отзывы;
- оценки сетапов;
- состояние Binance-потоков;
- состояние backend-сервисов;
- статистика использования;
- ошибки;
- версии алгоритма и модели;
- качество сетапов;
- история изменения весов;
- сравнение версий;
- откат;
- управление публичными материалами в будущем.

---

## 22. Безопасность и эксплуатация

- защита закрытых маршрутов;
- защита `/admin`;
- безопасные сессии;
- rate limiting;
- валидация API;
- аудит критических действий;
- маскирование секретов;
- безопасные переменные окружения;
- контроль зависимостей;
- резервное копирование;
- восстановление после сбоя.

Наблюдаемость:

- состояние backend;
- Binance WebSocket;
- задержка данных;
- пропуски свечей;
- ошибки прогрева;
- активные символы;
- время ответа API;
- ошибки frontend;
- качество сетапов;
- версии алгоритма;
- память и CPU;
- пользователи;
- частота Alerts.

---

## 23. Производительность

Ориентир v1.0:

- около 1000 пользователей;
- устойчивые realtime-потоки;
- независимость параллельных запросов;
- отсутствие глобальной мутации настроек;
- безопасное кэширование;
- ограничение частоты frontend-обновлений;
- виртуализация больших таблиц;
- постепенная загрузка истории;
- контролируемое хранение Replay-данных.

---

## 24. Критерии готовности задач

Для каждой задачи:

- typecheck;
- unit tests;
- integration tests;
- API validation;
- реальные HTTP-проверки;
- production build;
- `npm audit --audit-level=high` для затронутого package tree;
- `git diff --check`;
- проверка списка изменённых файлов;
- отдельная ветка;
- коммит;
- PR;
- доступные GitHub Actions checks;
- merge;
- чистый и синхронизированный `main`.

Для критических модулей дополнительно:

- нагрузочные проверки;
- восстановление после разрыва Binance;
- проверка пропущенных данных;
- параллельные запросы;
- права доступа;
- миграции;
- откат алгоритма.

---

## 25. Фактическое состояние `main` и текущей ветки на 2026-08-16

Базовая точка:

- `main` и `origin/main` на момент создания ветки: merge-коммит `c63025e`;
- последний объединённый PR: #156;
- PR #156 добавил offline Setup Lifecycle Reachability Diagnostics и подтвердил episode-rearm ограничение production path; GitHub Actions Backend и Frontend — `success`;
- текущая ветка `backend-setup-candidate-episode-rearm-contract-v0-1` вводит явную causal identity отдельного Setup episode без изменения Observation/Approach/Confirmation thresholds;
- новый episode начинается только после causal перехода `progress < 0,50 → progress >= 0,50`; повторные scans и expiry внутри непрерывного episode новый candidate не создают;
- candidate ID, `createdAt` и expiry детерминированно выводятся из `line.id + setupType + episode.startedAt`; после выхода ниже threshold и нового входа создаётся новый ID, а terminal history предыдущего episode сохраняется;
- focused episode-rearm regression `46/46`, все backend test files `708/708`, все frontend test files `280/280`, typecheck и production builds прошли локально.

Последний baseline подтверждает целостность реализации и сборки. Он не подтверждает прибыльность торговых правил.

### Объединённые блоки работ

| PR | Блок | Подтверждённый результат |
| --- | --- | --- |
| #27–34 | Futures migration и market-wide foundation | Binance USDⓈ-M Futures, multi-window metrics, защита неполных окон, Volume Spikes, warm-up, Dashboard и Filters API |
| #35–39 | План и Charts Core | Master Plan v1, frontend-фильтры Volume Spikes, общий candlestick/volume chart, история, drawing tools, интеграция Dashboard/Market/Scanner/Workspace |
| #40–52 | Setup Engine foundation | lifecycle, level detector v1, candidates, pipeline, runtime, read API, stage evaluator, events, frontend integration, history и SSE |
| #53–61 | Live Market и Workspace | стабильная навигация, live candles, Scanner metrics, freshness/degraded mode, trade tape, order book, liquidity map, market dynamics и frontend live confirmation |
| #62–72 | Level v2 Shadow | zones, lifecycle registry, shadow runtime/evaluation/history/diagnostics, overlap fixes и Scanner shadow integration |
| #73–86 | Scanner UX и frontend data integrity | causal line boundary, chart visibility/grid, selected-candidate UX и integrity hardening для Dashboard, Scanner, Market, Watchlist, Alerts, History, Replay, Settings и Workspace |
| #87–89 | Feedback и runtime packaging | end-to-end feedback persistence, MVP release-candidate checks и локальный Docker runtime |
| #90–103 | Level v2 analytical pipeline | break classifications, market evidence, confirmation candidates, outcomes, quality samples/dataset и frontend inspection; обучение не применяется |
| #104–116 | Независимый Level Engine | setup-neutral contract, independent touch episodes, multi-timeframe detection, real-data validation, lifecycle, causal replay, frozen diagnostic sample, `/app/level-preview`, manual review и JSON export |
| #117–121 | GitHub Actions diagnostics | timeout/runner/dispatch changes, успешный minimal smoke и удаление временного smoke-workflow |
| #122 | Level Lines v0.1 | отдельные causal support/resistance lines, independent touches, lifecycle, break/supersession, обновлённые API и frontend preview |
| #123 | Dependency audit hotfix | `nanoid 3.3.18`, `postcss 8.5.26`, audit без уязвимостей, CI #71 зелёный |
| #124 | Синхронизация Master Plan | состояние репозитория после PR #123, официальный маршрут из 13 этапов и Departure Extremum как следующий шаг |
| #125 | Departure Extremum Tracker v0.1 | отдельный причинный экстремум `E` для каждой активной подтверждённой/рабочей Level Line; только закрытые свечи |
| #126 | Observation Tracker v0.1 | per-line `progress = |P - E| / |L - E|`, последняя закрытая цена `P`, включительный порог `0,50` |
| #127 | Approach Engine v0.1 | per-line расстояние до `L`, включительная граница `<= 0,50%`, вход только из `OBSERVATION` |
| #128 | Causal Level Lines во frontend | общий snapshot/model для Dashboard, Market, Scanner и Workspace; legacy setup-zone lines удалены с рабочих графиков |
| #129 | Realtime Confirmation Engine v0.1 | свежие `@aggTrade` + синхронизированный стакан, статусы `collecting/not_ready/partial/confirmed`, без сигнала и score |
| #130 | Realtime confirmation во Workspace | backend-факты, causal-цепочка Observation → Approach → Confirmation, freshness/pressure/reasons без frontend-дублирования расчётов |
| #131 | Согласованность causal-взаимодействия Workspace | единый активный уровень, зона, касания, расстояние и стадия; корректный фокус на поддержке/сопротивлении; встроенный Feedback |
| #133–#134 | Market Recovery и Market → Workspace path recovery | реальные market-wide данные, выбранные symbol/timeframe и канонический переход в Workspace восстановлены |
| #135 | CI verifier hotfix | статический trading-presets verifier приведён к текущему routing contract; runtime не изменён |
| #136 | Causal Setup Pipeline Integration v0.1 | production Setup Detection Pipeline переведён на Level Lines; causal identity/stage/reason подключены к существующему lifecycle без изменения breakout/bounce правил |
| #137 | History warm-up reliability | Binance-лимит страницы `1000`, отдельный timeout, retry/backoff и повтор неудачных символов внутри этапа warm-up |
| #138–#141 | Causal Setup validation | real-data replay, stage boundary, observation entry geometry и threshold counterfactual validation; production `progress >= 0,50` сохранён |
| #142 | Alerts Backend Foundation v0.1 | единый backend runtime правил, cooldown/deduplication, bounded trigger history, HTTP contracts и Setup lifecycle source |
| #143 | Alerts Market Event Sources v0.1 | существующие Market Wide Volume Spike и trades anomaly подключены без frontend-пересчёта source metrics |
| #144 | Alerts Frontend Runtime Integration v0.1 | Alerts page подключена к runtime metadata/status/rules/enabled/triggers contracts без mock fallback |
| #145 | Alerts BTC Market Mode Producer v0.1 | канонический BTC mode producer публикует только реальные causal state changes после тихой baseline |
| #146 | Alerts Impulse Event Source v0.1 | вычисляемый `5m` impulse producer и adapter подключены к общему Alerts runtime |
| #147 | Alerts Persistence Foundation v0.1 | versioned snapshot v1, atomic JSON adapter, hydration до source subscription, restart-safe rules/history/dedupe/cooldown и degraded diagnostics |
| #148 | Alerts External Delivery Foundation v0.1 | provider-neutral adapters, persisted outbox v2, stable idempotency, bounded retry/backoff, restart recovery и безопасные diagnostics; production adapters по умолчанию не настроены |
| #149 | NEXUS Unified Decision Contract v0.1 | backend объединяет causal Level/Observation/Approach/Realtime Confirmation, существующий Setup outcome, BTC mode и symbol impulse в объяснимые `observe/possible_long/possible_short/wait_confirmation/setup_confirmed/skip`; frontend только отображает готовый contract |
| #150 | NEXUS Unified Decision Real-Data Validation v0.1 | versioned последовательный replay реальных закрытых `1m`-свечей через production Level Lines и Unified Decision; точная availability отсутствующих historical sources, распределения, transitions и invariant violations без синтетической ленты/стакана |
| #151 | NEXUS Unified Decision Live Observation Dataset v0.1 | bounded/versioned JSON dataset реальных готовых Unified Decision observations с использованными aggTrade/order-book captures, Setup candidates и BTC/impulse availability/observedAt; безопасные status/list/export diagnostics без credentials/PII |
| #152 | NEXUS Unified Decision Live Cohort Validation v0.1 | отдельный versioned report проверяет реальную 12-часовую cohort, symmetry четырёх level/scenario/direction cases, source-loss/disagreement downgrade, market freshness, Setup causal linkage, transitions и safety invariants без изменения production rules |
| #153 | NEXUS Unified Decision Coverage-Gap Observation v0.1 | отдельный persistent rare-case store подписан на готовые live observations и сохраняет single/double market-context conflict и terminal Setup outcome с transition, observed/not_observed coverage и contract violations без повторного расчёта sources и без изменения production rules |
| #154 | NEXUS Unified Decision Coverage-Gap Live Collection v0.1 | 24-часовой wall-clock сбор дал `3 940` успешных controlled requests; после подтверждённых отключений интернета collector восстановился, recorder/observer остались ready, но все три gap kind сохранили `not_observed` |
| #155 | NEXUS Unified Decision Coverage-Gap Reachability Diagnostics v0.1 | offline report по `5 000` observations локализовал market cutoff на отсутствии opposed context и Setup cutoff на отсутствии `APPROACHING_THIRD_TOUCH`; все три gaps `blocked_upstream`, violations `0`, production rules не изменены |
| #156 | NEXUS Unified Decision Setup Lifecycle Reachability Diagnostics v0.1 | report по `5 000` observations отделил `36` unique candidates от `12 708` retained expired occurrences, подтвердил causal Approach у `28`, локализовал bounded-retention cutoff и episode-rearm ограничение без изменения thresholds/lifecycle |
| #171 | NEXUS Setup Candidate Episode Rearm Contract v0.1 | causal candidate получил restart-deterministic episode identity; новый candidate разрешён только после выхода ниже Observation threshold и нового causal re-entry, duplicate suppression и terminal history сохранены |
| Текущая ветка | NEXUS Setup Candidate Episode Real-Data Validation v0.1 | `4 995` реальных закрытых свечей подтвердили `1 480` rearms, `10 002` suppressions, restart equivalence и отсутствие same-episode churn/violations без изменения production rules |

### Важные границы текущей реализации

- полный ручной review dataset Level Engine не завершён;
- Level Lines v0.1 остаётся наблюдательным слоем и имеет `createsSetup: false`;
- Level v2 quality dataset остаётся shadow-only и имеет `trainingApplied: false`;
- Departure, Observation, Approach и realtime confirmation подключены к lifecycle существующего Setup Engine через отдельный causal-to-setup adapter;
- offline causal Setup validation использует реальные `1m` OHLC-свечи и не подменяет отсутствующую историческую ленту/стакан синтетическими подтверждениями;
- frontend только отображает backend causal-состояние и сам не меняет lifecycle Setup Engine; realtime confirmation остаётся подтверждением взаимодействия, а не торговым исходом;
- Unified Decision выбирает один causal-уровень, отделяет `bounce/breakout` от `long/short`, использует BTC mode и symbol impulse только как freshness-aware фильтры и повышает состояние до `setup_confirmed` только по уже существующему terminal outcome Setup Engine. `possible_long/possible_short` означают возможный сценарий, а не приказ открыть позицию; contract имеет `decisionSupportOnly: true`, не создаёт order/setup/signal/score, не оценивает прибыльность и не использует будущие данные;
- Unified Decision Real-Data Validation v0.1 повторно использует реальные Binance `1m` datasets и на каждом закрытом causal prefix запускает production Level Lines, realtime-confirmation fallback и Unified Decision дважды. Фактическая выборка из `1 495` закрытых свечей дала `1 038 observe`, `296 wait_confirmation`, `71 skip`, `0 possible_long`, `0 possible_short`, `0 setup_confirmed`, `127` уникальных выбранных линий и `0` deterministic/future/safety violations. Исторические `aggTrade`, order-book, Setup lifecycle, BTC mode и symbol impulse в OHLC-выборке недоступны и записываются как `availability: unavailable`, `observedAt: null`; они не синтезируются. Поэтому эта выборка подтверждает offline fallback и causal-инварианты, но не подтверждает real-observation symmetry, stale downgrade или terminal Setup outcomes;
- Unified Decision Live Observation Dataset v0.1 записывает один observation только после готового ответа production Level Lines/Unified Decision и получает уже захваченные realtime evidence, Setup candidates и market-context snapshots из этой же causal-операции. Он не открывает Binance subscriptions и не пересчитывает source metrics. JSON snapshot v1 сохраняется атомарно с capacity `5 000` по умолчанию; trades и Setup candidates внутри observation также bounded. Corrupt/unsupported storage не перезаписывается: recorder продолжает собирать bounded memory cohort в degraded mode, а сбой record/save не изменяет ответ Level Lines. Raw source error messages не сохраняются — только безопасные коды; status/list/export endpoints не содержат credentials или персональных данных;
- Unified Decision Live Cohort Validation v0.1 проверил точный диапазон sequence `10–2051`: `2 042` observations за период `2026-08-13T18:54:12.794Z` — `2026-08-14T06:53:21.576Z`, `381` state transition, `1 349 observe`, `572 wait_confirmation`, `64 possible_long`, `57 possible_short`, `0 setup_confirmed`, `0 skip`. Symmetry подтверждена во всех четырёх ячейках: resistance breakout long `35`, resistance bounce short `41`, support breakout short `16`, support bounce long `29`. Realtime downgrade подтверждён на `88` non-live tape, `3` non-live order-book, `822` disagreement и `179` partial observations; possible-state при source loss — `0`. Market freshness подтверждена, invariant/safety violations — `0`, изменение decision rules не рекомендовано;
- cohort не содержал ни одного market-context conflict и ни одного terminal Setup outcome. Эти две области имеют статус `not_observed`, а общий report — `validated_with_coverage_gaps`; это не ошибка текущих правил и не основание менять thresholds/ranking/lifecycle. Полная validation этих ветвей требует новой фактической выборки без синтетических observations;
- Unified Decision Coverage-Gap Observation v0.1 подписывается на уже записанный live-observation stream и не открывает дополнительные Binance connections. Только три редких вида (`market_context_single_conflict`, `market_context_double_conflict`, `terminal_setup_outcome`) сохраняются в отдельный atomic JSON snapshot v1; capacity применяется отдельно к каждому виду, поэтому частый conflict не удаляет единственный terminal outcome. Каждый case содержит исходный causal observation, transition от предыдущего observation того же symbol, safe contract violations и safety flags. Status/list/export API выпускает versioned report с `observed/not_observed`, transitions и violations. Ошибка subscriber или persistence изолирована от Level Lines/Unified Decision ответа; corrupt storage не перезаписывается, observer продолжает bounded memory collection в degraded mode;
- Unified Decision Coverage-Gap Live Collection v0.1 работал `2026-08-14 18:45:41` — `2026-08-15 18:46:37` по `BTCUSDT/ETHUSDT/SOLUSDT`, `1m`, с интервалом 60 секунд. Из `4 290` запросов `3 940` завершились успешно; `350` transport failures пользователь связал с отключениями интернета. Collector продолжил работу после восстановления, а recorder/observer завершили окно в `ready` без persistence error. Все три kind остались `not_observed: 0`; `0` violations не валидирует отсутствующие cases. Вместе с первой cohort получено не менее `5 982` controlled real observations без этих редких ветвей, поэтому следующий шаг — reachability diagnostics, а не изменение production rules или слепое повторение того же окна;
- Unified Decision Coverage-Gap Reachability Diagnostics v0.1 читает существующий persistence snapshot или versioned dataset offline и не вызывает Level Lines, Setup runtime, Binance readers или producers. Для market-context path он считает directional realtime precursors, source read state, computable BTC/impulse context, независимые derived alignments, opposing values и single/double combinations. Для Setup path он считает доступность source, candidate snapshots, `APPROACHING_THIRD_TOUCH`, `THIRD_TOUCH_CONFIRMED`, terminal outcome, current/expired terminal visibility и `setup_confirmed`. Каждый gap получает `observed/reachable_not_observed/blocked_upstream/contract_violation`, точный cutoff и безопасную следующую diagnostic action; thresholds, ranking, lifecycle и decision rules остаются неизменными;
- фактический Reachability report проверил sequences `993–5992`, `5 000` observations за `2026-08-14T00:38:23.613Z` — `2026-08-15T15:45:42.879Z`. Из `243` directional realtime precursors BTC context был вычислим в `241`, impulse — в `160`, оба — в `160`, но `btcOpposed=0`, `impulseOpposed=0`; single/double market conflicts имеют `blocked_upstream` на `opposing_market_context_not_observed`. Setup source был available во всех `5 000` observations и содержал `12 708` occurrences / `36` unique candidates, но aggregate snapshots показывали только `SETUP_EXPIRED`: `APPROACHING_THIRD_TOUCH=0`, `THIRD_TOUCH_CONFIRMED=0`, terminal outcomes и `setup_confirmed=0`. Последующий lifecycle diagnostic уточнил, что causal Approach всё же был достигнут до expiry у `28/36`, а active runtime snapshots были вытеснены bounded retention. Violations `0`, report status `diagnosed_with_unreached_gaps`, next action `inspect_setup_lifecycle_reachability`;
- Unified Decision Setup Lifecycle Reachability Diagnostics v0.1 прочитал тот же versioned dataset/persistence snapshot offline и построил путь source available → candidate captured → first-seen current → causal Observation/Approach/Confirmation → применённые runtime stages → terminal outcome. Фактический report: `5 000` observations, `1 059` observations с candidates, `12 708` occurrences / `36` unique candidates; все `36` созданы до начала sequence `993` и впервые видны после expiry, все occurrences — retained `SETUP_EXPIRED`, maximum retention `39 739` секунд. Causal `OBSERVATION` присутствует у `36`, causal `APPROACH` у `28`, causal `CONFIRMATION` у `0`; terminal outcomes и violations — `0`. Diagnosis `retention_currentness_mismatch`, cutoff `candidate_first_seen_after_expiry`, targeted live check не рекомендован. Проверка production path дополнительно подтвердила episode-rearm ограничение: candidate ID зависит только от `line.id + setupType`, process-lifetime duplicate set не освобождает ID, а terminal runtime игнорирует последующие updates. Исправление вынесено в отдельный episode-aware contract; текущая ветка thresholds, lifecycle и decision rules не меняет;
- Setup Candidate Episode Rearm Contract v0.1 определяет episode boundary как новый causal threshold re-entry закрытой свечи после фактического выхода `progress < 0,50`. Внутри непрерывного episode ID стабилен и повторные scans подавляются; expiry сам по себе rearm не вызывает. После выхода и нового входа candidate получает новый restart-deterministic ID из `line.id + setupType + episode.startedAt`, прежний terminal record остаётся в history. `createdAt`/expiry восстанавливаются из той же causal границы, update несёт `episodeId`, а runtime отклоняет episode-mismatched update. Порог Observation, Approach/Confirmation, bounce/breakout, ranking, Unified Decision и market-context rules не изменены;
- Setup Candidate Episode Real-Data Validation v0.1 дважды воспроизвёл сохранённые реальные `1m` datasets через production Observation → causal Setup path. На `4 995` закрытых свечах прежние `622` пары `lineId + setupType` дали `2 102` episode candidates: точная разница `1 480` соответствует измеренным rearms, `430` пар были rearmed. Внутри episodes подавлено `10 002` повторных observations; restart mismatches, same-episode churn и violations — `0`. Contract устранил permanent duplicate cutoff, но выявил отдельную пользовательскую границу: Scanner/read API должен показывать current episode пары, оставляя предыдущие episodes в History;
- Level Lines Exact-Price Origin Resolution Contract v0.1 применяет split lifecycle policy до Departure/Observation/Approach/Setup. Если прежняя exact-price identity ещё не была `worked` на момент активации нового origin, current projection переиспользует прежний `lineId`; если `workedAt <= newer.activeFrom`, старая запись остаётся в полном `lines` History, а новый origin становится current episode. Группа определяется только `symbol + timeframe + kind + exact price`: близкие цены и разные kinds не объединяются. Полный исторический реестр не удаляется, формула `lineId`, pivot/touch/threshold/decision rules не меняются;
- Level Lines Exact-Price Origin Resolution Real-Data Validation v0.1 дважды проиграла `4 905` causal prefixes по `4 995` сохранённым реальным закрытым `1m` свечам. Production path выдал `40` уникальных resolution decisions: `31` active identity reuse и `9` worked identity rearm. Residual current collision groups, restart mismatches и invariant violations — `0`; полная History сохранена, restart/replay equivalence подтверждена, future candles и изменения trading rules отсутствуют;
- пользовательский путь `Market → Workspace` восстановлен в PR #133–#134 и защищён актуальным CI verifier после PR #135;
- отдельная пользовательская вкладка `Levels` не планируется: уровни должны работать внутри `Market`, `Scanner` и `Workspace`;
- Funding Rate, Open Interest и ликвидации ещё не подключены к рабочим market metrics;
- Alerts имеют единый backend runtime и provider-neutral External Delivery Foundation. Persistence snapshot v2 сохраняет rules, enabled state, bounded trigger history, source-event dedupe, активные cooldown scopes и delivery outbox; snapshot v1 мигрирует детерминированно с пустым outbox. Каждый trigger ставится в outbox по immutable trigger id и стабильному idempotency key, а `pending/sending/delivered/failed`, bounded attempts, retry/backoff и interrupted-send recovery переживают restart. Отказ enqueue или delivery не отменяет trigger и не останавливает event sources; наружу выводятся только безопасные error codes и агрегированные diagnostics. Production delivery adapters и vendor credentials по умолчанию отсутствуют, поэтому реальная внешняя отправка ещё не включена. Multi-user ownership, Auth, постоянная History/Replay data layer, production DB/backup и закрытая beta не завершены.

---

## 26. Официальная дорожная карта до v1.0 — 13 этапов

Мелкие PR и внутренние чек-листы не заменяют этот маршрут. Статусы ниже не являются процентами и не означают автоматическое закрытие этапа.

| Этап | Название | Состояние на 2026-08-12 | Граница этапа |
| --- | --- | --- | --- |
| 1 | Публичная страница | Частично | Есть публичный frontend-фундамент и SEO/i18n-заготовки; финальные лендинг, тексты, локализация и заявка в beta не завершены |
| 2 | Binance USDⓈ-M Futures Migration | Завершён | PR #27; целевой рынок переведён на активные USDT perpetual contracts |
| 3 | Futures Market Metrics | Частично | Реализованы realtime и multi-window цена/объём/сделки/волатильность/BTC-метрики, а также Mark Price + Funding Rate Runtime Foundation v0.1; Open Interest и ликвидации ещё впереди |
| 4 | Futures Scanner | Реализован v0.1, развитие продолжается | Есть таблица, окна, фильтры, сортировки, Volume Spikes, live metrics, Charts Core и causal Level Lines; causal Setup pipeline подключён на backend |
| 5 | Charts, Market и Workspace | Реализованы v0.1, развитие продолжается | Charts и Workspace реализованы v0.1, causal-интеграция Workspace выполнена; `Market → Workspace` восстановлен в PR #133–#134; Workspace отображает backend Unified Decision без frontend-пересчёта направления |
| 6 | Levels Engine | Level Lines и causal-трекеры v0.1 объединены; exact-price resolution path проверен на real data | Канонические отдельные causal lines, Departure, Observation, Approach и realtime confirmation реализованы. На `4 995` свечах подтверждены `40` exact-price decisions без residual collisions/violations; frozen Manual Review sample ранее завершён `100/100` и повторно не запускается |
| 7 | Setup Engine | Causal integration, episode rearm, current-episode read projection, exact-price split resolution и multi-timeframe runtime v0.1 реализованы | Production Setup Engine рассчитывает независимые `1m / 5m / 15m / 1h / 4h` сетапы. Production causal replay фактически подтвердил `31` active identity reuse и `9` worked identity rearm decisions с сохранением History. Global price merge отклонён |
| 8 | Alerts | Backend, frontend, persistence и external delivery foundation v0.1 реализованы, развитие продолжается | Есть versioned persistent backend-domain, HTTP API, Setup lifecycle, Market Wide Volume Spike/trades adapters, BTC Market Mode producer, вычисленный impulse-source и restart-safe provider-neutral outbox; Alerts page использует реальные runtime contracts без mock fallback. Реальный delivery adapter, канал/credentials и multi-user ownership ещё впереди |
| 9 | Пользователи и сохранение данных | Частично | Есть feedback persistence, Alerts Persistence Foundation и runtime event history; Auth, приглашения, ownership, Watchlist persistence и постоянная история сетапов не завершены |
| 10 | Production и сервер | Начат | Есть локальный Docker runtime; домен, HTTPS, production DB, monitoring, backup и restore не завершены |
| 11 | Закрытая beta | Не начат | После готовности ключевого Setup/Alerts/data pipeline — 5–10 трейдеров |
| 12 | Развитие beta до NEXUS v1.0 | Не начат | Новые сетапы, Market History, публичные карточки, тарифы, Admin Panel и самообучение после beta-данных |
| 13 | Финализация NEXUS v1.0 | Не начат | Безопасность, нагрузка, локализация, документация и production-релиз `v1.0.0` |

---

## 27. Ключевые зависимости

- Charts Core нужен Dashboard, Market, Scanner, Workspace, History и Replay.
- Работоспособный Market нужен для самостоятельного обзора рынка и перехода к Workspace; путь восстановлен до подключения causal-цепочки к Setup Engine.
- Уровни внутри Market используют канонический Level Lines contract; отдельная пользовательская вкладка `Levels` не создаётся.
- Scanner нужен Workspace, Alerts и History.
- Канонические Level Lines являются единственным источником уровней production Setup Detection Pipeline.
- После Level Lines реализован фиксированный порядок: Departure Extremum → Observation 50% → Approach Engine → realtime confirmation.
- Существующий Setup Engine потребляет per-line causal-цепочку через adapter, сохраняя прежние breakout/bounce и outcome-правила.
- Unified Decision читает готовые causal-факты, terminal outcome Setup Engine и текущие BTC/impulse producer snapshots; он не запускает дублирующие расчёты и не является источником исполнения сделки.
- History нужен Replay и Self-Learning.
- Сбор контекста начинается в Scanner, Workspace, Alerts, History и Replay до запуска Self-Learning.
- Реальное самообучение начинается только после History + Replay, достаточной выборки и отдельного уведомления пользователя.
- Версионирование алгоритма нужно до Adaptive Ranking.
- Auth нужен подпискам и персональным настройкам.
- Admin нужен контролю качества и откату моделей.
- Data Contract обязателен для всех frontend/backend-интеграций.
- Frozen Manual Review causal Level Lines уже выполнен на выборке `100/100`; повторная разметка той же sample не требуется. Новые изменения качества требуют отдельного versioned evidence.

---

## 28. Границы v1.0

### Обязательно

- Dashboard;
- Charts;
- Market;
- Scanner;
- Watchlist;
- Alerts;
- Workspace;
- History;
- Replay;
- базовое самообучение;
- адаптивный рейтинг с защитой;
- авторизация;
- профиль;
- подписки;
- обратная связь;
- админ-панель;
- мультиязычность;
- публичный сайт;
- SEO;
- наблюдаемость;
- безопасность;
- production-ready frontend/backend.

### После v1.0 или отдельного решения

- desktop-приложение;
- самостоятельный поиск новых типов сетапов сложной моделью;
- отображение сделок сторонних скальперов;
- социальные функции;
- дополнительные биржи;
- автоматическая торговля.

Эти идеи не удаляются, но не должны незаметно расширять обязательный объём v1.0.

---

## 29. Правила нашей работы

1. Одна задача за раз.
2. Одна точная PowerShell-команда за раз.
3. В PowerShell использовать `npm.cmd`.
4. Не утверждать, что изменение сделано, пока нет подтверждения.
5. Не утверждать, что тест прошёл, пока нет вывода.
6. Не утверждать, что PR объединён, пока это не подтверждено.
7. Не переходить дальше до проверки текущей задачи.
8. При очевидном следующем шаге продолжать без лишнего вопроса.
9. Спрашивать только при реальной развилке.
10. После каждого этапа показывать статус текущей задачи и фактический статус проекта; числовой процент — только после отдельного пересчёта.

---

## 30. Контроль перед новой задачей

Перед стартом проверять:

- какой раздел Master Plan реализуется;
- что уже есть в коде;
- зависимости;
- Data Contract;
- влияние на самообучение;
- влияние на Charts Core;
- влияние на i18n и SEO;
- влияние на роли и подписки;
- влияние на Admin;
- необходимость событий History/Replay;
- критерии готовности;
- границы изменяемых файлов.

---

## 31. Следующий шаг

Последняя полностью закрытая задача:

**NEXUS Setup Outcome Sample Sufficiency v0.1**

Фактический результат:

- PR #184 merged в `main`;
- feature commit: `d72f2125a796db31d35712cfec290ea4bc5eeeac`;
- merge commit: `d4aa844895aeadc95c975a053b0a82930186d34f`;
- PR Backend и Frontend CI — `success`;
- post-merge Backend и Frontend CI — `success`;
- readiness policy зафиксирована до исследования labels:
  - минимум `100` eligible measured candidates всего;
  - минимум `25` для каждого canonical `setupType × direction` cohort;
- на factual validation sample было `1 / 100` eligible measured candidate;
- cohort coverage:
  - `level_breakout:long` — `0 / 25`;
  - `level_breakout:short` — `0 / 25`;
  - `level_bounce:long` — `0 / 25`;
  - `level_bounce:short` — `1 / 25`;
- unresolved data-integrity blockers на проверенной factual sample отсутствовали;
- `labelRuleResearchEligible = false`;
- profitability labels не применялись;
- production Setup rules не менялись;
- training и Self-Learning не запускались.

Текущий обязательный data-track:

**NEXUS factual Setup Outcome accumulation under Sufficiency Gate**

Правила:

- Persistent Setup Event History продолжает накапливать factual lifecycle events;
- Setup Outcome Dataset измеряется только по factual `THIRD_TOUCH_CONFIRMED` anchors и реальным закрытым Binance USD-M Futures `1m` candles;
- Sufficiency analyzer периодически пересчитывает eligible measured sample и canonical cohort coverage;
- `pending_window` не считается failure;
- factual `missing_third_touch_anchor` сам по себе не считается trading-quality failure;
- success/failure labeling research заблокирован до `sufficient_for_next_research_stage`;
- достижение sufficiency gate само по себе не применяет label и не меняет trading rules;
- Self-Learning остаётся заблокированным до отдельного явного решения.

Пока factual sample накапливается, разрешена отдельная независимая разработка других задач официальной дорожной карты в отдельном worktree от актуального `origin/main`, если она не прерывает collector и не подменяет sufficiency gate.

---
## 32. Приоритет источников правды

При конфликте действует порядок:

1. последнее явное решение пользователя;
2. NEXUS Master Plan;
3. обязательные addendum и Data Contract;
4. текущая техническая спецификация;
5. существующая реализация.

Любое новое продуктово значимое решение должно быть внесено в этот документ.
---

## 33. Setup Engine Multi-Timeframe Runtime v0.1

Production Setup Engine рассчитывает независимые сетапы для `1m`, `5m`, `15m`, `1h` и `4h` поверх выровненной агрегации закрытых минутных свечей. Пороговые и торговые правила не изменены. Подробный контракт: `NEXUS_SETUP_ENGINE_MULTI_TIMEFRAME_RUNTIME_v0.1.md`.

---

## 34. Level Lines Exact-Price Origin Resolution Real-Data Validation v0.1

Отдельный offline validator повторно использовал сохранённые реальные `1m` candles из `causal-setup-real-data-validation-v0.1` и дважды проиграл каждый causal prefix через production Level Lines. На `4 995` свечах и `4 905 + 4 905` replay steps получено `40` уникальных decisions (`31` active reuse, `9` worked rearm), `0` residual collisions, `0` restart mismatches и `0` violations. Полная History сохранена, restart/replay equivalence подтверждена; trading rules не изменены и future candles не использованы. Статус — `validated_with_observed_resolution`. Подробный контракт: `NEXUS_LEVEL_LINES_EXACT_PRICE_ORIGIN_RESOLUTION_REAL_DATA_VALIDATION_v0.1.md`.

---

## 35. Persistent Setup Event History Foundation v0.1

PR #180 объединил restart-safe persistent Setup lifecycle History. Versioned atomic JSON snapshot сохраняет bounded ordered events, candidate/episode identity и terminal outcomes; hydration выполняется до live subscription. Process-local runtime `eventId` не является restart identity: History назначает собственный monotonic id и semantic dedupe. Corrupt/unsupported storage не перезаписывается, persistence failure переводит storage diagnostics в degraded mode без остановки Setup runtime. Подробный контракт: `NEXUS_PERSISTENT_SETUP_EVENT_HISTORY_FOUNDATION_v0.1.md`.

---

## 36. Market History Runtime Integration v0.1

PR #181 завершил Market History Runtime Integration v0.1.

Production `/app/market-history` использует persistent Setup lifecycle History и показывает factual candidate/episode lifecycle, level, identity и event timeline data. Factual terminal lifecycle сохраняется отдельно от profitability semantics.

Market History не синтезирует:

- PnL;
- success/failure;
- profitability;
- `maxMovePct`;
- adverse move;
- time-to-target;
- historical candles, tape или order book, которых не было сохранено.

Replay реализован отдельным последующим этапом в PR #182.

---
## 37. Setup Outcome Dataset / Validation v0.1

PR #183 завершил Setup Outcome Dataset / Validation v0.1.

Отдельный offline validation layer измеряет фактическое направление и величину движения рынка после production Setup Engine `THIRD_TOUCH_CONFIRMED` anchor.

Контракт:

- источник identity/lifecycle — Persistent Setup Event History;
- источник post-event цен — реальные закрытые Binance USD-M Futures `1m` candles;
- anchor minute исключается для предотвращения pre-anchor high/low contamination;
- считаются direction-aware MFE и MAE;
- фиксируются signed returns на 5m / 15m / 30m / 60m;
- terminal lifecycle сохраняется как отдельный factual факт и не преобразуется автоматически в trading-quality label.

Первый factual fully measured case появился для `SOLUSDT`, `1m`, `level_bounce`, `short`.

После появления первой measured sample Outcome Dataset перешёл в factual `sample_available`; это не означает достаточность выборки.

v0.1 не создаёт:

- `successful` / `failed`;
- win/loss;
- profitability;
- PnL;
- execution assumptions;
- stop/take-profit;
- ranking changes;
- training;
- Self-Learning.

Подробный контракт:

`NEXUS_SETUP_OUTCOME_DATASET_VALIDATION_v0.1.md`.

---

## 38. Setup Outcome Sample Sufficiency v0.1

Статус: `COMPLETED`.

PR #184 merged в `main`.

Факты:

- feature commit: `d72f2125a796db31d35712cfec290ea4bc5eeeac`;
- merge commit: `d4aa844895aeadc95c975a053b0a82930186d34f`;
- Backend/Frontend PR CI — `success`;
- Backend/Frontend post-merge `main` CI — `success`;
- validated backup patch SHA-256:
  `4dbcfd1856b4291e985ac6766aea846f4fefe7922d8af1e98e872f0d858e377a`.

Минимальная factual readiness sample v0.1:

- не менее `100` eligible measured candidates всего;
- не менее `25` `level_breakout:long`;
- не менее `25` `level_breakout:short`;
- не менее `25` `level_bounce:long`;
- не менее `25` `level_bounce:short`.

Eligibility:

- `measurementStatus = measured`;
- complete retained lifecycle history;
- outcome metrics присутствуют.

Это governance/data-readiness threshold для допуска к отдельному исследованию возможных label rules. Он не является утверждением statistical power, profitability или production trading quality.

Sufficiency блокируется при unresolved data-integrity problems:

- history snapshot inconsistency;
- dropped history events;
- multiple terminal events;
- insufficient candle coverage;
- market-history errors;
- measured-count mismatch;
- incomplete measured history;
- measured candidate without metrics;
- source safety-contract violation.

`pending_window` не блокирует уже завершённую measured sample.

Factual `missing_third_touch_anchor` сам по себе не является trading-quality failure и может быть корректным результатом expiry до factual third touch.

Фактическое состояние на validation sample:

- source Outcome status: `sample_available`;
- eligible measured candidates: `1 / 100`;
- `level_breakout:long`: `0 / 25`;
- `level_breakout:short`: `0 / 25`;
- `level_bounce:long`: `0 / 25`;
- `level_bounce:short`: `1 / 25`;
- data-integrity blockers: `0`;
- `labelRuleResearchEligible = false`.

Даже после достижения gate:

- profitability labels не применяются автоматически;
- trading rules не меняются автоматически;
- ranking не меняется автоматически;
- training не запускается автоматически;
- Self-Learning не запускается автоматически.

Следующий этап label-rule research разрешён только после factual статуса:

`sufficient_for_next_research_stage`

и остаётся отдельной задачей с явным решением пользователя.

Подробный контракт:

`NEXUS_SETUP_OUTCOME_SAMPLE_SUFFICIENCY_v0.1.md`.

---

## 39. Futures Mark Price + Funding Rate Runtime Foundation v0.1

Статус: `IMPLEMENTED_AND_LOCALLY_VALIDATED`.

Раздел официальной дорожной карты:

`Stage 3 — Futures Market Metrics`. Open Interest Runtime Foundation v0.1 локально реализован и валидирован; ликвидации остаются впереди.

Реализовано:

- factual Binance USDⓈ-M Futures `<symbol>@markPrice@1s`;
- Mark Price;
- Index Price;
- Funding Rate в процентах через `fundingRatePct`;
- Next Funding Time;
- `RealtimeMarkPrice` внутри существующего `RealtimeSymbolSnapshot`;
- существующие snapshot HTTP/SSE contracts переиспользованы;
- новый endpoint не создавался;
- generic realtime runtime теперь использует `3` streams на symbol вместо `2`;
- dynamic subscriptions включают Mark Price stream.

Локальная validation:

- focused WebSocket tests: `9/9 PASSED`;
- backend typecheck: `PASSED`;
- полный backend check: `PASSED`;
- production backend build: `PASSED`;
- `git diff --check`: `PASSED`.

Границы v0.1:

- Open Interest не реализуется;
- ликвидации не реализуются;
- Setup Engine не изменён;
- trading rules не изменены;
- ranking не изменён;
- profitability labels не применяются;
- training не запускается;
- Self-Learning не запускается.

Factual Setup Outcome collection продолжает работать независимо и не была перезапущена ради этой feature.

Stage 3 остаётся частично завершённым.

Следующие отдельные derivatives-metrics задачи:

1. Open Interest;
2. ликвидации.

Подробный контракт:

`NEXUS_FUTURES_MARK_PRICE_FUNDING_RATE_RUNTIME_v0.1.md`.

Commit, PR, merge и CI должны подтверждаться отдельно после их фактического выполнения.
---

## 40. Futures Open Interest Runtime Foundation v0.1

Статус: `IMPLEMENTED_AND_LOCALLY_VALIDATED`.

Раздел официальной дорожной карты:

`Stage 3 — Futures Market Metrics`.

Реализовано:

- factual current Binance USDⓈ-M Futures Open Interest;
- официальный REST source `GET /fapi/v1/openInterest`;
- отдельный `RealtimeOpenInterest`;
- current OI хранится в существующем market-wide symbol state;
- OI доступен через `MarketScannerMetrics`;
- stale OI не заменяет более свежий observation;
- symbol universe переиспользуется из существующего `MarketWideRuntimeCoordinator`;
- отдельный OI universe не создаётся;
- bounded concurrency;
- overlapping OI sweeps запрещены;
- следующий sweep запускается только после завершения предыдущего;
- production interval по умолчанию `60_000 ms`;
- max concurrency по умолчанию `4`;
- OI lifecycle управляется существующим Market Wide coordinator;
- Open Interest не добавляет WebSocket stream.

Локальная validation:

- focused OI tests: `PASSED`;
- Market Wide Runtime Coordinator tests: `PASSED`;
- Market Wide regression: `PASSED`;
- backend typecheck: `PASSED`;
- полный backend check: `PASSED`;
- production backend build: `PASSED`;
- backend audit high+: `PASSED`;
- real Binance OI smoke: `PASSED`;
- `git diff --check`: `PASSED`.

Границы v0.1:

- historical Open Interest Statistics не реализуются;
- OI delta/change analytics не реализуются;
- ликвидации не реализуются;
- Setup Engine не изменён;
- trading rules не изменены;
- ranking не изменён;
- profitability labels не применяются;
- training не запускается;
- Self-Learning не запускается.

Factual Setup Outcome collection продолжает работать независимо и не была перезапущена ради этой feature.

Stage 3 остаётся частично завершённым.

Следующая отдельная derivatives-metrics задача:

`Liquidations Runtime Foundation v0.1`.

Подробный контракт:

`NEXUS_FUTURES_OPEN_INTEREST_RUNTIME_v0.1.md`.

Commit, PR, merge и CI должны подтверждаться отдельно после их фактического выполнения.
