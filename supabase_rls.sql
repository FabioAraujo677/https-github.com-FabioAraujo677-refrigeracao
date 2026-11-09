-- Script de Migração SQL para Supabase RLS
-- Objetivo: Garantir segregação de dados entre empresas/administradores

-- 1. Adicionar coluna company_id e user_id (se não existirem) em todas as tabelas
DO $$ 
BEGIN
    -- Tabelas principais
    FOR t IN ARRAY ARRAY['orders', 'staff', 'expenses', 'deliveries', 'customers', 'company_settings'] LOOP
        -- Garantir company_id
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'company_id') THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN company_id TEXT', t);
        END IF;
        
        -- Garantir user_id (para rastreio de quem criou)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'user_id') THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN user_id UUID REFERENCES auth.users(id)', t);
        END IF;

        -- Habilitar RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        
        -- Remover políticas antigas (limpeza)
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for same company" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Segurança por empresa" ON %I', t);
        
        -- Criar nova política de RLS baseada no app_metadata ou user_id
        -- Nota: Como o sistema usa o e-mail ou um ID único para empresa, 
        -- a política ideal verifica se o company_id do registro bate com o company_id do usuário autenticado.
        
        EXECUTE format('
            CREATE POLICY "Segurança por empresa" ON %I
            FOR ALL
            TO authenticated
            USING (
                company_id = (SELECT (raw_user_meta_data->>''company_id'') FROM auth.users WHERE id = auth.uid())
                OR 
                (SELECT (email) FROM auth.users WHERE id = auth.uid()) = ''vendas.impactodigital2@gmail.com''
            )
            WITH CHECK (
                company_id = (SELECT (raw_user_meta_data->>''company_id'') FROM auth.users WHERE id = auth.uid())
                OR 
                (SELECT (email) FROM auth.users WHERE id = auth.uid()) = ''vendas.impactodigital2@gmail.com''
            )
        ', t);
    END LOOP;
END $$;

-- 2. Tabela especial de Usuários (Profiles)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Segurança usuários por empresa" ON public.users;

CREATE POLICY "Segurança usuários por empresa" ON public.users
FOR ALL
TO authenticated
USING (
    company_id = (SELECT (raw_user_meta_data->>''company_id'') FROM auth.users WHERE id = auth.uid())
    OR 
    (SELECT (email) FROM auth.users WHERE id = auth.uid()) = ''vendas.impactodigital2@gmail.com''
)
WITH CHECK (
    company_id = (SELECT (raw_user_meta_data->>''company_id'') FROM auth.users WHERE id = auth.uid())
    OR 
    (SELECT (email) FROM auth.users WHERE id = auth.uid()) = ''vendas.impactodigital2@gmail.com''
);

-- Permissão para o usuário ler seu próprio perfil durante o login (se o metadata falhar)
CREATE POLICY "Usuários leem próprio perfil" ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());
