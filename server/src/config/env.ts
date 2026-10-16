import path from "node:path";
import dotenv from "dotenv";

// load server/.env no matter which folder the server is started from
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

function readString(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing ${name} in server/.env (see .env.example)`);
}

function readPort(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new Error(`${name} must be a valid port, got "${raw}"`);
  }
  return value;
}

const nodeEnv = readString("NODE_ENV", "development");

export const env = {
  nodeEnv,
  port: readPort("PORT", 4000),
  clientOrigin: readString("CLIENT_ORIGIN", "http://localhost:5173"),
  jwtSecret: readString("JWT_SECRET", nodeEnv === "production" ? undefined : "dev-only-insecure-secret"),
  db: {
    url: process.env.DATABASE_URL?.trim() || undefined, // if set, used instead of the PG* values
    host: readString("PGHOST", "localhost"),
    port: readPort("PGPORT", 5432),
    user: readString("PGUSER", "postgres"),
    password: readString("PGPASSWORD", ""),
    database: readString("PGDATABASE", "fasttickets"),
    ssl: process.env.PGSSL?.trim().toLowerCase() === "true",
  },
  smtp: {
    host: process.env.SMTP_HOST?.trim() || undefined, // temporary Ethereal inbox
    port: readPort("SMTP_PORT", 587),
    user: readString("SMTP_USER", ""),
    pass: readString("SMTP_PASS", ""),
    from: readString("MAIL_FROM", "FastTickets <no-reply@fasttickets.local>"),
  },
} as const;

export const isProduction = env.nodeEnv === "production";
