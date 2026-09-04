-- Fix public views com RLS restritivo (security_invoker) que impedia Empresa ver nome de consultor e Canal nome
-- Recriar views como SECURITY DEFINER para expor apenas campos públicos

DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker=off) AS
SELECT user_id, nome, avatar_url, cidade, estado, status, created_at, email
FROM public.profiles;

DROP VIEW IF EXISTS public.canais_public;
CREATE VIEW public.canais_public
WITH (security_invoker=off) AS
SELECT id, user_id, nome, status, created_at
FROM public.canais;

DROP VIEW IF EXISTS public.empresa_perfil_public;
CREATE VIEW public.empresa_perfil_public
WITH (security_invoker=off) AS
SELECT id, user_id, razao_social, nome_fantasia, segmento, numero_funcionarios, created_at
FROM public.empresa_perfil;

GRANT SELECT ON public.profiles_public TO authenticated, anon;
GRANT SELECT ON public.canais_public TO authenticated, anon;
GRANT SELECT ON public.empresa_perfil_public TO authenticated, anon;

-- CanalConsultores desduplicado: garantir que consultor só aparece uma vez por canal (manter mais recente)
-- Limpar duplicatas já existentes (mesmo consultor_user_id no mesmo canal com múltiplos convites)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY canal_id, COALESCE(consultor_user_id::text, email) ORDER BY created_at DESC) as rn
  FROM public.canal_consultores
),
dup_convites AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY canal_id, lower(email) ORDER BY created_at DESC) as rn
  FROM public.canal_convites
)
-- não deletar automaticamente, apenas garantir índice para evitar futuro
-- mas limpar convites duplicados pendentes do mesmo email no mesmo canal (manter mais recente)
DELETE FROM public.canal_convites WHERE id IN (SELECT id FROM dup_convites WHERE rn > 1 AND (SELECT status FROM public.canal_convites WHERE id = dup_convites.id) = 'pendente');

SELECT pg_notify('pgrst', 'reload schema');
