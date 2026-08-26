# Aetheron Sentinel Pro Billing Design

Date: 2026-08-25
Status: Approved design
Branch: `feat/sentinel-pro-billing-20260825`

## Goal

Create the first production monetization path for Aetheron Sentinel L3 without coupling revenue launch to the still-gated Base Sepolia/Base Mainnet contract release.

The first paid offer is **Aetheron Sentinel Pro** at **$99 USD per month**, billed up front with no free trial. Customers pay through Stripe-hosted Checkout and receive access to protected Sentinel API/dashboard capabilities through a customer-specific API key.

This design deliberately does not add a full user-account/authentication subsystem. The current dashboard has Supabase data access but no trustworthy end-user login boundary. For the first paid release, the API key is the customer credential and Stripe subscription state is the entitlement source of truth.

## Success criteria

The release is successful when all of the following are true:

- A customer can start a $99/month Sentinel Pro subscription from the dashboard using Stripe-hosted Checkout.
- A successful Checkout can be claimed exactly once to issue a customer-specific Sentinel API key.
- The API key is shown to the customer only when created; only a cryptographic hash and non-secret prefix are stored server-side.
- Protected Sentinel endpoints reject missing, invalid, revoked, or unsubscribed API keys.
- Stripe webhooks update subscription state idempotently.
- Customers with an active key can open Stripe Customer Portal to update payment details or cancel.
- A canceled, unpaid, incomplete, or otherwise inactive subscription no longer grants protected API access.
- Stripe secrets and the Supabase service-role key never reach browser code.
- Production does not accept the existing shared fallback development key.
- Billing/API tests and the existing CI/security/dashboard checks pass.
- No Solidity contract, Base Sepolia deployment, or Base Mainnet deployment is required to collect the first subscription revenue.

## Product and pricing

Create one live Stripe product and one recurring price:

- Product name: `Aetheron Sentinel Pro`
- Product type: service / digital SaaS access
- Price: `$99.00 USD`
- Billing interval: monthly
- Billing model: flat rate
- Collection: pay up front
- Trial: none
- Checkout: Stripe-hosted Checkout
- Metadata on product/price where supported:
  - `app=sentinel-l3`
  - `plan=pro`
  - `environment=live`

The application never hard-codes the resulting Stripe product or price IDs. The live recurring price ID is supplied as `STRIPE_SENTINEL_PRO_PRICE_ID`.

Stripe Customer Portal is the post-sale management surface. The implementation uses cancel-at-period-end behavior and allows payment-method updates through Stripe's portal configuration. Smart Retries and Stripe's standard failed-payment recovery are preferred over custom dunning logic for this first release.

Tax collection is not invented in application code. Stripe Tax threshold monitoring/account tax configuration is handled at the Stripe account level; automatic tax collection is enabled only where the Stripe account has the appropriate configuration and registrations.

## Architecture

### 1. Dashboard

The existing Vite/React dashboard remains the customer-facing surface.

Add a small billing/access module rather than embedding Stripe secrets or billing logic in React. The dashboard will:

- show a Sentinel Pro pricing card and `Upgrade to Pro` action;
- request a Checkout Session from the Sentinel gateway;
- redirect the browser to the Stripe-hosted Checkout URL;
- on successful return, exchange the Checkout session ID plus a one-time claim secret for a new API key;
- show the API key once with explicit copy/save guidance;
- allow a customer to paste an existing API key for protected dashboard features;
- keep an entered/claimed API key only in `sessionStorage`, not in source code, build-time constants, or persistent local storage;
- expose a `Manage subscription` action that calls the authenticated billing portal endpoint and then redirects to Stripe Customer Portal.

Create a dashboard API client abstraction that uses `VITE_SENTINEL_API_URL` in production and the existing `/api/sentinel` development proxy locally. This removes the current assumption that production and the FastAPI gateway share an origin.

The current literal `fallback-dev-key-do-not-use-in-prod` must be removed from dashboard requests.

### 2. Sentinel gateway

The FastAPI gateway remains the server-side trust boundary.

Billing and entitlement code is isolated into focused modules rather than being added inline to the already-large `sentinel_gateway_prototype.py` file:

- `sentinel/billing.py` — Stripe Checkout, claim, portal, and webhook routes.
- `sentinel/entitlements.py` — API-key generation, hashing, lookup, and active-subscription checks.
- `sentinel/billing_store.py` — server-side Supabase persistence for billing records.

`sentinel_gateway_prototype.py` includes the billing router and continues to include the existing Sentinel router.

All production billing operations use server-side environment variables. No Stripe secret is exposed through Vite variables.

### 3. Supabase persistence

Billing records use backend-only tables. The browser anon key must not have direct read/write access to these tables.

Create a migration under `supabase/migrations/` with the following logical tables.

#### `sentinel_subscriptions`

Purpose: map Stripe customer/subscription state to Sentinel entitlement state.

Fields:

