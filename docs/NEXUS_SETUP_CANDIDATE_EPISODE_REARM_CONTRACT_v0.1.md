# NEXUS Setup Candidate Episode Rearm Contract v0.1

**Статус:** реализован и защищён regression-тестами
**Дата:** 2026-08-16
**Ветка:** `backend-setup-candidate-episode-rearm-contract-v0-1`
**База:** `c63025e5082a442e81f227b9efcc20c4a8880de3`

## 1. Причина изменения

До этого causal Setup candidate имел стабильный ID только из `line.id + setupType`. После первого emission этот ID навсегда оставался в process-lifetime duplicate set. Если candidate завершался как `SETUP_EXPIRED`, последующие causal updates для того же ID игнорировались terminal runtime, даже когда цена позднее формировала новое независимое взаимодействие с тем же уровнем.

Reachability Diagnostics подтвердил следствие на сохранённой live cohort: causal `APPROACH` был фактически достигнут у `28/36` candidates, но все `36` впервые наблюдались в выбранном bounded window уже как retained expired records. Это не требовало изменения Observation/Approach/Confirmation thresholds; требовалась явная identity отдельного взаимодействия.

## 2. Граница episode

Setup episode начинается на закрытой свече, которая выполняет новый causal переход:

```text
progress < 0.50  ->  progress >= 0.50
```

`progress` остаётся существующим значением `|P - E| / |L - E|`. Порог `0.50` не изменён.

- Пока `progress >= 0.50` непрерывно, повторные scans относятся к одному episode.
- Истечение candidate внутри непрерывного episode не создаёт новый candidate.
- После выхода `progress < 0.50` активная граница сбрасывается.
- Новый вход `progress >= 0.50` создаёт новый episode и допускает новый candidate.
- Граница вычисляется только из уже закрытых свечей, без будущих данных.

## 3. Identity contract

Каждый causal candidate получает `episode` версии `setup-candidate-episode-v0.1`:

- `lineId` — стабильный ID causal Level Line;
- `setupType` — `bounce` или `breakout`;
- `startedAt` — время закрытой свечи нового threshold re-entry;
- `departureExtremumObservedAt` — causal anchor текущего пути;
- `boundary` — `observation_threshold_reentry`;
- `restartDeterministic: true`;
- `usesFutureCandles: false`.

Candidate ID имеет форму:

```text
setup-${line.id}-${setupType}-episode-${startedAtMs}
```

`createdAt` и expiry выводятся из `episode.startedAt`, поэтому один и тот же causal prefix после restart даёт тот же ID, `createdAt` и expiry.

## 4. Rearm и защита runtime

- Duplicate suppression действует внутри одного episode, потому что его ID неизменен.
- Новый causal episode имеет новый ID и не блокируется предыдущим terminal candidate.
- Предыдущий `SETUP_EXPIRED` record остаётся в runtime/history и не переписывается.
- Каждый causal update содержит `episodeId`.
- Runtime применяет update только если `candidate.episode.id === update.episodeId`.
- Update старого episode не может изменить candidate нового episode.
- Legacy non-causal factory candidates остаются совместимыми: поле `episode` для общего Setup contract опционально, но causal adapter всегда его заполняет.

## 5. Проверенные сценарии

Focused regression покрывает:

1. детерминированное определение начала Observation episode;
2. отсутствие rearm при повторном scan внутри episode;
3. сброс после выхода ниже Observation threshold;
4. новый ID после threshold re-entry;
5. одинаковый ID и `createdAt` после restart/replay;
6. совместный путь create → causal Approach → expiry → новый episode → новый candidate;
7. сохранение terminal history первого candidate;
8. совместимость Setup Engine и Unified Decision contracts.

Локальный результат реализации:

- focused regression: `46/46` passed;
- все backend test files: `708/708` passed;
- все frontend test files после обязательной test-компиляции: `280/280` passed;
- backend/frontend TypeScript typecheck: passed;
- backend/frontend production builds: passed.

## 6. Неизменённые границы

Изменение не:

- меняет Observation threshold `progress >= 0.50`;
- меняет Approach или Realtime Confirmation thresholds;
- меняет bounce/breakout classification;
- меняет ranking или выбор causal Level Line;
- меняет Unified Decision mapping или market-context rules;
- создаёт торговый приказ, сигнал или score;
- использует будущие свечи;
- удаляет terminal history предыдущих episodes.

## 7. Следующая проверка

Следующая отдельная задача — **NEXUS Setup Candidate Episode Real-Data Validation v0.1**. Она должна прогнать versioned real-data replay через production path, измерить число episode boundaries/rearms, проверить restart equivalence и подтвердить отсутствие candidate churn без изменения production thresholds.
