import { useState, useEffect } from 'react'
import { getMarketData, getMaturities, getGreeks } from '../services/api'
import { useBook } from '../contexts/BookContext'

const C = {
  bg:     '#131316',
  card:   '#1a1a22',
  input:  '#111116',
  border: '#252530',
  accent: '#f97316',
  muted:  '#666',
}

interface Props {
  onClose: () => void
}

export default function AddPositionModal({ onClose }: Props) {
  const { addPosition } = useBook()

  const [ticker, setTicker] = useState('')
  const [productType, setProductType] = useState<'stock' | 'call' | 'put'>('call')
  const [strike, setStrike] = useState('')
  const [maturities, setMaturities] = useState<string[]>([])
  const [selectedMaturity, setSelectedMaturity] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [spot, setSpot] = useState<number | null>(null)
  const [loadingMaturities, setLoadingMaturities] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchTickerData = async (t: string) => {
    if (!t.trim()) return
    setError('')
    try {
      const md = await getMarketData(t.toUpperCase())
      setSpot(md.spot)
      if (productType !== 'stock') {
        setLoadingMaturities(true)
        const mats = await getMaturities(t.toUpperCase())
        setMaturities(mats)
        if (mats.length > 0) setSelectedMaturity(mats[0])
        setLoadingMaturities(false)
      }
    } catch {
      setSpot(null)
      setMaturities([])
      setError('Ticker introuvable')
    }
  }

  useEffect(() => {
    if (productType !== 'stock' && ticker && spot !== null && maturities.length === 0) {
      setLoadingMaturities(true)
      getMaturities(ticker.toUpperCase())
        .then((mats) => { setMaturities(mats); if (mats.length > 0) setSelectedMaturity(mats[0]) })
        .finally(() => setLoadingMaturities(false))
    }
  }, [productType])

  const isValid =
    ticker.trim().length > 0 &&
    parseFloat(quantity) !== 0 &&
    (productType === 'stock' || (strike !== '' && selectedMaturity !== ''))

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError('')
    try {
      const t = ticker.toUpperCase()
      const qty = parseFloat(quantity)
      if (productType === 'stock') {
        const md = await getMarketData(t)
        addPosition({ ticker: t, productType: 'stock', quantity: qty, currentPrice: md.spot, spot: md.spot, greeks: { delta: qty, gamma: 0, vega: 0, theta: 0, rho: 0 } })
      } else {
        const result = await getGreeks({ ticker: t, option_type: productType, strike: parseFloat(strike), maturity: selectedMaturity, quantity: qty })
        addPosition({ ticker: t, productType, strike: parseFloat(strike), maturity: selectedMaturity, quantity: qty, currentPrice: result.price, spot: result.spot, greeks: { delta: result.delta, gamma: result.gamma, vega: result.vega, theta: result.theta, rho: result.rho } })
      }
      onClose()
    } catch {
      setError('Erreur — vérifiez le ticker et les paramètres.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = `w-full rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none font-mono`
  const inputStyle = { background: C.input, border: `1px solid ${C.border}` }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-xl shadow-2xl flex flex-col" style={{ background: C.card, border: `1px solid ${C.border}` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <span className="text-sm font-semibold text-white">Ajouter une position</span>
          <button onClick={onClose} className="text-lg leading-none transition-colors hover:text-white" style={{ color: C.muted }}>×</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Ticker */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: C.muted }}>Ticker</label>
            <div className="relative">
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onBlur={() => fetchTickerData(ticker)}
                onKeyDown={(e) => e.key === 'Enter' && fetchTickerData(ticker)}
                placeholder="AAPL, SPY, MSFT..."
                className={inputClass}
                style={inputStyle}
              />
              {spot !== null && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono" style={{ color: C.accent }}>
                  ${spot.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: C.muted }}>Type</label>
            <div className="flex gap-2">
              {(['stock', 'call', 'put'] as const).map((type) => {
                const active = productType === type
                const colors = { stock: '#3b82f6', call: '#22c55e', put: '#f87171' }
                const col = colors[type]
                return (
                  <button
                    key={type}
                    onClick={() => setProductType(type)}
                    className="flex-1 py-1.5 rounded text-xs font-bold uppercase transition-colors"
                    style={{
                      background: active ? `${col}20` : 'transparent',
                      color: active ? col : C.muted,
                      border: `1px solid ${active ? `${col}50` : C.border}`,
                    }}
                  >
                    {type}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Strike + Maturity */}
          {productType !== 'stock' && (
            <>
              <div>
                <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: C.muted }}>Strike</label>
                <input type="number" value={strike} onChange={(e) => setStrike(e.target.value)} placeholder="200.00" min="0" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: C.muted }}>
                  Maturité {loadingMaturities && <span style={{ color: '#444' }}>(chargement...)</span>}
                </label>
                <select
                  value={selectedMaturity}
                  onChange={(e) => setSelectedMaturity(e.target.value)}
                  disabled={maturities.length === 0}
                  className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-mono"
                  style={{ ...inputStyle, color: maturities.length === 0 ? C.muted : 'white' }}
                >
                  {maturities.length === 0
                    ? <option>Entrez un ticker d'abord</option>
                    : maturities.map((m) => <option key={m} value={m}>{m}</option>)
                  }
                </select>
              </div>
            </>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: C.muted }}>Quantité</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="1" step="1" className={inputClass} style={inputStyle} />
            <p className="text-xs mt-1" style={{ color: '#444' }}>Positif = long · Négatif = short</p>
          </div>

          {error && <p className="text-xs text-[#f87171]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-2" style={{ borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm transition-colors hover:text-white"
            style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}` }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !isValid}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{
              background: submitting || !isValid ? '#1e1e22' : C.accent,
              color: submitting || !isValid ? C.muted : '#000',
            }}
          >
            {submitting ? 'Chargement...' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}
