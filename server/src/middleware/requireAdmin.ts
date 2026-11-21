import type { RequestHandler } from "express";
import { ADMIN_COOKIE, readAdminSession } from "../auth/session";

// put in front of any admin-only route, e.g. app.use("/api/admin/races", requireAdmin, adminRacesRouter)
export const requireAdmin: RequestHandler = (req, res, next) => {
  const admin = readAdminSession(req.cookies?.[ADMIN_COOKIE]);
  if (!admin) {
    res.status(401).json({ error: "Admin login required" });
    return;
  }
  req.admin = admin;
  next();
};
