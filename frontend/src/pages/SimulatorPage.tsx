import { useState, useMemo } from 'react'
import { useBook } from '../contexts/BookContext'

// ── Slider ─────────────────────────────────────────────────────────────────────

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
  color: string
}

function Slider({ label, value, min, max, step, format, onChange, color }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="bg-[#1a1a22] border border-[#252530] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>{label}</span>
        <span className={`font-mono font-bold text-sm ${value === 0 ? 'text-slate-500' : value > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#f97316] cursor-pointer"
        style={{ background: `linear-gradient(to right, #f97316 ${pct}%, #1e1e26 ${pct}%)` }}
      />
      <div className="flex justify-between mt-1.5">
        <span className="text-gray-600 text-xs font-mono">{format(min)}</span>
        <button
          onClick={() => onChange(0)}
          className="text-gray-600 hover:text-[#f97316] text-xs transition-colors"
        >
          reset
        </button>
        <span className="text-gray-600 text-xs font-mono">{format(max)}</span>
      </div>
    </div>
  )
}

// ── PnL bar ────────────────────────────────────────────────────────────────────

function PnLBar({ label, value, color, maxAbs }: { label: string; value: number; color: string; maxAbs: number }) {
  const pct = maxAbs > 0 ? Math.abs(value) / maxAbs : 0
  const isPositive = value >= 0

  return (
    <div className="flex items-center gap-4 py-2.5 border-b border-[#252530] last:border-0">
      <span className={`text-xs font-bold uppercase tracking-wider w-14 flex-shrink-0 ${color}`}>{label}</span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[#252530] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>
      <span className={`font-mono text-sm font-bold w-24 text-right flex-shrink-0 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SimulatorPage() {
  const { positions, aggregatedGreeks } = useBook()

  const [spotShockPct, setSpotShockPct] = useState(0)    // % move, e.g. 5 = +5%
  const [volShockPts, setVolShockPts]   = useState(0)    // absolute vol points, e.g. 3 = +3%
  const [rateShockBps, setRateShockBps] = useState(0)    // basis points, e.g. 25 = +25bp
  const [timeDays, setTimeDays]         = useState(0)    // days of time decay

  // PnL Explain — computed per position to correctly account for each spot
  const pnl = useMemo(() => {
    let deltaPnl = 0
    let gammaPnl = 0
    const vegaPnl  = aggregatedGreeks.vega  * volShockPts
    const thetaPnl = aggregatedGreeks.theta * timeDays
    const rhoPnl   = aggregatedGreeks.rho   * (rateShockBps / 100)

    for (const pos of positions) {
      const dS = (spotShockPct / 100) * pos.spot
      deltaPnl += pos.greeks.delta * dS
      gammaPnl += 0.5 * pos.greeks.gamma * dS * dS
    }

    const total = deltaPnl + gammaPnl + vegaPnl + thetaPnl + rhoPnl
    return { deltaPnl, gammaPnl, vegaPnl, thetaPnl, rhoPnl, total }
  }, [positions, aggregatedGreeks, spotShockPct, volShockPts, rateShockBps, timeDays])

  const maxAbs = Math.max(
    Math.abs(pnl.deltaPnl),
    Math.abs(pnl.gammaPnl),
    Math.abs(pnl.vegaPnl),
    Math.abs(pnl.thetaPnl),
    Math.abs(pnl.rhoPnl),
    0.001
  )

  if (positions.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-8">
        <h2 className="text-2xl font-bold text-white mb-1">Shock Simulator</h2>
        <p className="text-gray-400 text-sm mb-8">PnL Explain en temps réel</p>
        <div className="border border-dashed border-[#252530] rounded-xl h-64 flex flex-col items-center justify-center">
          <p className="text-gray-500">Votre book est vide</p>
          <p className="text-gray-600 text-sm mt-1">Ajoutez des positions dans l'onglet Book pour commencer</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <h2 className="text-2xl font-bold text-white mb-1">Shock Simulator</h2>
      <p className="text-gray-400 text-sm mb-8">
        PnL Explain en temps réel · {positions.length} position{positions.length > 1 ? 's' : ''} · Δ net {aggregatedGreeks.delta >= 0 ? '+' : ''}{aggregatedGreeks.delta.toFixed(4)}
      </p>

      <div className="flex flex-col xl:flex-row gap-6">

        {/* ── Sliders ── */}
        <div className="w-full xl:w-96 flex-shrink-0 space-y-3">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-4">Chocs de marché</p>

          <Slider
            label="Spot shock"
            value={spotShockPct}
            min={-30}
            max={30}
            step={0.5}
            format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
            onChange={setSpotShockPct}
            color="text-blue-400"
          />
          <Slider
            label="Vol shock"
            value={volShockPts}
            min={-20}
            max={20}
            step={0.5}
            format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} pts`}
            onChange={setVolShockPts}
            color="text-yellow-400"
          />
          <Slider
            label="Rate shock"
            value={rateShockBps}
            min={-300}
            max={300}
            step={5}
            format={(v) => `${v > 0 ? '+' : ''}${v} bp`}
            onChange={setRateShockBps}
            color="text-slate-400"
          />
          <Slider
            label="Time decay"
            value={timeDays}
            min={0}
            max={30}
            step={1}
            format={(v) => `${v} j`}
            onChange={setTimeDays}
            color="text-red-400"
          />
        </div>

        {/* ── PnL Explain ── */}
        <div className="flex-1">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-4">PnL Explain</p>

          {/* Total */}
          <div className={`rounded-lg p-5 mb-4 border ${pnl.total >= 0 ? 'bg-emerald-900/20 border-emerald-800/50' : 'bg-red-900/20 border-red-800/50'}`}>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">PnL Total estimé</p>
            <p className={`text-4xl font-mono font-bold ${pnl.total >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {pnl.total >= 0 ? '+' : ''}{pnl.total.toFixed(2)}
            </p>
            <p className="text-gray-600 text-xs mt-2">Approximation ΔP ≈ Δ·ΔS + ½Γ·ΔS² + V·Δσ + θ·Δt + ρ·Δr</p>
          </div>

          {/* Breakdown */}
          <div className="bg-[#1a1a22] border border-[#252530] rounded-lg p-4">
            <PnLBar label="Delta"  value={pnl.deltaPnl} color="text-blue-400"   maxAbs={maxAbs} />
            <PnLBar label="Gamma"  value={pnl.gammaPnl} color="text-purple-400" maxAbs={maxAbs} />
            <PnLBar label="Vega"   value={pnl.vegaPnl}  color="text-yellow-400" maxAbs={maxAbs} />
            <PnLBar label="Theta"  value={pnl.thetaPnl} color="text-red-400"    maxAbs={maxAbs} />
            <PnLBar label="Rho"    value={pnl.rhoPnl}   color="text-slate-400"  maxAbs={maxAbs} />
          </div>

          {/* Greeks recap */}
          <div className="mt-4 bg-[#1a1a22] border border-[#252530] rounded-lg p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">Greeks du book</p>
            <div className="grid grid-cols-5 gap-2 text-center">
              {[
                { label: 'Delta', value: aggregatedGreeks.delta, color: 'text-blue-400', dec: 4 },
                { label: 'Gamma', value: aggregatedGreeks.gamma, color: 'text-purple-400', dec: 6 },
                { label: 'Vega',  value: aggregatedGreeks.vega,  color: 'text-yellow-400', dec: 4 },
                { label: 'Theta', value: aggregatedGreeks.theta, color: 'text-red-400', dec: 4 },
                { label: 'Rho',   value: aggregatedGreeks.rho,   color: 'text-slate-400', dec: 4 },
              ].map(({ label, value, color, dec }) => (
                <div key={label}>
                  <p className={`text-xs font-bold uppercase ${color}`}>{label}</p>
                  <p className="font-mono text-gray-300 text-sm mt-0.5">{value.toFixed(dec)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
