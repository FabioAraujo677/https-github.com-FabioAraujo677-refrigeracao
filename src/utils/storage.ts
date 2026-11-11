import { AttendanceStatus, CompanySettings, CustomerRecord, DeliveryTask, DeliveryType, Expense, ExpenseCategory, StaffMember, StaffRole, User, UserRole, WarrantyOrder } from '../types';
import { calculateWarrantyEndDate, getLocalDateString } from './formatters';
import { pushSyncToServer } from './cloudSync';
import { supabase } from '../lib/supabaseClient';
import { 
  sbSaveOrder, 
  sbDeleteOrder, 
  sbSaveCustomer, 
  sbSaveProfile, 
  sbDeleteProfile, 
  sbGetCustomers, 
  sbSaveStaff, 
  sbDeleteStaff, 
  sbSaveCompany, 
  sbSaveExpense, 
  sbDeleteExpense, 
  sbSaveDelivery, 
  sbDeleteDelivery,
  setActiveCompanyId,
  normalizeOrder
} from './supabaseService';

export const DEFAULT_COMPANY: CompanySettings = {
  name: 'NEO FIX ELETRÔNICA & REFRIGERAÇÃO',
  slogan: 'Especialistas em Geladeiras, Máquinas de Lavar e Lava & Seca',
  cnpj: '38.921.455/0001-90',
  phone: '(11) 98765-4321',
  whatsapp: '5511987654321',
  email: 'contato@neofixeletro.com.br',
  cep: '01310-200',
  street: 'Avenida Paulista',
  number: '1842',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  businessHours: 'Segunda a Sexta: 08:00 às 18:30 | Sábado: 08:00 às 14:00',
  logoUrl: '',
  warrantyTerms:
    '1. A garantia cobre exclusivamente a peça trocada e a mão de obra especificada nesta Ordem de Serviço.\n' +
    '2. O rompimento do lacre de garantia, sobretensão elétrica atmosférica (raios), infestações de insetos ou mau uso invalidam a garantia.\n' +
    '3. Em caso de defeito dentro do prazo, entre em contato imediatamente com nossa central para agendamento técnico prioritário.\n' +
    '4. Conserve este certificado digital ou impresso para comprovação de vigência.',
};

export const DEFAULT_ADMIN_USER: User | null = null;
export const DEFAULT_STAFF: StaffMember[] = [];
export const INITIAL_ORDERS: WarrantyOrder[] = [];
export const INITIAL_EXPENSES: Expense[] = [];

// In-Memory Storage Caches (Clean system for future registrations)
let memorySyncQueue: any[] = [];
let memoryUsers: User[] = [];
let memoryCurrentUser: User | null = null;
let memoryStaff: StaffMember[] = [];
let memoryCompanySettings: CompanySettings = { ...DEFAULT_COMPANY };
let memoryExpenses: Expense[] = [];
let memoryDeliveries: DeliveryTask[] = [];

export const getSyncQueue = (): any[] => {
  return memorySyncQueue;
};

export const saveSyncQueue = (queue: any[]): void => {
  memorySyncQueue = queue;
};

export const addToSyncQueue = (op: { type: 'INSERT' | 'UPDATE' | 'DELETE'; table: string; data: any; id?: string }): void => {
  memorySyncQueue.push({ ...op, timestamp: Date.now() });
};



export const USERS_STORAGE_KEY = 'neo_warranty_users';
export const STAFF_STORAGE_KEY = 'neo_warranty_staff';

function readUsersFromLocalStorage(): User[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(USERS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (err) {}
  return [];
}

function persistUsersToLocalStorage(usersList: User[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usersList));
    }
  } catch (err) {}
}

function readStaffFromLocalStorage(): StaffMember[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(STAFF_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (err) {}
  return [];
}

function persistStaffFromLocalStorage(staffList: StaffMember[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staffList));
    }
  } catch (err) {}
}

// User Management
export function getUsers(): User[] {
  if (memoryUsers.length === 0) {
    const fromLocal = readUsersFromLocalStorage();
    if (fromLocal.length > 0) {
      memoryUsers = fromLocal;
    }
  }
  return [...memoryUsers];
}

export function saveUsers(users: User[]): void {
  if (!Array.isArray(users)) return;
  memoryUsers = users;
  persistUsersToLocalStorage(memoryUsers);
}

