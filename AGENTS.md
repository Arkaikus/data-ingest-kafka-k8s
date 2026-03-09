# Agent Guidance

AI agents working on this codebase should follow these directions.

## Stack

- **Runtime**: Bun (all services)
- **Frontend**: React 19, vanilla CSS
- **Producer**: Hono REST API, KafkaJS, MongoDB, PapaParse
- **Consumer**: KafkaJS, MongoDB (no framework)
- **Infra**: Docker Compose (dev), Kubernetes (deploy), `just` for k8s ops

## Priorities

1. **Respect boundaries**: Producer does not write to `records`; Consumer does not expose HTTP. Frontend proxies `/api/*` to Producer.
2. **Reuse components**: Prefer existing React components and styles. Match `index.css` patterns (BEM-like, dark theme).
3. **Follow `.cursor/rules/`**: Architecture, file structure, backend/frontend patterns, and code style are defined there.

## Key Paths

| Concern | Location |
|---------|----------|
| API routes | `producer/src/routes/tasks.ts` |
| Kafka publish | `producer/src/kafka.ts` |
| Kafka consume | `consumer/src/index.ts` |
| Shared types | `frontend/src/types.ts` |
| Styles | `frontend/src/index.css` |
| K8s manifests | `k8s/*.yaml` |

## Commands

- **Local dev**: `docker compose up kafka mongodb -d` then `bun run dev` in `producer/`, `consumer/`, `frontend/`
- **K8s**: `just deploy`, `just watch`, `just logs-producer`, `just pf-frontend`
- **Build**: `just build-all`

## Conventions

- ESM only. Strict TypeScript.
- Env vars with defaults (e.g. `process.env.PORT \|\| 3001`).
- Graceful shutdown: disconnect Kafka/MongoDB on SIGTERM/SIGINT.
- Kafka message value: `{ task_id, row_index, total_rows, data }` (JSON).
