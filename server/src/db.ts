import {
  Pool,
  type PoolClient,
  type PoolConfig,
  type QueryResult,
  type QueryResultRow,
} from "pg";
import { env } from "./config/env";

// All database access goes through this file.
// Pass values as $1, $2, ... params, never by concatenating strings into the SQL. We do not want SQL injections. :)

export function buildPoolConfig(databaseOverride?: string): PoolConfig {
  const base: PoolConfig = {
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: env.db.ssl,
  };

  if (env.db.url) {
    const url = new URL(env.db.url);
    if (databaseOverride) url.pathname = `/${databaseOverride}`;
    return { ...base, connectionString: url.toString() };
  }

  return {
    ...base,
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: databaseOverride ?? env.db.database,
  };
}

export function targetDatabaseName(): string {
  if (env.db.url) {
    const name = decodeURIComponent(new URL(env.db.url).pathname.replace(/^\//, ""));
    if (!name) throw new Error("DATABASE_URL is missing the database name");
    return name;
  }
  return env.db.database;
}

export const pool = new Pool(buildPoolConfig());

// don't crash the server if an idle connection drops
pool.on("error", (err) => {
  console.error("[db] Idle client error:", err.message);
});

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

// For writes that need to all succeed or all fail (e.g. checkout when we buy a ticket).
// Commits if work() finishes, rolls back if it throws.
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export interface DatabaseStatus {
  database: string;
  serverTime: Date;
  postgresVersion: string;
}

export async function checkConnection(): Promise<DatabaseStatus> {
  const { rows } = await query<{ database: string; server_time: Date; version: string }>(
    "SELECT current_database() AS database, NOW() AS server_time, current_setting('server_version') AS version",
  );
  const row = rows[0];
  if (!row) throw new Error("Connection check returned no rows");
  return { database: row.database, serverTime: row.server_time, postgresVersion: row.version };
}

export function closePool(): Promise<void> {
  return pool.end();
}

// clearer messages for the usual setup mistakes
export function describeDbError(err: unknown): string {
  const e = err as { code?: string; message?: string; errors?: { code?: string }[] };
  const code = e?.code ?? e?.errors?.[0]?.code;
  const where = env.db.url ? "DATABASE_URL" : `${env.db.host}:${env.db.port}`;

  if (e?.message?.includes("password must be a string")) {
    return "No password set. Copy .env.example to .env and set PGPASSWORD";
  }

  switch (code) {
    case "ECONNREFUSED":
      return `Can't connect to PostgreSQL at ${where}. Is it running?`;
    case "ENOTFOUND":
      return `Host not found (${where}). Check PGHOST in server/.env`;
    case "28P01":
      return "Wrong password. Check PGUSER / PGPASSWORD in server/.env";
    case "28000":
      return "Login role rejected. Check PGUSER in server/.env";
    case "3D000":
      return `Database "${targetDatabaseName()}" doesn't exist yet. Run npm run db:setup`;
    default:
      return e?.message || String(err);
  }
}
