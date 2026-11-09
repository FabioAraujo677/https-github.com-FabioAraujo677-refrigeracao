import { AttendanceStatus, CompanySettings, CustomerRecord, DeliveryTask, DeliveryType, Expense, ExpenseCategory, StaffMember, StaffRole, User, UserRole, WarrantyOrder } from '../types';
import { calculateWarrantyEndDate, getLocalDateString } from './formatters';
import { pushSyncToServer } from './cloudSync';

const STORAGE_KEYS = {
  USERS: 'garantiapro_users',
  CURRENT_USER: 'garantiapro_current_user',
  ORDERS: 'garantiapro_orders',
  STAFF: 'garantiapro_staff',
  COMPANY: 'garantiapro_company',
  EXPENSES: 'garantiapro_expenses',
  DELIVERIES: 'garantiapro_deliveries',
  CUSTOMERS: 'garantiapro_customers',
  SYNC_QUEUE: 'garantiapro_sync_queue',
};

export const getSyncQueue = (): any[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
  return data ? JSON.parse(data) : [];
};

export const saveSyncQueue = (queue: any[]): void => {
  localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
};

export const addToSyncQueue = (op: { type: 'INSERT' | 'UPDATE' | 'DELETE'; table: string; data: any; id?: string }): void => {
  const queue = getSyncQueue();
  queue.push({ ...op, timestamp: Date.now() });
  saveSyncQueue(queue);
};


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
  companyId: 'comp_admin_ice',
  name: 'Araújo - Admin',
  email: 'icerefrigeracaopreventiva@gmail.com',
  password: '120511',
  role: 'admin',
  phone: '(11) 96157-0131',
  createdAt: new Date().toISOString(),
};

export const DEFAULT_STAFF: StaffMember[] = [
  { id: 'stf_admin_ice', companyId: 'comp_admin_ice', name: 'Araújo (Admin)', role: 'admin', phone: '(11) 96157-0131', email: 'icerefrigeracaopreventiva@gmail.com', password: '120511', active: true },
  { id: 'stf_wilian', companyId: 'comp_admin_ice', name: 'wilian', role: 'tecnico', phone: '(11) 96157-0131', email: 'wilian@tecnico.com', password: '123', notes: 'geral', active: true },
  { id: 'stf_sabrina', companyId: 'comp_admin_ice', name: 'Sabrina', role: 'atendente', phone: '(11) 98566-6666', email: 'sabrina@atendente.com', password: '123', active: true },
  { id: 'stf_1', companyId: 'comp_admin_ice', name: 'Carlos Eduardo Mendes', role: 'tecnico', phone: '(11) 99123-4567', email: 'carlos@tecnico.com', password: '123', active: true },
  { id: 'stf_2', companyId: 'comp_admin_ice', name: 'Márcio Silva Santos', role: 'tecnico', phone: '(11) 98234-5678', email: 'marcio@tecnico.com', password: '123', active: true },
  { id: 'stf_3', companyId: 'comp_admin_ice', name: 'Rodrigo Refrigeração', role: 'tecnico', phone: '(11) 97345-6789', email: 'rodrigo@tecnico.com', password: '123', active: true },
  { id: 'stf_4', companyId: 'comp_admin_ice', name: 'Juliana Costa', role: 'atendente', phone: '(11) 96456-7890', email: 'juliana@atendente.com', password: '123', active: true },
  { id: 'stf_5', companyId: 'comp_admin_ice', name: 'Fernanda Rocha', role: 'atendente', phone: '(11) 95567-8901', email: 'fernanda@atendente.com', password: '123', active: true },
  { id: 'stf_6', companyId: 'comp_admin_ice', name: 'Marcos Paulo Vieira', role: 'motorista', phone: '(11) 94321-1234', email: 'marcos@motorista.com', password: '123', active: true },
  { id: 'stf_7', companyId: 'comp_admin_ice', name: 'Diego Barbosa Lima', role: 'motorista', phone: '(11) 93210-9876', email: 'diego@motorista.com', password: '123', active: true },
];

const now = new Date();
const todayISO = now.toISOString();
const yesterdayISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const twoDaysAgoISO = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
const threeDaysAgoISO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
const fourDaysAgoISO = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
const fiveDaysAgoISO = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
const twoWeeksAgoISO = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

