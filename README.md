# FastTickets
This repository holds the code for the project FastTickets.

- `client/` - React + Tailwind frontend
- `server/` - Node + Express API
- PostgreSQL database (migrations in `server/database/migrations`)

## Frontend setup
1. cd client
2. npm install
3. npm run dev

Runs on http://localhost:5173. Calls to `/api` get forwarded to the server on port 4000.

## Backend setup
1. Install PostgreSQL 16 or newer (https://www.postgresql.org/download/). Keep port 5432 and remember the password you set.
2. cd server
3. npm install
4. Copy `.env.example` to `.env` and put your PostgreSQL password in `PGPASSWORD`. Don't commit `.env`.
5. npm run db:setup (creates the `fasttickets` database and runs the migrations)
6. npm run db:load (fills the database with the race and ticket data)
7. npm run dev

To check that everything works, open http://localhost:4000/api/health/db. It should say `"status": "ok"`. http://localhost:4000/api/races should list the races.

When someone adds a new migration, pull and run `npm run db:setup` again.

Signing up and logging in email a 6-digit code. Not using a real email account yet. The server uses a temporary Ethereal inbox and prints a link to each email in its terminal (`[mail] Sent to ... view it at https://ethereal.email/...`)

## Server scripts
- `npm run dev` - start the API (restarts on changes)
- `npm run build` / `npm start` - build to `dist/` and run it
- `npm run typecheck` - check types
- `npm run db:setup` - create the database if needed and run new migrations
- `npm run db:migrate` - run new migrations only
- `npm run db:reset` - wipe your local database and run all migrations again (run `db:load` after it)
- `npm run db:load` - load the race and ticket data from `database/dummy/eventData.json`. Safe to run again
- `npm run db:fetch` - refresh `eventData.json` from the TicketsData API (see below)

## Database notes
- Use `query` and `withTransaction` from `server/src/db.ts` for all database calls.
- Always pass values as `$1, $2...` params, e.g. `query("SELECT * FROM users WHERE email = $1", [email])`. Never put user input straight into the SQL string.
- Use `withTransaction` when several writes need to succeed or fail together (like checkout).
- Table changes go in a new migration file, e.g. `server/database/migrations/002_create_users.sql`. Don't edit a migration that's already been pushed, make a new one.

## Race and ticket data
Ticket listings come from StubHub through the [TicketsData](https://ticketsdata.com) API. They're saved to `server/database/dummy/eventData.json`, so you only need the API to refresh them. `db:load` copies the file into the database.

To refresh:
1. Put the TicketsData login in `TICKETSDATA_USER` and `TICKETSDATA_PASS` in `server/.env`
2. npm run db:fetch -- austin (a city or a day like `2026-10-23`). Leaving it out refreshes every race day
3. npm run db:load

Each race day costs one API call and the quota is small, so refresh only what you need. The race list and StubHub links are at the top of `server/src/scripts/db-fetch.ts`.

Endpoints:
- `GET /api/races` - all races, sorted by start date
- `GET /api/races/:id` - one race
- `GET /api/races/:id/tickets` - tickets for a race, add `?day=YYYY-MM-DD` for one day
