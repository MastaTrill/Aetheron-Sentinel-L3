# Aetheron Sentinel Pro Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first production revenue path for Aetheron Sentinel L3: a $99/month Stripe-hosted Sentinel Pro subscription that issues a customer-specific API key and gates protected Sentinel API/dashboard capabilities by Stripe subscription state.

**Architecture:** Keep Stripe and Supabase service credentials entirely in the FastAPI gateway. Stripe Checkout creates subscriptions, verified webhooks synchronize entitlement state to backend-only Supabase tables, and one-time Checkout claims issue hashed-at-rest Sentinel API keys. The Vite dashboard uses a small API client and session-only credential storage; Base Sepolia/Base Mainnet deployment pipelines remain independent and unchanged.

**Tech Stack:** Python 3.11, FastAPI 0.136.0, Pydantic 2.13.2, Stripe Python 15.5.1, Supabase Python 2.28.3, structlog 26.1.0, pytest 9.1.1, React 19/Vite 8/TypeScript 6, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-25-sentinel-pro-billing-design.md`

## Global Constraints

- Product: `Aetheron Sentinel Pro`, exactly `$99.00 USD/month`, flat-rate, pay up front, no trial.
- Checkout: Stripe-hosted Checkout; no custom card handling in Sentinel code.
- Service entitlement: only Stripe subscription status `active` on `STRIPE_SENTINEL_PRO_PRICE_ID` grants protected Sentinel service access.
- Customer Portal: a recognized, non-revoked API key may open the portal even when service entitlement is inactive.
- API keys: prefix `sentinel_live_` plus at least 32 bytes of cryptographically secure URL-safe randomness; persist SHA-256 hash only; plaintext is returned once.
- Checkout claim secret: hashed at rest, 60-minute expiry, single-use.
- Production secrets remain backend-only: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, API-key hashes, and claim hashes must never use `VITE_` variables or enter browser code.
- Production CORS allows only the exact configured `SENTINEL_DASHBOARD_URL` origin; no wildcard.
- `POST /billing/checkout` and `POST /billing/claim` are limited to 10 attempts per 10 minutes per client IP for the first release.
- Production must never authorize `fallback-dev-key-do-not-use-in-prod`.
- Base Sepolia/Base Mainnet deployment workflows and Solidity release scope are not modified by this plan.
- Existing `CI`, `Security`, and `Dashboard` workflows must end green; the tracked-secret scanner must pass.

## File Structure

- Create `requirements-gateway.txt` — minimal, pinned Python runtime/test dependencies for the gateway so CI does not install the repository's large ML/tooling requirements set.
- Create `supabase/migrations/20260825230300_sentinel_pro_billing.sql` — billing tables, indexes, RLS, and atomic checkout-claim consume RPC.
- Create `sentinel/billing_store.py` — backend-only Supabase persistence adapter and typed records.
- Create `sentinel/entitlements.py` — key generation/hashing plus recognized-key and active-subscription authorization dependencies.
- Create `sentinel/billing.py` — Stripe Checkout, claim, webhook, Customer Portal, key rotation, and IP rate-limit routes.
- Modify `sentinel/api.py` — replace mixed shared-key/public protection with one environment-aware Sentinel access dependency.
- Modify `sentinel_gateway_prototype.py` — include billing router, exact-origin CORS, and production configuration validation.
- Create `test/test_billing_store.py` — deterministic persistence-adapter tests with fake Supabase client.
- Create `test/test_entitlements.py` — cryptographic key and authorization tests.
- Create `test/test_billing_api.py` — FastAPI/Stripe-mocked billing integration tests.
- Modify `test/test_sentinel_gateway.py` only if app-level production-auth coverage belongs there after router wiring.
- Create `dashboard/src/api/sentinelClient.ts` — base URL resolution, session API-key access, authenticated/public request helpers.
- Create `dashboard/src/components/SentinelProBilling.tsx` — upgrade, claim, key-entry, rotate, and portal UI.
- Modify `dashboard/src/App.tsx` — mount billing component and route existing Sentinel API calls through `sentinelClient` instead of literal fallback credentials.
- Modify `dashboard/src/App.css` — minimal styles for billing/access card consistent with the existing dashboard.
- Modify `.github/workflows/ci.yml` — treat gateway/Python/Supabase files as code and run gateway pytest suite.
- Modify `.github/workflows/security.yml` — include Python gateway, billing, Supabase migration, and requirements paths in security triggers.
- Modify `DEPLOYMENT_GATEWAY.md` — production environment variables, billing endpoints, Stripe webhook, CORS, and no-fallback-key rules.

---

### Task 1: Add the backend billing schema and persistence adapter

**Files:**
- Create: `supabase/migrations/20260825230300_sentinel_pro_billing.sql`
- Create: `sentinel/billing_store.py`
- Create: `test/test_billing_store.py`

**Interfaces:**
- Produces `BillingStore` with methods used by Tasks 2-3:
  - `create_claim(claim_id: str, claim_secret_hash: str, expires_at: datetime) -> None`
  - `bind_claim_session(claim_id: str, checkout_session_id: str) -> None`
  - `consume_claim(checkout_session_id: str, claim_secret_hash: str) -> dict | None`
  - `upsert_subscription(record: SubscriptionRecord) -> dict`
  - `get_subscription_by_stripe_id(stripe_subscription_id: str) -> dict | None`
  - `get_subscription_by_id(subscription_id: str) -> dict | None`
  - `get_api_key_by_hash(key_hash: str) -> dict | None`
  - `create_api_key(subscription_id: str, key_prefix: str, key_hash: str) -> dict`
  - `revoke_api_key(key_id: str) -> None`
  - `touch_api_key(key_id: str) -> None`
  - `event_processed(stripe_event_id: str) -> bool`
  - `record_event(stripe_event_id: str, event_type: str) -> None`

- [ ] **Step 1: Write failing store tests around the exact adapter contract**

Create `test/test_billing_store.py` with a fake Supabase client and tests equivalent to:

```python
from datetime import datetime, timezone

