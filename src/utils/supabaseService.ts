import { supabase } from '../lib/supabaseClient';
import { User, WarrantyOrder, Expense, StaffMember, CompanySettings, DeliveryTask, CustomerRecord } from '../types';

const DEFAULT_COMPANY_ID = 'icerefrigeracaopreventiva@gmail.com';

let activeCompanyIdInMemory = DEFAULT_COMPANY_ID;

export function setActiveCompanyId(id: string) {
  if (id) activeCompanyIdInMemory = id;
}

export function getActiveCompanyId(): string {
  return activeCompanyIdInMemory;
}

// Resilient query runner with automatic fallback for missing company_id column or table names
async function safeSelect(tables: string[], companyId: string = getActiveCompanyId()): Promise<any[] | null> {
  for (const table of tables) {
    try {
      // 1. Try with company_id filter
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('company_id', companyId);

      if (!error && data) return data;

      // 2. If error code 42703 (column company_id does not exist) or error message mentions company_id
      if (error && (error.code === '42703' || error.message?.includes('company_id'))) {
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from(table)
          .select('*');
        if (!fallbackErr && fallbackData) return fallbackData;
      }
    } catch (err) {
      // Continue to next table option
    }
  }
  return null;
}

async function safeUpsert(tables: string[], item: any, companyId: string = getActiveCompanyId()): Promise<boolean> {
  for (const table of tables) {
    try {
      const { companyId: _cId, ...cleanItem } = item;
      const payloadWithCompany = { company_id: companyId, ...cleanItem };
      const { error } = await supabase.from(table).upsert([payloadWithCompany]);
      if (!error) return true;

      // Retry without company_id if column missing or error
      const { company_id, ...itemNoCompany } = payloadWithCompany;
      const { error: err2 } = await supabase.from(table).upsert([itemNoCompany]);
      if (!err2) return true;
    } catch (err) {
      console.warn(`Upsert exception on table ${table}:`, err);
    }
  }
  return false;
}

async function safeDelete(tables: string[], id: string): Promise<boolean> {
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (!error) return true;
    } catch (err) {}
  }
  return false;
}

// ==================== PROFILES (Users & Staff) ====================
function normalizeProfile(row: any) {
  return {
    id: row.id,
    companyId: row.company_id || row.companyId || DEFAULT_COMPANY_ID,
    name: row.name || row.full_name || (row.email ? row.email.split('@')[0] : ''),
    email: row.email || '',
    password: row.password || '123',
    role: row.role || 'tecnico',
    phone: row.phone || '',
    notes: row.notes || '',
    active: row.active !== false,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  };
}

export async function sbGetProfiles(companyId: string = getActiveCompanyId()): Promise<any[] | null> {
  try {
    const raw = await safeSelect(['profiles', 'users', 'staff'], companyId);
    if (!raw) return null;
    return raw.map(normalizeProfile);
  } catch (err) {
    console.warn('Supabase sbGetProfiles notice:', err);
    return null;
  }
}

export async function sbSaveProfile(profile: any, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const payload = {
      id: profile.id,
      name: profile.name || '',
      email: profile.email || null,
      password: profile.password || '123',
      role: profile.role || 'tecnico',
      phone: profile.phone || null,
      notes: profile.notes || null,
      active: profile.active !== false,
      created_at: profile.createdAt || profile.created_at || new Date().toISOString(),
    };
    const res = await safeUpsert(['profiles', 'users', 'staff'], payload, companyId);
    if (!res) {
      const { notes, password, ...minimalPayload } = payload;
      return await safeUpsert(['profiles', 'users', 'staff'], minimalPayload, companyId);
    }
    return res;
  } catch (err) {
    console.warn('Supabase sbSaveProfile notice:', err);
    return false;
  }
}

