export interface OrderItem {
  raceId: number;
  raceName: string;
  city: string;
  eventDay: string; // "YYYY-MM-DD"
  section: string;
  row: string | null;
  location: string;
  unitPrice: string;
  quantity: number;
}

export interface Order {
  id: string;
  total: string;
  createdAt: Date;
  items: OrderItem[];
}
