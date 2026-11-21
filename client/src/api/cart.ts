import { http } from './http'
import type { CartItem, CheckoutResponse } from '../types'

export async function getCart(): Promise<CartItem[]> {
  const { data } = await http.get<CartItem[]>('/cart')
  return data
}

export async function addToCart(ticketId: number, quantity: number): Promise<void> {
  await http.post('/cart', { ticketId, quantity })
}

export async function removeFromCart(ticketId: number): Promise<void> {
  await http.delete(`/cart/${ticketId}`)
}

export async function checkout(): Promise<CheckoutResponse> {
  const { data } = await http.post<CheckoutResponse>('/checkout')
  return data
}
