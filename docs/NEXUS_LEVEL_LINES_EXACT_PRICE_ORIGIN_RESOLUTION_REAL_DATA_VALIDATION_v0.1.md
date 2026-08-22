# NEXUS Level Lines Exact-Price Origin Resolution Real-Data Validation v0.1

## Для чего нужен этап

Production contract exact-price origin resolution уже разделяет два случая:

1. новая origin-точка по той же точной цене подтверждает ещё активную identity;
2. новая origin-точка появляется после того, как прежняя identity уже `worked`.

Unit/integration tests подтверждают правила на фиксированных сценариях. Этот этап доказал на сохранённых реальных свечах, что production path устраняет визуально одинаковые current levels, не удаляет History и воспроизводится одинаково после restart.

## Источник данных

- существующий versioned report `causal-setup-real-data-validation-v0.1`;
- сохранённые реальные Binance `1m` свечи;
- исходная cohort: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `AVAXUSDT`, `DOGEUSDT`;
- фактический объём исходной cohort: `4 995` закрытых свечей;
- новые Binance-запросы и синтетические observations не создаются.

Source SHA-256: `a405e18a19b18e905c230bec2efec1433d1d54b14499a84b61547073b775fcbf`.

## Метод

Для каждого symbol validator:

1. берёт только закрытые свечи;
2. причинно увеличивает prefix по одной свече;
3. запускает production `detectLevelLines` с исходными options;
4. читает production `exactPriceOriginResolution`;
5. собирает уникальные active-reuse и worked-rearm decisions;
6. проверяет полную History и residual current collisions;
7. повторяет весь replay независимо;
8. сравнивает fingerprint каждого causal prefix и итоговый dataset fingerprint.

## Критерии валидности

- `residualCurrentCollisionGroupCount = 0`;
- `restartReplayMismatchCount = 0`;
- `violationCount = 0`;
- `fullHistoryPreserved = true`;
- `restartReplayEquivalent = true`;
- suppressed identities остаются в полном `lines` History;
- каждая decision ограничена `symbol + timeframe + kind + exact price`;
- active identity reuse применяется только до `worked`;
- worked identity rearm применяется только после `worked`.

Предварительная classification cohort содержала `32` active reconfirmations и `10` worked rearms. Production causal replay не подменялся этими ожиданиями и фактически выявил `31` active identity reuse и `9` worked identity rearm decisions.

## Фактический результат

Полный запуск выполнен `2026-08-22T17:58:06.165Z`.

| Symbol | Закрытые свечи | Causal prefixes | Решения | Active reuse | Worked rearm | Residual collisions | Restart mismatches | Violations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `AVAXUSDT` | 999 | 981 | 14 | 12 | 2 | 0 | 0 | 0 |
| `BTCUSDT` | 999 | 981 | 2 | 2 | 0 | 0 | 0 | 0 |
| `DOGEUSDT` | 999 | 981 | 10 | 4 | 6 | 0 | 0 | 0 |
| `ETHUSDT` | 999 | 981 | 2 | 2 | 0 | 0 | 0 | 0 |
| `SOLUSDT` | 999 | 981 | 12 | 11 | 1 | 0 | 0 | 0 |
| **Итого** | **4 995** | **4 905** | **40** | **31** | **9** | **0** | **0** | **0** |

Каждый из `4 905` causal prefixes независимо проигран ещё раз в restart replay. `fullHistoryPreserved = true`, `restartReplayEquivalent = true`, `tradingRulesChanged = false`, `futureCandlesUsed = false`. Итоговый статус: `validated_with_observed_resolution`.

## Инварианты безопасности

- formula `lineId` не изменяется;
- pivot, touch, Departure, Observation, Approach и Confirmation rules не изменяются;
- близкие цены не объединяются;
- support и resistance не объединяются;
- исторические lines/episodes не удаляются;
- Setup, signal и trade order не создаются;
- обучение и ranking не применяются;
- future candles не используются.

## Запуск

```powershell
npm.cmd --prefix backend run test:level-lines-exact-price-origin-resolution-real-data-validation
npm.cmd --prefix backend run validate:level-lines-exact-price-origin-resolution-real-data
```

Основной отчёт:

```text
backend/.tmp/level-lines-exact-price-origin-resolution-real-data-validation/latest.json
```

Полная сохранённая cohort фактически проверена. Этап имеет статус `validated_with_observed_resolution`; окончательное закрытие ветки требует commit, PR и зелёного GitHub Actions CI.
