import { useEffect, useState, type SubmitEvent } from 'react'
import { http, getErrorMessage } from '../api/http'
import './App.css'

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // page load
  useEffect(() => {
    http
      .get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false))
  }, [])

  const handleLogout = async () => {
    await http.post('/auth/logout').catch(() => undefined)
    setUser(null)
    setPassword('')
  }

  const switchTab = (tab: 'login' | 'signup') => {
    setActiveTab(tab)
    setError('')
  }

  const handleSignup = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await http.post('/auth/signup', { firstName, lastName, email, password })
      console.log('Signed up:', data.user)
      setPassword('')
      setActiveTab('login')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await http.post('/auth/login', { email, password })
      setUser(data.user)
      setPassword('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f3f3] text-zinc-900 flex flex-col justify-between font-sans">
      <div>
        <header className="bg-[#15151e] border-b border-zinc-800 px-6 py-4 flex items-center">
          <div className="flex items-center gap-1">
            <span><img src="../../public/logo.svg" width="130"></img></span>
          </div>
        </header>

        {!user && (
          <nav className="bg-[#2d2d37] flex justify-center text-sm font-semibold">
            <button
              onClick={() => switchTab('login')}
              className={`py-3 px-8 transition-colors border-b-4 ${
                activeTab === 'login'
                  ? 'text-white border-[#e10600] bg-[#383844]'
                  : 'text-zinc-400 border-transparent hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => switchTab('signup')}
              className={`py-3 px-8 transition-colors border-b-4 ${
                activeTab === 'signup'
                  ? 'text-white border-[#e10600] bg-[#383844]'
                  : 'text-zinc-400 border-transparent hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </nav>
        )}

        <main className="max-w-xl mx-auto px-6 py-12">
          {checkingSession ? null : user ? (
            <div className="space-y-6">
              <h1 className="text-3xl font-extrabold uppercase tracking-wide text-zinc-900">
                Welcome, {user.firstName}
              </h1>
              <hr className="border-zinc-300" />
              <p className="text-sm text-zinc-700">Signed in as {user.email}</p>
              <button
                onClick={handleLogout}
                className="bg-[#e10600] hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded text-sm uppercase tracking-wider transition-colors"
              >
                Log out
              </button>
            </div>
          ) : activeTab === 'login' ? (
            <div className="space-y-6">
              <h1 className="text-3xl font-extrabold uppercase tracking-wide text-zinc-900">LOGIN</h1>
              <hr className="border-zinc-300" />

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full px-4 py-3 rounded-lg border border-zinc-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#e10600]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full px-4 py-3 rounded-lg border border-zinc-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#e10600] pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-900"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.98 8.98 0 013.682-.793c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m-4.692-4.692a3 3 0 00-4.243-4.243" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="text-sm font-medium text-red-600">
                    {error}
                  </p>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-[#e10600] hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded text-sm uppercase tracking-wider transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Logging in...' : 'LOGIN'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <h1 className="text-3xl font-extrabold uppercase tracking-wide text-zinc-900">SIGN UP</h1>
              <hr className="border-zinc-300" />

              <form onSubmit={handleSignup} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-zinc-700">First name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter your first name"
                      className="w-full px-4 py-3 rounded-lg border border-zinc-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#e10600]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-zinc-700">Last name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter your last name"
                      className="w-full px-4 py-3 rounded-lg border border-zinc-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#e10600]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full px-4 py-3 rounded-lg border border-zinc-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#e10600]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      className="w-full px-4 py-3 rounded-lg border border-zinc-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#e10600] pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-900"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.98 8.98 0 013.682-.793c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m-4.692-4.692a3 3 0 00-4.243-4.243" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="text-sm font-medium text-red-600">
                    {error}
                  </p>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-[#e10600] hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded text-sm uppercase tracking-wider transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating account...' : 'Sign Up'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App