from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any


class BillingStoreUnavailable(RuntimeError):
    """Raised when the backend billing store cannot be constructed or queried."""


@dataclass(frozen=True)
class SubscriptionRecord:
    stripe_customer_id: str
    stripe_subscription_id: str
    stripe_price_id: str
    customer_email: str | None
    status: str
    current_period_end: datetime | None
    cancel_at_period_end: bool

    def to_payload(self) -> dict[str, Any]:
        payload = asdict(self)
        if self.current_period_end is not None:
            payload["current_period_end"] = self.current_period_end.isoformat()
        payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        return payload


class BillingStore:
    def __init__(self, client: Any | None = None):
        self._client = client if client is not None else self._build_client()

    @staticmethod
    def _build_client() -> Any:
        url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not service_key:
            raise BillingStoreUnavailable(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for billing storage"
            )
        try:
            from supabase import create_client
        except ImportError as exc:
            raise BillingStoreUnavailable("supabase package is required for billing storage") from exc
        try:
            return create_client(url, service_key)
        except Exception as exc:  # pragma: no cover - provider-specific failure details
            raise BillingStoreUnavailable("Unable to initialize billing storage") from exc

    @staticmethod
    def _first(response: Any) -> dict[str, Any] | None:
        data = getattr(response, "data", None) or []
        return data[0] if data else None

    def create_claim(self, claim_id: str, claim_secret_hash: str, expires_at: datetime) -> None:
        try:
            self._client.table("sentinel_checkout_claims").insert({
                "claim_id": claim_id,
                "claim_secret_hash": claim_secret_hash,
                "expires_at": expires_at.isoformat(),
            }).execute()
        except Exception as exc:
            raise BillingStoreUnavailable("Unable to create checkout claim") from exc

    def bind_claim_session(self, claim_id: str, checkout_session_id: str) -> None:
        try:
            self._client.table("sentinel_checkout_claims").update({
                "stripe_checkout_session_id": checkout_session_id,
            }).eq("claim_id", claim_id).execute()
        except Exception as exc:
            raise BillingStoreUnavailable("Unable to bind checkout claim") from exc

    def upsert_subscription(self, record: SubscriptionRecord) -> dict[str, Any]:
        try:
            response = self._client.table("sentinel_subscriptions").upsert(
                record.to_payload(), on_conflict="stripe_subscription_id"
            ).execute()
        except Exception as exc:
            raise BillingStoreUnavailable("Unable to persist subscription") from exc
        row = self._first(response)
        if row is None:
            raise BillingStoreUnavailable("Subscription upsert returned no row")
        return row

    def get_subscription_by_id(self, subscription_id: str) -> dict[str, Any] | None:
        try:
            response = self._client.table("sentinel_subscriptions").select("*").eq(
                "id", subscription_id
            ).limit(1).execute()
            return self._first(response)
        except Exception as exc:
            raise BillingStoreUnavailable("Unable to read subscription") from exc

    def get_subscription_by_stripe_id(self, stripe_subscription_id: str) -> dict[str, Any] | None:
        try:
            response = self._client.table("sentinel_subscriptions").select("*").eq(
                "stripe_subscription_id", stripe_subscription_id
            ).limit(1).execute()
            return self._first(response)
        except Exception as exc:
            raise BillingStoreUnavailable("Unable to read subscription") from exc

    def get_api_key_by_hash(self, key_hash: str) -> dict[str, Any] | None:
        try:
            response = self._client.table("sentinel_api_keys").select("*").eq(
                "key_hash", key_hash
            ).limit(1).execute()
            return self._first(response)
        except Exception as exc:
            raise BillingStoreUnavailable("Unable to read API key") from exc

    def claim_and_create_api_key(
        self,
        checkout_session_id: str,
        claim_secret_hash: str,
        subscription_id: str,
        key_prefix: str,
        key_hash: str,
    ) -> dict[str, Any] | None:
        params = {
            "p_checkout_session_id": checkout_session_id,
            "p_claim_secret_hash": claim_secret_hash,
            "p_subscription_id": subscription_id,
            "p_key_prefix": key_prefix,
            "p_key_hash": key_hash,
        }
        try:
            response = self._client.rpc("claim_sentinel_checkout_and_create_key", params).execute()
            return self._first(response)
        except Exception as exc:
            raise BillingStoreUnavailable("Unable to claim checkout and create API key") from exc

    def revoke_api_key(self, key_id: str) -> None:
        try:
            self._client.table("sentinel_api_keys").update({
                "revoked_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", key_id).execute()
        except Exception as exc:
            raise BillingStoreUnavailable("Unable to revoke API key") from exc

    def touch_api_key(self, key_id: str) -> None:
        try:
            self._client.table("sentinel_api_keys").update({
                "last_used_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", key_id).execute()
        except Exception as exc:
            raise BillingStoreUnavailable("Unable to update API key usage") from exc

    def event_processed(self, stripe_event_id: str) -> bool:
        try:
            response = self._client.table("sentinel_billing_events").select(
                "stripe_event_id"
            ).eq("stripe_event_id", stripe_event_id).limit(1).execute()
            return self._first(response) is not None
        except Exception as exc:
            raise BillingStoreUnavailable("Unable to read billing event") from exc

    def record_event(self, stripe_event_id: str, event_type: str) -> None:
        try:
            self._client.table("sentinel_billing_events").insert({
                "stripe_event_id": stripe_event_id,
                "event_type": event_type,
            }).execute()
        except Exception as exc:
            raise BillingStoreUnavailable("Unable to record billing event") from exc


@lru_cache(maxsize=1)
def get_billing_store() -> BillingStore:
    return BillingStore()
