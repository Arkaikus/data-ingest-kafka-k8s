import { Kafka, type Producer } from "kafkajs";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((s) => s.trim());

export const KAFKA_TOPIC = process.env.KAFKA_TOPIC || "data-ingest";

const kafka = new Kafka({
  clientId: "data-ingest-producer",
  brokers: KAFKA_BROKERS,
});

let producer: Producer | null = null;

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer();
    await producer.connect();
  }
  return producer;
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
