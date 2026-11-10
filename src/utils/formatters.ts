export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

// Get local date in YYYY-MM-DD
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Safely extracts YYYY-MM-DD without timezone shifts
export function extractDateOnly(dateString?: string): string {
  if (!dateString) return '';
  const trimmed = dateString.trim();

  // If already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // If contains timestamp 'T', parse as Date to get user's local YYYY-MM-DD
  if (trimmed.includes('T')) {
    try {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return getLocalDateString(d);
      }
    } catch {}
  }

  // If plain YYYY-MM-DD or starts with YYYY-MM-DD
  const datePart = trimmed.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }

  try {
    const d = new Date(dateString);
    if (!isNaN(d.getTime())) {
      return getLocalDateString(d);
    }
  } catch {}

  return datePart;
}

// Formats a date string to DD/MM/YYYY safely without UTC timezone shift
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const datePart = extractDateOnly(dateString);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split('-');
    return `${d}/${m}/${y}`;
  }
  return dateString;
}

// Gets Portuguese weekday name for a date (noon-pinned to prevent DST or timezone shift)
export function getWeekdayName(dateString: string, short = false): string {
  if (!dateString) return '';
  const datePart = extractDateOnly(dateString);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return '';
  
  const [y, m, d] = datePart.split('-').map(Number);
  const localDate = new Date(y, m - 1, d, 12, 0, 0);
  const dayOfWeek = localDate.getDay();
  
  const fullWeekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const shortWeekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  
  return short ? shortWeekdays[dayOfWeek] : fullWeekdays[dayOfWeek];
}

// Formats date with weekday e.g. "Qua, 28/10/2026" or "Quarta-feira, 28/10/2026"
export function formatDateWithWeekday(dateString: string, short = true): string {
  if (!dateString) return '';
  const formatted = formatDate(dateString);
  const weekday = getWeekdayName(dateString, short);
  return weekday ? `${weekday}, ${formatted}` : formatted;
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return formatDate(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return formatDate(dateString);
  }
}

export function cleanNumeric(str: string): string {
  return str ? str.replace(/\D/g, '') : '';
}

export function formatPhone(phone: string): string {
  const digits = cleanNumeric(phone);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
}

export function formatCep(cep: string): string {
  const digits = cleanNumeric(cep);
  return digits.replace(/(\d{5})(\d{0,3})/, '$1-$2').trim();
}

export function formatCpf(cpf: string): string {
  const digits = cleanNumeric(cpf);
  return digits
    .replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4')
    .trim();
}

export function calculateWarrantyEndDate(startDate: string, months: number): string {
  if (!startDate) return '';
  const datePart = extractDateOnly(startDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split('-').map(Number);
    const date = new Date(y, m - 1 + months, d, 12, 0, 0);
    return getLocalDateString(date);
  }
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + months);
  return getLocalDateString(date);
}

export function getDaysRemaining(endDate: string): number {
  if (!endDate) return 0;
  const endPart = extractDateOnly(endDate);
  const todayPart = getLocalDateString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(endPart) && /^\d{4}-\d{2}-\d{2}$/.test(todayPart)) {
    const [y1, m1, d1] = endPart.split('-').map(Number);
    const [y2, m2, d2] = todayPart.split('-').map(Number);
    const t1 = new Date(y1, m1 - 1, d1, 12, 0, 0).getTime();
    const t2 = new Date(y2, m2 - 1, d2, 12, 0, 0).getTime();
    return Math.round((t1 - t2) / (1000 * 60 * 60 * 24));
  }
  const end = new Date(endDate).getTime();
  const now = new Date().getTime();
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}
