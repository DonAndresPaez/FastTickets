import type { Order, OrderItem } from '../types'
import { formatCents, toCents } from '../utils/format'
import OrderItemsTable from './OrderItemsTable'

interface OrderDetailProps {
  order: Order
  onBack: () => void
}

interface RaceGroup {
  raceId: number
  raceName: string
  city: string
  items: OrderItem[]
}

function groupByRace(items: OrderItem[]): RaceGroup[] {
  const groups = new Map<number, RaceGroup>()
  for (const item of items) {
    const group = groups.get(item.raceId)
    if (group) {
      group.items.push(item)
    } else {
      groups.set(item.raceId, { raceId: item.raceId, raceName: item.raceName, city: item.city, items: [item] })
    }
  }
  return [...groups.values()]
}

const lineTotalCents = (items: OrderItem[]) =>
  items.reduce((sum, item) => sum + toCents(item.unitPrice) * item.quantity, 0)

export default function OrderDetail({ order, onBack }: OrderDetailProps) {
  const groups = groupByRace(order.items)
  const ticketCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm font-semibold text-[#e10600] hover:underline flex items-center gap-1">
        &larr; Back to my orders
      </button>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#e10600] bg-red-50 px-2.5 py-1 rounded">
            Order #{order.id}
          </span>
          <h1 className="text-2xl font-extrabold uppercase tracking-wide text-zinc-900 mt-2">Order Details</h1>
          <p className="text-sm text-zinc-600 mt-1">Purchased {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div className="text-right text-sm text-zinc-600 bg-zinc-50 p-3 rounded border border-zinc-100">
          <div>
            {ticketCount} ticket{ticketCount === 1 ? '' : 's'} &middot; {groups.length} race{groups.length === 1 ? '' : 's'}
          </div>
          <div className="text-lg font-extrabold text-[#e10600]">{formatCents(toCents(order.total))}</div>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.raceId} className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#e10600] bg-red-50 px-2 py-0.5 rounded">
                {group.city}
              </span>
              <h2 className="font-bold text-zinc-900">{group.raceName}</h2>
            </div>
            <div className="text-sm text-zinc-600">
              Subtotal: <strong className="text-zinc-900">{formatCents(lineTotalCents(group.items))}</strong>
            </div>
          </div>
          <OrderItemsTable items={group.items} showRace={false} />
        </div>
      ))}

      <div className="bg-white p-4 rounded-lg shadow-sm border border-zinc-200 flex justify-end text-sm">
        <div>
          Order total: <strong className="text-[#e10600] text-base">{formatCents(toCents(order.total))}</strong>
        </div>
      </div>
    </div>
  )
}
