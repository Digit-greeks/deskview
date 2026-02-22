import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

export interface BookPosition {
  id: string
  ticker: string
  productType: 'stock' | 'call' | 'put'
  strike?: number
  maturity?: string
  quantity: number
  currentPrice: number
  spot: number
  greeks: {
    delta: number
    gamma: number
    vega: number
    theta: number
    rho: number
  }
}

interface AggregatedGreeks {
  delta: number
  gamma: number
  vega: number
  theta: number
  rho: number
}

interface BookContextType {
  positions: BookPosition[]
  addPosition: (position: Omit<BookPosition, 'id'>) => void
  removePosition: (id: string) => void
  aggregatedGreeks: AggregatedGreeks
}

const BookContext = createContext<BookContextType | null>(null)

export function BookProvider({ children }: { children: ReactNode }) {
  const [positions, setPositions] = useState<BookPosition[]>([])

  const addPosition = (position: Omit<BookPosition, 'id'>) => {
    const id = crypto.randomUUID()
    setPositions((prev) => [...prev, { ...position, id }])
  }

  const removePosition = (id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id))
  }

  const aggregatedGreeks = positions.reduce<AggregatedGreeks>(
    (acc, pos) => ({
      delta: acc.delta + pos.greeks.delta,
      gamma: acc.gamma + pos.greeks.gamma,
      vega: acc.vega + pos.greeks.vega,
      theta: acc.theta + pos.greeks.theta,
      rho: acc.rho + pos.greeks.rho,
    }),
    { delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 }
  )

  return (
    <BookContext.Provider value={{ positions, addPosition, removePosition, aggregatedGreeks }}>
      {children}
    </BookContext.Provider>
  )
}

export function useBook() {
  const ctx = useContext(BookContext)
  if (!ctx) throw new Error('useBook must be used within BookProvider')
  return ctx
}
