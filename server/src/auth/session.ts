import type { Response } from "express";
import jwt from "jsonwebtoken";
import { env, isProduction } from "../config/env";

export const SESSION_COOKIE = "session";
const SESSION_SECONDS = 60 * 60 * 24 * 7; // 7 days potentially change later

export interface AuthUser {
  id: string;
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  path: "/",
} as const;

export function setSessionCookie(res: Response, userId: string): void {
  const token = jwt.sign({}, env.jwtSecret, {
    subject: userId,
    expiresIn: SESSION_SECONDS,
    algorithm: "HS256",
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_SECONDS * 1000 }); //milliseconds
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

export function readSession(token: unknown): AuthUser | null {
  if (typeof token !== "string") return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub) return null;
    return { id: payload.sub };
  } catch {
    return null;
  }
}
