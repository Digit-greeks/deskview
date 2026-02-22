"""
Vol Surface Router
==================
Two endpoints:
  GET /vol-surface/{ticker}/market  — raw market implied vols (fast, ~3-5s)
  GET /vol-surface/{ticker}/heston  — Heston calibration + smooth surface (~20-60s)
"""

from __future__ import annotations

from datetime import date

import numpy as np
import yfinance as yf
from fastapi import APIRouter, HTTPException, Query

from src.read.adapters.market_data.yahoo_finance_adapter import YahooFinanceAdapter
from src.write.adapters.pricing.heston_adapter import HestonAdapter, bs_implied_vol

router = APIRouter(prefix="/vol-surface", tags=["Vol Surface"])
_market = YahooFinanceAdapter()
_heston = HestonAdapter()

# ── helpers ────────────────────────────────────────────────────────────────────


def _fetch_iv_points(
    ticker: str,
    S: float,
    r: float,
    q: float,
    max_maturities: int = 8,
    moneyness_lo: float = 0.70,
    moneyness_hi: float = 1.30,
    min_days: int = 7,
    max_days: int = 730,
    otm_only: bool = False,
) -> list[dict]:
    """
    Extract implied-vol points from Yahoo Finance options chains.

    Returns list of dicts: {strike, maturity, maturity_str, iv, moneyness, option_type}
    where iv is in % (e.g. 25.4 means 25.4 %).
    """
    stock = yf.Ticker(ticker)
    expirations = stock.options
    if not expirations:
        raise ValueError(f"No options data available for {ticker}")

    today = date.today()

    valid_exp = [
        e for e in expirations if min_days <= (date.fromisoformat(e) - today).days <= max_days
    ]
    selected = valid_exp[:max_maturities]
    if not selected:
        raise ValueError(f"No maturities in the {min_days}–{max_days}d window for {ticker}")

    points: list[dict] = []
    F_by_T: dict[str, float] = {}

    for exp_str in selected:
        T = (date.fromisoformat(exp_str) - today).days / 365.0
        if T <= 0:
            continue
        F_by_T[exp_str] = S * np.exp((r - q) * T)

        try:
            chain = stock.option_chain(exp_str)
        except Exception:
            continue

        for opt_type, df in [("call", chain.calls), ("put", chain.puts)]:
            F = F_by_T[exp_str]
            for _, row in df.iterrows():
                K = float(row["strike"])
                bid = float(row.get("bid", 0) or 0)
                ask = float(row.get("ask", 0) or 0)

                # Moneyness filter
                m = K / S
                if not (moneyness_lo <= m <= moneyness_hi):
                    continue

                # OTM-only filter (improves calibration quality)
                if otm_only:
                    if opt_type == "call" and K < F * 0.99:
                        continue
                    if opt_type == "put" and K > F * 1.01:
                        continue

                # Liquidity / quote validity
                if bid <= 0 or ask <= bid:
                    continue
                mid = (bid + ask) / 2.0
                if (ask - bid) > mid:  # spread > 100 % of mid
                    continue

                iv_raw = bs_implied_vol(mid, S, K, T, r, q, opt_type)
                if iv_raw is None or not (0.02 <= iv_raw <= 3.0):
                    continue

                volume = float(row.get("volume", 0) or 0)
                points.append(
                    {
                        "strike": round(K, 2),
                        "maturity": round(T, 6),
                        "maturity_str": exp_str,
                        "iv": round(iv_raw * 100, 4),  # in %
                        "moneyness": round(m, 4),
                        "option_type": opt_type,
                        "volume": int(volume),
                        "_iv_raw": iv_raw,  # keep raw for calibration
                        "_K": K,
                        "_T": T,
                        "_weight": max(volume, 1.0),
                    }
                )

    return points


# ── endpoints ──────────────────────────────────────────────────────────────────


@router.get("/{ticker}/market")
def get_market_surface(
    ticker: str,
    max_maturities: int = Query(default=8, ge=1, le=15),
):
    """
    Fetch raw market implied-vol scatter from Yahoo Finance options chains.
    Fast endpoint (~3–6 s depending on ticker).
    """
    try:
        ticker = ticker.upper()
        md = _market.get_market_data(ticker)
        S, r, q = float(md.spot), float(md.risk_free_rate), float(md.dividend_yield)

        pts = _fetch_iv_points(ticker, S, r, q, max_maturities=max_maturities)
        if not pts:
            raise ValueError(f"No valid implied-vol points found for {ticker}")

        # Strip internal keys
        public_pts = [{k: v for k, v in p.items() if not k.startswith("_")} for p in pts]

        return {
            "ticker": ticker,
            "spot": round(S, 2),
            "r": round(r, 4),
            "q": round(float(q), 4),
            "n_points": len(public_pts),
            "points": public_pts,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Market surface error: {e}") from e


@router.get("/{ticker}/heston")
def get_heston_surface(
    ticker: str,
    max_maturities: int = Query(default=6, ge=2, le=10),
):
    """
    Calibrate Heston model to market IV data and return a smooth implied-vol surface.
    Slower endpoint (~20–60 s depending on ticker and number of options).

    Returns calibrated parameters + market scatter + smooth surface grid.
    """
    try:
        ticker = ticker.upper()
        md = _market.get_market_data(ticker)
        S, r, q = float(md.spot), float(md.risk_free_rate), float(md.dividend_yield)

        # Use OTM options for calibration (more reliable quotes, no intrinsic ambiguity)
        pts = _fetch_iv_points(
            ticker,
            S,
            r,
            q,
            max_maturities=max_maturities,
            min_days=14,
            max_days=540,
            otm_only=True,
        )

        if len(pts) < 5:
            raise ValueError(
                f"Not enough market IV points for calibration "
                f"(got {len(pts)}, need ≥5). "
                "Try a more liquid ticker."
            )

        # Build calibration inputs
        cal_pts = [
            {"K": p["_K"], "T": p["_T"], "iv": p["_iv_raw"], "weight": p["_weight"]} for p in pts
        ]
        scatter = [{k: v for k, v in p.items() if not k.startswith("_")} for p in pts]

        # Calibrate Heston
        params = _heston.calibrate(cal_pts, S, r, q)

        # Generate smooth surface
        surface = _heston.generate_surface(S, r, q, params)

        return {
            "ticker": ticker,
            "spot": round(S, 2),
            "r": round(r, 4),
            "q": round(float(q), 4),
            "params": params,
            "market_scatter": scatter,
            "surface": surface,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Heston calibration error: {e}") from e
