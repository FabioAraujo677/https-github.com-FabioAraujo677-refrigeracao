import { supabase } from '../lib/supabaseClient';
import { User, WarrantyOrder, Expense, StaffMember, CompanySettings, DeliveryTask, CustomerRecord } from '../types';

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return Boolean(url && !url.includes('placeholder'));
};

const DEFAULT_COMPANY_ID = 'icerefrigeracaopreventiva@gmail.com';

// Helper to get active company/admin tenant ID from current user session
export function getActiveCompanyId(): string {
  try {
    const raw = localStorage.getItem('garantiapro_current_user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u && u.companyId) {
        return u.companyId;
      }
    }
  } catch (e) {}
  return DEFAULT_COMPANY_ID;
}

export async function sbGetUsers(companyId: string = getActiveCompanyId()): Promise<User[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return data as User[];
  } catch (err) {
    console.warn('Supabase getUsers error, falling back to local storage:', err);
    return null;
  }
}

export async function sbSaveUser(user: User, companyId: string = getActiveCompanyId()): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('users').upsert([{ ...user, company_id: companyId }]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase saveUser error:', err);
    return false;
  }
}

export async function sbGetOrders(companyId: string = getActiveCompanyId()): Promise<WarrantyOrder[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as WarrantyOrder[];
  } catch (err) {
    console.warn('Supabase getOrders error:', err);
    return null;
  }
}

export async function sbSaveOrder(order: WarrantyOrder, companyId: string = getActiveCompanyId()): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('orders').upsert([{ ...order, company_id: companyId }]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase saveOrder error:', err);
    return false;
  }
}

export async function sbDeleteOrder(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase deleteOrder error:', err);
    return false;
  }
}

export async function sbGetExpenses(companyId: string = getActiveCompanyId()): Promise<Expense[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('company_id', companyId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data as Expense[];
  } catch (err) {
    console.warn('Supabase getExpenses error:', err);
    return null;
  }
}

export async function sbSaveExpense(expense: Expense, companyId: string = getActiveCompanyId()): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('expenses').upsert([{ ...expense, company_id: companyId }]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase saveExpense error:', err);
    return false;
  }
}

export async function sbDeleteExpense(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase deleteExpense error:', err);
    return false;
  }
}

export async function sbGetStaff(companyId: string = getActiveCompanyId()): Promise<StaffMember[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return data as StaffMember[];
  } catch (err) {
    console.warn('Supabase getStaff error:', err);
    return null;
  }
}

export async function sbSaveStaff(staff: StaffMember, companyId: string = getActiveCompanyId()): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('staff').upsert([{ ...staff, company_id: companyId }]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase saveStaff error:', err);
    return false;
  }
}

export async function sbDeleteStaff(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('staff').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase deleteStaff error:', err);
    return false;
  }
}

export async function sbGetCompany(companyId: string = getActiveCompanyId()): Promise<CompanySettings | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .limit(1)
      .single();
    if (error) throw error;
    return data as CompanySettings;
  } catch (err) {
    console.warn('Supabase getCompany error:', err);
    return null;
  }
}

export async function sbSaveCompany(company: CompanySettings, companyId: string = getActiveCompanyId()): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('company_settings').upsert([{ id: 1, company_id: companyId, ...company }]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase saveCompany error:', err);
    return false;
  }
}

export async function sbGetDeliveries(companyId: string = getActiveCompanyId()): Promise<DeliveryTask[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase.from('deliveries').select('*').eq('company_id', companyId);
    if (error) throw error;
    return data as DeliveryTask[];
  } catch (err) {
    console.warn('Supabase getDeliveries error:', err);
    return null;
  }
}

export async function sbSaveDelivery(delivery: DeliveryTask, companyId: string = getActiveCompanyId()): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('deliveries').upsert([{ ...delivery, company_id: companyId }]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase saveDelivery error:', err);
    return false;
  }
}

export async function sbDeleteDelivery(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('deliveries').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase deleteDelivery error:', err);
    return false;
  }
}

export async function sbGetCustomers(companyId: string = getActiveCompanyId()): Promise<CustomerRecord[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase.from('customers').select('*').eq('company_id', companyId);
    if (error) throw error;
    return data as CustomerRecord[];
  } catch (err) {
    console.warn('Supabase getCustomers error:', err);
    return null;
  }
}

export async function sbSaveCustomer(customer: CustomerRecord, companyId: string = getActiveCompanyId()): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('customers').upsert([{ ...customer, company_id: companyId }]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase saveCustomer error:', err);
    return false;
  }
}

export async function sbDeleteCustomer(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Supabase deleteCustomer error:', err);
    return false;
  }
}

export async function processSyncQueue(): Promise<void> {
  const { getSyncQueue, saveSyncQueue } = await import('./storage');
  const queue = getSyncQueue();
  if (queue.length === 0) return;

  console.log('[DEBUG] Processando fila de sincronização:', queue.length, 'itens');

  const remainingQueue = [];

  for (const op of queue) {
    try {
      let success = false;
      if (op.type === 'INSERT') {
        if (op.table === 'orders') success = await sbSaveOrder(op.data);
        if (op.table === 'staff') success = await sbSaveStaff(op.data);
        if (op.table === 'expenses') success = await sbSaveExpense(op.data);
        if (op.table === 'deliveries') success = await sbSaveDelivery(op.data);
        if (op.table === 'customers') success = await sbSaveCustomer(op.data);
        if (op.table === 'company') success = await sbSaveCompany(op.data);
      } else if (op.type === 'UPDATE') {
        if (op.table === 'orders') success = await sbSaveOrder(op.data);
        if (op.table === 'staff') success = await sbSaveStaff(op.data);
        if (op.table === 'expenses') success = await sbSaveExpense(op.data);
        if (op.table === 'deliveries') success = await sbSaveDelivery(op.data);
        if (op.table === 'customers') success = await sbSaveCustomer(op.data);
        if (op.table === 'company') success = await sbSaveCompany(op.data);
      } else if (op.type === 'DELETE') {
        if (op.table === 'orders') success = await sbDeleteOrder(op.data.id);
        if (op.table === 'staff') success = await sbDeleteStaff(op.data.id);
        if (op.table === 'expenses') success = await sbDeleteExpense(op.data.id);
        if (op.table === 'deliveries') success = await sbDeleteDelivery(op.data.id);
        if (op.table === 'customers') success = await sbDeleteCustomer(op.data.id);
      }

      if (!success) {
        remainingQueue.push(op);
      } else {
        console.log('[DEBUG] Sincronização bem sucedida:', op.type, op.table, op.data?.id || op.data?.id);
      }
    } catch (e) {
      console.error('[DEBUG] Erro ao processar item da fila:', e);
      remainingQueue.push(op);
    }
  }

  saveSyncQueue(remainingQueue);
}
