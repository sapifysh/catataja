import { BcaCandidateTransaction, DiagnosticCategory } from './types';

/**
 * Builds a search query for BCA emails within lookbackDays (with 1-day safety margin for timezones).
 * Uses 'from:bca.co.id' to ensure we do not miss legitimate subdomains or sender aliases.
 */
export function buildBcaSearchQuery(lookbackDays: number = 14): string {
  const d = new Date();
  d.setDate(d.getDate() - (lookbackDays + 1));
  const afterDate = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

  return `from:bca.co.id after:${afterDate}`;
}

/**
 * Extracts clean email address from RFC 2822 'From' header string.
 */
export function extractSenderEmail(fromHeader: string): string {
  if (!fromHeader) return '';
  const match = fromHeader.match(/<([^>]+)>/);
  if (match && match[1]) {
    return match[1].trim().toLowerCase();
  }
  return fromHeader.trim().toLowerCase();
}

/**
 * Verifies that the sender email belongs to the official BCA domain (@bca.co.id or subdomains).
 */
export function isVerifiedBcaSender(senderEmail: string): boolean {
  if (!senderEmail) return false;
  return senderEmail.endsWith('@bca.co.id') || senderEmail.includes('.bca.co.id');
}

/**
 * Formats a Date object or timestamp into Asia/Jakarta YYYY-MM-DD.
 */
export function formatJakartaDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Formats a Date object or timestamp into Asia/Jakarta HH:mm.
 */
export function formatJakartaTime(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Recursively extracts plain text and HTML text from Gmail payload, converting HTML tables
 * and layouts into structured plain text so amounts, labels, and table cells are fully preserved.
 */
export function extractBodyContent(payload: any): string {
  let plain = '';
  let html = '';

  function traverse(part: any) {
    if (!part) return;

    if (part.mimeType === 'text/plain' && part.body?.data) {
      try {
        const decoded = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        plain += '\n' + decoded;
      } catch {}
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      try {
        const decoded = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        html += '\n' + decoded;
      } catch {}
    }

    if (Array.isArray(part.parts)) {
      for (const p of part.parts) {
        traverse(p);
      }
    }
  }

  traverse(payload);

  let convertedHtml = '';
  if (html) {
    convertedHtml = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/(p|div|tr|h\d)>/gi, '\n')
      .replace(/<\/td>/gi, '  ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\r/g, '')
      .replace(/[ \t]+/g, ' ');
  }

  return `${plain}\n${convertedHtml}`.trim();
}

/**
 * Robust Indonesian & International currency number parser.
 */
export function parseCurrencyAmount(rawStr: string): number {
  if (!rawStr) return 0;
  let clean = rawStr.trim();

  // Avoid pure account numbers, phone numbers or reference IDs (e.g. 10+ pure digits with no separators)
  if (/^\d{8,}$/.test(clean)) {
    return 0;
  }

  // Format 1: 150,000.00 (International format with decimals)
  if (/^\d{1,3}(,\d{3})+(\.\d{2})?$/.test(clean)) {
    clean = clean.replace(/,/g, '');
  }
  // Format 2: 150.000,00 (Indonesian format with decimals)
  else if (/^\d{1,3}(\.\d{3})+(,\d{2})?$/.test(clean)) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  }
  // Format 3: 150,000 (Comma thousands, no decimals)
  else if (/^\d{1,3}(,\d{3})+$/.test(clean)) {
    clean = clean.replace(/,/g, '');
  }
  // Format 4: 150.000 (Dot thousands, no decimals)
  else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    clean = clean.replace(/\./g, '');
  }
  // Format 5: Arbitrary string with comma as 2-digit decimals
  else if (clean.includes(',') && clean.split(',')[1].length === 2) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  }
  // Format 6: Arbitrary string with dot as 2-digit decimals
  else if (clean.includes('.') && clean.split('.')[1].length === 2) {
    clean = clean.replace(/,/g, '');
  } else {
    clean = clean.replace(/[.,]/g, '');
  }

  const parsed = Math.round(parseFloat(clean));
  return !isNaN(parsed) && parsed >= 500 && parsed <= 1_000_000_000 ? parsed : 0;
}

export interface ParseResultWithDiagnostics {
  candidate: BcaCandidateTransaction | null;
  detectedType: DiagnosticCategory | 'TRANSACTION';
  rejectedReason?: string;
  sender: string;
  subject: string;
  dateStr: string;
}

