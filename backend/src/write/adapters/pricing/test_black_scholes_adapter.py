from datetime import date, timedelta

import pytest

from src.shared.domain.entities.option_contract import (
    OptionContract,
    OptionType,
    Underlying,
)
from src.shared.domain.value_objects.market_data import MarketData
from src.write.adapters.pricing.black_scholes_adapter import BlackScholesAdapter


@pytest.fixture
def pricer():
    return BlackScholesAdapter()


@pytest.fixture
def market_data():
    return MarketData(
        spot=100.0,
        implied_vol=0.20,
        risk_free_rate=0.05,
        dividend_yield=0.0,
    )


@pytest.fixture
def call_contract():
    return OptionContract(
        underlying=Underlying(ticker="AAPL"),
        option_type=OptionType.CALL,
        strike=100.0,
        maturity=date.today() + timedelta(days=365),
        quantity=1.0,
    )


@pytest.fixture
def put_contract():
    return OptionContract(
        underlying=Underlying(ticker="AAPL"),
        option_type=OptionType.PUT,
        strike=100.0,
        maturity=date.today() + timedelta(days=365),
        quantity=1.0,
    )


def test_call_price_positive(pricer, call_contract, market_data):
    price = pricer.price(call_contract, market_data)
    assert price > 0


def test_put_price_positive(pricer, put_contract, market_data):
    price = pricer.price(put_contract, market_data)
    assert price > 0


def test_put_call_parity(pricer, call_contract, put_contract, market_data):
    """C - P = S*e^(-qT) - K*e^(-rT)"""
    call_price = pricer.price(call_contract, market_data)
    put_price = pricer.price(put_contract, market_data)
    diff = call_price - put_price
    assert abs(diff - (market_data.spot - call_contract.strike * 0.951)) < 1.0


def test_delta_call_between_0_and_1(pricer, call_contract, market_data):
    greeks = pricer.greeks(call_contract, market_data)
    assert 0 <= greeks.delta <= 1


def test_delta_put_between_minus1_and_0(pricer, put_contract, market_data):
    greeks = pricer.greeks(put_contract, market_data)
    assert -1 <= greeks.delta <= 0


def test_gamma_positive(pricer, call_contract, market_data):
    greeks = pricer.greeks(call_contract, market_data)
    assert greeks.gamma > 0


def test_vega_positive(pricer, call_contract, market_data):
    greeks = pricer.greeks(call_contract, market_data)
    assert greeks.vega > 0


def test_theta_negative(pricer, call_contract, market_data):
    """Le theta est toujours négatif — le temps joue contre l'acheteur."""
    greeks = pricer.greeks(call_contract, market_data)
    assert greeks.theta < 0
