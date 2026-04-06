import type { GausiumTokenResponse } from '../types/index.js';

const GAUSIUM_BASE = 'https://openapi.gs-robot.com';

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let refreshToken: string | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = process.env.GAUSIUM_CLIENT_ID;
  const clientSecret = process.env.GAUSIUM_CLIENT_SECRET;
  const openAccessKey = process.env.GAUSIUM_OPEN_ACCESS_KEY;

  if (!clientId || !clientSecret || !openAccessKey) {
    throw new Error('Gausium credentials not configured');
  }

  const res = await fetch(`${GAUSIUM_BASE}/gas/api/v1alpha1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'urn:gaussian:params:oauth:grant-type:open-access-token',
      client_id: clientId,
      client_secret: clientSecret,
      open_access_key: openAccessKey,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gausium auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as GausiumTokenResponse;
  cachedToken = data.access_token;
  refreshToken = data.refresh_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  console.log('[gausium-auth] Token acquired, expires in', data.expires_in, 's');
  return cachedToken;
}

export function hasGausiumCredentials(): boolean {
  return !!(
    process.env.GAUSIUM_CLIENT_ID &&
    process.env.GAUSIUM_CLIENT_SECRET &&
    process.env.GAUSIUM_OPEN_ACCESS_KEY
  );
}