/**
 * Intelligent transaction classifier & parser for BCA emails.
 * Supports:
 * - "Internet Transaction Journal" (KlikBCA / BCA e-Banking English & Indonesian)
 * - "Cash Withdrawal Successful" (BCA ATM cash withdrawal)
 * - "myBCA: Bukti Transaksi QRIS / Transfer / Pembayaran"
 * - "Notifikasi Transaksi BCA Mobile (m-BCA)"
 * - "Notifikasi Transaksi Debit Rekening"
 * - "Notifikasi Transaksi Kredit Rekening / Dana Masuk"
 * - "Bukti Pembayaran BCA Virtual Account"
 * - "Notifikasi Transaksi Kartu Kredit BCA"
 */
export function parseBcaTransactionEmailWithDiagnostics(
  messageId: string,
  threadId: string,
  internalDateMs: number,
  fromHeader: string,
  subject: string,
  snippet: string,
  bodyText: string
): ParseResultWithDiagnostics {
  const senderEmail = extractSenderEmail(fromHeader);
  const dateObj = internalDateMs > 0 ? new Date(internalDateMs) : new Date();
  const dateStrFallback = formatJakartaDate(dateObj);

  // 1. Verify Sender
  if (!isVerifiedBcaSender(senderEmail)) {
    return {
      candidate: null,
      detectedType: 'NON_BCA',
      rejectedReason: `Bukan alamat domain resmi BCA (${senderEmail || 'tidak dikenal'})`,
      sender: senderEmail,
      subject,
      dateStr: dateStrFallback,
    };
  }

  const combinedContent = `${subject}\n${snippet}\n${bodyText}`.replace(/\r/g, '');
  const lowerContent = combinedContent.toLowerCase();
  const lowerSubject = subject.toLowerCase();

  // 2. Check for explicit OTP notifications (security codes without financial mutation)
  if (
    /kode otp|one time password|verifikasi nomor|aktivasi akun|ganti pin|ganti password|verifikasi email/i.test(
      lowerSubject
    ) &&
    !/berhasil|journal|withdrawal|debet|debit|kredit|sebesar|nominal|amount/i.test(lowerSubject)
  ) {
    return {
      candidate: null,
      detectedType: 'OTP',
      rejectedReason: 'Notifikasi kode OTP / keamanan verifikasi akun',
      sender: senderEmail,
      subject,
      dateStr: dateStrFallback,
    };
  }

  // 3. Check for pure promotional or marketing newsletters (no financial mutation)
  const isPurePromo =
    /promo|diskon|cashback|penawaran khusus|bca expo|katalog|reward bca/i.test(lowerSubject) &&
    !/journal|withdrawal|transaksi|debet|debit|kredit|transfer|pembayaran|qris|sebesar|nominal|amount|tagihan/i.test(
      lowerSubject
    );

  if (isPurePromo) {
    return {
      candidate: null,
      detectedType: 'PROMO',
      rejectedReason: 'Surel promosi/penawaran BCA tanpa mutasi rekening',
      sender: senderEmail,
      subject,
      dateStr: dateStrFallback,
    };
  }

  // 4. Check for pure balance enquiry without transaction mutation
  const isPureBalance =
    /informasi saldo|saldo rekening|cek saldo/i.test(lowerSubject) &&
    !/journal|withdrawal|transaksi|debet|debit|kredit|transfer|pembayaran|sebesar|nominal|amount/i.test(
      lowerSubject
    );

  if (isPureBalance) {
    return {
      candidate: null,
      detectedType: 'BALANCE_ONLY',
      rejectedReason: 'Informasi saldo rekening tanpa mutasi nominal debit/kredit',
      sender: senderEmail,
      subject,
      dateStr: dateStrFallback,
    };
  }

  // 5. Confirm presence of transaction markers (Bilingual: Indonesian & English)
  const hasTxMarkers =
    /internet transaction journal|cash withdrawal|journal|transaksi|rekening|debet|debit|kredit|transfer|pembayaran|payment|purchase|qris|m-bca|klikbca|mybca|mutasi|tagihan|tarik tunai|setoran|edc|virtual account|beneficiary|penerima|merchant|amount|berhasil|successful/i.test(
      lowerContent
    );

  if (!hasTxMarkers) {
    return {
      candidate: null,
      detectedType: 'NO_TRANSACTION_KEYWORD',
      rejectedReason: 'Tidak memuat kata kunci mutasi atau bukti transaksi finansial',
      sender: senderEmail,
      subject,
      dateStr: dateStrFallback,
    };
  }

  // 6. Determine transaction type (income vs expense)
  let type: 'expense' | 'income' = 'expense';
  if (
    /kredit|dana masuk|transfer masuk|terima transfer|setoran tunai|penerimaan dana|credit to/i.test(
      lowerContent
    )
  ) {
    type = 'income';
  } else {
    type = 'expense';
  }

  // 7. Parse Amount in IDR (Bilingual: Supports Indonesian & English BCA formats)
  // Matches:
  // - "Amount : IDR 150,000.00"
  // - "Amount : 150,000.00"
  // - "Nominal : Rp 150.000,00"
  // - "Withdrawal Amount : IDR 500,000.00"
  // - "Total Nominal : Rp 45.000"
  // - "Sebesar : Rp. 100.000"
  let amount = 0;
  const amountPatterns = [
    // Labeled amounts (English & Indonesian)
    /(?:withdrawal\s+amount|transaction\s+amount|transfer\s+amount|purchase\s+amount|payment\s+amount|total\s+amount|total\s+nominal|nominal(?:\s+transaksi)?|jumlah(?:\s+transaksi)?|amount|sebesar|nilai|total)\s*[:=]?\s*(?:rp\.?|idr)?\s*([\d.,]+)/i,
    // Explicit currency prefix (IDR or Rp)
    /(?:rp\.?|idr)\s*([\d.,]+)/i,
    // Currency postfix (e.g. 150,000 IDR)
    /([\d.,]+)\s*(?:idr|rupiah)/i,
  ];

  for (const regex of amountPatterns) {
    const matches = combinedContent.matchAll(new RegExp(regex.source, 'gi'));
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
      detectedType: 'NO_TRANSACTION_AMOUNT',
      rejectedReason: 'Nominal Rupiah (Rp/IDR) tidak dapat diekstrak secara valid dari isi surel',
      sender: senderEmail,
      subject,
      dateStr: dateStrFallback,
    };
  }

  // 8. Parse Date in Asia/Jakarta
  let dateStr = '';
  let timeStr: string | undefined;

  // Date patterns:
  // - DD/MM/YYYY or DD-MM-YYYY
  // - DD Month YYYY (e.g. 05 Oct 2026 or 05 Oktober 2026)
  const dateMatch =
    combinedContent.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/) ||
    combinedContent.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);

  if (dateMatch) {
    if (dateMatch[2] && /^\d+$/.test(dateMatch[2])) {
      const day = dateMatch[1].padStart(2, '0');
      const month = dateMatch[2].padStart(2, '0');
      const year = dateMatch[3];
      if (parseInt(year, 10) >= 2020 && parseInt(year, 10) <= 2030) {
        dateStr = `${year}-${month}-${day}`;
      }
    } else if (dateMatch[2]) {
      const day = dateMatch[1].padStart(2, '0');
      const monthName = dateMatch[2].toLowerCase();
      const year = dateMatch[3];
      const monthMap: Record<string, string> = {
        jan: '01', januari: '01', january: '01',
        feb: '02', februari: '02', february: '02',
        mar: '03', maret: '03', march: '03',
        apr: '04', april: '04',
        mei: '05', may: '05',
        jun: '06', juni: '06', june: '06',
        jul: '07', juli: '07', july: '07',
        agu: '08', agt: '08', agustus: '08', aug: '08', august: '08',
        sep: '09', september: '09',
        okt: '10', oktober: '10', oct: '10', october: '10',
        nov: '11', november: '11',
        des: '12', desember: '12', dec: '12', december: '12',
      };
      const foundMonth = monthMap[monthName.slice(0, 3)] || monthMap[monthName];
      if (foundMonth && parseInt(year, 10) >= 2020 && parseInt(year, 10) <= 2030) {
        dateStr = `${year}-${foundMonth}-${day}`;
      }
    }
  }

  // Time pattern: HH:mm[:ss]
  const timeMatch = combinedContent.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  // Fallback to internalDate in Asia/Jakarta if not found in body
  if (!dateStr) {
    dateStr = formatJakartaDate(dateObj);
  }
  if (!timeStr) {
    timeStr = formatJakartaTime(dateObj);
  }

  // 9. Parse Description / Merchant / Beneficiary
  let description = 'Transaksi BCA';

  if (/cash withdrawal/i.test(subject) || /cash withdrawal/i.test(lowerContent)) {
    const locMatch = combinedContent.match(/(?:location|atm\s*location|lokasi|atm)\s*[:=]\s*([^\n\r]+)/i);
    if (locMatch && locMatch[1]) {
      description = `Tarik Tunai ATM BCA - ${locMatch[1].trim().replace(/\s+/g, ' ').slice(0, 30)}`;
    } else {
      description = 'Tarik Tunai ATM BCA';
    }
  } else if (/internet transaction journal/i.test(subject) || /internet transaction journal/i.test(lowerContent)) {
    const beneMatch =
      combinedContent.match(/(?:beneficiary\s+name|penerima|nama\s+penerima|merchant(?:\s+name)?|nama\s+toko|biller(?:\s+name)?|to\s+account)\s*[:=]\s*([^\n\r]+)/i) ||
      combinedContent.match(/(?:transfer\s+to|pembayaran\s+ke|payment\s+to)\s*[:=]?\s*([^\n\r]+)/i) ||
      combinedContent.match(/(?:remark|keterangan|keperluan)\s*[:=]\s*([^\n\r]+)/i);

    if (beneMatch && beneMatch[1]) {
      const raw = beneMatch[1].trim().replace(/\s+/g, ' ');
      if (raw.length > 2) {
        description = raw.slice(0, 60);
      }
    } else {
      description = 'Internet Banking BCA';
    }
  } else {
    const descMatch =
      combinedContent.match(
        /(?:keterangan|keperluan|pembayaran|tujuan|berita|merchant|nama merchant|nama toko|nama penerima|penerima)\s*[:=]\s*([^\n\r]+)/i
      ) ||
      combinedContent.match(
        /(?:ke|dari)\s+([A-Za-z0-9\s.,&'-]+?)(?:\s+sebesar|\s+pada|\.|\n)/i
      );

    if (descMatch && descMatch[1]) {
      const rawDesc = descMatch[1].trim().replace(/\s+/g, ' ');
      if (rawDesc.length > 2) {
        description = rawDesc.slice(0, 60);
      }
    } else if (/qris/i.test(lowerContent)) {
      description = 'Pembayaran QRIS BCA';
    } else if (/virtual account| va /i.test(lowerContent)) {
      description = 'Pembayaran BCA Virtual Account';
    } else if (/transfer/i.test(lowerContent)) {
      description = type === 'income' ? 'Transfer Masuk BCA' : 'Transfer Keluar BCA';
    } else if (/debet|debit/i.test(lowerContent)) {
      description = 'Debit Rekening BCA';
    }
  }

  // 10. Intelligent Categorization
  let category = type === 'income' ? 'Gaji' : 'Tagihan';
  const lowerContext = `${description} ${subject} ${snippet}`.toLowerCase();

  if (/makan|kopi|resto|cafe|food|kuliner|gofood|grabfood|bakso|ayam|mie|starbucks|mcd|kfc/i.test(lowerContext)) {
    category = 'Makanan';
  } else if (/grab|gojek|mrt|bensin|pertamina|shell|toll|tarif tol|parkir|kereta|kai/i.test(lowerContext)) {
    category = 'Transportasi';
  } else if (/tokopedia|shopee|lazada|blibli|belanja|mall|indomaret|alfamart|supermarket|mart|purchase/i.test(lowerContext)) {
    category = 'Belanja';
  } else if (/listrik|pln|pdam|wifi|indihome|pulsa|telkom|bpjs|kartu kredit|asuransi|bill|tagihan|payment/i.test(lowerContext)) {
    category = 'Tagihan';
  } else if (/netflix|spotify|bioskop|cgv|xxi|game|steam|playstation/i.test(lowerContext)) {
    category = 'Hiburan';
  } else if (/apotek|kimia farma|k24|klinik|rs|rumah sakit|halodoc/i.test(lowerContext)) {
    category = 'Kesehatan';
  } else if (/gaji|payroll|salary/i.test(lowerContext)) {
    category = 'Gaji';
  } else if (/investasi|reksa dana|saham|bibit|ajaib|bareksa/i.test(lowerContext)) {
    category = 'Investasi';
  }

  const candidate: BcaCandidateTransaction = {
    messageId,
    threadId,
    date: dateStr,
    time: timeStr,
    type,
    amount,
    description,
    category,
    account: 'BCA',
    sender: senderEmail,
    subject: subject.slice(0, 80),
    alreadyImported: false,
    notes: `Diimpor otomatis dari email BCA (${senderEmail})`,
  };

  return {
    candidate,
    detectedType: 'TRANSACTION',
    sender: senderEmail,
    subject,
    dateStr,
  };
}

/**
 * Legacy compatibility wrapper.
 */
export function parseBcaTransactionEmail(
  messageId: string,
  threadId: string,
  internalDateMs: number,
  fromHeader: string,
  subject: string,
  snippet: string,
  bodyText: string
): BcaCandidateTransaction | null {
  return parseBcaTransactionEmailWithDiagnostics(
    messageId,
    threadId,
    internalDateMs,
    fromHeader,
    subject,
    snippet,
    bodyText
  ).candidate;
}
