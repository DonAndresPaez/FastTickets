import { Router } from "express";
import { sendOrderConfirmation } from "../checkout/receipt";
import { withTransaction } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import type { Order } from "../types/order";

export const checkoutRouter = Router();

interface CheckoutItem {
  ticket_id: number;
  quantity: number;
}

interface TicketRow {
  id: number;
  race_id: number;
  race_name: string;
  city: string;
  event_day: string;
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

// POST /api/checkout
checkoutRouter.post("/", requireAuth, async (req, res, next) => {
  try {
      const userId = req.user!.id;

      const result = await withTransaction(async (client) => {
        // lock the user row so two checkouts can't spend the same credits
        const {rows: [user] } = await client.query<{ email: string; first_name: string; balance: string }>(
        "SELECT email, first_name, balance FROM users WHERE id = $1 FOR UPDATE",
        [userId],
        );

        if (!user) {
          throw new CheckoutError(401, "Not logged in");
        }

        const { rows: [cart] } = await client.query(`SELECT id FROM cart WHERE user_id = $1 FOR UPDATE`, [userId]);

        if (!cart) {
          throw new CheckoutError(400, "Cart is empty");
        }

        // lock the tickets too, in id order to avoid deadlocks
        const tickets = await client.query<TicketRow>(
        `SELECT t.id, t.race_id, r.race_name, r.city, t.event_day,
                t."row", t.section, t.price, t.location
        FROM tickets t
        JOIN race r ON r.id = t.race_id
        WHERE t.id IN (SELECT ticket_id FROM cart_items where cart_id = $1 AND expires_at > now())
        ORDER BY t.id
        FOR UPDATE OF t`,
        [cart.id],
        );
      
        const byId = new Map(tickets.rows.map((ticket) => [ticket.id, ticket]));

        // only non-expired items are returned, since expired items won't be part of the order
        const { rows: items } = await client.query<CheckoutItem>(
          `DELETE FROM cart_items WHERE cart_id = $1 AND expires_at > now()
          RETURNING ticket_id, quantity`,
          [cart.id]
        )

        if (items.length === 0) {
          throw new CheckoutError(400, "No items in cart")
        }

        // work in cents so the math is exact
        let totalCents = 0;
        for (const item of items) {
          const ticket = byId.get(item.ticket_id);
          if (!ticket) {
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
          const ticket = byId.get(item.ticket_id)!;
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
