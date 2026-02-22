import { useState, useEffect } from 'react'
import { useBook } from '../contexts/BookContext'
import type { BookPosition } from '../contexts/BookContext'
import { getPriceHistory } from '../services/api'
import type { PricePoint } from '../services/api'
import AddPositionModal from '../components/AddPositionModal'

// ── Helpers ────────────────────────────────────────────────────────────────────

function typeTag(type: BookPosition['productType']) {
  const styles = {
    stock: 'bg-blue-500 text-white',
    call:  'bg-green-500 text-white',
    put:   'bg-red-500 text-white',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${styles[type]}`}>
      {type}
    </span>
  )
}

function signed(n: number, decimals = 4) {
  const s = n.toFixed(decimals)
  return n >= 0 ? `+${s}` : s
}

function GreekRow({ label, value, color, decimals = 2 }: { label: string; value: number; color: string; decimals?: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#333340] last:border-0">
      <span className={`text-sm font-bold uppercase tracking-wider ${color}`}>{label}</span>
      <span className={`text-base font-bold ${value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
        {signed(value, decimals)}
      </span>
    </div>
  )
}

// ── SVG Price Chart ─────────────────────────────────────────────────────────────

function PriceChart({ data }: { data: PricePoint[] }) {
  if (data.length < 2) return null

  const W = 600
  const H = 180
  const pad = { top: 12, right: 12, bottom: 28, left: 50 }

  const closes = data.map((d) => d.close)
  const minV = Math.min(...closes)
  const maxV = Math.max(...closes)
  const range = maxV - minV || 1

  const sx = (i: number) => pad.left + (i / (data.length - 1)) * (W - pad.left - pad.right)
  const sy = (v: number) => pad.top + (1 - (v - minV) / range) * (H - pad.top - pad.bottom)

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${sx(i)},${sy(d.close)}`).join(' ')
  const areaPath = `${linePath} L${sx(data.length - 1)},${H - pad.bottom} L${sx(0)},${H - pad.bottom} Z`

  const isUp = closes[closes.length - 1] >= closes[0]
  const color = isUp ? '#22c55e' : '#f87171'

  const yTicks = [minV, (minV + maxV) / 2, maxV]

  // ── X-axis dates (show more)
  const dateStep = Math.ceil(data.length / 6)
  const xDates = data
    .map((d, i) => (i % dateStep === 0 ? { date: d.date, idx: i } : null))
    .filter((x): x is { date: string; idx: number } => x !== null)

  return (
    <div className="relative">
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={`grad-${data[0].date}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-axis grid */}
        {yTicks.map((v, i) => (
          <g key={`y-${i}`}>
            <line x1={pad.left} y1={sy(v)} x2={W - pad.right} y2={sy(v)} stroke="#333340" strokeWidth="0.5" />
            <text x={pad.left - 6} y={sy(v) + 3} textAnchor="end" fontSize="10" fill="#888888">
              ${v.toFixed(0)}
            </text>
          </g>
        ))}

        {/* Area */}
        <path d={areaPath} fill={`url(#grad-${data[0].date})`} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="0.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

        {/* X-axis dates */}
        {xDates.map(({ date, idx }) => (
          <text
            key={`date-${idx}`}
            x={sx(idx)}
            y={H - 6}
            fontSize="9"
            fill="#888888"
            textAnchor="middle"
          >
            {date.slice(5)}
          </text>
        ))}
      </svg>
    </div>
  )
}

// ── Detail panel ───────────────────────────────────────────────────────────────

const PERIODS = ['1mo', '3mo', '6mo', '1y', 'MAX'] as const
type Period = (typeof PERIODS)[number]

