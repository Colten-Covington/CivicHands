// Applies the SQL migrations in ./drizzle to DATABASE_URL.
//
// Used instead of `drizzle-kit migrate` for deployments because drizzle-kit
// hides the underlying database error behind its progress spinner and only
// reports "exited with 1". This script prints the real error and a hint.
//
// `--baseline` records every migration as already applied without running it,
// for databases whose schema was created with `drizzle-kit push`.
import { readFileSync } from "node:fs";
import { neon, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

const migrationsFolder = "./drizzle";
const migrationsSchema = "drizzle";
const migrationsTable = "__drizzle_migrations";

const alreadyExists =
  "The database was probably created with `db:push` (or changed by hand), so its migration history in drizzle.__drizzle_migrations does not match the schema. Either point DATABASE_URL at an empty database, or record the existing migrations as applied (see README: \"Migration errors\").";

const hints = {
  "42P07": `A table already exists. ${alreadyExists}`,
  "42710": `A type, constraint, or index already exists. ${alreadyExists}`,
  "42701": `A column already exists. ${alreadyExists}`,
  "28P01": "Authentication failed. Check the username and password in DATABASE_URL.",
  "3D000": "The database named in DATABASE_URL does not exist.",
  "42501": "The DATABASE_URL role lacks permission to run this migration. Use the database owner role.",
  ENOTFOUND: "The database host in DATABASE_URL could not be resolved. Check the hostname for typos.",
  ECONNREFUSED: "The database refused the connection. Check the host and port in DATABASE_URL.",
  ETIMEDOUT: "Timed out connecting to the database. Check that the Neon project is active and not IP-restricted.",
};

function fail(message) {
  console.error(`\n[migrate] ${message}`);
  process.exit(1);
}

function describeTarget(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`;
  } catch {
    fail(
      "DATABASE_URL is not a valid URL. Expected a postgresql:// connection string from Neon with no surrounding quotes or spaces.",
    );
  }
}

function reportError(error) {
  console.error("\n[migrate] Migration failed.\n");
  const seen = new Set();
  let current = error;
  let code;
  while (current && typeof current === "object" && !seen.has(current)) {
    const name = current.constructor?.name === "ErrorEvent" ? "WebSocket ErrorEvent" : (current.name ?? "Error");
    console.error(`${seen.size === 0 ? "Error" : "Caused by"}: ${name}: ${current.message || "(no message)"}`);
    seen.add(current);
    for (const field of ["code", "severity", "detail", "hint", "schema", "table", "column", "constraint", "where", "syscall", "hostname"]) {
      if (current[field] !== undefined && current[field] !== "") {
        console.error(`  ${field}: ${current[field]}`);
      }
    }
    if (typeof current.query === "string" && !current.message?.includes(current.query)) {
      console.error(`  query: ${current.query.trim().split("\n").slice(0, 5).join("\n         ")}`);
    }
    code ??= current.code;
    current = current.sourceError ?? current.cause ?? current.error;
  }
  if (seen.size === 0) console.error(`Error: ${String(error)}`);

  if (code && hints[code]) console.error(`\nHint: ${hints[code]}`);
  if (error?.stack) console.error(`\n${error.stack}`);
}

const url = process.env.DATABASE_URL?.trim();
if (!url) fail("DATABASE_URL is not set in this environment.");
if (typeof globalThis.WebSocket !== "function") {
  fail(
    `Node.js ${process.version} has no built-in WebSocket. Use Node.js 22 or newer (Vercel: Project Settings > Build and Deployment > Node.js Version).`,
  );
}

const journal = JSON.parse(readFileSync(`${migrationsFolder}/meta/_journal.json`, "utf8"));
console.log(`[migrate] Target: ${describeTarget(url)}`);
console.log(`[migrate] Migrations in repository: ${journal.entries.map((entry) => entry.tag).join(", ")}`);

const pool = new Pool({ connectionString: url, max: 1 });
pool.on("error", (error) => {
  reportError(error);
  process.exit(1);
});

const historyTable = `"${migrationsSchema}"."${migrationsTable}"`;
const baseline = process.argv.includes("--baseline");

async function recordAllAsApplied() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`create schema if not exists "${migrationsSchema}"`);
    await client.query(
      `create table if not exists ${historyTable} (id serial primary key, hash text not null, created_at bigint)`,
    );
    const { rows } = await client.query(`select count(*)::int as count from ${historyTable}`);
    if (rows[0].count > 0) {
      throw new Error(`Refusing to baseline: ${historyTable} already has ${rows[0].count} row(s).`);
    }
    for (const migration of readMigrationFiles({ migrationsFolder })) {
      await client.query(`insert into ${historyTable} (hash, created_at) values ($1, $2)`, [
        migration.hash,
        migration.folderMillis,
      ]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
let exitCode = 0;
try {
  // Check connectivity and credentials over HTTP first: WebSocket failures
  // surface as an empty ErrorEvent, while HTTP failures carry a real reason.
  await neon(url)`select 1`;
  console.log("[migrate] Connected.");

  const existing = await pool.query(`select to_regclass('${historyTable}') is not null as "exists"`);
  if (existing.rows[0]?.exists) {
    const applied = await pool.query(`select count(*)::int as count from ${historyTable}`);
    console.log(`[migrate] Previously applied migrations: ${applied.rows[0].count}`);
  } else {
    console.log("[migrate] No migration history found.");
  }

  if (baseline) {
    await recordAllAsApplied();
    console.log("[migrate] Baseline recorded; no migration SQL was run.");
  } else {
    await migrate(drizzle(pool), { migrationsFolder, migrationsSchema, migrationsTable });
  }

  const applied = await pool.query(`select count(*)::int as count from ${historyTable}`);
  console.log(`[migrate] Done. Applied migrations: ${applied.rows[0].count} of ${journal.entries.length}.`);
} catch (error) {
  reportError(error);
  exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
process.exit(exitCode);
