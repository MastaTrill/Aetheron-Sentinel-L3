# Aetheron Sentinel Pro Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first production revenue path for Aetheron Sentinel L3: a $99/month Stripe-hosted Sentinel Pro subscription that issues a customer-specific API key and gates protected Sentinel API/dashboard capabilities by Stripe subscription state.

**Architecture:** Stripe and Supabase service credentials stay entirely inside the FastAPI gateway. Stripe Checkout creates subscriptions, verified webhooks synchronize entitlement state to backend-only Supabase tables, and an atomic Postgres RPC consumes a one-time Checkout claim while inserting the hashed API key so a paid customer cannot be stranded between writes. The Vite dashboard uses a small API client and session-only credential storage; Base Sepolia/Base Mainnet deployment pipelines remain independent and unchanged.

**Tech Stack:** Python 3.11, FastAPI 0.136.0, Pydantic 2.13.2, Stripe Python 15.5.1, Supabase Python 2.28.3, structlog 26.1.0, pytest 9.1.1, React 19/Vite 8/TypeScript 6, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-25-sentinel-pro-billing-design.md`

## Global Constraints

- Product: `Aetheron Sentinel Pro`, exactly `$99.00 USD/month`, flat-rate, pay up front, no trial.
- Checkout: Stripe-hosted Checkout; Sentinel never handles raw card data.
- Service entitlement: only Stripe subscription status `active` on `STRIPE_SENTINEL_PRO_PRICE_ID` grants protected Sentinel service access.
- Customer Portal: a recognized, non-revoked API key may open the portal even when service entitlement is inactive.
- API keys: `sentinel_live_` + at least 32 bytes of CSPRNG URL-safe randomness; persist SHA-256 hash only; plaintext returned once.
- Checkout claim: random, hashed at rest, 60-minute expiry, single-use.
- Production secrets stay backend-only: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, key hashes, and claim hashes never enter `VITE_` variables or browser code.
- Production CORS allows exactly `SENTINEL_DASHBOARD_URL`; never `*`.
- `POST /billing/checkout` and `POST /billing/claim`: 10 attempts per 10 minutes per client IP for v1.
- Production never authorizes `fallback-dev-key-do-not-use-in-prod`.
- Base Sepolia/Base Mainnet workflows and Solidity contracts are untouched.
- Existing `CI`, `Security`, and `Dashboard` workflows finish green; tracked-secret scanning passes.

## File Map

- Create `requirements-gateway.txt`: focused gateway/test dependency set.
- Create `supabase/migrations/20260825230300_sentinel_pro_billing.sql`: four billing tables, indexes, RLS, atomic claim+key RPC.
- Create `sentinel/billing_store.py`: backend-only Supabase adapter.
- Create `sentinel/entitlements.py`: key generation/hashing and authorization dependencies.
- Create `sentinel/billing.py`: Checkout, claim, webhook, portal, rotation, and rate limiting.
- Modify `sentinel/api.py`: one environment-aware access dependency on all Sentinel application routes.
- Modify `sentinel_gateway_prototype.py`: include billing router, CORS, production config validation.
- Create `test/test_billing_store.py`, `test/test_entitlements.py`, `test/test_billing_api.py`; extend `test/test_sentinel_gateway.py` with app-level auth/CORS cases.
- Create `dashboard/src/api/sentinelClient.ts` and `dashboard/src/components/SentinelProBilling.tsx`; modify `dashboard/src/App.tsx` and `dashboard/src/App.css`.
- Modify `.github/workflows/ci.yml` and `.github/workflows/security.yml` so Python billing is a required code/security surface.
- Modify `DEPLOYMENT_GATEWAY.md` with exact production configuration and rollout notes.

---

### Task 1: Billing database schema and store

**Files:**
- Create: `supabase/migrations/20260825230300_sentinel_pro_billing.sql`
- Create: `sentinel/billing_store.py`
- Create: `test/test_billing_store.py`

**Interfaces:**
- `SubscriptionRecord(stripe_customer_id, stripe_subscription_id, stripe_price_id, customer_email, status, current_period_end, cancel_at_period_end)`
- `get_billing_store() -> BillingStore`
- `BillingStore.create_claim(claim_id, claim_secret_hash, expires_at) -> None`
- `BillingStore.bind_claim_session(claim_id, checkout_session_id) -> None`
- `BillingStore.upsert_subscription(record) -> dict`
- `BillingStore.get_subscription_by_id(subscription_id) -> dict | None`
- `BillingStore.get_subscription_by_stripe_id(stripe_subscription_id) -> dict | None`
- `BillingStore.get_api_key_by_hash(key_hash) -> dict | None`
- `BillingStore.claim_and_create_api_key(checkout_session_id, claim_secret_hash, subscription_id, key_prefix, key_hash) -> dict | None`
- `BillingStore.revoke_api_key(key_id) -> None`
- `BillingStore.touch_api_key(key_id) -> None`
- `BillingStore.event_processed(event_id) -> bool`
- `BillingStore.record_event(event_id, event_type) -> None`

- [ ] **Step 1: Write failing store tests**

Create a tiny fake Supabase query builder and test deterministic table/RPC usage:

```python
from datetime import datetime, timezone
from sentinel.billing_store import BillingStore, SubscriptionRecord


