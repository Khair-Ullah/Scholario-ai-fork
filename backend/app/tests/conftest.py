import pytest

from app.core.ratelimit import limiter


@pytest.fixture(autouse=True)
def disable_rate_limiting():
    limiter.enabled = False
    yield
    limiter.enabled = True