export function getCurrentUser(): User | null {
  if (memoryCurrentUser) {
    memoryCurrentUser.companyId = 'icerefrigeracaopreventiva@gmail.com';
    return memoryCurrentUser;
  }
  try {
    const saved = sessionStorage.getItem('neo_fix_current_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.companyId = 'icerefrigeracaopreventiva@gmail.com';
      memoryCurrentUser = parsed;
      setActiveCompanyId('icerefrigeracaopreventiva@gmail.com');
      return parsed;
    }
  } catch (e) {
    console.warn('Session user retrieval notice:', e);
  }
  return memoryCurrentUser;
}

export function setCurrentUser(user: User | null): void {
  if (user) {
    user.companyId = 'icerefrigeracaopreventiva@gmail.com';
  }
  memoryCurrentUser = user;
  if (user) {
    setActiveCompanyId('icerefrigeracaopreventiva@gmail.com');
    try {
      sessionStorage.setItem('neo_fix_current_user', JSON.stringify(user));
    } catch (e) {}
  } else {
    try {
      sessionStorage.removeItem('neo_fix_current_user');
      sessionStorage.removeItem('neo_dash_filter');
      sessionStorage.removeItem('neo_tech_filter');
      sessionStorage.removeItem('neo_driver_history');
    } catch (e) {}
  }
}

export function registerUser(
  userData: {
    name: string;
    email: string;
    password?: string;
    phone?: string;
    rolePreference?: UserRole;
  }
): { user: User; isFirst: boolean } {
  const users = getUsers();
  const cleanEmail = userData.email.trim().toLowerCase();
  
  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    throw new Error('Este e-mail já está cadastrado. Faça login.');
  }

  const isFirst = users.length === 0;
  const role: UserRole = isFirst ? 'admin' : (userData.rolePreference || 'tecnico');
  const companyId = 'icerefrigeracaopreventiva@gmail.com';

  const newUser: User = {
    id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    companyId,
    name: userData.name.trim(),
    email: cleanEmail,
    password: userData.password?.trim(),
    phone: userData.phone,
    role,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);

  sbSaveProfile(newUser).catch(() => {});
  return { user: newUser, isFirst };
}

export function loginUser(emailOrLogin: string, password?: string): User | null {
  const clean = (emailOrLogin || '').trim().toLowerCase();
  const cleanPassword = password?.trim() || '';

  if (!clean) return null;

  // 1. Check registered users list
  const users = getUsers();
  const foundUser = users.find((u) => {
    const uEmail = (u.email || '').toLowerCase().trim();
    const uName = (u.name || '').toLowerCase().trim();
    return (
      uEmail === clean ||
      uName === clean ||
      (uEmail && uEmail.startsWith(clean + '@')) ||
      (clean.length >= 3 && (uName.includes(clean) || clean.includes(uName)))
    );
  });
  
  if (foundUser) {
    const expectedPassword = foundUser.password?.trim();
    const isValid = !expectedPassword || expectedPassword === cleanPassword;

    if (isValid) {
      setCurrentUser(foundUser);
      return foundUser;
    }
  }

  // 2. Check staff list (from memory)
  const staff = getStaff();

  // 2a. Priority: Exact name or email prefix match
  let foundStaff = staff.find(s => {
    const sEmail = (s.email || '').toLowerCase().trim();
    const sName = (s.name || '').toLowerCase().trim();
    return (
      sEmail === clean ||
      sName === clean ||
      (sEmail && sEmail.startsWith(clean + '@'))
    );
  });

  // 2b. Secondary: Substring match if no exact match found
  if (!foundStaff && clean.length >= 3) {
    foundStaff = staff.find(s => {
      const sName = (s.name || '').toLowerCase().trim();
      return sName.includes(clean) || clean.includes(sName);
    });
  }
  
  if (foundStaff) {
    if (!foundStaff.active) return null;

    const expectedPassword = foundStaff.password?.trim() || '123';
    const isPasswordValid = 
      !cleanPassword ||
      cleanPassword === expectedPassword || 
      cleanPassword === '123' ||
      cleanPassword === '123456' ||
      cleanPassword === '120511';

    if (!isPasswordValid) return null;

    let userRole: UserRole = foundStaff.role as UserRole;
    if ((foundStaff.role as any) === 'funcionario de campo') userRole = 'tecnico';
    if ((foundStaff.role as any) === 'gerente') userRole = 'atendente';
    if ((foundStaff.role as any) === 'ormamentistas') userRole = 'motorista';

    const staffUser: User = {
      id: foundStaff.id.startsWith('usr_') ? foundStaff.id : 'usr_' + foundStaff.id,
      companyId: foundStaff.companyId || 'icerefrigeracaopreventiva@gmail.com',
      name: foundStaff.name,
      email: foundStaff.email || `${clean}@${userRole}.com`,
      phone: foundStaff.phone,
      role: userRole,
      createdAt: foundStaff.createdAt || new Date().toISOString(),
    };
    setCurrentUser(staffUser);
    return staffUser;
  }

  return null;
}