export async function sbDeleteProfile(id: string): Promise<boolean> {
  return await safeDelete(['profiles', 'users', 'staff'], id);
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
export function normalizeOrder(row: any): WarrantyOrder {
  return {
    id: row.id || `OS-${Date.now()}`,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    attendanceStatus: row.attendance_status || row.attendanceStatus || 'Na fila / Aguardando',
    customerName: row.customer_name || row.customerName || '',
    customerPhone: row.customer_phone || row.customerPhone || '',
    customerCpf: row.customer_cpf || row.customerCpf || '',
    cep: row.cep || '',
    street: row.street || '',
    number: row.number || '',
    complement: row.complement || '',
    neighborhood: row.neighborhood || '',
    city: row.city || '',
    state: row.state || '',
    applianceType: row.appliance_type || row.applianceType || 'Geladeira / Refrigerador',
    applianceBrand: row.appliance_brand || row.applianceBrand || '',
    applianceModel: row.appliance_model || row.applianceModel || '',
    serialNumber: row.serial_number || row.serialNumber || '',
    attendantName: row.attendant_name || row.attendantName || row.attendant || '',
    technicianName:
      row.technician_name ||
      row.technicianName ||
      row.technician ||
      row.technician_id ||
      row.tech_name ||
      row.tecnico ||
      row.tech ||
      row.assigned_to ||
      '',
    driverName: row.driver_name || row.driverName || row.driver || '',
    defectDescription: row.defect_description || row.defectDescription || '',
    serviceDescription: row.service_description || row.serviceDescription || '',
    partsReplaced: row.parts_replaced || row.partsReplaced || '',
    totalValue: Number(row.total_value ?? row.totalValue ?? 0),
    paymentMethod: row.payment_method || row.paymentMethod || 'Pix',
    paymentStatus: row.payment_status || row.paymentStatus || 'Pendente',
    warrantyMonths: Number(row.warranty_months ?? row.warrantyMonths ?? 3),
    warrantyStartDate: row.warranty_start_date || row.warrantyStartDate,
    warrantyEndDate: row.warranty_end_date || row.warrantyEndDate || new Date().toISOString(),
    installments: row.installments ? Number(row.installments) : undefined,
    orderType: row.order_type || row.orderType || 'garantia',
    scheduledDate: row.scheduled_date || row.scheduledDate,
    scheduledTime: row.scheduled_time || row.scheduledTime,
    visitFee: row.visit_fee !== undefined ? Number(row.visit_fee) : row.visitFee !== undefined ? Number(row.visitFee) : undefined,
    technicianLeadTimeAlert: row.technician_lead_time_alert || row.technicianLeadTimeAlert,
    technicianAcceptedAt: row.technician_accepted_at || row.technicianAcceptedAt,
    clientSignature: row.client_signature || row.clientSignature,
    technicianSignature: row.technician_signature || row.technicianSignature,
    status: row.status || 'Ativa',
    notes: row.notes || '',
  };
}

export async function sbGetOrders(companyId: string = getActiveCompanyId()): Promise<WarrantyOrder[]> {
  try {
    const raw = await safeSelect(['service_orders', 'orders'], companyId);
    if (!raw) return [];
    return raw.map(normalizeOrder);
  } catch (err) {
    console.warn('Supabase sbGetOrders notice:', err);
    return [];
  }
}

export async function sbSaveOrder(order: WarrantyOrder, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const techName = order.technicianName || (order as any).technician_name || (order as any).technician || '';
    const techId = order.technicianId || (order as any).technician_id || null;

    const snakePayload = {
      id: order.id,
      company_id: companyId,
      created_at: order.createdAt || new Date().toISOString(),
      attendance_status: order.attendanceStatus || 'Na fila / Aguardando',
      customer_name: order.customerName || '',
      customer_phone: order.customerPhone || '',
      customer_cpf: order.customerCpf || null,
      cep: order.cep || '',
      street: order.street || '',
      number: order.number || '',
      complement: order.complement || null,
      neighborhood: order.neighborhood || '',
      city: order.city || '',
      state: order.state || '',
      appliance_type: order.applianceType || '',
      appliance_brand: order.applianceBrand || '',
      appliance_model: order.applianceModel || null,
      serial_number: order.serialNumber || null,
      attendant_name: order.attendantName || '',
      technician_name: techName,
      technician_id: techId,
      driver_name: order.driverName || null,
      defect_description: order.defectDescription || '',
      service_description: order.serviceDescription || '',
      parts_replaced: order.partsReplaced || '',
      total_value: Number(order.totalValue || 0),
      payment_method: order.paymentMethod || 'Pix',
      payment_status: order.paymentStatus || 'Pendente',
      warranty_months: Number(order.warrantyMonths || 3),
      warranty_start_date: order.warrantyStartDate || null,
      warranty_end_date: order.warrantyEndDate || null,
      installments: order.installments ? Number(order.installments) : null,
      order_type: order.orderType || 'agendamento',
      scheduled_date: order.scheduledDate || null,
      scheduled_time: order.scheduledTime || null,
      visit_fee: order.visitFee !== undefined ? Number(order.visitFee) : null,
      technician_lead_time_alert: order.technicianLeadTimeAlert || null,
      technician_accepted_at: order.technicianAcceptedAt || null,
      client_signature: order.clientSignature || null,
      technician_signature: order.technicianSignature || null,
      status: order.status || 'Ativa',
      notes: order.notes || null,
    };

    const res = await safeUpsert(['service_orders', 'orders'], snakePayload, companyId);
    if (!res) {
      const { error } = await supabase.from('service_orders').upsert([snakePayload]);
      if (error) {
        console.warn('Direct fallback upsert to service_orders error:', error.message);
      } else {
        return true;
      }
    }
    return res;
  } catch (err) {
    console.warn('Supabase sbSaveOrder notice:', err);
    return false;
  }
}

