-- Limpeza de RMO removido que continua como empresa (falha de revogação quando fallback foi usado)
-- Remove role empresa órfã de usuários sem vínculo ativo e sem empresa_perfil
DELETE FROM public.user_roles
WHERE role = 'empresa'::public.app_role
  AND user_id IN (
    SELECT ur.user_id FROM public.user_roles ur
    LEFT JOIN public.empresa_usuarios eu ON eu.user_id = ur.user_id AND eu.ativo = true
    LEFT JOIN public.empresa_perfil ep ON ep.user_id = ur.user_id
    WHERE ur.role = 'empresa'::public.app_role
      AND eu.user_id IS NULL
      AND ep.user_id IS NULL
  );

-- Caso coluna ativo ainda não exista em alguns ambientes (fallback), garantir limpeza legacy
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='empresa_usuarios' AND column_name='ativo') THEN
    DELETE FROM public.user_roles
    WHERE role = 'empresa'::public.app_role
      AND user_id IN (
        SELECT ur.user_id FROM public.user_roles ur
        LEFT JOIN public.empresa_usuarios eu2 ON eu2.user_id = ur.user_id
        LEFT JOIN public.empresa_perfil ep2 ON ep2.user_id = ur.user_id
        WHERE ur.role = 'empresa'::public.app_role AND eu2.user_id IS NULL AND ep2.user_id IS NULL
      );
  END IF;
END $$;

SELECT pg_notify('pgrst', 'reload schema');
