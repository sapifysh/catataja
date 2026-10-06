export interface GmailConnectionStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
  importedCount: number;
}

export interface StoredOAuthTokens {
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
  email?: string;
}

export interface GmailFirestoreSyncState {
  connectedEmail: string;
  lastSyncAt: string;
  importedCount: number;
  updatedAt: string;
}

export interface GmailImportedMessageRecord {
  messageId: string;
  transactionId: string;
  amount: number;
  date: string;
  description: string;
  sender: string;
  importedAt: string;
  userEmail: string;
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
  account: string; // Always 'BCA'
  sender: string;
  subject: string;
  alreadyImported: boolean;
  notes: string;
}

export type DiagnosticCategory =
  | 'PROMO'
  | 'SECURITY'
  | 'OTP'
  | 'BALANCE_ONLY'
  | 'NON_BCA'
  | 'NO_TRANSACTION_AMOUNT'
  | 'NO_TRANSACTION_KEYWORD'
  | 'PARSER_FORMAT_MISMATCH'
  | 'UNSUPPORTED_TRANSACTION_FORMAT';

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
  detectedType: DiagnosticCategory;
  reason: string;
}

export interface SyncPreviewResult {
  success: boolean;
  connected: boolean;
  query?: string;
  totalGmailMessagesFound: number;
  bcaMessagesFound: number;
  scannedCount: number;
  candidateCount: number;
  rejectedCount: number;
  rejectionSummary: RejectionSummary;
  rejectionDetails?: RejectionDetail[];
  candidates: BcaCandidateTransaction[];
  totalFound: number;
  newCount: number;
  alreadyImportedCount: number;
  skippedCount: number;
  lastSyncAt: string | null;
  message: string;
  diagnosticStage?: string;
}
