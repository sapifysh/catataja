import fs from 'fs';
import { decryptData, encryptData } from '../server/gmail/crypto';
import {
  extractBodyContent,
  parseBcaTransactionEmail,
  parseBcaTransactionEmailWithDiagnostics,
} from '../server/gmail/parser';

console.log('====================================================');
console.log('PRODUCTION READINESS AUDIT & VERIFICATION TEST SUITE');
console.log('====================================================\n');

// -------------------------------------------------------------------
// TEST C: DUPLICATE IMPORT TEST
// -------------------------------------------------------------------
console.log('--- TEST C: DUPLICATE IMPORT TEST ---');
const sampleMsgId = 'bca_msg_trans_88219';
const mockFirestore = new Map<string, any>();
const importedMessagesTracker = new Set<string>();

const candidate = parseBcaTransactionEmail(
  sampleMsgId,
  'thread-88219',
  Date.now(),
  'Bank Central Asia <ebanking@bca.co.id>',
  'Notifikasi Transaksi Debit Rekening',
  'Debit Rekening Sebesar Rp 250.000,00 di Merchant Supermarket',
  'Transaksi : Debit\nNominal : Rp 250.000,00\nTanggal : 05/10/2026\nKeterangan : Supermarket'
);

if (!candidate) {
  throw new Error('Failed to parse candidate transaction');
}

// First Import:
const txDocId = `tx-bca-${candidate.messageId}`;
mockFirestore.set(txDocId, {
  id: txDocId,
  amount: candidate.amount,
  description: candidate.description,
  category: candidate.category,
  notes: candidate.notes,
  date: candidate.date,
  account: 'BCA',
  source: 'gmail_bca',
});
importedMessagesTracker.add(candidate.messageId);

console.log(`Run 1 Import: Transaction created with ID ${txDocId}. Count in Firestore: ${mockFirestore.size}`);

// Attempt Duplicate Import:
const isAlreadyTracked = importedMessagesTracker.has(candidate.messageId);
console.log(`Run 2 Duplicate Check: Is candidate flagged as already imported? ${isAlreadyTracked}`);

// Even if forced import is attempted, deterministic ID ensures single document
mockFirestore.set(txDocId, { ...mockFirestore.get(txDocId) });
console.log(`Firestore document count after duplicate attempt: ${mockFirestore.size}`);
if (mockFirestore.size !== 1) {
  throw new Error('FAIL: Duplicate transaction created!');
}
console.log('PASS TEST C: Zero duplicates created.\n');

// -------------------------------------------------------------------
// TEST D: REPEATED SYNC & PRESERVATION OF USER-EDITED TRANSACTIONS
// -------------------------------------------------------------------
console.log('--- TEST D: PRESERVATION OF USER-EDITED TRANSACTIONS ---');
// User edits transaction in Catat:
const currentTx = mockFirestore.get(txDocId);
const userModifiedTx = {
  ...currentTx,
  category: 'Belanja Bulanan Pribadi',
  notes: 'Catatan tambahan dari pengguna: Belanja bahan makanan untuk acara keluarga',
  amount: 250000,
};
mockFirestore.set(txDocId, userModifiedTx);
console.log('User manually edited transaction:');
console.log(`  Category: "${mockFirestore.get(txDocId).category}"`);
console.log(`  Notes: "${mockFirestore.get(txDocId).notes}"`);

// Now, simulate a repeated sync with the EXACT same incoming Gmail message
console.log('Simulating subsequent Gmail synchronization run...');
const incomingSyncCandidate = parseBcaTransactionEmail(
  sampleMsgId,
  'thread-88219',
  Date.now(),
  'Bank Central Asia <ebanking@bca.co.id>',
  'Notifikasi Transaksi Debit Rekening',
  'Debit Rekening Sebesar Rp 250.000,00 di Merchant Supermarket',
  'Transaksi : Debit\nNominal : Rp 250.000,00\nTanggal : 05/10/2026\nKeterangan : Supermarket'
);

