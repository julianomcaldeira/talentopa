-- Reaplicar empresa_add_membro para garantir que Lovable/Supabase atualize o schema cache
-- (o push anterior coincidiu com 521, então PostgREST não viu a função)
SELECT pg_notify('pgrst', 'reload schema');

-- Garante que a função existe mesmo se a migration anterior não rodou
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
  IF EXISTS (SELECT 1 FROM public.empresa_usuarios WHERE user_id = _target) THEN
    UPDATE public.empresa_usuarios SET empresa_user_id = _empresa_user_id, papel = _papel::public.papel_empresa_usuario, updated_at = now() WHERE user_id = _target;
  ELSE
    INSERT INTO public.empresa_usuarios (empresa_user_id, user_id, papel) VALUES (_empresa_user_id, _target, _papel::public.papel_empresa_usuario);
  END IF;
  PERFORM public.log_audit_event('empresa','vinculo_membro','empresa_usuarios', _target, 'Membro vinculado à empresa ' || _empresa_user_id::text || ' como ' || _papel, NULL, jsonb_build_object('papel',_papel,'empresa_user_id',_empresa_user_id,'target',_target,'actor',v_actor), 'info');
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_add_membro(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_add_membro(uuid,text,uuid) TO authenticated, service_role;
SELECT pg_notify('pgrst', 'reload schema');
