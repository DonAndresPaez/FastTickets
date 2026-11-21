import { http } from './http'
import type { Order } from '../types'

export async function getOrders(): Promise<Order[]> {
  const { data } = await http.get<Order[]>('/orders')
  return data
}
