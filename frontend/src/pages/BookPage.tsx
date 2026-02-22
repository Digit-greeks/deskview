import { useState, useEffect } from 'react'
import Plot from 'react-plotly.js'
import { useBook } from '../contexts/BookContext'
import type { BookPosition } from '../contexts/BookContext'
import { getPriceHistory, getMarketSurface, getHestonSurface } from '../services/api'
import type { PricePoint, MarketSurfaceResponse, HestonSurfaceResponse } from '../services/api'
import AddPositionModal from '../components/AddPositionModal'

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:      '#131316',
  card:    '#1a1a22',
  hover:   '#1e1e28',
  border:  '#252530',
  accent:  '#f97316',
  text:    '#f0f0f0',
  muted:   '#666',
  pos:     '#22c55e',
  neg:     '#f87171',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function typeTag(type: BookPosition['productType']) {
  const cfg = {
    stock: { bg: 'bg-[#1e2a3a]', text: 'text-[#60a5fa]' },
    call:  { bg: 'bg-[#1a2e1a]', text: 'text-[#4ade80]' },
    put:   { bg: 'bg-[#2e1a1a]', text: 'text-[#f87171]' },
  }
  const { bg, text } = cfg[type]
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${bg} ${text}`}>
      {type}
    </span>
  )
}

function signed(n: number, decimals = 4) {
  const s = n.toFixed(decimals)
  return n >= 0 ? `+${s}` : s
}

function GreekRow({ label, value, decimals = 4 }: { label: string; value: number; decimals?: number }) {
  const isPos = value >= 0
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: C.border }}>
      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: C.muted }}>{label}</span>
      <span className={`font-mono text-sm font-semibold ${isPos ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
        {signed(value, decimals)}
      </span>
    </div>
  )
}

// ── SVG Price Chart ─────────────────────────────────────────────────────────────

