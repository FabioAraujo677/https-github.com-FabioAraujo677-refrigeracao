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

function extractMissingColumn(errorMessage?: string): string | null {
  if (!errorMessage) return null;
  const pgrstMatch = errorMessage.match(/Could not find the '([^']+)' column/i);
  if (pgrstMatch?.[1]) return pgrstMatch[1];
  const pgMatch = errorMessage.match(/column "([^"]+)" (?:of relation|does not exist)/i);
  if (pgMatch?.[1]) return pgMatch[1];
  return null;
}

async function safeUpsert(tables: string[], item: any, companyId: string = getActiveCompanyId()): Promise<boolean> {
  for (const table of tables) {
    try {
      const { companyId: _cId, ...cleanItem } = item;
      let currentPayload: Record<string, any> = { company_id: companyId, ...cleanItem };

      for (let attempt = 0; attempt < 8; attempt++) {
        const { error } = await supabase.from(table).upsert([currentPayload]);
        if (!error) return true;

        const missingCol = extractMissingColumn(error.message);
        if (missingCol && Object.prototype.hasOwnProperty.call(currentPayload, missingCol)) {
          const { [missingCol]: _removed, ...nextPayload } = currentPayload;
          currentPayload = nextPayload;
          continue;
        }

        if (error.message?.includes('invalid input syntax for type uuid') && Object.prototype.hasOwnProperty.call(currentPayload, 'id')) {
          const { id: _removedId, ...nextPayload } = currentPayload;
          currentPayload = nextPayload;
          continue;
        }

        if (Object.prototype.hasOwnProperty.call(currentPayload, 'company_id')) {
          const { company_id: _c, ...nextPayload } = currentPayload;
          currentPayload = nextPayload;
          continue;
        }
        break;
      }
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
  const pName = row.name || row.full_name || (row.email ? row.email.split('@')[0] : '');
  const pPhone = row.phone || row.whatsapp || '';
  return {
    id: row.id,
    companyId: row.company_id || row.companyId || DEFAULT_COMPANY_ID,
    company_id: row.company_id || row.companyId || DEFAULT_COMPANY_ID,
    name: pName,
    full_name: pName,
    email: row.email || '',
    password: row.password || '123',
    role: row.role || 'tecnico',
    phone: pPhone,
    whatsapp: pPhone,
    notes: row.notes || '',
    active: row.active !== false,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    created_at: row.created_at || row.createdAt || new Date().toISOString(),
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

export function isUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

export function generateValidUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function sbSaveProfile(profile: any, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const mainCompanyId = 'icerefrigeracaopreventiva@gmail.com';
    const profileName = profile.name || profile.full_name || '';
    const profilePhone = profile.phone || profile.whatsapp || null;

    const validId = (profile.id && isUUID(profile.id)) ? profile.id : generateValidUUID();

    const payload = {
      id: validId,
      company_id: mainCompanyId,
      name: profileName,
      full_name: profileName,
      email: profile.email || null,
      password: profile.password || '123',
      role: profile.role || 'tecnico',
      phone: profilePhone,
      whatsapp: profilePhone,
      notes: profile.notes || null,
      active: profile.active !== false,
      created_at: profile.createdAt || profile.created_at || new Date().toISOString(),
    };

    const res = await safeUpsert(['profiles', 'users', 'staff'], payload, mainCompanyId);
    if (!res) {
      // Retry without explicit id so PostgreSQL default gen_random_uuid() kicks in
      const { id: _id, notes, password, whatsapp, full_name, ...minimalPayload } = payload;
      return await safeUpsert(['profiles', 'users', 'staff'], minimalPayload, mainCompanyId);
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
const NEO_META_START = '\n[NEO_META]';
const NEO_META_END = '[/NEO_META]';

function unpackOrderDescription(rawDesc?: string | null): { cleanDescription: string; meta: Record<string, any> } {
  if (!rawDesc || typeof rawDesc !== 'string') {
    return { cleanDescription: '', meta: {} };
  }
  const startIdx = rawDesc.indexOf(NEO_META_START);
  const altStartIdx = startIdx === -1 ? rawDesc.indexOf('[NEO_META]') : startIdx;
  const endIdx = rawDesc.indexOf(NEO_META_END);

  if (altStartIdx !== -1 && endIdx !== -1 && endIdx > altStartIdx) {
    const tagLen = rawDesc.slice(altStartIdx).startsWith(NEO_META_START) ? NEO_META_START.length : '[NEO_META]'.length;
    const jsonStr = rawDesc.slice(altStartIdx + tagLen, endIdx).trim();
    const cleanDescription = (rawDesc.slice(0, altStartIdx) + rawDesc.slice(endIdx + NEO_META_END.length)).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      return { cleanDescription, meta: parsed && typeof parsed === 'object' ? parsed : {} };
    } catch {
      return { cleanDescription: rawDesc, meta: {} };
    }
  }

  return { cleanDescription: rawDesc, meta: {} };
}

function packOrderDescription(cleanDesc: string, meta: Record<string, any>): string {
  const cleanedMeta: Record<string, any> = {};
  Object.entries(meta).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      cleanedMeta[key] = val;
    }
  });
  if (Object.keys(cleanedMeta).length === 0) return cleanDesc || '';
  return `${cleanDesc || ''}${NEO_META_START}${JSON.stringify(cleanedMeta)}${NEO_META_END}`;
}

const orderDbIdMap = new Map<string, string>();

export function normalizeOrder(row: any): WarrantyOrder {
  const { cleanDescription, meta } = unpackOrderDescription(row.description || row.service_description || row.serviceDescription || '');

  if (meta.displayId && row.id) {
    orderDbIdMap.set(String(meta.displayId), String(row.id));
  }

  const rawStatus =
    meta.attendanceStatus ||
    row.attendance_status ||
    row.attendanceStatus ||
    row.status ||
    'Na fila / Aguardando';

  const normalizedAttendanceStatus =
    rawStatus === 'pending' || rawStatus === 'Pendente' || rawStatus === 'Ativa'
      ? 'Na fila / Aguardando'
      : rawStatus;

  const techName =
    row.technician_name ||
    row.technicianName ||
    row.technician ||
    meta.technicianName ||
    row.tech_name ||
    row.tecnico ||
    row.tech ||
    row.assigned_to ||
    '';

  return {
    id: meta.displayId || row.id || `OS-${Date.now()}`,
    ...(row.id ? { dbId: row.id } : {}),
    company_id: row.company_id || DEFAULT_COMPANY_ID,
    companyId: row.company_id || row.companyId || DEFAULT_COMPANY_ID,
    createdAt: row.created_at || row.createdAt || meta.createdAt || new Date().toISOString(),
    attendanceStatus: normalizedAttendanceStatus,
    customerName: row.client_name || row.customer_name || row.customerName || row.clientName || '',
    customerPhone: row.client_phone || row.customer_phone || row.customerPhone || row.clientPhone || '',
    customerCpf: row.customer_cpf || row.customerCpf || row.client_cpf || meta.customerCpf || '',
    cep: row.cep || meta.cep || '',
    street: row.street || row.address || meta.street || '',
    number: row.number || meta.number || '',
    complement: row.complement || meta.complement || '',
    neighborhood: row.neighborhood || meta.neighborhood || '',
    city: row.city || meta.city || '',
    state: row.state || meta.state || '',
    applianceType: meta.applianceType || row.appliance_type || row.applianceType || row.equipment || 'Geladeira / Refrigerador',
    applianceBrand: row.appliance_brand || row.applianceBrand || meta.applianceBrand || '',
    applianceModel: row.appliance_model || row.applianceModel || meta.applianceModel || '',
    serialNumber: row.serial_number || row.serialNumber || meta.serialNumber || '',
    attendantName: row.attendant_name || row.attendantName || row.attendant || meta.attendantName || '',
    technicianName: techName,
    technicianId: row.technician_id || row.technicianId || meta.technicianId || undefined,
    technician_id: row.technician_id || row.technicianId || meta.technicianId || undefined,
    driverName: row.driver_name || row.driverName || row.driver || meta.driverName || '',
    defectDescription: row.problem_description || row.defect_description || row.defectDescription || row.problem || row.defect || '',
    serviceDescription: cleanDescription,
    partsReplaced: row.parts_replaced || row.partsReplaced || meta.partsReplaced || '',
    totalValue: Number(row.price ?? row.total_value ?? row.totalValue ?? 0),
    paymentMethod: row.payment_method || row.paymentMethod || meta.paymentMethod || 'Pix',
    paymentStatus: row.payment_status || row.paymentStatus || meta.paymentStatus || 'Pendente',
    warrantyMonths: Number(row.warranty_months ?? row.warrantyMonths ?? meta.warrantyMonths ?? 3),
    warrantyStartDate: row.warranty_start_date || row.warrantyStartDate || meta.warrantyStartDate,
    warrantyEndDate: row.warranty_end_date || row.warrantyEndDate || meta.warrantyEndDate || new Date().toISOString(),
    installments: row.installments ? Number(row.installments) : meta.installments ? Number(meta.installments) : undefined,
    orderType: row.order_type || row.orderType || meta.orderType || 'agendamento',
    scheduledDate: row.scheduled_date || row.scheduledDate || row.schedule_date,
    scheduledTime: row.scheduled_time || row.scheduledTime || row.schedule_time,
    visitFee: row.visit_fee !== undefined ? Number(row.visit_fee) : row.visitFee !== undefined ? Number(row.visitFee) : meta.visitFee !== undefined ? Number(meta.visitFee) : undefined,
    technicianLeadTimeAlert: row.technician_lead_time_alert || row.technicianLeadTimeAlert || meta.technicianLeadTimeAlert,
    technicianAcceptedAt: row.technician_accepted_at || row.technicianAcceptedAt || meta.technicianAcceptedAt,
    clientSignature: row.client_signature || row.clientSignature || meta.clientSignature,
    technicianSignature: row.technician_signature || row.technicianSignature || meta.technicianSignature,
    status: meta.warrantyStatus || (row.status === 'Expirada' || row.status === 'Cancelada' || row.status === 'Em Análise' ? row.status : 'Ativa'),
    notes: row.notes || meta.notes || '',
  };
}

const knownMissingServiceOrderCols = new Set<string>();

export async function sbGetOrders(_companyId: string = getActiveCompanyId()): Promise<WarrantyOrder[]> {
  try {
    let { data: directData, error: directErr } = await supabase
      .from('service_orders')
      .select('*')
      .order('scheduled_date', { ascending: false, nullsFirst: false });

    if (directErr) {
      console.warn('[Supabase Cloud SELECT ordered notice]:', directErr.message);
      const fallbackRes = await supabase
        .from('service_orders')
        .select('*');
      directData = fallbackRes.data;
      directErr = fallbackRes.error;
    }

    if (directErr) {
      console.error('[Supabase Cloud SELECT Error]:', directErr);
      return [];
    }

    if (directData) {
      return directData.map(normalizeOrder);
    }

    return [];
  } catch (err) {
    console.error('Supabase sbGetOrders exception:', err);
    return [];
  }
}

export async function sbSaveOrder(order: any, _companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const mainCompanyId = 'icerefrigeracaopreventiva@gmail.com';
    const techName = order.technicianName || order.technician_name || order.technician || '';
    const techId = order.technicianId || order.technician_id || null;
    const clientName = order.customerName || order.client_name || order.clientName || '';
    const clientPhone = order.customerPhone || order.client_phone || order.clientPhone || '';
    const equipmentStr = order.equipment || [order.applianceType, order.applianceBrand, order.applianceModel].filter(Boolean).join(' - ') || order.applianceType || '';
    const defectStr = order.defectDescription || order.problem_description || order.problem || order.defect || '';
    const { cleanDescription } = unpackOrderDescription(order.serviceDescription || order.service_description || order.description || '');
    const totalValNum = Number(order.totalValue ?? order.price ?? order.total_value ?? 0);
    const schedDate = order.scheduledDate || order.scheduled_date || order.schedule_date || null;
    const schedTime = order.scheduledTime || order.scheduled_time || order.schedule_time || null;
    const orderStatus = order.attendanceStatus || order.status || 'Na fila / Aguardando';
    const displayId = order.id || `OS-${Date.now()}`;
    const dbRowId = order.dbId || displayId;

    // Preserve extra application fields cleanly inside description metadata so no nonexistent columns cause 400 errors
    const packedDescription = packOrderDescription(cleanDescription, {
      displayId,
      attendanceStatus: orderStatus,
      warrantyStatus: order.status || 'Ativa',
      customerCpf: order.customerCpf,
      cep: order.cep,
      street: order.street,
      number: order.number,
      complement: order.complement,
      neighborhood: order.neighborhood,
      city: order.city,
      state: order.state,
      applianceType: order.applianceType,
      applianceBrand: order.applianceBrand,
      applianceModel: order.applianceModel,
      serialNumber: order.serialNumber,
      attendantName: order.attendantName,
      technicianName: techName,
      technicianId: techId,
      driverName: order.driverName,
      partsReplaced: order.partsReplaced,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      warrantyMonths: order.warrantyMonths,
      warrantyStartDate: order.warrantyStartDate,
      warrantyEndDate: order.warrantyEndDate,
      installments: order.installments,
      orderType: order.orderType || 'agendamento',
      visitFee: order.visitFee,
      priority: order.priority,
      notes: order.notes,
      technicianLeadTimeAlert: order.technicianLeadTimeAlert,
      technicianAcceptedAt: order.technicianAcceptedAt,
      clientSignature: order.clientSignature,
      technicianSignature: order.technicianSignature,
    });

    // Send strictly valid service_orders columns (eliminating nonexistent fields like notes, priority, totalOrders)
    let payload: Record<string, any> = {
      id: dbRowId,
      company_id: mainCompanyId,
      created_at: order.createdAt || order.created_at || new Date().toISOString(),
      client_name: clientName,
      client_phone: clientPhone,
      equipment: equipmentStr,
      description: packedDescription,
      problem_description: defectStr,
      scheduled_date: schedDate,
      scheduled_time: schedTime,
      technician_id: techId,
      technician_name: techName,
      status: orderStatus,
      price: totalValNum,
    };

    for (const missingCol of knownMissingServiceOrderCols) {
      delete payload[missingCol];
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const { error } = await supabase.from('service_orders').upsert([payload]);
      if (!error) {
        if (displayId && payload.id) {
          orderDbIdMap.set(String(displayId), String(payload.id));
        }
        console.log('[Supabase Cloud] Successfully saved order to service_orders:', displayId);
        return true;
      }

      const missingCol = extractMissingColumn(error.message);
      if (missingCol && Object.prototype.hasOwnProperty.call(payload, missingCol)) {
        knownMissingServiceOrderCols.add(missingCol);
        console.warn(`[Supabase Cloud] Stripping missing column '${missingCol}' from service_orders payload and retrying...`);
        const { [missingCol]: _removed, ...nextPayload } = payload;
        payload = nextPayload;
        continue;
      }

      if (error.message?.includes('invalid input syntax for type uuid')) {
        if (!isUUID(payload.id)) {
          const newUuid = generateValidUUID();
          const { id: _removedId, ...nextPayload } = payload;
          payload = { id: newUuid, ...nextPayload };
          if (order && typeof order === 'object') {
            order.dbId = newUuid;
          }
          continue;
        }
        if (payload.technician_id && !isUUID(payload.technician_id)) {
          const { technician_id: _removedTechId, ...nextPayload } = payload;
          payload = nextPayload;
          continue;
        }
      }

      console.error('[Supabase Cloud Error] Failed to save service_orders:', error);
      return false;
    }

    return false;
  } catch (err) {
    console.error('[Supabase Cloud Exception] sbSaveOrder error:', err);
    return false;
  }
}

export async function sbDeleteOrder(id: string): Promise<boolean> {
  try {
    const resolvedId = orderDbIdMap.get(id) || id;

    // 1. Delete directly by resolved primary key (UUID or text ID)
    const { data: deletedRows, error: directErr } = await supabase
      .from('service_orders')
      .delete()
      .eq('id', resolvedId)
      .select('id');

    if (!directErr && deletedRows && deletedRows.length > 0) {
      orderDbIdMap.delete(id);
      console.log('[Supabase Cloud] Order deleted from service_orders:', resolvedId);
      return true;
    }

    // 2. Fallback: find row by displayId stored inside description JSON metadata
    const { data: matchedRows, error: lookupErr } = await supabase
      .from('service_orders')
      .select('id')
      .ilike('description', `%"displayId":"${id}"%`);

    if (!lookupErr && matchedRows && matchedRows.length > 0) {
      const targetIds = matchedRows.map((r: any) => r.id).filter(Boolean);
      if (targetIds.length > 0) {
        const { error: delMatchErr } = await supabase
          .from('service_orders')
          .delete()
          .in('id', targetIds);
        if (!delMatchErr) {
          orderDbIdMap.delete(id);
          console.log('[Supabase Cloud] Order deleted via displayId metadata:', id);
          return true;
        }
      }
    }

    if (directErr) {
      console.error('[Supabase Cloud DELETE Error]:', directErr);
      return false;
    }

    orderDbIdMap.delete(id);
    return true;
  } catch (err) {
    console.error('[Supabase Cloud DELETE Exception]:', err);
    return false;
  }
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
      phone: customer.phone,
      cpf: customer.cpf || null,
      cep: customer.cep || '',
      street: customer.street || '',
      number: customer.number || '',
      complement: customer.complement || null,
      neighborhood: customer.neighborhood || '',
      city: customer.city || '',
      state: customer.state || '',
      last_service_date: customer.lastServiceDate,
      total_orders: customer.totalOrders,
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