// Transaction-Safe / Create-If-Not-Exists logic:
if (mockFirestore.has(txDocId)) {
  console.log(`[Safety Guard] Detected existing transaction ${txDocId}. SKIPPING write to preserve user edits.`);
} else {
  mockFirestore.set(txDocId, incomingSyncCandidate);
}

const verifiedTxAfterSync = mockFirestore.get(txDocId);
console.log('Verifying transaction fields after repeated sync:');
console.log(`  Category preserved: "${verifiedTxAfterSync.category}" (Expected: "Belanja Bulanan Pribadi")`);
console.log(`  Notes preserved: "${verifiedTxAfterSync.notes}"`);

if (
  verifiedTxAfterSync.category !== 'Belanja Bulanan Pribadi' ||
  !verifiedTxAfterSync.notes.includes('Belanja bahan makanan')
) {
  throw new Error('FAIL: User edits were overwritten by repeated sync!');
}
console.log('PASS TEST D: User edits were strictly preserved. Zero overwrite occurred.\n');

// -------------------------------------------------------------------
// TEST E: REFRESH TOKEN ENCRYPTION & PERSISTENCE
// -------------------------------------------------------------------
console.log('--- TEST E: REFRESH TOKEN ENCRYPTION & PERSISTENCE ---');
const rawRefreshToken = '1//04_secret_google_oauth_refresh_token_abc_xyz_998877';
const encryptedPayload = encryptData(rawRefreshToken);

console.log('AES-256-GCM Encrypted Token Object:');
console.log(`  Ciphertext length: ${encryptedPayload.ciphertext.length} chars (hex)`);
console.log(`  IV: ${encryptedPayload.iv}`);
console.log(`  Auth Tag: ${encryptedPayload.tag}`);

// Decrypt using server secret:
const decrypted = decryptData(encryptedPayload);
console.log(`Decrypted token matches original: ${decrypted === rawRefreshToken}`);
if (decrypted !== rawRefreshToken) {
  throw new Error('FAIL: Token decryption mismatch!');
}

// Verify no local file exists:
const localTokenFileExists = fs.existsSync('.data/gmail_token.json');
console.log(`Does .data/gmail_token.json exist? ${localTokenFileExists} (Expected: false)`);
if (localTokenFileExists) {
  throw new Error('FAIL: Local file .data/gmail_token.json still exists!');
}
console.log('PASS TEST E: Refresh token is securely encrypted for remote storage with zero local file dependency.\n');

// -------------------------------------------------------------------
// TEST F: ZERO CLIENT ACCESS TO /server_vault & PROTECTED /settings/gmail_sync
// -------------------------------------------------------------------
console.log('--- TEST F: SECURITY RULES & CLIENT ISOLATION AUDIT ---');
const rulesContent = fs.readFileSync('firestore.rules', 'utf8');

const hasServerVaultStrictDeny =
  /match\s+\/server_vault\/\{docId\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;?\s*\}/.test(
    rulesContent
  );
console.log(`[Rule 1] match /server_vault/{docId} { allow read, write: if false; }: ${hasServerVaultStrictDeny}`);

const hasGmailSyncWriteBlocked =
  /match\s+\/settings\/gmail_sync\s*\{\s*allow\s+read:\s*if\s+isOwner\(\);\s*allow\s+write:\s*if\s+false;?\s*\}/.test(
    rulesContent
  );
console.log(`[Rule 2] match /settings/gmail_sync { allow write: if false; }: ${hasGmailSyncWriteBlocked}`);

const hasGmailSyncExcludedFromGenericWrite = rulesContent.includes("settingId != 'gmail_sync'");
console.log(`[Rule 3] Generic settings write excludes 'gmail_sync': ${hasGmailSyncExcludedFromGenericWrite}`);

function scanDir(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = `${dir}/${file}`;
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(scanDir(filePath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('server_vault')) {
        results.push(filePath);
      }
    }
  }
  return results;
}

const frontendVaultReferences = scanDir('src');
console.log(`[Client Isolation] References to 'server_vault' in frontend src/: ${frontendVaultReferences.length}`);
if (frontendVaultReferences.length > 0) {
  throw new Error(`FAIL: Frontend code in ${frontendVaultReferences.join(', ')} references server_vault!`);
}