function PriceChart({ data }: { data: PricePoint[] }) {
  if (data.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center">
        <p className="text-xs" style={{ color: C.muted }}>Aucune donnée disponible pour cette période</p>
      </div>
    )
  }

  const W = 600
  const H = 160
  const pad = { top: 10, right: 10, bottom: 24, left: 48 }

  const closes = data.map((d) => d.close)
  const minV = Math.min(...closes)
  const maxV = Math.max(...closes)
  const range = maxV - minV || 1

  const sx = (i: number) => pad.left + (i / (data.length - 1)) * (W - pad.left - pad.right)
  const sy = (v: number) => pad.top + (1 - (v - minV) / range) * (H - pad.top - pad.bottom)

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(d.close).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${sx(data.length - 1)},${H - pad.bottom} L${sx(0)},${H - pad.bottom} Z`

  const isUp = closes[closes.length - 1] >= closes[0]
  const color = isUp ? C.pos : C.neg

  const yTicks = [minV, (minV + maxV) / 2, maxV]
  const dateStep = Math.max(1, Math.ceil(data.length / 5))
  const xDates = data
    .map((d, i) => (i % dateStep === 0 ? { date: d.date, i } : null))
    .filter((x): x is { date: string; i: number } => x !== null)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id={`g${data.length}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((v, idx) => (
        <g key={idx}>
          <line x1={pad.left} y1={sy(v)} x2={W - pad.right} y2={sy(v)} stroke={C.border} strokeWidth="0.5" />
          <text x={pad.left - 5} y={sy(v) + 3.5} textAnchor="end" fontSize="9" fill={C.muted}>${v.toFixed(0)}</text>
        </g>
      ))}
      <path d={areaPath} fill={`url(#g${data.length})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      {xDates.map(({ date, i }) => (
        <text key={i} x={sx(i)} y={H - 6} fontSize="9" fill={C.muted} textAnchor="middle">{date.slice(5)}</text>
      ))}
    </svg>
  )
}

// ── Vol Surface ─────────────────────────────────────────────────────────────────

type SurfacePhase =
  | { phase: 'idle' }
  | { phase: 'loading_market' }
  | { phase: 'market'; data: MarketSurfaceResponse }
  | { phase: 'calibrating'; market: MarketSurfaceResponse }
  | { phase: 'heston'; data: HestonSurfaceResponse }
  | { phase: 'error'; message: string }

const PLOTLY_LAYOUT: Partial<Plotly.Layout> = {
  paper_bgcolor: '#1a1a22',
  scene: {
    xaxis: {
      title: { text: 'Moneyness (K/S)', font: { color: '#666', size: 10 } },
      gridcolor: '#252530',
      color: '#666',
      tickfont: { color: '#666', size: 9 },
    },
    yaxis: {
      title: { text: 'Maturité (années)', font: { color: '#666', size: 10 } },
      gridcolor: '#252530',
      color: '#666',
      tickfont: { color: '#666', size: 9 },
    },
    zaxis: {
      title: { text: 'Vol implicite (%)', font: { color: '#666', size: 10 } },
      gridcolor: '#252530',
      color: '#666',
      tickfont: { color: '#666', size: 9 },
    },
    bgcolor: '#131316',
  },
  margin: { l: 0, r: 0, t: 0, b: 0 },
  font: { color: '#f0f0f0', family: 'monospace', size: 10 },
  showlegend: false,
}

const PLOTLY_CONFIG = { displayModeBar: false, responsive: true }

function VolSurface({ ticker }: { ticker: string }) {
  const [state, setState] = useState<SurfacePhase>({ phase: 'idle' })

  useEffect(() => {
    setState({ phase: 'loading_market' })
    getMarketSurface(ticker)
      .then((data) => setState({ phase: 'market', data }))
      .catch((e) => {
        const msg: string = e?.response?.data?.detail ?? e?.message ?? 'Erreur inconnue'
        setState({ phase: 'error', message: msg })
      })
  }, [ticker])

  const calibrate = () => {
    if (state.phase !== 'market') return
    const market = state.data
    setState({ phase: 'calibrating', market })
    getHestonSurface(ticker)
      .then((data) => setState({ phase: 'heston', data }))
      .catch((e) => {
        const msg: string = e?.response?.data?.detail ?? e?.message ?? 'Calibration échouée'
        setState({ phase: 'market', data: market })
        console.error('Heston failed:', msg)
      })
  }

  const marketScatterTrace = (pts: MarketSurfaceResponse['points']): Plotly.Data => ({
    type: 'scatter3d',
    mode: 'markers',
    name: 'Marché',
    x: pts.map((p) => p.moneyness),
    y: pts.map((p) => p.maturity),
    z: pts.map((p) => p.iv),
    marker: { size: 3, color: pts.map((p) => p.iv), colorscale: 'Viridis', opacity: 0.9 },
    hovertemplate: 'K/S: %{x:.3f}<br>T: %{y:.3f}y<br>IV: %{z:.1f}%<extra></extra>',
  })

  if (state.phase === 'idle' || state.phase === 'loading_market') {
    return (
      <div className="h-40 flex flex-col items-center justify-center gap-2">
        <div
          className="w-4 h-4 border-2 rounded-full animate-spin"
          style={{ borderColor: `${C.accent}40`, borderTopColor: C.accent }}
        />
        <p className="text-xs" style={{ color: C.muted }}>Chargement des données options...</p>
      </div>
    )
  }

  if (state.phase === 'error') {
    const retry = () => {
      setState({ phase: 'loading_market' })
      getMarketSurface(ticker)
        .then((data) => setState({ phase: 'market', data }))
        .catch((e) => setState({ phase: 'error', message: e?.response?.data?.detail ?? 'Erreur' }))
    }
    return (
      <div className="h-32 flex flex-col items-center justify-center gap-2">
        <p className="text-xs text-[#f87171]">{state.message}</p>
        <button
          onClick={retry}
          className="text-xs px-3 py-1 rounded border transition-colors hover:text-white"
          style={{ color: C.muted, borderColor: C.border }}
        >
          Réessayer
        </button>
      </div>
    )
  }

  if (state.phase === 'market') {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs" style={{ color: C.muted }}>
            {state.data.points.length} points · spot {state.data.spot.toFixed(2)}
          </span>
          <button
            onClick={calibrate}
            className="text-xs px-3 py-1.5 rounded font-semibold transition-colors"
            style={{ background: C.accent, color: '#000' }}
          >
            Calibrer Heston
          </button>
        </div>
        <Plot
          data={[marketScatterTrace(state.data.points)]}
          layout={PLOTLY_LAYOUT as Plotly.Layout}
          config={PLOTLY_CONFIG}
          style={{ width: '100%', height: '340px' }}
        />
      </div>
    )
  }

  if (state.phase === 'calibrating') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-3.5 h-3.5 border-2 rounded-full animate-spin flex-shrink-0"
            style={{ borderColor: `${C.accent}40`, borderTopColor: C.accent }}
          />
          <span className="text-xs" style={{ color: C.muted }}>
            Calibration Heston — optimisation L-BFGS-B en cours (~30s)
          </span>
        </div>
        <Plot
          data={[marketScatterTrace(state.market.points)]}
          layout={PLOTLY_LAYOUT as Plotly.Layout}
          config={PLOTLY_CONFIG}
          style={{ width: '100%', height: '340px' }}
        />
      </div>
    )
  }

  // heston phase
  if (state.phase === 'heston') {
    const { params, surface, market_scatter, spot } = state.data

    const hestonSurface: Plotly.Data = {
      type: 'surface',
      name: 'Heston',
      x: surface.moneyness,
      y: surface.maturities_years,
      z: surface.implied_vols as number[][],
      colorscale: 'Viridis',
      opacity: 0.72,
      showscale: false,
      hovertemplate: 'K/S: %{x:.3f}<br>T: %{y:.3f}y<br>IV: %{z:.1f}%<extra>Heston</extra>',
    }

    const paramItems = [
      { label: 'v₀',   value: (params.v0 * 100).toFixed(2) + '%' },
      { label: 'κ',    value: params.kappa.toFixed(3) },
      { label: 'θ',    value: (params.theta * 100).toFixed(2) + '%' },
      { label: 'σᵥ',   value: params.sigma_v.toFixed(3) },
      { label: 'ρ',    value: params.rho.toFixed(3) },
      { label: 'RMSE', value: (params.rmse * 100).toFixed(2) + '%' },
    ]

    const recalibrate = () => {
      setState({ phase: 'loading_market' })
      getMarketSurface(ticker)
        .then((data) => setState({ phase: 'market', data }))
        .catch((e) => setState({ phase: 'error', message: e?.response?.data?.detail ?? 'Erreur' }))
    }

    return (
      <div>
        <div className="flex items-start justify-between mb-3 gap-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {paramItems.map(({ label, value }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-xs font-mono" style={{ color: C.muted }}>{label}</span>
                <span className="text-xs font-mono font-bold" style={{ color: C.text }}>{value}</span>
              </div>
            ))}
          </div>
          <button
            onClick={recalibrate}
            className="text-xs px-2 py-1 rounded border transition-colors hover:text-white flex-shrink-0"
            style={{ color: C.muted, borderColor: C.border }}
          >
            Recalibrer
          </button>
        </div>
        <Plot
          data={[hestonSurface, marketScatterTrace(market_scatter)]}
          layout={{
            ...PLOTLY_LAYOUT,
            scene: { ...(PLOTLY_LAYOUT.scene as object), camera: { eye: { x: 1.6, y: -1.6, z: 0.8 } } },
          } as Plotly.Layout}
          config={PLOTLY_CONFIG}
          style={{ width: '100%', height: '380px' }}
        />
        <p className="text-xs mt-2 text-center" style={{ color: '#333340' }}>
          Surface Heston calibrée · {params.n_points} points de marché · spot {spot.toFixed(2)}
        </p>
      </div>
    )
  }

  return null
}

// ── Position detail ────────────────────────────────────────────────────────────

const PERIODS = ['1mo', '3mo', '6mo', '1y', 'MAX'] as const
type Period = (typeof PERIODS)[number]

function PositionDetail({ position, onBack }: { position: BookPosition; onBack: () => void }) {
  const [history, setHistory] = useState<PricePoint[]>([])
  const [period, setPeriod] = useState<Period>('3mo')
  const [loadingChart, setLoadingChart] = useState(false)

  useEffect(() => {
    setLoadingChart(true)
    setHistory([])
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
    <div className="flex-1 min-w-0 flex flex-col gap-4">

      {/* Back + header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-xs px-3 py-1.5 rounded border transition-colors hover:text-white"
          style={{ color: C.muted, borderColor: C.border }}
        >
          ← Book
        </button>
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg" style={{ color: C.text }}>{position.ticker}</span>
          {typeTag(position.productType)}
          {position.strike && <span className="text-xs font-mono" style={{ color: C.muted }}>K={position.strike}</span>}
          {position.maturity && <span className="text-xs font-mono" style={{ color: C.muted }}>{position.maturity}</span>}
        </div>
      </div>

      {/* Two columns: chart + greeks */}
      <div className="flex gap-4 flex-col xl:flex-row">

        {/* Chart */}
        <div className="flex-1 rounded-lg border p-4" style={{ background: C.card, borderColor: C.border }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: C.muted }}>Cours du sous-jacent</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold" style={{ color: C.text }}>${position.spot.toFixed(2)}</span>
                {change !== null && (
                  <span className={`text-sm font-semibold ${change >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                  </span>
                )}
              </div>
              {position.productType !== 'stock' && (
                <p className="text-xs mt-1" style={{ color: C.muted }}>
                  Option : <span className="text-white font-mono">${position.currentPrice.toFixed(4)}</span>
                  <span className="mx-1.5">·</span>
                  <span className={position.quantity >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}>
                    {position.quantity >= 0 ? 'Long' : 'Short'} ×{Math.abs(position.quantity)}
                  </span>
                </p>
              )}
            </div>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="px-2 py-0.5 rounded text-xs transition-colors"
                  style={{
                    color: period === p ? C.accent : C.muted,
                    background: period === p ? `${C.accent}18` : 'transparent',
                    border: `1px solid ${period === p ? `${C.accent}40` : C.border}`,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          {loadingChart ? (
            <div className="h-32 flex items-center justify-center">
              <span className="text-xs" style={{ color: C.muted }}>Chargement...</span>
            </div>
          ) : (
            <PriceChart data={history} />
          )}
        </div>

        {/* Greeks */}
        <div className="xl:w-52 rounded-lg border p-4 flex-shrink-0" style={{ background: C.card, borderColor: C.border }}>
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: C.muted }}>Greeks</p>
          <GreekRow label="Delta" value={position.greeks.delta} />
          <GreekRow label="Gamma" value={position.greeks.gamma} decimals={6} />
          <GreekRow label="Vega"  value={position.greeks.vega}  />
          <GreekRow label="Theta" value={position.greeks.theta} />
          <GreekRow label="Rho"   value={position.greeks.rho}   />
        </div>
      </div>

      {/* Vol surface */}
      <div className="rounded-lg border p-4" style={{ background: C.card, borderColor: C.border }}>
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: C.muted }}>Surface de volatilité implicite</p>
        <VolSurface ticker={position.ticker} />
      </div>
    </div>
  )
}

