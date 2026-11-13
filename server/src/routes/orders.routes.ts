import { Router } from "express";
import { query } from "../db";
import { requireAuth } from "../middleware/requireAuth";

export const ordersRouter = Router();

// one row per order, with its items packed into a json array
const ORDERS_SQL = `
  SELECT o.id, o.total, o.created_at AS "createdAt",
         json_agg(json_build_object(
           'raceId', i.race_id,
           'raceName', r.race_name,
           'city', r.city,
           'eventDay', i.event_day,
           'section', i.section,
           'row', i."row",
           'location', i.location,
           'unitPrice', i.unit_price::text,
           'quantity', i.quantity
         ) ORDER BY i.id) AS items
  FROM orders o
  JOIN order_items i ON i.order_id = o.id
  JOIN race r ON r.id = i.race_id
  WHERE o.user_id = $1`;

// GET /api/orders, the logged in user's purchases, newest first
ordersRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(`${ORDERS_SQL} GROUP BY o.id ORDER BY o.created_at DESC, o.id DESC`, [
      req.user!.id,
    ]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id
ordersRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const orderId = String(req.params.id);
    if (!/^\d{1,18}$/.test(orderId)) {
      res.status(400).json({ error: "Invalid order ID" });
      return;
    }

    const { rows } = await query(`${ORDERS_SQL} AND o.id = $2 GROUP BY o.id`, [req.user!.id, orderId]);
    if (!rows[0]) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});
