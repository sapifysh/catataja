import 'dotenv/config';
import crypto from 'crypto';

/**
 * Server-Side Google OAuth 2.0 Client for Gmail Read-Only Access
 * Strictly keeps Client Secret and Refresh Tokens on the server.
 */

// Scope strictly limited to read-only Gmail access
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

// In-memory CSRF state cache with 10-minute expiration
const pendingCsrfStates = new Map<string, number>();

export function generateCsrfState(): string {
  const now = Date.now();
  // Clean up expired states
  for (const [s, expiresAt] of pendingCsrfStates.entries()) {
    if (expiresAt < now) {
      pendingCsrfStates.delete(s);
    }
  }

  const state = crypto.randomBytes(32).toString('hex');
  pendingCsrfStates.set(state, now + 10 * 60 * 1000); // 10 minutes validity
  return state;
}

export function verifyAndConsumeCsrfState(state: string | undefined): boolean {
  if (!state || typeof state !== 'string') return false;
  const expiresAt = pendingCsrfStates.get(state);
  if (!expiresAt) return false;
  pendingCsrfStates.delete(state); // Single-use consumption
  return expiresAt > Date.now();
}

export function isOAuthConfigured(): boolean {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return Boolean(
    clientId &&
    clientSecret &&
    !clientId.startsWith('MY_') &&
    !clientSecret.startsWith('MY_') &&
    clientId.length > 5 &&
    clientSecret.length > 5
  );
}

export const DEPLOYED_OAUTH_CALLBACK_URL = 'https://catataja.ai.studio/api/gmail/callback';

export function getEffectiveRedirectUri(fallbackOrigin?: string): string {
  if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.trim()) {
    return process.env.GOOGLE_REDIRECT_URI.trim();
  }
  return DEPLOYED_OAUTH_CALLBACK_URL;
}

export function getAuthorizationUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_READONLY_SCOPE,
    access_type: 'offline', // Required for refresh_token
    prompt: 'consent',     // Ensures refresh_token is returned
    include_granted_scopes: 'true',
    state,
  });

  const userEmail = process.env.GMAIL_USER_EMAIL?.trim();
  if (userEmail) {
    params.set('login_hint', userEmail);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google OAuth token exchange failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in?: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google OAuth token refresh failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function revokeToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}
