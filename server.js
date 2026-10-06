// server.ts
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// server/gmail/routes.ts
import { Router } from "express";

// server/gmail/oauth.ts
import "dotenv/config";
import crypto from "crypto";
var GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
var pendingCsrfStates = /* @__PURE__ */ new Map();
function generateCsrfState() {
  const now = Date.now();
  for (const [s, expiresAt] of pendingCsrfStates.entries()) {
    if (expiresAt < now) {
      pendingCsrfStates.delete(s);
    }
  }
  const state = crypto.randomBytes(32).toString("hex");
  pendingCsrfStates.set(state, now + 10 * 60 * 1e3);
  return state;
}
function verifyAndConsumeCsrfState(state) {
  if (!state || typeof state !== "string") return false;
  const expiresAt = pendingCsrfStates.get(state);
  if (!expiresAt) return false;
  pendingCsrfStates.delete(state);
  return expiresAt > Date.now();
}
function isOAuthConfigured() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return Boolean(
    clientId && clientSecret && !clientId.startsWith("MY_") && !clientSecret.startsWith("MY_") && clientId.length > 5 && clientSecret.length > 5
  );
}
var DEPLOYED_OAUTH_CALLBACK_URL = "https://catataja.ai.studio/api/gmail/callback";
function getEffectiveRedirectUri(fallbackOrigin) {
  if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.trim()) {
    return process.env.GOOGLE_REDIRECT_URI.trim();
  }
  return DEPLOYED_OAUTH_CALLBACK_URL;
}
function getAuthorizationUrl(redirectUri, state) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_READONLY_SCOPE,
    access_type: "offline",
    // Required for refresh_token
    prompt: "consent",
    // Ensures refresh_token is returned
    include_granted_scopes: "true",
    state
  });
  const userEmail = process.env.GMAIL_USER_EMAIL?.trim();
  if (userEmail) {
    params.set("login_hint", userEmail);
  }
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
async function exchangeCodeForTokens(code, redirectUri) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google OAuth token exchange failed: ${response.status} - ${errorText}`);
  }
  return response.json();
}
async function refreshAccessToken(refreshToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google OAuth token refresh failed: ${response.status} - ${errorText}`);
  }
  return response.json();
}
async function revokeToken(token) {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

// server/gmail/parser.ts
function buildBcaSearchQuery(lookbackDays = 14) {
  const d = /* @__PURE__ */ new Date();
  d.setDate(d.getDate() - (lookbackDays + 1));
  const afterDate = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  return `from:bca.co.id after:${afterDate}`;
}
function extractSenderEmail(fromHeader) {
  if (!fromHeader) return "";
  const match = fromHeader.match(/<([^>]+)>/);
  if (match && match[1]) {
    return match[1].trim().toLowerCase();
  }
  return fromHeader.trim().toLowerCase();
}
function isVerifiedBcaSender(senderEmail) {
  if (!senderEmail) return false;
  return senderEmail.endsWith("@bca.co.id") || senderEmail.includes(".bca.co.id");
}
function formatJakartaDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}
function formatJakartaTime(date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}
function extractBodyContent(payload) {
  let plain = "";
  let html = "";
  function traverse(part) {
    if (!part) return;
    if (part.mimeType === "text/plain" && part.body?.data) {
      try {
        const decoded = Buffer.from(part.body.data, "base64url").toString("utf-8");
        plain += "\n" + decoded;
      } catch {
      }
    } else if (part.mimeType === "text/html" && part.body?.data) {
      try {
        const decoded = Buffer.from(part.body.data, "base64url").toString("utf-8");
        html += "\n" + decoded;
      } catch {
      }
    }
    if (Array.isArray(part.parts)) {
      for (const p of part.parts) {
        traverse(p);
      }
    }
  }
  traverse(payload);
  let convertedHtml = "";
  if (html) {
    convertedHtml = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<br\s*[\/]?>/gi, "\n").replace(/<\/(p|div|tr|h\d)>/gi, "\n").replace(/<\/td>/gi, "  ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\r/g, "").replace(/[ \t]+/g, " ");
  }
  return `${plain}
${convertedHtml}`.trim();
}
function parseCurrencyAmount(rawStr) {
  if (!rawStr) return 0;
  let clean = rawStr.trim();
  if (/^\d{8,}$/.test(clean)) {
    return 0;
  }
  if (/^\d{1,3}(,\d{3})+(\.\d{2})?$/.test(clean)) {
    clean = clean.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+(,\d{2})?$/.test(clean)) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+$/.test(clean)) {
    clean = clean.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    clean = clean.replace(/\./g, "");
  } else if (clean.includes(",") && clean.split(",")[1].length === 2) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(".") && clean.split(".")[1].length === 2) {
    clean = clean.replace(/,/g, "");
  } else {
    clean = clean.replace(/[.,]/g, "");
  }
  const parsed = Math.round(parseFloat(clean));
  return !isNaN(parsed) && parsed >= 500 && parsed <= 1e9 ? parsed : 0;
}
function parseBcaTransactionEmailWithDiagnostics(messageId, threadId, internalDateMs, fromHeader, subject, snippet, bodyText) {
  const senderEmail = extractSenderEmail(fromHeader);
  const dateObj = internalDateMs > 0 ? new Date(internalDateMs) : /* @__PURE__ */ new Date();
  const dateStrFallback = formatJakartaDate(dateObj);
  if (!isVerifiedBcaSender(senderEmail)) {
    return {
      candidate: null,
      detectedType: "NON_BCA",
      rejectedReason: `Bukan alamat domain resmi BCA (${senderEmail || "tidak dikenal"})`,
      sender: senderEmail,
      subject,
      dateStr: dateStrFallback
    };
  }
  const combinedContent = `${subject}
${snippet}
${bodyText}`.replace(/\r/g, "");
  const lowerContent = combinedContent.toLowerCase();
  const lowerSubject = subject.toLowerCase();
  if (/kode otp|one time password|verifikasi nomor|aktivasi akun|ganti pin|ganti password|verifikasi email/i.test(
    lowerSubject
  ) && !/berhasil|journal|withdrawal|debet|debit|kredit|sebesar|nominal|amount/i.test(lowerSubject)) {
    return {
      candidate: null,
      detectedType: "OTP",
      rejectedReason: "Notifikasi kode OTP / keamanan verifikasi akun",
      sender: senderEmail,
      subject,
      dateStr: dateStrFallback
    };
  }
  const isPurePromo = /promo|diskon|cashback|penawaran khusus|bca expo|katalog|reward bca/i.test(lowerSubject) && !/journal|withdrawal|transaksi|debet|debit|kredit|transfer|pembayaran|qris|sebesar|nominal|amount|tagihan/i.test(
    lowerSubject
  );
  if (isPurePromo) {
    return {
      candidate: null,
      detectedType: "PROMO",
      rejectedReason: "Surel promosi/penawaran BCA tanpa mutasi rekening",
      sender: senderEmail,
      subject,
      dateStr: dateStrFallback
    };
  }
  const isPureBalance = /informasi saldo|saldo rekening|cek saldo/i.test(lowerSubject) && !/journal|withdrawal|transaksi|debet|debit|kredit|transfer|pembayaran|sebesar|nominal|amount/i.test(
    lowerSubject
  );
  if (isPureBalance) {
    return {
      candidate: null,
      detectedType: "BALANCE_ONLY",
      rejectedReason: "Informasi saldo rekening tanpa mutasi nominal debit/kredit",
      sender: senderEmail,
      subject,
      dateStr: dateStrFallback
    };
  }
  const hasTxMarkers = /internet transaction journal|cash withdrawal|journal|transaksi|rekening|debet|debit|kredit|transfer|pembayaran|payment|purchase|qris|m-bca|klikbca|mybca|mutasi|tagihan|tarik tunai|setoran|edc|virtual account|beneficiary|penerima|merchant|amount|berhasil|successful/i.test(
    lowerContent
  );
  if (!hasTxMarkers) {
    return {
      candidate: null,
      detectedType: "NO_TRANSACTION_KEYWORD",
      rejectedReason: "Tidak memuat kata kunci mutasi atau bukti transaksi finansial",
      sender: senderEmail,
      subject,
      dateStr: dateStrFallback
    };
  }
  let type = "expense";
  if (/kredit|dana masuk|transfer masuk|terima transfer|setoran tunai|penerimaan dana|credit to/i.test(
    lowerContent
  )) {
    type = "income";
  } else {
    type = "expense";
  }
  let amount = 0;
  const amountPatterns = [
    // Labeled amounts (English & Indonesian)
    /(?:withdrawal\s+amount|transaction\s+amount|transfer\s+amount|purchase\s+amount|payment\s+amount|total\s+amount|total\s+nominal|nominal(?:\s+transaksi)?|jumlah(?:\s+transaksi)?|amount|sebesar|nilai|total)\s*[:=]?\s*(?:rp\.?|idr)?\s*([\d.,]+)/i,
    // Explicit currency prefix (IDR or Rp)
    /(?:rp\.?|idr)\s*([\d.,]+)/i,
    // Currency postfix (e.g. 150,000 IDR)
    /([\d.,]+)\s*(?:idr|rupiah)/i
  ];
  for (const regex of amountPatterns) {
    const matches = combinedContent.matchAll(new RegExp(regex.source, "gi"));
    for (const match of matches) {
      if (match && match[1]) {
        const parsedVal = parseCurrencyAmount(match[1]);
        if (parsedVal > 0) {
          amount = parsedVal;
          break;
        }
      }
    }
    if (amount > 0) break;
  }
  if (amount <= 0) {
    return {
      candidate: null,
      detectedType: "NO_TRANSACTION_AMOUNT",
      rejectedReason: "Nominal Rupiah (Rp/IDR) tidak dapat diekstrak secara valid dari isi surel",
      sender: senderEmail,
      subject,
      dateStr: dateStrFallback
    };
  }
  let dateStr = "";
  let timeStr;
  const dateMatch = combinedContent.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/) || combinedContent.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (dateMatch) {
    if (dateMatch[2] && /^\d+$/.test(dateMatch[2])) {
      const day = dateMatch[1].padStart(2, "0");
      const month = dateMatch[2].padStart(2, "0");
      const year = dateMatch[3];
      if (parseInt(year, 10) >= 2020 && parseInt(year, 10) <= 2030) {
        dateStr = `${year}-${month}-${day}`;
      }
    } else if (dateMatch[2]) {
      const day = dateMatch[1].padStart(2, "0");
      const monthName = dateMatch[2].toLowerCase();
      const year = dateMatch[3];
      const monthMap = {
        jan: "01",
        januari: "01",
        january: "01",
        feb: "02",
        februari: "02",
        february: "02",
        mar: "03",
        maret: "03",
        march: "03",
        apr: "04",
        april: "04",
        mei: "05",
        may: "05",
        jun: "06",
        juni: "06",
        june: "06",
        jul: "07",
        juli: "07",
        july: "07",
        agu: "08",
        agt: "08",
        agustus: "08",
        aug: "08",
        august: "08",
        sep: "09",
        september: "09",
        okt: "10",
        oktober: "10",
        oct: "10",
        october: "10",
        nov: "11",
        november: "11",
        des: "12",
        desember: "12",
        dec: "12",
        december: "12"
      };
      const foundMonth = monthMap[monthName.slice(0, 3)] || monthMap[monthName];
      if (foundMonth && parseInt(year, 10) >= 2020 && parseInt(year, 10) <= 2030) {
        dateStr = `${year}-${foundMonth}-${day}`;
      }
    }
  }
  const timeMatch = combinedContent.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }
  if (!dateStr) {
    dateStr = formatJakartaDate(dateObj);
  }
  if (!timeStr) {
    timeStr = formatJakartaTime(dateObj);
  }
  let description = "Transaksi BCA";
  if (/cash withdrawal/i.test(subject) || /cash withdrawal/i.test(lowerContent)) {
    const locMatch = combinedContent.match(/(?:location|atm\s*location|lokasi|atm)\s*[:=]\s*([^\n\r]+)/i);
    if (locMatch && locMatch[1]) {
      description = `Tarik Tunai ATM BCA - ${locMatch[1].trim().replace(/\s+/g, " ").slice(0, 30)}`;
    } else {
      description = "Tarik Tunai ATM BCA";
    }
  } else if (/internet transaction journal/i.test(subject) || /internet transaction journal/i.test(lowerContent)) {
    const beneMatch = combinedContent.match(/(?:beneficiary\s+name|penerima|nama\s+penerima|merchant(?:\s+name)?|nama\s+toko|biller(?:\s+name)?|to\s+account)\s*[:=]\s*([^\n\r]+)/i) || combinedContent.match(/(?:transfer\s+to|pembayaran\s+ke|payment\s+to)\s*[:=]?\s*([^\n\r]+)/i) || combinedContent.match(/(?:remark|keterangan|keperluan)\s*[:=]\s*([^\n\r]+)/i);
    if (beneMatch && beneMatch[1]) {
      const raw = beneMatch[1].trim().replace(/\s+/g, " ");
      if (raw.length > 2) {
        description = raw.slice(0, 60);
      }
    } else {
      description = "Internet Banking BCA";
    }
  } else {
    const descMatch = combinedContent.match(
      /(?:keterangan|keperluan|pembayaran|tujuan|berita|merchant|nama merchant|nama toko|nama penerima|penerima)\s*[:=]\s*([^\n\r]+)/i
    ) || combinedContent.match(
      /(?:ke|dari)\s+([A-Za-z0-9\s.,&'-]+?)(?:\s+sebesar|\s+pada|\.|\n)/i
    );
    if (descMatch && descMatch[1]) {
      const rawDesc = descMatch[1].trim().replace(/\s+/g, " ");
      if (rawDesc.length > 2) {
        description = rawDesc.slice(0, 60);
      }
    } else if (/qris/i.test(lowerContent)) {
      description = "Pembayaran QRIS BCA";
    } else if (/virtual account| va /i.test(lowerContent)) {
      description = "Pembayaran BCA Virtual Account";
    } else if (/transfer/i.test(lowerContent)) {
      description = type === "income" ? "Transfer Masuk BCA" : "Transfer Keluar BCA";
    } else if (/debet|debit/i.test(lowerContent)) {
      description = "Debit Rekening BCA";
    }
  }
  let category = type === "income" ? "Gaji" : "Tagihan";
  const lowerContext = `${description} ${subject} ${snippet}`.toLowerCase();
  if (/makan|kopi|resto|cafe|food|kuliner|gofood|grabfood|bakso|ayam|mie|starbucks|mcd|kfc/i.test(lowerContext)) {
    category = "Makanan";
  } else if (/grab|gojek|mrt|bensin|pertamina|shell|toll|tarif tol|parkir|kereta|kai/i.test(lowerContext)) {
    category = "Transportasi";
  } else if (/tokopedia|shopee|lazada|blibli|belanja|mall|indomaret|alfamart|supermarket|mart|purchase/i.test(lowerContext)) {
    category = "Belanja";
  } else if (/listrik|pln|pdam|wifi|indihome|pulsa|telkom|bpjs|kartu kredit|asuransi|bill|tagihan|payment/i.test(lowerContext)) {
    category = "Tagihan";
  } else if (/netflix|spotify|bioskop|cgv|xxi|game|steam|playstation/i.test(lowerContext)) {
    category = "Hiburan";
  } else if (/apotek|kimia farma|k24|klinik|rs|rumah sakit|halodoc/i.test(lowerContext)) {
    category = "Kesehatan";
  } else if (/gaji|payroll|salary/i.test(lowerContext)) {
    category = "Gaji";
  } else if (/investasi|reksa dana|saham|bibit|ajaib|bareksa/i.test(lowerContext)) {
    category = "Investasi";
  }
  const candidate = {
    messageId,
    threadId,
    date: dateStr,
    time: timeStr,
    type,
    amount,
    description,
    category,
    account: "BCA",
    sender: senderEmail,
    subject: subject.slice(0, 80),
    alreadyImported: false,
    notes: `Diimpor otomatis dari email BCA (${senderEmail})`
  };
  return {
    candidate,
    detectedType: "TRANSACTION",
    sender: senderEmail,
    subject,
    dateStr
  };
}

// server/gmail/crypto.ts
import crypto2 from "crypto";
var ALGORITHM = "aes-256-gcm";
var SALT = "catat-gmail-oauth-salt-v1";
function getDerivedKey() {
  const secret = process.env.GOOGLE_CLIENT_SECRET || "catat-secure-default-secret-fallback";
  return crypto2.scryptSync(secret, SALT, 32);
}
function encryptData(plaintext) {
  const key = getDerivedKey();
  const iv = crypto2.randomBytes(12);
  const cipher = crypto2.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return {
    ciphertext: encrypted,
    iv: iv.toString("hex"),
    tag
  };
}
function decryptData(payload) {
  const key = getDerivedKey();
  const iv = Buffer.from(payload.iv, "hex");
  const tag = Buffer.from(payload.tag, "hex");
  const decipher = crypto2.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(payload.ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// server/gmail/storage.ts
var memoryVault = null;
var serverSyncState = {
  lastSyncAt: null,
  importedCount: 0
};
function loadStoredTokens() {
  if (!memoryVault) return null;
  try {
    const rawJson = decryptData(memoryVault.payload);
    return JSON.parse(rawJson);
  } catch (err) {
    console.warn("Failed to decrypt vault tokens in server memory:", err);
    return null;
  }
}
function saveStoredTokens(data, userId = "owner") {
  const existing = loadStoredTokens() || {};
  const merged = {
    ...existing,
    ...data
  };
  const rawJson = JSON.stringify(merged);
  const encrypted = encryptData(rawJson);
  memoryVault = {
    payload: encrypted,
    email: merged.email || null,
    expiryDate: merged.expiryDate,
    userId,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function clearStoredTokens() {
  memoryVault = null;
}
function recordServerSyncMetadata(count) {
  serverSyncState.lastSyncAt = (/* @__PURE__ */ new Date()).toISOString();
  serverSyncState.importedCount += count;
  return { ...serverSyncState };
}
function getSafeConnectionStatus(firestoreSyncState) {
  const configured = isOAuthConfigured();
  const connected = Boolean(memoryVault);
  return {
    configured,
    connected,
    email: connected ? memoryVault?.email || process.env.GMAIL_USER_EMAIL || null : null,
    lastSyncAt: firestoreSyncState?.lastSyncAt || serverSyncState.lastSyncAt,
    importedCount: firestoreSyncState?.importedCount ?? serverSyncState.importedCount
  };
}

// server/gmail/routes.ts
var gmailRouter = Router();
async function getValidAccessToken() {
  const session = loadStoredTokens();
  if (!session || !session.accessToken && !session.refreshToken) {
    throw new Error("Gmail belum terhubung. Silakan hubungkan akun Gmail terlebih dahulu.");
  }
  if (session.accessToken && session.expiryDate && Date.now() < session.expiryDate - 6e4) {
    return session.accessToken;
  }
  if (session.refreshToken) {
    const refreshed = await refreshAccessToken(session.refreshToken);
    const newExpiry = refreshed.expires_in ? Date.now() + refreshed.expires_in * 1e3 : Date.now() + 3500 * 1e3;
    saveStoredTokens({
      accessToken: refreshed.access_token,
      expiryDate: newExpiry
    });
    return refreshed.access_token;
  }
  throw new Error("Sesi Gmail kedaluwarsa. Silakan putuskan dan hubungkan ulang akun Gmail.");
}
gmailRouter.get("/status", (req, res) => {
  const lastSyncAt = typeof req.query.lastSyncAt === "string" ? req.query.lastSyncAt : void 0;
  const importedCount = typeof req.query.importedCount === "string" ? parseInt(req.query.importedCount, 10) : void 0;
  const status = getSafeConnectionStatus({
    lastSyncAt,
    importedCount
  });
  res.json({
    success: true,
    ...status
  });
});
gmailRouter.get("/auth", (req, res) => {
  if (!isOAuthConfigured()) {
    return res.status(200).json({
      success: false,
      configured: false,
      message: "Integrasi Gmail belum dikonfigurasi."
    });
  }
  const redirectUri = getEffectiveRedirectUri(
    `${req.protocol}://${req.get("host")}`
  );
  const state = generateCsrfState();
  const authUrl = getAuthorizationUrl(redirectUri, state);
  if (req.query.redirect === "true") {
    return res.redirect(authUrl);
  }
  return res.json({
    success: true,
    configured: true,
    authUrl
  });
});
gmailRouter.get("/callback", async (req, res) => {
  const { code, error, state } = req.query;
  if (error) {
    return res.redirect("/?gmail_error=" + encodeURIComponent(String(error)));
  }
  if (!verifyAndConsumeCsrfState(state)) {
    return res.redirect("/?gmail_error=csrf_validation_failed");
  }
  if (!code || typeof code !== "string") {
    return res.redirect("/?gmail_error=missing_code");
  }
  try {
    const redirectUri = getEffectiveRedirectUri(
      `${req.protocol}://${req.get("host")}`
    );
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    let profileEmail;
    try {
      const profileRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`
          }
        }
      );
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        profileEmail = profileData.emailAddress;
      }
    } catch {
    }
    saveStoredTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expires_in ? Date.now() + tokens.expires_in * 1e3 : void 0,
      email: profileEmail || process.env.GMAIL_USER_EMAIL || "hitamdimas6@gmail.com"
    });
    return res.redirect("/?gmail_connected=true");
  } catch (err) {
    return res.redirect(
      "/?gmail_error=" + encodeURIComponent(err.message || "auth_exchange_failed")
    );
  }
});
gmailRouter.post("/disconnect", async (_req, res) => {
  const session = loadStoredTokens();
  if (session?.refreshToken || session?.accessToken) {
    const tokenToRevoke = session.refreshToken || session.accessToken;
    await revokeToken(tokenToRevoke).catch(() => {
    });
  }
  clearStoredTokens();
  res.json({
    success: true,
    message: "Koneksi Gmail berhasil diputuskan."
  });
});
async function handlePreviewRequest(req, res) {
  const emptyRejectionSummary = {
    PROMO: 0,
    SECURITY: 0,
    OTP: 0,
    BALANCE_ONLY: 0,
    NON_BCA: 0,
    NO_TRANSACTION_AMOUNT: 0,
    NO_TRANSACTION_KEYWORD: 0,
    PARSER_FORMAT_MISMATCH: 0,
    UNSUPPORTED_TRANSACTION_FORMAT: 0
  };
  if (!isOAuthConfigured()) {
    return res.status(200).json({
      success: false,
      connected: false,
      diagnosticStage: "GMAIL_NOT_CONNECTED",
      message: "Integrasi Gmail belum dikonfigurasi pada server.",
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
      lastSyncAt: null
    });
  }
  let accessToken;
  try {
    accessToken = await getValidAccessToken();
  } catch (err) {
    return res.status(200).json({
      success: false,
      connected: false,
      diagnosticStage: "GMAIL_AUTH_FAILED",
      message: err.message || "Gmail belum terhubung.",
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
      lastSyncAt: null
    });
  }
  const lookbackDays = Math.min(
    30,
    Math.max(1, parseInt(req.query.days || req.body?.days || "14", 10))
  );
  const maxResults = Math.min(
    30,
    Math.max(1, parseInt(req.query.max || req.body?.max || "20", 10))
  );
  let knownImportedIds = [];
  if (Array.isArray(req.body?.importedIds)) {
    knownImportedIds = req.body.importedIds.filter((id) => typeof id === "string");
  } else if (typeof req.query.importedIds === "string" && req.query.importedIds.trim()) {
    knownImportedIds = req.query.importedIds.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const importedSet = new Set(knownImportedIds);
  const query = buildBcaSearchQuery(lookbackDays);
  console.log(`[Gmail Sync] Searching with query: "${query}" (maxResults: ${maxResults})`);
  try {
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
      query
    )}&maxResults=${maxResults}`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!listRes.ok) {
      if (listRes.status === 401) {
        return res.status(401).json({
          success: false,
          connected: false,
          diagnosticStage: "GMAIL_AUTH_FAILED",
          message: "Otorisasi Gmail kedaluwarsa. Silakan hubungkan ulang Gmail.",
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
          lastSyncAt: null
        });
      }
      if (listRes.status === 429) {
        return res.status(429).json({
          success: false,
          connected: true,
          diagnosticStage: "SERVER_ERROR",
          message: "Batas kuota Gmail API tercapai. Silakan coba beberapa saat lagi.",
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
          lastSyncAt: null
        });
      }
      return res.status(listRes.status).json({
        success: false,
        connected: true,
        diagnosticStage: "SERVER_ERROR",
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
        lastSyncAt: null
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
        diagnosticStage: "NO_GMAIL_MESSAGES_FOUND",
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
        lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
        message: `Pemeriksaan selesai. Tidak ditemukan email dari BCA dalam rentang ${lookbackDays} hari terakhir.`
      });
    }
    const candidates = [];
    const rejectionDetails = [];
    const rejectionSummary = { ...emptyRejectionSummary };
    let bcaMessagesFound = 0;
    let skippedCount = 0;
    let alreadyImportedCount = 0;
    for (const item of messageHeaders) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      if (!msgRes.ok) {
        skippedCount++;
        continue;
      }
      const msgData = await msgRes.json();
      const headers = msgData.payload?.headers || [];
      const fromHeader = headers.find((h) => h.name.toLowerCase() === "from")?.value || "";
      const subjectHeader = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "";
      const internalDateMs = parseInt(msgData.internalDate || "0", 10);
      const snippet = msgData.snippet || "";
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
        const detected = parseResult.detectedType;
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
          reason: parseResult.rejectedReason || "Format tidak dikenali"
        });
        console.log(`[Gmail Classifier Rejected] ID: ${item.id} | Type: ${detected} | Reason: ${parseResult.rejectedReason} | Subject: "${subjectHeader}"`);
      }
    }
    const newCount = candidates.filter((c) => !c.alreadyImported).length;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    recordServerSyncMetadata(0);
    let diagnosticStage = "CANDIDATES_READY";
    let responseMessage = "";
    if (bcaMessagesFound === 0) {
      diagnosticStage = "NO_BCA_MESSAGES_FOUND";
      responseMessage = "Ditemukan email tetapi tidak ada yang berasal dari domain resmi BCA.";
    } else if (candidates.length === 0) {
      diagnosticStage = "ALL_REJECTED_BY_PARSER";
      const summaryParts = [];
      if (rejectionSummary.PROMO > 0) summaryParts.push(`${rejectionSummary.PROMO} promo`);
      if (rejectionSummary.SECURITY > 0) summaryParts.push(`${rejectionSummary.SECURITY} tips keamanan`);
      if (rejectionSummary.OTP > 0) summaryParts.push(`${rejectionSummary.OTP} OTP`);
      if (rejectionSummary.BALANCE_ONLY > 0) summaryParts.push(`${rejectionSummary.BALANCE_ONLY} saldo`);
      if (rejectionSummary.NO_TRANSACTION_AMOUNT > 0) summaryParts.push(`${rejectionSummary.NO_TRANSACTION_AMOUNT} tanpa nominal`);
      if (rejectionSummary.NO_TRANSACTION_KEYWORD > 0) summaryParts.push(`${rejectionSummary.NO_TRANSACTION_KEYWORD} non-transaksi`);
      const breakdown = summaryParts.length > 0 ? ` (${summaryParts.join(", ")})` : "";
      responseMessage = `Ditemukan ${bcaMessagesFound} email BCA, namun semuanya bukan mutasi transaksi baru${breakdown}.`;
    } else if (newCount === 0) {
      diagnosticStage = "ALL_ALREADY_IMPORTED";
      responseMessage = `Semua (${candidates.length}) notifikasi transaksi BCA pada periode ini sudah tercatat sebelumnya.`;
    } else {
      diagnosticStage = "CANDIDATES_READY";
      responseMessage = `Ditemukan ${newCount} transaksi BCA baru dari email siap dipratinjau.`;
    }
    console.log(`[Gmail Sync] Completed: ${newCount} new, ${alreadyImportedCount} already imported, ${rejectionDetails.length} rejected.`);
    const result = {
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
      message: responseMessage
    };
    return res.json(result);
  } catch (err) {
    console.error("[Gmail Sync Error]:", err);
    return res.status(500).json({
      success: false,
      connected: true,
      diagnosticStage: "SERVER_ERROR",
      message: `Kendala saat memeriksa email BCA: ${err.message || "Terjadi kesalahan sistem"}`,
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
      lastSyncAt: null
    });
  }
}
gmailRouter.get("/preview", handlePreviewRequest);
gmailRouter.post("/preview", handlePreviewRequest);
gmailRouter.get("/sync", handlePreviewRequest);
gmailRouter.post("/sync", handlePreviewRequest);
gmailRouter.post("/confirm-import", (req, res) => {
  const { count } = req.body;
  const finalCount = typeof count === "number" ? count : 0;
  const syncMeta = recordServerSyncMetadata(finalCount);
  return res.json({
    success: true,
    syncedCount: finalCount,
    lastSyncAt: syncMeta.lastSyncAt,
    importedCount: syncMeta.importedCount,
    message: `Sinkronisasi ${finalCount} transaksi BCA terkonfirmasi.`
  });
});

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const isProduction = process.env.NODE_ENV === "production";
  app.use(express.json());
  app.use("/api/gmail", gmailRouter);
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "catat-finance" });
  });
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Catat server running on port ${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
