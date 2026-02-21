import { useState } from 'react'
import { getMarketData } from '../services/api'
import type { MarketData } from '../services/api'

export default function MarketDataPage() {
  const [ticker, setTicker] = useState('')
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async () => {
    if (!ticker) return
    setLoading(true)
    setError('')
    try {
      const result = await getMarketData(ticker.toUpperCase())
      setData(result)
    } catch {
      setError(`No data found for ${ticker.toUpperCase()}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <h1 className="text-3xl font-bold text-emerald-400 mb-2">DeskView</h1>
      <p className="text-gray-400 mb-8">Equity Derivatives Risk Terminal</p>

      {/* Search bar */}
      <div className="flex gap-3 mb-8">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Enter ticker (AAPL, SPY, MSFT...)"
          className="bg-gray-800 border border-gray-700 rounded px-4 py-2 w-80 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-600 text-black font-bold px-6 py-2 rounded transition-colors"
        >
          {loading ? 'Loading...' : 'Search'}
        </button>
      </div>

      {/* Error */}
      {error && <p className="text-red-400 mb-4">{error}</p>}

      {/* Market Data Card */}
      {data && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-fit">
          <h2 className="text-xl font-bold text-emerald-400 mb-4">{data.ticker}</h2>
          <div className="grid grid-cols-2 gap-x-12 gap-y-3">
            <div>
              <p className="text-gray-400 text-sm">Spot Price</p>
              <p className="text-white text-xl font-bold">${data.spot.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Implied Vol</p>
              <p className="text-yellow-400 text-xl font-bold">{(data.implied_vol * 100).toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Risk-Free Rate</p>
              <p className="text-white text-xl font-bold">{(data.risk_free_rate * 100).toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Dividend Yield</p>
              <p className="text-white text-xl font-bold">{data.dividend_yield.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}