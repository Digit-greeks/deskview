import { useState } from 'react'
import { getMaturities, getGreeks } from '../services/api'
import type { GreeksResponse } from '../services/api'

interface GreekCardProps {
  label: string
  value: number
  description: string
  color: string
  decimals?: number
}

function GreekCard({ label, value, description, color, decimals = 4 }: GreekCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${color}`}>{label}</p>
      <p className="text-white text-2xl font-mono font-bold">{value.toFixed(decimals)}</p>
      <p className="text-gray-600 text-xs mt-1">{description}</p>
    </div>
  )
}

export default function GreeksCalculatorPage() {
  const [ticker, setTicker] = useState('')
  const [optionType, setOptionType] = useState<'call' | 'put'>('call')
  const [strike, setStrike] = useState('')
  const [maturities, setMaturities] = useState<string[]>([])
  const [selectedMaturity, setSelectedMaturity] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [result, setResult] = useState<GreeksResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMaturities, setLoadingMaturities] = useState(false)
  const [error, setError] = useState('')

  const fetchMaturities = async (t: string) => {
    if (!t.trim()) return
    setLoadingMaturities(true)
    setMaturities([])
    setSelectedMaturity('')
    setResult(null)
    setError('')
    try {
      const data = await getMaturities(t.toUpperCase())
      setMaturities(data)
      if (data.length > 0) setSelectedMaturity(data[0])
    } catch {
      // silent — user will see error on calculate
    } finally {
      setLoadingMaturities(false)
    }
  }

  const handleCalculate = async () => {
    if (!ticker || !strike || !selectedMaturity) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await getGreeks({
        ticker: ticker.toUpperCase(),
        option_type: optionType,
        strike: parseFloat(strike),
        maturity: selectedMaturity,
        quantity: parseFloat(quantity) || 1,
      })
      setResult(data)
    } catch {
      setError(`Impossible de calculer les Greeks pour ${ticker.toUpperCase()}. Vérifiez le ticker et les paramètres.`)
    } finally {
      setLoading(false)
    }
  }

  const isFormValid = ticker.trim().length > 0 && strike.length > 0 && selectedMaturity.length > 0

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <h2 className="text-2xl font-bold text-white mb-1">Greeks Calculator</h2>
      <p className="text-gray-500 text-sm mb-8">Black-Scholes pricing — données marché réelles</p>

      <div className="flex flex-col lg:flex-row gap-8">

        {/* ── Form ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full lg:w-80 flex-shrink-0">
          <div className="space-y-5">

            {/* Ticker */}
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Sous-jacent</label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onBlur={() => fetchMaturities(ticker)}
                onKeyDown={(e) => e.key === 'Enter' && fetchMaturities(ticker)}
                placeholder="AAPL, SPY, MSFT..."
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-400 uppercase font-mono"
              />
            </div>

            {/* Call / Put */}
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Type d'option</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setOptionType('call')}
                  className={`flex-1 py-2 rounded font-bold text-sm transition-colors ${
                    optionType === 'call'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  CALL
                </button>
                <button
                  onClick={() => setOptionType('put')}
                  className={`flex-1 py-2 rounded font-bold text-sm transition-colors ${
                    optionType === 'put'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  PUT
                </button>
              </div>
            </div>

            {/* Strike */}
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Strike</label>
              <input
                type="number"
                value={strike}
                onChange={(e) => setStrike(e.target.value)}
                placeholder="200.00"
                min="0"
                step="1"
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-400 font-mono"
              />
            </div>

            {/* Maturity */}
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">
                Maturité{loadingMaturities && <span className="text-gray-600 normal-case ml-1">(chargement...)</span>}
              </label>
              <select
                value={selectedMaturity}
                onChange={(e) => setSelectedMaturity(e.target.value)}
                disabled={maturities.length === 0}
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-emerald-400 disabled:text-gray-600 font-mono"
              >
                {maturities.length === 0
                  ? <option value="">Entrez un ticker d'abord</option>
                  : maturities.map((m) => <option key={m} value={m}>{m}</option>)
                }
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Quantité</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                step="1"
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-400 font-mono"
              />
              <p className="text-gray-600 text-xs mt-1">Positif = long · Négatif = short</p>
            </div>

            {/* Submit */}
            <button
              onClick={handleCalculate}
              disabled={loading || !isFormValid}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-800 disabled:text-gray-600 text-black font-bold py-3 rounded transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Calcul...
                </span>
              ) : 'Calculer les Greeks'}
            </button>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="flex-1 min-w-0">

          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6 text-red-400 text-sm">
              {error}
            </div>
          )}

          {!result && !error && (
            <div className="flex items-center justify-center h-64 border border-gray-800 rounded-lg">
              <p className="text-gray-700 text-sm">Entrez les paramètres et calculez pour voir les résultats</p>
            </div>
          )}

          {result && (
            <div className="space-y-6">

              {/* Price header */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <div className="flex flex-wrap items-end gap-8">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Prix option</p>
                    <p className="text-emerald-400 text-4xl font-mono font-bold">${result.price.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Spot</p>
                    <p className="text-gray-200 text-2xl font-mono">${result.spot.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Strike</p>
                    <p className="text-gray-200 text-2xl font-mono">${result.strike.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Type</p>
                    <p className={`text-2xl font-bold uppercase font-mono ${result.option_type === 'call' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {result.option_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Ticker</p>
                    <p className="text-gray-200 text-2xl font-mono">{result.ticker}</p>
                  </div>
                </div>
              </div>

              {/* Greeks grid */}
              <div>
                <p className="text-gray-600 text-xs uppercase tracking-wider mb-3">Greeks</p>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  <GreekCard
                    label="Delta"
                    value={result.delta}
                    description="Sensibilité au prix spot"
                    color="text-blue-400"
                  />
                  <GreekCard
                    label="Gamma"
                    value={result.gamma}
                    description="Variation du delta"
                    color="text-purple-400"
                    decimals={6}
                  />
                  <GreekCard
                    label="Vega"
                    value={result.vega}
                    description="Sensibilité à la vol (+1%)"
                    color="text-yellow-400"
                  />
                  <GreekCard
                    label="Theta"
                    value={result.theta}
                    description="Décroissance temporelle (par jour)"
                    color="text-red-400"
                  />
                  <GreekCard
                    label="Rho"
                    value={result.rho}
                    description="Sensibilité aux taux (+1%)"
                    color="text-gray-400"
                  />
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
