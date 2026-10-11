// npm run db:create
// Creates the database if it doesn't exist yet. Safe to run more than once.
import { Client } from "pg";
import { buildPoolConfig, describeDbError, targetDatabaseName } from "../db";

async function main(): Promise<void> {
  const name = targetDatabaseName();
  // connect to the default "postgres" db since ours might not exist yet
  const client = new Client(buildPoolConfig("postgres"));
  await client.connect();

  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (rowCount) {
      console.log(`[db:create] Database "${name}" already exists`);
      return;
    }
    // $1 params don't work for names, so escape it instead
    await client.query(`CREATE DATABASE ${client.escapeIdentifier(name)}`);
    console.log(`[db:create] Created database "${name}"`);
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(`[db:create] ${describeDbError(err)}`);
  process.exitCode = 1;
});
