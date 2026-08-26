# Sentinel Gateway Deployment Guide

## Requirements

- Python 3.11+
- Install focused gateway dependencies with `pip install -r requirements-gateway.txt`
- HTTPS-capable production ingress/reverse proxy
- Stripe account for Sentinel Pro billing
- Supabase project with the billing migration applied

## Quick Start (Development)

```bash
python -m venv .venv
.venv/Scripts/activate  # Windows
source .venv/bin/activate  # Linux/macOS
pip install -r requirements-gateway.txt
python sentinel_gateway_prototype.py
```

Development can continue to use `SENTINEL_API_KEY` for explicit local compatibility. The legacy fallback key is not accepted when `SENTINEL_ENV=production`.

## Production Environment Contract

Configure these **backend-only** environment variables on the gateway host. Values shown below are placeholders only and must never be committed.

```text
SENTINEL_ENV=production
STRIPE_SECRET_KEY=<deployment secret>
STRIPE_WEBHOOK_SECRET=<deployment secret>
STRIPE_SENTINEL_PRO_PRICE_ID=<live recurring price id>
SENTINEL_DASHBOARD_URL=https://<dashboard-host>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<deployment secret>
```

Configure only this public variable in the Vite dashboard:

```text
VITE_SENTINEL_API_URL=https://<gateway-host>
```

Never put Stripe secret keys, Stripe webhook secrets, Supabase service-role keys, customer API keys, claim secrets, or API-key hashes in a `VITE_` variable.

## Sentinel Pro Billing

The first paid offer is **Aetheron Sentinel Pro — $99 USD/month**, billed up front with Stripe-hosted Checkout and no free trial.

Public billing endpoints:

- `POST /billing/checkout` — creates a Stripe-hosted subscription Checkout Session and one-time claim secret.
- `POST /billing/claim` — exchanges a completed Checkout Session plus one-time claim secret for a customer-specific Sentinel API key.
- `POST /billing/webhook` — receives signed Stripe lifecycle events.

Authenticated billing endpoints:

- `POST /billing/portal` — requires any recognized, non-revoked customer API key, including when the subscription is inactive/past due.
- `POST /billing/api-key/rotate` — requires an active Sentinel Pro subscription and returns a replacement API key once.

Protected Sentinel application routes require an active subscription in production. `GET /health` remains public.

## Stripe Webhook Configuration

Create a Stripe webhook endpoint at:

```text
https://<gateway-host>/billing/webhook
```

Subscribe it to at least:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

Copy the resulting Stripe webhook signing secret into the gateway's `STRIPE_WEBHOOK_SECRET` deployment secret. The webhook handler reads the raw request body and verifies the Stripe signature before changing subscription state.

Configure Stripe Customer Portal to allow payment-method updates and cancellation at period end. A recognized API key can still open Customer Portal after a payment failure so the customer can repair billing.

## Supabase Billing Migration

Apply:

```text
supabase/migrations/20260825230300_sentinel_pro_billing.sql
```

It creates backend-only tables for subscriptions, API-key hashes, one-time Checkout claims, and processed Stripe events. RLS is enabled without browser/anon allow policies. The service-role key is used only by the gateway.

API keys are generated with a `sentinel_live_` prefix and cryptographically secure randomness. Only the SHA-256 hash and non-secret prefix are stored. Checkout claims are also hashed, expire after 60 minutes, and are consumed atomically with API-key insertion.

## CORS

Production CORS allows exactly the HTTPS origin derived from `SENTINEL_DASHBOARD_URL`. Wildcard production CORS is not permitted.

## Rate Limiting

`POST /billing/checkout` and `POST /billing/claim` are limited to 10 attempts per 10 minutes per client IP in the first release.

This limiter is process-local. **Before running multiple gateway replicas/workers, move this limiter to Redis or another shared store.** Do not horizontally scale the billing gateway while relying on the in-memory limiter.

## Production Deployment

### Option 1: Uvicorn with systemd

Use one worker for the first billing release unless the rate limiter has been moved to shared storage:

```ini
[Unit]
Description=Sentinel Gateway FastAPI Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/path/to/Aetheron-Sentinel-L3
EnvironmentFile=/etc/sentinel-gateway.env
ExecStart=/path/to/Aetheron-Sentinel-L3/.venv/bin/uvicorn sentinel_gateway_prototype:app --host 0.0.0.0 --port 8000 --workers 1
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable sentinel-gateway
sudo systemctl restart sentinel-gateway
```

### Option 2: Docker

```Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements-gateway.txt
EXPOSE 8000
CMD ["uvicorn", "sentinel_gateway_prototype:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

Inject production secrets at runtime; do not bake them into the image.

## Release Verification

Before calling Sentinel Pro live:

```bash
python -m pytest \
  test/test_sentinel_gateway.py \
  test/test_billing_store.py \
  test/test_entitlements.py \
  test/test_billing_api.py -q

node scripts/scan-tracked-secrets.mjs
node scripts/validate-canonical-release-scope.mjs
npm --prefix dashboard run lint
npm --prefix dashboard run build
```

Then verify a controlled live Checkout end-to-end: Checkout success, one-time claim, protected API access, Customer Portal access, webhook subscription-state update, cancellation behavior, and API-key rotation.

## Blockchain Release Separation

Sentinel Pro billing is deliberately independent from the protected Base Sepolia/Base Mainnet contract release. Launching or configuring billing does **not** mean the Base deployment is complete and does not modify the blockchain deployment gates.

---

_For more information on repository security practices, see `SECURITY.md`._