export const INITIAL_ORDERS: WarrantyOrder[] = [
  {
    id: 'OS-2026-1051',
    createdAt: todayISO,
    attendanceStatus: 'Na fila / Aguardando',
    customerName: 'Marta Ribeiro Souza',
    customerPhone: '(11) 98545-7887',
    customerCpf: '123.456.789-00',
    cep: '05781-250',
    street: 'Rua Noanamá',
    number: '17',
    neighborhood: 'Jardim São Januário',
    city: 'São Paulo',
    state: 'SP',
    applianceType: 'Geladeira / Refrigerador',
    applianceBrand: 'Samsung Inverse',
    applianceModel: 'Digital Inverter 460L',
    attendantName: 'Juliana Costa',
    technicianName: 'Carlos Eduardo Mendes',
    defectDescription: 'Não está gelando e alarme piscando no painel',
    serviceDescription: 'Diagnóstico e troca do motor compressor idf 226589g',
    partsReplaced: 'Sensor de Degelo + Filtro Cobre',
    totalValue: 680.0,
    paymentMethod: 'Pix',
    paymentStatus: 'Pago',
    warrantyMonths: 3,
    warrantyEndDate: calculateWarrantyEndDate(todayISO, 3),
    status: 'Ativa',
    notes: 'Aguardando liberação de rota para visita.',
  },
  {
    id: 'OS-2026-1052',
    createdAt: todayISO,
    attendanceStatus: 'Em campo',
    customerName: 'Lucas Ferreira de Matos',
    customerPhone: '(11) 98111-2233',
    cep: '04538-133',
    street: 'Rua Joaquim Floriano',
    number: '520',
    neighborhood: 'Itaim Bibi',
    city: 'São Paulo',
    state: 'SP',
    applianceType: 'Lava e Seca',
    applianceBrand: 'LG Smart Inverter',
    applianceModel: 'CV5011TS4 11kg',
    attendantName: 'Fernanda Rocha',
    technicianName: 'Márcio Silva Santos',
    defectDescription: 'Aparelho trepida muito e não centrifuga',
    serviceDescription: 'Troca de amortecedores e balanceamento do cesto',
    partsReplaced: 'Kit 3 Amortecedores Suspensão LG',
    totalValue: 490.0,
    paymentMethod: 'Cartão de Crédito',
    paymentStatus: 'Pago',
    warrantyMonths: 6,
    warrantyEndDate: calculateWarrantyEndDate(todayISO, 6),
    status: 'Ativa',
    notes: 'Técnico em deslocamento até o local.',
  },
  {
    id: 'OS-2026-1053',
    createdAt: todayISO,
    attendanceStatus: 'Concluído',
    customerName: 'Aline Nogueira Lima',
    customerPhone: '(11) 97222-3344',
    cep: '01310-200',
    street: 'Avenida Paulista',
    number: '1200',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    applianceType: 'Máquina de Lavar',
    applianceBrand: 'Electrolux Premium',
    applianceModel: 'LED14 14kg',
    attendantName: 'Juliana Costa',
    technicianName: 'Rodrigo Refrigeração',
    defectDescription: 'Vazamento de água pela mangueira inferior',
    serviceDescription: 'Substituição da mangueira de entrada e higienização geral',
    partsReplaced: 'Mangueira Dupla Segurança Blindada',
    totalValue: 280.0,
    paymentMethod: 'Pix',
    paymentStatus: 'Pago',
    warrantyMonths: 3,
    warrantyEndDate: calculateWarrantyEndDate(todayISO, 3),
    status: 'Ativa',
    notes: 'Concluído com garantia ativa e recibo enviado.',
  },
  {
    id: 'OS-2026-1049',
    createdAt: yesterdayISO,
    attendanceStatus: 'Concluído',
    customerName: 'Marcus Vinicius Tavares',
    customerPhone: '(11) 97766-5544',
    customerCpf: '345.678.901-23',
    cep: '05407-002',
    street: 'Rua Teodoro Sampaio',
    number: '1020',
    neighborhood: 'Pinheiros',
    city: 'São Paulo',
    state: 'SP',
    complement: 'Bloco B Conj 44',
    applianceType: 'Lava e Seca',
    applianceBrand: 'Samsung EcoBubble',
    applianceModel: 'WD11M4453JW 11kg',
    attendantName: 'Fernanda Rocha',
    technicianName: 'Márcio Silva Santos',
    defectDescription: 'Erro 4E / 5E de drenagem e não iniciava ciclo',
    serviceDescription: 'Substituição da eletrobomba de drenagem blindada',
    partsReplaced: 'Bomba de Drenagem Askoll 127V Original Samsung',
    totalValue: 520.0,
    paymentMethod: 'Cartão de Crédito',
    paymentStatus: 'Pago',
    warrantyMonths: 3,
    warrantyEndDate: calculateWarrantyEndDate(yesterdayISO, 3),
    status: 'Ativa',
    notes: 'Garantia ativa em pleno funcionamento.',
  },
  {
    id: 'OS-2026-1048',
    createdAt: yesterdayISO,
    attendanceStatus: 'Concluído',
    customerName: 'Renata Albuquerque Santos',
    customerPhone: '(11) 98877-6655',
    customerCpf: '234.567.890-12',
    cep: '04538-133',
    street: 'Rua Joaquim Floriano',
    number: '466',
    neighborhood: 'Itaim Bibi',
    city: 'São Paulo',
    state: 'SP',
    complement: 'Apto 112',
    applianceType: 'Geladeira / Refrigerador',
    applianceBrand: 'Brastemp Inverse',
    applianceModel: 'BRE80AK 573L',
    attendantName: 'Juliana Costa',
    technicianName: 'Carlos Eduardo Mendes',
    defectDescription: 'Parte inferior não refrigerava e bloqueio de gelo',
    serviceDescription: 'Desobstrução do duto de ar e carga de gás R600a',
    partsReplaced: 'Kit Sensor e Termofusível Degelo',
    totalValue: 680.0,
    paymentMethod: 'Pix',
    paymentStatus: 'Pago',
    warrantyMonths: 6,
    warrantyEndDate: calculateWarrantyEndDate(yesterdayISO, 6),
    status: 'Ativa',
    notes: 'Lacre de segurança aplicado.',
  },
  {
    id: 'OS-2026-1045',
    createdAt: twoDaysAgoISO,
    attendanceStatus: 'Concluído',
    customerName: 'Bruno Henrique Castilho',
    customerPhone: '(11) 96333-4455',
    cep: '04538-133',
    street: 'Rua Tabapuã',
    number: '810',
    neighborhood: 'Itaim Bibi',
    city: 'São Paulo',
    state: 'SP',
    applianceType: 'Geladeira / Refrigerador',
    applianceBrand: 'Consul Frost Free',
    applianceModel: 'CRM39 340L',
    attendantName: 'Juliana Costa',
    technicianName: 'Rodrigo Refrigeração',
    defectDescription: 'Borracha rasgada e motor armando e desarmando',
    serviceDescription: 'Troca de gaxeta magnética e relé térmico de partida',
    partsReplaced: 'Gaxeta Imã Consul + Relé PTC 127V',
    totalValue: 390.0,
    paymentMethod: 'Pix',
    paymentStatus: 'Pago',
    warrantyMonths: 3,
    warrantyEndDate: calculateWarrantyEndDate(twoDaysAgoISO, 3),
    status: 'Ativa',
  },
  {
    id: 'OS-2026-1044',
    createdAt: threeDaysAgoISO,
    attendanceStatus: 'Concluído',
    customerName: 'Cláudia Regina Prado',
    customerPhone: '(11) 95444-5566',
    cep: '02011-000',
    street: 'Rua Voluntários da Pátria',
    number: '1240',
    neighborhood: 'Santana',
    city: 'São Paulo',
    state: 'SP',
    applianceType: 'Máquina de Lavar',
    applianceBrand: 'Brastemp Ative',
    applianceModel: 'BWG11 11kg',
    attendantName: 'Fernanda Rocha',
    technicianName: 'Carlos Eduardo Mendes',
    defectDescription: 'Não entrava água e estalava a válvula',
    serviceDescription: 'Troca da válvula de entrada dupla e limpeza dos filtros',
    partsReplaced: 'Válvula Entrada Água 2 Vias Original',
    totalValue: 310.0,
    paymentMethod: 'Cartão de Débito',
    paymentStatus: 'Pago',
    warrantyMonths: 3,
    warrantyEndDate: calculateWarrantyEndDate(threeDaysAgoISO, 3),
    status: 'Ativa',
  },
  {
    id: 'OS-2026-1043',
    createdAt: fourDaysAgoISO,
    attendanceStatus: 'Concluído',
    customerName: 'Fernando de Oliveira Dias',
    customerPhone: '(11) 94555-6677',
    cep: '01310-200',
    street: 'Rua Augusta',
    number: '1900',
    neighborhood: 'Consolação',
    city: 'São Paulo',
    state: 'SP',
    applianceType: 'Lava e Seca',
    applianceBrand: 'Electrolux Intuitive',
    applianceModel: 'LSE11 11kg',
    attendantName: 'Juliana Costa',
    technicianName: 'Márcio Silva Santos',
    defectDescription: 'Secagem não esquentava roupa',
    serviceDescription: 'Troca do duto de secagem e resistência aquecedora',
    partsReplaced: 'Resistência Secagem 110V + Termostato 125ºC',
    totalValue: 580.0,
    paymentMethod: 'Cartão de Crédito',
    paymentStatus: 'Pago',
    warrantyMonths: 6,
    warrantyEndDate: calculateWarrantyEndDate(fourDaysAgoISO, 6),
    status: 'Ativa',
  },
  {
    id: 'OS-2026-1042',
    createdAt: fiveDaysAgoISO,
    attendanceStatus: 'Concluído',
    customerName: 'Guilherme Siqueira Campos',
    customerPhone: '(11) 93666-7788',
    cep: '05407-002',
    street: 'Rua dos Pinheiros',
    number: '740',
    neighborhood: 'Pinheiros',
    city: 'São Paulo',
    state: 'SP',
    applianceType: 'Geladeira / Refrigerador',
    applianceBrand: 'Electrolux Infinity',
    applianceModel: 'DF80X 553L',
    attendantName: 'Fernanda Rocha',
    technicianName: 'Rodrigo Refrigeração',
    defectDescription: 'Alarme sonoro apitando e display piscando código Er',
    serviceDescription: 'Substituição da placa módulo de potência eletrônica',
    partsReplaced: 'Placa Principal Bivolt Electrolux Original',
    totalValue: 640.0,
    paymentMethod: 'Pix',
    paymentStatus: 'Pago',
    warrantyMonths: 6,
    warrantyEndDate: calculateWarrantyEndDate(fiveDaysAgoISO, 6),
    status: 'Ativa',
  },
  {
    id: 'OS-2026-1041',
    createdAt: fiveDaysAgoISO,
    attendanceStatus: 'Concluído',
    customerName: 'Juliana Paes Moreira',
    customerPhone: '(11) 92777-8899',
    cep: '04538-133',
    street: 'Avenida Faria Lima',
    number: '3144',
    neighborhood: 'Itaim Bibi',
    city: 'São Paulo',
    state: 'SP',
    applianceType: 'Máquina de Lavar',
    applianceBrand: 'Samsung Digital Inverter',
    applianceModel: 'WW11J4453 11kg',
    attendantName: 'Juliana Costa',
    technicianName: 'Carlos Eduardo Mendes',
    defectDescription: 'Porta travada e trava eletromagnética com cheiro de queimado',
    serviceDescription: 'Troca da trava da porta e recalibração do circuito',
    partsReplaced: 'Trava Eletromagnética Porta Samsung',
    totalValue: 350.0,
    paymentMethod: 'Pix',
    paymentStatus: 'Pago',
    warrantyMonths: 3,
    warrantyEndDate: calculateWarrantyEndDate(fiveDaysAgoISO, 3),
    status: 'Ativa',
  },
  {
    id: 'OS-2026-1040',
    createdAt: twoWeeksAgoISO,
    attendanceStatus: 'Concluído',
    customerName: 'Patrícia Guimarães Lima',
    customerPhone: '(11) 96655-4433',
    cep: '02011-000',
    street: 'Rua Voluntários da Pátria',
    number: '890',
    neighborhood: 'Santana',
    city: 'São Paulo',
    state: 'SP',
    applianceType: 'Máquina de Lavar',
    applianceBrand: 'Electrolux Top Load',
    applianceModel: 'LED14 14kg',
    attendantName: 'Juliana Costa',
    technicianName: 'Rodrigo Refrigeração',
    defectDescription: 'Barulho metálico na centrifugação e vazamento',
    serviceDescription: 'Troca do kit mecanismo transmissão completo e rolamentos',
    partsReplaced: 'Transmissão Completa + Rolamentos 6006 + Retentor',
    totalValue: 690.0,
    paymentMethod: 'Pix',
    paymentStatus: 'Pago',
    warrantyMonths: 3,
    warrantyEndDate: calculateWarrantyEndDate(twoWeeksAgoISO, 3),
    status: 'Ativa',
  },
];

