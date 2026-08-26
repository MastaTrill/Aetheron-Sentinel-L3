import { FormEvent, useEffect, useState } from 'react';

import {
  clearClaimSecret,
  clearStoredApiKey,
  getClaimSecret,
  getStoredApiKey,
  sentinelFetch,
  setClaimSecret,
  setStoredApiKey,
} from '../api/sentinelClient';

interface CheckoutResponse {
  checkout_url: string;
  claim_secret: string;
}

interface ClaimResponse {
  api_key: string;
  key_prefix: string;
  subscription_status: string;
}

interface UrlResponse {
  url: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function SentinelProBilling() {
  const [storedKey, setStoredKeyState] = useState<string | null>(() => getStoredApiKey());
  const [enteredKey, setEnteredKey] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutState = params.get('checkout');
    const sessionId = params.get('session_id');

    if (checkoutState === 'cancelled') {
      clearClaimSecret();
      setStatus('Checkout cancelled. No charge was completed.');
      return;
    }
    if (checkoutState !== 'success' || !sessionId) return;

    const claimSecret = getClaimSecret();
    if (!claimSecret) {
      setStatus('Checkout completed, but this browser no longer has the one-time claim secret.');
      return;
    }

    let cancelled = false;
    const claim = async () => {
      setBusy(true);
      try {
        const response = await sentinelFetch(
          '/billing/claim',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              checkout_session_id: sessionId,
              claim_secret: claimSecret,
            }),
          },
          false,
        );
        if (!response.ok) throw new Error(await response.text());
        const body = (await response.json()) as ClaimResponse;
        if (!cancelled) {
          clearClaimSecret();
          setNewKey(body.api_key);
          setStatus('Sentinel Pro is active. Save this API key now; it will not be shown again.');
        }
      } catch (error) {
        if (!cancelled) setStatus(`Unable to claim Sentinel Pro access: ${errorMessage(error)}`);
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    void claim();
    return () => {
      cancelled = true;
    };
  }, []);

  const startCheckout = async () => {
    setBusy(true);
    setStatus('Opening secure Stripe Checkout…');
    try {
      const response = await sentinelFetch('/billing/checkout', { method: 'POST' }, false);
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as CheckoutResponse;
      setClaimSecret(body.claim_secret);
      window.location.assign(body.checkout_url);
    } catch (error) {
      setStatus(`Checkout unavailable: ${errorMessage(error)}`);
      setBusy(false);
    }
  };

  const saveExistingKey = (event: FormEvent) => {
    event.preventDefault();
    const value = enteredKey.trim();
    if (!value.startsWith('sentinel_live_')) {
      setStatus('Enter a valid Sentinel API key.');
      return;
    }
    setStoredApiKey(value);
    setStoredKeyState(value);
    setEnteredKey('');
    setStatus('Sentinel API key is active for this browser session.');
  };

  const useNewKey = () => {
    if (!newKey) return;
    setStoredApiKey(newKey);
    setStoredKeyState(newKey);
    setNewKey(null);
    setStatus('Sentinel Pro API key is active for this browser session.');
  };

  const manageSubscription = async () => {
    setBusy(true);
    try {
      const response = await sentinelFetch('/billing/portal', { method: 'POST' });
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as UrlResponse;
      window.location.assign(body.url);
    } catch (error) {
      setStatus(`Subscription portal unavailable: ${errorMessage(error)}`);
      setBusy(false);
    }
  };

  const rotateKey = async () => {
    setBusy(true);
    try {
      const response = await sentinelFetch('/billing/api-key/rotate', { method: 'POST' });
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as ClaimResponse;
      clearStoredApiKey();
      setStoredKeyState(null);
      setNewKey(body.api_key);
      setStatus('API key rotated. Save the replacement now; the previous key is revoked.');
    } catch (error) {
      setStatus(`Unable to rotate API key: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const forgetKey = () => {
    clearStoredApiKey();
    setStoredKeyState(null);
    setStatus('API key removed from this browser session.');
  };

  return (
    <section className="sentinel-pro-billing" aria-label="Sentinel Pro billing">
      <div>
        <strong>Aetheron Sentinel Pro</strong>
        <span className="sentinel-pro-price">$99/month</span>
        <p>Paid access to protected Sentinel security API and dashboard capabilities.</p>
      </div>

      {newKey && (
        <div className="sentinel-key-reveal" role="status">
          <strong>Save this API key now</strong>
          <code>{newKey}</code>
          <button type="button" onClick={useNewKey}>Use this key</button>
        </div>
      )}

      {!storedKey && !newKey && (
        <div className="sentinel-pro-actions">
          <button type="button" onClick={() => void startCheckout()} disabled={busy}>
            Upgrade to Pro
          </button>
          <form onSubmit={saveExistingKey}>
            <input
              type="password"
              value={enteredKey}
              onChange={(event) => setEnteredKey(event.target.value)}
              placeholder="sentinel_live_…"
              autoComplete="off"
              aria-label="Existing Sentinel API key"
            />
            <button type="submit">Use existing key</button>
          </form>
        </div>
      )}

      {storedKey && (
        <div className="sentinel-pro-actions">
          <span>Pro access key loaded for this session.</span>
          <button type="button" onClick={() => void manageSubscription()} disabled={busy}>
            Manage subscription
          </button>
          <button type="button" onClick={() => void rotateKey()} disabled={busy}>
            Rotate API key
          </button>
          <button type="button" onClick={forgetKey} disabled={busy}>
            Forget key
          </button>
        </div>
      )}

      {status && <p className="sentinel-pro-status">{status}</p>}
    </section>
  );
}
