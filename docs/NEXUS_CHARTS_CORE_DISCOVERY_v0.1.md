# NEXUS Charts Core Discovery v0.1

Статус: завершено
Ветка: `feature-charts-core-discovery-v0-1`

## Цель

Зафиксировать техническую основу единого графического модуля для Market, Workspace, Dashboard, Scanner, History и Replay.

## Текущее состояние

Во frontend нет общей библиотеки графиков. Market, Workspace и остальные экраны используют отдельные SVG-реализации с фиксированными координатами.

Они не дают полноценные crosshair, zoom, scroll, responsive resize и догрузку истории.

Market получает 56 синтетических свечей через `nexusMockApi`.

Workspace строит линию из готового `chartPath`; смена таймфрейма меняет URL, но не загружает новые свечи.

## Готовый backend

Реальные Binance USDⓈ-M Futures свечи уже доступны:

`GET /api/v1/market/candles?symbol=BTCUSDT&timeframe=5m`

Ответ содержит до 200 свечей:

- `openTime`, `closeTime`;
- `open`, `high`, `low`, `close`;
- `volume`;
- `tradesCount`.

Backend принимает:

`1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `6h`, `8h`, `12h`, `1d`.

Market сейчас использует `24h`. Каноническое значение нужно заменить на `1d`.

## Realtime

Пользовательский SSE:

`GET /api/v1/market/realtime/stream`

передаёт только:

- `status`;
- `snapshot`.

Snapshot содержит last trade, bid/ask и recent trades, но не OHLCV.

Backend получает `@kline_1m` во внутреннем market-wide сервисе, однако эти свечи не выдаются текущему frontend-клиенту.

Решение:

- историю подключить сейчас через HTTP;
- realtime-свечу позже добавить отдельным backend-событием;
- не агрегировать свечи во frontend из сделок из-за reconnect, пропусков и повторов.

## Выбор библиотеки

Использовать `lightweight-charts` версии `5.2.x`.

Причины:

- финансовые свечи;
- histogram volume;
- price scale и time scale;
- crosshair;
- zoom и scroll;
- realtime update;
- несколько панелей;
- плагины и расширения;
- TypeScript;
- Apache-2.0.

Нужно выполнить требование `NOTICE`: показать пользовательскую атрибуцию TradingView со ссылкой.

## Целевая структура

- `frontend/src/shared/charts/index.ts`
- `frontend/src/shared/charts/api/marketCandles.ts`
- `frontend/src/shared/charts/hooks/useMarketCandles.ts`
- `frontend/src/shared/charts/model/chartTypes.ts`
- `frontend/src/shared/charts/model/candleMapping.ts`
- `frontend/src/shared/charts/ui/NexusCandlestickChart.tsx`
- `frontend/src/shared/charts/ui/NexusCandlestickChart.module.css`

## Следующая задача

**Charts Core Foundation + Market Integration v0.1**

Входит:

- установка `lightweight-charts`;
- строгий HTTP-клиент `/api/v1/market/candles`;
- переиспользуемый React-компонент;
- реальные 200 свечей в Market;
- candlestick и volume;
- crosshair, zoom, scroll;
- responsive resize;
- таймфреймы `1m`, `5m`, `15m`, `1h`, `4h`, `1d`;
- loading, error, empty и retry;
- tests, verify, check, build и ручная проверка.

Не входит:

- realtime OHLCV;
- история старше 200 свечей;
- S/R и setup overlays;
- перенос Workspace;
- History и Replay.

После Foundation отдельными задачами идут realtime kline contract, Workspace overlays, затем остальные экраны.
