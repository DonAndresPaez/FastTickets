import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { query } from "../db";
import { sendMail } from "../mailer";

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;

export async function sendVerificationCode(userId: string, email: string): Promise<void> {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codeHash = await bcrypt.hash(code, 10);

  await query(
    `INSERT INTO verification_codes (user_id, code_hash, expires_at)
     VALUES ($1, $2, NOW() + make_interval(mins => $3))
     ON CONFLICT (user_id) DO UPDATE
       SET code_hash = EXCLUDED.code_hash, attempts = 0,
           expires_at = EXCLUDED.expires_at, created_at = NOW()`,
    [userId, codeHash, CODE_MINUTES],
  );

  await sendMail(
    email,
    `Your FastTickets code: ${code}`,
    `Your FastTickets verification code is ${code}\n\nIt expires in ${CODE_MINUTES} minutes. If you didn't try to sign in, you can ignore this email.`,
  );
}

export async function canResendCode(userId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM verification_codes
     WHERE user_id = $1 AND created_at > NOW() - make_interval(secs => $2)`,
    [userId, RESEND_COOLDOWN_SECONDS],
  );
  return rows.length === 0;
}

export type CodeCheck = "ok" | "wrong" | "expired";

export async function checkVerificationCode(userId: string, code: string): Promise<CodeCheck> {
  // count the attempt before comparing
  const { rows } = await query<{ code_hash: string }>(
    `UPDATE verification_codes SET attempts = attempts + 1
     WHERE user_id = $1 AND attempts < $2 AND expires_at > NOW()
     RETURNING code_hash`,
    [userId, MAX_ATTEMPTS],
  );
  const row = rows[0];
  if (!row) return "expired";
  if (!(await bcrypt.compare(code, row.code_hash))) return "wrong";

  await query("DELETE FROM verification_codes WHERE user_id = $1", [userId]);
  return "ok";
}
