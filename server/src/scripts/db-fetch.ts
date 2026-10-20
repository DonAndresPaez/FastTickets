// npm run db:fetch [city or YYYY-MM-DD]
// Pulls StubHub listings from the TicketsData API into eventData.json. Run npm run db:load after.
// The API has a small quota (one call per race day), so pass a city or day to only refresh that part.
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env";
import type { RaceData, TicketData } from "../types/event";

const filePath = path.resolve(__dirname, "../../database/dummy/eventData.json");

// rest of the 2026 season, one StubHub event page per race day
const races: { race: RaceData["race"]; days: Record<string, string> }[] = [
  {
    race: { race_name: "MSC Cruises United States Grand Prix", city: "Austin", start_date: "2026-10-23", end_date: "2026-10-25" },
    days: {
      "2026-10-23": "https://www.stubhub.com/formula-1-austin-tickets-10-23-2026/event/158487731/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
      "2026-10-24": "https://www.stubhub.com/formula-1-austin-tickets-10-24-2026/event/158501986/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
      "2026-10-25": "https://www.stubhub.com/formula-1-austin-tickets-10-25-2026/event/158487750/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
    },
  },
  {
    race: { race_name: "Mexico City Grand Prix", city: "Mexico City", start_date: "2026-10-30", end_date: "2026-11-01" },
    days: {
      "2026-10-30": "https://www.stubhub.com/formula-1-mexico-df-tickets-10-30-2026/event/158509294/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
      "2026-10-31": "https://www.stubhub.com/formula-1-mexico-df-tickets-10-31-2026/event/158509300/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
      "2026-11-01": "https://www.stubhub.com/formula-1-mexico-df-tickets-11-1-2026/event/158509302/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
    },
  },
  {
    race: { race_name: "Heineken Las Vegas Grand Prix", city: "Las Vegas", start_date: "2026-11-19", end_date: "2026-11-21" },
    days: {
      "2026-11-19": "https://www.stubhub.com/formula-1-las-vegas-tickets-11-19-2026/event/158487337/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
      "2026-11-20": "https://www.stubhub.com/formula-1-las-vegas-tickets-11-20-2026/event/158487348/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
      "2026-11-21": "https://www.stubhub.com/formula-1-las-vegas-tickets-11-21-2026/event/158487350/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
    },
  },
  {
    race: { race_name: "Qatar Airways Qatar Grand Prix", city: "Doha", start_date: "2026-11-27", end_date: "2026-11-29" },
    days: {
      "2026-11-27": "https://www.stubhub.com/formula-1-doha-tickets-11-27-2026/event/158509368/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
      "2026-11-28": "https://www.stubhub.com/formula-1-doha-tickets-11-28-2026/event/158509377/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
      "2026-11-29": "https://www.stubhub.com/formula-1-doha-tickets-11-29-2026/event/158509384/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
    },
  },
  {
    race: { race_name: "Etihad Airways Abu Dhabi Grand Prix", city: "Abu Dhabi", start_date: "2026-12-04", end_date: "2026-12-06" },
    days: {
      "2026-12-04": "https://www.stubhub.com/formula-1-abu-dhabi-tickets-12-4-2026/event/158509395/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
      "2026-12-05": "https://www.stubhub.com/formula-1-abu-dhabi-tickets-12-5-2026/event/158509405/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
      "2026-12-06": "https://www.stubhub.com/formula-1-abu-dhabi-tickets-12-6-2026/event/158509416/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328",
    },
  },
];

async function fetchListings(url: string): Promise<TicketData[]> {
  const params = new URLSearchParams({
    username: env.ticketsData.user,
    password: env.ticketsData.pass,
    platform: "stubhub",
    event_url: url,
  });

  const res = await fetch("https://ticketsdata.com/fetch?" + params);
  if (!res.ok) {
    throw new Error(`TicketsData returned ${res.status}`);
  }

  const data = (await res.json()) as { body?: { items?: unknown }; quota_remaining?: number };
  const items = data.body?.items;
  // don't let an error response replace good data
  if (!Array.isArray(items)) {
    throw new Error("Response has no listings: " + JSON.stringify(data).slice(0, 200));
  }
  if (data.quota_remaining !== undefined) {
    console.log(`[db:fetch] quota left: ${data.quota_remaining}`);
  }

  // keep only what db:load uses (plus listingId), the full response is huge
  return (items as TicketData[]).map((item) => ({
    listingId: item.listingId,
    availableTickets: item.availableTickets,
    rawPrice: item.rawPrice,
    ...(item.row ? { row: item.row } : {}),
    section: item.section,
    ticketClassName: item.ticketClassName,
  }));
}

async function main(): Promise<void> {
  if (!env.ticketsData.user || !env.ticketsData.pass) {
    throw new Error("Set TICKETSDATA_USER and TICKETSDATA_PASS in server/.env (see .env.example)");
  }

  const filter = process.argv[2]?.toLowerCase();

  // start from the current file so days we skip or fail on keep their old data
  const results: Record<string, RaceData> = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, "utf-8"))
    : {};

  let updated = 0;
  let failed = 0;

  for (const { race, days } of races) {
    for (const [day, url] of Object.entries(days)) {
      if (filter && race.city.toLowerCase() !== filter && day !== filter) continue;

      try {
        console.log(`[db:fetch] ${race.city} ${day}`);
        const items = await fetchListings(url);
        results[url] = { race, day, body: { items } };
        updated++;
      } catch (err) {
        console.error(`[db:fetch] ${race.city} ${day} failed:`, err instanceof Error ? err.message : err);
        failed++;
      }
    }
  }

  if (updated === 0 && failed === 0) {
    throw new Error(`Nothing matches "${process.argv[2]}". Use a city (e.g. austin) or a day (YYYY-MM-DD)`);
  }

  console.log(`[db:fetch] updated ${updated} day(s), ${failed} failed`);
  if (updated > 0) {
    fs.writeFileSync(filePath, JSON.stringify(results, null, 4));
    console.log("[db:fetch] saved, run npm run db:load to put it in the database");
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(`[db:fetch] ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