function PositionDetail({ position, onBack }: { position: BookPosition; onBack: () => void }) {
  const [history, setHistory] = useState<PricePoint[]>([])
  const [period, setPeriod] = useState<Period>('3mo')
  const [loadingChart, setLoadingChart] = useState(false)

  useEffect(() => {
    setLoadingChart(true)
    const p = period === 'MAX' ? 'max' : period
    getPriceHistory(position.ticker, p)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingChart(false))
  }, [position.ticker, period])

  const change = history.length >= 2
    ? ((history[history.length - 1].close - history[0].close) / history[0].close) * 100
    : null

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-white font-bold text-xl">{position.ticker}</span>
        {typeTag(position.productType)}
        {position.strike && <span className="text-gray-400 text-sm">K=${position.strike}</span>}
        {position.maturity && <span className="text-gray-400 text-sm">{position.maturity}</span>}
      </div>

      {/* Price chart */}
      <div className="bg-[#1F1F28] border border-[#333340] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Cours du sous-jacent</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-white font-bold text-lg">${position.spot.toFixed(2)}</span>
              {change !== null && (
                <span className={`text-xs font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  period === p ? 'bg-[#1677FF] text-white' : 'text-gray-400 border border-[#333340] hover:border-[#1677FF]/50'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        {loadingChart ? (
          <div className="h-24 flex items-center justify-center">
            <span className="text-gray-500 text-xs">Chargement...</span>
          </div>
        ) : (
          <PriceChart data={history} />
        )}
        {position.productType !== 'stock' && (
          <p className="text-gray-400 text-xs mt-2">
            Prix option : <span className="text-white font-bold">${position.currentPrice.toFixed(4)}</span>
            <span className="ml-2">·</span>
            <span className="ml-2">{position.quantity >= 0 ? 'Long' : 'Short'} ×{Math.abs(position.quantity)}</span>
          </p>
        )}
      </div>

      {/* Greeks */}
      <div className="bg-[#1F1F28] border border-[#333340] rounded-lg p-4">
        <p className="text-gray-300 text-xs uppercase tracking-wider mb-3 font-bold">Greeks</p>
        <GreekRow label="Delta" value={position.greeks.delta} color="text-white" />
        <GreekRow label="Gamma" value={position.greeks.gamma} color="text-white" decimals={2} />
        <GreekRow label="Vega"  value={position.greeks.vega}  color="text-white" />
        <GreekRow label="Theta" value={position.greeks.theta} color="text-white" />
        <GreekRow label="Rho"   value={position.greeks.rho}   color="text-white" />
      </div>

      {/* Vol surface placeholder */}
      <div className="bg-[#1F1F28] border border-[#333340] rounded-lg p-4">
        <p className="text-gray-300 text-xs uppercase tracking-wider mb-3 font-bold">Surface de volatilité</p>
        <div className="h-20 flex items-center justify-center border border-dashed border-[#333340] rounded-lg">
          <div className="text-center">
            <p className="text-gray-500 text-xs">Calibration Heston — V2</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Aggregated Greeks panel ────────────────────────────────────────────────────

function AggregatedPanel() {
  const { aggregatedGreeks, positions } = useBook()

  if (positions.length === 0) return null

  return (
    <div className="bg-[#1F1F28] border border-[#333340] rounded-lg p-4">
      <p className="text-gray-300 text-lg uppercase tracking-wider mb-2 font-bold">Greeks agrégés</p>
      <p className="text-gray-400 text-sm mb-3">{positions.length} position{positions.length > 1 ? 's' : ''}</p>
      <GreekRow label="Delta" value={aggregatedGreeks.delta} color="text-white" />
      <GreekRow label="Gamma" value={aggregatedGreeks.gamma} color="text-white" decimals={2} />
      <GreekRow label="Vega"  value={aggregatedGreeks.vega}  color="text-white" />
      <GreekRow label="Theta" value={aggregatedGreeks.theta} color="text-white" />
      <GreekRow label="Rho"   value={aggregatedGreeks.rho}   color="text-white" />
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function BookPage() {
  const { positions, removePosition } = useBook()
  const [showModal, setShowModal] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedPosition = positions.find((p) => p.id === selectedId) ?? null

  const handleRowClick = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="w-full lg:max-w-full mx-auto px-4 lg:px-8 py-8">

      {/* Page header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Mon Portefeuille</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            {positions.length === 0
              ? 'Aucune position — commencez par ajouter un produit'
              : `${positions.length} position${positions.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#1677FF] hover:bg-[#2F8CFF] text-white font-bold px-5 py-2.5 rounded-lg transition-colors text-sm"
          >
            + Ajouter une position
          </button>
          {selectedPosition && (
            <button
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-2 bg-[#1677FF] hover:bg-[#2F8CFF] text-white font-bold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              ← Retour au book
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 transition-all">

        {/* ── Positions table ── */}
        <div className={`transition-all ${selectedPosition ? 'lg:w-96 max-w-sm' : 'flex-1'}`}>
          {positions.length === 0 ? (
            <div
              onClick={() => setShowModal(true)}
              className="border border-dashed border-[#333340] rounded-xl h-64 flex flex-col items-center justify-center cursor-pointer hover:border-[#1677FF]/50 hover:bg-[#1677FF]/5 transition-colors group"
            >
              <span className="text-gray-500 group-hover:text-[#1677FF] text-3xl mb-3 transition-colors">+</span>
              <p className="text-gray-500 group-hover:text-gray-300 transition-colors">Ajouter votre première position</p>
            </div>
          ) : (
            <div className="bg-[#1F1F28] border border-[#333340] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#333340]">
                    {['Ticker', 'Type', 'Strike', 'Maturité', 'Qté', 'Delta', 'Prix', ''].map((h) => (
                      <th key={h} className="text-left text-sm text-gray-400 uppercase tracking-wider px-4 py-3 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr
                      key={pos.id}
                      onClick={() => handleRowClick(pos.id)}
                      className={`border-b border-[#333340] last:border-0 cursor-pointer transition-colors ${
                        selectedId === pos.id
                          ? 'bg-[#1677FF]/10 border-l-4 border-l-[#1677FF]'
                          : 'hover:bg-[#242430]'
                      }`}
                    >
                      <td className="px-4 py-3 font-bold text-white text-base">{pos.ticker}</td>
                      <td className="px-4 py-3">{typeTag(pos.productType)}</td>
                      <td className="px-4 py-3 text-gray-300 text-base">
                        {pos.strike ? `$${pos.strike}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-base">
                        {pos.maturity ?? '—'}
                      </td>
                      <td className={`px-4 py-3 text-base font-bold text-white`}>
                        {pos.quantity > 0 ? `+${pos.quantity}` : pos.quantity}
                      </td>
                      <td className="px-4 py-3 text-white text-base">
                        {signed(pos.greeks.delta)}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-base">
                        ${pos.currentPrice.toFixed(pos.productType === 'stock' ? 2 : 4)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (selectedId === pos.id) setSelectedId(null)
                            removePosition(pos.id)
                          }}
                          className="text-red-400 hover:text-red-300 transition-colors text-2xl leading-none font-bold"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        {(selectedPosition || positions.length > 0) && (
          <div className={`transition-all ${selectedPosition ? 'flex-1 min-w-0' : 'lg:w-80 flex-shrink-0'}`}>
            {selectedPosition ? (
              <PositionDetail position={selectedPosition} onBack={() => setSelectedId(null)} />
            ) : (
              <AggregatedPanel />
            )}
          </div>
        )}
      </div>

      {showModal && <AddPositionModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
