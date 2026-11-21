import { useEffect, useRef, useState } from 'react'
import type { CartItem, Race } from '../types'
import { formatCents, formatCountdown, formatDate, toCents } from '../utils/format'

interface CartViewProps {
  items: CartItem[]
  races: Race[]
  balance: string
  onRemove: (ticketId: number) => Promise<void>
  onCheckout: () => Promise<void>
  onBack: () => void
  onExpired: () => void
}

const WARNING_MS = 2 * 60 * 1000

export default function CartView({ items, races, balance, onRemove, onCheckout, onBack, onExpired }: CartViewProps) {
  const [now, setNow] = useState(() => Date.now())
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')
  const notifiedExpired = useRef(new Set<number>())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const raceById = new Map(races.map((r) => [r.id, r]))
  const activeItems = items.filter((item) => new Date(item.expires_at).getTime() > now)

  useEffect(() => {
    const newlyExpired = items.filter(
      (item) => new Date(item.expires_at).getTime() <= now && !notifiedExpired.current.has(item.id),
    )
    if (newlyExpired.length > 0) {
      newlyExpired.forEach((item) => notifiedExpired.current.add(item.id))
      onExpired()
    }
  }, [items, now, onExpired])

  const subtotalCents = activeItems.reduce((sum, item) => sum + toCents(item.price) * item.quantity, 0)
  const balanceCents = toCents(balance)
  const remainingCents = balanceCents - subtotalCents
  const insufficient = subtotalCents > balanceCents

  const handleRemove = async (ticketId: number) => {
    setError('')
    setRemovingId(ticketId)
    try {
      await onRemove(ticketId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove item')
    } finally {
      setRemovingId(null)
    }
  }

  const handleCheckout = async () => {
    setError('')
    setCheckingOut(true)
    try {
      await onCheckout()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm font-semibold text-[#e10600] hover:underline flex items-center gap-1">
        &larr; Continue shopping
      </button>

      <div>
        <h1 className="text-3xl font-extrabold uppercase tracking-wide text-zinc-900">Your Cart</h1>
        <p className="text-sm text-zinc-600 mt-1">Tickets are held for 15 minutes after you add them.</p>
      </div>

      <hr className="border-zinc-300" />

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {activeItems.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-zinc-200 text-zinc-500 space-y-4">
          <p>Your cart is empty.</p>
          <button
            onClick={onBack}
            className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-2 px-4 rounded text-xs uppercase tracking-wider transition-colors"
          >
            Browse races
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
            <ul className="divide-y divide-zinc-200">
              {activeItems.map((item) => {
                const race = raceById.get(item.race_id)
                const remainingMs = new Date(item.expires_at).getTime() - now
                const lineCents = toCents(item.price) * item.quantity
                return (
                  <li key={item.id} className="p-4 flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      {race && (
                        <span className="text-xs font-bold uppercase tracking-wider text-[#e10600] bg-red-50 px-2 py-0.5 rounded">
                          {race.city}
                        </span>
                      )}
                      <div className="font-bold text-zinc-900">{race?.race_name ?? `Race #${item.race_id}`}</div>
                      <div className="text-sm text-zinc-600">
                        {formatDate(item.event_day)} &middot; {item.section} &middot;{' '}
                        {item.row ? `Row ${item.row}` : 'General Admission'}
                      </div>
                      <div className="text-sm text-zinc-600">
                        ${item.price} &times; {item.quantity}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="font-bold text-[#e10600]">{formatCents(lineCents)}</div>
                      <div className={`text-xs font-medium ${remainingMs < WARNING_MS ? 'text-red-600' : 'text-zinc-500'}`}>
                        Held for {formatCountdown(remainingMs)}
                      </div>
                      <button
                        onClick={() => handleRemove(item.id)}
                        disabled={removingId === item.id || checkingOut}
                        className="text-xs text-zinc-600 hover:text-zinc-900 underline disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {removingId === item.id ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Order Summary</h2>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt className="text-zinc-600">Subtotal</dt>
                <dd className="font-bold text-zinc-900">{formatCents(subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-600">Your credits</dt>
                <dd className="text-zinc-900">{formatCents(balanceCents)}</dd>
              </div>
              <div className="flex justify-between border-t border-zinc-100 pt-2">
                <dt className="text-zinc-600">Credits after purchase</dt>
                <dd className={`font-bold ${insufficient ? 'text-red-600' : 'text-zinc-900'}`}>
                  {insufficient ? `-${formatCents(-remainingCents)}` : formatCents(remainingCents)}
                </dd>
              </div>
            </dl>

            {insufficient && (
              <p className="text-sm font-medium text-red-600">
                You don't have enough credits for this order. Remove some tickets to continue.
              </p>
            )}

            <button
              onClick={handleCheckout}
              disabled={checkingOut || insufficient}
              className="w-full bg-[#e10600] hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded text-sm uppercase tracking-wider transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {checkingOut ? 'Processing...' : 'Checkout'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
