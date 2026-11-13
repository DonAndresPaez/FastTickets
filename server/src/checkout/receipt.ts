import { sendMail } from "../mailer";
import type { Order } from "../types/order";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const toCents = (amount: string) => Math.round(Number(amount) * 100);

export function receiptText(firstName: string, order: Order, balance: string): string {
  const lines = order.items.map((item) => {
    const seat = item.row ? `${item.section}, Row ${item.row}` : item.section;
    const unit = toCents(item.unitPrice);
    return [
      `${item.raceName} (${item.city})`,
      `  ${item.eventDay} - ${seat}`,
      `  ${item.quantity} x ${money(unit)} = ${money(unit * item.quantity)}`,
    ].join("\n");
  });

  return [
    `Hi ${firstName},`,
    "",
    `Thanks for your purchase! Your order #${order.id} is confirmed.`,
    "",
    "Tickets:",
    "",
    lines.join("\n\n"),
    "",
    `Total: ${money(toCents(order.total))}`,
    `Remaining balance: ${money(toCents(balance))}`,
    "",
    "You can see your tickets any time in your FastTickets account.",
  ].join("\n");
}

export async function sendOrderConfirmation(
  email: string,
  firstName: string,
  order: Order,
  balance: string,
): Promise<void> {
  await sendMail(email, `Your FastTickets order #${order.id}`, receiptText(firstName, order, balance));
}