// User Management
export function getUsers(): User[] {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]): void {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

export function getCurrentUser(): User | null {
  const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null): void {
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  } else {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  }
}

import { sbSaveUser } from './supabaseService';

// ... (código existente) ...

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
  
  // Gera um companyId único se for admin, ou usa o do admin atual se for staff.
  // Como 'registerUser' está sendo usado para o primeiro admin, vamos gerar um novo ID.
  const companyId = 'comp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

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
  pushSyncToServer('users', 'INSERT', newUser);
  
  // FORÇAR SALVAMENTO NO SUPABASE
  sbSaveUser(newUser);

  // Sync to staff list if not present
  const staff = getStaff();
  if (!staff.some((s) => s.email?.toLowerCase() === cleanEmail)) {
    staff.push({
      id: 'stf_' + Date.now().toString(36),
      companyId, // Vincular ao companyId criado
      name: newUser.name,
      role: role as StaffRole,
      phone: newUser.phone,
      email: cleanEmail,
      password: userData.password?.trim(),
      active: true,
      createdAt: new Date().toISOString(),
    });
    saveStaff(staff);
    pushSyncToServer('staff', 'REPLACE_ALL', staff);
  }

  return { user: newUser, isFirst };
}

import { 
  sbSaveOrder, 
  sbDeleteOrder, 
  sbSaveStaff, 
  sbDeleteStaff, 
  sbSaveExpense, 
  sbDeleteExpense,
  sbSaveDelivery,
  sbDeleteDelivery,
  sbSaveCustomer,
  sbDeleteCustomer,
  sbSaveCompany
} from './supabaseService';

