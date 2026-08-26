from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from sentinel.billing_store import get_billing_store
from sentinel.entitlements import ResolvedCustomer, require_active_subscription, resolve_customer_api_key
from sentinel import billing


class FakeStore:
    def __init__(self):
        self.claims = {}
        self.bound = {}
        self.subscriptions = {}
        self.claimed_sessions = set()
        self.events = set()
        self.created_api_keys = []
        self.revoked = []
        self.upserts = []

    def create_claim(self, claim_id, claim_secret_hash, expires_at):
        self.claims[claim_id] = {"hash": claim_secret_hash, "expires_at": expires_at}

    def bind_claim_session(self, claim_id, checkout_session_id):
        self.bound[checkout_session_id] = claim_id

    def upsert_subscription(self, record):
        row = {
            "id": "00000000-0000-0000-0000-000000000001",
            "stripe_customer_id": record.stripe_customer_id,
            "stripe_subscription_id": record.stripe_subscription_id,
            "stripe_price_id": record.stripe_price_id,
            "customer_email": record.customer_email,
            "status": record.status,
            "current_period_end": record.current_period_end.isoformat() if record.current_period_end else None,
            "cancel_at_period_end": record.cancel_at_period_end,
        }
        self.subscriptions[record.stripe_subscription_id] = row
        self.upserts.append(row)
        return row

    def claim_and_create_api_key(self, checkout_session_id, claim_secret_hash, subscription_id, key_prefix, key_hash):
        if checkout_session_id in self.claimed_sessions:
            return None
        claim_id = self.bound.get(checkout_session_id)
        claim = self.claims.get(claim_id)
        if not claim or claim["hash"] != claim_secret_hash:
            return None
        self.claimed_sessions.add(checkout_session_id)
        return {"api_key_id": "api-key-row"}

    def event_processed(self, event_id):
        return event_id in self.events

    def record_event(self, event_id, _event_type):
        self.events.add(event_id)

    def create_api_key(self, subscription_id, key_prefix, key_hash):
        row = {
            "id": f"key-{len(self.created_api_keys) + 1}",
            "subscription_id": subscription_id,
            "key_prefix": key_prefix,
            "key_hash": key_hash,
        }
        self.created_api_keys.append(row)
        return row

    def revoke_api_key(self, key_id):
        self.revoked.append(key_id)


class FakeCheckoutSessionAPI:
    def __init__(self, stripe):
        self.stripe = stripe

    def create(self, **kwargs):
        self.stripe.created_checkout = kwargs
        session = {
            "id": "cs_live_test",
            "url": "https://checkout.stripe.com/c/pay/cs_live_test",
            "client_reference_id": kwargs["client_reference_id"],
            "metadata": kwargs["metadata"],
        }
        self.stripe.sessions[session["id"]] = session
        return session

    def retrieve(self, session_id):
        return self.stripe.sessions[session_id]


class FakeSubscriptionAPI:
    def __init__(self, stripe):
        self.stripe = stripe

    def retrieve(self, subscription_id):
        self.stripe.subscription_retrieved = subscription_id
        return self.stripe.subscriptions[subscription_id]


class FakeWebhookAPI:
    def __init__(self, stripe):
        self.stripe = stripe

    def construct_event(self, payload, signature, secret):
        self.stripe.webhook_secret_used = secret
        if signature != "valid-signature":
            raise ValueError("bad signature")
        return self.stripe.next_event


class FakePortalSessionAPI:
    def __init__(self, stripe):
        self.stripe = stripe

    def create(self, **kwargs):
        self.stripe.created_portal = kwargs
        return {"url": "https://billing.stripe.com/p/session/test"}


class FakeStripe:
    def __init__(self):
        self.api_key = None
        self.sessions = {}
        self.subscriptions = {}
        self.created_checkout = None
        self.created_portal = None
        self.subscription_retrieved = None
        self.webhook_secret_used = None
        self.next_event = None
        self.checkout = type("CheckoutNS", (), {})()
        self.checkout.Session = FakeCheckoutSessionAPI(self)
        self.Subscription = FakeSubscriptionAPI(self)
        self.Webhook = FakeWebhookAPI(self)
        self.billing_portal = type("PortalNS", (), {})()
        self.billing_portal.Session = FakePortalSessionAPI(self)


def stripe_subscription(status="active", price="price_pro"):
    return {
        "id": "sub_live",
        "customer": "cus_live",
        "status": status,
        "cancel_at_period_end": False,
        "items": {
            "data": [{
                "price": {"id": price},
                "current_period_end": 1789852800,
            }]
        },
    }


@pytest.fixture
def billing_env(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_fake")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_fake")
    monkeypatch.setenv("STRIPE_SENTINEL_PRO_PRICE_ID", "price_pro")
    monkeypatch.setenv("SENTINEL_DASHBOARD_URL", "https://sentinel.example")


@pytest.fixture
def fake_store():
    return FakeStore()


@pytest.fixture
def fake_stripe(monkeypatch):
    stripe = FakeStripe()
    stripe.subscriptions["sub_live"] = stripe_subscription()
    monkeypatch.setattr(billing, "get_stripe_sdk", lambda: stripe)
    return stripe


@pytest.fixture
def app(fake_store):
    application = FastAPI()
    application.include_router(billing.router)
    application.dependency_overrides[get_billing_store] = lambda: fake_store
    return application