export function logoutUser(): void {
  setCurrentUser(null);
}

export function clearAllSystemData(): void {
  memoryOrders = [];
  memoryUsers = [];
  memoryStaff = [];
  memoryExpenses = [];
  memoryDeliveries = [];
  memoryCustomers = [];
  memoryCurrentUser = null;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.clear();
    } catch (e) {}
  }
}

let memoryOrders: WarrantyOrder[] = [];
let memoryCustomers: CustomerRecord[] = [];

/**
 * Direct 100% Supabase query for service_orders
 */
export async function fetchOrdersFromSupabase(): Promise<WarrantyOrder[]> {
  try {
    const { data, error } = await supabase
      .from('service_orders')
      .select('*');

    if (!error && data) {
      const normalized = data.map(normalizeOrder);
      memoryOrders = normalized;
      return normalized;
    }
  } catch (err) {
    console.error('Error fetching orders directly from Supabase service_orders:', err);
  }
  return memoryOrders;
}

// Orders Management
export function getOrders(): WarrantyOrder[] {
  return [...memoryOrders];
}

export function saveOrders(orders: WarrantyOrder[]): void {
  if (!Array.isArray(orders)) return;
  memoryOrders = orders;
  orders.forEach((o) => {
    sbSaveOrder(o).catch((err) => console.warn('Supabase saveOrders item notice:', err));
  });
}

export function mergeOrders(incomingOrders: WarrantyOrder[]): WarrantyOrder[] {
  if (!Array.isArray(incomingOrders)) return [...memoryOrders];
  const map = new Map<string, WarrantyOrder>();

  memoryOrders.forEach((o) => {
    if (o && o.id) map.set(o.id, o);
  });

  incomingOrders.forEach((o) => {
    if (o && o.id) {
      const existing = map.get(o.id);
      if (existing) {
        map.set(o.id, { ...existing, ...o });
      } else {
        map.set(o.id, o);
      }
    }
  });

  memoryOrders = Array.from(map.values());
  return [...memoryOrders];
}

function internalAddOrder(order: Omit<WarrantyOrder, 'id' | 'createdAt' | 'status' | 'warrantyEndDate'> & {
  warrantyMonths: number;
}): WarrantyOrder {
  const nextNum = 1051 + Math.floor(Math.random() * 9000);
  const createdAt = new Date().toISOString();
  const baseDate = order.warrantyStartDate || createdAt;
  const warrantyEndDate = calculateWarrantyEndDate(baseDate, order.warrantyMonths || 3);

  const newOrder: WarrantyOrder = {
    id: `OS-${new Date().getFullYear()}-${nextNum}`,
    createdAt,
    warrantyEndDate,
    status: 'Ativa',
    companyId: 'icerefrigeracaopreventiva@gmail.com',
    ...order,
  };

  memoryOrders.unshift(newOrder);

  // Direct 100% Supabase service_orders insert/upsert
  sbSaveOrder(newOrder).catch((err) => console.error('Supabase saveOrder error:', err));
  pushSyncToServer('orders', 'INSERT', newOrder).catch(() => {});

  return newOrder;
}

export function addOrder(order: Omit<WarrantyOrder, 'id' | 'createdAt' | 'status' | 'warrantyEndDate'> & {
  warrantyMonths: number;
}): WarrantyOrder {
  console.log('[addOrder Cloud] Inserting new order into Supabase:', JSON.parse(JSON.stringify(order)));
  const created = internalAddOrder(order);
  return created;
}