export function loginUser(email: string, password?: string): User | null {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password?.trim();

  // 0. Check Default Admin (Fallback/Emergency)
  if (cleanEmail === DEFAULT_ADMIN_USER.email.toLowerCase() && cleanPassword === DEFAULT_ADMIN_USER.password) {
    setCurrentUser(DEFAULT_ADMIN_USER);
    return DEFAULT_ADMIN_USER;
  }

  // 1. Check registered users list first
  const users = getUsers();
  const foundUser = users.find((u) => 
    u.email.toLowerCase() === cleanEmail ||
    u.name.toLowerCase() === cleanEmail
  );
  
  if (foundUser) {
    const expectedPassword = foundUser.password?.trim();
    // Allow user password, or standard defaults
    const isValid = !expectedPassword || 
      expectedPassword === cleanPassword || 
      cleanPassword === '120511' || 
      cleanPassword === '123' || 
      cleanPassword === '123456';

    if (!isValid) {
      return null; // Incorrect password
    }
    setCurrentUser(foundUser);
    return foundUser;
  }

  // 2. Check staff list (sub-logins for technicians, attendants, drivers, admin)
  const staff = getStaff();
  let foundStaff = staff.find(s => 
    s.email?.trim().toLowerCase() === cleanEmail ||
    s.name.trim().toLowerCase() === cleanEmail ||
    (s.email && s.email.toLowerCase().startsWith(cleanEmail + '@'))
  );

  // Fallback to DEFAULT_STAFF if not in customized staff list
  if (!foundStaff) {
    foundStaff = DEFAULT_STAFF.find(s => 
      s.email?.trim().toLowerCase() === cleanEmail ||
      s.name.trim().toLowerCase() === cleanEmail ||
      (s.email && s.email.toLowerCase().startsWith(cleanEmail + '@'))
    );
  }
  
  if (foundStaff) {
    if (!foundStaff.active) {
      return null; // Inactive staff
    }

    const expectedPassword = foundStaff.password?.trim() || '123';
    // Allow configured password, standard default '123', master admin '120511', or '123456'
    const isPasswordValid = 
      cleanPassword === expectedPassword || 
      cleanPassword === '123' ||
      cleanPassword === '123456' ||
      cleanPassword === '120511';

    if (!isPasswordValid) {
      return null; // Incorrect password
    }

    // Map role to canonical UserRole for proper dashboard redirection
    let userRole: UserRole = foundStaff.role as UserRole;
    if ((foundStaff.role as any) === 'funcionario de campo') userRole = 'tecnico';
    if ((foundStaff.role as any) === 'gerente') userRole = 'atendente';
    if ((foundStaff.role as any) === 'ormamentistas') userRole = 'motorista';

    const staffUser: User = {
      id: foundStaff.id.startsWith('usr_') ? foundStaff.id : 'usr_' + foundStaff.id,
      companyId: foundStaff.companyId || 'comp_admin_ice',
      name: foundStaff.name,
      email: foundStaff.email || cleanEmail,
      phone: foundStaff.phone,
      role: userRole,
      createdAt: foundStaff.createdAt || new Date().toISOString(),
    };
    setCurrentUser(staffUser);
    return staffUser;
  }

  // 3. Strict authentication: do not auto-create users on login
  return null;
}

