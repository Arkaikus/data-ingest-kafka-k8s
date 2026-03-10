import { Kafka } from "kafkajs";
import { MongoClient, ObjectId } from "mongodb";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((s) => s.trim());
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || "data-ingest";
const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || "data-ingest-consumer";
const FROM_BEGINNING = process.env.KAFKA_FROM_BEGINNING === "true";

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "data_ingest";

interface KafkaRowPayload {
  task_id: string;
  row_index: number;
  total_rows: number;
  data: Record<string, unknown>;
}

interface KafkaTaskDeletedPayload {
  type: "task-deleted";
  task_id: string;
}

async function main() {
  // ── MongoDB ──────────────────────────────────────────
  const mongoClient = new MongoClient(MONGO_URL);
  await mongoClient.connect();
  const db = mongoClient.db(DB_NAME);
  console.log(`✅ Connected to MongoDB at ${MONGO_URL}`);

  // ── Kafka ────────────────────────────────────────────
  const kafka = new Kafka({
    clientId: "data-ingest-consumer",
    brokers: KAFKA_BROKERS,
    retry: { retries: 10, initialRetryTime: 3000 },
  });

  const consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });
  await consumer.connect();
  await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: FROM_BEGINNING });
  console.log(`✅ Kafka consumer subscribed to topic "${KAFKA_TOPIC}"`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      let payload: KafkaRowPayload | KafkaTaskDeletedPayload;
      try {
        payload = JSON.parse(message.value.toString()) as KafkaRowPayload | KafkaTaskDeletedPayload;
      } catch {
        console.error("Failed to parse message:", message.value.toString());
        return;
      }

      if ("type" in payload && payload.type === "task-deleted") {
        const { task_id } = payload;
        const result = await db.collection("records").deleteMany({ task_id });
        console.log(`[task ${task_id}] deleted ${result.deletedCount} records`);
        return;
      }

      const { task_id, row_index, total_rows, data } = payload as KafkaRowPayload;

      // Persist the record
      await db.collection("records").insertOne({
        task_id,
        row_index,
        data,
        created_at: new Date(),
      });

      // Atomically increment processed_rows and fetch the updated document
      const updatedTask = await db
        .collection("tasks")
        .findOneAndUpdate(
          { _id: new ObjectId(task_id) },
          { $inc: { processed_rows: 1 }, $set: { updated_at: new Date() } },
          { returnDocument: "after" },
        );

      const processedRows = updatedTask?.processed_rows ?? 0;
      const isCompleted = processedRows >= total_rows;

      if (isCompleted) {
        // Update status to completed
        try {
          await db
            .collection("tasks")
            .updateOne(
              { _id: new ObjectId(task_id) },
              { $set: { status: "completed", updated_at: new Date() } },
            );
        } catch {
          console.error(`Failed to mark task ${task_id} as completed`);
        }
      }

      console.log(
        `[task ${task_id}] row ${row_index + 1}/${total_rows} — ` +
          `${processedRows} processed${isCompleted ? " ✅ COMPLETED" : ""}`,
      );
    },
  });

  const shutdown = async () => {
    console.log("Shutting down consumer…");
    await consumer.disconnect();
    await mongoClient.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