- `id` UUID primary key
- `stripe_customer_id` text, unique, not null
- `stripe_subscription_id` text, unique, not null
- `stripe_price_id` text, not null
- `customer_email` text, nullable
- `status` text, not null
- `current_period_end` timestamptz, nullable
- `cancel_at_period_end` boolean, not null, default false
- `created_at` timestamptz, not null
- `updated_at` timestamptz, not null

The subscription grants access only when `status = 'active'` and the stored price ID matches `STRIPE_SENTINEL_PRO_PRICE_ID`.

#### `sentinel_api_keys`

Purpose: store API-key verification material without storing plaintext credentials.

Fields:

- `id` UUID primary key
- `subscription_id` UUID foreign key to `sentinel_subscriptions.id`
- `key_prefix` text, not null
- `key_hash` text, unique, not null
- `created_at` timestamptz, not null
- `last_used_at` timestamptz, nullable
- `revoked_at` timestamptz, nullable

API keys use a recognizable prefix such as `sentinel_live_` followed by at least 32 bytes of cryptographically secure URL-safe randomness. The full plaintext key is returned only at creation/rotation. Verification hashes the presented key with SHA-256 and performs an indexed equality lookup on `key_hash`.

#### `sentinel_checkout_claims`

Purpose: allow safe one-time API-key issuance after hosted Checkout without adding a full login system.

Fields:

- `claim_id` UUID primary key
- `claim_secret_hash` text, unique, not null
- `stripe_checkout_session_id` text, unique, nullable
- `expires_at` timestamptz, not null
- `claimed_at` timestamptz, nullable
- `created_at` timestamptz, not null

When Checkout is created, the gateway generates a random one-time claim secret, stores only its hash, records the public `claim_id` in Stripe Checkout metadata/client reference, and returns the plaintext claim secret to the dashboard. The dashboard keeps that secret in `sessionStorage` only for the Checkout round trip.

On return, the claim endpoint requires both the Stripe Checkout Session ID and the claim secret. It retrieves the Checkout Session from Stripe, verifies the session is complete for Sentinel Pro, verifies the claim ID/secret pair, verifies the claim is unexpired and unused, issues the API key, and atomically marks the claim used.

A refresh or replay after successful claim must not reveal or recreate the previous plaintext key.

#### `sentinel_billing_events`

Purpose: make Stripe webhook handling idempotent.

Fields:

- `stripe_event_id` text primary key
- `event_type` text, not null
- `processed_at` timestamptz, not null

Webhook processing first checks/records the event ID in the same logical transaction as the state change where practical. Repeated delivery of the same Stripe event returns success without reapplying side effects.

Row-level security for these billing tables denies browser/anon access. Server billing code uses `SUPABASE_SERVICE_ROLE_KEY` only on the backend.

## API surface

### Public endpoints

`POST /billing/checkout`

Creates a Sentinel Pro Checkout Session and one-time claim. Returns the Stripe Checkout URL and claim secret. The claim expires after 60 minutes if Checkout is not successfully completed.

`POST /billing/claim`

Input: Checkout Session ID + claim secret. Returns a newly created Sentinel API key exactly once after server-side Stripe verification.

`POST /billing/webhook`

Receives Stripe webhook requests. It must use the raw request body and `STRIPE_WEBHOOK_SECRET` to verify the Stripe signature before parsing/processing events.

`GET /health`

Remains public.

### API-key-authenticated billing endpoints

`POST /billing/portal`

Resolves the API key to the active subscription/customer, creates a Stripe Customer Portal Session, and returns its URL.

`POST /billing/api-key/rotate`

Requires a currently valid active API key. Revokes the presented key, creates a replacement, and returns the replacement plaintext once.

### Protected Sentinel endpoints

All non-health, non-checkout, non-claim, and non-webhook Sentinel application routes must use the entitlement dependency in production. This includes the current analyze/sync/log/chat/reset/honeypot capabilities where they remain exposed by the production application.

Development-only demo endpoints may remain usable locally, but production must fail closed if billing/API-key configuration is missing.

## Stripe lifecycle handling

The webhook handler processes at least:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

`customer.subscription.*` events are authoritative for stored subscription status. `invoice.paid` and `invoice.payment_failed` are retained for reconciliation/logging and to accelerate state refresh where useful.

