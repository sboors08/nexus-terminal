# NEXUS Backend Foundation v0.1

Independent backend foundation for the NEXUS trading terminal. It is intentionally isolated inside `backend/`; no file in `frontend/` must be changed by this stage.

## Technology choice

- Node.js 22.22+
- TypeScript
- Fastify
- Node test runner
- Native Node `.env` loading

The first version is a **modular monolith**. This avoids premature microservices while preserving boundaries needed to extract heavy market-data or scanner workers later.

## Current structure

```text
backend/
├── scripts/verify-foundation.mjs
├── src/
│   ├── config/env.ts
│   ├── modules/
│   │   ├── health/health.routes.ts
│   │   ├── index.ts
│   │   └── README.md
│   ├── app.ts
│   └── server.ts
├── test/health.test.ts
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

## Commands

```bash
cd backend
npm install
npm run dev
```

Checks:

```bash
npm run check
npm run build
```

Default addresses:

- API root: `http://localhost:4100/`
- health: `http://localhost:4100/api/v1/health`
- readiness: `http://localhost:4100/api/v1/ready`

## Environment

Copy `.env.example` to `.env` when custom values are needed. Node 22 loads it through `--env-file-if-exists`, so no dotenv dependency is required.

`CORS_ORIGIN` accepts a comma-separated allowlist. The frontend development origin is allowed by default.

## Architectural rules

1. `frontend/` and `backend/` are independent applications.
2. Backend does not import implementation files from `frontend/`.
3. Public API is versioned under `/api/v1`.
4. Transport code stays outside business-domain logic.
5. Binance, PostgreSQL and Redis will be adapters, not domain dependencies.
6. No microservice split until load measurements justify it.
7. The frontend mock contract is not replaced in this task; API contract alignment is the next separate task.

## Next backend task

Define **NEXUS API Contract v0.1** from `frontend/src/shared/api/contracts.ts`, then expose the first real read-only market endpoint without connecting Binance yet.
