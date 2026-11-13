import { useEffect, useState } from 'react'
import { http, getErrorMessage } from '../api/http'

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  balance: string
}

interface Race {
  id: number
  race_name: string
  city: string
  start_date: string
  end_date: string
}

interface Ticket {
  id: number
  race_id: number
  event_day: string
  quantity: number
  row: string | null
  section: string
  price: string
  location: string
}

interface DashboardProps {
  user: User
  onLogout: () => void
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [races, setRaces] = useState<Race[]>([])
  const [selectedRace, setSelectedRace] = useState<Race | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCityFilter, setSelectedCityFilter] = useState('all')
  const [selectedDay, setSelectedDay] = useState('all')
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('all')
  const [loadingRaces, setLoadingRaces] = useState(false)
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [raceError, setRaceError] = useState('')

  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const parts = dateString.split('-')
    if (parts.length === 3) {
      const [year, month, day] = parts
      return `${month}/${day}/${year}`
    }
    return dateString
  }

  useEffect(() => {
    setLoadingRaces(true)
    http
      .get<Race[]>('/races')
      .then(({ data }) => setRaces(data))
      .catch((err) => setRaceError(getErrorMessage(err)))
      .finally(() => setLoadingRaces(false))
  }, [])

  const handleSelectRace = async (race: Race) => {
    setSelectedRace(race)
    setSelectedDay('all')
    setSelectedSectionFilter('all')
    setSortField(null)
    setSortDirection(null)
    setLoadingTickets(true)
    setRaceError('')
    try {
      const { data } = await http.get<Ticket[]>(`/races/${race.id}/tickets`)
      setTickets(data)
    } catch (err) {
      setRaceError(getErrorMessage(err))
    } finally {
      setLoadingTickets(false)
    }
  }

  const handleDayChange = async (day: string) => {
    setSelectedDay(day)
    if (!selectedRace) return
    setLoadingTickets(true)
    setRaceError('')
    try {
      const url = day === 'all' ? `/races/${selectedRace.id}/tickets` : `/races/${selectedRace.id}/tickets?day=${day}`
      const { data } = await http.get<Ticket[]>(url)
      setTickets(data)
    } catch (err) {
      setRaceError(getErrorMessage(err))
    } finally {
      setLoadingTickets(false)
    }
  }

  const handleSort = (field: string) => {
    if (sortField !== field) {
      setSortField(field)
      setSortDirection('asc')
    } else if (sortDirection === 'asc') {
      setSortDirection('desc')
    } else {
      setSortField(null)
      setSortDirection(null)
    }
  }

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <span className="text-zinc-400 text-xs ml-1">&#x2195;</span>
    }
    if (sortDirection === 'asc') {
      return <span className="text-[#e10600] text-xs ml-1">&#x2191;</span>
    }
    if (sortDirection === 'desc') {
      return <span className="text-[#e10600] text-xs ml-1">&#x2193;</span>
    }
    return <span className="text-zinc-400 text-xs ml-1">&#x2195;</span>
  }

  const cities = Array.from(new Set(races.map((r) => r.city)))
  const filteredRaces = races.filter((race) => {
    const matchesSearch =
      race.race_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      race.city.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCity = selectedCityFilter === 'all' || race.city === selectedCityFilter
    return matchesSearch && matchesCity
  })

  const ticketSections = Array.from(new Set(tickets.map((t) => t.section)))
  const filteredTickets = tickets.filter((ticket) => {
    if (selectedSectionFilter === 'all') return true
    return ticket.section === selectedSectionFilter
  })

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    if (!sortField || !sortDirection) return 0

    let aVal: any = a[sortField as keyof Ticket]
    let bVal: any = b[sortField as keyof Ticket]

    if (sortField === 'price') {
      aVal = parseFloat(aVal) || 0
      bVal = parseFloat(bVal) || 0
    } else if (sortField === 'quantity') {
      aVal = Number(aVal) || 0
      bVal = Number(bVal) || 0
    } else {
      aVal = aVal || ''
      bVal = bVal || ''
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  return (
    <div className="min-h-screen bg-[#f3f3f3] text-zinc-900 flex flex-col justify-between font-sans">
      <div>
        <header className="bg-[#15151e] border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span>
              <img src="../../public/logo.svg" width="130" alt="Logo" />
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-300">
            <span>
              Welcome, <strong className="text-white">{user.firstName}</strong>
            </span>
            <span>
              Credits: <strong className="text-white">${user.balance}</strong>
            </span>
            <button
              onClick={onLogout}
              className="bg-[#e10600] hover:bg-red-700 text-white font-bold py-1.5 px-4 rounded text-xs uppercase tracking-wider transition-colors"
            >
              Log out
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {selectedRace ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedRace(null)}
                  className="text-sm font-semibold text-[#e10600] hover:underline flex items-center gap-1"
                >
                  &larr; Back to all races
                </button>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#e10600] bg-red-50 px-2.5 py-1 rounded">
                      {selectedRace.city} Circuit
                    </span>
                    <h1 className="text-2xl font-extrabold uppercase tracking-wide text-zinc-900 mt-2">
                      {selectedRace.race_name}
                    </h1>
                  </div>
                  <div className="text-right text-sm text-zinc-600 bg-zinc-50 p-3 rounded border border-zinc-100">
                    <div className="font-medium text-zinc-900">Race Weekend Dates</div>
                    <div>
                      {formatDate(selectedRace.start_date)} to {formatDate(selectedRace.end_date)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm border border-zinc-200 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Filter by Day</label>
                    <select
                      value={selectedDay}
                      onChange={(e) => handleDayChange(e.target.value)}
                      className="px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#e10600]"
                    >
                      <option value="all">All Days</option>
                      <option value={selectedRace.start_date}>{formatDate(selectedRace.start_date)} (Day 1)</option>
                      {selectedRace.start_date !== selectedRace.end_date && (
                        <option value={selectedRace.end_date}>{formatDate(selectedRace.end_date)} (Race Day / Final)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Filter by Section</label>
                    <select
                      value={selectedSectionFilter}
                      onChange={(e) => setSelectedSectionFilter(e.target.value)}
                      className="px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#e10600]"
                    >
                      <option value="all">All Sections ({ticketSections.length})</option>
                      {ticketSections.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="text-sm text-zinc-500 font-medium">
                  Showing {sortedTickets.length} ticket listings
                </div>
              </div>

              {raceError && (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {raceError}
                </p>
              )}

              {loadingTickets ? (
                <div className="text-center py-12 text-zinc-500 font-medium">Loading ticket listings...</div>
              ) : sortedTickets.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-zinc-200 text-zinc-500">
                  No ticket listings found matching your criteria.
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-100 border-b border-zinc-200 text-xs font-bold uppercase tracking-wider text-zinc-700">
                          <th className="py-3 px-4 cursor-pointer select-none hover:bg-zinc-200 transition-colors" onClick={() => handleSort('section')}>
                            <div className="flex items-center">
                              Section {renderSortIcon('section')}
                            </div>
                          </th>
                          <th className="py-3 px-4 cursor-pointer select-none hover:bg-zinc-200 transition-colors" onClick={() => handleSort('row')}>
                            <div className="flex items-center">
                              Row {renderSortIcon('row')}
                            </div>
                          </th>
                          <th className="py-3 px-4 cursor-pointer select-none hover:bg-zinc-200 transition-colors" onClick={() => handleSort('event_day')}>
                            <div className="flex items-center">
                              Day {renderSortIcon('event_day')}
                            </div>
                          </th>
                          <th className="py-3 px-4 cursor-pointer select-none hover:bg-zinc-200 transition-colors" onClick={() => handleSort('quantity')}>
                            <div className="flex items-center">
                              Available Qty {renderSortIcon('quantity')}
                            </div>
                          </th>
                          <th className="py-3 px-4 cursor-pointer select-none hover:bg-zinc-200 transition-colors" onClick={() => handleSort('price')}>
                            <div className="flex items-center">
                              Price {renderSortIcon('price')}
                            </div>
                          </th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 text-sm">
                        {sortedTickets.map((ticket) => (
                          <tr key={ticket.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="py-3 px-4 font-semibold text-zinc-900">{ticket.section}</td>
                            <td className="py-3 px-4 text-zinc-600">{ticket.row ? `Row ${ticket.row}` : 'General Admission'}</td>
                            <td className="py-3 px-4 text-zinc-600">{formatDate(ticket.event_day)}</td>
                            <td className="py-3 px-4 text-zinc-600">{ticket.quantity}</td>
                            <td className="py-3 px-4 font-bold text-[#e10600]">${ticket.price}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => alert(`Selected listing ID ${ticket.id} in section ${ticket.section} for $${ticket.price}`)}
                                className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-1.5 px-3 rounded text-xs uppercase tracking-wider transition-colors"
                              >
                                Select
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-extrabold uppercase tracking-wide text-zinc-900">
                  Formula 1 Races & Circuits
                </h1>
                <p className="text-sm text-zinc-600 mt-1">
                  Browse upcoming Grand Prix events, filter by circuit city, and search for specific races or venues.
                </p>
              </div>

              <hr className="border-zinc-300" />

              <div className="bg-white p-4 rounded-lg shadow-sm border border-zinc-200 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex-1 min-w-[260px]">
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Search Race or Circuit</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. Austin, Mexico, Las Vegas..."
                    className="w-full px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#e10600]"
                  />
                </div>

                <div className="w-full sm:w-auto min-w-[200px]">
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Filter by Circuit / City</label>
                  <select
                    value={selectedCityFilter}
                    onChange={(e) => setSelectedCityFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#e10600]"
                  >
                    <option value="all">All Circuits / Cities</option>
                    {cities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {raceError && (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {raceError}
                </p>
              )}

              {loadingRaces ? (
                <div className="text-center py-12 text-zinc-500 font-medium">Loading races and circuits...</div>
              ) : filteredRaces.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-zinc-200 text-zinc-500">
                  No races found matching your search or filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredRaces.map((race) => (
                    <div
                      key={race.id}
                      onClick={() => handleSelectRace(race)}
                      className="bg-white rounded-lg shadow-sm border border-zinc-200 hover:border-[#e10600] cursor-pointer transition-all p-6 flex flex-col justify-between group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#e10600] bg-red-50 px-2 py-0.5 rounded">
                            {race.city}
                          </span>
                          <span className="text-xs text-zinc-500 font-medium">
                            {formatDate(race.start_date)}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-zinc-900 group-hover:text-[#e10600] transition-colors">
                          {race.race_name}
                        </h3>
                      </div>
                      <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-zinc-700">
                        <span>Weekend: {formatDate(race.start_date)} - {formatDate(race.end_date)}</span>
                        <span className="text-[#e10600] group-hover:translate-x-1 transition-transform inline-block">
                          View Details &rarr;
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}