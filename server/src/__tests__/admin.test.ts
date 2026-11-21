import { EventEmitter } from "node:events";
import { describe, it, expect, vi, beforeEach } from "vitest";
import httpMocks from "node-mocks-http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { adminRouter } from "../routes/admin.routes";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireAuth } from "../middleware/requireAuth";
import { env } from "../config/env";
import * as db from "../db";

vi.mock("../db", () => ({
  query: vi.fn(),
}));

function rows(list: object[]) {
  return { rows: list, command: "SELECT", rowCount: list.length, oid: 0, fields: [] };
}

function token(audience: string, id = "1") {
  return jwt.sign({}, env.jwtSecret, { subject: id, audience, expiresIn: 60, algorithm: "HS256" });
}

// waits for the route to actually send a response
async function send(options: httpMocks.RequestOptions) {
  const req = httpMocks.createRequest(options);
  const res = httpMocks.createResponse({ eventEmitter: EventEmitter });
  const done = new Promise((resolve) => res.on("end", resolve));
  adminRouter(req, res, (err?: unknown) => {
    if (err) throw err;
  });
  await done;
  return res;
}

describe("Admin login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs in a seeded admin and sets the admin cookie", async () => {
    const hash = await bcrypt.hash("admin-dev-password", 4);
    vi.mocked(db.query).mockResolvedValueOnce(
      rows([{ id: "3", first_name: "Admin", last_name: "3", email: "admin3@fasttickets.local", password_hash: hash }]),
    );

    const res = await send({
      method: "POST",
      url: "/login",
      body: { email: "ADMIN3@fasttickets.local", password: "admin-dev-password" },
    });

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().admin).toEqual({
      id: "3",
      firstName: "Admin",
      lastName: "3",
      email: "admin3@fasttickets.local",
    });
    expect(res._getJSONData().admin.password_hash).toBeUndefined();
    expect(res.cookies.admin_session?.value).toBeTruthy();
    expect(res.cookies.session).toBeUndefined();
  });

  it("rejects a wrong password", async () => {
    const hash = await bcrypt.hash("admin-dev-password", 4);
    vi.mocked(db.query).mockResolvedValueOnce(
      rows([{ id: "3", first_name: "Admin", last_name: "3", email: "admin3@fasttickets.local", password_hash: hash }]),
    );

    const res = await send({
      method: "POST",
      url: "/login",
      body: { email: "admin3@fasttickets.local", password: "wrong-password" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.cookies.admin_session).toBeUndefined();
  });

  it("rejects an email that isn't an admin", async () => {
    vi.mocked(db.query).mockResolvedValueOnce(rows([]));

    const res = await send({
      method: "POST",
      url: "/login",
      body: { email: "squaredcircle42@yahoo.com", password: "VeryGoodp@ssword73" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("needs both email and password", async () => {
    const res = await send({ method: "POST", url: "/login", body: { email: "admin1@fasttickets.local" } });

    expect(res.statusCode).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("only looks in the admins table, never users", async () => {
    vi.mocked(db.query).mockResolvedValueOnce(rows([]));

    await send({ method: "POST", url: "/login", body: { email: "a@b.com", password: "whatever123" } });

    expect(vi.mocked(db.query).mock.calls[0]?.[0]).toMatch(/FROM admins/);
  });

  it("has no signup route", async () => {
    const next = vi.fn();
    const req = httpMocks.createRequest({ method: "POST", url: "/signup", body: {} });
    const res = httpMocks.createResponse();

    adminRouter(req, res, next);

    expect(next).toHaveBeenCalled(); // falls through to the 404 handler
  });

  it("GET /me returns the logged in admin", async () => {
    vi.mocked(db.query).mockResolvedValueOnce(
      rows([{ id: "3", firstName: "Admin", lastName: "3", email: "admin3@fasttickets.local" }]),
    );

    const res = await send({ method: "GET", url: "/me", cookies: { admin_session: token("admin", "3") } });

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().admin.email).toBe("admin3@fasttickets.local");
    expect(vi.mocked(db.query).mock.calls[0]?.[1]).toEqual(["3"]);
  });

  it("logout clears the admin cookie", async () => {
    const res = await send({ method: "POST", url: "/logout" });

    expect(res.statusCode).toBe(204);
    expect(res.cookies.admin_session?.value).toBe("");
  });
});

describe("requireAdmin", () => {
  function run(cookies: Record<string, string>) {
    const req = httpMocks.createRequest({ cookies });
    const res = httpMocks.createResponse();
    const next = vi.fn();
    requireAdmin(req, res, next);
    return { req, res, next };
  }

  it("lets a valid admin token through", () => {
    const { req, next } = run({ admin_session: token("admin", "7") });

    expect(next).toHaveBeenCalled();
    expect(req.admin).toEqual({ id: "7" });
  });

  it("blocks requests with no cookie", () => {
    const { res, next } = run({});

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("blocks a normal user's session token, even in the admin cookie", () => {
    const { res, next } = run({ admin_session: token("session") });

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("blocks tampered tokens", () => {
    const { next } = run({ admin_session: "malicious.forged.jwt.token" });

    expect(next).not.toHaveBeenCalled();
  });

  it("an admin token doesn't count as a user login", () => {
    const req = httpMocks.createRequest({ cookies: { session: token("admin") } });
    const res = httpMocks.createResponse();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
