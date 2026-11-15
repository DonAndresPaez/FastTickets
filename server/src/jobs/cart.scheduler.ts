import { withTransaction } from '../db';

let timer: NodeJS.Timeout | undefined;
let running = false;

export function releaseExpiredItems() {
    return withTransaction(async (client) => {
        const { rows: locked } = await client.query(
            `SELECT id FROM tickets
             WHERE id IN (SELECT ticket_id FROM cart_items WHERE expires_at <= NOW())
             ORDER BY id FOR UPDATE`, 
          );

        // remove expired items and give back quantity to tickets table
        await client.query(
            `WITH expired AS (
                DELETE FROM cart_items
                WHERE expires_at <= NOW()
                RETURNING ticket_id, quantity
            ),
            totals AS (
                SELECT ticket_id, SUM(quantity)::int AS quantity
                FROM expired
                GROUP BY ticket_id
            )
            UPDATE tickets t
            SET quantity = t.quantity + totals.quantity
            FROM totals
            WHERE t.id = totals.ticket_id`,
        );
    });
}

async function runCleanup() {
    if (running) return;
    running = true;
    try {
        await releaseExpiredItems();
    } catch (err) {
        console.error('Error releasing expired items:', err);
    } finally {
        running = false;
    }
}

export function startCartScheduler() {
    if (timer) return;
    void runCleanup();
    timer = setInterval(runCleanup, 60 * 1000);
    timer.unref();
}

export function stopCartScheduler() {
    if (timer) clearInterval(timer);
    timer = undefined;
}