export async function sbDeleteOrder(id: string): Promise<boolean> {
  return await safeDelete(['service_orders', 'orders'], id);
}

// ==================== CLIENTS (Clientes) ====================
function normalizeCustomer(row: any): CustomerRecord {
  return {
    id: row.id || `CUST-${Date.now()}`,
    name: row.name || row.customer_name || row.customerName || '',
    phone: row.phone || row.customer_phone || row.customerPhone || '',
    cpf: row.cpf || row.customer_cpf || row.customerCpf,
    cep: row.cep || '',
    street: row.street || '',
    number: row.number || '',
    complement: row.complement,
    neighborhood: row.neighborhood || '',
    city: row.city || '',
    state: row.state || '',
    lastServiceDate: row.last_service_date || row.lastServiceDate || new Date().toISOString(),
    totalOrders: Number(row.total_orders ?? row.totalOrders ?? 1),
  };
}

export async function sbGetCustomers(companyId: string = getActiveCompanyId()): Promise<CustomerRecord[]> {
  try {
    const raw = await safeSelect(['clients', 'customers'], companyId);
    if (!raw) return [];
    return raw.map(normalizeCustomer);
  } catch (err) {
    console.warn('Supabase sbGetCustomers notice:', err);
    return [];
  }
}

export async function sbSaveCustomer(customer: CustomerRecord, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const payload = {
      id: customer.id,
      name: customer.name,
      customer_name: customer.name,
      phone: customer.phone,
      customer_phone: customer.phone,
      cpf: customer.cpf,
      customer_cpf: customer.cpf,
      cep: customer.cep,
      street: customer.street,
      number: customer.number,
      complement: customer.complement,
      neighborhood: customer.neighborhood,
      city: customer.city,
      state: customer.state,
      last_service_date: customer.lastServiceDate,
      lastServiceDate: customer.lastServiceDate,
      total_orders: customer.totalOrders,
      totalOrders: customer.totalOrders,
    };
    return await safeUpsert(['clients', 'customers'], payload, companyId);
  } catch (err) {
    console.warn('Supabase sbSaveCustomer notice:', err);
    return false;
  }
}

export async function sbDeleteCustomer(id: string): Promise<boolean> {
  return await safeDelete(['clients', 'customers'], id);
}

// ==================== EXPENSES ====================
export async function sbGetExpenses(companyId: string = getActiveCompanyId()): Promise<Expense[]> {
  try {
    const raw = await safeSelect(['expenses'], companyId);
    if (!raw) return [];
    return raw as Expense[];
  } catch (err) {
    console.warn('Supabase sbGetExpenses notice:', err);
    return [];
  }
}

export async function sbSaveExpense(expense: Expense, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    return await safeUpsert(['expenses'], expense, companyId);
  } catch (err) {
    console.warn('Supabase sbSaveExpense notice:', err);
    return false;
  }
}

export async function sbDeleteExpense(id: string): Promise<boolean> {
  return await safeDelete(['expenses'], id);
}

// ==================== COMPANY SETTINGS ====================
export async function sbGetCompany(companyId: string = getActiveCompanyId()): Promise<CompanySettings | null> {
  try {
    const raw = await safeSelect(['company_settings', 'company'], companyId);
    if (!raw || raw.length === 0) return null;
    return raw[0] as CompanySettings;
  } catch (err) {
    console.warn('Supabase sbGetCompany notice:', err);
    return null;
  }
}

export async function sbSaveCompany(company: CompanySettings, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const payload = (company as any).id ? { ...company } : { ...company, company_id: companyId };
    const ok = await safeUpsert(['company_settings', 'company'], payload, companyId);
    if (!ok) {
      // Retry without explicit id field
      const { id, ...payloadNoId } = payload as any;
      return await safeUpsert(['company_settings', 'company'], payloadNoId, companyId);
    }
    return ok;
  } catch (err) {
    console.warn('Supabase sbSaveCompany notice:', err);
    return false;
  }
}

// ==================== DELIVERIES ====================
export async function sbGetDeliveries(companyId: string = getActiveCompanyId()): Promise<DeliveryTask[]> {
  try {
    const raw = await safeSelect(['deliveries'], companyId);
    if (!raw) return [];
    return raw as DeliveryTask[];
  } catch (err) {
    console.warn('Supabase sbGetDeliveries notice:', err);
    return [];
  }
}

export async function sbSaveDelivery(delivery: DeliveryTask, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    return await safeUpsert(['deliveries'], delivery, companyId);
  } catch (err) {
    console.warn('Supabase sbSaveDelivery notice:', err);
    return false;
  }
}

export async function sbDeleteDelivery(id: string): Promise<boolean> {
  return await safeDelete(['deliveries'], id);
}
