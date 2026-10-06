import { isOAuthConfigured } from './oauth';
import { GmailConnectionStatus, StoredOAuthTokens } from './types';
import { decryptData, encryptData, EncryptedPayload } from './crypto';

/**
 * Server-only in-memory encrypted token vault.
 * Keeps refresh token encrypted at rest using AES-256-GCM with GOOGLE_CLIENT_SECRET.
 * Zero client access, zero local filesystem file dependency.
 */
interface EncryptedVaultRecord {
  payload: EncryptedPayload;
  email: string | null;
  expiryDate?: number;
  userId: string;
  updatedAt: string;
}

let memoryVault: EncryptedVaultRecord | null = null;

// Server-side synchronization metadata tracker
let serverSyncState = {
  lastSyncAt: null as string | null,
  importedCount: 0,
};

export function loadStoredTokens(): StoredOAuthTokens | null {
  if (!memoryVault) return null;
  try {
    const rawJson = decryptData(memoryVault.payload);
    return JSON.parse(rawJson) as StoredOAuthTokens;
  } catch (err) {
    console.warn('Failed to decrypt vault tokens in server memory:', err);
    return null;
  }
}

export function saveStoredTokens(data: Partial<StoredOAuthTokens>, userId: string = 'owner'): void {
  const existing = loadStoredTokens() || {};
  const merged: StoredOAuthTokens = {
    ...existing,
    ...data,
  };

  const rawJson = JSON.stringify(merged);
  const encrypted = encryptData(rawJson);

  memoryVault = {
    payload: encrypted,
    email: merged.email || null,
    expiryDate: merged.expiryDate,
    userId,
    updatedAt: new Date().toISOString(),
  };
}

export function clearStoredTokens(): void {
  memoryVault = null;
}

export function recordServerSyncMetadata(count: number): { lastSyncAt: string | null; importedCount: number } {
  serverSyncState.lastSyncAt = new Date().toISOString();
  serverSyncState.importedCount += count;
  return { ...serverSyncState };
}

export function getServerSyncState(): { lastSyncAt: string | null; importedCount: number } {
  return { ...serverSyncState };
}

/**
 * Returns strictly sanitized status for frontend consumption.
 * Never includes refresh tokens or secrets.
 */
export function getSafeConnectionStatus(
  firestoreSyncState?: { lastSyncAt?: string | null; importedCount?: number }
): GmailConnectionStatus {
  const configured = isOAuthConfigured();
  const connected = Boolean(memoryVault);

  return {
    configured,
    connected,
    email: connected ? memoryVault?.email || process.env.GMAIL_USER_EMAIL || null : null,
    lastSyncAt: firestoreSyncState?.lastSyncAt || serverSyncState.lastSyncAt,
    importedCount: firestoreSyncState?.importedCount ?? serverSyncState.importedCount,
  };
}
