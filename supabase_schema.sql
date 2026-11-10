-- ========================================================
-- GARANTIAPRO NEO - SCRIPT DE CRIAÇÃO E AJUSTE DO SUPABASE
-- Execute este script no SQL Editor do seu painel Supabase
-- ========================================================

-- 1. TABELA DE PERFIS E EQUIPE (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com',
    name TEXT NOT NULL,
    email TEXT,
    password TEXT,
    role TEXT NOT NULL DEFAULT 'tecnico',
    phone TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir coluna company_id na tabela profiles
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='company_id') THEN
        ALTER TABLE public.profiles ADD COLUMN company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com';
    END IF;
END $$;

-- 2. TABELA DE CLIENTES (clients)
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com',
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    cpf TEXT,
    cep TEXT,
    street TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    last_service_date TIMESTAMPTZ DEFAULT NOW(),
    total_orders INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir coluna company_id na tabela clients
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='company_id') THEN
        ALTER TABLE public.clients ADD COLUMN company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com';
    END IF;
END $$;

-- 3. TABELA DE ORDENS DE SERVIÇO E GARANTIAS (service_orders)
CREATE TABLE IF NOT EXISTS public.service_orders (
    id TEXT PRIMARY KEY,
    company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    attendance_status TEXT DEFAULT 'Na fila / Aguardando',
    
    -- Dados do Cliente
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_cpf TEXT,
    
    -- Endereço
    cep TEXT,
    street TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    
    -- Equipamento
    appliance_type TEXT NOT NULL,
    appliance_brand TEXT NOT NULL,
    appliance_model TEXT,
    serial_number TEXT,
    
    -- Equipe Responsável
    attendant_name TEXT,
    technician_name TEXT,
    driver_name TEXT,
    
    -- Serviço & Peças
    defect_description TEXT,
    service_description TEXT,
    parts_replaced TEXT,
    
    -- Valores e Garantia
    total_value NUMERIC(12,2) DEFAULT 0,
    payment_method TEXT,
    payment_status TEXT DEFAULT 'Pendente',
    warranty_months INTEGER DEFAULT 3,
    warranty_start_date DATE,
    warranty_end_date DATE,
    installments INTEGER,
    
    -- Agendamento
    order_type TEXT DEFAULT 'garantia',
    scheduled_date DATE,
    scheduled_time TEXT,
    visit_fee NUMERIC(12,2),
    technician_lead_time_alert TEXT,
    technician_accepted_at TIMESTAMPTZ,
    
    -- Assinaturas & Status
    client_signature TEXT,
    technician_signature TEXT,
    status TEXT DEFAULT 'Ativa',
    notes TEXT
);

-- Garantir coluna company_id na tabela service_orders
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='company_id') THEN
        ALTER TABLE public.service_orders ADD COLUMN company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com';
    END IF;
END $$;

-- 4. TABELA DE CONFIGURAÇÕES DA EMPRESA (company_settings)
CREATE TABLE IF NOT EXISTS public.company_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    company_id TEXT UNIQUE DEFAULT 'icerefrigeracaopreventiva@gmail.com',
    name TEXT NOT NULL,
    slogan TEXT,
    cnpj TEXT,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    cep TEXT,
    street TEXT,
    number TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    business_hours TEXT,
    logo_url TEXT,
    warranty_terms TEXT
);

-- Garantir coluna company_id na tabela company_settings
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='company_id') THEN
        ALTER TABLE public.company_settings ADD COLUMN company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com';
    END IF;
END $$;

-- 5. TABELA DE GASTOS E DESPESAS (expenses)
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com',
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    category TEXT NOT NULL,
    date DATE NOT NULL,
    payment_method TEXT,
    related_order_id TEXT,
    created_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA DE ENTREGAS E LOGÍSTICA (deliveries)
CREATE TABLE IF NOT EXISTS public.deliveries (
    id TEXT PRIMARY KEY,
    company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    cep TEXT,
    street TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    description TEXT,
    type TEXT,
    driver_name TEXT,
    attendant_name TEXT,
    scheduled_date DATE,
    scheduled_time TEXT,
    status TEXT DEFAULT 'Pendente'
);

-- INSERIR CONFIGURAÇÃO INICIAL DA EMPRESA (se não existir)
INSERT INTO public.company_settings (id, company_id, name, slogan, cnpj, phone, whatsapp, email, cep, street, number, neighborhood, city, state, business_hours, warranty_terms)
VALUES (
    1,
    'icerefrigeracaopreventiva@gmail.com',
    'NEO FIX ELETRÔNICA & REFRIGERAÇÃO',
    'Especialistas em Geladeiras, Máquinas de Lavar e Lava & Seca',
    '38.921.455/0001-90',
    '(11) 98765-4321',
    '5511987654321',
    'icerefrigeracaopreventiva@gmail.com',
    '01310-200',
    'Avenida Paulista',
    '1842',
    'Bela Vista',
    'São Paulo',
    'SP',
    'Segunda a Sexta: 08:00 às 18:30 | Sábado: 08:00 às 14:00',
    '1. A garantia cobre exclusivamente a peça trocada e a mão de obra especificada nesta Ordem de Serviço.'
) ON CONFLICT (id) DO NOTHING;

-- INSERIR USUÁRIO ADMINISTRADOR MASTER SE NÃO EXISTIR
INSERT INTO public.profiles (id, company_id, name, email, password, role, phone, active)
VALUES (
    'usr_admin_ice',
    'icerefrigeracaopreventiva@gmail.com',
    'Araújo - Admin',
    'icerefrigeracaopreventiva@gmail.com',
    '120511',
    'admin',
    '(11) 96157-0131',
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- PERMISSÕES E DESATIVAÇÃO DE RESTRICÕES RLS DIFICULTADORAS (Para permitir leitura e escrita do app sem travamento)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries DISABLE ROW LEVEL SECURITY;

-- Garantir acesso total às tabelas para anon e authenticated
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.clients TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.service_orders TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.company_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.expenses TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.deliveries TO anon, authenticated, service_role;
