# data-ingest-kafka-k8s

Kubernetes project for **distributed CSV data ingestion** powered by Kafka, Bun, Hono, MongoDB, and React.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Kubernetes Cluster                    │
│                                                             │
│  ┌──────────┐   upload CSV   ┌──────────────┐              │
│  │ Frontend │ ─────────────► │   Producer   │              │
│  │  React   │ ◄─ task status─│  Hono/Bun    │              │
│  │  Bun.js  │                └──────┬───────┘              │
│  └──────────┘                       │ publish rows          │
│                                     ▼                       │
│                             ┌──────────────┐               │
│                             │    Kafka     │               │
│                             │  (KRaft)     │               │
│                             └──────┬───────┘               │
│                                    │ consume                │
│                                    ▼                       │
│                             ┌──────────────┐               │
│                             │   Consumer   │               │
│                             │    Bun.js    │               │
│                             └──────┬───────┘               │
│                                    │ insert records         │
│                                    ▼                        │
│                             ┌──────────────┐               │
│                             │   MongoDB    │               │
│                             └──────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### Components

| Component    | Tech                        | Port | Description                                      |
| ------------ | --------------------------- | ---- | ------------------------------------------------ |
| **frontend** | Bun + React 19              | 3000 | Task CRUD dashboard with live status polling     |
| **producer** | Bun + Hono                  | 3001 | REST API — accepts CSV, publishes rows to Kafka  |
| **consumer** | Bun                         | —    | Reads from Kafka, persists records to MongoDB    |
| **kafka**    | Bitnami Kafka 3.7 (KRaft)   | 9092 | Message broker                                   |
| **mongodb**  | MongoDB 7                   | 27017| Task metadata + ingested records storage         |

## Data Flow

1. **User** uploads a CSV file through the frontend dashboard.
2. **Frontend** sends a `POST /api/tasks` multipart request to the producer.
3. **Producer** creates a task document in MongoDB (`status: processing`) and publishes every CSV row as a Kafka message to the `data-ingest` topic.
4. **Consumer** reads each message, inserts the row into the `records` collection and increments `processed_rows` on the task document.
5. When `processed_rows == total_rows` the task is marked `completed`.
6. **Frontend** polls `/api/tasks` every 3 s and shows live progress.

## Quick Start (Docker Compose)

```bash
# Clone
git clone https://github.com/Arkaikus/data-ingest-kafka-k8s.git
cd data-ingest-kafka-k8s

# Start all services
docker compose up --build

# Open the dashboard
open http://localhost:3000
```

## Kubernetes Deployment

```bash
# Apply all manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/kafka.yaml
kubectl apply -f k8s/mongodb.yaml
kubectl apply -f k8s/producer.yaml
kubectl apply -f k8s/consumer.yaml
kubectl apply -f k8s/frontend.yaml

# Watch pods come up
kubectl get pods -n data-ingest -w
```

> Update the `image:` fields in the deployment manifests to point to your own container registry after building the images.

## Local Development

Each service can be run independently with Bun for a fast dev loop.

**Prerequisites:** Bun ≥ 1.x, a running Kafka broker and MongoDB instance (Docker Compose is the easiest way).

```bash
# 1. Start infrastructure only
docker compose up kafka mongodb -d

# 2. Producer (hot-reload)
cd producer && bun run dev     # http://localhost:3001

# 3. Consumer
cd consumer && bun run start

# 4. Frontend (hot-reload + HMR)
cd frontend && bun run dev     # http://localhost:3000
```

## Environment Variables

### Producer

| Variable        | Default                    | Description                    |
| --------------- | -------------------------- | ------------------------------ |
| `PORT`          | `3001`                     | HTTP port                      |
| `KAFKA_BROKERS` | `localhost:9092`           | Comma-separated broker list    |
| `KAFKA_TOPIC`   | `data-ingest`              | Kafka topic name               |
| `MONGO_URL`     | `mongodb://localhost:27017`| MongoDB connection string      |
| `DB_NAME`       | `data_ingest`              | Database name                  |

### Consumer

| Variable         | Default                    | Description                    |
| ---------------- | -------------------------- | ------------------------------ |
| `KAFKA_BROKERS`  | `localhost:9092`           | Comma-separated broker list    |
| `KAFKA_TOPIC`    | `data-ingest`              | Kafka topic to subscribe to    |
| `KAFKA_GROUP_ID` | `data-ingest-consumer`     | Consumer group ID              |
| `MONGO_URL`      | `mongodb://localhost:27017`| MongoDB connection string      |
| `DB_NAME`        | `data_ingest`              | Database name                  |

### Frontend

| Variable        | Default                    | Description                             |
| --------------- | -------------------------- | --------------------------------------- |
| `PORT`          | `3000`                     | HTTP port                               |
| `PRODUCER_URL`  | `http://localhost:3001`    | URL of the producer service (server-side proxy) |

## API Reference (Producer)

| Method   | Path            | Description                          |
| -------- | --------------- | ------------------------------------ |
| `GET`    | `/health`       | Liveness check                       |
| `GET`    | `/api/tasks`    | List all tasks (newest first)        |
| `GET`    | `/api/tasks/:id`| Get a single task                    |
| `POST`   | `/api/tasks`    | Create task — `multipart/form-data` with `file` (CSV) and optional `name` |
| `DELETE` | `/api/tasks/:id`| Delete a task                        |

## MongoDB Collections

| Collection | Description                                        |
| ---------- | -------------------------------------------------- |
| `tasks`    | Import task metadata and status                    |
| `records`  | Individual rows ingested from uploaded CSV files   |

## Project Structure

```
.
├── frontend/          # Bun + React 19 dashboard
│   ├── src/
│   │   ├── index.ts            # Bun server (SPA + /api proxy)
│   │   ├── index.html
│   │   ├── frontend.tsx        # React entry-point
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── types.ts
│   │   └── components/
│   │       ├── TaskForm.tsx
│   │       ├── TaskList.tsx
│   │       └── TaskItem.tsx
│   └── Dockerfile
├── producer/          # Hono REST API + Kafka publisher
│   ├── src/
│   │   ├── index.ts
│   │   ├── db.ts
│   │   ├── kafka.ts
│   │   └── routes/tasks.ts
│   └── Dockerfile
├── consumer/          # Kafka consumer → MongoDB
│   ├── src/index.ts
│   └── Dockerfile
├── k8s/               # Kubernetes manifests
│   ├── namespace.yaml
│   ├── kafka.yaml
│   ├── mongodb.yaml
│   ├── producer.yaml
│   ├── consumer.yaml
│   └── frontend.yaml
└── docker-compose.yml
```

