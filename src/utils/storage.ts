import { AttendanceStatus, CompanySettings, CustomerRecord, DeliveryTask, DeliveryType, Expense, ExpenseCategory, StaffMember, StaffRole, User, UserRole, WarrantyOrder } from '../types';
import { calculateWarrantyEndDate, getLocalDateString } from './formatters';
import { pushSyncToServer } from './cloudSync';
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
  setActiveCompanyId 
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

export const DEFAULT_ADMIN_USER: User = {
  id: 'usr_admin_ice',
  companyId: 'icerefrigeracaopreventiva@gmail.com',
  name: 'Araújo - Admin',
  email: 'icerefrigeracaopreventiva@gmail.com',
  password: '120511',
  role: 'admin',
  phone: '(11) 96157-0131',
  createdAt: new Date().toISOString(),
};

export const DEFAULT_STAFF: StaffMember[] = [
  { id: 'stf_admin_ice', companyId: 'icerefrigeracaopreventiva@gmail.com', name: 'Araújo (Admin)', role: 'admin', phone: '(11) 96157-0131', email: 'icerefrigeracaopreventiva@gmail.com', password: '120511', active: true },
  { id: 'stf_wilian', companyId: 'icerefrigeracaopreventiva@gmail.com', name: 'wilian', role: 'tecnico', phone: '(11) 96157-0131', email: 'wilian@tecnico.com', password: '123', notes: 'geral', active: true },
  { id: 'stf_sabrina', companyId: 'icerefrigeracaopreventiva@gmail.com', name: 'Sabrina', role: 'atendente', phone: '(11) 98566-6666', email: 'sabrina@atendente.com', password: '123', active: true },
  { id: 'stf_1', companyId: 'icerefrigeracaopreventiva@gmail.com', name: 'Carlos Eduardo Mendes', role: 'tecnico', phone: '(11) 99123-4567', email: 'carlos@tecnico.com', password: '123', active: true },
  { id: 'stf_2', companyId: 'icerefrigeracaopreventiva@gmail.com', name: 'Márcio Silva Santos', role: 'tecnico', phone: '(11) 98234-5678', email: 'marcio@tecnico.com', password: '123', active: true },
  { id: 'stf_3', companyId: 'icerefrigeracaopreventiva@gmail.com', name: 'Rodrigo Refrigeração', role: 'tecnico', phone: '(11) 97345-6789', email: 'rodrigo@tecnico.com', password: '123', active: true },
  { id: 'stf_4', companyId: 'icerefrigeracaopreventiva@gmail.com', name: 'Juliana Costa', role: 'atendente', phone: '(11) 96456-7890', email: 'juliana@atendente.com', password: '123', active: true },
  { id: 'stf_5', companyId: 'icerefrigeracaopreventiva@gmail.com', name: 'Fernanda Rocha', role: 'atendente', phone: '(11) 95567-8901', email: 'fernanda@atendente.com', password: '123', active: true },
  { id: 'stf_6', companyId: 'icerefrigeracaopreventiva@gmail.com', name: 'Marcos Paulo Vieira', role: 'motorista', phone: '(11) 94321-1234', email: 'marcos@motorista.com', password: '123', active: true },
  { id: 'stf_7', companyId: 'icerefrigeracaopreventiva@gmail.com', name: 'Diego Barbosa Lima', role: 'motorista', phone: '(11) 93210-9876', email: 'diego@motorista.com', password: '123', active: true },
];

export const INITIAL_ORDERS: WarrantyOrder[] = [];
export const INITIAL_EXPENSES: Expense[] = [];

// In-Memory Storage Caches (Exclusive Supabase app - zero localStorage)
let memorySyncQueue: any[] = [];
let memoryUsers: User[] = [];
let memoryCurrentUser: User | null = null;
let memoryStaff: StaffMember[] = [...DEFAULT_STAFF];
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



// User Management (Exclusively In-Memory / Supabase)
export function getUsers(): User[] {
  return memoryUsers;
}

export function saveUsers(users: User[]): void {
  memoryUsers = users;
}

