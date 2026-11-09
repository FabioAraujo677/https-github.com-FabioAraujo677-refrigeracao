import { supabase } from '../lib/supabaseClient';
import { User, WarrantyOrder, Expense, StaffMember, CompanySettings, DeliveryTask, CustomerRecord } from '../types';

const DEFAULT_COMPANY_ID = 'icerefrigeracaopreventiva@gmail.com';

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

// ==================== PROFILES (Users & Staff) ====================
export async function sbGetProfiles(companyId: string = getActiveCompanyId()): Promise<any[] | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Supabase sbGetProfiles error:', err);
    throw err;
  }
}

export async function sbSaveProfile(profile: any, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert([{ ...profile, company_id: companyId }]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase sbSaveProfile error:', err);
    throw err;
  }
}

export async function sbDeleteProfile(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase sbDeleteProfile error:', err);
    throw err;
  }
}

// Legacy compatibility wrappers
export async function sbGetUsers(companyId: string = getActiveCompanyId()) {
  return sbGetProfiles(companyId);
}
export async function sbSaveUser(user: User, companyId: string = getActiveCompanyId()) {
  return sbSaveProfile(user, companyId);
}
export async function sbGetStaff(companyId: string = getActiveCompanyId()) {
  return sbGetProfiles(companyId);
}
export async function sbSaveStaff(staff: StaffMember, companyId: string = getActiveCompanyId()) {
  return sbSaveProfile(staff, companyId);
}
export async function sbDeleteStaff(id: string) {
  return sbDeleteProfile(id);
}

// ==================== SERVICE ORDERS (Ordens de Serviço) ====================
export async function sbGetOrders(companyId: string = getActiveCompanyId()): Promise<WarrantyOrder[]> {
  try {
    const { data, error } = await supabase
      .from('service_orders')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as WarrantyOrder[];
  } catch (err) {
    console.error('Supabase sbGetOrders error:', err);
    throw err;
  }
}

export async function sbSaveOrder(order: WarrantyOrder, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const payload = { ...order, company_id: companyId };
    const { error } = await supabase
      .from('service_orders')
      .upsert([payload]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase sbSaveOrder error:', err);
    throw err;
  }
}

export async function sbDeleteOrder(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('service_orders')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase sbDeleteOrder error:', err);
    throw err;
  }
}

// ==================== CLIENTS (Clientes) ====================
export async function sbGetCustomers(companyId: string = getActiveCompanyId()): Promise<CustomerRecord[]> {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return (data || []) as CustomerRecord[];
  } catch (err) {
    console.error('Supabase sbGetCustomers error:', err);
    throw err;
  }
}

export async function sbSaveCustomer(customer: CustomerRecord, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const payload = { ...customer, company_id: companyId };
    const { error } = await supabase
      .from('clients')
      .upsert([payload]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase sbSaveCustomer error:', err);
    throw err;
  }
}

export async function sbDeleteCustomer(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase sbDeleteCustomer error:', err);
    throw err;
  }
}

// ==================== EXPENSES ====================
export async function sbGetExpenses(companyId: string = getActiveCompanyId()): Promise<Expense[]> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('company_id', companyId)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []) as Expense[];
  } catch (err) {
    console.error('Supabase sbGetExpenses error:', err);
    return [];
  }
}

export async function sbSaveExpense(expense: Expense, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const { error } = await supabase.from('expenses').upsert([{ ...expense, company_id: companyId }]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase saveExpense error:', err);
    return false;
  }
}

export async function sbDeleteExpense(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase deleteExpense error:', err);
    return false;
  }
}

// ==================== COMPANY SETTINGS ====================
export async function sbGetCompany(companyId: string = getActiveCompanyId()): Promise<CompanySettings | null> {
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
    console.error('Supabase getCompany error:', err);
    return null;
  }
}

export async function sbSaveCompany(company: CompanySettings, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const { error } = await supabase.from('company_settings').upsert([{ id: 1, company_id: companyId, ...company }]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase saveCompany error:', err);
    return false;
  }
}

// ==================== DELIVERIES ====================
export async function sbGetDeliveries(companyId: string = getActiveCompanyId()): Promise<DeliveryTask[]> {
  try {
    const { data, error } = await supabase.from('deliveries').select('*').eq('company_id', companyId);
    if (error) throw error;
    return (data || []) as DeliveryTask[];
  } catch (err) {
    console.error('Supabase getDeliveries error:', err);
    return [];
  }
}

export async function sbSaveDelivery(delivery: DeliveryTask, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const { error } = await supabase.from('deliveries').upsert([{ ...delivery, company_id: companyId }]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase saveDelivery error:', err);
    return false;
  }
}

export async function sbDeleteDelivery(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('deliveries').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase deleteDelivery error:', err);
    return false;
  }
}