from sentinel.billing_store import BillingStore, SubscriptionRecord


def test_upsert_subscription_uses_stripe_subscription_id(fake_supabase):
    store = BillingStore(client=fake_supabase)
    record = SubscriptionRecord(
        stripe_customer_id="cus_test",
        stripe_subscription_id="sub_test",
        stripe_price_id="price_pro",
        customer_email="buyer@example.com",
        status="active",
        current_period_end=datetime(2026, 9, 25, tzinfo=timezone.utc),
        cancel_at_period_end=False,
    )
    store.upsert_subscription(record)
    assert fake_supabase.last_table == "sentinel_subscriptions"
    assert fake_supabase.last_on_conflict == "stripe_subscription_id"


def test_consume_claim_returns_none_for_invalid_or_used_claim(fake_supabase):
    fake_supabase.rpc_result = []
    store = BillingStore(client=fake_supabase)
    assert store.consume_claim("cs_test", "deadbeef") is None
```

The fake client needs only the table/query/RPC calls exercised by this file; do not mock the entire Supabase package.

- [ ] **Step 2: Run the new test file and verify import failure**

Run:

```bash
python -m pytest test/test_billing_store.py -q
```

Expected: FAIL because `sentinel.billing_store` does not exist.

- [ ] **Step 3: Create the SQL migration with backend-only RLS**

The migration must create `pgcrypto` if needed and these four tables exactly: `sentinel_subscriptions`, `sentinel_api_keys`, `sentinel_checkout_claims`, `sentinel_billing_events`. Use UUID primary keys via `gen_random_uuid()`, unique constraints on Stripe customer/subscription IDs and key hashes, and foreign key `sentinel_api_keys.subscription_id -> sentinel_subscriptions.id ON DELETE CASCADE`.

Add indexes on `sentinel_api_keys(key_hash)`, `sentinel_api_keys(subscription_id)`, `sentinel_subscriptions(stripe_customer_id)`, and `sentinel_checkout_claims(stripe_checkout_session_id)`.

Enable RLS on all four tables and do **not** create any `anon` or `authenticated` allow policy. The server's service-role key bypasses RLS; browser clients get no direct billing-table access.

Add atomic RPC:

```sql
create or replace function consume_sentinel_checkout_claim(
  p_checkout_session_id text,
  p_claim_secret_hash text
)
returns setof sentinel_checkout_claims
language sql
security definer
set search_path = public
as $$
  update sentinel_checkout_claims
  set claimed_at = now()
  where stripe_checkout_session_id = p_checkout_session_id
    and claim_secret_hash = p_claim_secret_hash
    and claimed_at is null
    and expires_at > now()
  returning *;
