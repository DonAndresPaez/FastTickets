import { Ticket } from './event';

// ticket in the cart, omitting the stock to avoid confusion with cart quantity
export interface CartItem extends Omit<Ticket, 'quantity'> {
    cart_quantity: number;
    expires_at: string;
}