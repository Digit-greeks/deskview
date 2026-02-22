import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface MarketData {
  ticker: string
  spot: number
  implied_vol: number
  risk_free_rate: number
  dividend_yield: number
}

export interface GreeksRequest {
  ticker: string
  option_type: 'call' | 'put'
  strike: number
  maturity: string
  quantity: number
}

export interface GreeksResponse {
  ticker: string
  spot: number
  option_type: string
  strike: number
  price: number
  delta: number
  gamma: number
  vega: number
  theta: number
  rho: number
}

export const getMarketData = async (ticker: string): Promise<MarketData> => {
  const response = await api.get(`/market-data/${ticker}`)
  return response.data
}

export const getMaturities = async (ticker: string): Promise<string[]> => {
  const response = await api.get(`/maturities/${ticker}`)
  return response.data.maturities
}

export const getGreeks = async (request: GreeksRequest): Promise<GreeksResponse> => {
  const response = await api.post('/greeks', request)
  return response.data
}

export interface PricePoint {
  date: string
  close: number
}

export const getPriceHistory = async (ticker: string, period = '3mo'): Promise<PricePoint[]> => {
  const response = await api.get(`/price-history/${ticker}?period=${period}`)
  return response.data.data
}

// ── Vol Surface ────────────────────────────────────────────────────────────────

export interface MarketIVPoint {
  strike: number
  maturity: number
  maturity_str: string
  iv: number           // in %, e.g. 25.4
  moneyness: number
  option_type: 'call' | 'put'
  volume: number
}

export interface MarketSurfaceResponse {
  ticker: string
  spot: number
  r: number
  q: number
  n_points: number
  points: MarketIVPoint[]
}

export interface HestonParams {
  v0: number
  kappa: number
  theta: number
  sigma_v: number
  rho: number
  rmse: number
  success: boolean
  n_points: number
}

export interface HestonSurface {
  strikes: number[]
  moneyness: number[]
  maturities_years: number[]
  implied_vols: (number | null)[][]  // [T_idx][K_idx], values in %
}

export interface HestonSurfaceResponse {
  ticker: string
  spot: number
  r: number
  q: number
  params: HestonParams
  market_scatter: MarketIVPoint[]
  surface: HestonSurface
}

export const getMarketSurface = async (ticker: string): Promise<MarketSurfaceResponse> => {
  const response = await api.get(`/vol-surface/${ticker}/market`)
  return response.data
}

export const getHestonSurface = async (ticker: string): Promise<HestonSurfaceResponse> => {
  const response = await api.get(`/vol-surface/${ticker}/heston`)
  return response.data
}

export default api
