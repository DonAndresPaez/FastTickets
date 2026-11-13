import { describe, it, expect, vi, beforeEach } from "vitest";
import httpMocks from "node-mocks-http";
import { checkoutRouter } from "../routes/checkout.routes";
import { receiptText } from "../checkout/receipt";
import * as mailer from "../mailer";

// fake transaction client, each test queues up what the queries return
const client = { query: vi.fn() };

vi.mock("../db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn((work: (c: typeof client) => unknown) => work(client)),
}));

vi.mock("../mailer", () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: { user?: { id: string } }, _res: unknown, next: () => void) => {
    req.user = { id: "1" };
    next();
  },
}));

const user = { email: "squaredcircle42@yahoo.com", first_name: "Squared", balance: "500.00" };
const ticket = {
  id: 7,
  race_id: 1,
  race_name: "United States Grand Prix",
  city: "Austin",
  event_day: "2026-10-23",
  quantity: 2,
  row: "4",
  section: "T9-4",
  price: "62.15",
  location: "Turn 9",
};

async function checkout(body: unknown) {
  const req = httpMocks.createRequest({ method: "POST", url: "/", body: body as Record<string, unknown> });
  const res = httpMocks.createResponse();
  const next = vi.fn();
  await checkoutRouter(req, res, next);
  // wait for the async route handler to finish
  await vi.waitFor(() => expect(res.writableEnded || next.mock.calls.length > 0).toBe(true));
  return { res, next };
}

describe("Checkout Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.query.mockReset();
  });

  it("should buy tickets, charge the user and send a confirmation email", async () => {
    client.query
      .mockResolvedValueOnce({ rows: [user] })
      .mockResolvedValueOnce({ rows: [ticket] })
      .mockResolvedValueOnce({ rows: [{ balance: "375.70" }] })
      .mockResolvedValueOnce({ rows: [{ id: "10", total: "124.30", created_at: new Date() }] })
      .mockResolvedValue({ rows: [] });

    const { res } = await checkout({ items: [{ ticketId: 7, quantity: 2 }] });

    expect(res.statusCode).toBe(201);
    const data = res._getJSONData();
    expect(data.order.total).toBe("124.30");
    expect(data.order.items).toHaveLength(1);
    expect(data.balance).toBe("375.70");
    expect(data.emailSent).toBe(true);

    // the user was charged price x quantity
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE users SET balance"), ["1", "124.30"]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE tickets SET quantity"), [7, 2]);
    expect(mailer.sendMail).toHaveBeenCalledWith(
      "squaredcircle42@yahoo.com",
      expect.stringContaining("#10"),
      expect.stringContaining("2 x $62.15 = $124.30"),
    );
  });

  it("should still complete the order if the email fails", async () => {
    vi.mocked(mailer.sendMail).mockRejectedValueOnce(new Error("smtp down"));
    client.query
      .mockResolvedValueOnce({ rows: [user] })
      .mockResolvedValueOnce({ rows: [ticket] })
      .mockResolvedValueOnce({ rows: [{ balance: "437.85" }] })
      .mockResolvedValueOnce({ rows: [{ id: "11", total: "62.15", created_at: new Date() }] })
      .mockResolvedValue({ rows: [] });

    const { res } = await checkout({ items: [{ ticketId: 7 }] });

    expect(res.statusCode).toBe(201);
    expect(res._getJSONData().emailSent).toBe(false);
  });

  it("should reject the purchase when the user doesn't have enough credits", async () => {
    client.query
      .mockResolvedValueOnce({ rows: [{ ...user, balance: "100.00" }] })
      .mockResolvedValueOnce({ rows: [ticket] });

    const { res } = await checkout({ items: [{ ticketId: 7, quantity: 2 }] });

    expect(res.statusCode).toBe(402);
    expect(client.query).toHaveBeenCalledTimes(2); // nothing was written
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it("should reject tickets that are sold out or don't exist", async () => {
    client.query.mockResolvedValueOnce({ rows: [user] }).mockResolvedValueOnce({ rows: [ticket] });
    const soldOut = await checkout({ items: [{ ticketId: 7, quantity: 3 }] });
    expect(soldOut.res.statusCode).toBe(409);

    client.query.mockResolvedValueOnce({ rows: [user] }).mockResolvedValueOnce({ rows: [] });
    const missing = await checkout({ items: [{ ticketId: 99 }] });
    expect(missing.res.statusCode).toBe(409);
  });

  it("should reject bad carts before touching the database", async () => {
    const bodies = [
      {},
      { items: [] },
      { items: [{ ticketId: "7 OR 1=1" }] },
      { items: [{ ticketId: 7, quantity: 0 }] },
      { items: [{ ticketId: 7, quantity: 1.5 }] },
      { items: [{ ticketId: 7 }, { ticketId: 7 }] },
      { items: [{ ticketId: 7, quantity: 31 }] },
    ];
    for (const body of bodies) {
      const { res } = await checkout(body);
      expect(res.statusCode).toBe(400);
    }
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should write an itemized receipt", () => {
    const text = receiptText(
      "Squared",
      {
        id: "10",
        total: "186.45",
        createdAt: new Date(),
        items: [
          { raceId: 1, raceName: "United States Grand Prix", city: "Austin", eventDay: "2026-10-23", section: "T9-4", row: "4", location: "Turn 9", unitPrice: "62.15", quantity: 2 },
          { raceId: 1, raceName: "United States Grand Prix", city: "Austin", eventDay: "2026-10-24", section: "General Admission", row: null, location: "General Admission", unitPrice: "62.15", quantity: 1 },
        ],
      },
      "313.55",
    );

    expect(text).toContain("T9-4, Row 4");
    expect(text).toContain("2 x $62.15 = $124.30");
    expect(text).toContain("1 x $62.15 = $62.15");
    expect(text).toContain("Total: $186.45");
    expect(text).toContain("Remaining balance: $313.55");
  });
});
