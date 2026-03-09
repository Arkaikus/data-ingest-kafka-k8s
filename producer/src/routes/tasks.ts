import { Hono } from "hono";
import { ObjectId } from "mongodb";
import Papa from "papaparse";
import { getDb } from "../db";
import { getProducer, KAFKA_TOPIC } from "../kafka";

const tasks = new Hono();

/** GET /api/tasks — list all tasks, newest first */
tasks.get("/", async (c) => {
  const db = await getDb();
  const docs = await db
    .collection("tasks")
    .find({})
    .sort({ created_at: -1 })
    .toArray();
  return c.json(docs.map((t) => ({ ...t, _id: String(t._id) })));
});

/** GET /api/tasks/:id — single task */
tasks.get("/:id", async (c) => {
  const db = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(c.req.param("id"));
  } catch {
    return c.json({ error: "Invalid id" }, 400);
  }
  const doc = await db.collection("tasks").findOne({ _id: oid });
  if (!doc) return c.json({ error: "Not found" }, 404);
  return c.json({ ...doc, _id: String(doc._id) });
});

/** POST /api/tasks — create task from CSV upload */
tasks.post("/", async (c) => {
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: "Expected multipart/form-data" }, 400);
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return c.json({ error: "No CSV file provided (field: file)" }, 400);
  }

  const rawName = formData.get("name");
  const name =
    typeof rawName === "string" && rawName.trim()
      ? rawName.trim()
      : file.name;

  const csvText = await file.text();
  const { data, errors } = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (errors.length > 0) {
    return c.json({ error: "CSV parse error", details: errors }, 422);
  }

  if (data.length === 0) {
    return c.json({ error: "CSV file is empty or has no data rows" }, 422);
  }

  const db = await getDb();
  const now = new Date();
  const taskDoc = {
    name,
    filename: file.name,
    status: "pending",
    total_rows: data.length,
    processed_rows: 0,
    created_at: now,
    updated_at: now,
  };

  const result = await db.collection("tasks").insertOne(taskDoc);
  const taskId = String(result.insertedId);

  // Publish all rows to Kafka
  const producer = await getProducer();
  await producer.send({
    topic: KAFKA_TOPIC,
    messages: data.map((row, index) => ({
      key: taskId,
      value: JSON.stringify({
        task_id: taskId,
        row_index: index,
        total_rows: data.length,
        data: row,
      }),
    })),
  });

  // Mark as processing once messages are enqueued
  await db.collection("tasks").updateOne(
    { _id: result.insertedId },
    { $set: { status: "processing", updated_at: new Date() } }
  );

  return c.json({ ...taskDoc, _id: taskId, status: "processing" }, 201);
});

/** DELETE /api/tasks/:id — remove a task and its records */
tasks.delete("/:id", async (c) => {
  const db = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(c.req.param("id"));
  } catch {
    return c.json({ error: "Invalid id" }, 400);
  }
  const result = await db.collection("tasks").deleteOne({ _id: oid });
  if (result.deletedCount === 0) return c.json({ error: "Not found" }, 404);
  // Clean up all records associated with the deleted task
  await db.collection("records").deleteMany({ task_id: String(oid) });
  return c.json({ success: true });
});

export { tasks as taskRoutes };
