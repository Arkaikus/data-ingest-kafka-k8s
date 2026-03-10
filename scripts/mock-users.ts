#!/usr/bin/env bun
/**
 * Generates a CSV file with mock user profile data for ingestion testing.
 * Usage: bun scripts/mock-users.ts [rows] [output]
 *   rows: number of rows (default 100)
 *   output: output file path (default mock-users.csv)
 */

const FIRST_NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn",
  "Sam", "Jamie", "Drew", "Blake", "Cameron", "Skyler", "Reese", "Parker",
  "Emery", "Finley", "Hayden", "Sage", "River", "Phoenix", "Rowan", "Dakota",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White",
];

const CITIES = [
  "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
  "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
  "London", "Paris", "Berlin", "Tokyo", "Sydney", "Toronto", "Amsterdam",
];

const COUNTRIES = ["US", "US", "US", "UK", "FR", "DE", "JP", "AU", "CA", "NL"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomEmail(first: string, last: string): string {
  const domains = ["example.com", "test.org", "demo.net", "sample.io"];
  const local = `${first.toLowerCase()}.${last.toLowerCase()}`.replace(/\s/g, "");
  return `${local}${randomInt(1, 999)}@${pick(domains)}`;
}

function escapeCsv(val: string): string {
  if (/[,"\n\r]/.test(val)) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function generateRow(id: number): Record<string, string> {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const city = pick(CITIES);
  const country = pick(COUNTRIES);
  const age = randomInt(18, 75);
  const created = new Date(2020 + randomInt(0, 4), randomInt(0, 11), randomInt(1, 28))
    .toISOString()
    .slice(0, 10);

  return {
    id: String(id),
    first_name: first,
    last_name: last,
    email: randomEmail(first, last),
    age: String(age),
    city: city,
    country: country,
    created_at: created,
  };
}

function toCsv(rows: Record<string, string>[]): string {
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) => headers.map((h) => escapeCsv(r[h] ?? "")).join(",")),
  ];
  return lines.join("\n");
}

const rows = parseInt(process.argv[2] ?? "100", 10);
const output = process.argv[3] ?? "mock-users.csv";

const data = Array.from({ length: rows }, (_, i) => generateRow(i + 1));
const csv = toCsv(data);

await Bun.write(output, csv);
console.log(`✅ Generated ${rows} rows → ${output}`);
