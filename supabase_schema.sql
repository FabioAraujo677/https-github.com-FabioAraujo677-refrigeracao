-- ========================================================
-- GARANTIAPRO NEO - SCRIPT DE CRIAÇÃO E CORREÇÃO DO SUPABASE
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

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='company_id') THEN
        ALTER TABLE public.profiles ADD COLUMN company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='name') THEN
        ALTER TABLE public.profiles ADD COLUMN name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='password') THEN
        ALTER TABLE public.profiles ADD COLUMN password TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'tecnico';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone') THEN
        ALTER TABLE public.profiles ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='active') THEN
        ALTER TABLE public.profiles ADD COLUMN active BOOLEAN DEFAULT TRUE;
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

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='company_id') THEN
        ALTER TABLE public.clients ADD COLUMN company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='name') THEN
        ALTER TABLE public.clients ADD COLUMN name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='phone') THEN
        ALTER TABLE public.clients ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='cpf') THEN
        ALTER TABLE public.clients ADD COLUMN cpf TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='last_service_date') THEN
        ALTER TABLE public.clients ADD COLUMN last_service_date TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='total_orders') THEN
        ALTER TABLE public.clients ADD COLUMN total_orders INTEGER DEFAULT 1;
    END IF;
END $$;

-- 3. TABELA DE ORDENS DE SERVIÇO E GARANTIAS (service_orders)
CREATE TABLE IF NOT EXISTS public.service_orders (
    id TEXT PRIMARY KEY,
    company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    attendance_status TEXT DEFAULT 'Na fila / Aguardando',
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_cpf TEXT,
    cep TEXT,
    street TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    appliance_type TEXT NOT NULL,
    appliance_brand TEXT NOT NULL,
    appliance_model TEXT,
    serial_number TEXT,
    attendant_name TEXT,
    technician_name TEXT,
    driver_name TEXT,
    defect_description TEXT,
    service_description TEXT,
    parts_replaced TEXT,
    total_value NUMERIC(12,2) DEFAULT 0,
    payment_method TEXT,
    payment_status TEXT DEFAULT 'Pendente',
    warranty_months INTEGER DEFAULT 3,
    warranty_start_date DATE,
    warranty_end_date DATE,
    installments INTEGER,
    order_type TEXT DEFAULT 'garantia',
    scheduled_date DATE,
    scheduled_time TEXT,
    visit_fee NUMERIC(12,2),
    technician_lead_time_alert TEXT,
    technician_accepted_at TIMESTAMPTZ,
    client_signature TEXT,
    technician_signature TEXT,
    status TEXT DEFAULT 'Ativa',
    notes TEXT
);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='company_id') THEN
        ALTER TABLE public.service_orders ADD COLUMN company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='attendance_status') THEN
        ALTER TABLE public.service_orders ADD COLUMN attendance_status TEXT DEFAULT 'Na fila / Aguardando';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='customer_name') THEN
        ALTER TABLE public.service_orders ADD COLUMN customer_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='customer_phone') THEN
        ALTER TABLE public.service_orders ADD COLUMN customer_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='appliance_type') THEN
        ALTER TABLE public.service_orders ADD COLUMN appliance_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='appliance_brand') THEN
        ALTER TABLE public.service_orders ADD COLUMN appliance_brand TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='total_value') THEN
        ALTER TABLE public.service_orders ADD COLUMN total_value NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='order_type') THEN
        ALTER TABLE public.service_orders ADD COLUMN order_type TEXT DEFAULT 'garantia';
    END IF;
END $$;

-- 4. TABELA DE CONFIGURAÇÕES DA EMPRESA (company_settings)
CREATE TABLE IF NOT EXISTS public.company_settings (
    id TEXT PRIMARY KEY DEFAULT '1',
    company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com',
    name TEXT,
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

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='company_id') THEN
        ALTER TABLE public.company_settings ADD COLUMN company_id TEXT DEFAULT 'icerefrigeracaopreventiva@gmail.com';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='name') THEN
        ALTER TABLE public.company_settings ADD COLUMN name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='slogan') THEN
        ALTER TABLE public.company_settings ADD COLUMN slogan TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='cnpj') THEN
        ALTER TABLE public.company_settings ADD COLUMN cnpj TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='phone') THEN
        ALTER TABLE public.company_settings ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='whatsapp') THEN
        ALTER TABLE public.company_settings ADD COLUMN whatsapp TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='email') THEN
        ALTER TABLE public.company_settings ADD COLUMN email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='cep') THEN
        ALTER TABLE public.company_settings ADD COLUMN cep TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='street') THEN
        ALTER TABLE public.company_settings ADD COLUMN street TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='number') THEN
        ALTER TABLE public.company_settings ADD COLUMN number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='neighborhood') THEN
        ALTER TABLE public.company_settings ADD COLUMN neighborhood TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='city') THEN
        ALTER TABLE public.company_settings ADD COLUMN city TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='state') THEN
        ALTER TABLE public.company_settings ADD COLUMN state TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='business_hours') THEN
        ALTER TABLE public.company_settings ADD COLUMN business_hours TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='logo_url') THEN
        ALTER TABLE public.company_settings ADD COLUMN logo_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='warranty_terms') THEN
        ALTER TABLE public.company_settings ADD COLUMN warranty_terms TEXT;
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

-- INSERÇÃO ADAPTATIVA DE DADOS INICIAIS (OMITINDO O CAMPO ID PARA FUNCIONAR EM UUID, INTEGER OU TEXT)
DO $$ 
BEGIN 
    INSERT INTO public.company_settings (company_id, name, slogan, cnpj, phone, whatsapp, email, cep, street, number, neighborhood, city, state, business_hours, warranty_terms)
    VALUES (
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
    );
EXCEPTION WHEN OTHERS THEN 
    -- Se a empresa já estiver cadastrada ou houver restrição, segue em frente sem quebrar a execução
    NULL;
END $$;

DO $$ 
BEGIN 
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
    ) ON CONFLICT DO NOTHING;
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

-- PERMISSÕES E DESATIVAÇÃO DE REGRAS DE RLS QUE POSSAM BLOQUEAR
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.clients TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.service_orders TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.company_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.expenses TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.deliveries TO anon, authenticated, service_role;
