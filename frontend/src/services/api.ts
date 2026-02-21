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

export default api