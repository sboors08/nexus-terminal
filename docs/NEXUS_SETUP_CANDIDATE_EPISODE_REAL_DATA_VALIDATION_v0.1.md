# NEXUS Setup Candidate Episode Real-Data Validation v0.1

**Статус:** validated with observed rearms
**Дата результата:** 2026-08-21
**Ветка:** `backend-setup-candidate-episode-real-data-validation-v0-1`
**База:** `0bd52c38b97cb0b1bc830c6a5f3f6ae5e4109efb`
**Источник:** сохранённый Causal Setup Real-Data Validation report
**SHA256 источника:** `a405e18a19b18e905c230bec2efec1433d1d54b14499a84b61547073b775fcbf`

## 1. Цель

Проверить episode-aware contract из PR #171 на сохранённых реальных Binance USDⓈ-M Futures свечах без повторной загрузки данных и без изменения production thresholds.

Валидация должна была доказать, что:

- новый candidate появляется после фактического выхода ниже Observation threshold и нового causal re-entry;
- повторные scans внутри одного непрерывного episode подавляются;
- candidate ID, `createdAt`, expiry и causal snapshots воспроизводятся после restart;
- новый contract устраняет permanent duplicate cutoff;
- replay не использует будущие свечи и не создаёт synthetic market evidence.

## 2. Источник и метод

Использованы пять сохранённых реальных `1m` datasets:

- `BTCUSDT`;
- `ETHUSDT`;
- `SOLUSDT`;
- `AVAXUSDT`;
- `DOGEUSDT`.

Исходный файл содержал по `1 000` свечей на символ. Последняя незакрытая свеча каждого dataset причинно исключена, поэтому валидатор обработал `4 995` закрытых свечей: по `999` на символ.

Каждый dataset дважды последовательно воспроизведён через production Observation → causal Setup path:

1. baseline replay;
2. fresh restart replay.

Сравнение выполнялось по candidate identity, episode contract, causal snapshots, `createdAt`, expiry и итоговому набору candidates.

## 3. Фактический результат

| Символ | Закрытые свечи | Старые candidate tracks | Episode candidates | Пары line + setup | Rearmed pairs | Rearms | Suppressions | Restart mismatches | Violations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| AVAXUSDT | 999 | 140 | 428 | 140 | 78 | 288 | 2 190 | 0 | 0 |
| BTCUSDT | 999 | 84 | 262 | 84 | 62 | 178 | 1 740 | 0 | 0 |
| DOGEUSDT | 999 | 152 | 526 | 152 | 104 | 374 | 2 438 | 0 | 0 |
| ETHUSDT | 999 | 92 | 306 | 92 | 70 | 214 | 1 086 | 0 | 0 |
| SOLUSDT | 999 | 154 | 580 | 154 | 116 | 426 | 2 548 | 0 | 0 |
| **Итого** | **4 995** | **622** | **2 102** | **622** | **430** | **1 480** | **10 002** | **0** | **0** |

Report status: `validated_with_observed_rearms`.

Дополнительные итоги:

- `permanentDuplicateCutoffEliminated: true`;
- `sameEpisodeChurnDetected: false`;
- `restartEquivalent: true`;
- `changesTradingRules: false`.

## 4. Интерпретация

Разница между новым и старым contract равна точному числу rearm:

```text
2 102 episode candidates - 622 исходные пары = 1 480 rearms
```

Это означает, что новый contract не создал дополнительные случайные пары level/setup. Он сохранил те же `622` пары `lineId + setupType` и добавил только отдельные причинные episodes после выхода и повторного входа.

`10 002` duplicate suppression observations подтверждают, что повторные scans внутри одного episode не создавали новые candidates. Нулевые restart mismatches подтверждают детерминированность identity и snapshots. Нулевые violations подтверждают соблюдение проверяемых causal и safety-инвариантов.

## 5. Найденная продуктовая граница

Runtime сохраняет предыдущие episodes в истории, как и требует contract. Если пользовательский Scanner выводит все сохранённые episodes одной пары как самостоятельные текущие карточки, они визуально выглядят как дубли: одинаковые symbol, setup type, level и stage, хотя их `episodeId` различается.

Это не same-episode duplicate и не основание откатывать PR #171. Для пользовательского списка требуется отдельная current-episode projection:

- для каждой пары `symbol + lineId + setupType` показывать только последний актуальный episode;
- не объединять независимые соседние `lineId`, даже если округлённая цена совпадает;
- предыдущие episodes сохранять в History/detail;
- не менять Observation, Approach, Confirmation или outcome rules.

Эта projection не входит в текущую validation-ветку и должна быть отдельной production-задачей.

## 6. Проверки реализации

- focused validation tests: `25/25` passed;
- полный backend test run: `733/733` passed в подготовительном окружении;
- backend typecheck: passed;
- backend production build: passed;
- real-data restart mismatches: `0`;
- invariant violations: `0`.

## 7. Неизменённые границы

Валидация не:

- меняет Observation threshold `progress >= 0.50`;
- меняет Approach или Realtime Confirmation thresholds;
- меняет breakout/bounce classification;
- меняет Unified Decision, ranking или market-context rules;
- создаёт торговый приказ или сигнал;
- загружает новые рыночные данные;
- создаёт synthetic observations;
- удаляет terminal history предыдущих episodes.

## 8. Следующий шаг

Следующая отдельная задача — **NEXUS Setup Candidate Current-Episode Projection v0.1**. Она должна убрать визуальное размножение старых episodes из текущего Scanner/read API, сохранив полную историю и независимость реальных Level Lines.
