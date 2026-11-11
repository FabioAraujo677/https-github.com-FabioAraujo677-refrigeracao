export type UserRole = 'admin' | 'tecnico' | 'atendente' | 'motorista' | 'gerente' | 'ormamentistas' | 'funcionario de campo';

export type StaffRole = 'admin' | 'tecnico' | 'atendente' | 'motorista' | 'gerente' | 'ormamentistas' | 'funcionario de campo';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  companyId: string;
  createdAt: string;
  avatar?: string;
  phone?: string;
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
  name: string;
  role: StaffRole;
  phone?: string;
  email?: string;
  password?: string;
  notes?: string;
  active: boolean;
  createdAt?: string;
}

export type TechLeadTimeAlert = 'imediato' | '15m' | '30m' | '1h' | '2h' | '1d' | 'sem_aviso';

export interface WarrantyOrder {
  id: string; // e.g. OS-2026-0842
  company_id?: string;
  companyId?: string;
  createdAt: string;
  attendanceStatus?: AttendanceStatus;
  
  // Cliente
  customerName: string;
  customerPhone: string;
  customerCpf?: string;
  
  // Endereço
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  
  // Equipamento
  applianceType: ApplianceType;
  applianceBrand: string;
  applianceModel?: string;
  serialNumber?: string;
  
  // Equipe
  attendantName: string;
  technicianName: string;
  technicianId?: string;
  technician_id?: string;
  driverName?: string;
  
  // Detalhes do conserto
  defectDescription: string;
  serviceDescription: string;
  partsReplaced: string;
  
  // Valores e Garantia
  totalValue: number;
  paymentMethod: PaymentMethod;
  paymentStatus: 'Pago' | 'Pendente' | 'Parcial';
  warrantyMonths: number;
  warrantyStartDate?: string;
  warrantyEndDate: string;
  installments?: number;

  // Agendamento de Visita Técnica
  orderType?: 'garantia' | 'agendamento';
  scheduledDate?: string;
  scheduledTime?: string;
  visitFee?: number;
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