Entitlement is intentionally strict for version 1: only `active` Sentinel Pro subscriptions are authorized. A `past_due`, `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, or `paused` subscription is denied until Stripe reports it active again. This avoids inventing a grace-period policy in the first paid release.

Cancellation through Customer Portal should be configured to cancel at period end. The Stripe subscription remains `active` until the end of the paid period, so access continues naturally until Stripe transitions it out of active state.

## Environment and secrets

Required backend environment variables:

- `SENTINEL_ENV=production`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SENTINEL_PRO_PRICE_ID`
- `SENTINEL_DASHBOARD_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Required dashboard environment variable:

- `VITE_SENTINEL_API_URL`

`VITE_` variables are public by definition. Stripe secret keys, webhook secrets, service-role keys, and API-key hashes must never use a `VITE_` prefix.

The legacy `SENTINEL_API_KEY` shared-secret mode remains available only for explicit local/development compatibility. In production, the application must reject startup or protected requests if it would otherwise fall back to `fallback-dev-key-do-not-use-in-prod`.

## Security properties

- Stripe webhook signatures are verified before state mutation.
- API keys are generated with `secrets.token_urlsafe` or equivalent CSPRNG, never `random`.
- Only hashes of customer API keys are persisted.
- API-key comparisons are database equality on SHA-256 hashes; no plaintext list is loaded into browser code.
- The key prefix is non-secret and exists only for customer/support identification.
- Checkout claim secrets are random, hashed at rest, single-use, and expire after 60 minutes.
- Billing-table RLS denies anon/browser access.
- Service-role and Stripe secrets stay server-side.
- Logs never include API keys, claim secrets, Stripe secrets, webhook signatures, or service-role keys.
- Webhook handlers are idempotent by Stripe event ID.
- Customer Portal creation requires an already-valid API key, preventing arbitrary callers from opening another customer's portal.
- Production protected routes fail closed when entitlement storage or Stripe verification is unavailable; they do not silently fall back to the development key.

## Error handling

Checkout creation failure returns a generic billing-unavailable response and logs a redacted server-side reason.

Claim failures distinguish safe customer-facing cases: invalid/expired claim, incomplete Checkout, already claimed, or unsupported product. They never return Stripe secret data or database internals.

Webhook signature failures return HTTP 400 and do not mutate state. Valid duplicate webhook deliveries return HTTP 200 after detecting an already-processed event.

Entitlement lookup failures return HTTP 401 for invalid/revoked keys and HTTP 403 for recognized keys whose subscription is not active. Backend dependency outages return HTTP 503 rather than treating the request as authorized.

Customer Portal creation returns HTTP 403 if the subscription is inactive and HTTP 503 for Stripe availability failures.

## Testing strategy

### Unit tests

Add pytest coverage for:

- API-key format, cryptographic generation, hashing, and verification;
- revoked-key rejection;
- active versus inactive Stripe subscription status decisions;
- production rejection of the legacy fallback key;
- claim-secret hashing/expiry/single-use behavior;
- duplicate webhook event idempotency;
- webhook signature rejection;
- Stripe event-to-subscription-state mapping.

Stripe network calls are mocked in unit tests. Supabase persistence is tested through a store abstraction so entitlement logic can run against deterministic fakes.

### FastAPI integration tests

Use FastAPI TestClient to cover:

- checkout creation response shape without leaking secrets beyond the intended one-time claim secret;
- successful claim producing one API key;
- claim replay refusal;
- protected endpoint rejection without a key;
- protected endpoint success with an active key;
- protected endpoint denial after subscription cancellation/update;
- authenticated Customer Portal creation;
- API-key rotation revoking the old key.

### Dashboard tests/build validation

The existing dashboard lint/build checks must pass. The React changes are structured so billing state and API client logic can be unit-tested separately if the repository adds a frontend test runner; this first implementation must at minimum pass TypeScript build and ESLint and must remove all hard-coded fallback API-key literals from production dashboard code.

### CI/security validation

The existing consolidated `CI`, `Security`, and `Dashboard` workflows must remain green. The tracked-secret scanner must pass after all billing configuration changes.

## Rollout sequence

1. Add database migration and backend billing/entitlement modules with tests.
2. Add Stripe SDK dependency and environment validation.
3. Add dashboard API client, pricing/upgrade flow, claim flow, API-key input, and portal action.
4. Run local/unit/integration tests plus existing lint/build/security checks.
5. Create the live `Aetheron Sentinel Pro` Stripe product and $99/month price in the connected live Aetheron Stripe account; capture only the resulting IDs in deployment secrets/config, not source.
6. Configure/verify Stripe Customer Portal and webhook endpoint for the production gateway.
7. Deploy the gateway with production secrets and deploy the dashboard with `VITE_SENTINEL_API_URL`.
8. Perform a controlled live Checkout smoke test and verify the resulting Stripe subscription, webhook processing, one-time API-key claim, protected API access, and Customer Portal flow.
9. Keep Base Sepolia/Base Mainnet release pipelines unchanged and separately gated.

## Explicit non-goals for version 1

- No Base Mainnet broadcast as part of billing launch.
- No token sale, staking/yield monetization, or SentinelToken economics.
- No usage-based or metered billing.
- No enterprise quotes/contracts or seat-based pricing.
- No multi-plan pricing table beyond Sentinel Pro.
- No custom card form or direct handling of card data.
- No full email/password/social-login account system.
- No plaintext API-key recovery. Lost keys require support/manual recovery until a later authenticated account-management release.
- No custom tax engine.

## Future extension path

After real customers and usage exist, the clean next extensions are a proper account/auth layer, self-service lost-key recovery, multiple plans, usage metering, enterprise quotes, and eventually on-chain Sentinel protections as an additional paid capability once Base releases have completed their independent security gates.
