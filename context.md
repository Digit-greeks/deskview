# DeskView — Project Context

## Vision & Ambition

DeskView is a **professional-grade equity derivatives risk terminal** built to demonstrate front-office trading desk skills. The goal is to create a tool that looks and feels like something used in a real trading room — not a student project.

**Target audience:**
- Primary: Trading desk managers evaluating Martin's candidacy as a trader
- Secondary: Finance students and professionals on LinkedIn

**LinkedIn pitch:**
> "Built a front-office grade equity derivatives risk terminal — real market data, vol surface calibration, PnL explain, and hedge optimizer. Python/React, hexagonal architecture, CQRS."

---

## About the Developer

**Martin Murcia** — Final-year Master's in Quantitative Finance (University of Montpellier)
- Email: martinmurcia3@gmail.com
- GitHub: https://github.com/Digit-greeks
- Current internship: **Crédit Agricole CIB** — Commando Developer, Non-Linear Rates desk (Jan–Jul 2026)
- Previous internship: **Société Générale CIB** — Commando Developer, Equity Exotic Derivatives desk (Jan–Jul 2025)
- Previous project: **Greek-Vision** (https://greek-vision.fr) — Educational options Greeks visualization tool
- Seeking: Final trading internship from July 2026
- Skills: Python (advanced), React, FastAPI, hexagonal architecture, Black-Scholes, Heston, SVI, DV01, Greeks

---

## Project Stack

### Backend
- **Language:** Python 3.12.9
- **Framework:** FastAPI + Uvicorn
- **Data:** yfinance (Yahoo Finance — free, no API key needed)
- **Pricing:** Black-Scholes (implemented), Heston (planned), SVI calibration (planned)
- **Architecture:** Hexagonal (Ports & Adapters) + CQRS (read/write separation)
- **Testing:** pytest + pytest-asyncio + pytest-cov
- **Dependencies:** numpy, scipy, pandas, pydantic, httpx, python-dotenv

### Frontend
- **Framework:** React 18 + TypeScript (Vite)
- **Styling:** Tailwind CSS — dark Bloomberg terminal aesthetic
- **HTTP:** Axios
- **Charts:** Plotly.js + react-plotly.js (3D vol surface)
- **Routing:** react-router-dom

### Infrastructure
- **Version control:** Git + GitHub (https://github.com/Digit-greeks/deskview)
- **Containerization:** Docker Desktop (planned)
- **Languages:** French / English (bilingual UI planned)

---

## Architecture

### Backend folder structure

```
deskview/
├── docker-compose.yml
├── .gitignore
├── README.md
└── backend/
    ├── .env
    ├── .env.example
    ├── pyproject.toml
    ├── pytest.ini
    ├── Dockerfile
    └── src/
        ├── main.py                          # FastAPI app entry point
        ├── read/                            # CQRS Query side
        │   ├── core/
        │   │   ├── domain/
        │   │   └── use_cases/
        │   ├── adapters/
        │   │   └── market_data/
        │   │       ├── yahoo_finance_adapter.py
        │   │       └── test_yahoo_finance_adapter.py
        │   └── web/
        │       └── routers/
        │           ├── market_data_router.py
        │           └── greeks_router.py
        ├── write/                           # CQRS Command side
        │   ├── core/
        │   ├── adapters/
        │   │   └── pricing/
        │   │       ├── black_scholes_adapter.py
        │   │       └── test_black_scholes_adapter.py
        │   └── web/
        └── shared/                          # Shared domain between read/write
            ├── domain/
            │   ├── entities/
            │   │   ├── option_contract.py   # OptionContract, OptionType, Underlying
            │   │   ├── position.py          # Position (contract + entry_price)
            │   │   └── book.py              # Book (list of positions)
            │   └── value_objects/
            │       ├── greeks.py            # Greeks (delta, gamma, vega, theta, rho)
            │       ├── market_data.py       # MarketData (spot, vol, rate, div)
            │       ├── pnl_explain.py       # PnLExplain (delta/gamma/vega/theta PnL)
            │       └── shock_scenario.py    # ShockScenario (spot/vol/rate/time shocks)
            └── tests/
                ├── integration/
                └── e2e/
```

### Key architectural principles
- **Domain is pure Python** — zero external dependencies in domain layer
- **Ports are interfaces** — adapters implement them (Yahoo Finance, Black-Scholes, etc.)
- **CQRS** — read side for fast queries (Greeks, market data), write side for heavy compute (calibration, Monte Carlo)
- **Test colocation** — each adapter/use_case has its test file right next to it

---

## Domain Model

### Entities
```python
Underlying(ticker: str, currency: str)
OptionContract(underlying, option_type: CALL|PUT, strike, maturity, quantity)
Position(contract: OptionContract, entry_price: float)
Book(positions: list[Position])
```

### Value Objects
```python
Greeks(delta, gamma, vega, theta, rho)          # scalable + additive
MarketData(spot, implied_vol, risk_free_rate, dividend_yield)
ShockScenario(spot_shock, vol_shock, rate_shock, time_decay_days)
PnLExplain(delta_pnl, gamma_pnl, vega_pnl, theta_pnl) → total_pnl property
```

---

## API Endpoints (currently live)

```
GET  /health                          → {"status": "ok", "service": "DeskView API"}
GET  /api/market-data/{ticker}        → real-time spot, vol, rate, dividend
GET  /api/maturities/{ticker}         → available option expiries
POST /api/greeks                      → Black-Scholes price + Greeks
GET  /docs                            → Swagger UI (auto-generated)
```

### Example: POST /api/greeks
```json
Request:
{
  "ticker": "AAPL",
  "option_type": "call",
  "strike": 265,
  "maturity": "2026-06-20",
  "quantity": 1
}

Response:
{
  "ticker": "AAPL",
  "spot": 264.58,
  "option_type": "call",
  "strike": 265,
  "price": 6.2198,
  "delta": 0.2459,
  "gamma": 0.006659,
  "vega": 0.4472,
  "theta": 0.0062,
  "rho": 0.1918
}
```

---

## Tests (all passing)

```
backend/src/write/adapters/pricing/test_black_scholes_adapter.py  → 8 passed
backend/src/read/adapters/market_data/test_yahoo_finance_adapter.py → 3 passed
```

Test coverage includes: call/put pricing, put-call parity, delta bounds, gamma positivity, vega positivity, theta negativity, real market data fetching, maturities retrieval.

---

## Frontend (current state)

Single page app running on http://localhost:5173

**MarketDataPage** — Search any ticker, displays:
- Spot Price
- Implied Vol (historical 30d vol as proxy)
- Risk-Free Rate (hardcoded 5% for now)
- Dividend Yield

Dark Bloomberg-style UI with Tailwind CSS, emerald green accent color.

---

## Planned Features (Roadmap)

### V1 (in progress)
- [x] Black-Scholes pricer with full Greeks
- [x] Yahoo Finance market data adapter
- [x] FastAPI REST API
- [x] React dark mode UI — market data search
- [ ] Greeks Calculator UI — user inputs strike/maturity/call-put, sees Greeks + price
- [ ] Book Builder UI — add multiple positions, see aggregated Greeks
- [ ] Shock Simulator — sliders for spot/vol/rate/time, real-time PnL recalculation
- [ ] PnL Explain — decompose PnL into delta/gamma/vega/theta components

### V2
- [ ] Vol Surface 3D — interactive Plotly 3D surface from real options chain data
- [ ] SVI calibration — industry-standard vol surface parametrization
- [ ] Heston model calibration (Martin already implemented this for Tesla in a previous project)
- [ ] Arbitrage detection on vol surface (butterfly, calendar)
- [ ] Hedge Optimizer — propose delta-neutral or vega-neutral hedge

### V3
- [ ] Monte Carlo simulation for scenario analysis
- [ ] FRED API integration for real risk-free rates (replacing hardcoded 5%)
- [ ] Multi-language UI (FR/EN)
- [ ] Docker deployment
- [ ] Custom domain deployment

---

## Running the project locally

### Backend
```bash
cd backend
.venv\Scripts\Activate.ps1   # Windows
uvicorn src.main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs (Swagger)
```

### Frontend
```bash
cd frontend
npm run dev
# → http://localhost:5173
```

### Run tests
```bash
cd backend
pytest src/ -v
```

---

## Important notes for development

1. **Python version:** Must use Python 3.12.9. Python 3.14 is NOT compatible with pandas/scipy yet.
2. **Virtual env:** Always activate `.venv` before running backend commands
3. **File creation on Windows:** Use PowerShell `Out-File` with `-Encoding utf8` for Python files to avoid encoding issues that break imports
4. **CQRS principle:** Heavy compute (calibration, Monte Carlo) goes in `write/`, fast reads go in `read/`
5. **Domain purity:** Never import FastAPI, yfinance, or any external lib in `shared/domain/`

---

## Git & GitHub

- Repo: https://github.com/Digit-greeks/deskview
- Branch: main
- Commit convention: `feat:`, `fix:`, `test:`, `refactor:`