@pytest.fixture
def client(app, billing_env, fake_stripe):
    billing._rate_windows.clear()
    return TestClient(app)


def test_checkout_returns_url_and_one_time_claim_secret(client, fake_store, fake_stripe):
    response = client.post("/billing/checkout")
    assert response.status_code == 200
    body = response.json()
    assert body["checkout_url"].startswith("https://checkout.stripe.com/")
    assert body["claim_secret"]
    assert "sk_" not in response.text
    assert fake_stripe.created_checkout["mode"] == "subscription"
    assert fake_stripe.created_checkout["line_items"] == [{"price": "price_pro", "quantity": 1}]
    assert fake_stripe.created_checkout["success_url"].endswith("session_id={CHECKOUT_SESSION_ID}")
    assert len(fake_store.claims) == 1


def prepare_completed_checkout(client, fake_store, fake_stripe):
    checkout = client.post("/billing/checkout").json()
    session = fake_stripe.sessions["cs_live_test"]
    session.update({
        "status": "complete",
        "subscription": "sub_live",
        "customer_details": {"email": "buyer@example.com"},
    })
    return checkout


def test_claim_succeeds_before_webhook_by_syncing_subscription(client, fake_store, fake_stripe):
    checkout = prepare_completed_checkout(client, fake_store, fake_stripe)
    response = client.post("/billing/claim", json={
        "checkout_session_id": "cs_live_test",
        "claim_secret": checkout["claim_secret"],
    })
    assert response.status_code == 200
    assert response.json()["api_key"].startswith("sentinel_live_")
    assert fake_stripe.subscription_retrieved == "sub_live"
    assert fake_store.upserts[-1]["stripe_price_id"] == "price_pro"
    assert fake_store.upserts[-1]["current_period_end"] == datetime.fromtimestamp(
        1789852800, tz=timezone.utc
    ).isoformat()


def test_claim_replay_does_not_issue_second_key(client, fake_store, fake_stripe):
    checkout = prepare_completed_checkout(client, fake_store, fake_stripe)
    payload = {"checkout_session_id": "cs_live_test", "claim_secret": checkout["claim_secret"]}
    assert client.post("/billing/claim", json=payload).status_code == 200
    assert client.post("/billing/claim", json=payload).status_code == 409


def test_claim_rejects_wrong_subscription_price(client, fake_store, fake_stripe):
    checkout = prepare_completed_checkout(client, fake_store, fake_stripe)
    fake_stripe.subscriptions["sub_live"] = stripe_subscription(price="price_other")
    response = client.post("/billing/claim", json={
        "checkout_session_id": "cs_live_test",
        "claim_secret": checkout["claim_secret"],
    })
    assert response.status_code == 403
    assert not fake_store.claimed_sessions


def test_invalid_webhook_signature_is_400(client, fake_stripe):
    response = client.post(
        "/billing/webhook",
        content=b"{}",
        headers={"stripe-signature": "bad"},
    )
    assert response.status_code == 400


def test_duplicate_webhook_is_success_without_second_mutation(client, fake_store, fake_stripe):
    fake_stripe.next_event = {
        "id": "evt_1",
        "type": "customer.subscription.updated",
        "data": {"object": stripe_subscription()},
    }
    headers = {"stripe-signature": "valid-signature"}
    first = client.post("/billing/webhook", content=b"{}", headers=headers)
    first_count = len(fake_store.upserts)
    second = client.post("/billing/webhook", content=b"{}", headers=headers)
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["duplicate"] is True
    assert len(fake_store.upserts) == first_count


def test_inactive_recognized_key_can_open_portal(app, billing_env, fake_stripe):
    inactive = ResolvedCustomer(
        api_key={"id": "key-old", "subscription_id": "sub-row"},
        subscription={
            "id": "sub-row",
            "stripe_customer_id": "cus_live",
            "stripe_subscription_id": "sub_live",
            "stripe_price_id": "price_pro",
            "status": "past_due",
        },
    )
    app.dependency_overrides[resolve_customer_api_key] = lambda: inactive
    with TestClient(app) as local_client:
        response = local_client.post("/billing/portal")
    assert response.status_code == 200
    assert response.json()["url"].startswith("https://billing.stripe.com/")
    assert fake_stripe.created_portal["customer"] == "cus_live"


def test_rotation_persists_replacement_before_revoking_old(app, billing_env, fake_store, fake_stripe):
    active = ResolvedCustomer(
        api_key={"id": "key-old", "subscription_id": "00000000-0000-0000-0000-000000000001"},
        subscription={
            "id": "00000000-0000-0000-0000-000000000001",
            "stripe_customer_id": "cus_live",
            "stripe_subscription_id": "sub_live",
            "stripe_price_id": "price_pro",
            "status": "active",
        },
    )
    app.dependency_overrides[require_active_subscription] = lambda: active
    with TestClient(app) as local_client:
        response = local_client.post("/billing/api-key/rotate")
    assert response.status_code == 200
    assert response.json()["api_key"].startswith("sentinel_live_")
    assert fake_store.created_api_keys
    assert fake_store.revoked == ["key-old"]


def test_checkout_rate_limit_rejects_eleventh_request(client):
    statuses = [client.post("/billing/checkout").status_code for _ in range(11)]
    assert statuses[:10] == [200] * 10
    assert statuses[10] == 429
