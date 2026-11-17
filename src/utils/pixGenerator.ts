import QRCode from 'qrcode';
import type { jsPDF } from 'jspdf';

export interface PixPayloadInput {
  pixKey: string;
  merchantName: string;
  merchantCity?: string;
  amount?: number;
  txId?: string;
}

function emvField(id: string, value: string): string {
  const length = String(value.length).padStart(2, '0');
  return `${id}${length}${value}`;
}

function sanitizeAscii(text: string, maxLength: number): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function normalizePixKey(rawKey: string): string {
  const trimmed = (rawKey || '').trim();
  if (!trimmed) return '';

  // E-mail
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }

  // Chave aleatória (UUID)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // Telefone já em formato internacional (+55...)
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  }

  const digits = trimmed.replace(/\D/g, '');

  // CPF (com pontos/traço) ou CNPJ (14 dígitos) -> somente dígitos
  if (trimmed.includes('.') || trimmed.includes('/')) {
    return digits;
  }

  // Se tem 11 dígitos e parece celular brasileiro (DDD 11-99 e 3º dígito 9), garanta prefixo +55
  if (digits.length === 11) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    const thirdDigit = digits[2];
    if (ddd >= 11 && ddd <= 99 && thirdDigit === '9') {
      return `+55${digits}`;
    }
    return digits;
  }

  if (digits.length === 12 || digits.length === 13) {
    if (digits.startsWith('55') && digits.length === 13) {
      return `+${digits}`;
    }
    return digits;
  }

  if (digits.length === 14) {
    return digits;
  }

  return trimmed;
}

/**
 * Calcula CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
 * conforme padrão oficial EMV / BR Code do Banco Central do Brasil.
 */
export function crc16Ccitt(payload: string): string {
  const bytes = new TextEncoder().encode(payload);
  let crc = 0xffff;

  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Gera o payload oficial Pix BR Code / EMV ("Pix Copia e Cola")
 * válido para leitura em qualquer banco brasileiro.
 */
export function generatePixPayload({
  pixKey,
  merchantName,
  merchantCity,
  amount,
}: PixPayloadInput): string {
  const normalizedKey = normalizePixKey(pixKey);
  if (!normalizedKey) return '';

  const safeName = sanitizeAscii(merchantName || 'RECEBEDOR', 25).toUpperCase() || 'RECEBEDOR';
  const safeCity = sanitizeAscii(merchantCity || 'SAO PAULO', 15).toUpperCase() || 'SAO PAULO';

  const merchantAccountInfo =
    emvField('00', 'br.gov.bcb.pix') +
    emvField('01', normalizedKey);

  const numericAmount = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const amountField = numericAmount > 0 ? emvField('54', numericAmount.toFixed(2)) : '';

  const payloadWithoutCrc =
    emvField('00', '01') +
    emvField('01', '11') +
    emvField('26', merchantAccountInfo) +
    emvField('52', '0000') +
    emvField('53', '986') +
    amountField +
    emvField('58', 'BR') +
    emvField('59', safeName) +
    emvField('60', safeCity) +
    emvField('62', '0503***') +
    '6304';

  const crc = crc16Ccitt(payloadWithoutCrc);
  return `${payloadWithoutCrc}${crc}`;
}

export interface PixQrSvgData {
  size: number;
  pathD: string;
}

/**
 * Gera de forma síncrona e offline o path SVG do QR Code Pix,
 * ideal para renderização instantânea em tela e impressão (A4 / Térmica).
 */
export function buildPixQrSvgData(payload: string): PixQrSvgData | null {
  if (!payload) return null;
  try {
    const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const commands: string[] = [];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (data[r * size + c]) {
          commands.push(`M${c} ${r}h1v1h-1z`);
        }
      }
    }

    return {
      size,
      pathD: commands.join(''),
    };
  } catch (err) {
    console.error('[Pix QR SVG Error]:', err);
    return null;
  }
}

/**
 * Desenha o QR Code Pix vetorial de forma síncrona dentro de um documento jsPDF.
 */
export function drawPixQrInJsPdf(
  doc: jsPDF,
  payload: string,
  x: number,
  y: number,
  sizeMm: number
): boolean {
  if (!payload) return false;
  try {
    const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
    const moduleCount = qr.modules.size;
    const data = qr.modules.data;
    const quietZone = 1;
    const totalCells = moduleCount + quietZone * 2;
    const cellSize = sizeMm / totalCells;

    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, sizeMm, sizeMm, 'F');

    doc.setFillColor(15, 23, 42);
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (data[r * moduleCount + c]) {
          doc.rect(
            x + (c + quietZone) * cellSize,
            y + (r + quietZone) * cellSize,
            cellSize + 0.04,
            cellSize + 0.04,
            'F'
          );
        }
      }
    }
    return true;
  } catch (err) {
    console.error('[Pix QR jsPDF Error]:', err);
    return false;
  }
}

export async function generatePixDataUrl(payload: string, width = 200): Promise<string> {
  if (!payload) return '';
  try {
    return await QRCode.toDataURL(payload, {
      width,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('[Pix QR DataURL Error]:', err);
    return '';
  }
}
