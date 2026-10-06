export interface GmailStatusData {
  configured: boolean;
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
  importedCount: number;
  message?: string;
}

export interface BcaCandidateTransaction {
  messageId: string;
  threadId: string;
  date: string; // YYYY-MM-DD (Asia/Jakarta)
  time?: string; // HH:mm (Asia/Jakarta)
  type: 'expense' | 'income';
  amount: number;
  description: string;
  category: string;
  account: string; // 'BCA'
  sender: string;
  subject: string;
  alreadyImported: boolean;
  notes: string;
}

export interface RejectionSummary {
  PROMO: number;
  SECURITY: number;
  OTP: number;
  BALANCE_ONLY: number;
  NON_BCA: number;
  NO_TRANSACTION_AMOUNT: number;
  NO_TRANSACTION_KEYWORD: number;
  PARSER_FORMAT_MISMATCH: number;
  UNSUPPORTED_TRANSACTION_FORMAT: number;
}

export interface RejectionDetail {
  messageId: string;
  sender: string;
  subject: string;
  dateStr?: string;
  detectedType?: string;
  reason: string;
}

export interface BcaPreviewResponse {
  success: boolean;
  connected?: boolean;
  scannedCount?: number;
  candidateCount?: number;
  rejectedCount?: number;
  rejectionSummary?: RejectionSummary;
  rejectionDetails?: RejectionDetail[];
  candidates: BcaCandidateTransaction[];
  totalFound: number;
  newCount: number;
  alreadyImportedCount: number;
  skippedCount: number;
  totalGmailMessagesFound?: number;
  bcaMessagesFound?: number;
  diagnosticStage?: string;
  lastSyncAt?: string | null;
  message?: string;
}

export async function fetchGmailStatus(
  firestoreLastSyncAt?: string | null,
  firestoreImportedCount?: number,
  idToken?: string,
  userId?: string
): Promise<GmailStatusData> {
  try {
    const params = new URLSearchParams();
    if (firestoreLastSyncAt) params.set('lastSyncAt', firestoreLastSyncAt);
    if (typeof firestoreImportedCount === 'number') {
      params.set('importedCount', String(firestoreImportedCount));
    }
    if (userId) params.set('userId', userId);

    const headers: Record<string, string> = {};
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

    const res = await fetch(`/api/gmail/status?${params.toString()}`, { headers });
    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }
    const data = await res.json();
    return {
      configured: Boolean(data.configured),
      connected: Boolean(data.connected),
      email: data.email || null,
      lastSyncAt: firestoreLastSyncAt || data.lastSyncAt || null,
      importedCount: firestoreImportedCount ?? data.importedCount ?? 0,
    };
  } catch {
    return {
      configured: false,
      connected: false,
      email: null,
      lastSyncAt: firestoreLastSyncAt || null,
      importedCount: firestoreImportedCount || 0,
      message: 'Tidak dapat menghubungi server API Gmail.',
    };
  }
}

export async function getGmailAuthUrl(): Promise<{
  configured: boolean;
  authUrl?: string;
  message?: string;
}> {
  const res = await fetch('/api/gmail/auth');
  return res.json();
}

export async function disconnectGmail(): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/gmail/disconnect', {
    method: 'POST',
  });
  return res.json();
}

export async function fetchBcaTransactionPreview(
  days: number = 14,
  max: number = 20,
  importedIds: string[] = [],
  idToken?: string,
  userId?: string
): Promise<BcaPreviewResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  let res = await fetch('/api/gmail/preview', {
    method: 'POST',
    headers,
    body: JSON.stringify({ days, max, importedIds, userId }),
  });

  // Fallback to /api/gmail/sync if /api/gmail/preview is not found
  if (res.status === 404) {
    res = await fetch('/api/gmail/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({ days, max, importedIds, userId }),
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function confirmImportedTransactions(
  importedMessageIds: string[],
  count: number
): Promise<{ success: boolean; message: string; lastSyncAt?: string }> {
  const res = await fetch('/api/gmail/confirm-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ importedMessageIds, count }),
  });
  return res.json();
}
