// npm run db:seed-admins
// Creates the 10 admin accounts (admin1@fasttickets.local ... admin10@fasttickets.local).
// Safe to run more than once, it just resets their passwords to ADMIN_PASSWORD.
import bcrypt from "bcryptjs";
import { isProduction } from "../config/env";
import { closePool, describeDbError, withTransaction } from "../db";

const ADMIN_COUNT = 10;

function adminPassword(): string {
  const value = process.env.ADMIN_PASSWORD?.trim();
  if (value) return value;
  if (isProduction) throw new Error("Missing ADMIN_PASSWORD in server/.env (see .env.example)");
  return "admin-dev-password";
}

async function seed(): Promise<void> {
  const passwordHash = await bcrypt.hash(adminPassword(), 12);

  await withTransaction(async (client) => {
    for (let n = 1; n <= ADMIN_COUNT; n++) {
      await client.query(
        `INSERT INTO admins (first_name, last_name, email, password_hash)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ((LOWER(email))) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
        ["Admin", String(n), `admin${n}@fasttickets.local`, passwordHash],
      );
    }
  });
  console.log(`[db:seed-admins] ${ADMIN_COUNT} admin accounts ready`);
}

seed()
  .catch((err: unknown) => {
    console.error(`[db:seed-admins] ${describeDbError(err)}`);
    process.exitCode = 1;
  })
  .finally(() => closePool());