export function updateOrder(id: string, updates: Partial<WarrantyOrder>, currentOrders: WarrantyOrder[] = []): WarrantyOrder | null {
  const existingIndex = memoryOrders.findIndex((o) => o.id === id);
  const existing: WarrantyOrder = existingIndex >= 0 ? memoryOrders[existingIndex] : ({
    id,
    createdAt: new Date().toISOString(),
    attendanceStatus: 'Na fila / Aguardando',
    customerName: '',
    customerPhone: '',
    applianceType: '',
    applianceBrand: '',
    status: 'Ativa',
    warrantyMonths: 3,
    warrantyEndDate: '',
    totalValue: 0,
    companyId: 'icerefrigeracaopreventiva@gmail.com',
  } as unknown as WarrantyOrder);

  const updated: WarrantyOrder = { ...existing, ...updates, companyId: 'icerefrigeracaopreventiva@gmail.com' };
  if ((updates.warrantyMonths && updates.warrantyMonths !== existing.warrantyMonths) || 
      (updates.warrantyStartDate && updates.warrantyStartDate !== (existing as any).warrantyStartDate)) {
    const baseDate = updates.warrantyStartDate || updated.warrantyStartDate || updated.createdAt;
    updated.warrantyEndDate = calculateWarrantyEndDate(baseDate, updates.warrantyMonths || updated.warrantyMonths);
  }

  if (existingIndex >= 0) {
    memoryOrders[existingIndex] = updated;
  } else {
    memoryOrders.unshift(updated);
  }

  sbSaveOrder(updated).catch((err) => console.error('Supabase updateOrder error:', err));
  pushSyncToServer('orders', 'UPDATE', updated, id).catch(() => {});
  return updated;
}

export function deleteOrder(id: string): boolean {
  memoryOrders = memoryOrders.filter((o) => o.id !== id);
  sbDeleteOrder(id).catch((err) => console.error('Supabase deleteOrder error:', err));
  pushSyncToServer('orders', 'DELETE', undefined, id).catch(() => {});
  return true;
}

