import { useState, useEffect } from 'react'
import { getMarketData, getMaturities, getGreeks } from '../services/api'
import { useBook } from '../contexts/BookContext'

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

  // Re-fetch maturities when switching to option type
  useEffect(() => {
    if (productType !== 'stock' && ticker && spot !== null && maturities.length === 0) {
      setLoadingMaturities(true)
      getMaturities(ticker.toUpperCase())
        .then((mats) => {
          setMaturities(mats)
          if (mats.length > 0) setSelectedMaturity(mats[0])
        })
        .finally(() => setLoadingMaturities(false))
    }
  }, [productType])

  const isValid =
    ticker.trim().length > 0 &&
    quantity !== '' &&
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
        addPosition({
          ticker: t,
          productType: 'stock',
          quantity: qty,
          currentPrice: md.spot,
          spot: md.spot,
          greeks: { delta: qty, gamma: 0, vega: 0, theta: 0, rho: 0 },
        })
      } else {
        const result = await getGreeks({
          ticker: t,
          option_type: productType,
          strike: parseFloat(strike),
          maturity: selectedMaturity,
          quantity: qty,
        })
        addPosition({
          ticker: t,
          productType,
          strike: parseFloat(strike),
          maturity: selectedMaturity,
          quantity: qty,
          currentPrice: result.price,
          spot: result.spot,
          greeks: {
            delta: result.delta,
            gamma: result.gamma,
            vega: result.vega,
            theta: result.theta,
            rho: result.rho,
          },
        })
      }
      onClose()
    } catch {
      setError('Erreur lors de la récupération des données. Vérifiez les paramètres.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1F1F28] border border-[#333340] rounded-xl w-full max-w-md mx-4 shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333340]">
          <h3 className="text-white font-bold">Ajouter une position</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">

          {/* Ticker */}
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Ticker</label>
            <div className="relative">
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onBlur={() => fetchTickerData(ticker)}
                onKeyDown={(e) => e.key === 'Enter' && fetchTickerData(ticker)}
                placeholder="AAPL, SPY, MSFT..."
                className="w-full bg-[#14141A] border border-[#333340] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#1677FF] font-mono"
              />
              {spot !== null && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1677FF] text-sm font-mono">
                  ${spot.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Product type */}
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Type de produit</label>
            <div className="flex gap-2">
              {(['stock', 'call', 'put'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setProductType(type)}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm uppercase transition-colors ${
                    productType === type
                      ? type === 'stock'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                        : type === 'call'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                        : 'bg-red-500/20 text-red-400 border border-red-500/50'
                      : 'bg-[#1F1F23] text-gray-400 border border-[#333340] hover:border-[#1677FF]/30'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Strike + Maturity (options only) */}
          {productType !== 'stock' && (
            <>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Strike</label>
                <input
                  type="number"
                  value={strike}
                  onChange={(e) => setStrike(e.target.value)}
                  placeholder="200.00"
                  min="0"
                  className="w-full bg-[#14141A] border border-[#333340] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#1677FF] font-mono"
                />
              </div>

              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">
                  Maturité
                  {loadingMaturities && <span className="text-gray-500 normal-case ml-1">(chargement...)</span>}
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={selectedMaturity}
                    onChange={(e) => setSelectedMaturity(e.target.value)}
                    className="w-full bg-[#14141A] border border-[#333340] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#1677FF] disabled:text-gray-500"
                  />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.5 2a.5.5 0 0 1 .5.5V4h8V2.5a.5.5 0 1 1 1 0v1.5h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V2.5a.5.5 0 0 1 .5-.5zm-3 5h14v9h-14v-9z"/>
                  </svg>
                </div>
              </div>
            </>
          )}

          {/* Quantity */}
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Quantité</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
              step="1"
              className="w-full bg-[#14141A] border border-[#333340] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#1677FF] font-mono"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#333340] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-[#1F1F23] text-gray-400 hover:bg-[#2A2A30] font-medium transition-colors border border-[#333340]"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !isValid}
            className="flex-1 py-2.5 rounded-lg bg-[#1677FF] hover:bg-[#2F8CFF] disabled:bg-[#1F1F23] disabled:text-gray-500 text-white font-bold transition-colors"
          >
            {submitting ? 'Chargement...' : 'Ajouter au book'}
          </button>
        </div>
      </div>
    </div>
  )
}