$$;

revoke all on function consume_sentinel_checkout_claim(text, text) from public, anon, authenticated;
grant execute on function consume_sentinel_checkout_claim(text, text) to service_role;
```

- [ ] **Step 4: Implement the minimal typed persistence adapter**

Use a dataclass for subscription writes:

```python
@dataclass(frozen=True)
class SubscriptionRecord:
    stripe_customer_id: str
    stripe_subscription_id: str
    stripe_price_id: str
    customer_email: str | None
    status: str
    current_period_end: datetime | None
    cancel_at_period_end: bool
```

`BillingStore.__init__` accepts an injected client for tests; otherwise lazily constructs `create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`. If either backend environment variable is missing, raise `BillingStoreUnavailable` rather than falling back to the anon key.

Use Supabase response `.data`, not dictionary-style `.get("status_code")` assumptions.

- [ ] **Step 5: Run store tests**

```bash
python -m pytest test/test_billing_store.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit the schema/store slice**

```bash
git add supabase/migrations/20260825230300_sentinel_pro_billing.sql sentinel/billing_store.py test/test_billing_store.py
git commit -m "feat: add Sentinel billing persistence"
```

### Task 2: Add customer API keys and entitlement dependencies

**Files:**
- Create: `sentinel/entitlements.py`
- Create: `test/test_entitlements.py`

**Interfaces:**
- Consumes: `BillingStore` from Task 1 and `STRIPE_SENTINEL_PRO_PRICE_ID`.
- Produces:
  - `hash_secret(value: str) -> str`
  - `generate_api_key() -> tuple[str, str, str]` returning `(plaintext, prefix, hash)`
  - `ResolvedCustomer` dataclass containing API-key row + subscription row
  - `resolve_customer_api_key(x_api_key: str = Header(...)) -> ResolvedCustomer`
  - `require_active_subscription(customer: ResolvedCustomer = Depends(resolve_customer_api_key)) -> ResolvedCustomer`
  - `require_sentinel_access(...)` that uses paid entitlement in production and explicit legacy dev-key compatibility outside production.

- [ ] **Step 1: Write failing cryptographic and entitlement tests**

Cover key prefix/length, stable SHA-256 hashing, revoked-key rejection, inactive-subscription distinction, wrong-price rejection, and production fallback rejection:

```python
def test_generate_api_key_is_live_prefixed_and_not_stored_plaintext():
    plaintext, prefix, digest = generate_api_key()
    assert plaintext.startswith("sentinel_live_")
    assert prefix == plaintext[:24]
    assert digest == hash_secret(plaintext)
    assert plaintext not in digest


def test_active_entitlement_requires_active_status_and_expected_price(monkeypatch, fake_store):
    monkeypatch.setenv("STRIPE_SENTINEL_PRO_PRICE_ID", "price_pro")
    customer = resolved_customer(status="past_due", stripe_price_id="price_pro")
    with pytest.raises(HTTPException) as exc:
        require_active_subscription(customer)
    assert exc.value.status_code == 403
```

- [ ] **Step 2: Run tests and verify failure**

```bash
python -m pytest test/test_entitlements.py -q
```

Expected: FAIL because `sentinel.entitlements` does not exist.

- [ ] **Step 3: Implement key generation and recognized-key resolution**

Generate with `secrets.token_urlsafe(32)` and SHA-256:

```python
def generate_api_key() -> tuple[str, str, str]:
    plaintext = f"sentinel_live_{secrets.token_urlsafe(32)}"
    return plaintext, plaintext[:24], hash_secret(plaintext)
```

`resolve_customer_api_key` must return HTTP 401 for missing/unknown/revoked keys and HTTP 503 when persistence is unavailable. On success, call `touch_api_key` best-effort after authorization; a telemetry update failure must not convert a valid request into success if the underlying lookup itself failed.

- [ ] **Step 4: Implement strict active entitlement and dev compatibility**

