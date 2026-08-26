from __future__ import annotations

import hashlib
import os
import secrets
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, Header, HTTPException

from .billing_store import BillingStore, BillingStoreUnavailable, get_billing_store


@dataclass(frozen=True)
class ResolvedCustomer:
    api_key: dict[str, Any]
    subscription: dict[str, Any]


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    plaintext = f"sentinel_live_{secrets.token_urlsafe(32)}"
    return plaintext, plaintext[:24], hash_secret(plaintext)


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=401, detail="Invalid or missing API Key")


def resolve_customer_api_key_value(
    api_key: str | None,
    store: BillingStore,
) -> ResolvedCustomer:
    if not api_key:
        raise _unauthorized()

    try:
        key_row = store.get_api_key_by_hash(hash_secret(api_key))
        if not key_row or key_row.get("revoked_at"):
            raise _unauthorized()
        subscription = store.get_subscription_by_id(key_row["subscription_id"])
    except HTTPException:
        raise
    except BillingStoreUnavailable as exc:
        raise HTTPException(status_code=503, detail="Entitlement service unavailable") from exc

    if not subscription:
        raise HTTPException(status_code=503, detail="Entitlement service unavailable")

    try:
        store.touch_api_key(key_row["id"])
    except BillingStoreUnavailable:
        pass

    return ResolvedCustomer(api_key=key_row, subscription=subscription)


def assert_active_subscription(customer: ResolvedCustomer) -> ResolvedCustomer:
    expected_price = os.getenv("STRIPE_SENTINEL_PRO_PRICE_ID")
    if not expected_price:
        raise HTTPException(status_code=503, detail="Entitlement service unavailable")
    subscription = customer.subscription
    if (
        subscription.get("status") != "active"
        or subscription.get("stripe_price_id") != expected_price
    ):
        raise HTTPException(status_code=403, detail="Sentinel Pro subscription required")
    return customer


def authorize_sentinel_access(
    api_key: str | None,
    store: BillingStore | None,
) -> ResolvedCustomer | str:
    if os.getenv("SENTINEL_ENV", "development").lower() == "production":
        if store is None:
            raise HTTPException(status_code=503, detail="Entitlement service unavailable")
        return assert_active_subscription(resolve_customer_api_key_value(api_key, store))

    expected = os.getenv("SENTINEL_API_KEY", "fallback-dev-key-do-not-use-in-prod")
    if api_key != expected:
        raise _unauthorized()
    return api_key


def get_access_store() -> BillingStore | None:
    if os.getenv("SENTINEL_ENV", "development").lower() == "production":
        return get_billing_store()
    return None


def resolve_customer_api_key(
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    store: BillingStore = Depends(get_billing_store),
) -> ResolvedCustomer:
    return resolve_customer_api_key_value(x_api_key, store)


def require_active_subscription(
    customer: ResolvedCustomer = Depends(resolve_customer_api_key),
) -> ResolvedCustomer:
    return assert_active_subscription(customer)


def require_sentinel_access(
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    store: BillingStore | None = Depends(get_access_store),
) -> ResolvedCustomer | str:
    return authorize_sentinel_access(x_api_key, store)
