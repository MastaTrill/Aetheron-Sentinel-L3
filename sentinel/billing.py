from __future__ import annotations

import os
import secrets
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .billing_store import (
    BillingStore,
    BillingStoreUnavailable,
    SubscriptionRecord,
    get_billing_store,
)
from .entitlements import (
    ResolvedCustomer,
    generate_api_key,
    hash_secret,
    require_active_subscription,
    resolve_customer_api_key,
)


router = APIRouter(prefix="/billing", tags=["billing"])

_RATE_LIMIT = 10
_RATE_WINDOW_SECONDS = 600.0
_rate_lock = threading.Lock()
_rate_windows: dict[str, deque[float]] = {}


class ClaimRequest(BaseModel):
    checkout_session_id: str
    claim_secret: str


def _value(obj: Any, key: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable")
    return value


def get_stripe_sdk() -> Any:
    try:
        import stripe
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable") from exc
    stripe.api_key = _required_env("STRIPE_SECRET_KEY")
    return stripe


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _enforce_rate_limit(request: Request, route: str) -> None:
    key = f"{route}:{_client_ip(request)}"
    now = time.monotonic()
    cutoff = now - _RATE_WINDOW_SECONDS
    with _rate_lock:
        window = _rate_windows.setdefault(key, deque())
        while window and window[0] <= cutoff:
            window.popleft()
        if len(window) >= _RATE_LIMIT:
            raise HTTPException(status_code=429, detail="Too many requests")
        window.append(now)


def _stripe_id(value: Any) -> str | None:
    if isinstance(value, str):
        return value
    return _value(value, "id")


def _subscription_item(subscription: Any) -> Any:
    items = _value(_value(subscription, "items", {}), "data", []) or []
    if not items:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable")
    return items[0]


def subscription_record_from_stripe(
    subscription: Any,
    customer_email: str | None = None,
) -> SubscriptionRecord:
    item = _subscription_item(subscription)
    price_id = _stripe_id(_value(item, "price"))
    subscription_id = _stripe_id(subscription)
    customer_id = _stripe_id(_value(subscription, "customer"))
    if not subscription_id or not customer_id or not price_id:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable")

    period_end = _value(item, "current_period_end")
    period_end_dt = (
        datetime.fromtimestamp(int(period_end), tz=timezone.utc)
        if period_end is not None
        else None
    )
    return SubscriptionRecord(
        stripe_customer_id=customer_id,
        stripe_subscription_id=subscription_id,
        stripe_price_id=price_id,
        customer_email=customer_email,
        status=str(_value(subscription, "status", "")),
        current_period_end=period_end_dt,
        cancel_at_period_end=bool(_value(subscription, "cancel_at_period_end", False)),
    )


def _retrieve_subscription(stripe_sdk: Any, subscription_id: str) -> Any:
    try:
        return stripe_sdk.Subscription.retrieve(subscription_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable") from exc


def _sync_subscription(
    stripe_sdk: Any,
    store: BillingStore,
    subscription_id: str,
    customer_email: str | None = None,
) -> dict[str, Any]:
    subscription = _retrieve_subscription(stripe_sdk, subscription_id)
    record = subscription_record_from_stripe(subscription, customer_email=customer_email)
    try:
        return store.upsert_subscription(record)
    except BillingStoreUnavailable as exc:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable") from exc


def _invoice_subscription_id(invoice: Any) -> str | None:
    direct = _stripe_id(_value(invoice, "subscription"))
    if direct:
        return direct
    parent = _value(invoice, "parent")
    details = _value(parent, "subscription_details")
    return _stripe_id(_value(details, "subscription"))


@router.post("/checkout")
def create_checkout(request: Request, store: BillingStore = Depends(get_billing_store)):
    _enforce_rate_limit(request, "checkout")
    price_id = _required_env("STRIPE_SENTINEL_PRO_PRICE_ID")
    dashboard_url = _required_env("SENTINEL_DASHBOARD_URL").rstrip("/")
    stripe_sdk = get_stripe_sdk()

    claim_id = str(uuid.uuid4())
    claim_secret = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=60)
    try:
        store.create_claim(claim_id, hash_secret(claim_secret), expires_at)
    except BillingStoreUnavailable as exc:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable") from exc

    try:
        session = stripe_sdk.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=(
                f"{dashboard_url}/?checkout=success&session_id={{CHECKOUT_SESSION_ID}}"
            ),
            cancel_url=f"{dashboard_url}/?checkout=cancelled",
            client_reference_id=claim_id,
            metadata={"claim_id": claim_id, "app": "sentinel-l3", "plan": "pro"},
            subscription_data={"metadata": {"app": "sentinel-l3", "plan": "pro"}},
        )
        session_id = _stripe_id(session)
        checkout_url = _value(session, "url")
        if not session_id or not checkout_url:
            raise RuntimeError("Stripe Checkout returned incomplete session")
        store.bind_claim_session(claim_id, session_id)
    except BillingStoreUnavailable as exc:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable") from exc

    return {"checkout_url": checkout_url, "claim_secret": claim_secret}


