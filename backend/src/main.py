from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.read.web.routers.market_data_router import router as market_data_router
from src.read.web.routers.greeks_router import router as greeks_router
import os

app = FastAPI(
    title="DeskView API",
    description="Equity Derivatives Risk Terminal",
    version="0.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market_data_router)
app.include_router(greeks_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "DeskView API"}
