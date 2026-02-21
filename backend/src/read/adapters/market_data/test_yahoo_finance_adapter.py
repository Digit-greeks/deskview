import pytest
from src.read.adapters.market_data.yahoo_finance_adapter import YahooFinanceAdapter


@pytest.fixture
def adapter():
    return YahooFinanceAdapter()


def test_get_market_data_aapl(adapter):
    data = adapter.get_market_data("AAPL")
    assert data.spot > 0
    assert 0 < data.implied_vol < 2
    assert data.risk_free_rate > 0


def test_get_available_maturities(adapter):
    maturities = adapter.get_available_maturities("AAPL")
    assert len(maturities) > 0


def test_get_options_chain(adapter):
    chain = adapter.get_options_chain("AAPL")
    assert "calls" in chain
    assert "puts" in chain
    assert len(chain["calls"]) > 0