@router.post("/claim")
def claim_checkout(
    payload: ClaimRequest,
    request: Request,
    store: BillingStore = Depends(get_billing_store),
):
    _enforce_rate_limit(request, "claim")
    expected_price = _required_env("STRIPE_SENTINEL_PRO_PRICE_ID")
    stripe_sdk = get_stripe_sdk()

    try:
        session = stripe_sdk.checkout.Session.retrieve(payload.checkout_session_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid Checkout session") from exc

    if _value(session, "status") != "complete":
        raise HTTPException(status_code=400, detail="Checkout is not complete")
    subscription_id = _stripe_id(_value(session, "subscription"))
    if not subscription_id:
        raise HTTPException(status_code=400, detail="Checkout has no subscription")
    claim_id = _value(session, "client_reference_id")
    metadata_claim_id = _value(_value(session, "metadata", {}), "claim_id")
    if not claim_id or metadata_claim_id != claim_id:
        raise HTTPException(status_code=400, detail="Invalid Checkout claim")

    customer_details = _value(session, "customer_details", {})
    email = _value(customer_details, "email")
    subscription_row = _sync_subscription(
        stripe_sdk, store, subscription_id, customer_email=email
    )
    if subscription_row.get("stripe_price_id") != expected_price:
        raise HTTPException(status_code=403, detail="Unsupported Sentinel subscription")
    if subscription_row.get("status") != "active":
        raise HTTPException(status_code=403, detail="Sentinel Pro subscription required")

    plaintext, prefix, digest = generate_api_key()
    try:
        created = store.claim_and_create_api_key(
            payload.checkout_session_id,
            hash_secret(payload.claim_secret),
            subscription_row["id"],
            prefix,
            digest,
        )
    except BillingStoreUnavailable as exc:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable") from exc
    if not created:
        raise HTTPException(status_code=409, detail="Checkout claim is invalid, expired, or already used")

    return {"api_key": plaintext, "key_prefix": prefix, "subscription_status": "active"}


@router.post("/webhook")
async def stripe_webhook(request: Request, store: BillingStore = Depends(get_billing_store)):
    stripe_sdk = get_stripe_sdk()
    webhook_secret = _required_env("STRIPE_WEBHOOK_SECRET")
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    try:
        event = stripe_sdk.Webhook.construct_event(payload, signature, webhook_secret)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid Stripe webhook signature") from exc

    event_id = _value(event, "id")
    event_type = _value(event, "type")
    if not event_id or not event_type:
        raise HTTPException(status_code=400, detail="Invalid Stripe webhook event")
    try:
        if store.event_processed(event_id):
            return {"received": True, "duplicate": True}
    except BillingStoreUnavailable as exc:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable") from exc

    obj = _value(_value(event, "data", {}), "object", {})
    if event_type in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }:
        try:
            store.upsert_subscription(subscription_record_from_stripe(obj))
        except BillingStoreUnavailable as exc:
            raise HTTPException(status_code=503, detail="Billing temporarily unavailable") from exc
    elif event_type == "checkout.session.completed":
        subscription_id = _stripe_id(_value(obj, "subscription"))
        if subscription_id:
            details = _value(obj, "customer_details", {})
            _sync_subscription(
                stripe_sdk,
                store,
                subscription_id,
                customer_email=_value(details, "email"),
            )
    elif event_type in {"invoice.paid", "invoice.payment_failed"}:
        subscription_id = _invoice_subscription_id(obj)
        if subscription_id:
            _sync_subscription(stripe_sdk, store, subscription_id)

    try:
        store.record_event(event_id, event_type)
    except BillingStoreUnavailable as exc:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable") from exc
    return {"received": True, "duplicate": False}


@router.post("/portal")
def create_portal(
    customer: ResolvedCustomer = Depends(resolve_customer_api_key),
):
    dashboard_url = _required_env("SENTINEL_DASHBOARD_URL").rstrip("/")
    stripe_sdk = get_stripe_sdk()
    customer_id = customer.subscription.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable")
    try:
        session = stripe_sdk.billing_portal.Session.create(
            customer=customer_id,
            return_url=dashboard_url,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable") from exc
    return {"url": _value(session, "url")}


@router.post("/api-key/rotate")
def rotate_api_key(
    customer: ResolvedCustomer = Depends(require_active_subscription),
    store: BillingStore = Depends(get_billing_store),
):
    plaintext, prefix, digest = generate_api_key()
    try:
        store.create_api_key(customer.subscription["id"], prefix, digest)
        store.revoke_api_key(customer.api_key["id"])
    except BillingStoreUnavailable as exc:
        raise HTTPException(status_code=503, detail="Billing temporarily unavailable") from exc
    return {"api_key": plaintext, "key_prefix": prefix}
