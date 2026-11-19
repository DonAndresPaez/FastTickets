import { createApp } from "./app";
import { env } from "./config/env";
import { checkConnection, closePool, describeDbError } from "./db";
import { startCartScheduler, stopCartScheduler } from "./jobs/cart.scheduler";

async function start(): Promise<void> {
  try {
    const db = await checkConnection();
    console.log(`[db] Connected to "${db.database}" (PostgreSQL ${db.postgresVersion})`);
  } catch (err) {
    // still start the server so the frontend can keep working without a db
    console.warn(`[db] Not connected: ${describeDbError(err)}`);
  }

  const server = createApp().listen(env.port, () => {
    console.log(`[server] Listening on http://localhost:${env.port}`);
  });

  startCartScheduler(); // will print error to console if db not connected, still works

  const shutdown = (signal: string) => {
    console.log(`[server] ${signal} received, shutting down`);
    stopCartScheduler();
    server.close(() => {
      closePool().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
