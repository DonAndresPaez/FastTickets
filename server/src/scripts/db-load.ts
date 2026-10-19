// npm run db:load
// Loads local database with dummy ticket data. Safe to run more than once, will not create duplicates.
import path from "node:path";
import { readFileSync } from "fs";
import { withTransaction, describeDbError, closePool } from "../db";

interface RaceData {
    race: {
        race_name: string;
        city: string;
        start_date: string;
        end_date: string;
    }
    day: string;
    body: {items: TicketData[]}
}

interface TicketData {
    availableTickets: number;
    rawPrice: number;
    row?: string;
    section: string;
    ticketClassName: string;
}

const filePath = path.resolve(__dirname, "../../database/dummy/eventData.json");
// the file is an object keyed by StubHub URL, we only need the values
const data: RaceData[] = Object.values(JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, RaceData>);

async function load() {
    await withTransaction(async (client) => {
        // race appears multiple times in the data, inserted first time, then referenced by id for tickets
        for (const entry of data) {
            const race = entry.race;
            const result = await client.query(
                `INSERT INTO race (race_name, city, start_date, end_date)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (race_name, city, start_date, end_date)
                    DO UPDATE SET race_name = EXCLUDED.race_name
                 RETURNING id`,
                [race.race_name, race.city, race.start_date, race.end_date]
            );
            const raceID = result.rows[0].id;
            const day = entry.day;

            // deletes any existing tickets (avoids duplicates, makes potential rerun safe)
            await client.query(
                'DELETE FROM tickets WHERE race_id = $1 AND event_day = $2',
                [raceID, day]
            );

            for (const ticket of entry.body.items) {
                await client.query(
                    `INSERT INTO tickets (race_id, event_day, quantity, "row", section, price, location)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [raceID, day, ticket.availableTickets, ticket.row ?? null, ticket.section, ticket.rawPrice, ticket.ticketClassName]
                );
            }
        }
    });
}

load()
    .catch((err: unknown) => {
    console.error(`[db:load] ${describeDbError(err)}`);
    process.exitCode = 1;
    })
    .finally(() => closePool());