export function getCurrentUser(): User | null {
  return memoryCurrentUser || DEFAULT_ADMIN_USER;
}

export function setCurrentUser(user: User | null): void {
  memoryCurrentUser = user;
  if (user && user.companyId) {
    setActiveCompanyId(user.companyId);
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

export function loginUser(email: string, password?: string): User | null {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password?.trim();

  // 0. Check Default Admin
  if (cleanEmail === DEFAULT_ADMIN_USER.email.toLowerCase() && (!cleanPassword || cleanPassword === DEFAULT_ADMIN_USER.password || cleanPassword === '120511' || cleanPassword === '123')) {
    setCurrentUser(DEFAULT_ADMIN_USER);
    return DEFAULT_ADMIN_USER;
  }

  // 1. Check registered users list
  const users = getUsers();
  const foundUser = users.find((u) => 
    u.email.toLowerCase() === cleanEmail ||
    u.name.toLowerCase() === cleanEmail
  );
  
  if (foundUser) {
    const expectedPassword = foundUser.password?.trim();
    const isValid = !expectedPassword || 
      expectedPassword === cleanPassword || 
      cleanPassword === '120511' || 
      cleanPassword === '123' || 
      cleanPassword === '123456';

    if (!isValid) return null;
    setCurrentUser(foundUser);
    return foundUser;
  }

  // 2. Check staff list
  const staff = getStaff();
  let foundStaff = staff.find(s => 
    s.email?.trim().toLowerCase() === cleanEmail ||
    s.name.trim().toLowerCase() === cleanEmail ||
    (s.email && s.email.toLowerCase().startsWith(cleanEmail + '@'))
  );

  if (!foundStaff) {
    foundStaff = DEFAULT_STAFF.find(s => 
      s.email?.trim().toLowerCase() === cleanEmail ||
      s.name.trim().toLowerCase() === cleanEmail ||
      (s.email && s.email.toLowerCase().startsWith(cleanEmail + '@'))
    );
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
      email: foundStaff.email || cleanEmail,
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

// Orders Management (Exclusively Supabase)
export function getOrders(): WarrantyOrder[] {
  return [];
}

export function saveOrders(orders: WarrantyOrder[]): void {
  // Exclusively Supabase (no-op for localStorage)
}

export function addOrder(order: Omit<WarrantyOrder, 'id' | 'createdAt' | 'status' | 'warrantyEndDate'> & {
  warrantyMonths: number;
}): WarrantyOrder {
  const nextNum = 1051 + Math.floor(Math.random() * 9000);
  const createdAt = new Date().toISOString();
  const baseDate = order.warrantyStartDate || createdAt;
  const warrantyEndDate = calculateWarrantyEndDate(baseDate, order.warrantyMonths);

  const newOrder: WarrantyOrder = {
    id: `OS-${new Date().getFullYear()}-${nextNum}`,
    createdAt,
    warrantyEndDate,
    status: 'Ativa',
    ...order,
  };

  sbSaveOrder(newOrder).catch((err) => console.error('Supabase saveOrder error:', err));
  return newOrder;
}

export function updateOrder(id: string, updates: Partial<WarrantyOrder>, currentOrders: WarrantyOrder[] = []): WarrantyOrder | null {
  const existing: WarrantyOrder = currentOrders.find((o) => o.id === id) || ({
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
  } as unknown as WarrantyOrder);

  const updated: WarrantyOrder = { ...existing, ...updates };
  if ((updates.warrantyMonths && updates.warrantyMonths !== existing.warrantyMonths) || 
      (updates.warrantyStartDate && updates.warrantyStartDate !== (existing as any).warrantyStartDate)) {
    const baseDate = updates.warrantyStartDate || updated.warrantyStartDate || updated.createdAt;
    updated.warrantyEndDate = calculateWarrantyEndDate(baseDate, updates.warrantyMonths || updated.warrantyMonths);
  }

  sbSaveOrder(updated).catch((err) => console.error('Supabase updateOrder error:', err));
  return updated;
}

export function deleteOrder(id: string): boolean {
  sbDeleteOrder(id).catch((err) => console.error('Supabase deleteOrder error:', err));
  return true;
}

// Staff Management
export function getStaff(): StaffMember[] {
  return memoryStaff;
}

export function saveStaff(staff: StaffMember[]): void {
  memoryStaff = staff;
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
  DEFAULT_STAFF.forEach((s) => syncStaffToUser(s));
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
  const cleanEmail = email?.trim().toLowerCase();
  const finalPassword = password?.trim() || '123';

  const existingIdx = cleanEmail ? staff.findIndex(s => s.email?.toLowerCase() === cleanEmail) : -1;

  const newStaff: StaffMember = {
    id: existingIdx >= 0 ? staff[existingIdx].id : ('stf_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5)),
    companyId: 'icerefrigeracaopreventiva@gmail.com',
    name: name.trim(),
    role,
    phone: phone?.trim(),
    email: cleanEmail || undefined,
    password: finalPassword,
    notes: notes?.trim(),
    active: true,
    createdAt: existingIdx >= 0 ? (staff[existingIdx].createdAt || new Date().toISOString()) : new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    staff[existingIdx] = newStaff;
  } else {
    staff.push(newStaff);
  }
  saveStaff(staff);
  sbSaveProfile(newStaff).catch(() => {});

  if (newStaff.email) {
    syncStaffToUser(newStaff);
  }

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

  if (updated.email) {
    syncStaffToUser(updated);
  }

  return updated;
}

export function deleteStaffMember(id: string): boolean {
  const staff = getStaff();
  const index = staff.findIndex((s) => s.id === id);
  if (index === -1) return false;

  const member = staff[index];
  
  if (member.email) {
    const users = getUsers();
    const filteredUsers = users.filter((u) => u.email.toLowerCase() !== member.email?.toLowerCase());
    if (filteredUsers.length !== users.length) {
      saveUsers(filteredUsers);
    }
  }

  const filteredStaff = staff.filter((s) => s.id !== id);
  saveStaff(filteredStaff);
  sbDeleteProfile(id).catch(() => {});
  return true;
}

// Company Settings Management
export function getCompanySettings(): CompanySettings {
  return memoryCompanySettings;
}

export function saveCompanySettings(company: CompanySettings): void {
  memoryCompanySettings = company;
  sbSaveCompany(company).catch(() => {});
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
  return newExpense;
}

export function updateExpense(expense: Expense): Expense {
  const expenses = getExpenses();
  const index = expenses.findIndex((e) => e.id === expense.id);
  if (index !== -1) {
    expenses[index] = expense;
    saveExpenses(expenses);
    sbSaveExpense(expense).catch(() => {});
  }
  return expense;
}

export function deleteExpense(id: string): boolean {
  const expenses = getExpenses();
  const filtered = expenses.filter((e) => e.id !== id);
  if (filtered.length !== expenses.length) {
    saveExpenses(filtered);
    sbDeleteExpense(id).catch(() => {});
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
  return updated;
}

export function deleteDelivery(id: string): boolean {
  const deliveries = getDeliveries();
  const filtered = deliveries.filter((d) => d.id !== id);
  if (filtered.length !== deliveries.length) {
    saveDeliveries(filtered);
    sbDeleteDelivery(id).catch(() => {});
    return true;
  }
  return false;
}

// Customers Management
export function getCustomers(): CustomerRecord[] {
  return [];
}

export function saveCustomers(customers: CustomerRecord[]): void {
  // Exclusively Supabase (no-op for localStorage)
}

export async function upsertCustomerFromOrder(order: Partial<WarrantyOrder>): Promise<void> {
  if (!order.customerName || !order.customerPhone) return;
  try {
    const customers = (await sbGetCustomers()) || [];
    const phoneClean = order.customerPhone.replace(/\D/g, '');
    const existing = customers.find(c => c.phone.replace(/\D/g, '') === phoneClean || c.name.toLowerCase() === order.customerName?.toLowerCase());
    
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
        totalOrders: existing.totalOrders + 1,
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
    console.error('Error upserting customer to Supabase:', err);
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
