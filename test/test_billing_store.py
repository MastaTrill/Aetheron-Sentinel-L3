from datetime import datetime, timezone
from pathlib import Path

from sentinel.billing_store import BillingStore, SubscriptionRecord


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, client, table):
        self.client = client
        self.table = table
        self.payload = None
        self.on_conflict = None
        self.filters = []
        self.limit_value = None
        self.operation = None

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def upsert(self, payload, on_conflict=None):
        self.operation = "upsert"
        self.payload = payload
        self.on_conflict = on_conflict
        self.client.last_on_conflict = on_conflict
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def select(self, _fields="*"):
        self.operation = "select"
        return self

    def eq(self, field, value):
        self.filters.append((field, value))
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def execute(self):
        self.client.last_table = self.table
        self.client.last_query = self
        data = self.client.table_results.get(self.table, [])
        if self.operation in {"insert", "upsert", "update"}:
            data = [self.payload]
        return FakeResponse(data)


class FakeRpc:
    def __init__(self, client, name, params):
        self.client = client
        self.name = name
        self.params = params

    def execute(self):
        self.client.last_rpc = self.name
        self.client.last_rpc_params = self.params
        return FakeResponse(self.client.rpc_result)


class FakeSupabase:
    def __init__(self):
        self.last_table = None
        self.last_on_conflict = None
        self.last_query = None
        self.last_rpc = None
        self.last_rpc_params = None
        self.rpc_result = []
        self.table_results = {}

    def table(self, name):
        return FakeQuery(self, name)

    def rpc(self, name, params):
        return FakeRpc(self, name, params)


def test_upsert_subscription_conflicts_on_stripe_subscription_id():
    fake = FakeSupabase()
    store = BillingStore(client=fake)
    store.upsert_subscription(SubscriptionRecord(
        stripe_customer_id="cus_test",
        stripe_subscription_id="sub_test",
        stripe_price_id="price_pro",
        customer_email="buyer@example.com",
        status="active",
        current_period_end=datetime(2026, 9, 25, tzinfo=timezone.utc),
        cancel_at_period_end=False,
    ))

    assert fake.last_table == "sentinel_subscriptions"
    assert fake.last_on_conflict == "stripe_subscription_id"
    assert fake.last_query.payload["current_period_end"] == "2026-09-25T00:00:00+00:00"


def test_atomic_claim_and_key_uses_single_rpc_and_returns_inserted_row():
    fake = FakeSupabase()
    fake.rpc_result = [{"api_key_id": "key-row-id"}]
    store = BillingStore(client=fake)

    result = store.claim_and_create_api_key(
        checkout_session_id="cs_test",
        claim_secret_hash="claimhash",
        subscription_id="00000000-0000-0000-0000-000000000001",
        key_prefix="sentinel_live_prefix",
        key_hash="keyhash",
    )

    assert result == {"api_key_id": "key-row-id"}
    assert fake.last_rpc == "claim_sentinel_checkout_and_create_key"
    assert fake.last_rpc_params == {
        "p_checkout_session_id": "cs_test",
        "p_claim_secret_hash": "claimhash",
        "p_subscription_id": "00000000-0000-0000-0000-000000000001",
        "p_key_prefix": "sentinel_live_prefix",
        "p_key_hash": "keyhash",
    }


def test_atomic_claim_and_key_returns_none_for_invalid_or_used_claim():
    fake = FakeSupabase()
    fake.rpc_result = []
    store = BillingStore(client=fake)

    assert store.claim_and_create_api_key(
        "cs_test", "claimhash", "00000000-0000-0000-0000-000000000001",
        "sentinel_live_prefix", "keyhash"
    ) is None


def test_get_api_key_by_hash_limits_to_one_row():
    fake = FakeSupabase()
    fake.table_results["sentinel_api_keys"] = [{"id": "key-1", "key_hash": "hash"}]
    store = BillingStore(client=fake)

    row = store.get_api_key_by_hash("hash")

    assert row["id"] == "key-1"
    assert ("key_hash", "hash") in fake.last_query.filters
    assert fake.last_query.limit_value == 1


def test_billing_migration_has_atomic_claim_key_rpc_and_rls():
    sql = Path("supabase/migrations/20260825230300_sentinel_pro_billing.sql").read_text()
    for table in (
        "sentinel_subscriptions",
        "sentinel_api_keys",
        "sentinel_checkout_claims",
        "sentinel_billing_events",
    ):
        assert f"alter table {table} enable row level security" in sql.lower()
    assert "claim_sentinel_checkout_and_create_key" in sql
    assert "grant execute on function" in sql.lower()
    assert "to service_role" in sql.lower()
    assert "from public, anon, authenticated" in sql.lower()


def test_create_api_key_persists_only_prefix_hash_and_subscription():
    fake = FakeSupabase()
    store = BillingStore(client=fake)

    row = store.create_api_key(
        subscription_id="00000000-0000-0000-0000-000000000001",
        key_prefix="sentinel_live_prefix",
        key_hash="digest-only",
    )

    assert fake.last_table == "sentinel_api_keys"
    assert fake.last_query.payload == {
        "subscription_id": "00000000-0000-0000-0000-000000000001",
        "key_prefix": "sentinel_live_prefix",
        "key_hash": "digest-only",
    }
    assert row["key_hash"] == "digest-only"
