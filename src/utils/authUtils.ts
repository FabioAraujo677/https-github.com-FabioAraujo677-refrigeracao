export const MASTER_ADMIN_EMAIL = 'icerefrigeracaopreventiva@gmail.com';

export function isMasterAdmin(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return clean === MASTER_ADMIN_EMAIL.toLowerCase() || clean === 'vendas.impactodigital2@gmail.com';
}
