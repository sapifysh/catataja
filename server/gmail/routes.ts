import { Request, Response, Router } from 'express';
import {
  exchangeCodeForTokens,
  generateCsrfState,
  getAuthorizationUrl,
  getEffectiveRedirectUri,
  isOAuthConfigured,
  refreshAccessToken,
  revokeToken,
  verifyAndConsumeCsrfState,
} from './oauth';
import {
  buildBcaSearchQuery,
  extractBodyContent,
  extractSenderEmail,
  isVerifiedBcaSender,
  parseBcaTransactionEmailWithDiagnostics,
} from './parser';
import {
  clearStoredTokens,
  getSafeConnectionStatus,
  loadStoredTokens,
  recordServerSyncMetadata,
  saveStoredTokens,
} from './storage';
import {
  BcaCandidateTransaction,
  DiagnosticCategory,
  RejectionDetail,
  RejectionSummary,
  SyncPreviewResult,
} from './types';

export const gmailRouter = Router();

/**
 * Helper to ensure a fresh, valid access token is available.
 * Auto-refreshes using the refresh_token if the access token has expired.
 */
async function getValidAccessToken(): Promise<string> {
  const session = loadStoredTokens();

  if (!session || (!session.accessToken && !session.refreshToken)) {
    throw new Error('Gmail belum terhubung. Silakan hubungkan akun Gmail terlebih dahulu.');
  }

  // Return current access token if not yet expired (with 1-minute safety window)
  if (
    session.accessToken &&
    session.expiryDate &&
    Date.now() < session.expiryDate - 60_000
  ) {
    return session.accessToken;
  }

  if (session.refreshToken) {
    const refreshed = await refreshAccessToken(session.refreshToken);
    const newExpiry = refreshed.expires_in
      ? Date.now() + refreshed.expires_in * 1000
      : Date.now() + 3500 * 1000;

    saveStoredTokens({
      accessToken: refreshed.access_token,
      expiryDate: newExpiry,
    });

    return refreshed.access_token;
  }

  throw new Error('Sesi Gmail kedaluwarsa. Silakan putuskan dan hubungkan ulang akun Gmail.');
}

/**
 * GET /api/gmail/status
 * Returns safe connection status. Does NOT leak secrets or tokens.
 */
gmailRouter.get('/status', (req: Request, res: Response) => {
  const lastSyncAt = typeof req.query.lastSyncAt === 'string' ? req.query.lastSyncAt : undefined;
  const importedCount = typeof req.query.importedCount === 'string' ? parseInt(req.query.importedCount, 10) : undefined;

  const status = getSafeConnectionStatus({
    lastSyncAt,
    importedCount,
  });
  res.json({
    success: true,
    ...status,
  });
});

/**
 * GET /api/gmail/auth
 * Generates official Google OAuth 2.0 authorization URL with CSRF protection.
 */
gmailRouter.get('/auth', (req: Request, res: Response) => {
  if (!isOAuthConfigured()) {
    return res.status(200).json({
      success: false,
      configured: false,
      message: 'Integrasi Gmail belum dikonfigurasi.',
    });
  }

  const redirectUri = getEffectiveRedirectUri(
    `${req.protocol}://${req.get('host')}`
  );
  const state = generateCsrfState();
  const authUrl = getAuthorizationUrl(redirectUri, state);

  if (req.query.redirect === 'true') {
    return res.redirect(authUrl);
  }

  return res.json({
    success: true,
    configured: true,
    authUrl,
  });
});

/**
 * GET /api/gmail/callback
 * Handles OAuth 2.0 redirect, verifies CSRF state, exchanges code for refresh token,
 * and securely stores the token in AES-256-GCM encrypted server vault.
 */
gmailRouter.get('/callback', async (req: Request, res: Response) => {
  const { code, error, state } = req.query;

  // Handle Google OAuth errors
  if (error) {
    return res.redirect('/?gmail_error=' + encodeURIComponent(String(error)));
  }

  // Verify and consume CSRF state token
  if (!verifyAndConsumeCsrfState(state as string)) {
    return res.redirect('/?gmail_error=csrf_validation_failed');
  }

  if (!code || typeof code !== 'string') {
    return res.redirect('/?gmail_error=missing_code');
  }

  try {
    const redirectUri = getEffectiveRedirectUri(
      `${req.protocol}://${req.get('host')}`
    );
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // Retrieve user profile email using access token
    let profileEmail: string | undefined;
    try {
      const profileRes = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        profileEmail = profileData.emailAddress;
      }
    } catch {
      // ignore
    }

    // Save tokens in server-only encrypted vault (AES-256-GCM)
    saveStoredTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : undefined,
      email: profileEmail || process.env.GMAIL_USER_EMAIL || 'hitamdimas6@gmail.com',
    });

    return res.redirect('/?gmail_connected=true');
  } catch (err: any) {
    return res.redirect(
      '/?gmail_error=' + encodeURIComponent(err.message || 'auth_exchange_failed')
    );
  }
});

