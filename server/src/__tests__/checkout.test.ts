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
const cart = { id: 5 };
const ticket = {
  id: 7,
  race_id: 1,
  race_name: "United States Grand Prix",
  city: "Austin",
  event_day: "2026-10-23",
  row: "4",
  section: "T9-4",
  price: "62.15",
  location: "Turn 9",
};
const gaTicket = { ...ticket, id: 8, row: null, section: "General Admission", price: "0.10", location: "General Admission" };

// checkout runs its queries in this order:
// user, cart, tickets, delete cart items, charge user, insert order, then one insert per order item
function queueCheckout(opts: {
  user?: object;
  tickets: object[];
  items: { ticket_id: number; quantity: number }[];
  balance?: string;
  order?: { id: string; total: string };
}) {
  client.query
    .mockResolvedValueOnce({ rows: [opts.user ?? user] })
    .mockResolvedValueOnce({ rows: [cart] })
    .mockResolvedValueOnce({ rows: opts.tickets })
    .mockResolvedValueOnce({ rows: opts.items })
    .mockResolvedValueOnce({ rows: [{ balance: opts.balance ?? "0.00" }] })
    .mockResolvedValueOnce({ rows: [{ ...(opts.order ?? { id: "10", total: "0.00" }), created_at: new Date() }] })
    .mockResolvedValue({ rows: [] });
}

async function checkout(body: Record<string, unknown> = {}) {
  const req = httpMocks.createRequest({ method: "POST", url: "/", body });
  const res = httpMocks.createResponse();
  const next = vi.fn();
  await checkoutRouter(req, res, next);
  // wait for the async route handler to finish
  await vi.waitFor(() => expect(res.writableEnded || next.mock.calls.length > 0).toBe(true));
  return { res, next };
}

const sqlCalls = (text: string) => client.query.mock.calls.filter(([sql]) => String(sql).includes(text));

describe("Checkout Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.query.mockReset();
  });

  it("should buy the cart, charge the user and send a confirmation email", async () => {
    queueCheckout({
      tickets: [ticket],
      items: [{ ticket_id: 7, quantity: 2 }],
      balance: "375.70",
      order: { id: "10", total: "124.30" },
    });

    const { res } = await checkout();

    expect(res.statusCode).toBe(201);
    const data = res._getJSONData();
    expect(data.order.total).toBe("124.30");
    expect(data.order.items).toHaveLength(1);
    expect(data.order.items[0]).toMatchObject({ raceName: "United States Grand Prix", quantity: 2, unitPrice: "62.15" });
    expect(data.balance).toBe("375.70");
    expect(data.emailSent).toBe(true);

    // the user was charged price x quantity
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE users SET balance"), ["1", "124.30"]);
    // the cart was emptied and the order item saved
    expect(sqlCalls("DELETE FROM cart_items")[0]![1]).toEqual([5]);
    expect(sqlCalls("INSERT INTO order_items")).toHaveLength(1);
    // stock was already taken out when the tickets went into the cart
    expect(sqlCalls("UPDATE tickets")).toHaveLength(0);

    expect(mailer.sendMail).toHaveBeenCalledWith(
      "squaredcircle42@yahoo.com",
      expect.stringContaining("#10"),
      expect.stringContaining("2 x $62.15 = $124.30"),
    );
  });

  it("should add up several cart items without rounding errors", async () => {
    queueCheckout({
      tickets: [ticket, gaTicket],
      items: [
        { ticket_id: 7, quantity: 1 },
        { ticket_id: 8, quantity: 3 },
      ],
      balance: "437.55",
      order: { id: "12", total: "62.45" },
    });

    const { res } = await checkout();

    expect(res.statusCode).toBe(201);
    // 62.15 + 3 x 0.10 = 62.45 exactly
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE users SET balance"), ["1", "62.45"]);
    expect(sqlCalls("INSERT INTO order_items")).toHaveLength(2);
    expect(res._getJSONData().order.items).toHaveLength(2);
  });

  it("should still complete the order if the email fails", async () => {
    vi.mocked(mailer.sendMail).mockRejectedValueOnce(new Error("smtp down"));
    queueCheckout({
      tickets: [ticket],
      items: [{ ticket_id: 7, quantity: 1 }],
      balance: "437.85",
      order: { id: "11", total: "62.15" },
    });

    const { res } = await checkout();

    expect(res.statusCode).toBe(201);
    expect(res._getJSONData().emailSent).toBe(false);
  });

  it("should reject the purchase when the user doesn't have enough credits", async () => {
    queueCheckout({
      user: { ...user, balance: "100.00" },
      tickets: [ticket],
      items: [{ ticket_id: 7, quantity: 2 }],
    });

    const { res } = await checkout();

    expect(res.statusCode).toBe(402);
    expect(res._getJSONData().error).toBe("Not enough credits for this purchase");
    // nothing was charged or ordered, and the transaction rolls back the cart delete
    expect(sqlCalls("UPDATE users")).toHaveLength(0);
    expect(sqlCalls("INSERT INTO orders")).toHaveLength(0);
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it("should reject a user who has never made a cart", async () => {
    client.query.mockResolvedValueOnce({ rows: [user] }).mockResolvedValueOnce({ rows: [] });

    const { res } = await checkout();

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData().error).toBe("Cart is empty");
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  it("should reject a cart that is empty or only has expired items", async () => {
    // expired items are filtered out by the queries, so both come back empty
    queueCheckout({ tickets: [], items: [] });

    const { res } = await checkout();

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData().error).toBe("No items in cart");
    expect(sqlCalls("UPDATE users")).toHaveLength(0);
  });

  it("should reject the order if a cart ticket is no longer available", async () => {
    queueCheckout({ tickets: [], items: [{ ticket_id: 7, quantity: 1 }] });

    const { res } = await checkout();

    expect(res.statusCode).toBe(409);
    expect(sqlCalls("UPDATE users")).toHaveLength(0);
  });

  it("should only buy what is in the cart, not what the request body says", async () => {
    queueCheckout({
      tickets: [ticket],
      items: [{ ticket_id: 7, quantity: 1 }],
      balance: "437.85",
      order: { id: "13", total: "62.15" },
    });

    const { res } = await checkout({ items: [{ ticketId: 7, quantity: 30 }], total: "0.01" });

    expect(res.statusCode).toBe(201);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE users SET balance"), ["1", "62.15"]);
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
