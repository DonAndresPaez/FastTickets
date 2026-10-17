import fs from "node:fs";
import path from "node:path";

// Events from the rest of the 2026 F1 season
const eventUrls = [
  'https://www.stubhub.com/formula-1-austin-tickets-10-23-2026/event/158487731/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328',
  'https://www.stubhub.com/formula-1-austin-tickets-10-24-2026/event/158501986/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328',
  'https://www.stubhub.com/formula-1-austin-tickets-10-25-2026/event/158487750/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328',
  'https://www.stubhub.com/formula-1-mexico-df-tickets-10-30-2026/event/158509294/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328',
  'https://www.stubhub.com/formula-1-mexico-df-tickets-10-31-2026/event/158509300/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328',
  'https://www.stubhub.com/formula-1-mexico-df-tickets-11-1-2026/event/158509302/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328',
  'https://www.stubhub.com/formula-1-las-vegas-tickets-11-19-2026/event/158487337/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328',
  'https://www.stubhub.com/formula-1-las-vegas-tickets-11-20-2026/event/158487348/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328',
  'https://www.stubhub.com/formula-1-las-vegas-tickets-11-21-2026/event/158487350/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328',
  'https://www.stubhub.com/formula-1-doha-tickets-11-27-2026/event/158509368/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328',
  'https://www.stubhub.com/formula-1-doha-tickets-11-28-2026/event/158509377/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328',
  'https://www.stubhub.com/formula-1-doha-tickets-11-29-2026/event/158509384/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328',
  'https://www.stubhub.com/formula-1-abu-dhabi-tickets-12-4-2026/event/158509395/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328',
  'https://www.stubhub.com/formula-1-abu-dhabi-tickets-12-5-2026/event/158509405/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328',
  'https://www.stubhub.com/formula-1-abu-dhabi-tickets-12-6-2026/event/158509416/?backUrl=%2Fformula-1-tickets%2Fgrouping%2F7948&lt=29.647&lg=-82.328'
]

async function fetchEvent(url: string) {
  // These are the necessary parameters to fetch data from the TicketsData API
  const params = new URLSearchParams({
    username:  "user",
    password:  "pass",
    platform:  "stubhub",
    event_url: url,
  });

  console.log("Fetching event data for URL:", url);
  const res  = await fetch("https://ticketsdata.com/fetch?" + params);
  if (!res.ok) { throw new Error(`Failed to fetch event data for URL: ${url}, status: ${res.status}`); }

  // log data for extra insurance
  const data = await res.json();
  console.log(data);
  return data;
}

async function main() {
  const outputFilePath = "server/database/dummy/eventData.json";

  const results: Record<string, unknown> = {};

  for (const url of eventUrls) {
    try {
      const eventData = await fetchEvent(url);
      results[url] = eventData;
      fs.writeFileSync(outputFilePath, JSON.stringify(results, null, 4));
    } catch (err) {
      console.error("Error fetching event data for URL:", url, err);
    }
  } 

}

main()