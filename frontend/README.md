# NEXUS Terminal — Frontend foundation

Каркас веб-приложения NEXUS Terminal. На этом этапе функциональность экранов не реализована: подключены только оболочка, маршруты, базовые стили и дизайн-токены.

## Стек

- React 19 + TypeScript
- Vite 8
- React Router 8, declarative mode
- CSS Modules для компонентов
- CSS Custom Properties для дизайн-токенов
- Локально подключённый variable-шрифт Inter

## Требования

- Node.js 22.22+
- npm 10+

## Запуск

```bash
npm install
npm run dev
```

## Проверки

```bash
npm run verify:foundation
npm run typecheck
npm run build
```

## Маршруты

| Экран | URL |
|---|---|
| Dashboard | `/` |
| Scanner | `/scanner` |
| Workspace | `/workspace` |
| Alerts | `/alerts` |
| Market History | `/market-history` |
| Replay | `/replay` |
| Settings | `/settings` |

`/dashboard` перенаправляется на `/`. Watchlist пока не добавлен в основную навигацию согласно Design Handoff v1.

## Дизайн-токены

Главный файл: `src/styles/tokens.css`.

В нём зафиксированы:

- тёмные поверхности и тонкие границы;
- Inter как основной шрифт;
- базовая сетка 8 px;
- радиусы 8–12 px;
- LONG и SHORT;
- стадии: наблюдение, подход, подтверждение, пробой/отскок;
- информационный синий;
- базовые размеры оболочки и анимации.

## Ограничение этапа

`DashboardPage` является только маршрутной заглушкой. Реальные блоки Dashboard не должны добавляться до завершения и проверки frontend foundation.
