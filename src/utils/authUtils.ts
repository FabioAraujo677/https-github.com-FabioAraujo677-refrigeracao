export const MASTER_ADMIN_EMAIL = 'vendas.impactodigital2@gmail.com';

export function isMasterAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
}
