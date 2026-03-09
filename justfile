# ──────────────────────────────────────────────────────────────────────────────
# data-ingest-kafka-k8s · justfile
#
# Prerequisites: kubectl, just (https://github.com/casey/just)
# Optional:      kubectx/kubens, stern (multi-pod log tailing)
#
# Usage:
#   just            → list all available recipes
#   just deploy     → deploy the full stack
#   just status     → show all resource status
# ──────────────────────────────────────────────────────────────────────────────

# Namespace used by all k8s resources
ns := "data-ingest"

# Local image tag prefix (override with `just registry=myrepo/data-ingest build-all`)
registry := "data-ingest"

# ── Default: list recipes ──────────────────────────────────────────────────────
default:
    @just --list

# ══════════════════════════════════════════════════════════════════════════════
# DEPLOY / TEARDOWN
# ══════════════════════════════════════════════════════════════════════════════

# Deploy the full stack (applies manifests in dependency order)
deploy:
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/kafka.yaml
    kubectl apply -f k8s/mongodb.yaml
    kubectl apply -f k8s/producer.yaml
    kubectl apply -f k8s/consumer.yaml
    kubectl apply -f k8s/frontend.yaml
    @echo "✅ Full stack deployed to namespace '{{ns}}'"

# Apply a single manifest file (usage: just apply k8s/producer.yaml)
apply file:
    kubectl apply -f {{file}}

# Delete all application resources but keep the namespace
delete-app:
    kubectl delete -f k8s/frontend.yaml  --ignore-not-found
    kubectl delete -f k8s/consumer.yaml  --ignore-not-found
    kubectl delete -f k8s/producer.yaml  --ignore-not-found
    kubectl delete -f k8s/mongodb.yaml   --ignore-not-found
    kubectl delete -f k8s/kafka.yaml     --ignore-not-found
    @echo "🗑  Application resources removed from '{{ns}}'"

# Tear down everything, including the namespace (DESTRUCTIVE – all data lost)
teardown:
    kubectl delete -f k8s/ --ignore-not-found
    kubectl delete namespace {{ns}} --ignore-not-found
    @echo "🗑  Namespace '{{ns}}' and all resources deleted"

# Restart all deployments (rolling restart — useful after config changes)
restart:
    kubectl rollout restart deployment/frontend  -n {{ns}}
    kubectl rollout restart deployment/producer  -n {{ns}}
    kubectl rollout restart deployment/consumer  -n {{ns}}

# Restart a single deployment (usage: just restart-one producer)
restart-one name:
    kubectl rollout restart deployment/{{name}} -n {{ns}}

# ══════════════════════════════════════════════════════════════════════════════
# STATUS & HEALTH
# ══════════════════════════════════════════════════════════════════════════════

# Show all resources in the namespace
status:
    @echo "\n─── Pods ───────────────────────────────────────"
    kubectl get pods        -n {{ns}} -o wide
    @echo "\n─── Deployments ────────────────────────────────"
    kubectl get deployments -n {{ns}}
    @echo "\n─── StatefulSets ───────────────────────────────"
    kubectl get statefulsets -n {{ns}}
    @echo "\n─── Services ───────────────────────────────────"
    kubectl get services    -n {{ns}}
    @echo "\n─── Ingresses ──────────────────────────────────"
    kubectl get ingress      -n {{ns}}
    @echo "\n─── PersistentVolumeClaims ─────────────────────"
    kubectl get pvc          -n {{ns}}

# Watch pod status (live update)
watch:
    kubectl get pods -n {{ns}} -w

# Show rollout status for all deployments
rollout-status:
    kubectl rollout status deployment/frontend -n {{ns}}
    kubectl rollout status deployment/producer -n {{ns}}
    kubectl rollout status deployment/consumer -n {{ns}}

# Describe a resource (usage: just describe pod/frontend-xxxx)
describe resource:
    kubectl describe {{resource}} -n {{ns}}

# Get events sorted by time (useful for debugging)
events:
    kubectl get events -n {{ns}} --sort-by='.lastTimestamp'

# ══════════════════════════════════════════════════════════════════════════════
# LOGS
# ══════════════════════════════════════════════════════════════════════════════

# Tail logs for ALL pods in the namespace (requires `stern`)
logs-all:
    stern . -n {{ns}}