/**
 * POST /api/gmail/disconnect
 * Safely revokes token with Google and clears server vault.
 */
gmailRouter.post('/disconnect', async (_req: Request, res: Response) => {
  const session = loadStoredTokens();
  if (session?.refreshToken || session?.accessToken) {
    const tokenToRevoke = session.refreshToken || session.accessToken;
    await revokeToken(tokenToRevoke!).catch(() => {});
  }

  clearStoredTokens();

  res.json({
    success: true,
    message: 'Koneksi Gmail berhasil diputuskan.',
  });
});

/**
 * End-to-end handler for Gmail BCA transaction scanning and candidate preview with rich diagnostics.
 */
async function handlePreviewRequest(req: Request, res: Response) {
  const emptyRejectionSummary: RejectionSummary = {
    PROMO: 0,
    SECURITY: 0,
    OTP: 0,
    BALANCE_ONLY: 0,
    NON_BCA: 0,
    NO_TRANSACTION_AMOUNT: 0,
    NO_TRANSACTION_KEYWORD: 0,
    PARSER_FORMAT_MISMATCH: 0,
    UNSUPPORTED_TRANSACTION_FORMAT: 0,
  };

  if (!isOAuthConfigured()) {
    return res.status(200).json({
      success: false,
      connected: false,
      diagnosticStage: 'GMAIL_NOT_CONNECTED',
      message: 'Integrasi Gmail belum dikonfigurasi pada server.',
      candidates: [],
      totalGmailMessagesFound: 0,
      bcaMessagesFound: 0,
      scannedCount: 0,
      candidateCount: 0,
      rejectedCount: 0,
      rejectionSummary: emptyRejectionSummary,
      rejectionDetails: [],
      totalFound: 0,
      newCount: 0,
      alreadyImportedCount: 0,
      skippedCount: 0,
      lastSyncAt: null,
    });
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken();
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      connected: false,
      diagnosticStage: 'GMAIL_AUTH_FAILED',
      message: err.message || 'Gmail belum terhubung.',
      candidates: [],
      totalGmailMessagesFound: 0,
      bcaMessagesFound: 0,
      scannedCount: 0,
      candidateCount: 0,
      rejectedCount: 0,
      rejectionSummary: emptyRejectionSummary,
      rejectionDetails: [],
      totalFound: 0,
      newCount: 0,
      alreadyImportedCount: 0,
      skippedCount: 0,
      lastSyncAt: null,
    });
  }

  const lookbackDays = Math.min(
    30,
    Math.max(1, parseInt((req.query.days as string) || (req.body?.days as string) || '14', 10))
  );
  const maxResults = Math.min(
    30,
    Math.max(1, parseInt((req.query.max as string) || (req.body?.max as string) || '20', 10))
  );

  let knownImportedIds: string[] = [];
  if (Array.isArray(req.body?.importedIds)) {
    knownImportedIds = req.body.importedIds.filter((id: unknown): id is string => typeof id === 'string');
  } else if (typeof req.query.importedIds === 'string' && req.query.importedIds.trim()) {
    knownImportedIds = req.query.importedIds.split(',').map((s) => s.trim()).filter(Boolean);
  }

  const importedSet = new Set(knownImportedIds);
  const query = buildBcaSearchQuery(lookbackDays);
  console.log(`[Gmail Sync] Searching with query: "${query}" (maxResults: ${maxResults})`);

  try {
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
      query
    )}&maxResults=${maxResults}`;

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      if (listRes.status === 401) {
        return res.status(401).json({
          success: false,
          connected: false,
          diagnosticStage: 'GMAIL_AUTH_FAILED',
          message: 'Otorisasi Gmail kedaluwarsa. Silakan hubungkan ulang Gmail.',
          candidates: [],
          totalGmailMessagesFound: 0,
          bcaMessagesFound: 0,
          scannedCount: 0,
          candidateCount: 0,
          rejectedCount: 0,
          rejectionSummary: emptyRejectionSummary,
          rejectionDetails: [],
          totalFound: 0,
          newCount: 0,
          alreadyImportedCount: 0,
          skippedCount: 0,
          lastSyncAt: null,
        });
      }
      if (listRes.status === 429) {
        return res.status(429).json({
          success: false,
          connected: true,
          diagnosticStage: 'SERVER_ERROR',
          message: 'Batas kuota Gmail API tercapai. Silakan coba beberapa saat lagi.',
          candidates: [],
          totalGmailMessagesFound: 0,
          bcaMessagesFound: 0,
          scannedCount: 0,
          candidateCount: 0,
          rejectedCount: 0,
          rejectionSummary: emptyRejectionSummary,
          rejectionDetails: [],
          totalFound: 0,
          newCount: 0,
          alreadyImportedCount: 0,
          skippedCount: 0,
          lastSyncAt: null,
        });
      }
      return res.status(listRes.status).json({
        success: false,
        connected: true,
        diagnosticStage: 'SERVER_ERROR',
        message: `Gagal memanggil Gmail API (${listRes.status}).`,
        candidates: [],
        totalGmailMessagesFound: 0,
        bcaMessagesFound: 0,
        scannedCount: 0,
        candidateCount: 0,
        rejectedCount: 0,
        rejectionSummary: emptyRejectionSummary,
        rejectionDetails: [],
        totalFound: 0,
        newCount: 0,
        alreadyImportedCount: 0,
        skippedCount: 0,
        lastSyncAt: null,
      });
    }

    const listData = await listRes.json();
    const messageHeaders = listData.messages || [];
    const totalGmailMessagesFound = messageHeaders.length;

    console.log(`[Gmail Sync] Gmail API returned ${totalGmailMessagesFound} messages for query.`);

    if (totalGmailMessagesFound === 0) {
      recordServerSyncMetadata(0);
      return res.json({
        success: true,
        connected: true,
        query,
        diagnosticStage: 'NO_GMAIL_MESSAGES_FOUND',
        candidates: [],
        totalGmailMessagesFound: 0,
        bcaMessagesFound: 0,
        scannedCount: 0,
        candidateCount: 0,
        rejectedCount: 0,
        rejectionSummary: emptyRejectionSummary,
        rejectionDetails: [],
        totalFound: 0,
        newCount: 0,
        alreadyImportedCount: 0,
        skippedCount: 0,
        lastSyncAt: new Date().toISOString(),
        message: `Pemeriksaan selesai. Tidak ditemukan email dari BCA dalam rentang ${lookbackDays} hari terakhir.`,
      });
    }

    const candidates: BcaCandidateTransaction[] = [];
    const rejectionDetails: RejectionDetail[] = [];
    const rejectionSummary: RejectionSummary = { ...emptyRejectionSummary };
    let bcaMessagesFound = 0;
    let skippedCount = 0;
    let alreadyImportedCount = 0;

    for (const item of messageHeaders) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!msgRes.ok) {
        skippedCount++;
        continue;
      }

      const msgData = await msgRes.json();
      const headers = msgData.payload?.headers || [];

      const fromHeader =
        headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
      const subjectHeader =
        headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
      const internalDateMs = parseInt(msgData.internalDate || '0', 10);
      const snippet = msgData.snippet || '';
      // Extract structured body including HTML tables
      const bodyText = extractBodyContent(msgData.payload);

      const senderEmail = extractSenderEmail(fromHeader);
      const isBcaSender = isVerifiedBcaSender(senderEmail);

      if (isBcaSender) {
        bcaMessagesFound++;
      }

      const parseResult = parseBcaTransactionEmailWithDiagnostics(
        item.id,
        item.threadId || item.id,
        internalDateMs,
        fromHeader,
        subjectHeader,
        snippet,
        bodyText
      );

      if (parseResult.candidate) {
        const c = parseResult.candidate;
        if (importedSet.has(c.messageId)) {
          c.alreadyImported = true;
          alreadyImportedCount++;
        }
        candidates.push(c);
      } else {
        const detected = parseResult.detectedType as DiagnosticCategory;
        if (detected in rejectionSummary) {
          rejectionSummary[detected]++;
        } else {
          rejectionSummary.UNSUPPORTED_TRANSACTION_FORMAT++;
        }

        rejectionDetails.push({
          messageId: item.id,
          sender: senderEmail,
          subject: subjectHeader,
          dateStr: parseResult.dateStr,
          detectedType: detected,
          reason: parseResult.rejectedReason || 'Format tidak dikenali',
        });

        console.log(`[Gmail Classifier Rejected] ID: ${item.id} | Type: ${detected} | Reason: ${parseResult.rejectedReason} | Subject: "${subjectHeader}"`);
      }
    }

    const newCount = candidates.filter((c) => !c.alreadyImported).length;
    const nowIso = new Date().toISOString();
    recordServerSyncMetadata(0);

    let diagnosticStage: SyncPreviewResult['diagnosticStage'] = 'CANDIDATES_READY';
    let responseMessage = '';

    if (bcaMessagesFound === 0) {
      diagnosticStage = 'NO_BCA_MESSAGES_FOUND';
      responseMessage = 'Ditemukan email tetapi tidak ada yang berasal dari domain resmi BCA.';
    } else if (candidates.length === 0) {
      diagnosticStage = 'ALL_REJECTED_BY_PARSER';
      const summaryParts: string[] = [];
      if (rejectionSummary.PROMO > 0) summaryParts.push(`${rejectionSummary.PROMO} promo`);
      if (rejectionSummary.SECURITY > 0) summaryParts.push(`${rejectionSummary.SECURITY} tips keamanan`);
      if (rejectionSummary.OTP > 0) summaryParts.push(`${rejectionSummary.OTP} OTP`);
      if (rejectionSummary.BALANCE_ONLY > 0) summaryParts.push(`${rejectionSummary.BALANCE_ONLY} saldo`);
      if (rejectionSummary.NO_TRANSACTION_AMOUNT > 0) summaryParts.push(`${rejectionSummary.NO_TRANSACTION_AMOUNT} tanpa nominal`);
      if (rejectionSummary.NO_TRANSACTION_KEYWORD > 0) summaryParts.push(`${rejectionSummary.NO_TRANSACTION_KEYWORD} non-transaksi`);

      const breakdown = summaryParts.length > 0 ? ` (${summaryParts.join(', ')})` : '';
      responseMessage = `Ditemukan ${bcaMessagesFound} email BCA, namun semuanya bukan mutasi transaksi baru${breakdown}.`;
    } else if (newCount === 0) {
      diagnosticStage = 'ALL_ALREADY_IMPORTED';
      responseMessage = `Semua (${candidates.length}) notifikasi transaksi BCA pada periode ini sudah tercatat sebelumnya.`;
    } else {
      diagnosticStage = 'CANDIDATES_READY';
      responseMessage = `Ditemukan ${newCount} transaksi BCA baru dari email siap dipratinjau.`;
    }

    console.log(`[Gmail Sync] Completed: ${newCount} new, ${alreadyImportedCount} already imported, ${rejectionDetails.length} rejected.`);

    const result: SyncPreviewResult = {
      success: true,
      connected: true,
      query,
      diagnosticStage,
      totalGmailMessagesFound,
      bcaMessagesFound,
      scannedCount: totalGmailMessagesFound,
      candidateCount: candidates.length,
      rejectedCount: rejectionDetails.length,
      rejectionSummary,
      rejectionDetails,
      candidates,
      totalFound: candidates.length,
      newCount,
      alreadyImportedCount,
      skippedCount,
      lastSyncAt: nowIso,
      message: responseMessage,
    };

    return res.json(result);
  } catch (err: any) {
    console.error('[Gmail Sync Error]:', err);
    return res.status(500).json({
      success: false,
      connected: true,
      diagnosticStage: 'SERVER_ERROR',
      message: `Kendala saat memeriksa email BCA: ${err.message || 'Terjadi kesalahan sistem'}`,
      candidates: [],
      totalGmailMessagesFound: 0,
      bcaMessagesFound: 0,
      scannedCount: 0,
      candidateCount: 0,
      rejectedCount: 0,
      rejectionSummary: emptyRejectionSummary,
      rejectionDetails: [],
      totalFound: 0,
      newCount: 0,
      alreadyImportedCount: 0,
      skippedCount: 0,
      lastSyncAt: null,
    });
  }
}

/**
 * GET & POST /api/gmail/preview
 */
gmailRouter.get('/preview', handlePreviewRequest);
gmailRouter.post('/preview', handlePreviewRequest);

/**
 * GET & POST /api/gmail/sync
 * Both preview and sync routes use the verified end-to-end scanner
 */
gmailRouter.get('/sync', handlePreviewRequest);
gmailRouter.post('/sync', handlePreviewRequest);

/**
 * POST /api/gmail/confirm-import
 * Generates and records server-side synchronization metadata.
 */
gmailRouter.post('/confirm-import', (req: Request, res: Response) => {
  const { count } = req.body;
  const finalCount = typeof count === 'number' ? count : 0;
  const syncMeta = recordServerSyncMetadata(finalCount);

  return res.json({
    success: true,
    syncedCount: finalCount,
    lastSyncAt: syncMeta.lastSyncAt,
    importedCount: syncMeta.importedCount,
    message: `Sinkronisasi ${finalCount} transaksi BCA terkonfirmasi.`,
  });
});
