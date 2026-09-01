-- Fix UNIQUE empresa_usuarios: 1 vínculo por user_id (evita duplicatas com papéis diferentes)
-- e corrige empresa_add_membro para atualizar por user_id (não por tripla)

-- 1) Limpar duplicatas: manter apenas o vínculo mais recente por user_id
DELETE FROM public.empresa_usuarios
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.empresa_usuarios
  ORDER BY user_id, updated_at DESC
);

-- 2) Dropar constraint antiga (empresa_user_id, user_id, papel) se existir
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.empresa_usuarios'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 3;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.empresa_usuarios DROP CONSTRAINT %I', cname);
  END IF;
END $$;

-- Dropar índices únicos antigos que podem ter sido criados implícitamente
DROP INDEX IF EXISTS public.empresa_usuarios_empresa_user_id_user_id_papel_key;
DROP INDEX IF EXISTS public.empresa_usuarios_empresa_user_id_user_id_key;

-- 3) Criar UNIQUE correta em user_id (um usuário só pode estar em uma empresa por vez)
CREATE UNIQUE INDEX IF NOT EXISTS uq_empresa_usuarios_user_id ON public.empresa_usuarios(user_id);

-- 4) Recriar empresa_add_membro corretamente (upsert por user_id, com fallback user_roles)
CREATE OR REPLACE FUNCTION public.empresa_add_membro(
  _target uuid,
  _papel text,
  _empresa_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_owner boolean;
  v_is_admin boolean;
  v_is_membro_gestor boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _target IS NULL OR _empresa_user_id IS NULL THEN RAISE EXCEPTION 'Parâmetros obrigatórios ausentes'; END IF;
  IF _papel NOT IN ('rmo','coordenador','responsavel','financeiro','operacional') THEN RAISE EXCEPTION 'Papel inválido: %', _papel; END IF;
  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  SELECT EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.user_id = v_actor AND eu.empresa_user_id = _empresa_user_id AND eu.papel IN ('rmo','coordenador','responsavel')) INTO v_is_membro_gestor;
  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN RAISE EXCEPTION 'Sem permissão para adicionar membros a esta empresa'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _target) THEN RAISE EXCEPTION 'Usuário alvo não encontrado'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'empresa'::public.app_role) ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.empresa_usuarios (empresa_user_id, user_id, papel)
  VALUES (_empresa_user_id, _target, _papel::public.papel_empresa_usuario)
  ON CONFLICT (user_id) DO UPDATE SET empresa_user_id = EXCLUDED.empresa_user_id, papel = EXCLUDED.papel, updated_at = now();
  PERFORM public.log_audit_event('empresa','vinculo_membro','empresa_usuarios', _target, 'Membro vinculado à empresa ' || _empresa_user_id::text || ' como ' || _papel, NULL, jsonb_build_object('papel',_papel,'empresa_user_id',_empresa_user_id,'target',_target,'actor',v_actor), 'info');
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_add_membro(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_add_membro(uuid,text,uuid) TO authenticated, service_role;

-- Garantir backfill de role empresa para quem já está vinculado
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT eu.user_id, 'empresa'::public.app_role
FROM public.empresa_usuarios eu
LEFT JOIN public.user_roles ur ON ur.user_id = eu.user_id AND ur.role = 'empresa'::public.app_role
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

SELECT pg_notify('pgrst', 'reload schema');
