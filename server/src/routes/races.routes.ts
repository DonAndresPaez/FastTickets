import { Router } from "express";
import { query } from "../db";
import type { Race, Ticket } from "../types/event";

export const raceRouter = Router();

// true for a real calendar date in YYYY-MM-DD form
function isValidDay(day: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const date = new Date(day + "T00:00:00Z");
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

// get races
raceRouter.get("/", async (_req, res, next) => {
    try {
        const { rows } = await query<Race>("SELECT * FROM race ORDER BY start_date");
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// get one race
raceRouter.get("/:id", async (req, res, next) => {
    try {
        const raceID = Number(req.params.id);
        if (!Number.isInteger(raceID)) {
            res.status(400).json({ error: "Invalid race ID" });
            return;
        }

        const { rows } = await query<Race>("SELECT * FROM race WHERE id = $1", [raceID]);

        if (rows.length === 0) {
            res.status(404).json({ error: "Race not found" });
            return;
        }

        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// get tickets for a race, with optional day parameter for a single day (?day=YYYY-MM-DD)
raceRouter.get("/:id/tickets", async (req, res, next) => {
    try {
        const raceID = Number(req.params.id);
        if (!Number.isInteger(raceID)) {
            res.status(400).json({ error: "Invalid race ID" });
            return;
        }

        const day = req.query.day;
        if (day !== undefined && (typeof day !== "string" || !isValidDay(day))) {
            res.status(400).json({ error: "Day must be a date in YYYY-MM-DD format" });
            return;
        }

        // so an unknown race gives a 404 instead of an empty list
        const race = await query("SELECT 1 FROM race WHERE id = $1", [raceID]);
        if (race.rows.length === 0) {
            res.status(404).json({ error: "Race not found" });
            return;
        }

        const { rows } = day
            ? await query<Ticket>("SELECT * FROM tickets WHERE race_id = $1 AND event_day = $2", [raceID, day])
            : await query<Ticket>("SELECT * FROM tickets WHERE race_id = $1", [raceID]);

        res.json(rows);
    } catch (err) {
        next(err);
    }
});
