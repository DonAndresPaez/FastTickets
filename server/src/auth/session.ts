import type { Response } from "express";
import jwt from "jsonwebtoken";
import { env, isProduction } from "../config/env";

export const SESSION_COOKIE = "session";
export const PENDING_COOKIE = "pending_login";
export const ADMIN_COOKIE = "admin_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7; // 7 days potentially change later
const PENDING_SECONDS = 60 * 15;
const ADMIN_SECONDS = 60 * 60 * 8; // admins get logged out after a work day

// the audience keeps the tokens apart, a user session can't be used as an admin one
type Audience = "session" | "pending" | "admin";

export interface AuthUser {
  id: string;
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  path: "/",
} as const;

function setTokenCookie(res: Response, name: string, audience: Audience, userId: string, seconds: number): void {
  const token = jwt.sign({}, env.jwtSecret, {
    subject: userId,
    audience,
    expiresIn: seconds,
    algorithm: "HS256",
  });
  res.cookie(name, token, { ...cookieOptions, maxAge: seconds * 1000 }); //milliseconds
}

function readToken(token: unknown, audience: Audience): AuthUser | null {
  if (typeof token !== "string") return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"], audience });
    if (typeof payload === "string" || !payload.sub) return null;
    return { id: payload.sub };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, userId: string): void {
  setTokenCookie(res, SESSION_COOKIE, "session", userId, SESSION_SECONDS);
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

export function readSession(token: unknown): AuthUser | null {
  return readToken(token, "session");
}

// password checked, waiting for the emailed code
export function setPendingCookie(res: Response, userId: string): void {
  setTokenCookie(res, PENDING_COOKIE, "pending", userId, PENDING_SECONDS);
}

export function clearPendingCookie(res: Response): void {
  res.clearCookie(PENDING_COOKIE, cookieOptions);
}

export function readPending(token: unknown): AuthUser | null {
  return readToken(token, "pending");
}

// admins log in separately from users, with their own cookie
export function setAdminSessionCookie(res: Response, adminId: string): void {
  setTokenCookie(res, ADMIN_COOKIE, "admin", adminId, ADMIN_SECONDS);
}

export function clearAdminSessionCookie(res: Response): void {
  res.clearCookie(ADMIN_COOKIE, cookieOptions);
}

export function readAdminSession(token: unknown): AuthUser | null {
  return readToken(token, "admin");
}
