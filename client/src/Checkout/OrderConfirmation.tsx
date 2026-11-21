import type { Order } from '../types'
import { formatCents, toCents } from '../utils/format'
import OrderItemsTable from '../Orders/OrderItemsTable'

interface OrderConfirmationProps {
  order: Order
  balance: string
  emailSent: boolean
  onDone: () => void
  onViewOrders?: () => void
}

export default function OrderConfirmation({ order, balance, emailSent, onDone, onViewOrders }: OrderConfirmationProps) {
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
        <OrderItemsTable items={order.items} />
        <div className="border-t border-zinc-200 p-4 text-sm flex flex-col items-end gap-1">
          <div>
            Total: <strong className="text-[#e10600]">{formatCents(toCents(order.total))}</strong>
          </div>
          <div className="text-zinc-600">
            Remaining credits: <strong className="text-zinc-900">{formatCents(toCents(balance))}</strong>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={onDone}
          className="bg-[#e10600] hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded text-sm uppercase tracking-wider transition-colors"
        >
          Back to races
        </button>
        {onViewOrders && (
          <button
            onClick={onViewOrders}
            className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-2.5 px-6 rounded text-sm uppercase tracking-wider transition-colors"
          >
            View all orders
          </button>
        )}
      </div>
    </div>
  )
}
