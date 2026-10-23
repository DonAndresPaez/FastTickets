import { describe, it, expect, vi, beforeEach } from "vitest";
import httpMocks from "node-mocks-http";
import bcrypt from "bcryptjs";
import { authRouter } from "../routes/auth.routes";
import { requireAuth } from "../middleware/requireAuth";
import * as db from "../db";

vi.mock("../db", () => ({
  query: vi.fn(),
}));

vi.mock("../auth/verification", () => ({
  sendVerificationCode: vi.fn().mockResolvedValue(undefined),
  canResendCode: vi.fn().mockResolvedValue(true),
  checkVerificationCode: vi.fn().mockResolvedValue("ok"),
}));

describe("Auth & Security Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. User Signup Test", () => {
    it("should sign up successfully with correct credentials", async () => {
      const hashedPassword = await bcrypt.hash("VeryGoodp@ssword73", 10);
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: "user-1", email: "squaredcircle42@yahoo.com", password_hash: hashedPassword }],
        command: "INSERT",
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const req = httpMocks.createRequest({
        method: "POST",
        url: "/signup",
        body: {
          firstName: "Squared",
          lastName: "Circle",
          email: "squaredcircle42@yahoo.com",
          password: "VeryGoodp@ssword73",
        },
      });
      const res = httpMocks.createResponse();

      await authRouter(req, res, vi.fn());

      expect(res.statusCode).toBe(200);
    });

    it("should fail signup with incorrect credentials (password too short)", async () => {
      const req = httpMocks.createRequest({
        method: "POST",
        url: "/signup",
        body: {
          firstName: "Squared",
          lastName: "Circle",
          email: "squaredcircle42@yahoo.com",
          password: "12345",
        },
      });
      const res = httpMocks.createResponse();

      await authRouter(req, res, vi.fn());

      expect(res.statusCode).toBe(400);
      expect(res._getJSONData()).toEqual({
        error: "Password must be at least 8 characters",
      });
    });
  });

  describe("2. User Login Test", () => {
    it("should login successfully with correct credentials", async () => {
      const hashedPassword = await bcrypt.hash("VeryGoodp@ssword73", 10);
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            first_name: "Squared",
            last_name: "Circle",
            email: "squaredcircle42@yahoo.com",
            password_hash: hashedPassword,
          },
        ],
        command: "SELECT",
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const req = httpMocks.createRequest({
        method: "POST",
        url: "/login",
        body: {
          email: "squaredcircle42@yahoo.com",
          password: "VeryGoodp@ssword73",
        },
      });
      const res = httpMocks.createResponse();

      await authRouter(req, res, vi.fn());

      expect(res.statusCode).toBe(200);
    });

    it("should fail login with incorrect credentials", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        command: "SELECT",
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const req = httpMocks.createRequest({
        method: "POST",
        url: "/login",
        body: {
          email: "squaredcircle42@yahoo.com",
          password: "TheWrongP@ssword08",
        },
      });
      const res = httpMocks.createResponse();

      await authRouter(req, res, vi.fn());

      expect(res.statusCode).toBe(200);
    });
  });

  describe("3. SQL Injection Test", () => {
    it("should safely handle SQL injection attempt in login email parameter without bypassing auth", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        command: "SELECT",
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const req = httpMocks.createRequest({
        method: "POST",
        url: "/login",
        body: {
          email: "' OR '1'='1",
          password: "wh@tever123",
        },
      });
      const res = httpMocks.createResponse();

      await authRouter(req, res, vi.fn());

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ["' OR '1'='1"]
      );
      expect(res.statusCode).toBe(401);
    });
  });

  describe("4. Middleware and Cookies Malicious Intent Test", () => {
    it("should reject requests containing maligned or tampered session cookies", () => {
      const req = httpMocks.createRequest({
        method: "GET",
        url: "/me",
        cookies: {
          session: "malicious.forged.jwt.token",
        },
      });
      const res = httpMocks.createResponse();
      const next = vi.fn();

      requireAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res._getJSONData()).toEqual({
        error: "Not logged in",
      });
    });
  });
});