export function logoutUser(): void {
  setCurrentUser(null);
}

// Orders Management
export function getOrders(): WarrantyOrder[] {
  const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveOrders(orders: WarrantyOrder[]): void {
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
}


export function addOrder(order: Omit<WarrantyOrder, 'id' | 'createdAt' | 'status' | 'warrantyEndDate'> & {
  warrantyMonths: number;
}): WarrantyOrder {
  const orders = getOrders();
  const nextNum = 1051 + orders.length;
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

  orders.unshift(newOrder);
  saveOrders(orders);
  
  pushSyncToServer('orders', 'INSERT', newOrder);
  sbSaveOrder(newOrder).catch(() => addToSyncQueue({ type: 'INSERT', table: 'orders', data: newOrder }));
  
  return newOrder;
}

export function updateOrder(id: string, updates: Partial<WarrantyOrder>): WarrantyOrder | null {
  const orders = getOrders();
  const index = orders.findIndex((o) => o.id === id);
  if (index === -1) return null;

  const updated: WarrantyOrder = { ...orders[index], ...updates };
  // Recalculate warranty date if months or start date changed
  if ((updates.warrantyMonths && updates.warrantyMonths !== orders[index].warrantyMonths) || 
      (updates.warrantyStartDate && updates.warrantyStartDate !== orders[index].warrantyStartDate)) {
    const baseDate = updates.warrantyStartDate || updated.warrantyStartDate || updated.createdAt;
    updated.warrantyEndDate = calculateWarrantyEndDate(baseDate, updates.warrantyMonths || updated.warrantyMonths);
  }

  orders[index] = updated;
  saveOrders(orders);
  
  pushSyncToServer('orders', 'UPDATE', updated, id);
  sbSaveOrder(updated).catch(() => addToSyncQueue({ type: 'UPDATE', table: 'orders', data: updated }));
  
  return updated;
}

export function deleteOrder(id: string): boolean {
  const orders = getOrders();
  const filtered = orders.filter((o) => o.id !== id);
  if (filtered.length !== orders.length) {
    saveOrders(filtered);
    
    pushSyncToServer('orders', 'DELETE', undefined, id);
    sbDeleteOrder(id).catch(() => addToSyncQueue({ type: 'DELETE', table: 'orders', data: { id } }));
    
    return true;
  }
  return false;
}

// Staff Management
export function getStaff(): StaffMember[] {
  const data = localStorage.getItem(STORAGE_KEYS.STAFF);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveStaff(staff: StaffMember[]): void {
  localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
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
    companyId: staff.companyId || 'comp_admin_ice',
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
  // Also sync default staff
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

  // Check if staff with this email already exists, update instead
  const existingIdx = cleanEmail ? staff.findIndex(s => s.email?.toLowerCase() === cleanEmail) : -1;

  const newStaff: StaffMember = {
    id: existingIdx >= 0 ? staff[existingIdx].id : ('stf_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5)),
    companyId: 'comp_admin_ice',
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

  pushSyncToServer('staff', 'INSERT', newStaff);
  sbSaveStaff(newStaff).catch(() => addToSyncQueue({ type: 'INSERT', table: 'staff', data: newStaff }));

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

  pushSyncToServer('staff', 'UPDATE', updated, id);
  sbSaveStaff(updated).catch(() => addToSyncQueue({ type: 'UPDATE', table: 'staff', data: updated }));

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
  
  // Also remove associated login user if email exists
  if (member.email) {
    const users = getUsers();
    const filteredUsers = users.filter((u) => u.email.toLowerCase() !== member.email?.toLowerCase());
    if (filteredUsers.length !== users.length) {
      saveUsers(filteredUsers);
      pushSyncToServer('users', 'REPLACE_ALL', filteredUsers);
    }
  }

  const filteredStaff = staff.filter((s) => s.id !== id);
  saveStaff(filteredStaff);
  
  pushSyncToServer('staff', 'DELETE', undefined, id);
  sbDeleteStaff(id).catch(() => addToSyncQueue({ type: 'DELETE', table: 'staff', data: { id } }));
  return true;
}

// Company Settings Management
export function getCompanySettings(): CompanySettings {
  const data = localStorage.getItem(STORAGE_KEYS.COMPANY);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(DEFAULT_COMPANY));
    return DEFAULT_COMPANY;
  }
  try {
    return { ...DEFAULT_COMPANY, ...JSON.parse(data) };
  } catch {
    return DEFAULT_COMPANY;
  }
}

export function saveCompanySettings(company: CompanySettings): void {
  localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(company));
  pushSyncToServer('company', 'UPDATE', company);
  sbSaveCompany(company).catch(() => addToSyncQueue({ type: 'UPDATE', table: 'company', data: company }));
}

// ==========================================
// GASTOS & DESPESAS (EXPENSES MANAGEMENT)
// ==========================================

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'EXP-101',
    description: 'Gás Refrigerante R134a + Filtro Secador Cobre',
    amount: 110.0,
    category: 'Peças e Insumos',
    date: getLocalDateString(),
    paymentMethod: 'Pix',
    createdBy: 'WILIAN',
    notes: 'Insumos utilizados na visita da manhã',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'EXP-102',
    description: 'Combustível p/ Veículo Técnico (Deslocamentos do Dia)',
    amount: 60.0,
    category: 'Combustível / Deslocamento',
    date: getLocalDateString(),
    paymentMethod: 'Cartão de Débito',
    createdBy: 'Empresa',
    notes: 'Abastecimento da van de atendimento',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'EXP-103',
    description: 'Capacitor Eletrolítico Duplo 45uF + Válvula de Serviço',
    amount: 45.0,
    category: 'Peças e Insumos',
    date: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return getLocalDateString(d);
    })(),
    paymentMethod: 'Dinheiro',
    createdBy: 'WILIAN',
    notes: 'Reparo de lavadora realizado ontem',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'EXP-104',
    description: 'Alimentação Técnico em Campo (Almoço)',
    amount: 35.0,
    category: 'Alimentação',
    date: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return getLocalDateString(d);
    })(),
    paymentMethod: 'Pix',
    createdBy: 'Sabrina',
    notes: 'Diária de alimentação',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

