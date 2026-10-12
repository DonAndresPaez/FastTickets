import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db";

export const authRouter = Router();

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
}

const isNonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

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

    const { rows } = await query(
      `INSERT INTO users (first_name, last_name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, first_name AS "firstName", last_name AS "lastName", email`,
      [firstName.trim(), lastName.trim(), email.trim(), passwordHash],
    );

    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "That email is already registered" });
      return;
    }
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

    res.json({
      user: { id: user.id, firstName: user.first_name, lastName: user.last_name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
});