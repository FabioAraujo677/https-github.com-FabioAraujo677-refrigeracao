-- Script de Migração SQL para SuperDB RLS (sem prefixo public.)
-- Objetivo: Garantir segregação de dados por company_id entre empresas/administradores

-- 1. Adicionar coluna company_id e user_id (se não existirem) em todas as tabelas existentes
DO $$ 
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['service_orders', 'profiles', 'clients', 'expenses', 'deliveries', 'company_settings', 'perfil_empresa', 'orders', 'staff', 'customers'] LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
            -- Garantir company_id
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'company_id') THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN company_id TEXT DEFAULT ''icerefrigeracaopreventiva@gmail.com''', t);
            END IF;

            -- Garantir user_id (para rastreio de quem criou)
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'user_id') THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN user_id UUID', t);
            END IF;

            -- Habilitar RLS
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

            -- Remover políticas antigas (limpeza)
            EXECUTE format('DROP POLICY IF EXISTS "Enable all access for same company" ON %I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Segurança por empresa" ON %I', t);

            -- Criar política de RLS baseada no company_id
            EXECUTE format('
                CREATE POLICY "Segurança por empresa" ON %I
                FOR ALL
                TO authenticated
                USING (
                    company_id = (SELECT (raw_user_meta_data->>''company_id'') FROM auth.users WHERE id = auth.uid())
                    OR 
                    (SELECT (email) FROM auth.users WHERE id = auth.uid()) = ''icerefrigeracaopreventiva@gmail.com''
                )
                WITH CHECK (
                    company_id = (SELECT (raw_user_meta_data->>''company_id'') FROM auth.users WHERE id = auth.uid())
                    OR 
                    (SELECT (email) FROM auth.users WHERE id = auth.uid()) = ''icerefrigeracaopreventiva@gmail.com''
                )
            ', t);
        END IF;
    END LOOP;
END $$;

-- 2. Tabela opcional de Usuários (users), sem prefixo public.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Segurança usuários por empresa" ON users;
        DROP POLICY IF EXISTS "Usuários leem próprio perfil" ON users;

        CREATE POLICY "Segurança usuários por empresa" ON users
        FOR ALL
        TO authenticated
        USING (
            company_id = (SELECT (raw_user_meta_data->>'company_id') FROM auth.users WHERE id = auth.uid())
            OR 
            (SELECT (email) FROM auth.users WHERE id = auth.uid()) = 'icerefrigeracaopreventiva@gmail.com'
        )
        WITH CHECK (
            company_id = (SELECT (raw_user_meta_data->>'company_id') FROM auth.users WHERE id = auth.uid())
            OR 
            (SELECT (email) FROM auth.users WHERE id = auth.uid()) = 'icerefrigeracaopreventiva@gmail.com'
        );

        CREATE POLICY "Usuários leem próprio perfil" ON users
        FOR SELECT
        TO authenticated
        USING (id = auth.uid());
    END IF;
END $$;
