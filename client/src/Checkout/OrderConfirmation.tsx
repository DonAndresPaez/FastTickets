import type { Order } from '../types'
import { formatCents, formatDate, toCents } from '../utils/format'

interface OrderConfirmationProps {
  order: Order
  balance: string
  emailSent: boolean
  onDone: () => void
}

export default function OrderConfirmation({ order, balance, emailSent, onDone }: OrderConfirmationProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold uppercase tracking-wide text-zinc-900">Order Confirmed</h1>
        <p className="text-sm text-zinc-600 mt-1">
          Order <span className="font-semibold text-zinc-900">#{order.id}</span> placed on{' '}
          {new Date(order.createdAt).toLocaleString()}
        </p>
      </div>

      <hr className="border-zinc-300" />

      {emailSent ? (
        <p className="text-sm font-medium text-green-700">A receipt was emailed to you.</p>
      ) : (
        <p className="text-sm font-medium text-zinc-600">
          We couldn't send the receipt email, but your order went through.
        </p>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-200 text-xs font-bold uppercase tracking-wider text-zinc-700">
                <th className="py-3 px-4">Race</th>
                <th className="py-3 px-4">Day</th>
                <th className="py-3 px-4">Seat</th>
                <th className="py-3 px-4">Qty</th>
                <th className="py-3 px-4 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {order.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-zinc-900">{item.raceName}</div>
                    <div className="text-xs text-zinc-500">{item.city}</div>
                  </td>
                  <td className="py-3 px-4 text-zinc-600">{formatDate(item.eventDay)}</td>
                  <td className="py-3 px-4 text-zinc-600">
                    {item.section} &middot; {item.row ? `Row ${item.row}` : 'General Admission'}
                  </td>
                  <td className="py-3 px-4 text-zinc-600">{item.quantity}</td>
                  <td className="py-3 px-4 text-right font-bold text-zinc-900">
                    {formatCents(toCents(item.unitPrice) * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-zinc-200 p-4 text-sm flex flex-col items-end gap-1">
          <div>
            Total: <strong className="text-[#e10600]">{formatCents(toCents(order.total))}</strong>
          </div>
          <div className="text-zinc-600">
            Remaining credits: <strong className="text-zinc-900">{formatCents(toCents(balance))}</strong>
          </div>
        </div>
      </div>

      <button
        onClick={onDone}
        className="bg-[#e10600] hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded text-sm uppercase tracking-wider transition-colors"
      >
        Back to races
      </button>
    </div>
  )
}