def test_upsert_subscription_conflicts_on_stripe_subscription_id(fake_supabase):
    store = BillingStore(client=fake_supabase)
    store.upsert_subscription(SubscriptionRecord(
        stripe_customer_id="cus_test",
        stripe_subscription_id="sub_test",
        stripe_price_id="price_pro",
        customer_email="buyer@example.com",
        status="active",
        current_period_end=datetime(2026, 9, 25, tzinfo=timezone.utc),
        cancel_at_period_end=False,
    ))
    assert fake_supabase.last_table == "sentinel_subscriptions"
    assert fake_supabase.last_on_conflict == "stripe_subscription_id"


def test_atomic_claim_and_key_returns_none_when_claim_is_invalid(fake_supabase):
    fake_supabase.rpc_result = []
    store = BillingStore(client=fake_supabase)
    assert store.claim_and_create_api_key(
        "cs_test", "claimhash", "00000000-0000-0000-0000-000000000001",
        "sentinel_live_prefix", "keyhash"
    ) is None
```

- [ ] **Step 2: Run the tests and confirm RED**

```bash
python -m pytest test/test_billing_store.py -q
```

Expected: import failure for `sentinel.billing_store`.

- [ ] **Step 3: Create four backend-only billing tables**

Migration creates `pgcrypto` if needed and tables exactly matching the spec: `sentinel_subscriptions`, `sentinel_api_keys`, `sentinel_checkout_claims`, `sentinel_billing_events`. Use `gen_random_uuid()` IDs, unique Stripe customer/subscription IDs, unique `key_hash`, FK `sentinel_api_keys.subscription_id -> sentinel_subscriptions.id ON DELETE CASCADE`, timestamps, and indexes on key hash/subscription/customer/checkout-session lookup fields.

Enable RLS on all four tables. Create no `anon` or `authenticated` allow policy.

- [ ] **Step 4: Add one atomic claim+API-key RPC**

Use one database function, not separate claim/key writes:

```sql
create or replace function claim_sentinel_checkout_and_create_key(
  p_checkout_session_id text,
  p_claim_secret_hash text,
  p_subscription_id uuid,
  p_key_prefix text,
  p_key_hash text
)
returns table(api_key_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  update sentinel_checkout_claims
     set claimed_at = now()
   where stripe_checkout_session_id = p_checkout_session_id
     and claim_secret_hash = p_claim_secret_hash
     and claimed_at is null
     and expires_at > now();

  if not found then
    return;
  end if;

  return query
    insert into sentinel_api_keys(subscription_id, key_prefix, key_hash)
    values (p_subscription_id, p_key_prefix, p_key_hash)
    returning id;
end;
$$;

revoke all on function claim_sentinel_checkout_and_create_key(text,text,uuid,text,text)
  from public, anon, authenticated;
grant execute on function claim_sentinel_checkout_and_create_key(text,text,uuid,text,text)
  to service_role;
```

Because the update and insert occur inside one function invocation, an insert error rolls back claim consumption.

- [ ] **Step 5: Implement `BillingStore`**

Use `@dataclass(frozen=True)` for `SubscriptionRecord`. `BillingStore(client=None)` accepts an injected fake; otherwise it constructs `create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`. Missing server credentials raise `BillingStoreUnavailable`; never substitute the anon key. Read Supabase response `.data`.

- [ ] **Step 6: Run GREEN and commit**

```bash
python -m pytest test/test_billing_store.py -q
git add supabase/migrations/20260825230300_sentinel_pro_billing.sql sentinel/billing_store.py test/test_billing_store.py
git commit -m "feat: add Sentinel billing persistence"
```

### Task 2: API keys and entitlement policy

**Files:**
- Create: `sentinel/entitlements.py`
- Create: `test/test_entitlements.py`

**Interfaces:**
- `hash_secret(value: str) -> str`
- `generate_api_key() -> tuple[str, str, str]` = plaintext, prefix, digest
- `ResolvedCustomer(api_key: dict, subscription: dict)`
- Pure `resolve_customer_api_key_value(api_key: str | None, store: BillingStore) -> ResolvedCustomer`
- Pure `assert_active_subscription(customer: ResolvedCustomer) -> ResolvedCustomer`
- FastAPI dependencies `resolve_customer_api_key(...)`, `require_active_subscription(...)`, `require_sentinel_access(...)`

- [ ] **Step 1: Write failing security-policy tests**

Cover CSPRNG format/hash, missing/unknown/revoked key -> 401, store outage -> 503, recognized `past_due` key resolves for portal, `past_due` service entitlement -> 403, wrong price -> 403, and production fallback key -> 401.

```python
def test_generate_key_is_hashed_only():
    plaintext, prefix, digest = generate_api_key()
    assert plaintext.startswith("sentinel_live_")
    assert prefix == plaintext[:24]
    assert digest == hash_secret(plaintext)
    assert plaintext not in digest
```

- [ ] **Step 2: Run RED**

```bash
python -m pytest test/test_entitlements.py -q
```

- [ ] **Step 3: Implement crypto + pure authorization functions**

```python
def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    plaintext = f"sentinel_live_{secrets.token_urlsafe(32)}"
    return plaintext, plaintext[:24], hash_secret(plaintext)
```

`resolve_customer_api_key_value` hashes the presented key, finds the non-revoked row and subscription, and returns `ResolvedCustomer`. `assert_active_subscription` requires `status == "active"` and exact `STRIPE_SENTINEL_PRO_PRICE_ID`.

- [ ] **Step 4: Implement FastAPI wrappers without dependency-call ambiguity**

`resolve_customer_api_key` injects `X-API-Key` and `get_billing_store()`, then calls the pure resolver. `require_active_subscription` receives `ResolvedCustomer = Depends(resolve_customer_api_key)` and calls the pure assertion.

`require_sentinel_access` injects `X-API-Key` + store directly. In production it calls the two pure functions; outside production it compares against `SENTINEL_API_KEY` with existing fallback behavior. There is no direct manual call from one FastAPI dependency function into another dependency function.

- [ ] **Step 5: Run GREEN and commit**

```bash
python -m pytest test/test_entitlements.py -q
git add sentinel/entitlements.py test/test_entitlements.py
git commit -m "feat: enforce Sentinel Pro entitlements"
```

### Task 3: Stripe billing API

**Files:**
- Create: `requirements-gateway.txt`
- Create: `sentinel/billing.py`
- Create: `test/test_billing_api.py`

**Interfaces:**
- Router endpoints: `/billing/checkout`, `/billing/claim`, `/billing/webhook`, `/billing/portal`, `/billing/api-key/rotate`.
- Consumes Task 1 store + Task 2 authorization.

- [ ] **Step 1: Pin focused gateway dependencies**

```text
fastapi==0.136.0
httpx==0.28.1
pydantic==2.13.2
pytest==9.1.1
PyYAML==6.0.3
requests==2.33.1
stripe==15.5.1
structlog==26.1.0
supabase==2.28.3
uvicorn==0.44.0
```

- [ ] **Step 2: Write failing FastAPI tests with fake Stripe/store**

Required tests: Checkout returns Stripe URL + one claim secret; no secret key leaks; claim works before webhook by retrieving/upserting subscription synchronously; replay returns 409; incomplete checkout returns 400; wrong product/price returns 403; invalid webhook signature returns 400; duplicate webhook is 200 without second mutation; inactive recognized key can open portal; inactive key cannot rotate; 11th checkout/claim attempt in one window returns 429.

- [ ] **Step 3: Run RED**

```bash
python -m pytest test/test_billing_api.py -q
```

- [ ] **Step 4: Implement Checkout creation**

Server chooses the price ID; client never supplies it:

```python
session = stripe.checkout.Session.create(
    mode="subscription",
    line_items=[{"price": price_id, "quantity": 1}],
    success_url=f"{dashboard_url}/?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
    cancel_url=f"{dashboard_url}/?checkout=cancelled",
    client_reference_id=claim_id,
    metadata={"claim_id": claim_id, "app": "sentinel-l3", "plan": "pro"},
    subscription_data={"metadata": {"app": "sentinel-l3", "plan": "pro"}},
)
```

Create claim before Stripe request, bind session ID afterward, return only `checkout_url` + plaintext claim secret. Generic 503 on Stripe failure; never log claim secret.

- [ ] **Step 5: Implement claim flow with atomic key issuance**

Order is fixed:
1. Retrieve Checkout Session.
2. Require `status == "complete"`, subscription ID, and expected claim ID metadata/reference.
3. Retrieve Stripe subscription.
4. Extract actual subscription price; require exact `STRIPE_SENTINEL_PRO_PRICE_ID`.
5. Upsert subscription synchronously; require resulting status active.
6. Generate plaintext/prefix/hash in memory.
7. Call `claim_and_create_api_key(...)`; this single RPC both consumes claim and persists hash.
8. If RPC returns no row, return 409/invalid-expired claim and discard plaintext.
9. Return plaintext key once only after RPC success.

- [ ] **Step 6: Implement signed webhook synchronization**

Use raw body + `stripe-signature` + `STRIPE_WEBHOOK_SECRET` via `stripe.Webhook.construct_event`. For `customer.subscription.created|updated|deleted`, deterministic subscription upsert is authoritative. For `checkout.session.completed`, retrieve/upsert referenced subscription. For `invoice.paid|invoice.payment_failed`, retrieve referenced subscription and refresh it. Check `event_processed` before work; call `record_event` only after successful state persistence so transient failures remain retryable.

- [ ] **Step 7: Implement portal, rotation, and v1 rate limiter**

Portal uses `Depends(resolve_customer_api_key)`, creates a Stripe Billing Portal session with that subscription's customer ID, and works for inactive subscriptions. Rotation uses `Depends(require_active_subscription)`: generate/persist replacement first, revoke old key second, return plaintext replacement once.

IP limiter: lock + `dict[str, deque[float]]`, key `route:client_ip`, 600-second window, max 10. Return 429 on request 11. Document that this must become shared Redis/storage before multi-replica gateway scaling.

- [ ] **Step 8: Run GREEN and commit**

```bash
python -m pytest test/test_billing_store.py test/test_entitlements.py test/test_billing_api.py -q
git add requirements-gateway.txt sentinel/billing.py test/test_billing_api.py
git commit -m "feat: add Stripe Sentinel Pro billing API"
```

### Task 4: Secure and compose the production gateway

**Files:**
- Modify: `sentinel/api.py`
- Modify: `sentinel_gateway_prototype.py`
- Modify: `test/test_sentinel_gateway.py`
- Extend: `test/test_billing_api.py`

**Interfaces:**
- Public: `GET /health`, `POST /billing/checkout`, `POST /billing/claim`, `POST /billing/webhook`.
- Recognized-key: `POST /billing/portal`.
- Active paid entitlement in production: rotation and all Sentinel app routes `/sync`, `/analyze`, `/reset`, `/chat`, `/honeypot`, `/logs`.

- [ ] **Step 1: Write failing production-auth/CORS tests**

Assert fallback key gets 401 on `/analyze`, `/health` remains public, allowed dashboard origin receives ACAO header, unconfigured origin does not, and missing production billing config fails startup validation.

- [ ] **Step 2: Replace mixed route auth in `sentinel/api.py`**

Remove `get_api_key_dep`. Put `dependencies=[Depends(require_sentinel_access)]` on all six Sentinel application routes, including routes currently public (`reset`, `chat`, `honeypot`).

- [ ] **Step 3: Include billing router and exact-origin CORS**

```python
from fastapi.middleware.cors import CORSMiddleware
from sentinel.billing import router as billing_router

app.include_router(sentinel_router)
app.include_router(billing_router)
```

Production CORS uses only parsed `SENTINEL_DASHBOARD_URL`, `allow_credentials=False`, methods `GET,POST,OPTIONS`, headers `Content-Type,X-API-Key,Stripe-Signature`. Development may explicitly allow local Vite origins; production never uses wildcard.

- [ ] **Step 4: Add fail-closed production configuration validation**

`validate_production_configuration()` requires exactly: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SENTINEL_PRO_PRICE_ID`, `SENTINEL_DASHBOARD_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Production does not require or use `SENTINEL_API_KEY`.

- [ ] **Step 5: Run GREEN and commit**

```bash
python -m pytest test/test_sentinel_gateway.py test/test_billing_store.py test/test_entitlements.py test/test_billing_api.py -q
git add sentinel/api.py sentinel_gateway_prototype.py test/test_sentinel_gateway.py test/test_billing_api.py
git commit -m "feat: protect Sentinel API with paid entitlements"
```

### Task 5: Dashboard Checkout and access UX

**Files:**
- Create: `dashboard/src/api/sentinelClient.ts`
- Create: `dashboard/src/components/SentinelProBilling.tsx`
- Modify: `dashboard/src/App.tsx`
- Modify: `dashboard/src/App.css`

**Interfaces:**
- `getStoredApiKey()`, `setStoredApiKey(key)`, `clearStoredApiKey()` use only `sessionStorage`.
- `sentinelFetch(path, init={}, requireKey=true)` uses `VITE_SENTINEL_API_URL` or `/api/sentinel` dev proxy.

- [ ] **Step 1: Create the API client**

```ts
const configured = import.meta.env.VITE_SENTINEL_API_URL?.trim();
const API_BASE = configured ? configured.replace(/\/$/, '') : '/api/sentinel';
const STORAGE_KEY = 'sentinel_api_key';

export function getStoredApiKey(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export async function sentinelFetch(path: string, init: RequestInit = {}, requireKey = true) {
  const headers = new Headers(init.headers);
  if (requireKey) {
    const key = getStoredApiKey();
    if (!key) throw new Error('Sentinel Pro API key required');
    headers.set('X-API-Key', key);
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}
```

- [ ] **Step 2: Build `SentinelProBilling` component**

No key state: show `$99/month`, `Upgrade to Pro`, and existing-key input. Checkout stores only `sentinel_claim_secret` in sessionStorage then redirects. Success return reads `session_id` + claim secret, calls `/billing/claim`, clears claim secret, displays new API key once, and stores it only after `Use this key`. Cancel return clears stale claim secret. Key-present state exposes portal, rotate, and forget-for-session actions.

- [ ] **Step 3: Replace every direct Sentinel fetch/fallback literal in `App.tsx`**

Route existing `/api/sentinel/*` calls through `sentinelFetch`; remove all hard-coded `fallback-dev-key-do-not-use-in-prod` headers. Mount the billing component near existing API access controls; do not expand the already-large `App.tsx` with billing internals.

- [ ] **Step 4: Add only component-specific styles and verify**

```bash
! grep -R "fallback-dev-key-do-not-use-in-prod" dashboard/src
npm --prefix dashboard ci
npm --prefix dashboard run lint
npm --prefix dashboard run build
```

Expected: grep exits 0; lint/build pass.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/api/sentinelClient.ts dashboard/src/components/SentinelProBilling.tsx dashboard/src/App.tsx dashboard/src/App.css
git commit -m "feat: add Sentinel Pro checkout dashboard"
```

### Task 6: Require billing tests in CI/security

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/security.yml`

- [ ] **Step 1: Expand CI code detection**

Add `sentinel/`, `sentinel_gateway_prototype.py`, `supabase/`, `requirements-gateway.txt`, `requirements.txt`, and `pytest.ini` to the existing code-relevant regex.

- [ ] **Step 2: Add `gateway-tests` CI job**

Use pinned `actions/setup-python` SHA already used by repository security workflow, Python 3.11, `pip install -r requirements-gateway.txt`, then:

```bash
python -m pytest \
  test/test_sentinel_gateway.py \
  test/test_billing_store.py \
  test/test_entitlements.py \
  test/test_billing_api.py -q
```

Do not install root `requirements.txt` in this job.

- [ ] **Step 3: Expand Security PR/push paths**

Add `sentinel/**`, `sentinel_gateway_prototype.py`, `supabase/**`, `requirements-gateway.txt`, `requirements.txt`, and `dashboard/**`. This ensures Semgrep/dependency review sees billing changes.

- [ ] **Step 4: Validate YAML and secret gates**

```bash
python - <<'PY'
from pathlib import Path
import yaml
for p in [Path('.github/workflows/ci.yml'), Path('.github/workflows/security.yml')]:
    yaml.safe_load(p.read_text())
    print(p, 'OK')
PY
node scripts/scan-tracked-secrets.mjs
```

Expected: both YAML files parse and secret scan passes.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/security.yml
git commit -m "ci: test Sentinel billing backend"
```

### Task 7: Production deployment documentation

**Files:**
- Modify: `DEPLOYMENT_GATEWAY.md`

- [ ] **Step 1: Document exact backend/public environment contract**

Backend-only: `SENTINEL_ENV=production`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SENTINEL_PRO_PRICE_ID`, `SENTINEL_DASHBOARD_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Dashboard-only public variable: `VITE_SENTINEL_API_URL`. Show placeholders, never values.

- [ ] **Step 2: Document Stripe configuration**

Webhook endpoint `<gateway>/billing/webhook` subscribes to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Portal permits payment method updates and cancel-at-period-end.

- [ ] **Step 3: Document limitations and separation**

Process-local checkout/claim limiter must move to shared storage before horizontal gateway scaling. Billing launch does not alter or complete Base Sepolia/Base Mainnet release status.

- [ ] **Step 4: Commit**

```bash
git add DEPLOYMENT_GATEWAY.md
git commit -m "docs: document Sentinel Pro billing deployment"
```

### Task 8: Create live Stripe product/price after code is green

**External state:** connected live Stripe account `Aetheron`.

- [ ] **Step 1: Verify target account and deduplicate**

Confirm live `Aetheron`, not Emvori test mode. List active products/prices first. Reuse only an exact existing `Aetheron Sentinel Pro` `$99/month` product/price with matching metadata.

- [ ] **Step 2: If absent, create the approved live resources**

Product: `Aetheron Sentinel Pro`, service description, metadata `app=sentinel-l3`, `plan=pro`, `environment=live`. Price: `usd`, `unit_amount=9900`, recurring `month`, same metadata. Complete Stripe's human confirmation step for the live mutation.

- [ ] **Step 3: Read the price back**

Require `active=true`, `livemode=true`, `unit_amount=9900`, `currency=usd`, interval `month`. Put only the resulting price ID into deployment secret/config; never source code.

### Task 9: Full verification, review, and PR

- [ ] **Step 1: Run focused backend tests**

```bash
python -m pytest test/test_sentinel_gateway.py test/test_billing_store.py test/test_entitlements.py test/test_billing_api.py -q
```

- [ ] **Step 2: Run dashboard validation**

```bash
npm --prefix dashboard ci
npm --prefix dashboard run lint
npm --prefix dashboard run build
```

- [ ] **Step 3: Run repository safety checks**

```bash
node scripts/scan-tracked-secrets.mjs
node scripts/validate-canonical-release-scope.mjs
```

- [ ] **Step 4: Inspect secret-like strings**

Search `sk_live_`, `whsec_`, `sentinel_live_`, and service-role references. Only variable names, docs placeholders, and unmistakably fake test fixtures are allowed; realistic credentials block release.

- [ ] **Step 5: Compare branch to `main`**

Expected scope is billing docs, Python billing/auth/store/tests, Supabase migration, dashboard billing/client, CI/security coverage, deployment docs. No Solidity contract or Base deployment workflow change.

- [ ] **Step 6: Run Superpowers code review workflow and fix blockers**

After any fix, rerun Steps 1-3.

- [ ] **Step 7: Open PR**

Title: `[L3] feat: add Sentinel Pro Stripe billing and paid API access`.

PR body states architecture/security properties, exact tests, live Stripe resource status, and that Base release controls are unchanged.

- [ ] **Step 8: Verify PR Actions head**

Expected applicable automatic workflows: `CI`, `Security`, `Dashboard`. Confirm `gateway-tests` actually runs and no workflow fan-out returns.

- [ ] **Step 9: Merge only on green**

Production gateway secrets, webhook configuration, dashboard API URL, Supabase migration application, and a controlled live Checkout smoke test are post-merge release actions. Do not report Sentinel as collecting live subscription revenue until those live checks succeed.