`require_active_subscription` must require both `subscription["status"] == "active"` and `subscription["stripe_price_id"] == os.environ["STRIPE_SENTINEL_PRO_PRICE_ID"]`.

`require_sentinel_access` behavior:

```python
if os.getenv("SENTINEL_ENV", "development").lower() == "production":
    return await require_active_subscription(...)

expected = os.getenv("SENTINEL_API_KEY", "fallback-dev-key-do-not-use-in-prod")
if x_api_key != expected:
    raise HTTPException(status_code=401, detail="Invalid or missing API Key")
return x_api_key
```

Do not permit the fallback branch when `SENTINEL_ENV=production`.

- [ ] **Step 5: Run entitlement tests**

```bash
python -m pytest test/test_entitlements.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add sentinel/entitlements.py test/test_entitlements.py
git commit -m "feat: enforce Sentinel Pro entitlements"
```

### Task 3: Implement Stripe Checkout, claim, webhook, portal, and key rotation

**Files:**
- Create: `sentinel/billing.py`
- Create: `test/test_billing_api.py`
- Create: `requirements-gateway.txt`

**Interfaces:**
- Consumes: `BillingStore`, `SubscriptionRecord`, `generate_api_key`, `hash_secret`, `resolve_customer_api_key`, `require_active_subscription`.
- Produces FastAPI router with:
  - `POST /billing/checkout`
  - `POST /billing/claim`
  - `POST /billing/webhook`
  - `POST /billing/portal`
  - `POST /billing/api-key/rotate`

- [ ] **Step 1: Pin the minimal gateway dependency set**

Create `requirements-gateway.txt`:

```text
fastapi==0.136.0
httpx==0.28.1
pydantic==2.13.2
pytest==9.1.1
requests==2.33.1
stripe==15.5.1
structlog==26.1.0
supabase==2.28.3
uvicorn==0.44.0
```

Do not add billing secrets or live IDs to this file.

- [ ] **Step 2: Write failing FastAPI billing tests with dependency/network fakes**

Use `TestClient` against a small test FastAPI app that includes `billing.router`. Monkeypatch the billing store and Stripe calls. Required cases:

```python
def test_checkout_returns_url_and_one_time_claim_secret(client):
    response = client.post("/billing/checkout")
    assert response.status_code == 200
    body = response.json()
    assert body["checkout_url"].startswith("https://checkout.stripe.com/")
    assert body["claim_secret"]
    assert "sk_" not in response.text


def test_claim_succeeds_before_webhook_by_syncing_subscription(client, fake_stripe):
    response = client.post("/billing/claim", json={
        "checkout_session_id": "cs_complete",
        "claim_secret": "claim-secret",
    })
    assert response.status_code == 200
    assert response.json()["api_key"].startswith("sentinel_live_")
    assert fake_stripe.subscription_retrieved == "sub_live"


def test_duplicate_webhook_is_success_without_second_mutation(client, signed_event):
    first = client.post("/billing/webhook", data=signed_event.body, headers=signed_event.headers)
    second = client.post("/billing/webhook", data=signed_event.body, headers=signed_event.headers)
    assert first.status_code == 200
    assert second.status_code == 200
```

Also test invalid signature -> 400; claim replay -> 409; incomplete Checkout -> 400; unsupported price -> 403; recognized inactive key can open portal; inactive key cannot rotate; and 11th checkout/claim request in one 10-minute window -> 429.

- [ ] **Step 3: Run tests and verify failure**

```bash
python -m pytest test/test_billing_api.py -q
```

Expected: FAIL because `sentinel.billing` does not exist.

- [ ] **Step 4: Implement environment validation and Stripe helpers**

At request time, require:

```python
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_SENTINEL_PRO_PRICE_ID
SENTINEL_DASHBOARD_URL
```

Create a helper `subscription_record_from_stripe(subscription, customer_email=None) -> SubscriptionRecord` that extracts the first subscription item price ID and converts `current_period_end` Unix seconds to UTC datetime.

Use Stripe's server SDK only; never accept a client-supplied price ID.

- [ ] **Step 5: Implement Checkout creation and one-time claim**

Checkout session creation must use:

