import { Router } from "express";
import { query } from "../db";
import type { Race, Ticket } from "../types/event";

export const raceRouter = Router();

// get races
raceRouter.get("/", async (req, res, next) => {
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
            return res.status(400).json({ error: "Invalid race ID"});
        }

        const { rows } = await query<Race>("SELECT * FROM race WHERE id = $1", [raceID]);

        if (rows.length === 0) {
            return res.status(404).json({error: "Race not found"});
        }

        res.json(rows[0]);
    } catch (err) {
        next(err);
    }   
});

// get tickets for a race, with optional day parameter for a single day (?day=YYYY-MM-DD)
raceRouter.get("/:id/tickets", async (req, res, next) => {
    try{
        const raceID = Number(req.params.id);
        if (!Number.isInteger(raceID)) {
            return res.status(400).json({ error: "Invalid race ID"});
        }
        const day = req.query.day as string | undefined;

        const { rows } =  day ? await query<Ticket>("SELECT * FROM tickets WHERE race_id = $1 AND event_day = $2", [raceID, day])
        : await query<Ticket>("SELECT * FROM tickets WHERE race_id = $1", [raceID]);

        res.json(rows);
    } catch (err: any) {
        next(err);
    }
});


