export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  balance: string
}

export interface Race {
  id: number
  race_name: string
  city: string
  start_date: string
  end_date: string
}

export interface Ticket {
  id: number
  race_id: number
  event_day: string
  quantity: number
  row: string | null
  section: string
  price: string
  location: string
}

export interface CartItem {
  id: number
  race_id: number
  event_day: string
  row: string | null
  section: string
  price: string
  location: string
  quantity: number
  expires_at: string
}

export interface OrderItem {
  raceId: number
  raceName: string
  city: string
  eventDay: string
  section: string
  row: string | null
  location: string
  unitPrice: string
  quantity: number
}

export interface Order {
  id: string
  total: string
  createdAt: string
  items: OrderItem[]
}

export interface CheckoutResponse {
  order: Order
  balance: string
  emailSent: boolean
}
