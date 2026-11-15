import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { query, withTransaction } from '../db';
import type { CartItem } from '../types/cart';

export const cartRouter = Router();
const MAX_TICKETS = 30; // user can only have 30 tickets in their cart at a time

// error for roll back
class CartError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// input validation helper
const isPositiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

// release expired items from cart
async function releaseExpiredItems(client: any, cartId: number, ticketId: number) {
    // lock current ticket and any expired tickets in the cart
    const { rows: locked } = await client.query(
        `SELECT id FROM tickets WHERE id =$2
         OR id IN (SELECT ticket_id FROM cart_items WHERE cart_id = $1 AND expires_at <= NOW())
         ORDER BY id FOR UPDATE`, 
         [cartId, ticketId]);

    // remove expired items and give back quantity to tickets table
    await client.query(
        `WITH expired AS (
            DELETE FROM cart_items
            WHERE cart_id = $1 AND expires_at <= NOW()
            RETURNING ticket_id, quantity
        ),
        totals AS (
            SELECT ticket_id, SUM(quantity) AS quantity
            FROM expired
            GROUP BY ticket_id
        )
        UPDATE tickets t
        SET quantity = t.quantity + totals.quantity
        FROM totals
        WHERE t.id = totals.ticket_id`,
        [cartId]
    );
}

// GET api/cart  - get the current user's cart items
cartRouter.get('/', requireAuth, async (req, res, next) => {
    try {
        const { rows } = await query<CartItem>(
            `SELECT t.id, t.race_id, t.event_day, t.row, t.section, t.price, t.location,
            ci.quantity, ci.expires_at
            FROM cart c
            JOIN cart_items ci ON ci.cart_id = c.id
            JOIN tickets t on t.id = ci.ticket_id
            WHERE c.user_id = $1 AND ci.expires_at > now()
            ORDER BY ci.added_at`,
            [req.user!.id]
        );
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// POST api/cart  - add an item to the current user's cart
cartRouter.post('/', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const { ticketId, quantity } = req.body ?? {};

        if (!isPositiveInt(ticketId) || !isPositiveInt(quantity)) {
            throw new CartError(400, 'Invalid ticket ID or quantity');
        }

        await withTransaction(async (client) => {
            await client.query('INSERT INTO cart (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);

            const { rows: [cart] } = await client.query('SELECT id FROM cart WHERE user_id = $1 FOR UPDATE', [userId]);

            await releaseExpiredItems(client, cart.id, ticketId);

            const { rows: tickets } = await client.query('SELECT id FROM tickets WHERE id = $1 FOR UPDATE', [ticketId]);
            if (tickets.length === 0) {
                throw new CartError(404, 'Ticket not found');
            }

            // verify adding will not exceed MAX_TICKETS
            const { rows } = await client.query(
                'SELECT quantity FROM cart_items WHERE cart_id = $1', 
                [cart.id]
            );
            const total = rows.reduce((sum, item) => sum + item.quantity, 0);
            if (total + quantity > MAX_TICKETS) {
                throw new CartError(400, `You can only have ${MAX_TICKETS} tickets in your cart at a time`);
            }   

            const update = await client.query(
                `UPDATE tickets SET quantity = quantity - $1 WHERE id = $2 AND quantity >= $1`, 
                [quantity, ticketId]
            );
            if (update.rowCount === 0) {
                throw new CartError(400, 'Not enough tickets available');
            }

            // add ticket or update quantity
            await client.query(
                `INSERT INTO cart_items (cart_id, ticket_id, quantity, expires_at) 
                VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes') 
                ON CONFLICT (cart_id, ticket_id) 
                DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, expires_at = NOW() + INTERVAL '15 minutes'`,
                [cart.id, ticketId, quantity]
            );
        });

        res.status(201).json({ message: 'Item added to cart' });
    } catch (err) {
        if (err instanceof CartError) {
            res.status(err.status).json({ error: err.message });
            return;
        }
        next(err);
    }
});

// DELETE api/cart/:ticketId - remove an item from the user's cart
cartRouter.delete('/:ticketId', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const ticketId = Number(req.params.ticketId);

        if (!isPositiveInt(ticketId)) {
            throw new CartError(400, 'Invalid ticket ID');
        }

        await withTransaction(async (client) => {
            const { rows: [cart] } = await client.query('SELECT id FROM cart WHERE user_id = $1 FOR UPDATE', [userId]);
            if(!cart) {
                throw new CartError(404, 'Cart not found');
            }

            await client.query(
                'SELECT id FROM tickets WHERE id = $1 FOR UPDATE',
                [ticketId]
            );

            const { rows: [removed] } = await client.query(
                'DELETE FROM cart_items WHERE cart_id = $1 AND ticket_id = $2 RETURNING quantity',
                [cart.id, ticketId]
            );
            if (!removed) {
                throw new CartError(404, 'Item not found in cart');
            }

            await client.query(
                'UPDATE tickets SET quantity = quantity + $1 WHERE id = $2',
                [removed.quantity, ticketId]
            );
        });
        
        res.status(200).json({ message: 'Item deleted from cart' });
    } catch (err) {
        if (err instanceof CartError) {
            res.status(err.status).json({ error: err.message });
            return;
        }
        next(err);
    }
});