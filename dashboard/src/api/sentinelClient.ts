const configuredBase = import.meta.env.VITE_SENTINEL_API_URL?.trim();
const API_BASE = configuredBase ? configuredBase.replace(/\/$/, '') : '/api/sentinel';
const API_KEY_STORAGE = 'sentinel_api_key';
const CLAIM_SECRET_STORAGE = 'sentinel_claim_secret';

export function getStoredApiKey(): string | null {
  return sessionStorage.getItem(API_KEY_STORAGE);
}

export function setStoredApiKey(key: string): void {
  sessionStorage.setItem(API_KEY_STORAGE, key.trim());
}

export function clearStoredApiKey(): void {
  sessionStorage.removeItem(API_KEY_STORAGE);
}

export function getClaimSecret(): string | null {
  return sessionStorage.getItem(CLAIM_SECRET_STORAGE);
}

export function setClaimSecret(secret: string): void {
  sessionStorage.setItem(CLAIM_SECRET_STORAGE, secret);
}

export function clearClaimSecret(): void {
  sessionStorage.removeItem(CLAIM_SECRET_STORAGE);
}

export async function sentinelFetch(
  path: string,
  init: RequestInit = {},
  requireKey = true,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.delete('Authorization');
  headers.delete('X-API-Key');
  if (requireKey) {
    const key = getStoredApiKey();
    if (!key) throw new Error('Sentinel Pro API key required');
    headers.set('X-API-Key', key);
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${API_BASE}${normalizedPath}`, { ...init, headers });
}

let bridgeInstalled = false;

export function installSentinelFetchBridge(): void {
  if (bridgeInstalled || typeof window === 'undefined') return;
  bridgeInstalled = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (typeof input !== 'string' || !input.startsWith('/api/sentinel/')) {
      return nativeFetch(input, init);
    }

    const path = input.slice('/api/sentinel'.length);
    const headers = new Headers(init.headers);
    headers.delete('Authorization');
    headers.delete('X-API-Key');
    const key = getStoredApiKey();
    if (key) headers.set('X-API-Key', key);

    return nativeFetch(`${API_BASE}${path}`, { ...init, headers });
  };
}
