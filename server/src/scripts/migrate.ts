// npm run db:migrate
// Runs the .sql files in database/migrations that haven't been applied yet, in order.
// Each file runs in its own transaction and gets recorded in schema_migrations.
// Don't edit a migration once it's pushed, add a new numbered file instead.
import fs from "node:fs";
import path from "node:path";
import { closePool, describeDbError, pool } from "../db";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../database/migrations");
const MIGRATION_FILE = /^\d{3}_[a-z0-9_-]+\.sql$/i;
const MIGRATION_LOCK_ID = 30312026; // stops two migrate runs from overlapping

async function migrate(): Promise<void> {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => MIGRATION_FILE.test(file))
    .sort();

  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows } = await client.query<{ filename: string }>("SELECT filename FROM schema_migrations");
    const applied = new Set(rows.map((row) => row.filename));
    const pending = files.filter((file) => !applied.has(file));

    if (pending.length === 0) {
      console.log("[db:migrate] Already up to date");
      return;
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`[db:migrate] Applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`${file} failed (rolled back): ${(err as Error).message}`);
      }
    }
    console.log(`[db:migrate] ${pending.length} migration(s) applied`);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

migrate()
  .catch((err: unknown) => {
    console.error(`[db:migrate] ${describeDbError(err)}`);
    process.exitCode = 1;
  })
  .finally(() => closePool());