```python
stripe.checkout.Session.create(
    mode="subscription",
    line_items=[{"price": price_id, "quantity": 1}],
    success_url=f"{dashboard_url}/?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
    cancel_url=f"{dashboard_url}/?checkout=cancelled",
    client_reference_id=claim_id,
    metadata={"claim_id": claim_id, "app": "sentinel-l3", "plan": "pro"},
    subscription_data={"metadata": {"app": "sentinel-l3", "plan": "pro"}},
)
```

Generate/store claim before returning. Bind `session.id` to the claim after Stripe creates it. If Stripe creation fails, return HTTP 503 with generic `Billing temporarily unavailable` and do not log the claim secret.

Claim processing order must be:
1. Retrieve Stripe Checkout Session by `checkout_session_id`.
2. Require `status == "complete"` and a subscription ID.
3. Require `client_reference_id`/metadata claim ID.
4. Retrieve Stripe subscription and verify its actual price ID equals `STRIPE_SENTINEL_PRO_PRICE_ID`.
5. Synchronously upsert subscription into Supabase.
6. Atomically consume the claim with session ID + SHA-256 of submitted secret.
7. Require resulting subscription status active.
8. Generate one API key, persist only hash/prefix, return plaintext once.

This ordering guarantees browser return does not depend on webhook timing while still preventing claim replay.

- [ ] **Step 6: Implement webhook lifecycle synchronization**

Read the raw body:

```python
payload = await request.body()
signature = request.headers.get("stripe-signature", "")
event = stripe.Webhook.construct_event(payload, signature, webhook_secret)
```

For `customer.subscription.created|updated|deleted`, upsert the subscription deterministically then `record_event` only after persistence succeeds. For `checkout.session.completed`, retrieve/upsert the referenced subscription if present. For `invoice.paid` and `invoice.payment_failed`, retrieve the referenced subscription and refresh its state. If `event_processed(event.id)` is true, return `{"received": True, "duplicate": True}` immediately.

- [ ] **Step 7: Implement portal and key rotation**

Portal uses `Depends(resolve_customer_api_key)`, not active entitlement:

```python
session = stripe.billing_portal.Session.create(
    customer=resolved.subscription["stripe_customer_id"],
    return_url=os.environ["SENTINEL_DASHBOARD_URL"],
)
```

Rotation uses `Depends(require_active_subscription)`: create new key, persist it, then revoke the old presented key. If persistence of the replacement fails, do not revoke the old key.

- [ ] **Step 8: Implement a small in-memory IP limiter for checkout/claim**

Use a lock + `dict[str, deque[float]]` keyed by `route:client_ip`, evict timestamps older than 600 seconds, allow 10, then 429. This is explicitly version-1 single-process protection; document that a Redis/shared limiter is required before horizontally scaling the gateway.

- [ ] **Step 9: Run billing tests**

```bash
python -m pytest test/test_billing_api.py test/test_billing_store.py test/test_entitlements.py -q
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add requirements-gateway.txt sentinel/billing.py test/test_billing_api.py
git commit -m "feat: add Stripe Sentinel Pro billing API"
```

### Task 4: Secure the existing Sentinel API and wire billing into the gateway

**Files:**
- Modify: `sentinel/api.py`
- Modify: `sentinel_gateway_prototype.py`
- Modify: `test/test_sentinel_gateway.py`
- Extend: `test/test_billing_api.py`

**Interfaces:**
- Consumes `require_sentinel_access` and `billing.router`.
- Produces one FastAPI app where `/health`, `/billing/checkout`, `/billing/claim`, and `/billing/webhook` are public; `/billing/portal` is recognized-key protected; billing rotation + Sentinel service endpoints are active-entitlement protected in production.

- [ ] **Step 1: Write app-level failing tests**

Build the production app under `SENTINEL_ENV=production` and assert:

```python
def test_production_analyze_rejects_legacy_fallback(client):
    response = client.post(
        "/analyze",
        json={"prompt": "safe"},
        headers={"X-API-Key": "fallback-dev-key-do-not-use-in-prod"},
    )
    assert response.status_code == 401


def test_health_remains_public(client):
    assert client.get("/health").status_code == 200
```

Add CORS test with allowed dashboard origin receiving `access-control-allow-origin` and a different origin not receiving it.

- [ ] **Step 2: Replace per-route mixed protection in `sentinel/api.py`**

