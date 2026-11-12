export type UserRole = 'admin' | 'tecnico' | 'atendente' | 'motorista' | 'gerente' | 'ormamentistas' | 'funcionario de campo';

export type StaffRole = 'admin' | 'tecnico' | 'atendente' | 'motorista' | 'gerente' | 'ormamentistas' | 'funcionario de campo';

export interface User {
  id: string;
  name: string;
  full_name?: string;
  email: string;
  password?: string;
  role: UserRole;
  companyId: string;
  company_id?: string;
  createdAt: string;
  created_at?: string;
  avatar?: string;
  phone?: string;
  whatsapp?: string;
}

export type ApplianceType =
  | 'Geladeira / Refrigerador'
  | 'Máquina de Lavar'
  | 'Lava e Seca'
  | 'Freezer / Frigobar'
  | 'Fogão / Cooktop'
  | 'Micro-ondas'
  | 'Lava-Louças'
  | 'Secadora de Roupas'
  | 'Ar Condicionado'
  | 'Outro Eletrodoméstico';

export type PaymentMethod =
  | 'Pix'
  | 'Cartão de Crédito'
  | 'Cartão de Débito'
  | 'Dinheiro'
  | 'Boleto Bancário'
  | 'Transferência / TED';

export type AttendanceStatus = 'Na fila / Aguardando' | 'Em campo' | 'Pendente Confirmação' | 'Concluído';

export type WarrantyStatus = 'Ativa' | 'Expirada' | 'Em Análise' | 'Cancelada';

export interface StaffMember {
  id: string;
  companyId: string;
  company_id?: string;
  name: string;
  full_name?: string;
  role: StaffRole;
  phone?: string;
  whatsapp?: string;
  email?: string;
  password?: string;
  notes?: string;
  active: boolean;
  createdAt?: string;
  created_at?: string;
}

export type TechLeadTimeAlert = 'imediato' | '15m' | '30m' | '1h' | '2h' | '1d' | 'sem_aviso';

export interface WarrantyOrder {
  id: string; // e.g. OS-2026-0842
  company_id?: string;
  companyId?: string;
  createdAt: string;
  created_at?: string;
  attendanceStatus?: AttendanceStatus;
  attendance_status?: AttendanceStatus;
  
  // Cliente
  customerName: string;
  client_name?: string;
  customerPhone: string;
  client_phone?: string;
  customerCpf?: string;
  client_cpf?: string;
  
  // Endereço
  cep: string;
  street: string;
  address?: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  
  // Equipamento
  applianceType: ApplianceType;
  appliance_type?: string;
  equipment?: string;
  applianceBrand: string;
  appliance_brand?: string;
  applianceModel?: string;
  appliance_model?: string;
  serialNumber?: string;
  serial_number?: string;
  
  // Equipe
  attendantName: string;
  attendant_name?: string;
  technicianName: string;
  technician_name?: string;
  technicianId?: string;
  technician_id?: string;
  driverName?: string;
  driver_name?: string;
  
  // Detalhes do conserto
  defectDescription: string;
  defect_description?: string;
  problem_description?: string;
  problem?: string;
  defect?: string;
  serviceDescription: string;
  service_description?: string;
  description?: string;
  partsReplaced: string;
  parts_replaced?: string;
  
  // Valores e Garantia
  totalValue: number;
  total_value?: number;
  price?: number;
  paymentMethod: PaymentMethod;
  payment_method?: PaymentMethod;
  paymentStatus: 'Pago' | 'Pendente' | 'Parcial';
  payment_status?: 'Pago' | 'Pendente' | 'Parcial';
  warrantyMonths: number;
  warranty_months?: number;
  warrantyStartDate?: string;
  warranty_start_date?: string;
  warrantyEndDate: string;
  warranty_end_date?: string;
  installments?: number;

  // Agendamento de Visita Técnica
  orderType?: 'garantia' | 'agendamento';
  order_type?: 'garantia' | 'agendamento';
  scheduledDate?: string;
  scheduled_date?: string;
  schedule_date?: string;
  scheduledTime?: string;
  scheduled_time?: string;
  schedule_time?: string;
  visitFee?: number;
  visit_fee?: number;
  priority?: string;
  technicianLeadTimeAlert?: TechLeadTimeAlert;
  technicianAcceptedAt?: string;
  
  // Assinatura e status
  clientSignature?: string; // base64 data url
  technicianSignature?: string;
  status: WarrantyStatus;
  notes?: string;
}

export interface CompanySettings {
  name: string;
  slogan: string;
  cnpj: string;
  phone: string;
  whatsapp: string;
  email: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  businessHours: string;
  logoUrl: string;
  warrantyTerms: string;
}

export type ExpenseCategory =
  | 'Peças e Insumos'
  | 'Combustível / Deslocamento'
  | 'Alimentação'
  | 'Ferramentas e Equipamentos'
  | 'Impostos e Taxas'
  | 'Outros Custos';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string; // YYYY-MM-DD
  paymentMethod?: PaymentMethod;
  relatedOrderId?: string;
  createdBy?: string;
  notes?: string;
  createdAt: string;
}

export type DeliveryType = 'Entrega' | 'Retirada';

export interface DeliveryTask {
  id: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  description: string;
  type: DeliveryType;
  driverName: string;
  attendantName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'Pendente' | 'Em Rota' | 'Concluído' | 'Cancelado';
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  cpf?: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  lastServiceDate: string;
  totalOrders: number;
}