# Tail frontend logs
logs-frontend:
    kubectl logs -n {{ns}} -l app=frontend --all-containers --follow

# Tail producer logs
logs-producer:
    kubectl logs -n {{ns}} -l app=producer --all-containers --follow

# Tail consumer logs
logs-consumer:
    kubectl logs -n {{ns}} -l app=consumer --all-containers --follow

# Tail kafka logs
logs-kafka:
    kubectl logs -n {{ns}} -l app=kafka --all-containers --follow

# Tail mongodb logs
logs-mongodb:
    kubectl logs -n {{ns}} -l app=mongodb --all-containers --follow

# Tail logs for a specific pod (usage: just logs-pod producer-7d9f8b-xxxx)
logs-pod pod:
    kubectl logs -n {{ns}} {{pod}} --all-containers --follow

# Show last N lines of logs for a deployment (usage: just logs-tail producer 50)
logs-tail name lines="50":
    kubectl logs -n {{ns}} -l app={{name}} --all-containers --tail={{lines}}

# ══════════════════════════════════════════════════════════════════════════════
# PORT FORWARDING
# ══════════════════════════════════════════════════════════════════════════════

# Forward frontend to http://localhost:3000
pf-frontend:
    @echo "📡 Forwarding frontend → http://localhost:3000  (Ctrl-C to stop)"
    kubectl port-forward -n {{ns}} service/frontend 3000:80

# Forward producer API to http://localhost:3001
pf-producer:
    @echo "📡 Forwarding producer → http://localhost:3001  (Ctrl-C to stop)"
    kubectl port-forward -n {{ns}} service/producer 3001:3001

# Forward Kafka broker to localhost:9092
pf-kafka:
    @echo "📡 Forwarding Kafka → localhost:9092  (Ctrl-C to stop)"
    kubectl port-forward -n {{ns}} service/kafka 9092:9092

# Forward MongoDB to localhost:27017
pf-mongodb:
    @echo "📡 Forwarding MongoDB → localhost:27017  (Ctrl-C to stop)"
    kubectl port-forward -n {{ns}} service/mongodb 27017:27017

# ══════════════════════════════════════════════════════════════════════════════
# SCALING
# ══════════════════════════════════════════════════════════════════════════════

# Scale a deployment (usage: just scale producer 3)
scale name replicas:
    kubectl scale deployment/{{name}} -n {{ns}} --replicas={{replicas}}
    @echo "⚖️  {{name}} scaled to {{replicas}} replica(s)"

# Scale producer
scale-producer replicas="2":
    just scale producer {{replicas}}

# Scale consumer (more replicas = more Kafka partitions consumed in parallel)
scale-consumer replicas="2":
    just scale consumer {{replicas}}

# Scale frontend
scale-frontend replicas="2":
    just scale frontend {{replicas}}

# ══════════════════════════════════════════════════════════════════════════════
# EXEC / DEBUG
# ══════════════════════════════════════════════════════════════════════════════

# Open a shell in a running producer pod
exec-producer:
    kubectl exec -n {{ns}} -it deployment/producer -- /bin/sh

# Open a shell in a running consumer pod
exec-consumer:
    kubectl exec -n {{ns}} -it deployment/consumer -- /bin/sh

# Open a shell in a running frontend pod
exec-frontend:
    kubectl exec -n {{ns}} -it deployment/frontend -- /bin/sh

# Open an interactive shell in a specific pod (usage: just exec-pod producer-7d9f8b-xxxx)
exec-pod pod:
    kubectl exec -n {{ns}} -it {{pod}} -- /bin/sh

# Run a one-off debug container with network tools in the namespace
debug:
    kubectl run debug-pod --rm -it --image=busybox --restart=Never -n {{ns}} -- /bin/sh

# ══════════════════════════════════════════════════════════════════════════════
# KAFKA OPERATIONS
# ══════════════════════════════════════════════════════════════════════════════

# List all Kafka topics
kafka-topics:
    kubectl exec -n {{ns}} -it kafka-0 -- \
        kafka-topics.sh --bootstrap-server localhost:9092 --list

# Describe the data-ingest topic
kafka-describe topic="data-ingest":
    kubectl exec -n {{ns}} -it kafka-0 -- \
        kafka-topics.sh --bootstrap-server localhost:9092 \
        --describe --topic {{topic}}

