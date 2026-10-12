import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { env } from "./config/env";
import { healthRouter } from "./routes/health.routes";
import { authRouter } from "./routes/auth.routes";

export function createApp(): express.Express {
  const app = express();

  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json());

  // add each subsystem's routes here, e.g. app.use("/api/auth", authRouter);
  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // log the real error but don't send the details to the client
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error("[server] Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);

  return app;
}
