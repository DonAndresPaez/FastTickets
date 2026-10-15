import type { RequestHandler } from "express";
import { readSession, SESSION_COOKIE } from "../auth/session";

// to be put in front of any route that requires user to be logged in
export const requireAuth: RequestHandler = (req, res, next) => {
  const user = readSession(req.cookies?.[SESSION_COOKIE]);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  req.user = user;
  next();
};
