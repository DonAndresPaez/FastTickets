import { Router } from "express";
import { checkConnection, describeDbError, query } from "../db";

export const healthRouter = Router();

// GET /api/health
healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
});

// GET /api/health/db. This is a test query to check the database is reachable
healthRouter.get("/db", async (_req, res) => {
  try {
    const status = await checkConnection();

    // empty if db:migrate hasn't been run yet
    const { rows } = await query<{ filename: string }>(
      "SELECT filename FROM schema_migrations ORDER BY filename",
    ).catch(() => ({ rows: [] as { filename: string }[] }));

    res.json({
      status: "ok",
      database: status.database,
      postgresVersion: status.postgresVersion,
      serverTime: status.serverTime,
      appliedMigrations: rows.map((row) => row.filename),
    });
  } catch (err) {
    console.error("[health] Database check failed:", describeDbError(err));
    res.status(503).json({ status: "error", message: "Database is unreachable" });
  }
});
