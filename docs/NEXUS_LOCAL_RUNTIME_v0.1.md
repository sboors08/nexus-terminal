# NEXUS Local Runtime v0.1

## Назначение

Local Runtime запускает frontend и backend NEXUS через Docker Compose.

- frontend собирается как production SPA;
- Nginx обслуживает интерфейс и проксирует /api/* в backend;
- backend работает отдельным контейнером;
- feedback сохраняется в постоянном Docker volume.

## Требования

- Windows с WSL 2;
- Docker Desktop;
- Docker Compose v2;
- доступ к Binance REST и WebSocket.

## Запуск

Открой PowerShell в корне репозитория:

C:\scriner\nexus-terminal-git

Выполни команду:

docker compose up --build --detach

## Адреса

- Frontend: http://localhost:8080
- Backend API напрямую: http://localhost:14100
- Health: http://localhost:8080/api/v1/health
- Readiness: http://localhost:8080/api/v1/ready

## Проверка состояния

Выполни:

docker compose ps

Оба сервиса должны иметь статус healthy.

## Остановка

Остановить и удалить контейнеры и сеть:

docker compose down

Feedback-данные при этом сохраняются.

## Повторный запуск

docker compose up --detach

## Полная пересборка

docker compose up --build --detach

## Просмотр логов

Все сервисы:

docker compose logs --follow

Только backend:

docker compose logs --follow backend

Только frontend:

docker compose logs --follow frontend

## Хранение feedback

Backend сохраняет feedback внутри контейнера по пути:

/data/feedback.jsonl

Данные находятся в Docker volume:

nexus-terminal-git_feedback_data

Обычная команда docker compose down не удаляет эти данные.

Полное удаление контейнеров вместе с feedback-данными:

docker compose down --volumes

Внимание: эта команда необратимо удаляет локальный feedback.
