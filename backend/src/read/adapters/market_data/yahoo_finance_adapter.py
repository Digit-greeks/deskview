import yfinance as yf
import numpy as np
from src.shared.domain.value_objects.market_data import MarketData


class YahooFinanceAdapter:
    def get_market_data(self, ticker: str, implied_vol: float = None) -> MarketData:
        """Récupère les données de marché pour un ticker."""
        stock = yf.Ticker(ticker)

        # Spot price
        info = stock.info
        spot = info.get("currentPrice") or info.get("regularMarketPrice")
        if not spot:
            hist = stock.history(period="1d")
            spot = float(hist["Close"].iloc[-1])

        # Risk-free rate (on utilise le taux US 3 mois comme proxy)
        risk_free = 0.05  # On hardcode pour l'instant, on branchera FRED après

        # Dividend yield
        raw = info.get("dividendYield") or 0.0
        dividend_yield = raw if raw < 1 else raw / 100

        # Vol implicite — si pas fournie, on calcule une vol historique 30j
        if implied_vol is None:
            hist = stock.history(period="30d")
            returns = np.log(hist["Close"] / hist["Close"].shift(1)).dropna()
            implied_vol = float(returns.std() * np.sqrt(252))

        return MarketData(
            spot=float(spot),
            implied_vol=implied_vol,
            risk_free_rate=risk_free,
            dividend_yield=float(dividend_yield),
        )

    def get_options_chain(self, ticker: str, maturity_index: int = 0):
        """Récupère la chaîne d'options pour un ticker et une maturité."""
        stock = yf.Ticker(ticker)
        expirations = stock.options

        if not expirations:
            raise ValueError(f"No options data available for {ticker}")

        expiry = expirations[maturity_index]
        chain = stock.option_chain(expiry)

        return {
            "expiry": expiry,
            "calls": chain.calls,
            "puts": chain.puts,
        }

    def get_available_maturities(self, ticker: str) -> list[str]:
        """Retourne les maturités disponibles pour un ticker."""
        stock = yf.Ticker(ticker)
        return list(stock.options)