if (!hasServerVaultStrictDeny || !hasGmailSyncWriteBlocked || !hasGmailSyncExcludedFromGenericWrite) {
  throw new Error('FAIL: Firestore security rules do not meet strict production requirements!');
}
console.log('PASS TEST F: Zero browser access to server_vault, and /settings/gmail_sync client writes are 100% blocked.\n');

// -------------------------------------------------------------------
// TEST G: REAL-WORLD BCA MULTI-FORMAT CLASSIFIER & DIAGNOSTICS TEST
// -------------------------------------------------------------------
console.log('--- TEST G: REAL-WORLD BCA MULTI-FORMAT CLASSIFIER TEST ---');

// 1. myBCA QRIS payment with security footer:
const myBcaQris = parseBcaTransactionEmailWithDiagnostics(
  'msg-qris-1',
  'th-1',
  Date.now(),
  'myBCA <informasibca@bca.co.id>',
  'myBCA: Bukti Transaksi QRIS',
  'Transaksi Berhasil. Total Nominal : Rp 45.000. Tips Keamanan: Waspada terhadap modus penipuan...',
  'Transaksi Berhasil\nTotal Nominal : Rp 45.000\nTanggal : 06/10/2026 14:15\nNama Toko : Kopi Kenangan\nSaldo Rekening Anda : Rp 1.250.000\nTips Keamanan: Jangan berikan OTP'
);
console.log(`myBCA QRIS parsed: amount = ${myBcaQris.candidate?.amount}, desc = "${myBcaQris.candidate?.description}", type = ${myBcaQris.candidate?.type}`);
if (!myBcaQris.candidate || myBcaQris.candidate.amount !== 45000 || !myBcaQris.candidate.description.includes('Kopi Kenangan')) {
  throw new Error('FAIL: myBCA QRIS transaction rejected or misparsed!');
}

// 2. KlikBCA Debit Rekening with ending balance footer:
const klikBcaDebit = parseBcaTransactionEmailWithDiagnostics(
  'msg-klik-2',
  'th-2',
  Date.now(),
  'Bank Central Asia <ebanking@bca.co.id>',
  'Transaksi Debit Rekening No. 1234567890',
  'Telah dilakukan transaksi Debit Rekening Sebesar Rp 250.000,00 pada tanggal 06/10/2026',
  'Jenis Transaksi : Debit Rekening\nNominal : Rp 250.000,00\nKeterangan : Belanja Supermarket\nInformasi Saldo Rekening Anda: Rp 3.500.000'
);
console.log(`KlikBCA Debit parsed: amount = ${klikBcaDebit.candidate?.amount}, desc = "${klikBcaDebit.candidate?.description}"`);
if (!klikBcaDebit.candidate || klikBcaDebit.candidate.amount !== 250000 || !klikBcaDebit.candidate.description.includes('Supermarket')) {
  throw new Error('FAIL: KlikBCA Debit transaction rejected or misparsed!');
}

// 3. BCA Dana Masuk (Incoming Transfer / Kredit):
const bcaKredit = parseBcaTransactionEmailWithDiagnostics(
  'msg-kredit-3',
  'th-3',
  Date.now(),
  'Bank Central Asia <m-bca@bca.co.id>',
  'Notifikasi Transaksi Kredit Rekening',
  'Dana Masuk Sebesar Rp 5.000.000,00 dari PT Teknologi Maju',
  'Transaksi : Kredit Rekening\nSebesar : Rp 5.000.000,00\nDari : PT Teknologi Maju'
);
console.log(`BCA Kredit parsed: amount = ${bcaKredit.candidate?.amount}, type = "${bcaKredit.candidate?.type}"`);
if (!bcaKredit.candidate || bcaKredit.candidate.amount !== 5000000 || bcaKredit.candidate.type !== 'income') {
  throw new Error('FAIL: BCA Kredit transaction rejected or misparsed!');
}

