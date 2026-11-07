import os

import pytest

from app.core.ratelimit import limiter

os.environ["AI_PROVIDER"] = "mock"
os.environ["AI_FALLBACK_TO_MOCK"] = "true"


@pytest.fixture(autouse=True)
def disable_rate_limiting():
    limiter.enabled = False
    yield
    limiter.enabled = True
