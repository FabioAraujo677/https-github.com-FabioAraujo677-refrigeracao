-- ========================================================
-- GARANTIAPRO NEO - SUPABASE SQL SCHEMA & RLS MIGRATION SCRIPT
-- Script de Migração para Isolamento Multi-Tenant por RLS (Row Level Security)
-- ========================================================

-- 1. Tabela de Usuários / Equipe de Acesso
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    role TEXT NOT NULL DEFAULT 'tecnico', -- 'admin', 'tecnico', 'atendente', 'motorista'
    phone TEXT,
    company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Configurações da Empresa
CREATE TABLE IF NOT EXISTS company_settings (
    id SERIAL PRIMARY KEY,
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

-- Inserir dados padrão da empresa (Vinculados ao Admin Master)
INSERT INTO company_settings (id, company_id, name, slogan, cnpj, phone, whatsapp, email, cep, street, number, neighborhood, city, state, business_hours, warranty_terms)
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
    '1. A garantia cobre exclusivamente a peça trocada e a mão de obra especificada nesta Ordem de Serviço.
2. O rompimento do lacre de garantia, sobretensão elétrica atmosférica (raios), infestações de insetos ou mau uso invalidam a garantia.
3. Em caso de defeito dentro do prazo, entre em contato imediatamente com nossa central para agendamento técnico prioritário.
4. Conserve este certificado digital ou impresso para comprovação de vigência.'
) ON CONFLICT (id) DO NOTHING;

-- 3. Tabela de Equipe (Staff)
CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL, -- 'tecnico', 'atendente', 'motorista', 'admin'
    phone TEXT,
    email TEXT,
    password TEXT,
    notes TEXT,
    company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Ordens de Serviço e Garantias (Orders)
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    attendance_status TEXT DEFAULT 'Na fila / Aguardando',
    
    -- Cliente
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
    
    -- Equipe
    attendant_name TEXT,
    technician_name TEXT,
    driver_name TEXT,
    
    -- Detalhes do conserto
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
    
    -- Assinatura e Status
    client_signature TEXT,
    technician_signature TEXT,
    status TEXT DEFAULT 'Ativa',
    notes TEXT
);

-- 5. Tabela de Despesas e Gastos (Expenses)
CREATE TABLE IF NOT EXISTS expenses (
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

-- 6. Tabela de Entregas e Logística (Deliveries)
CREATE TABLE IF NOT EXISTS deliveries (
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

-- 7. Tabela de Clientes Consolidados (Customers)
CREATE TABLE IF NOT EXISTS customers (
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
    last_service_date TIMESTAMPTZ,
    total_orders INTEGER DEFAULT 1
);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) & POLICIES FOR MULTI-TENANT ISOLATION
-- ========================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para evitar conflito
DROP POLICY IF EXISTS "Tenant isolation users" ON users;
DROP POLICY IF EXISTS "Tenant isolation company" ON company_settings;
DROP POLICY IF EXISTS "Tenant isolation staff" ON staff;
DROP POLICY IF EXISTS "Tenant isolation orders" ON orders;
DROP POLICY IF EXISTS "Tenant isolation expenses" ON expenses;
DROP POLICY IF EXISTS "Tenant isolation deliveries" ON deliveries;
DROP POLICY IF EXISTS "Tenant isolation customers" ON customers;

DROP POLICY IF EXISTS "Public users access" ON users;
DROP POLICY IF EXISTS "Public company access" ON company_settings;
DROP POLICY IF EXISTS "Public staff access" ON staff;
DROP POLICY IF EXISTS "Public orders access" ON orders;
DROP POLICY IF EXISTS "Public expenses access" ON expenses;
DROP POLICY IF EXISTS "Public deliveries access" ON deliveries;
DROP POLICY IF EXISTS "Public customers access" ON customers;

-- Criar Políticas RLS baseadas no company_id (conta pai / administrador da empresa)
-- Garantindo que cada usuário só acesse registros onde company_id corresponda à sua empresa/conta pai
CREATE POLICY "Tenant isolation users" ON users 
    FOR ALL 
    USING (company_id = COALESCE(auth.jwt() ->> 'company_id', current_setting('request.jwt.claim.company_id', true), 'icerefrigeracaopreventiva@gmail.com'))
    WITH CHECK (company_id = COALESCE(auth.jwt() ->> 'company_id', current_setting('request.jwt.claim.company_id', true), 'icerefrigeracaopreventiva@gmail.com'));

CREATE POLICY "Tenant isolation company" ON company_settings 
    FOR ALL 
    USING (company_id = COALESCE(auth.jwt() ->> 'company_id', current_setting('request.jwt.claim.company_id', true), 'icerefrigeracaopreventiva@gmail.com'))
    WITH CHECK (company_id = COALESCE(auth.jwt() ->> 'company_id', current_setting('request.jwt.claim.company_id', true), 'icerefrigeracaopreventiva@gmail.com'));

CREATE POLICY "Tenant isolation staff" ON staff 
    FOR ALL 
    USING (company_id = COALESCE(auth.jwt() ->> 'company_id', current_setting('request.jwt.claim.company_id', true), 'icerefrigeracaopreventiva@gmail.com'))
    WITH CHECK (company_id = COALESCE(auth.jwt() ->> 'company_id', current_setting('request.jwt.claim.company_id', true), 'icerefrigeracaopreventiva@gmail.com'));

CREATE POLICY "Tenant isolation orders" ON orders 
    FOR ALL 
    USING (company_id = COALESCE(auth.jwt() ->> 'company_id', current_setting('request.jwt.claim.company_id', true), 'icerefrigeracaopreventiva@gmail.com'))
    WITH CHECK (company_id = COALESCE(auth.jwt() ->> 'company_id', current_setting('request.jwt.claim.company_id', true), 'icerefrigeracaopreventiva@gmail.com'));

CREATE POLICY "Tenant isolation expenses" ON expenses 
    FOR ALL 
    USING (company_id = COALESCE(auth.jwt() ->> 'company_id', current_setting('request.jwt.claim.company_id', true), 'icerefrigeracaopreventiva@gmail.com'))
    WITH CHECK (company_id = COALESCE(auth.jwt() ->> 'company_id', current_setting('request.jwt.claim.company_id', true), 'icerefrigeracaopreventiva@gmail.com'));

CREATE POLICY "Tenant isolation deliveries" ON deliveries 
    FOR ALL 
    USING (company_id = COALESCE(auth.jwt() ->> 'company_id', current_setting('request.jwt.claim.company_id', true), 'icerefrigeracaopreventiva@gmail.com'))
    WITH CHECK (company_id = COALESCE(auth.jwt() ->> 'company_id', current_setting('request.jwt.claim.company_id', true), 'icerefrigeracaopreventiva@gmail.com'));

CREATE POLICY "Tenant isolation customers" ON customers 
    FOR ALL 
    USING (company_id = COALESCE(auth.jwt() ->> 'company_id', current_setting('request.jwt.claim.company_id', true), 'icerefrigeracaopreventiva@gmail.com'))
    WITH CHECK (company_id = COALESCE(auth.jwt() ->> 'company_id', current_setting('request.jwt.claim.company_id', true), 'icerefrigeracaopreventiva@gmail.com'));