# Create a topic (usage: just kafka-create-topic my-topic 3 1)
kafka-create-topic topic partitions="3" replication="1":
    kubectl exec -n {{ns}} -it kafka-0 -- \
        kafka-topics.sh --bootstrap-server localhost:9092 \
        --create --topic {{topic}} \
        --partitions {{partitions}} \
        --replication-factor {{replication}} \
        --if-not-exists

# Delete a topic (usage: just kafka-delete-topic my-topic)
kafka-delete-topic topic:
    kubectl exec -n {{ns}} -it kafka-0 -- \
        kafka-topics.sh --bootstrap-server localhost:9092 \
        --delete --topic {{topic}}

# Consume messages from the beginning of the data-ingest topic (live tail)
kafka-consume topic="data-ingest":
    kubectl exec -n {{ns}} -it kafka-0 -- \
        kafka-console-consumer.sh \
        --bootstrap-server localhost:9092 \
        --topic {{topic}} \
        --from-beginning

# Consume only the latest N messages (usage: just kafka-consume-tail data-ingest 20)
kafka-consume-tail topic="data-ingest" count="10":
    kubectl exec -n {{ns}} -it kafka-0 -- \
        kafka-console-consumer.sh \
        --bootstrap-server localhost:9092 \
        --topic {{topic}} \
        --max-messages {{count}}

# Show consumer group offsets / lag
kafka-lag group="data-ingest-consumer":
    kubectl exec -n {{ns}} -it kafka-0 -- \
        kafka-consumer-groups.sh \
        --bootstrap-server localhost:9092 \
        --describe --group {{group}}

# List all consumer groups
kafka-groups:
    kubectl exec -n {{ns}} -it kafka-0 -- \
        kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list

# Open an interactive shell in the Kafka pod
exec-kafka:
    kubectl exec -n {{ns}} -it kafka-0 -- /bin/bash

# ══════════════════════════════════════════════════════════════════════════════
# MONGODB OPERATIONS
# ══════════════════════════════════════════════════════════════════════════════

# Open a mongosh session in the MongoDB pod
mongo-shell:
    kubectl exec -n {{ns}} -it statefulset/mongodb -- mongosh

# Show task collection stats
mongo-tasks:
    kubectl exec -n {{ns}} -it statefulset/mongodb -- \
        mongosh --eval 'use data_ingest; db.tasks.find().sort({created_at:-1}).limit(20).pretty()'

# Show ingested records count per task
mongo-records-count:
    kubectl exec -n {{ns}} -it statefulset/mongodb -- \
        mongosh --eval 'use data_ingest; db.records.aggregate([{$group:{_id:"$task_id",count:{$sum:1}}}]).pretty()'

# Drop all records for a given task (usage: just mongo-drop-task <task_id>)
mongo-drop-task task_id:
    kubectl exec -n {{ns}} -it statefulset/mongodb -- \
        mongosh --eval 'use data_ingest; db.records.deleteMany({task_id:"{{task_id}}"}); db.tasks.deleteOne({_id:ObjectId("{{task_id}}")})'

# ══════════════════════════════════════════════════════════════════════════════
# DOCKER IMAGE BUILDS
# ══════════════════════════════════════════════════════════════════════════════

# Build all Docker images
build-all: build-frontend build-producer build-consumer

# Build the frontend image
build-frontend tag="latest":
    docker build -t {{registry}}-frontend:{{tag}} ./frontend

# Build the producer image
build-producer tag="latest":
    docker build -t {{registry}}-producer:{{tag}} ./producer

# Build the consumer image
build-consumer tag="latest":
    docker build -t {{registry}}-consumer:{{tag}} ./consumer

# Load all images into a local kind cluster  (requires kind)
kind-load tag="latest":
    kind load docker-image {{registry}}-frontend:{{tag}}
    kind load docker-image {{registry}}-producer:{{tag}}
    kind load docker-image {{registry}}-consumer:{{tag}}

# Push all images to the configured registry
push-all tag="latest":
    docker push {{registry}}-frontend:{{tag}}
    docker push {{registry}}-producer:{{tag}}
    docker push {{registry}}-consumer:{{tag}}
