import { WarrantyOrder } from '../types';

export function isWarrantyReturnOrder(order?: Partial<WarrantyOrder> | null): boolean {
  if (!order) return false;
  if (Boolean(order.isReturn || order.is_return)) return true;

  const attendanceRaw = String(order.attendanceStatus || '').trim();
  const warrantyRaw = String(order.status || '').trim();
  const attendanceUpper = attendanceRaw.toUpperCase();

  // Strictly match uppercase 'RETORNO' or 'RETORNO DE GARANTIA'
  // (lowercase 'retorno' is used for technician-to-attendant completion workflow)
  if (
    attendanceRaw === 'RETORNO' ||
    attendanceUpper === 'RETORNO DE GARANTIA' ||
    warrantyRaw === 'RETORNO'
  ) {
    return true;
  }

  const notesUpper = String(order.notes || '').toUpperCase();
  if (notesUpper.includes('[RETORNO DE GARANTIA]')) {
    return true;
  }

  return false;
}
