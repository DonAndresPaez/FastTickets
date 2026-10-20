// all dates follow "YYYY-MM-DD"
export interface Race {
    id: number;
    race_name: string;
    city: string;
    start_date: string;
    end_date: string;
}

export interface Ticket {
    id: number;
    race_id: number;
    event_day: string;
    quantity: number;
    row: string | null; // if null, then the ticket is general admission
    section: string;
    price: string;
    location: string;
}

// one race day in eventData.json, written by db:fetch and read by db:load
export interface RaceData {
    race: {
        race_name: string;
        city: string;
        start_date: string;
        end_date: string;
    };
    day: string;
    body: { items: TicketData[] };
}

// one StubHub listing from the TicketsData API
export interface TicketData {
    listingId: number;
    availableTickets: number;
    rawPrice: number;
    row?: string;
    section: string;
    ticketClassName: string;
}
