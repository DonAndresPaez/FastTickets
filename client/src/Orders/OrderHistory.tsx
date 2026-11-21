import { useEffect, useState } from 'react'
import { getErrorMessage } from '../api/http'
import { getOrders } from '../api/orders'
import type { Order } from '../types'
import { formatCents, toCents, todayISO } from '../utils/format'
import OrderDetail from './OrderDetail'

interface OrderHistoryProps {
  onBrowse: () => void
}

type TimeFilter = 'all' | 'upcoming' | 'past'
type SortOrder = 'newest' | 'oldest' | 'total'

const ticketCount = (order: Order) => order.items.reduce((sum, item) => sum + item.quantity, 0)

// An order is upcoming while any of its event days is today or later
const isUpcoming = (order: Order, today: string) => order.items.some((item) => item.eventDay >= today)

export default function OrderHistory({ onBrowse }: OrderHistoryProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [search, setSearch] = useState('')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')

  useEffect(() => {
    getOrders()
      .then(setOrders)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  if (selectedOrder) {
    return (
      <OrderDetail
        order={selectedOrder}
        onBack={() => {
          setSelectedOrder(null)
          window.scrollTo({ top: 0 })
        }}
      />
    )
  }

  const today = todayISO()
  const totalSpentCents = orders.reduce((sum, order) => sum + toCents(order.total), 0)
  const totalTickets = orders.reduce((sum, order) => sum + ticketCount(order), 0)

  const query = search.trim().toLowerCase().replace(/^#/, '')
  const visibleOrders = orders
    .filter((order) => {
      if (timeFilter === 'upcoming' && !isUpcoming(order, today)) return false
      if (timeFilter === 'past' && isUpcoming(order, today)) return false
      if (!query) return true
      return (
        order.id.includes(query) ||
        order.items.some(
          (item) => item.raceName.toLowerCase().includes(query) || item.city.toLowerCase().includes(query),
        )
      )
    })
    .sort((a, b) => {
      if (sortOrder === 'total') return toCents(b.total) - toCents(a.total)
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return sortOrder === 'newest' ? diff : -diff
    })

  const stats = [
    { label: 'Orders', value: String(orders.length) },
    { label: 'Tickets bought', value: String(totalTickets) },
    { label: 'Total spent', value: formatCents(totalSpentCents) },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold uppercase tracking-wide text-zinc-900">My Orders</h1>
        <p className="text-sm text-zinc-600 mt-1">Every ticket purchase you've made, with full details.</p>
      </div>

      <hr className="border-zinc-300" />

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500 font-medium">Loading your orders...</div>
      ) : orders.length === 0 ? (
        !error && (
          <div className="text-center py-12 bg-white rounded-lg border border-zinc-200 text-zinc-500 space-y-4">
            <p>You haven't bought any tickets yet.</p>
            <button
              onClick={onBrowse}
              className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-2 px-4 rounded text-xs uppercase tracking-wider transition-colors"
            >
              Browse races
            </button>
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white p-4 rounded-lg shadow-sm border border-zinc-200">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{stat.label}</div>
                <div className="text-2xl font-extrabold text-zinc-900 mt-1">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border border-zinc-200 flex flex-wrap gap-4 items-end justify-between">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs font-medium text-zinc-600 mb-1">Search orders</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Race, city or order #"
                className="w-full px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#e10600]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Show</label>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                className="px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#e10600]"
              >
                <option value="all">All orders</option>
                <option value="upcoming">Upcoming races</option>
                <option value="past">Past races</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Sort by</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#e10600]"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="total">Highest total</option>
              </select>
            </div>
          </div>

          {visibleOrders.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-zinc-200 text-zinc-500">
              No orders match your filters.
            </div>
          ) : (
            <div className="space-y-4">
              {visibleOrders.map((order) => {
                const races = [...new Map(order.items.map((item) => [item.raceId, item])).values()]
                const upcoming = isUpcoming(order, today)
                const count = ticketCount(order)
                return (
                  <button
                    key={order.id}
                    onClick={() => {
                      setSelectedOrder(order)
                      window.scrollTo({ top: 0 })
                    }}
                    className="w-full text-left bg-white rounded-lg shadow-sm border border-zinc-200 hover:border-[#e10600] transition-all p-5 group"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-bold text-zinc-900">Order #{order.id}</span>
                          <span
                            className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              upcoming ? 'text-green-700 bg-green-50' : 'text-zinc-500 bg-zinc-100'
                            }`}
                          >
                            {upcoming ? 'Upcoming' : 'Past'}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500">{new Date(order.createdAt).toLocaleString()}</div>
                        <div className="flex flex-wrap gap-2">
                          {races.map((race) => (
                            <span key={race.raceId} className="text-sm text-zinc-700">
                              <span className="text-xs font-bold uppercase tracking-wider text-[#e10600] bg-red-50 px-2 py-0.5 rounded mr-1.5">
                                {race.city}
                              </span>
                              {race.raceName}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-lg font-extrabold text-zinc-900">{formatCents(toCents(order.total))}</div>
                        <div className="text-xs text-zinc-500">
                          {count} ticket{count === 1 ? '' : 's'}
                        </div>
                        <div className="text-xs font-semibold text-[#e10600] group-hover:translate-x-1 transition-transform inline-block">
                          View details &rarr;
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
