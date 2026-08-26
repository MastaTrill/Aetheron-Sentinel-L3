from __future__ import annotations

import os
from urllib.parse import urlparse

_REQUIRED_PRODUCTION_ENV = (
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_SENTINEL_PRO_PRICE_ID",
    "SENTINEL_DASHBOARD_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
)


def is_production() -> bool:
    return os.getenv("SENTINEL_ENV", "development").lower() == "production"


def _dashboard_origin() -> str:
    raw = os.getenv("SENTINEL_DASHBOARD_URL", "")
    parsed = urlparse(raw)
    if parsed.scheme != "https" or not parsed.netloc:
        raise RuntimeError("SENTINEL_DASHBOARD_URL must be an absolute https URL in production")
    return f"{parsed.scheme}://{parsed.netloc}"


def validate_production_configuration() -> None:
    if not is_production():
        return
    missing = [name for name in _REQUIRED_PRODUCTION_ENV if not os.getenv(name)]
    if missing:
        raise RuntimeError(
            "Missing required Sentinel production configuration: " + ", ".join(missing)
        )
    _dashboard_origin()


def cors_origins() -> list[str]:
    if is_production():
        return [_dashboard_origin()]
    return ["http://localhost:5173", "http://127.0.0.1:5173"]
