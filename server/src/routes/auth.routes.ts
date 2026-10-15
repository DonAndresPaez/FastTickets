import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import {
  clearPendingCookie,
  clearSessionCookie,
  PENDING_COOKIE,
  readPending,
  setPendingCookie,
  setSessionCookie,
} from "../auth/session";
import { canResendCode, checkVerificationCode, sendVerificationCode } from "../auth/verification";
import { query } from "../db";
import { requireAuth } from "../middleware/requireAuth";

export const authRouter = Router();

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
}

const isNonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

// signup and login both stop here: email a code, and remember who is waiting for it
async function startVerification(res: Response, userId: string, email: string): Promise<void> {
  await sendVerificationCode(userId, email);
  setPendingCookie(res, userId);
}

authRouter.post("/signup", async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body ?? {};

    if (![firstName, lastName, email, password].every(isNonEmpty)) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // an email that was never verified can be signed up for again,
    // so a typo'd or abandoned signup doesn't lock the real owner out
    const { rows } = await query<{ id: string; email: string }>(
      `INSERT INTO users (first_name, last_name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ((LOWER(email))) DO UPDATE
         SET first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             email = EXCLUDED.email,
             password_hash = EXCLUDED.password_hash
         WHERE users.email_verified_at IS NULL
       RETURNING id, email`,
      [firstName.trim(), lastName.trim(), email.trim(), passwordHash],
    );

    const user = rows[0];
    if (!user) {
      res.status(409).json({ error: "That email is already registered" });
      return;
    }

    await startVerification(res, user.id, user.email);
    res.status(201).json({ verificationRequired: true, email: user.email });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};

    if (!isNonEmpty(email) || !isNonEmpty(password)) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const { rows } = await query<UserRow>(
      `SELECT id, first_name, last_name, email, password_hash
       FROM users
       WHERE LOWER(email) = LOWER($1)`,
      [email.trim()],
    );

    const user = rows[0];
    const valid = user && (await bcrypt.compare(password, user.password_hash));

    if (!user || !valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    await startVerification(res, user.id, user.email);
    res.json({ verificationRequired: true, email: user.email });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/verify", async (req, res, next) => {
  try {
    const pending = readPending(req.cookies?.[PENDING_COOKIE]);
    if (!pending) {
      res.status(401).json({ error: "Your sign-in timed out, please start again" });
      return;
    }

    const code: unknown = req.body?.code;
    if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
      res.status(400).json({ error: "Enter the 6-digit code from your email" });
      return;
    }

    const result = await checkVerificationCode(pending.id, code.trim());
    if (result === "expired") {
      res.status(400).json({ error: "That code expired or had too many attempts. Send a new one" });
      return;
    }
    if (result === "wrong") {
      res.status(400).json({ error: "Incorrect code" });
      return;
    }

    const { rows } = await query(
      `UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW())
       WHERE id = $1
       RETURNING id, first_name AS "firstName", last_name AS "lastName", email`,
      [pending.id],
    );
    if (!rows[0]) {
      clearPendingCookie(res);
      res.status(401).json({ error: "Your sign-in timed out, please start again" });
      return;
    }

    clearPendingCookie(res);
    setSessionCookie(res, pending.id);
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/resend-code", async (req, res, next) => {
  try {
    const pending = readPending(req.cookies?.[PENDING_COOKIE]);
    if (!pending) {
      res.status(401).json({ error: "Your sign-in timed out, please start again" });
      return;
    }

    if (!(await canResendCode(pending.id))) {
      res.status(429).json({ error: "Please wait a few seconds before requesting another code" });
      return;
    }

    const { rows } = await query<{ email: string }>("SELECT email FROM users WHERE id = $1", [pending.id]);
    if (!rows[0]) {
      clearPendingCookie(res);
      res.status(401).json({ error: "Your sign-in timed out, please start again" });
      return;
    }

    await sendVerificationCode(pending.id, rows[0].email);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  clearPendingCookie(res);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, first_name AS "firstName", last_name AS "lastName", email
       FROM users
       WHERE id = $1`,
      [req.user!.id],
    );

    if (!rows[0]) {
      clearSessionCookie(res);
      res.status(401).json({ error: "Not logged in" });
      return;
    }

    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});
