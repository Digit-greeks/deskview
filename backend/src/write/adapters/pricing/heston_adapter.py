"""
Heston (1993) Stochastic Volatility Model
==========================================

  dS/S = (r - q) dt + sqrt(v) dW_S
  dv   =  κ(θ - v) dt + σ_v sqrt(v) dW_v
  corr(dW_S, dW_v) = ρ

Parameters
----------
  v0      : initial variance
  kappa   : mean-reversion speed
  theta   : long-run variance
  sigma_v : vol-of-vol
  rho     : spot–vol correlation
"""

from __future__ import annotations

import numpy as np
from scipy.optimize import brentq, minimize
from scipy.stats import norm

# ── Black-Scholes helpers (for implied-vol inversion) ─────────────────────────


def _bs_call(S: float, K: float, T: float, r: float, q: float, sigma: float) -> float:
    if T <= 0 or sigma <= 0:
        return max(S * np.exp(-q * T) - K * np.exp(-r * T), 0.0)
    d1 = (np.log(S / K) + (r - q + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    return float(S * np.exp(-q * T) * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2))


def _bs_vega(S: float, K: float, T: float, r: float, q: float, sigma: float) -> float:
    if T <= 0 or sigma <= 0:
        return 0.0
    d1 = (np.log(S / K) + (r - q + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    return float(S * np.exp(-q * T) * norm.pdf(d1) * np.sqrt(T))


def bs_implied_vol(
    price: float,
    S: float,
    K: float,
    T: float,
    r: float,
    q: float,
    option_type: str = "call",
) -> float | None:
    """
    Compute Black-Scholes implied volatility via Newton-Raphson + Brent fallback.
    Returns None if no solution found in [0.001, 5.0].
    """
    if T <= 0:
        return None

    # Convert put → call via put-call parity
    if option_type == "put":
        price = price + S * np.exp(-q * T) - K * np.exp(-r * T)

    intrinsic = max(S * np.exp(-q * T) - K * np.exp(-r * T), 0.0)
    upper = S * np.exp(-q * T)

    if price <= intrinsic + 1e-9 or price >= upper:
        return None

    # Newton-Raphson
    sigma = 0.3
    for _ in range(25):
        p = _bs_call(S, K, T, r, q, sigma)
        v = _bs_vega(S, K, T, r, q, sigma)
        if v < 1e-12:
            break
        step = (p - price) / v
        sigma -= step
        sigma = float(np.clip(sigma, 1e-4, 10.0))
        if abs(step) < 1e-9 and 0.001 <= sigma <= 5.0:
            return sigma

    # Brent fallback
    try:

        def f(s: float) -> float:
            return _bs_call(S, K, T, r, q, s) - price

        if f(0.001) * f(5.0) > 0:
            return None
        sigma = float(brentq(f, 0.001, 5.0, xtol=1e-7, maxiter=100))
        return sigma if 0.001 <= sigma <= 5.0 else None
    except Exception:
        return None


# ── Heston characteristic function ────────────────────────────────────────────


def _heston_integrand(
    phi: np.ndarray,
    S: float,
    K: float,
    T: float,
    r: float,
    q: float,
    v0: float,
    kappa: float,
    theta: float,
    sigma_v: float,
    rho: float,
    j: int,
) -> np.ndarray:
    """
    Vectorised Heston integrand for P_j (Albrecher et al. 2007 'little trap').

    P_j = 0.5 + (1/π) ∫_0^∞ Re[e^{-iφ ln K} φ_j(φ)] / (iφ) dφ

    j=1 : u=+0.5, b=κ - ρσ_v
    j=2 : u=-0.5, b=κ
    """
    i = 1j
    phi = phi.astype(complex)

    u_j = 0.5 if j == 1 else -0.5
    b_j = (kappa - rho * sigma_v) if j == 1 else kappa
    a = kappa * theta

    d = np.sqrt((rho * sigma_v * i * phi - b_j) ** 2 - sigma_v**2 * (2 * i * u_j * phi - phi**2))

    # Little-trap: g uses numerator = b - ρσ iφ - d
    num_g = b_j - rho * sigma_v * i * phi - d
    den_g = b_j - rho * sigma_v * i * phi + d
    g = num_g / den_g

    exp_neg_dT = np.exp(-d * T)
    denom = 1.0 - g * exp_neg_dT

    D = num_g / sigma_v**2 * (1.0 - exp_neg_dT) / denom
    C = r * i * phi * T + a / sigma_v**2 * (num_g * T - 2.0 * np.log(denom / (1.0 - g)))

    f_j = np.exp(C + D * v0 + i * phi * np.log(S / K))  # = exp(…) * (S/K)^{iφ}
    return np.real(f_j / (i * phi))  # exp(-iφ ln K) cancels with S/K formulation


# ── HestonAdapter ─────────────────────────────────────────────────────────────


class HestonAdapter:
    """
    Heston model pricer and calibrator.

    Pricing via Gauss-Legendre quadrature on [ε, Φ_max] for numerical stability.
    Calibration via L-BFGS-B minimising MSE in implied-vol space.
    """

    _PHI_LO: float = 1e-3
    _PHI_HI: float = 100.0
    _N_QUAD: int = 128

    def __init__(self) -> None:
        x, w = np.polynomial.legendre.leggauss(self._N_QUAD)
        # Map from [-1, 1] → [PHI_LO, PHI_HI]
        a, b = self._PHI_LO, self._PHI_HI
        self._phi = 0.5 * (b - a) * x + 0.5 * (b + a)
        self._w = 0.5 * (b - a) * w

    # ── Pricing ───────────────────────────────────────────────────────────────

    def _P(self, S, K, T, r, q, v0, kappa, theta, sigma_v, rho, j: int) -> float:
        integ = _heston_integrand(self._phi, S, K, T, r, q, v0, kappa, theta, sigma_v, rho, j)
        return 0.5 + float(np.sum(self._w * integ)) / np.pi

    def price_call(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        q: float,
        v0: float,
        kappa: float,
        theta: float,
        sigma_v: float,
        rho: float,
    ) -> float:
        """Semi-analytical Heston call price."""
        if T <= 0:
            return max(S * np.exp(-q * T) - K * np.exp(-r * T), 0.0)
        try:
            P1 = self._P(S, K, T, r, q, v0, kappa, theta, sigma_v, rho, 1)
            P2 = self._P(S, K, T, r, q, v0, kappa, theta, sigma_v, rho, 2)
            raw = S * np.exp(-q * T) * P1 - K * np.exp(-r * T) * P2
            floor = max(S * np.exp(-q * T) - K * np.exp(-r * T), 0.0)
            return max(float(raw), floor)
        except Exception:
            return max(S * np.exp(-q * T) - K * np.exp(-r * T), 0.0)

    def price_put(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        q: float,
        v0: float,
        kappa: float,
        theta: float,
        sigma_v: float,
        rho: float,
    ) -> float:
        """Put price via put-call parity."""
        call = self.price_call(S, K, T, r, q, v0, kappa, theta, sigma_v, rho)
        return call + K * np.exp(-r * T) - S * np.exp(-q * T)

    def heston_iv(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        q: float,
        v0: float,
        kappa: float,
        theta: float,
        sigma_v: float,
        rho: float,
    ) -> float | None:
        """BS implied vol from Heston model price (OTM option chosen automatically)."""
        if T <= 0:
            return None
        F = S * np.exp((r - q) * T)
        option_type = "call" if K >= F else "put"
        if option_type == "call":
            price = self.price_call(S, K, T, r, q, v0, kappa, theta, sigma_v, rho)
        else:
            price = self.price_put(S, K, T, r, q, v0, kappa, theta, sigma_v, rho)
        return bs_implied_vol(price, S, K, T, r, q, option_type)

    # ── Calibration ───────────────────────────────────────────────────────────

    def calibrate(
        self,
        market_points: list[dict],
        S: float,
        r: float,
        q: float,
    ) -> dict:
        """
        Calibrate Heston parameters to market implied vols.

        Parameters
        ----------
        market_points : list of {K, T, iv, weight?}
        S, r, q      : market data

        Returns
        -------
        dict : {v0, kappa, theta, sigma_v, rho, rmse, success, n_points}
        """
        if len(market_points) < 5:
            raise ValueError(f"Need ≥5 calibration points (got {len(market_points)})")

        atm_iv = float(np.median([p["iv"] for p in market_points]))
        x0 = np.array([atm_iv**2, 2.0, atm_iv**2, 0.4, -0.7])
        bounds = [(1e-4, 0.9), (0.1, 15.0), (1e-4, 0.9), (0.05, 2.0), (-0.99, 0.99)]

        def objective(x: np.ndarray) -> float:
            v0_, kappa_, theta_, sigma_v_, rho_ = x
            total, n = 0.0, 0
            for pt in market_points:
                K, T, iv_mkt = pt["K"], pt["T"], pt["iv"]
                w = pt.get("weight", 1.0)
                try:
                    iv_mdl = self.heston_iv(S, K, T, r, q, v0_, kappa_, theta_, sigma_v_, rho_)
                    if iv_mdl is not None and 0.001 < iv_mdl < 5.0:
                        total += w * (iv_mdl - iv_mkt) ** 2
                        n += 1
                    else:
                        total += w * 0.25
                except Exception:
                    total += 0.25
            return total / max(n, 1)

        result = minimize(
            objective,
            x0,
            method="L-BFGS-B",
            bounds=bounds,
            options={"maxiter": 300, "ftol": 1e-10, "gtol": 1e-7},
        )
        v0, kappa, theta, sigma_v, rho = result.x
        return {
            "v0": float(v0),
            "kappa": float(kappa),
            "theta": float(theta),
            "sigma_v": float(sigma_v),
            "rho": float(rho),
            "rmse": float(np.sqrt(result.fun)),
            "success": bool(result.success),
            "n_points": len(market_points),
        }

    # ── Surface generation ────────────────────────────────────────────────────

    def generate_surface(
        self,
        S: float,
        r: float,
        q: float,
        params: dict,
        n_strikes: int = 20,
        n_maturities: int = 8,
    ) -> dict:
        """
        Generate a smooth implied-vol surface on a regular grid.

        Returns
        -------
        dict with keys: strikes, moneyness, maturities_years, implied_vols
        implied_vols[T_idx][K_idx] is in % (e.g., 25.3 means 25.3 %)
        """
        v0 = params["v0"]
        kappa = params["kappa"]
        theta = params["theta"]
        sigma_v = params["sigma_v"]
        rho = params["rho"]

        moneyness = np.linspace(0.70, 1.30, n_strikes)
        strikes = (moneyness * S).tolist()
        maturities = np.linspace(1 / 12, 2.0, n_maturities).tolist()  # 1m → 2y

        ivs: list[list[float | None]] = []
        for T in maturities:
            row: list[float | None] = []
            for K in strikes:
                iv = self.heston_iv(S, K, T, r, q, v0, kappa, theta, sigma_v, rho)
                row.append(round(iv * 100, 4) if iv is not None else None)
            ivs.append(row)

        return {
            "strikes": [round(k, 2) for k in strikes],
            "moneyness": [round(float(m), 4) for m in moneyness],
            "maturities_years": [round(T, 4) for T in maturities],
            "implied_vols": ivs,  # shape [n_maturities][n_strikes], values in %
        }