Import `require_sentinel_access` and apply `dependencies=[Depends(require_sentinel_access)]` to `/sync`, `/analyze`, `/reset`, `/chat`, `/honeypot`, `/logs`. Remove `get_api_key_dep` so there is one policy definition instead of a second fallback-key implementation.

- [ ] **Step 3: Wire billing router and exact CORS into the gateway**

In `sentinel_gateway_prototype.py`:

```python
from fastapi.middleware.cors import CORSMiddleware
from sentinel.billing import router as billing_router

app.include_router(sentinel_router)
app.include_router(billing_router)
```

When `SENTINEL_ENV=production`, require a parseable `https://` `SENTINEL_DASHBOARD_URL` and configure CORS with exactly that origin, `allow_credentials=False`, methods `GET,POST,OPTIONS`, and headers `Content-Type,X-API-Key,Stripe-Signature`. Development may allow local Vite origins explicitly, never `*` in production.

- [ ] **Step 4: Add production config fail-closed validation**

A helper `validate_production_configuration()` must raise `RuntimeError` during app startup in production when any of these are absent: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SENTINEL_PRO_PRICE_ID`, `SENTINEL_DASHBOARD_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Do not require `SENTINEL_API_KEY` in production.

- [ ] **Step 5: Run app tests**

```bash
python -m pytest test/test_sentinel_gateway.py test/test_billing_api.py test/test_entitlements.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add sentinel/api.py sentinel_gateway_prototype.py test/test_sentinel_gateway.py test/test_billing_api.py
git commit -m "feat: protect Sentinel API with paid entitlements"
```

### Task 5: Add the dashboard billing client and customer flow

**Files:**
- Create: `dashboard/src/api/sentinelClient.ts`
- Create: `dashboard/src/components/SentinelProBilling.tsx`
- Modify: `dashboard/src/App.tsx`
- Modify: `dashboard/src/App.css`

**Interfaces:**
- `getStoredApiKey() -> string | null`
- `setStoredApiKey(key: string) -> void`
- `clearStoredApiKey() -> void`
- `sentinelFetch(path: string, init?: RequestInit, requireKey?: boolean) -> Promise<Response>`
- Billing component consumes public checkout/claim endpoints and authenticated portal/rotate endpoints.

- [ ] **Step 1: Create the API client abstraction**

Use:

```ts
const configuredBase = import.meta.env.VITE_SENTINEL_API_URL?.trim();
const API_BASE = configuredBase ? configuredBase.replace(/\/$/, '') : '/api/sentinel';
const API_KEY_STORAGE = 'sentinel_api_key';

export function getStoredApiKey(): string | null {
  return sessionStorage.getItem(API_KEY_STORAGE);
}

export async function sentinelFetch(
  path: string,
  init: RequestInit = {},
  requireKey = true,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (requireKey) {
    const key = getStoredApiKey();
    if (!key) throw new Error('Sentinel Pro API key required');
    headers.set('X-API-Key', key);
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}
```

Do not export or embed any fallback production key.

- [ ] **Step 2: Create `SentinelProBilling` component**

Required UI states:
- no key: `$99/month`, `Upgrade to Pro`, existing-key input;
- Checkout return with `session_id`: retrieve `sentinel_claim_secret` from sessionStorage, call `/billing/claim`, clear claim secret, show returned API key once, persist it to sessionStorage only after the user clicks `Use this key`;
- key present: `Manage subscription`, `Rotate API key`, `Forget key for this session`;
- cancelled Checkout: show non-error cancellation message and remove stale claim secret.

Checkout handler:

```ts
const response = await sentinelFetch('/billing/checkout', { method: 'POST' }, false);
const { checkout_url, claim_secret } = await response.json();
sessionStorage.setItem('sentinel_claim_secret', claim_secret);
window.location.assign(checkout_url);
```

Portal handler POSTs `/billing/portal` and redirects to returned `url`.

- [ ] **Step 3: Route all current Sentinel API calls through the client**

In `dashboard/src/App.tsx`, replace direct `fetch('/api/sentinel/...')` calls and every `X-API-Key: 'fallback-dev-key-do-not-use-in-prod'` literal with `sentinelFetch`. Protected dashboard actions without a stored key should surface `Sentinel Pro API key required` rather than silently using the shared dev key.

