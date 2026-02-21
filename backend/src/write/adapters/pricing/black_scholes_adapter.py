import numpy as np
from scipy.stats import norm
from datetime import date
from src.shared.domain.entities.option_contract import OptionContract, OptionType
from src.shared.domain.value_objects.greeks import Greeks
from src.shared.domain.value_objects.market_data import MarketData


class BlackScholesAdapter:

    def _d1(self, S, K, T, r, q, sigma):
        return (np.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))

    def _d2(self, d1, sigma, T):
        return d1 - sigma * np.sqrt(T)

    def _time_to_maturity(self, maturity):
        today = date.today()
        days = (maturity - today).days
        return max(days / 365.0, 1e-6)

    def price(self, contract, market_data):
        S, K = market_data.spot, contract.strike
        T = self._time_to_maturity(contract.maturity)
        r, q, sigma = market_data.risk_free_rate, market_data.dividend_yield, market_data.implied_vol
        d1 = self._d1(S, K, T, r, q, sigma)
        d2 = self._d2(d1, sigma, T)
        if contract.is_call():
            price = S * np.exp(-q * T) * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
        else:
            price = K * np.exp(-r * T) * norm.cdf(-d2) - S * np.exp(-q * T) * norm.cdf(-d1)
        return price * abs(contract.quantity)

    def greeks(self, contract, market_data):
        S, K = market_data.spot, contract.strike
        T = self._time_to_maturity(contract.maturity)
        r, q, sigma = market_data.risk_free_rate, market_data.dividend_yield, market_data.implied_vol
        d1 = self._d1(S, K, T, r, q, sigma)
        d2 = self._d2(d1, sigma, T)
        if contract.is_call():
            delta = np.exp(-q * T) * norm.cdf(d1)
        else:
            delta = -np.exp(-q * T) * norm.cdf(-d1)
        gamma = (np.exp(-q * T) * norm.pdf(d1)) / (S * sigma * np.sqrt(T))
        vega = S * np.exp(-q * T) * norm.pdf(d1) * np.sqrt(T) / 100
        if contract.is_call():
            theta = (-(S * np.exp(-q * T) * norm.pdf(d1) * sigma) / (2 * np.sqrt(T)) - r * K * np.exp(-r * T) * norm.cdf(d2) + q * S * np.exp(-q * T) * norm.cdf(d1)) / 365
        else:
            theta = (-(S * np.exp(-q * T) * norm.pdf(d1) * sigma) / (2 * np.sqrt(T)) + r * K * np.exp(-r * T) * norm.cdf(-d2) - q * S * np.exp(-q * T) * norm.cdf(-d1)) / 365
        if contract.is_call():
            rho = K * T * np.exp(-r * T) * norm.cdf(d2) / 100
        else:
            rho = -K * T * np.exp(-r * T) * norm.cdf(-d2) / 100
        return Greeks(delta * contract.quantity, gamma * abs(contract.quantity), vega * abs(contract.quantity), theta * abs(contract.quantity), rho * contract.quantity)
