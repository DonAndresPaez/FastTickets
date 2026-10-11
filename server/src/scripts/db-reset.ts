// npm run db:reset
// Wipes your LOCAL database, then the npm script re-runs all migrations.
// Only for local development, all local data is lost.
import { env, isProduction } from "../config/env";
import { closePool, describeDbError, pool, targetDatabaseName } from "../db";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

async function reset(): Promise<void> {
  if (isProduction || env.db.url || !LOCAL_HOSTS.has(env.db.host)) {
    throw new Error("db:reset only works on a local database");
  }

  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
  console.log(`[db:reset] Cleared database "${targetDatabaseName()}"`);
}

reset()
  .catch((err: unknown) => {
    console.error(`[db:reset] ${describeDbError(err)}`);
    process.exitCode = 1;
  })
  .finally(() => closePool());