export function getExpenses(): Expense[] {
  const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveExpenses(expenses: Expense[]): void {
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
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
  
  pushSyncToServer('expenses', 'INSERT', newExpense);
  sbSaveExpense(newExpense).catch(() => addToSyncQueue({ type: 'INSERT', table: 'expenses', data: newExpense }));
  
  return newExpense;
}

export function updateExpense(expense: Expense): Expense {
  const expenses = getExpenses();
  const index = expenses.findIndex((e) => e.id === expense.id);
  if (index !== -1) {
    expenses[index] = expense;
    saveExpenses(expenses);
    
    pushSyncToServer('expenses', 'UPDATE', expense, expense.id);
    sbSaveExpense(expense).catch(() => addToSyncQueue({ type: 'UPDATE', table: 'expenses', data: expense }));
  }
  return expense;
}

export function deleteExpense(id: string): boolean {
  const expenses = getExpenses();
  const filtered = expenses.filter((e) => e.id !== id);
  if (filtered.length !== expenses.length) {
    saveExpenses(filtered);
    
    pushSyncToServer('expenses', 'DELETE', undefined, id);
    sbDeleteExpense(id).catch(() => addToSyncQueue({ type: 'DELETE', table: 'expenses', data: { id } }));
    
    return true;
  }
  return false;
}

// ==========================================
// ENTREGAS & RETIRADAS (DELIVERIES)
// ==========================================

export function getDeliveries(): DeliveryTask[] {
  const data = localStorage.getItem(STORAGE_KEYS.DELIVERIES);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveDeliveries(deliveries: DeliveryTask[]): void {
  localStorage.setItem(STORAGE_KEYS.DELIVERIES, JSON.stringify(deliveries));
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
  
  pushSyncToServer('deliveries', 'INSERT', newDelivery);
  sbSaveDelivery(newDelivery).catch(() => addToSyncQueue({ type: 'INSERT', table: 'deliveries', data: newDelivery }));
  
  return newDelivery;
}

export function updateDelivery(id: string, updates: Partial<DeliveryTask>): DeliveryTask | null {
  const deliveries = getDeliveries();
  const index = deliveries.findIndex((d) => d.id === id);
  if (index === -1) return null;
  const updated = { ...deliveries[index], ...updates };
  deliveries[index] = updated;
  saveDeliveries(deliveries);
  
  pushSyncToServer('deliveries', 'UPDATE', updated, id);
  sbSaveDelivery(updated).catch(() => addToSyncQueue({ type: 'UPDATE', table: 'deliveries', data: updated }));
  
  return updated;
}

export function deleteDelivery(id: string): boolean {
  const deliveries = getDeliveries();
  const filtered = deliveries.filter((d) => d.id !== id);
  if (filtered.length !== deliveries.length) {
    saveDeliveries(filtered);
    
    pushSyncToServer('deliveries', 'DELETE', undefined, id);
    sbDeleteDelivery(id).catch(() => addToSyncQueue({ type: 'DELETE', table: 'deliveries', data: { id } }));
    
    return true;
  }
  return false;
}

// ==========================================
// CUSTOMERS MANAGEMENT
// ==========================================

export function getCustomers(): CustomerRecord[] {
  const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
  if (!data) {
    const orders = getOrders();
    const map = new Map<string, CustomerRecord>();
    orders.forEach(o => {
      if (!o.customerPhone && !o.customerName) return;
      const key = o.customerPhone ? o.customerPhone.replace(/\D/g, '') : o.customerName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: `CUST-${Math.random().toString(36).substr(2, 6)}`,
          name: o.customerName,
          phone: o.customerPhone,
          cpf: o.customerCpf,
          cep: o.cep,
          street: o.street,
          number: o.number,
          complement: o.complement,
          neighborhood: o.neighborhood,
          city: o.city,
          state: o.state,
          lastServiceDate: o.createdAt || new Date().toISOString(),
          totalOrders: 1,
        });
      } else {
        const existing = map.get(key)!;
        existing.totalOrders += 1;
        if (o.createdAt && o.createdAt > existing.lastServiceDate) {
          existing.lastServiceDate = o.createdAt;
        }
      }
    });
    const list = Array.from(map.values());
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(list));
    return list;
  }
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveCustomers(customers: CustomerRecord[]): void {
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  // Note: we don't sync the whole list usually, but upsertCustomer handles individual syncs
}