Mount `<SentinelProBilling />` near the existing API access/control area instead of scattering billing state through the 80KB `App.tsx`.

- [ ] **Step 4: Add minimal dashboard styles**

Use existing dashboard CSS tokens/classes where possible. Add only component-specific layout/status styles; do not redesign unrelated Sentinel surfaces.

- [ ] **Step 5: Verify the forbidden literal is gone from dashboard source**

```bash
! grep -R "fallback-dev-key-do-not-use-in-prod" dashboard/src
```

Expected exit status: 0.

- [ ] **Step 6: Lint and build dashboard**

```bash
npm --prefix dashboard ci
npm --prefix dashboard run lint
npm --prefix dashboard run build
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/api/sentinelClient.ts dashboard/src/components/SentinelProBilling.tsx dashboard/src/App.tsx dashboard/src/App.css
git commit -m "feat: add Sentinel Pro checkout dashboard"
```

### Task 6: Make Python billing a required CI/security surface

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/security.yml`

**Interfaces:**
- Consumes `requirements-gateway.txt` and `test/test_*billing*.py`/gateway tests.
- Produces a PR check that cannot skip Python billing changes simply because Solidity/Node files did not change.

- [ ] **Step 1: Extend CI code-change detection**

Add these roots to the `grep -Eq` code-relevant expression in `.github/workflows/ci.yml`:

```text
sentinel/
sentinel_gateway_prototype.py
supabase/
requirements-gateway.txt
requirements.txt
pytest.ini
```

Keep `test/**` and existing release paths.

- [ ] **Step 2: Add a focused Python gateway test job**

Add a `gateway-tests` job that needs `safety`, runs when `code_changed == 'true'`, checks out code, pins Python 3.11 using the existing immutable `actions/setup-python` SHA, installs `requirements-gateway.txt`, and runs:

```bash
python -m pytest \
  test/test_sentinel_gateway.py \
  test/test_billing_store.py \
  test/test_entitlements.py \
  test/test_billing_api.py \
  -q
```

Do not install root `requirements.txt` in this job because it includes unrelated ML/audio/security toolchains and makes billing CI slow and fragile.

- [ ] **Step 3: Expand Security workflow path triggers**

Add the same Python/backend paths plus `dashboard/**` to PR/push `paths` in `security.yml` so Semgrep/dependency review runs for the new billing attack surface.

- [ ] **Step 4: Parse workflow YAML locally**

```bash
python - <<'PY'
from pathlib import Path
import yaml
for path in [Path('.github/workflows/ci.yml'), Path('.github/workflows/security.yml')]:
    yaml.safe_load(path.read_text())
    print(path, 'OK')
PY
```

Expected: both print `OK`.

- [ ] **Step 5: Run tracked-secret scan**

```bash
node scripts/scan-tracked-secrets.mjs
```

Expected: PASS with no Stripe secret, webhook secret, service-role key, live customer API key, or claim secret tracked.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/security.yml
git commit -m "ci: test Sentinel billing backend"
```

### Task 7: Document production gateway/billing configuration

**Files:**
- Modify: `DEPLOYMENT_GATEWAY.md`

**Interfaces:**
- Produces the deployment contract used when configuring gateway/Vercel/Stripe after code review.

- [ ] **Step 1: Add the exact production environment matrix**

Document backend-only variables:

```text
SENTINEL_ENV=production
STRIPE_SECRET_KEY=<deployment secret>
STRIPE_WEBHOOK_SECRET=<deployment secret>
STRIPE_SENTINEL_PRO_PRICE_ID=<live price id>
SENTINEL_DASHBOARD_URL=https://<dashboard-host>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<deployment secret>
```

Document dashboard public variable only:

```text
VITE_SENTINEL_API_URL=https://<gateway-host>
```

State explicitly that the secret values themselves must not be committed.

- [ ] **Step 2: Document Stripe webhook and portal expectations**

Webhook destination is `<gateway>/billing/webhook`; minimum subscribed events are `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`. Customer Portal must allow payment-method update and cancel-at-period-end behavior.

- [ ] **Step 3: Document operational limitations**

State that the first checkout/claim rate limiter is process-local and must move to Redis/shared storage before multiple gateway replicas are used. State that Base deployment is not part of billing launch.

- [ ] **Step 4: Commit**

```bash
git add DEPLOYMENT_GATEWAY.md
git commit -m "docs: document Sentinel Pro billing deployment"
```

### Task 8: Create the live Stripe product/price only after code is green

**External state:** connected live Stripe account named `Aetheron`.

**Interfaces:**
- Produces live Stripe product ID and recurring price ID; only the price ID goes into the gateway's deployment secret `STRIPE_SENTINEL_PRO_PRICE_ID`.

- [ ] **Step 1: Re-read the connected live Aetheron Stripe account**

Verify the target account is live mode and named `Aetheron`. Do not create the product on the separate Emvori test-mode account.

- [ ] **Step 2: Check for an existing active `Aetheron Sentinel Pro` product/price**

List/search products first to avoid duplicates. Reuse only if product name, metadata, currency, amount, and monthly recurring interval exactly match the approved spec.

- [ ] **Step 3: If absent, create the live product and price**

Product:

```text
name=Aetheron Sentinel Pro
description=Paid access to Aetheron Sentinel Pro security API and dashboard capabilities
metadata[app]=sentinel-l3
metadata[plan]=pro
metadata[environment]=live
```

Price:

```text
currency=usd
unit_amount=9900
recurring[interval]=month
product=<product id>
metadata[app]=sentinel-l3
metadata[plan]=pro
metadata[environment]=live
```

This is a live Stripe mutation; complete the platform's human approval step when requested.

- [ ] **Step 4: Verify the resulting price**

Read it back and confirm `active=true`, `livemode=true`, `unit_amount=9900`, `currency=usd`, and recurring interval `month` before using its ID.

### Task 9: Full verification, code review, and PR

**Files:**
- Review every file changed by Tasks 1-7 plus the spec/plan documents.

**Interfaces:**
- Produces a reviewable PR against `main`, green Actions, and a code-ready billing release. It does not claim production revenue until production infrastructure/webhook/secrets and a controlled live Checkout are verified.

- [ ] **Step 1: Run all focused Python tests**

```bash
python -m pytest \
  test/test_sentinel_gateway.py \
  test/test_billing_store.py \
  test/test_entitlements.py \
  test/test_billing_api.py \
  -q
```

Expected: PASS.

- [ ] **Step 2: Run dashboard validation**

```bash
npm --prefix dashboard ci
npm --prefix dashboard run lint
npm --prefix dashboard run build
```

Expected: PASS.

- [ ] **Step 3: Run repository safety gates**

```bash
node scripts/scan-tracked-secrets.mjs
node scripts/validate-canonical-release-scope.mjs
```

Expected: PASS.

- [ ] **Step 4: Verify no production-secret literals are tracked**

Search for patterns `sk_live_`, `whsec_`, `service_role`, and `sentinel_live_`; the only allowed matches for the latter two are variable names/documentation/test fixtures that are clearly non-secret. Any realistic live-looking credential is a release blocker.

- [ ] **Step 5: Compare branch to main**

Expected changed scope: billing design/plan, FastAPI billing/auth modules, Supabase billing migration, focused Python tests/dependencies, dashboard billing/client code, CI/security path/test updates, and deployment documentation. No Solidity contracts or Base deployment workflows changed.

- [ ] **Step 6: Request code review before opening/merging**

Run the Superpowers requesting-code-review workflow, address blocking findings, and repeat focused verification after fixes.

- [ ] **Step 7: Open the PR**

Title:

```text
[L3] feat: add Sentinel Pro Stripe billing and paid API access
```

PR body must summarize architecture, security properties, tests run, live Stripe resource status, and explicitly state that Base Sepolia/Base Mainnet release controls are unchanged.

- [ ] **Step 8: Verify GitHub Actions on the PR head**

Expected automatic checks: `CI`, `Security`, and `Dashboard` where their paths apply. Confirm Python gateway tests execute inside CI and no workflow fan-out regression returns.

- [ ] **Step 9: Do not merge on red**

Merge only after required checks pass and review is clean. Production deployment/secrets/webhook setup and a controlled live Checkout smoke test are a separate post-merge release action; do not represent the feature as collecting revenue until those live checks succeed.