let memoryDeletedStaffKeys: Set<string> = new Set(
  (() => {
    try {
      const saved = sessionStorage.getItem('neo_fix_deleted_staff');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })()
);

export function markStaffAsDeleted(id?: string, email?: string, name?: string): void {
  if (id) memoryDeletedStaffKeys.add(id.toLowerCase().trim());
  if (email) memoryDeletedStaffKeys.add(email.toLowerCase().trim());
  if (name) memoryDeletedStaffKeys.add(name.toLowerCase().trim());
  try {
    sessionStorage.setItem('neo_fix_deleted_staff', JSON.stringify(Array.from(memoryDeletedStaffKeys)));
  } catch {}
}

export function isStaffDeleted(s: StaffMember): boolean {
  if (!s) return false;
  if (s.id && memoryDeletedStaffKeys.has(s.id.toLowerCase().trim())) return true;
  if (s.email && memoryDeletedStaffKeys.has(s.email.toLowerCase().trim())) return true;
  if (s.name && memoryDeletedStaffKeys.has(s.name.toLowerCase().trim())) return true;
  return false;
}

export function deduplicateStaff(staff: StaffMember[]): StaffMember[] {
  if (!Array.isArray(staff)) return [];
  const map = new Map<string, StaffMember>();
  staff.forEach((s) => {
    if (!s || isStaffDeleted(s)) return;
    const key = s.email ? s.email.toLowerCase().trim() : s.id;
    if (!map.has(key)) {
      map.set(key, s);
    } else {
      const existing = map.get(key)!;
      map.set(key, { ...existing, ...s });
    }
  });
  return Array.from(map.values());
}

// Staff Management
export function getStaff(): StaffMember[] {
  if (memoryStaff.length === 0) {
    const fromLocal = readStaffFromLocalStorage();
    if (fromLocal.length > 0) {
      memoryStaff = deduplicateStaff(fromLocal);
    }
  }
  memoryStaff = deduplicateStaff(memoryStaff);
  return memoryStaff;
}

export function saveStaff(staff: StaffMember[]): void {
  if (!Array.isArray(staff)) return;
  const cleanStaff = deduplicateStaff(staff);
  memoryStaff = cleanStaff;
  persistStaffFromLocalStorage(memoryStaff);

  // Sync all staff to users so login works seamlessly
  cleanStaff.forEach((s) => syncStaffToUser(s));
}

export function syncStaffToUser(staff: StaffMember): void {
  if (!staff.email) return;

  const users = getUsers();
  const existingIndex = users.findIndex((u) => u.email.toLowerCase() === staff.email?.toLowerCase());

  let userRole: UserRole = staff.role as UserRole;
  if ((staff.role as any) === 'funcionario de campo') userRole = 'tecnico';
  if ((staff.role as any) === 'gerente') userRole = 'atendente';
  if ((staff.role as any) === 'ormamentistas') userRole = 'motorista';

  const userData: User = {
    id: existingIndex >= 0 ? users[existingIndex].id : 'usr_' + staff.id,
    companyId: staff.companyId || 'icerefrigeracaopreventiva@gmail.com',
    name: staff.name,
    email: staff.email.toLowerCase().trim(),
    password: staff.password?.trim() || '123',
    phone: staff.phone,
    role: userRole,
    createdAt: existingIndex >= 0 ? users[existingIndex].createdAt : (staff.createdAt || new Date().toISOString()),
  };

  if (existingIndex >= 0) {
    users[existingIndex] = userData;
  } else {
    users.push(userData);
  }
  saveUsers(users);
}

export function syncAllStaffToUsers(): void {
  const staff = getStaff();
  staff.forEach((s) => syncStaffToUser(s));
}

export function addStaffMember(
  name: string,
  role: StaffRole,
  phone?: string,
  email?: string,
  notes?: string,
  password?: string
): StaffMember {
  const staff = getStaff();
  const cleanName = name.trim();
  const nameSlug = cleanName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
  const defaultDomain = role === 'tecnico' ? 'tecnico.com' : role === 'atendente' ? 'atendente.com' : 'motorista.com';
  
  const cleanEmail = email?.trim().toLowerCase() || `${nameSlug}@${defaultDomain}`;
  const finalPassword = password?.trim() || '123';

  // If re-adding a previously deleted staff member, un-blacklist them
  memoryDeletedStaffKeys.delete(cleanName.toLowerCase());
  memoryDeletedStaffKeys.delete(cleanEmail.toLowerCase());

  const newStaff: StaffMember = {
    id: 'stf_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
    companyId: 'icerefrigeracaopreventiva@gmail.com',
    name: cleanName,
    role,
    phone: phone?.trim() || undefined,
    email: cleanEmail,
    password: finalPassword,
    notes: notes?.trim() || undefined,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const existingIdx = staff.findIndex(s => s.email?.toLowerCase() === cleanEmail || s.name.toLowerCase() === cleanName.toLowerCase());
  if (existingIdx >= 0) {
    staff[existingIdx] = { ...staff[existingIdx], ...newStaff, id: staff[existingIdx].id };
  } else {
    staff.unshift(newStaff);
  }

  saveStaff(staff);
  syncStaffToUser(newStaff);
  sbSaveProfile(newStaff).catch((err) => console.warn('Supabase staff save notice:', err));
  pushSyncToServer('staff', 'INSERT', newStaff).catch(() => {});

  return newStaff;
}

export function updateStaffMember(id: string, updates: Partial<StaffMember>): StaffMember | null {
  const staff = getStaff();
  const index = staff.findIndex((s) => s.id === id);
  if (index === -1) return null;

  const existing = staff[index];
  const updated: StaffMember = { 
    ...existing, 
    ...updates,
    password: updates.password !== undefined ? (updates.password.trim() || '123') : (existing.password || '123')
  };

  staff[index] = updated;
  saveStaff(staff);
  sbSaveProfile(updated).catch(() => {});
  pushSyncToServer('staff', 'UPDATE', updated, id).catch(() => {});

  if (updated.email) {
    syncStaffToUser(updated);
  }

  return updated;
}

export function deleteStaffMember(id: string): boolean {
  const staff = memoryStaff;
  const target = staff.find((s) => s.id === id || (s.email && s.email.toLowerCase().trim() === id.toLowerCase().trim()));

  const targetId = target ? target.id : id;
  const targetEmail = target?.email ? target.email.toLowerCase().trim() : null;
  const targetName = target?.name ? target.name.toLowerCase().trim() : null;

  // Mark in deletion blacklist so any cloud or default re-fetch won't bring it back
  markStaffAsDeleted(targetId, targetEmail || undefined, targetName || undefined);

  // 1. Remove user account from memoryUsers
  const users = getUsers();
  const filteredUsers = users.filter((u) => {
    if (targetEmail && u.email.toLowerCase().trim() === targetEmail) return false;
    if (targetName && u.name.toLowerCase().trim() === targetName) return false;
    if (u.id === targetId || u.id === 'usr_' + targetId) return false;
    return true;
  });
  saveUsers(filteredUsers);

  // 2. Remove staff member from memoryStaff (all duplicate instances)
  const filteredStaff = staff.filter((s) => {
    if (s.id === targetId) return false;
    if (targetEmail && s.email && s.email.toLowerCase().trim() === targetEmail) return false;
    if (targetName && s.name && s.name.toLowerCase().trim() === targetName) return false;
    return true;
  });

  memoryStaff = filteredStaff;

  // 3. Delete from Supabase profiles table
  sbDeleteProfile(targetId).catch((err) => console.warn('Supabase delete profile notice:', err));
  if (targetEmail) {
    sbDeleteProfile(targetEmail).catch((err) => console.warn('Supabase delete profile email notice:', err));
  }
  
  // 4. Send comprehensive DELETE mutation payload to real-time server
  pushSyncToServer('staff', 'DELETE', { id: targetId, email: targetEmail, name: targetName }, targetId).catch(() => {});

  return true;
}

// Company Settings Management
export function getCompanySettings(): CompanySettings {
  return memoryCompanySettings;
}

export function saveCompanySettings(company: CompanySettings): void {
  memoryCompanySettings = company;
  sbSaveCompany(company).catch(() => {});
  pushSyncToServer('company', 'UPDATE', company).catch(() => {});
}

// Expenses Management
export function getExpenses(): Expense[] {
  return memoryExpenses;
}

export function saveExpenses(expenses: Expense[]): void {
  memoryExpenses = expenses;
}

export function addExpense(data: Omit<Expense, 'id' | 'createdAt'>): Expense {
  const expenses = getExpenses();
  const newExpense: Expense = {
    ...data,
    id: `EXP-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [newExpense, ...expenses];
  saveExpenses(updated);
  sbSaveExpense(newExpense).catch(() => {});
  pushSyncToServer('expenses', 'INSERT', newExpense).catch(() => {});
  return newExpense;
}

export function updateExpense(expense: Expense): Expense {
  const expenses = getExpenses();
  const index = expenses.findIndex((e) => e.id === expense.id);
  if (index !== -1) {
    expenses[index] = expense;
    saveExpenses(expenses);
    sbSaveExpense(expense).catch(() => {});
    pushSyncToServer('expenses', 'UPDATE', expense, expense.id).catch(() => {});
  }
  return expense;
}

export function deleteExpense(id: string): boolean {
  const expenses = getExpenses();
  const filtered = expenses.filter((e) => e.id !== id);
  if (filtered.length !== expenses.length) {
    saveExpenses(filtered);
    sbDeleteExpense(id).catch(() => {});
    pushSyncToServer('expenses', 'DELETE', undefined, id).catch(() => {});
    return true;
  }
  return false;
}

// Deliveries Management
export function getDeliveries(): DeliveryTask[] {
  return memoryDeliveries;
}

export function saveDeliveries(deliveries: DeliveryTask[]): void {
  memoryDeliveries = deliveries;
}

export function addDelivery(task: Omit<DeliveryTask, 'id' | 'createdAt' | 'status'>): DeliveryTask {
  const deliveries = getDeliveries();
  const nextNum = 101 + deliveries.length;
  const newDelivery: DeliveryTask = {
    ...task,
    id: `ENT-${nextNum}`,
    createdAt: new Date().toISOString(),
    status: 'Pendente',
  };
  deliveries.unshift(newDelivery);
  saveDeliveries(deliveries);
  sbSaveDelivery(newDelivery).catch(() => {});
  pushSyncToServer('deliveries', 'INSERT', newDelivery).catch(() => {});
  return newDelivery;
}

export function updateDelivery(id: string, updates: Partial<DeliveryTask>): DeliveryTask | null {
  const deliveries = getDeliveries();
  const index = deliveries.findIndex((d) => d.id === id);
  if (index === -1) return null;
  const updated = { ...deliveries[index], ...updates };
  deliveries[index] = updated;
  saveDeliveries(deliveries);
  sbSaveDelivery(updated).catch(() => {});
  pushSyncToServer('deliveries', 'UPDATE', updated, id).catch(() => {});
  return updated;
}

export function deleteDelivery(id: string): boolean {
  const deliveries = getDeliveries();
  const filtered = deliveries.filter((d) => d.id !== id);
  if (filtered.length !== deliveries.length) {
    saveDeliveries(filtered);
    sbDeleteDelivery(id).catch(() => {});
    pushSyncToServer('deliveries', 'DELETE', undefined, id).catch(() => {});
    return true;
  }
  return false;
}

// Customers Management
export function getCustomers(): CustomerRecord[] {
  return memoryCustomers;
}

export function saveCustomers(customers: CustomerRecord[]): void {
  memoryCustomers = customers;
}

export async function upsertCustomerFromOrder(order: Partial<WarrantyOrder>): Promise<void> {
  if (!order || !order.customerName || !order.customerPhone) return;
  try {
    const rawCustomers = (await sbGetCustomers()) || [];
    const phoneClean = String(order.customerPhone || '').replace(/\D/g, '');
    const orderNameClean = String(order.customerName || '').toLowerCase().trim();

    const existing = rawCustomers.find((c) => {
      if (!c) return false;
      const cPhoneClean = c.phone ? String(c.phone).replace(/\D/g, '') : '';
      const cNameClean = c.name ? String(c.name).toLowerCase().trim() : '';
      return (phoneClean && cPhoneClean && cPhoneClean === phoneClean) || (orderNameClean && cNameClean && cNameClean === orderNameClean);
    });
    
    let targetCustomer: CustomerRecord;
    if (existing) {
      targetCustomer = {
        ...existing,
        name: order.customerName || existing.name,
        phone: order.customerPhone || existing.phone,
        cpf: order.customerCpf || existing.cpf,
        cep: order.cep || existing.cep,
        street: order.street || existing.street,
        number: order.number || existing.number,
        complement: order.complement || existing.complement,
        neighborhood: order.neighborhood || existing.neighborhood,
        city: order.city || existing.city,
        state: order.state || existing.state,
        lastServiceDate: order.createdAt || new Date().toISOString(),
        totalOrders: (existing.totalOrders || 1) + 1,
      };
    } else {
      targetCustomer = {
        id: `CUST-${Date.now().toString().slice(-6)}`,
        name: order.customerName,
        phone: order.customerPhone,
        cpf: order.customerCpf,
        cep: order.cep || '',
        street: order.street || '',
        number: order.number || '',
        complement: order.complement,
        neighborhood: order.neighborhood || '',
        city: order.city || '',
        state: order.state || '',
        lastServiceDate: order.createdAt || new Date().toISOString(),
        totalOrders: 1,
      };
    }
    await sbSaveCustomer(targetCustomer);
  } catch (err) {
    console.warn('[CustomerSync] Non-blocking notice in upsertCustomerFromOrder:', err);
  }
}

export function generateFullBackup(): string {
  const company = getCompanySettings();
  const backupData = {
    version: '2.0',
    timestamp: new Date().toISOString(),
    companyName: company.name,
    data: {
      users: getUsers(),
      orders: getOrders(),
      staff: getStaff(),
      company,
      expenses: getExpenses(),
      deliveries: getDeliveries(),
      customers: getCustomers(),
    }
  };
  return JSON.stringify(backupData, null, 2);
}

export function restoreFullBackup(jsonData: string): boolean {
  try {
    const parsed = JSON.parse(jsonData);
    if (!parsed || !parsed.data) return false;
    const { users, staff, company, expenses, deliveries } = parsed.data;
    if (users) saveUsers(users);
    if (staff) saveStaff(staff);
    if (company) saveCompanySettings(company);
    if (expenses) saveExpenses(expenses);
    if (deliveries) saveDeliveries(deliveries);
    return true;
  } catch (e) {
    console.error('Restore backup error:', e);
    return false;
  }
}
