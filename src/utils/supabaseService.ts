import { superdb } from '../lib/superdbClient';
import { User, WarrantyOrder, Expense, StaffMember, CompanySettings, DeliveryTask, CustomerRecord, CarneSale, CarneSettings } from '../types';

const DEFAULT_COMPANY_ID = '';
let activeCompanyIdInMemory = '';

let supabaseSyncAuthorizedInMemory = false;
const missingTablesInMemory = new Set<string>();

export function setSupabaseSyncAuthorized(authorized: boolean) {
  supabaseSyncAuthorizedInMemory = Boolean(authorized);
}

export function isSupabaseSyncAuthorized(): boolean {
  return supabaseSyncAuthorizedInMemory;
}

function isTableNotFoundError(error: any, status?: number | null): boolean {
  if (status === 404) return true;
  if (!error) return false;
  const errStatus = Number(error.status ?? error.statusCode ?? 0);
  const code = String(error.code ?? '');
  const text = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  return (
    errStatus === 404 ||
    code === 'PGRST205' ||
    code === '42P01' ||
    text.includes('could not find the table') ||
    (text.includes('relation') && text.includes('does not exist')) ||
    text.includes('404')
  );
}

const knownMissingCompanyIdTables = new Set<string>();

export function normalizeTableName(table: string): string {
  return String(table || '').replace(/^public\./i, '').trim();
}

export function resolveCompanyId(companyId?: string | null): string {
  if (typeof companyId === 'string') {
    const trimmed = companyId.trim();
    if (
      trimmed !== '' &&
      !trimmed.includes('[object') &&
      trimmed !== 'undefined' &&
      trimmed !== 'null'
    ) {
      return trimmed;
    }
  }
  return activeCompanyIdInMemory || DEFAULT_COMPANY_ID;
}

export function setActiveCompanyId(id: string) {
  const resolved = resolveCompanyId(id);
  if (resolved) activeCompanyIdInMemory = resolved;
}

export function getActiveCompanyId(): string {
  return activeCompanyIdInMemory;
}

export async function sbSelectByCompany(
  table: string,
  companyId?: string | null,
  options?: { orderBy?: string; ascending?: boolean; nullsFirst?: boolean; limit?: number }
): Promise<{ data: any[] | null; error: any; status?: number | null }> {
  const cleanTable = normalizeTableName(table);
  const targetCompanyId = resolveCompanyId(companyId);

  if (missingTablesInMemory.has(cleanTable)) {
    return { data: null, error: { message: `Table ${cleanTable} missing` }, status: 404 };
  }

  const runQuery = async (useCompanyFilter: boolean, useOrder: boolean) => {
    let query: any = superdb.from(cleanTable).select('*');
    if (useCompanyFilter) {
      query = query.eq('company_id', targetCompanyId);
    }
    if (useOrder && options?.orderBy) {
      query = query.order(options.orderBy, {
        ascending: options.ascending ?? false,
        nullsFirst: options.nullsFirst ?? false,
      });
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    return await query;
  };

  let useCompanyFilter = !knownMissingCompanyIdTables.has(cleanTable);
  let useOrder = Boolean(options?.orderBy);

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { data, error, status } = await runQuery(useCompanyFilter, useOrder);
      if (!error) {
        return { data: Array.isArray(data) ? data : [], error: null, status };
      }

      if (isTableNotFoundError(error, status)) {
        missingTablesInMemory.add(cleanTable);
        return { data: null, error, status };
      }

      const missingCol = extractMissingColumn(error.message);
      if (missingCol === 'company_id' && useCompanyFilter) {
        knownMissingCompanyIdTables.add(cleanTable);
        useCompanyFilter = false;
        continue;
      }

      if (useOrder && options?.orderBy && (!missingCol || missingCol === options.orderBy)) {
        useOrder = false;
        continue;
      }

      if (useCompanyFilter && String(error.message || '').toLowerCase().includes('company_id')) {
        knownMissingCompanyIdTables.add(cleanTable);
        useCompanyFilter = false;
        continue;
      }

      return { data: null, error, status };
    } catch (err) {
      if (isTableNotFoundError(err)) {
        missingTablesInMemory.add(cleanTable);
      }
      return { data: null, error: err };
    }
  }

  return { data: null, error: null };
}