export function upsertCustomerFromOrder(order: Partial<WarrantyOrder>): void {
  if (!order.customerName || !order.customerPhone) return;
  const customers = getCustomers();
  const phoneClean = order.customerPhone.replace(/\D/g, '');
  const index = customers.findIndex(c => c.phone.replace(/\D/g, '') === phoneClean || c.name.toLowerCase() === order.customerName?.toLowerCase());
  
  if (index !== -1) {
    customers[index] = {
      ...customers[index],
      name: order.customerName || customers[index].name,
      phone: order.customerPhone || customers[index].phone,
      cpf: order.customerCpf || customers[index].cpf,
      cep: order.cep || customers[index].cep,
      street: order.street || customers[index].street,
      number: order.number || customers[index].number,
      complement: order.complement || customers[index].complement,
      neighborhood: order.neighborhood || customers[index].neighborhood,
      city: order.city || customers[index].city,
      state: order.state || customers[index].state,
      lastServiceDate: order.createdAt || new Date().toISOString(),
      totalOrders: customers[index].totalOrders + 1,
    };
  } else {
    const newCust: CustomerRecord = {
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
    customers.unshift(newCust);
  }
  saveCustomers(customers);

  const targetCustomer = index !== -1 ? customers[index] : customers[0];
  sbSaveCustomer(targetCustomer).catch(() => addToSyncQueue({ type: 'UPDATE', table: 'customers', data: targetCustomer }));
}

// ==========================================
// BACKUP & RESTORE UTILITIES
// ==========================================

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
  const jsonString = JSON.stringify(backupData);
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('garantiapro_auto_backup', jsonString);
    }
  } catch (e) {
    console.warn('Auto backup quota exceeded, saving light backup without heavy assets.');
    try {
      const lightBackup = {
        ...backupData,
        data: {
          ...backupData.data,
          company: { ...company, logoUrl: company.logoUrl && company.logoUrl.startsWith('data:') ? '[IMAGE_OMITTED_DUE_TO_QUOTA]' : company.logoUrl }
        }
      };
      localStorage.setItem('garantiapro_auto_backup', JSON.stringify(lightBackup));
    } catch (err) {
      console.error('Light backup quota failed:', err);
    }
  }
  return JSON.stringify(backupData, null, 2);
}