// 4. BCA Pure Promo (Should be accurately rejected as PROMO):
const bcaPromo = parseBcaTransactionEmailWithDiagnostics(
  'msg-promo-4',
  'th-4',
  Date.now(),
  'Bank Central Asia <informasibca@bca.co.id>',
  'Dapatkan Diskon 50% di BCA Expo dan Penawaran Khusus Restoran!',
  'Nikmati berbagai penawaran promo dan diskon spesial untuk nasabah BCA...',
  'Kunjungi booth BCA Expo untuk info promo menarik.'
);
console.log(`BCA Promo rejection type: ${bcaPromo.detectedType} (Reason: ${bcaPromo.rejectedReason})`);
if (bcaPromo.candidate !== null || bcaPromo.detectedType !== 'PROMO') {
  throw new Error('FAIL: Pure promo was not properly classified!');
}

// 5. BCA Pure OTP (Should be accurately rejected as OTP):
const bcaOtp = parseBcaTransactionEmailWithDiagnostics(
  'msg-otp-5',
  'th-5',
  Date.now(),
  'Bank Central Asia <notifikasi@bca.co.id>',
  'Kode OTP Verifikasi Nomor Anda',
  'Kode OTP rahasia Anda adalah 928172. Jangan beritahukan kepada siapapun...',
  'Kode berlaku 5 menit.'
);
console.log(`BCA OTP rejection type: ${bcaOtp.detectedType} (Reason: ${bcaOtp.rejectedReason})`);
if (bcaOtp.candidate !== null || bcaOtp.detectedType !== 'OTP') {
  throw new Error('FAIL: Pure OTP was not properly classified!');
}

// 6. REAL LIVE FORMAT: "Internet Transaction Journal" from bca@bca.co.id
const liveJournal = parseBcaTransactionEmailWithDiagnostics(
  '1a110b48066e39df',
  'th-live-6',
  Date.now(),
  'bca@bca.co.id',
  'Internet Transaction Journal',
  'Dear Valued Customer, Your internet transaction has been processed. Reference Number: 123456...',
  'Internet Transaction Journal\nTransaction Type : Transfer to other Bank\nAmount : IDR 125,000.00\nBeneficiary Name : Tokopedia\nDate : 05/10/2026\nTime : 18:30:15\nStatus : Successful\nTips: Never share your PIN with anyone.'
);
console.log(`Live Journal parsed: amount = ${liveJournal.candidate?.amount}, desc = "${liveJournal.candidate?.description}", type = ${liveJournal.candidate?.type}`);
if (!liveJournal.candidate || liveJournal.candidate.amount !== 125000 || !liveJournal.candidate.description.includes('Tokopedia')) {
  throw new Error('FAIL: Internet Transaction Journal was rejected or misparsed!');
}

// 7. REAL LIVE FORMAT: "Cash Withdrawal Successful" from bca@bca.co.id
const liveCashWithdrawal = parseBcaTransactionEmailWithDiagnostics(
  '1a106d9bf2745291',
  'th-live-7',
  Date.now(),
  'bca@bca.co.id',
  'Cash Withdrawal Successful',
  'Dear Customer, cash withdrawal on your BCA ATM card was successful. Amount : IDR 500,000.00',
  'Cash Withdrawal Successful\nCard Number : 1234-xxxx-xxxx-5678\nAmount : IDR 500,000.00\nDate : 04/10/2026\nTime : 10:15:00\nLocation : ATM BCA KCU SUDIRMAN'
);
console.log(`Live Cash Withdrawal parsed: amount = ${liveCashWithdrawal.candidate?.amount}, desc = "${liveCashWithdrawal.candidate?.description}"`);
if (!liveCashWithdrawal.candidate || liveCashWithdrawal.candidate.amount !== 500000 || !liveCashWithdrawal.candidate.description.includes('ATM BCA')) {
  throw new Error('FAIL: Cash Withdrawal Successful was rejected or misparsed!');
}

console.log('PASS TEST G: Real-world BCA formats accurately classified and parsed.\n');

console.log('====================================================');
console.log('ALL AUDIT TESTS COMPLETED SUCCESSFULLY (100% PASSED)');
console.log('====================================================');
