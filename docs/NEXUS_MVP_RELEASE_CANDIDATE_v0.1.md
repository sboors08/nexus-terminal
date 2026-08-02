# NEXUS MVP Release Candidate v0.1

## Назначение

Документ фиксирует техническое состояние первой проверяемой версии NEXUS MVP. Release Candidate ещё не означает готовность к публичному коммерческому запуску.

## Проверенное состояние

- Backend: 330/330 тестов.
- Frontend: 233/233 тестов.
- Typecheck и production build: PASS.
- Backend dependency audit: 0 vulnerabilities.
- Frontend dependency audit: 0 vulnerabilities.
- Production SEO origin: PASS.
- Feedback API и JSONL persistence: PASS.

## Требования

- Node.js 22.22.0 или новее.
- npm 10 или новее.
- HTTPS для публичного окружения.
- Доступ backend к Binance REST и WebSocket.
- Постоянное хранилище для feedback JSONL.
- Reverse proxy для маршрутов `/api/*`.

## Production-топология

Frontend обслуживается как SPA из `frontend/dist`. Маршруты `/api/*` проксируются в backend на порт 4100. Backend подключается к Binance REST и WebSocket. Feedback JSONL хранится на постоянном диске.

Frontend использует относительные маршруты `/api/v1/*`, поэтому текущая production-схема предполагает единый origin для frontend и API.

## Backend environment

Минимальные production-значения:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=4100
API_PREFIX=/api/v1
CORS_ORIGIN=https://nexus.example
LOG_LEVEL=info
FEEDBACK_STORE_PATH=/data/feedback.jsonl
```

Полный перечень Binance-настроек находится в `backend/.env.example`. `FEEDBACK_STORE_PATH` должен указывать на каталог с постоянным хранением и правом записи. JSONL-хранилище рассчитано на один экземпляр backend.

## Frontend environment

Перед production-сборкой создаётся `frontend/.env`:

```dotenv
VITE_PUBLIC_SITE_URL=https://nexus.example
NEXUS_PUBLIC_URL=https://nexus.example
VITE_APP_VERSION=0.1.0
```

Фактический домен должен заменить `nexus.example`. `NEXUS_PUBLIC_URL` используется генератором `robots.txt` и `sitemap.xml`.

## Команды проверки

Backend:

```bash
cd backend
npm ci
npm audit --audit-level=high
npm run check
npm run build
npm start
```

Frontend:

```bash
cd frontend
npm ci
npm audit --audit-level=high
npm run check
npm run build
```

## Health endpoints

- `GET /api/v1/health`
- `GET /api/v1/ready`

Оба endpoint должны возвращать успешный HTTP-ответ перед публикацией версии.

## Release smoke test

1. Frontend открывается по HTTPS.
2. Прямое открытие SPA-маршрутов работает.
3. Health и readiness успешны.
4. Market получает список Binance-символов.
5. Scanner получает metrics и setup candidates.
6. Workspace получает realtime-данные.
7. Общая обратная связь возвращает HTTP 202.
8. Оценка сетапа возвращает HTTP 202.
9. Обе записи появляются в persistent JSONL.
10. `robots.txt` и `sitemap.xml` содержат production domain.
11. Backend не находится в бесконечном reconnect loop.

## Известные ограничения

- Часть Dashboard остаётся fixture-данными.
- Alerts пока использует fixture-события.
- Market History пока использует fixture-архив.
- Replay пока использует детерминированные fixture-данные.
- Settings сохраняются локально в браузере.
- Заметки Workspace не сохраняются на backend.
- Нет production authentication и серверных пользовательских профилей.
- Нет общей базы данных и централизованного мониторинга.
- Frontend build содержит неблокирующее предупреждение о размере chunk.

## Release gate

Release Candidate принимается только когда GitHub Actions, dependency audits, backend/frontend checks и builds успешны; production SEO не содержит localhost; health/readiness и feedback persistence подтверждены; fixture-разделы обозначены честно.

## Следующий этап

1. Выбрать hosting и публичный домен.
2. Добавить deployment-конфигурацию.
3. Настроить persistent storage, HTTPS, reverse proxy, логи и мониторинг.
4. Выполнить production smoke test.
5. Создать тег `v0.1.0-rc.1`.