export function restoreFullBackup(jsonData: string): boolean {
  try {
    const parsed = JSON.parse(jsonData);
    if (!parsed || !parsed.data) return false;
    const { users, orders, staff, company, expenses, deliveries, customers } = parsed.data;
    
    if (users) localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    if (orders) localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    if (staff) localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
    if (company) localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(company));
    if (expenses) localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    if (deliveries) localStorage.setItem(STORAGE_KEYS.DELIVERIES, JSON.stringify(deliveries));
    if (customers) localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));

    localStorage.setItem('garantiapro_auto_backup', jsonData);
    return true;
  } catch (e) {
    console.error('Restore backup error:', e);
    return false;
  }
}


// Seed initial data if empty
if (typeof window !== 'undefined') {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    saveUsers([DEFAULT_ADMIN_USER]);
  }
  if (!localStorage.getItem(STORAGE_KEYS.STAFF)) {
    saveStaff(DEFAULT_STAFF);
  }
  if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
    saveOrders(INITIAL_ORDERS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.EXPENSES)) {
    saveExpenses(INITIAL_EXPENSES);
  }
  // Sincronizar todos os colaboradores com a lista de usuários para login instantâneo
  syncAllStaffToUsers();

  // Initial auto backup if none exists
  if (!localStorage.getItem('garantiapro_auto_backup')) {
    generateFullBackup();
  }
}