// Resilient query runner with clean select filtered by company_id and fallback
async function safeSelect(tables: string[], companyId?: string | null): Promise<any[] | null> {
  if (!isSupabaseSyncAuthorized()) {
    return null;
  }

  const targetCompanyId = resolveCompanyId(companyId);

  for (const rawTable of tables) {
    const table = normalizeTableName(rawTable);
    if (missingTablesInMemory.has(table)) {
      continue;
    }

    const { data, error, status } = await sbSelectByCompany(table, targetCompanyId);
    if (!error && Array.isArray(data)) {
      return data;
    }
    if (isTableNotFoundError(error, status)) {
      missingTablesInMemory.add(table);
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

async function safeUpsert(tables: string[], item: any, companyId?: string | null): Promise<boolean> {
  if (!isSupabaseSyncAuthorized()) {
    return false;
  }

  const cleanCompanyId = resolveCompanyId(companyId);

  for (const rawTable of tables) {
    const table = normalizeTableName(rawTable);
    if (missingTablesInMemory.has(table)) {
      continue;
    }

    try {
      const { companyId: _cId, ...cleanItem } = item;
      let currentPayload: Record<string, any> = { company_id: cleanCompanyId, ...cleanItem };

      for (let attempt = 0; attempt < 8; attempt++) {
        const { error, status } = await superdb.from(table).upsert([currentPayload]);
        if (!error) return true;

        if (isTableNotFoundError(error, status)) {
          missingTablesInMemory.add(table);
          break;
        }

        const missingCol = extractMissingColumn(error.message);
        if (missingCol && Object.prototype.hasOwnProperty.call(currentPayload, missingCol)) {
          if (missingCol === 'company_id') {
            knownMissingCompanyIdTables.add(table);
          }
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
      if (isTableNotFoundError(err)) {
        missingTablesInMemory.add(table);
      }
      console.warn(`Upsert exception on table ${table}:`, err);
    }
  }
  return false;
}

async function safeDelete(tables: string[], id: string, companyId: string = getActiveCompanyId()): Promise<boolean> {
  if (!isSupabaseSyncAuthorized()) {
    return false;
  }

  const targetCompanyId = resolveCompanyId(companyId);

  for (const rawTable of tables) {
    const table = normalizeTableName(rawTable);
    if (missingTablesInMemory.has(table)) {
      continue;
    }

    try {
      let query: any = superdb.from(table).delete().eq('id', id);
      if (!knownMissingCompanyIdTables.has(table)) {
        query = query.eq('company_id', targetCompanyId);
      }
      let { error, status } = await query;

      if (error && extractMissingColumn(error.message) === 'company_id') {
        knownMissingCompanyIdTables.add(table);
        const retry = await superdb.from(table).delete().eq('id', id);
        error = retry.error;
        status = retry.status;
      }

      if (!error) return true;
      if (isTableNotFoundError(error, status)) {
        missingTablesInMemory.add(table);
      }
    } catch (err) {
      if (isTableNotFoundError(err)) {
        missingTablesInMemory.add(table);
      }
    }
  }
  return false;
}

// ==================== PROFILES (Users & Staff) ====================
export function normalizeProfile(row: any) {
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
    const targetCompanyId = resolveCompanyId(profile?.companyId || profile?.company_id || companyId);
    const profileName = profile.name || profile.full_name || '';
    const profilePhone = profile.phone || profile.whatsapp || null;

    const validId = (profile.id && isUUID(profile.id)) ? profile.id : generateValidUUID();

    const payload = {
      id: validId,
      company_id: targetCompanyId,
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

    const res = await safeUpsert(['profiles', 'users', 'staff'], payload, targetCompanyId);
    if (!res) {
      // Retry without explicit id so PostgreSQL default gen_random_uuid() kicks in
      const { id: _id, notes, password, whatsapp, full_name, ...minimalPayload } = payload;
      return await safeUpsert(['profiles', 'users', 'staff'], minimalPayload, targetCompanyId);
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

export function unpackOrderDescription(rawDesc?: string | null): { cleanDescription: string; meta: Record<string, any> } {
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

export function packOrderDescription(cleanDesc: string, meta: Record<string, any>): string {
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
    orderType: (() => {
      const resolvedDisplayId = String(meta.displayId || row.id || '').trim().toUpperCase();
      const resolvedCustomer = String(
        row.client_name || row.customer_name || row.customerName || row.clientName || ''
      ).toLowerCase();
      const isGiLoja = resolvedDisplayId === 'OS-2026-1056' || resolvedCustomer.includes('gi loja de bolo');
      if (isGiLoja) return 'garantia_direta';
      return (
        row.order_type ||
        row.orderType ||
        meta.orderType ||
        (row.scheduled_date || row.scheduledDate || row.schedule_date ? 'agendamento' : 'garantia')
      );
    })(),
    dispatchMode: row.dispatch_mode || row.dispatchMode || meta.dispatchMode,
    scheduledDate: row.scheduled_date || row.scheduledDate || row.schedule_date,
    scheduledTime: row.scheduled_time || row.scheduledTime || row.schedule_time,
    visitFee: row.visit_fee !== undefined ? Number(row.visit_fee) : row.visitFee !== undefined ? Number(row.visitFee) : meta.visitFee !== undefined ? Number(meta.visitFee) : undefined,
    technicianLeadTimeAlert: row.technician_lead_time_alert || row.technicianLeadTimeAlert || meta.technicianLeadTimeAlert,
    technicianAlertAcknowledgedAt: row.technician_alert_acknowledged_at || row.technicianAlertAcknowledgedAt || meta.technicianAlertAcknowledgedAt,
    technicianAcceptedAt: row.technician_accepted_at || row.technicianAcceptedAt || meta.technicianAcceptedAt,
    completedAt: row.completed_at || row.completedAt || meta.completedAt,
    clientSignature: row.client_signature || row.clientSignature || meta.clientSignature,
    technicianSignature: row.technician_signature || row.technicianSignature || meta.technicianSignature,
    status: meta.warrantyStatus || (row.status === 'Expirada' || row.status === 'Cancelada' || row.status === 'Em Análise' || row.status === 'RETORNO' ? row.status : 'Ativa'),
    isReturn: Boolean(row.is_return ?? row.isReturn ?? meta.isReturn ?? (String(row.status || '').trim() === 'RETORNO')),
    is_return: Boolean(row.is_return ?? row.isReturn ?? meta.isReturn ?? (String(row.status || '').trim() === 'RETORNO')),
    priority: row.priority || meta.priority || undefined,
    returnReason: row.return_reason || meta.returnReason || undefined,
    returnScheduledAt: row.return_scheduled_at || meta.returnScheduledAt || undefined,
    notes: row.notes || meta.notes || '',
    ...(meta.paidVisitOnly !== undefined ? { paidVisitOnly: Boolean(meta.paidVisitOnly) } : {}),
  };
}

const knownMissingServiceOrderCols = new Set<string>();
const autoFixedGiOrderIds = new Set<string>();

export function syncGiLojaDeBoloOrderTypeIfNeeded(rawRows: any[], normalizedOrders: WarrantyOrder[]): void {
  for (let i = 0; i < normalizedOrders.length; i++) {
    const ord = normalizedOrders[i];
    const isGiLoja =
      String(ord.id || '').trim().toUpperCase() === 'OS-2026-1056' ||
      String(ord.customerName || '').toLowerCase().includes('gi loja de bolo');
    if (!isGiLoja || autoFixedGiOrderIds.has(ord.id)) continue;

    const rawRow = rawRows[i];
    let rawMeta: Record<string, any> = {};
    try {
      if (typeof rawRow?.description === 'string' && rawRow.description.includes('__META__:')) {
        const idx = rawRow.description.indexOf('__META__:');
        rawMeta = JSON.parse(rawRow.description.slice(idx + '__META__:'.length));
      }
    } catch {}
    const rawType = rawRow?.order_type || rawRow?.orderType || rawMeta?.orderType;
    autoFixedGiOrderIds.add(ord.id);
    if (rawType !== 'garantia_direta') {
      sbSaveOrder({ ...ord, orderType: 'garantia_direta' }).catch(() => {});
    }
  }
}

export async function sbGetOrders(companyId: string = getActiveCompanyId()): Promise<WarrantyOrder[]> {
  if (!isSupabaseSyncAuthorized() || missingTablesInMemory.has('service_orders')) {
    return [];
  }

  try {
    const { data: directData, error: directErr } = await sbSelectByCompany(
      'service_orders',
      companyId,
      { orderBy: 'scheduled_date', ascending: false, nullsFirst: false }
    );

    if (directErr) {
      console.error('[SuperDB Cloud SELECT Error]:', directErr);
      return [];
    }

    if (directData) {
      const regularRows = directData.filter((row: any) => !isCarneOrderRow(row) && !isCarneConfigRow(row));
      const normalized = regularRows.map(normalizeOrder);
      syncGiLojaDeBoloOrderTypeIfNeeded(regularRows, normalized);
      return normalized;
    }

    return [];
  } catch (err) {
    if (isTableNotFoundError(err)) {
      missingTablesInMemory.add('service_orders');
    }
    console.error('SuperDB sbGetOrders exception:', err);
    return [];
  }
}

export async function sbSaveOrder(order: any, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const targetCompanyId = resolveCompanyId(order?.companyId || order?.company_id || companyId);
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
      orderType: order.orderType || (schedDate ? 'agendamento' : 'garantia'),
      dispatchMode: order.dispatchMode,
      visitFee: order.visitFee,
      paidVisitOnly: (order as any).paidVisitOnly,
      isReturn: Boolean(order.isReturn ?? order.is_return),
      returnReason: order.returnReason,
      returnScheduledAt: order.returnScheduledAt,
      priority: order.priority,
      notes: order.notes,
      technicianLeadTimeAlert: order.technicianLeadTimeAlert,
      technicianAlertAcknowledgedAt: order.technicianAlertAcknowledgedAt,
      technicianAcceptedAt: order.technicianAcceptedAt,
      completedAt: order.completedAt || order.completed_at,
      clientSignature: order.clientSignature,
      technicianSignature: order.technicianSignature,
    });

    // Send strictly valid service_orders columns (eliminating nonexistent fields like notes, priority, totalOrders)
    let payload: Record<string, any> = {
      id: dbRowId,
      company_id: targetCompanyId,
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
      is_return: Boolean(order.isReturn ?? order.is_return),
      price: totalValNum,
    };

    for (const missingCol of knownMissingServiceOrderCols) {
      delete payload[missingCol];
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const { error } = await superdb.from('service_orders').upsert([payload]);
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

export async function sbDeleteOrder(id: string, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const targetCompanyId = resolveCompanyId(companyId);
    const resolvedId = orderDbIdMap.get(id) || id;
    const useCompanyFilter = !knownMissingCompanyIdTables.has('service_orders');

    // 1. Delete directly by resolved primary key (UUID or text ID) scoped by company_id
    let delQuery: any = superdb
      .from('service_orders')
      .delete()
      .eq('id', resolvedId);
    if (useCompanyFilter) {
      delQuery = delQuery.eq('company_id', targetCompanyId);
    }

    let { data: deletedRows, error: directErr } = await delQuery.select('id');

    if (directErr && extractMissingColumn(directErr.message) === 'company_id') {
      knownMissingCompanyIdTables.add('service_orders');
      const retry = await superdb
        .from('service_orders')
        .delete()
        .eq('id', resolvedId)
        .select('id');
      deletedRows = retry.data;
      directErr = retry.error;
    }

    if (!directErr && deletedRows && deletedRows.length > 0) {
      orderDbIdMap.delete(id);
      console.log('[SuperDB Cloud] Order deleted from service_orders:', resolvedId);
      return true;
    }

    // 2. Fallback: find row by displayId stored inside description JSON metadata
    let lookupQuery: any = superdb
      .from('service_orders')
      .select('id')
      .ilike('description', `%"displayId":"${id}"%`);
    if (!knownMissingCompanyIdTables.has('service_orders')) {
      lookupQuery = lookupQuery.eq('company_id', targetCompanyId);
    }

    const { data: matchedRows, error: lookupErr } = await lookupQuery;

    if (!lookupErr && matchedRows && matchedRows.length > 0) {
      const targetIds = matchedRows.map((r: any) => r.id).filter(Boolean);
      if (targetIds.length > 0) {
        let delMatchQuery: any = superdb
          .from('service_orders')
          .delete()
          .in('id', targetIds);
        if (!knownMissingCompanyIdTables.has('service_orders')) {
          delMatchQuery = delMatchQuery.eq('company_id', targetCompanyId);
        }
        const { error: delMatchErr } = await delMatchQuery;
        if (!delMatchErr) {
          orderDbIdMap.delete(id);
          console.log('[SuperDB Cloud] Order deleted via displayId metadata:', id);
          return true;
        }
      }
    }

    if (directErr) {
      console.error('[SuperDB Cloud DELETE Error]:', directErr);
      return false;
    }

    orderDbIdMap.delete(id);
    return true;
  } catch (err) {
    console.error('[SuperDB Cloud DELETE Exception]:', err);
    return false;
  }
}

// ==================== CLIENTS (Clientes) ====================
export function normalizeCustomer(row: any): CustomerRecord {
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
export function normalizeCompanyProfile(rawRow: any): CompanySettings {
  const row =
    rawRow?.dados && typeof rawRow.dados === 'object'
      ? { ...rawRow.dados, ...rawRow }
      : rawRow || {};

  const cidadeUfRaw = typeof row.cidade_uf === 'string' ? row.cidade_uf : '';
  const hasSlash = cidadeUfRaw.includes('/');
  const parsedCity = hasSlash
    ? cidadeUfRaw.split('/')[0]?.trim() ?? ''
    : row.cidade ?? row.city ?? cidadeUfRaw;
  const parsedState = hasSlash
    ? cidadeUfRaw.split('/').slice(1).join('/').trim() ?? ''
    : row.uf ?? row.estado ?? row.state ?? '';

  return {
    name: row.nome_fantasia ?? row.nome ?? row.name ?? '',
    slogan: row.slogan ?? '',
    cnpj: row.cnpj ?? '',
    phone: row.telefone ?? row.telefone_principal ?? row.phone ?? '',
    whatsapp: row.whatsapp ?? '',
    email: row.email ?? '',
    cep: row.cep ?? '',
    street: row.rua ?? row.logradouro ?? row.street ?? '',
    number: row.numero ?? row.number ?? '',
    neighborhood: row.bairro ?? row.neighborhood ?? '',
    city: parsedCity,
    state: parsedState,
    businessHours: row.horario_funcionamento ?? row.horario ?? row.business_hours ?? row.businessHours ?? '',
    logoUrl: row.logo_url ?? row.logoUrl ?? row.logo ?? '',
    warrantyTerms: row.termos_garantia ?? row.termos ?? row.warranty_terms ?? row.warrantyTerms ?? '',
    pixKey: row.chave_pix ?? row.pix_key ?? row.pixKey ?? rawRow?.dados?.pixKey ?? '',
    pixCity: row.cidade_pix ?? row.pix_city ?? row.pixCity ?? rawRow?.dados?.pixCity ?? '',
  };
}

export async function sbGetCompany(companyId: string = getActiveCompanyId()): Promise<CompanySettings | null> {
  if (!isSupabaseSyncAuthorized()) {
    return null;
  }

  const targetCompanyId = resolveCompanyId(companyId);

  try {
    if (!missingTablesInMemory.has('perfil_empresa')) {
      const { data: perfilData, error: perfilErr, status: perfilStatus } = await sbSelectByCompany(
        'perfil_empresa',
        targetCompanyId,
        { limit: 1 }
      );

      if (!perfilErr && Array.isArray(perfilData) && perfilData.length > 0) {
        return normalizeCompanyProfile(perfilData[0]);
      }

      if (isTableNotFoundError(perfilErr, perfilStatus)) {
        missingTablesInMemory.add('perfil_empresa');
      }
    }

    const raw = await safeSelect(['company_settings', 'company'], targetCompanyId);
    if (!raw || raw.length === 0) return null;
    return normalizeCompanyProfile(raw[0]);
  } catch (err) {
    console.warn('SuperDB sbGetCompany notice:', err);
    return null;
  }
}

export async function sbSaveCompany(company: CompanySettings, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const targetCompanyId = resolveCompanyId(companyId);
    const cidadeUfFormatted = [company.city?.trim(), company.state?.trim()].filter(Boolean).join('/');
    let existingId: string | number = 1;

    try {
      const { data: existingRows } = await sbSelectByCompany('perfil_empresa', targetCompanyId, { limit: 1 });
      if (Array.isArray(existingRows) && existingRows.length > 0 && existingRows[0]?.id !== undefined) {
        existingId = existingRows[0].id;
      }
    } catch {}

    let currentPayload: Record<string, any> = {
      id: existingId,
      company_id: targetCompanyId,
      nome_fantasia: company.name?.trim() || '',
      cnpj: company.cnpj?.trim() || '',
      slogan: company.slogan?.trim() || '',
      cep: company.cep?.trim() || '',
      rua: company.street?.trim() || '',
      numero: company.number?.trim() || '',
      bairro: company.neighborhood?.trim() || '',
      cidade_uf: cidadeUfFormatted,
      telefone: company.phone?.trim() || '',
      whatsapp: company.whatsapp?.trim() || '',
      email: company.email?.trim() || '',
      horario_funcionamento: company.businessHours?.trim() || '',
      termos_garantia: company.warrantyTerms?.trim() || '',
      logo_url: company.logoUrl || '',
      chave_pix: company.pixKey?.trim() || '',
      cidade_pix: company.pixCity?.trim() || '',
      dados: company,
    };

    for (let attempt = 0; attempt < 8; attempt++) {
      const { error, status } = await superdb
        .from('perfil_empresa')
        .upsert([currentPayload], { onConflict: 'id' });

      if (!error) return true;
      if (isTableNotFoundError(error, status)) {
        missingTablesInMemory.add('perfil_empresa');
        break;
      }

      const missingCol = extractMissingColumn(error.message);
      if (missingCol && Object.prototype.hasOwnProperty.call(currentPayload, missingCol)) {
        if (missingCol === 'company_id') {
          knownMissingCompanyIdTables.add('perfil_empresa');
        }
        const { [missingCol]: _removed, ...nextPayload } = currentPayload;
        currentPayload = nextPayload;
        continue;
      }

      if (error.message?.includes('invalid input syntax for type uuid') && Object.prototype.hasOwnProperty.call(currentPayload, 'id')) {
        const { id: _removedId, ...nextPayload } = currentPayload;
        currentPayload = nextPayload;
        continue;
      }
      break;
    }

    return await safeUpsert(['company_settings', 'company'], {
      id: existingId,
      name: company.name?.trim() || '',
      slogan: company.slogan?.trim() || '',
      cnpj: company.cnpj?.trim() || '',
      phone: company.phone?.trim() || '',
      whatsapp: company.whatsapp?.trim() || '',
      email: company.email?.trim() || '',
      cep: company.cep?.trim() || '',
      street: company.street?.trim() || '',
      number: company.number?.trim() || '',
      neighborhood: company.neighborhood?.trim() || '',
      city: company.city?.trim() || '',
      state: company.state?.trim() || '',
      business_hours: company.businessHours?.trim() || '',
      logo_url: company.logoUrl || '',
      warranty_terms: company.warrantyTerms?.trim() || '',
    }, targetCompanyId);
  } catch (err) {
    console.warn('SuperDB sbSaveCompany notice:', err);
    return false;
  }
}

// ==================== VENDA CARNÊ (Persistido em service_orders com recordType='carne') ====================
const carneDbIdMap = new Map<string, string>();

export function isCarneOrderRow(row: any): boolean {
  if (!row) return false;
  if (row.equipment === 'VENDA_CARNE' || row.status === 'CARNE_VENDA') return true;
  const { meta } = unpackOrderDescription(row.description);
  return meta?.recordType === 'carne';
}

export function isCarneConfigRow(row: any): boolean {
  if (!row) return false;
  if (row.equipment === 'CARNE_CONFIG' || row.status === 'CARNE_CONFIG') return true;
  const { meta } = unpackOrderDescription(row.description);
  return meta?.recordType === 'carne_config';
}

export function extractCarneFromOrderRow(row: any): CarneSale | null {
  try {
    const { cleanDescription, meta } = unpackOrderDescription(row.description);
    if (meta?.recordType !== 'carne' && row.equipment !== 'VENDA_CARNE' && row.status !== 'CARNE_VENDA') {
      return null;
    }
    const carneData = meta?.carneData;
    const carneId = carneData?.id || meta?.displayId || row.id;
    if (!carneId) return null;
    if (row.id) {
      carneDbIdMap.set(String(carneId), String(row.id));
    }
    if (carneData && typeof carneData === 'object') {
      return {
        ...carneData,
        id: String(carneId),
      } as CarneSale;
    }
    return {
      id: String(carneId),
      createdAt: row.created_at || new Date().toISOString(),
      customerName: row.client_name || '',
      customerPhone: row.client_phone || '',
      description: row.problem_description || cleanDescription || '',
      totalValue: Number(row.price ?? 0),
      installmentValue: Number(row.price ?? 0),
      installmentsCount: 1,
      firstDueDate: row.scheduled_date || '',
      installments: [],
    };
  } catch {
    return null;
  }
}

export function extractCarneSettingsFromOrderRow(row: any): CarneSettings | null {
  try {
    const { meta } = unpackOrderDescription(row.description);
    if (meta?.recordType === 'carne_config' && meta?.carneSettings) {
      if (row.id) carneDbIdMap.set('CARNE-SETTINGS-GLOBAL', String(row.id));
      return meta.carneSettings as CarneSettings;
    }
  } catch {}
  return null;
}

export async function sbSaveCarne(carne: CarneSale, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const targetCompanyId = resolveCompanyId(companyId);
    let dbRowId = carneDbIdMap.get(carne.id);

    if (!dbRowId) {
      let existingQuery: any = superdb
        .from('service_orders')
        .select('id')
        .ilike('description', `%"displayId":"${carne.id}"%`)
        .limit(1);
      if (!knownMissingCompanyIdTables.has('service_orders')) {
        existingQuery = existingQuery.eq('company_id', targetCompanyId);
      }
      const { data: existing } = await existingQuery;
      if (Array.isArray(existing) && existing.length > 0 && existing[0]?.id) {
        dbRowId = String(existing[0].id);
        carneDbIdMap.set(carne.id, dbRowId);
      } else {
        dbRowId = generateValidUUID();
        carneDbIdMap.set(carne.id, dbRowId);
      }
    }

    const packedDescription = packOrderDescription(carne.description || '', {
      displayId: carne.id,
      recordType: 'carne',
      carneData: carne,
    });

    let payload: Record<string, any> = {
      id: dbRowId,
      company_id: targetCompanyId,
      created_at: carne.createdAt || new Date().toISOString(),
      client_name: carne.customerName || '',
      client_phone: carne.customerPhone || '',
      equipment: 'VENDA_CARNE',
      description: packedDescription,
      problem_description: carne.description || '',
      scheduled_date: carne.firstDueDate || null,
      status: 'CARNE_VENDA',
      price: Number(carne.totalValue ?? 0),
    };

    for (const missingCol of knownMissingServiceOrderCols) {
      delete payload[missingCol];
    }

    for (let attempt = 0; attempt < 8; attempt++) {
      const { error } = await superdb.from('service_orders').upsert([payload]);
      if (!error) return true;

      const missingCol = extractMissingColumn(error.message);
      if (missingCol && Object.prototype.hasOwnProperty.call(payload, missingCol)) {
        knownMissingServiceOrderCols.add(missingCol);
        const { [missingCol]: _removed, ...nextPayload } = payload;
        payload = nextPayload;
        continue;
      }

      if (error.message?.includes('invalid input syntax for type uuid') && !isUUID(payload.id)) {
        const newUuid = generateValidUUID();
        carneDbIdMap.set(carne.id, newUuid);
        const { id: _removedId, ...nextPayload } = payload;
        payload = { id: newUuid, ...nextPayload };
        continue;
      }
      break;
    }
    return false;
  } catch (err) {
    console.warn('SuperDB sbSaveCarne notice:', err);
    return false;
  }
}

export async function sbDeleteCarne(carneId: string, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const targetCompanyId = resolveCompanyId(companyId);
    const useCompanyFilter = !knownMissingCompanyIdTables.has('service_orders');
    const resolvedId = carneDbIdMap.get(carneId);
    if (resolvedId) {
      let delQuery: any = superdb.from('service_orders').delete().eq('id', resolvedId);
      if (useCompanyFilter) {
        delQuery = delQuery.eq('company_id', targetCompanyId);
      }
      const { error } = await delQuery;
      if (!error) {
        carneDbIdMap.delete(carneId);
        return true;
      }
    }
    let lookupQuery: any = superdb
      .from('service_orders')
      .select('id')
      .ilike('description', `%"displayId":"${carneId}"%`);
    if (useCompanyFilter) {
      lookupQuery = lookupQuery.eq('company_id', targetCompanyId);
    }
    const { data: matchedRows } = await lookupQuery;
    if (Array.isArray(matchedRows) && matchedRows.length > 0) {
      const ids = matchedRows.map((r: any) => r.id).filter(Boolean);
      if (ids.length > 0) {
        let batchDel: any = superdb.from('service_orders').delete().in('id', ids);
        if (useCompanyFilter) {
          batchDel = batchDel.eq('company_id', targetCompanyId);
        }
        await batchDel;
        carneDbIdMap.delete(carneId);
      }
    }
    return true;
  } catch (err) {
    console.warn('SuperDB sbDeleteCarne notice:', err);
    return false;
  }
}

export async function sbSaveCarneSettings(settings: CarneSettings, companyId: string = getActiveCompanyId()): Promise<boolean> {
  try {
    const targetCompanyId = resolveCompanyId(companyId);
    const configKey = 'CARNE-SETTINGS-GLOBAL';
    let dbRowId = carneDbIdMap.get(configKey);
    if (!dbRowId) {
      let existingQuery: any = superdb
        .from('service_orders')
        .select('id')
        .ilike('description', `%"displayId":"${configKey}"%`)
        .limit(1);
      if (!knownMissingCompanyIdTables.has('service_orders')) {
        existingQuery = existingQuery.eq('company_id', targetCompanyId);
      }
      const { data: existing } = await existingQuery;
      if (Array.isArray(existing) && existing.length > 0 && existing[0]?.id) {
        dbRowId = String(existing[0].id);
        carneDbIdMap.set(configKey, dbRowId);
      } else {
        dbRowId = generateValidUUID();
        carneDbIdMap.set(configKey, dbRowId);
      }
    }

    const packedDescription = packOrderDescription('Configurações de Carnê', {
      displayId: configKey,
      recordType: 'carne_config',
      carneSettings: settings,
    });

    let payload: Record<string, any> = {
      id: dbRowId,
      company_id: targetCompanyId,
      client_name: 'CONFIG_CARNE',
      equipment: 'CARNE_CONFIG',
      description: packedDescription,
      status: 'CARNE_CONFIG',
      price: 0,
    };

    for (const missingCol of knownMissingServiceOrderCols) {
      delete payload[missingCol];
    }

    for (let attempt = 0; attempt < 6; attempt++) {
      const { error } = await superdb.from('service_orders').upsert([payload]);
      if (!error) return true;
      const missingCol = extractMissingColumn(error.message);
      if (missingCol && Object.prototype.hasOwnProperty.call(payload, missingCol)) {
        knownMissingServiceOrderCols.add(missingCol);
        const { [missingCol]: _removed, ...nextPayload } = payload;
        payload = nextPayload;
        continue;
      }
      break;
    }
    return false;
  } catch (err) {
    console.warn('SuperDB sbSaveCarneSettings notice:', err);
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
