import { CarneInstallment, CarneSale, CarneSettings } from '../types';
import { cleanNumeric, formatCurrency, formatDate, getLocalDateString } from './formatters';

const CARNES_STORAGE_KEY = 'neofix_carnes_v1';
const CARNE_SETTINGS_STORAGE_KEY = 'neofix_carne_settings_v1';

export const DEFAULT_CARNE_MESSAGE_TEMPLATE =
  'Olá [Cliente]! Lembramos que a parcela [X/Y] do seu carnê ([Produto]) no valor de [Valor], com vencimento em [Vencimento], está pendente. Qualquer dúvida estamos à disposição! - [Empresa]';

export function getCarneSettings(): CarneSettings {
  try {
    const raw = localStorage.getItem(CARNE_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        defaultCoverImage: parsed.defaultCoverImage || undefined,
        billingMessageTemplate:
          typeof parsed.billingMessageTemplate === 'string' && parsed.billingMessageTemplate.trim()
            ? parsed.billingMessageTemplate
            : DEFAULT_CARNE_MESSAGE_TEMPLATE,
      };
    }
  } catch (err) {
    console.warn('Erro ao ler configurações do carnê:', err);
  }
  return {
    defaultCoverImage: undefined,
    billingMessageTemplate: DEFAULT_CARNE_MESSAGE_TEMPLATE,
  };
}

export function saveCarneSettings(settings: CarneSettings): boolean {
  try {
    localStorage.setItem(CARNE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch (err) {
    console.error('Erro ao salvar configurações do carnê (verifique o tamanho da imagem):', err);
    return false;
  }
}

export function getCarnes(): CarneSale[] {
  try {
    const raw = localStorage.getItem(CARNES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Erro ao ler carnês salvos:', err);
    return [];
  }
}

export function saveCarnes(carnes: CarneSale[]): boolean {
  try {
    localStorage.setItem(CARNES_STORAGE_KEY, JSON.stringify(carnes));
    return true;
  } catch (err) {
    console.error('Erro ao salvar carnês:', err);
    return false;
  }
}

export function addMonthlyOffset(baseYmd: string, monthOffset: number): string {
  const parts = baseYmd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return baseYmd;
  }
  const [year, month, day] = parts;
  const targetZeroMonth = month - 1 + monthOffset;
  const targetYear = year + Math.floor(targetZeroMonth / 12);
  const normalizedMonth = ((targetZeroMonth % 12) + 12) % 12;
  const maxDaysInMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const clampedDay = Math.min(day, maxDaysInMonth);
  const mm = String(normalizedMonth + 1).padStart(2, '0');
  const dd = String(clampedDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

export function buildInstallmentsList(
  totalValue: number,
  installmentsCount: number,
  firstDueDate: string
): CarneInstallment[] {
  const count = Math.max(1, Math.min(24, Math.round(installmentsCount || 1)));
  const totalCents = Math.round((totalValue || 0) * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;

  const list: CarneInstallment[] = [];
  for (let i = 0; i < count; i++) {
    const cents = i === 0 ? baseCents + remainderCents : baseCents;
    list.push({
      number: i + 1,
      total: count,
      dueDate: addMonthlyOffset(firstDueDate, i),
      amount: cents / 100,
      paid: false,
    });
  }
  return list;
}

export function createCarneSale(input: {
  customerName: string;
  customerPhone: string;
  description: string;
  totalValue: number;
  installmentsCount: number;
  firstDueDate: string;
  coverImage?: string;
}): { carne: CarneSale; allCarnes: CarneSale[]; savedOk: boolean } {
  const count = Math.max(1, Math.min(24, Math.round(input.installmentsCount || 1)));
  const installments = buildInstallmentsList(input.totalValue, count, input.firstDueDate);
  const nextNum = 1000 + Math.floor(Math.random() * 8999);
  const carne: CarneSale = {
    id: `CARNE-${new Date().getFullYear()}-${nextNum}`,
    createdAt: new Date().toISOString(),
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    description: input.description.trim(),
    totalValue: Number(input.totalValue.toFixed(2)),
    installmentValue: Number((input.totalValue / count).toFixed(2)),
    installmentsCount: count,
    firstDueDate: input.firstDueDate,
    coverImage: input.coverImage || undefined,
    installments,
  };

  const current = getCarnes();
  const updated = [carne, ...current];
  const savedOk = saveCarnes(updated);
  return { carne, allCarnes: updated, savedOk };
}

export function toggleCarneInstallmentPaid(carneId: string, installmentNumber: number): CarneSale[] {
  const current = getCarnes();
  const updated = current.map((carne) => {
    if (carne.id !== carneId) return carne;
    return {
      ...carne,
      installments: carne.installments.map((inst) => {
        if (inst.number !== installmentNumber) return inst;
        const nextPaid = !inst.paid;
        return {
          ...inst,
          paid: nextPaid,
          paidAt: nextPaid ? new Date().toISOString() : undefined,
        };
      }),
    };
  });
  saveCarnes(updated);
  return updated;
}

export function deleteCarneSale(carneId: string): CarneSale[] {
  const updated = getCarnes().filter((c) => c.id !== carneId);
  saveCarnes(updated);
  return updated;
}

export interface CarneDueAlertItem {
  carne: CarneSale;
  installment: CarneInstallment;
  status: 'vencida' | 'hoje' | 'proxima';
  daysDiff: number;
}

export function getCarneDueAlerts(carnes: CarneSale[]): CarneDueAlertItem[] {
  const todayStr = getLocalDateString();
  const todayMs = new Date(`${todayStr}T00:00:00`).getTime();
  const alerts: CarneDueAlertItem[] = [];

  for (const carne of carnes) {
    for (const inst of carne.installments || []) {
      if (inst.paid) continue;
      const dueMs = new Date(`${inst.dueDate}T00:00:00`).getTime();
      if (Number.isNaN(dueMs)) continue;
      const diffDays = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        alerts.push({ carne, installment: inst, status: 'vencida', daysDiff: diffDays });
      } else if (diffDays === 0) {
        alerts.push({ carne, installment: inst, status: 'hoje', daysDiff: 0 });
      } else if (diffDays <= 3) {
        alerts.push({ carne, installment: inst, status: 'proxima', daysDiff: diffDays });
      }
    }
  }

  return alerts.sort((a, b) => a.daysDiff - b.daysDiff);
}

export function formatCarneWhatsAppMessage(
  template: string,
  carne: CarneSale,
  installment: CarneInstallment,
  companyName: string
): string {
  const parcelLabel = `${String(installment.number).padStart(2, '0')}/${String(installment.total).padStart(2, '0')}`;
  return (template || DEFAULT_CARNE_MESSAGE_TEMPLATE)
    .replace(/\[Cliente\]/gi, carne.customerName)
    .replace(/\[X\/Y\]/gi, parcelLabel)
    .replace(/\[Parcela\]/gi, parcelLabel)
    .replace(/\[Valor\]/gi, formatCurrency(installment.amount))
    .replace(/\[Vencimento\]/gi, formatDate(installment.dueDate))
    .replace(/\[Produto\]/gi, carne.description)
    .replace(/\[Empresa\]/gi, companyName || 'NEO FIX ELETRÔNICA & REFRIGERAÇÃO');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = cleanNumeric(phone || '');
  const dest = digits ? (digits.startsWith('55') ? digits : `55${digits}`) : '';
  const encoded = encodeURIComponent(message);
  return dest ? `https://wa.me/${dest}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function compressCoverImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        const maxWidth = 1200;
        const maxHeight = 900;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
