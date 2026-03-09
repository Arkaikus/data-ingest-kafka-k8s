import { MongoClient } from "mongodb";

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "data_ingest";

let client: MongoClient | null = null;

export async function getDb() {
  if (!client) {
    client = new MongoClient(MONGO_URL);
    await client.connect();
  }
  return client.db(DB_NAME);
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
  }
}
