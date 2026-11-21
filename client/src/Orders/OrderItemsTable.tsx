import type { OrderItem } from '../types'
import { formatCents, formatDate, toCents } from '../utils/format'

interface OrderItemsTableProps {
  items: OrderItem[]
  showRace?: boolean
}

export default function OrderItemsTable({ items, showRace = true }: OrderItemsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-zinc-100 border-b border-zinc-200 text-xs font-bold uppercase tracking-wider text-zinc-700">
            {showRace && <th className="py-3 px-4">Race</th>}
            <th className="py-3 px-4">Day</th>
            <th className="py-3 px-4">Seat</th>
            <th className="py-3 px-4">Location</th>
            <th className="py-3 px-4 text-right">Unit price</th>
            <th className="py-3 px-4 text-right">Qty</th>
            <th className="py-3 px-4 text-right">Price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 text-sm">
          {items.map((item, i) => (
            <tr key={i}>
              {showRace && (
                <td className="py-3 px-4">
                  <div className="font-semibold text-zinc-900">{item.raceName}</div>
                  <div className="text-xs text-zinc-500">{item.city}</div>
                </td>
              )}
              <td className="py-3 px-4 text-zinc-600">{formatDate(item.eventDay)}</td>
              <td className="py-3 px-4 text-zinc-600">
                {item.section} &middot; {item.row ? `Row ${item.row}` : 'General Admission'}
              </td>
              <td className="py-3 px-4 text-zinc-600">{item.location}</td>
              <td className="py-3 px-4 text-right text-zinc-600">{formatCents(toCents(item.unitPrice))}</td>
              <td className="py-3 px-4 text-right text-zinc-600">{item.quantity}</td>
              <td className="py-3 px-4 text-right font-bold text-zinc-900">
                {formatCents(toCents(item.unitPrice) * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
