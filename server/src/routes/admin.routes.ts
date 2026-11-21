import { Router } from "express";
import bcrypt from "bcryptjs";
import { clearAdminSessionCookie, setAdminSessionCookie } from "../auth/session";
import { query } from "../db";
import { requireAdmin } from "../middleware/requireAdmin";

// admins only log in, their accounts come from npm run db:seed-admins
export const adminRouter = Router();

interface AdminRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
}

const isNonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

// no email code for admins, the seeded addresses aren't real inboxes
adminRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};

    if (!isNonEmpty(email) || !isNonEmpty(password)) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const { rows } = await query<AdminRow>(
      `SELECT id, first_name, last_name, email, password_hash
       FROM admins
       WHERE LOWER(email) = LOWER($1)`,
      [email.trim()],
    );

    const admin = rows[0];
    const valid = admin && (await bcrypt.compare(password, admin.password_hash));

    if (!admin || !valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    setAdminSessionCookie(res, admin.id);
    res.json({
      admin: { id: admin.id, firstName: admin.first_name, lastName: admin.last_name, email: admin.email },
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/logout", (_req, res) => {
  clearAdminSessionCookie(res);
  res.status(204).end();
});

adminRouter.get("/me", requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, first_name AS "firstName", last_name AS "lastName", email
       FROM admins
       WHERE id = $1`,
      [req.admin!.id],
    );

    if (!rows[0]) {
      clearAdminSessionCookie(res);
      res.status(401).json({ error: "Admin login required" });
      return;
    }

    res.json({ admin: rows[0] });
  } catch (err) {
    next(err);
  }
});
