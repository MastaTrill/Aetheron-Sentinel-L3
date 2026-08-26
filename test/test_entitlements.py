import pytest
from fastapi import HTTPException

from sentinel.billing_store import BillingStoreUnavailable
from sentinel.entitlements import (
    ResolvedCustomer,
    assert_active_subscription,
    authorize_sentinel_access,
    generate_api_key,
    hash_secret,
    resolve_customer_api_key_value,
)


class FakeStore:
    def __init__(self, key_row=None, subscription=None, fail=False):
        self.key_row = key_row
        self.subscription = subscription
        self.fail = fail
        self.touched = []

    def get_api_key_by_hash(self, _digest):
        if self.fail:
            raise BillingStoreUnavailable("offline")
        return self.key_row

    def get_subscription_by_id(self, _subscription_id):
        if self.fail:
            raise BillingStoreUnavailable("offline")
        return self.subscription

    def touch_api_key(self, key_id):
        self.touched.append(key_id)


def key_row(**overrides):
    row = {
        "id": "key-1",
        "subscription_id": "sub-row-1",
        "revoked_at": None,
    }
    row.update(overrides)
    return row


def subscription(**overrides):
    row = {
        "id": "sub-row-1",
        "stripe_customer_id": "cus_test",
        "stripe_subscription_id": "sub_test",
        "stripe_price_id": "price_pro",
        "status": "active",
    }
    row.update(overrides)
    return row


def test_generate_api_key_is_random_live_prefixed_and_hashed():
    first, prefix, digest = generate_api_key()
    second, _, _ = generate_api_key()
    assert first.startswith("sentinel_live_")
    assert len(first.removeprefix("sentinel_live_")) >= 40
    assert prefix == first[:24]
    assert digest == hash_secret(first)
    assert first not in digest
    assert first != second


def test_resolve_recognized_key_allows_inactive_subscription_for_portal():
    store = FakeStore(key_row=key_row(), subscription=subscription(status="past_due"))
    resolved = resolve_customer_api_key_value("sentinel_live_test", store)
    assert resolved.subscription["status"] == "past_due"
    assert store.touched == ["key-1"]


def test_resolve_rejects_revoked_key():
    store = FakeStore(key_row=key_row(revoked_at="2026-08-25T00:00:00Z"), subscription=subscription())
    with pytest.raises(HTTPException) as exc:
        resolve_customer_api_key_value("sentinel_live_test", store)
    assert exc.value.status_code == 401


def test_resolve_store_outage_is_503():
    with pytest.raises(HTTPException) as exc:
        resolve_customer_api_key_value("sentinel_live_test", FakeStore(fail=True))
    assert exc.value.status_code == 503


def test_active_entitlement_requires_active_status(monkeypatch):
    monkeypatch.setenv("STRIPE_SENTINEL_PRO_PRICE_ID", "price_pro")
    customer = ResolvedCustomer(key_row(), subscription(status="past_due"))
    with pytest.raises(HTTPException) as exc:
        assert_active_subscription(customer)
    assert exc.value.status_code == 403


def test_active_entitlement_requires_expected_price(monkeypatch):
    monkeypatch.setenv("STRIPE_SENTINEL_PRO_PRICE_ID", "price_pro")
    customer = ResolvedCustomer(key_row(), subscription(stripe_price_id="price_other"))
    with pytest.raises(HTTPException) as exc:
        assert_active_subscription(customer)
    assert exc.value.status_code == 403


def test_production_access_never_accepts_legacy_fallback(monkeypatch):
    monkeypatch.setenv("SENTINEL_ENV", "production")
    monkeypatch.setenv("STRIPE_SENTINEL_PRO_PRICE_ID", "price_pro")
    store = FakeStore(key_row=None, subscription=None)
    with pytest.raises(HTTPException) as exc:
        authorize_sentinel_access("fallback-dev-key-do-not-use-in-prod", store)
    assert exc.value.status_code == 401


def test_development_access_keeps_explicit_legacy_key(monkeypatch):
    monkeypatch.setenv("SENTINEL_ENV", "development")
    monkeypatch.setenv("SENTINEL_API_KEY", "dev-key")
    assert authorize_sentinel_access("dev-key", None) == "dev-key"
