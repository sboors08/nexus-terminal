# Module boundaries

Backend v0.1 is a modular monolith. Each business module will keep four internal layers:

- `domain` — entities, value objects and pure rules;
- `application` — use cases and ports;
- `infrastructure` — Binance, PostgreSQL, Redis and external adapters;
- `presentation` — HTTP and WebSocket transport.

Planned modules, added one task at a time:

1. `market-data` — Binance stream ingestion and normalized market events;
2. `scanner` — levels, touches, setup stages and scoring;
3. `workspace` — candles, prints and liquidity snapshots;
4. `alerts` — rules, delivery and read state;
5. `history` — setup outcomes, replay and learning context;
6. `feedback` — product and setup ratings;
7. `identity` — authentication, users, roles and subscriptions;
8. `admin` — protected administration API and audit log.

Modules communicate through application interfaces or domain events. Direct imports from one module's infrastructure layer into another module are forbidden.
