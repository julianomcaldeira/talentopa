
-- 1) Novo status
ALTER TYPE public.status_proposta ADD VALUE IF NOT EXISTS 'contraproposta_consultor';
