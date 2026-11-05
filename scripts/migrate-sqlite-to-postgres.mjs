#!/usr/bin/env node
/**
 * One-time data migration: SQLite → PostgreSQL (Neon).
 *
 * Copies every table row-by-row while KEEPING the original IDs, so all
 * cross-relations (task→project→client→invoice→document, payments,
 * subtasks, notifications) survive intact.
 *
 * A single generated Prisma client can only talk to ONE provider, so this
 * script generates BOTH clients into a temporary directory:
 *   • a SQLite-flavored client     — from prisma/schema.prisma with the
 *     provider forced to "sqlite"
 *   • a PostgreSQL-flavored client — from prisma/schema.postgres.prisma
 *     when it exists, otherwise from prisma/schema.prisma with the
 *     provider forced to "postgresql"
 *
 * Because both clients are derived on the fly, this works no matter which
 * provider prisma/schema.prisma currently declares — no manual schema
 * switching or regeneration is needed before running it.
 *
 * Run AFTER the tables exist on Neon:
 *   DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" \
 *     npx prisma db push --schema prisma/schema.postgres.prisma
 *
 * Usage:
 *   DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" \
 *   SQLITE_URL="file:./db/custom.db" \
 *   node scripts/migrate-sqlite-to-postgres.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PG_URL = process.env.DATABASE_URL;
const SQLITE_FILE = resolve(
  (process.env.SQLITE_URL ?? "file:./db/custom.db").replace(/^file:/, ""),
);

if (!PG_URL || !PG_URL.startsWith("postgresql")) {
  console.error("Set DATABASE_URL to the Neon postgresql:// connection string.");
  process.exit(1);
}
if (!existsSync(SQLITE_FILE)) {
  console.error(`SQLite database not found: ${SQLITE_FILE}`);
  process.exit(1);
}

const MAIN_SCHEMA = "prisma/schema.prisma";
const PG_SCHEMA_FILE = "prisma/schema.postgres.prisma";

function forceProvider(schemaText, provider) {
  return schemaText.replace(
    /provider\s*=\s*"(?:sqlite|postgresql)"/,
    `provider = "${provider}"`,
  );
}

// ── 1. Generate provider-specific Prisma clients into a temp dir ──
const workDir = mkdtempSync(join(tmpdir(), "mylist-migrate-"));
const sqliteDir = join(workDir, "sqlite-client");
const pgDir = join(workDir, "pg-client");

const mainSchemaText = readFileSync(MAIN_SCHEMA, "utf8");
writeFileSync(
  join(workDir, "schema.sqlite.prisma"),
  forceProvider(mainSchemaText, "sqlite"),
);

const pgSchemaText = existsSync(PG_SCHEMA_FILE)
  ? readFileSync(PG_SCHEMA_FILE, "utf8")
  : forceProvider(mainSchemaText, "postgresql");
writeFileSync(join(workDir, "schema.postgres.prisma"), pgSchemaText);

execSync(
  `npx prisma generate --schema "${join(workDir, "schema.sqlite.prisma")}" --output "${sqliteDir}"`,
  { stdio: "inherit" },
);
execSync(
  `npx prisma generate --schema "${join(workDir, "schema.postgres.prisma")}" --output "${pgDir}"`,
  { stdio: "inherit" },
);

// ── 2. Connect both clients ──
const sqliteClientModule = await import(
  pathToFileURL(join(sqliteDir, "index.js")).href
);
const pgClientModule = await import(pathToFileURL(join(pgDir, "index.js")).href);
const SqlClient = sqliteClientModule.PrismaClient;
const PgClient = pgClientModule.PrismaClient;

const pg = new PgClient({ datasources: { db: { url: PG_URL } } });
const sqlite = new SqlClient({
  datasources: { db: { url: `file:${SQLITE_FILE}` } },
});

// Insertion order: parents before children.
const TABLES = [
  "user",
  "category",
  "client",
  "project",
  "task",
  "subtask",
  "invoice",
  "invoiceItem",
  "payment",
  "notification",
  "documentRecord",
  "businessSettings",
  "reminderSetting",
];

async function copyTable(name) {
  const rows = await sqlite[name].findMany();
  let inserted = 0;
  for (const row of rows) {
    try {
      await pg[name].create({ data: row });
      inserted++;
    } catch (e) {
      if (e?.code === "P2002") continue; // already migrated — idempotent re-runs
      throw e;
    }
  }
  console.log(`  ${name.padEnd(18)} ${String(inserted).padStart(4)} / ${rows.length} rows`);
  return inserted;
}

async function main() {
  console.log(`Migrating ${SQLITE_FILE} → Neon…`);
  await pg.$connect();
  await sqlite.$connect();

  console.log("Clearing destination tables (keeps re-runs consistent)…");
  for (const name of [...TABLES].reverse()) {
    await pg[name].deleteMany();
  }

  let total = 0;
  for (const name of TABLES) {
    total += await copyTable(name);
  }

  console.log(`\nDone — ${total} rows migrated. Log into the app to verify.`);
  await pg.$disconnect();
  await sqlite.$disconnect();
}

try {
  await main();
} catch (e) {
  console.error("MIGRATION FAILED:", e);
  process.exitCode = 1;
} finally {
  rmSync(workDir, { recursive: true, force: true });
}