// ── Aggregated Greeks ──────────────────────────────────────────────────────────

function AggregatedPanel() {
  const { aggregatedGreeks, positions } = useBook()
  if (positions.length === 0) return null
  return (
    <div className="rounded-lg border p-4 w-full lg:w-56 flex-shrink-0" style={{ background: C.card, borderColor: C.border }}>
      <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: C.muted }}>Greeks agrégés</p>
      <p className="text-xs mb-4" style={{ color: '#444' }}>{positions.length} position{positions.length > 1 ? 's' : ''}</p>
      <GreekRow label="Delta" value={aggregatedGreeks.delta} />
      <GreekRow label="Gamma" value={aggregatedGreeks.gamma} decimals={6} />
      <GreekRow label="Vega"  value={aggregatedGreeks.vega}  />
      <GreekRow label="Theta" value={aggregatedGreeks.theta} />
      <GreekRow label="Rho"   value={aggregatedGreeks.rho}   />
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function BookPage() {
  const { positions, removePosition } = useBook()
  const [showModal, setShowModal] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedPosition = positions.find((p) => p.id === selectedId) ?? null

  return (
    <div className="px-6 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-semibold" style={{ color: C.text }}>Mon Portefeuille</h1>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            {positions.length === 0 ? 'Aucune position' : `${positions.length} position${positions.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="text-xs font-semibold px-4 py-2 rounded transition-colors"
          style={{ background: C.accent, color: '#000' }}
        >
          + Ajouter
        </button>
      </div>

      {/* Content */}
      <div className="flex gap-4 items-start">

        {/* Table — shrinks when detail is open */}
        <div className={`transition-all duration-300 flex-shrink-0 ${selectedPosition ? 'w-72' : 'flex-1'}`}>
          {positions.length === 0 ? (
            <div
              onClick={() => setShowModal(true)}
              className="h-48 rounded-lg border border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors group"
              style={{ borderColor: C.border }}
            >
              <span className="text-2xl mb-2 transition-colors group-hover:text-[#f97316]" style={{ color: C.border }}>+</span>
              <p className="text-xs transition-colors group-hover:text-white" style={{ color: C.muted }}>Ajouter votre première position</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {(selectedPosition
                      ? ['Ticker', 'Type', '']
                      : ['Ticker', 'Type', 'Strike', 'Maturité', 'Qté', 'Δ Delta', 'Prix', '']
                    ).map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-medium uppercase tracking-wider" style={{ color: C.muted }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr
                      key={pos.id}
                      onClick={() => setSelectedId((prev) => prev === pos.id ? null : pos.id)}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        background: selectedId === pos.id ? `${C.accent}0d` : 'transparent',
                        borderLeft: selectedId === pos.id ? `2px solid ${C.accent}` : '2px solid transparent',
                      }}
                      onMouseEnter={(e) => { if (selectedId !== pos.id) e.currentTarget.style.background = C.hover }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = selectedId === pos.id ? `${C.accent}0d` : 'transparent' }}
                    >
                      <td className="px-3 py-2.5 font-mono font-bold text-sm" style={{ color: C.accent }}>{pos.ticker}</td>
                      <td className="px-3 py-2.5">{typeTag(pos.productType)}</td>
                      {!selectedPosition && (
                        <>
                          <td className="px-3 py-2.5 font-mono text-xs" style={{ color: C.text }}>{pos.strike ? `$${pos.strike}` : '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-xs" style={{ color: C.muted }}>{pos.maturity ?? '—'}</td>
                          <td className={`px-3 py-2.5 font-mono text-xs font-semibold ${pos.quantity >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                            {pos.quantity > 0 ? `+${pos.quantity}` : pos.quantity}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs" style={{ color: C.text }}>{signed(pos.greeks.delta)}</td>
                          <td className="px-3 py-2.5 font-mono text-xs" style={{ color: C.muted }}>${pos.currentPrice.toFixed(pos.productType === 'stock' ? 2 : 4)}</td>
                        </>
                      )}
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); if (selectedId === pos.id) setSelectedId(null); removePosition(pos.id) }}
                          className="text-xs transition-colors hover:text-[#f87171]"
                          style={{ color: C.border }}
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

        {/* Right panel */}
        {selectedPosition ? (
          <PositionDetail position={selectedPosition} onBack={() => setSelectedId(null)} />
        ) : (
          positions.length > 0 && <AggregatedPanel />
        )}
      </div>

      {showModal && <AddPositionModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
