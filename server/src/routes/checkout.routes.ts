import { Router } from "express";
import { sendOrderConfirmation } from "../checkout/receipt";
import { withTransaction } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import type { Order } from "../types/order";

export const checkoutRouter = Router();

const MAX_TICKETS = 30; // same limit as the cart

interface CheckoutItem {
  ticketId: number;
  quantity: number;
}

interface TicketRow {
  id: number;
  race_id: number;
  race_name: string;
  city: string;
  event_day: string;
  quantity: number;
  row: string | null;
  section: string;
  price: string;
  location: string;
}

// thrown inside the transaction so everything rolls back
class CheckoutError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const isPositiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

// returns the items, or an error message if the body is bad
function readItems(body: unknown): CheckoutItem[] | string {
  const raw = (body as { items?: unknown } | undefined)?.items;
  if (!Array.isArray(raw) || raw.length === 0) return "Your cart is empty";

  const items: CheckoutItem[] = [];
  for (const entry of raw) {
    const ticketId: unknown = entry?.ticketId;
    const quantity: unknown = entry?.quantity ?? 1;
    if (!isPositiveInt(ticketId) || !isPositiveInt(quantity)) return "Invalid cart items";
    if (items.some((item) => item.ticketId === ticketId)) return "Each ticket can only be in the cart once";
    items.push({ ticketId, quantity });
  }

  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  if (count > MAX_TICKETS) return `You can buy up to ${MAX_TICKETS} tickets at a time`;
  return items;
}

// POST /api/checkout  { items: [{ ticketId, quantity }] }
checkoutRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const items = readItems(req.body);
    if (typeof items === "string") {
      res.status(400).json({ error: items });
      return;
    }
    const userId = req.user!.id;

    const result = await withTransaction(async (client) => {
      // lock the user row so two checkouts can't spend the same credits
      const users = await client.query<{ email: string; first_name: string; balance: string }>(
        "SELECT email, first_name, balance FROM users WHERE id = $1 FOR UPDATE",
        [userId],
      );
      const user = users.rows[0];
      if (!user) throw new CheckoutError(401, "Not logged in");

      // lock the tickets too, in id order to avoid deadlocks
      const tickets = await client.query<TicketRow>(
        `SELECT t.id, t.race_id, r.race_name, r.city, t.event_day, t.quantity,
                t."row", t.section, t.price, t.location
         FROM tickets t
         JOIN race r ON r.id = t.race_id
         WHERE t.id = ANY($1::int[])
         ORDER BY t.id
         FOR UPDATE OF t`,
        [items.map((item) => item.ticketId)],
      );
      const byId = new Map(tickets.rows.map((ticket) => [ticket.id, ticket]));

      // work in cents so the math is exact
      let totalCents = 0;
      for (const item of items) {
        const ticket = byId.get(item.ticketId);
        if (!ticket || ticket.quantity < item.quantity) {
          throw new CheckoutError(409, "Some tickets in your cart are no longer available");
        }
        totalCents += Math.round(Number(ticket.price) * 100) * item.quantity;
      }

      const balanceCents = Math.round(Number(user.balance) * 100);
      if (totalCents > balanceCents) throw new CheckoutError(402, "Not enough credits for this purchase");
      const total = (totalCents / 100).toFixed(2);

      const paid = await client.query<{ balance: string }>(
        "UPDATE users SET balance = balance - $2 WHERE id = $1 RETURNING balance",
        [userId, total],
      );

      const created = await client.query<{ id: string; total: string; created_at: Date }>(
        "INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING id, total, created_at",
        [userId, total],
      );
      const row = created.rows[0]!;
      const order: Order = { id: row.id, total: row.total, createdAt: row.created_at, items: [] };

      for (const item of items) {
        const ticket = byId.get(item.ticketId)!;
        await client.query("UPDATE tickets SET quantity = quantity - $2 WHERE id = $1", [ticket.id, item.quantity]);
        await client.query(
          `INSERT INTO order_items (order_id, race_id, event_day, section, "row", location, unit_price, quantity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [order.id, ticket.race_id, ticket.event_day, ticket.section, ticket.row, ticket.location, ticket.price, item.quantity],
        );
        order.items.push({
          raceId: ticket.race_id,
          raceName: ticket.race_name,
          city: ticket.city,
          eventDay: ticket.event_day,
          section: ticket.section,
          row: ticket.row,
          location: ticket.location,
          unitPrice: ticket.price,
          quantity: item.quantity,
        });
      }

      return { order, balance: paid.rows[0]!.balance, email: user.email, firstName: user.first_name };
    });

    // the purchase is already saved, so a mail problem shouldn't fail the request
    let emailSent = true;
    try {
      await sendOrderConfirmation(result.email, result.firstName, result.order, result.balance);
    } catch (err) {
      emailSent = false;
      console.error(`[checkout] Couldn't send the confirmation for order ${result.order.id}:`, err);
    }

    res.status(201).json({ order: result.order, balance: result.balance, emailSent });
  } catch (err) {
    if (err instanceof CheckoutError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});
