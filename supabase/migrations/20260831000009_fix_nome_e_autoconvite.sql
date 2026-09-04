-- Fix: nome exibido como empresa e auto-convite de si mesmo como RMO

-- 1) Bloquear auto-convite no backend também
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
  IF _target = v_actor THEN RAISE EXCEPTION 'Você não pode convidar a si mesmo'; END IF;
  IF _target = _empresa_user_id THEN RAISE EXCEPTION 'Você não pode convidar a si mesmo'; END IF;
  IF _papel NOT IN ('rmo','coordenador','responsavel','financeiro','operacional') THEN RAISE EXCEPTION 'Papel inválido: %', _papel; END IF;
  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  SELECT EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.user_id = v_actor AND eu.empresa_user_id = _empresa_user_id AND eu.papel IN ('rmo','coordenador','responsavel') AND eu.ativo = true) INTO v_is_membro_gestor;
  -- se o actor não tem vínculo ativo nem é dono, bloquear (evita login sem papel convidar a si mesmo)
  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN
    -- também checar se actor é dono via empresa_perfil (para equipe sem vínculo mas que é dono)
    IF NOT EXISTS (SELECT 1 FROM public.empresa_perfil WHERE user_id = v_actor) THEN
      RAISE EXCEPTION 'Sem permissão para adicionar membros a esta empresa';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _target) THEN RAISE EXCEPTION 'Usuário alvo não encontrado'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'empresa'::public.app_role) ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.empresa_usuarios (empresa_user_id, user_id, papel, ativo)
  VALUES (_empresa_user_id, _target, _papel::public.papel_empresa_usuario, true)
  ON CONFLICT (user_id) DO UPDATE SET empresa_user_id = EXCLUDED.empresa_user_id, papel = EXCLUDED.papel, ativo = true, inativado_em = NULL, inativado_por = NULL, updated_at = now();
  PERFORM public.log_audit_event('empresa','vinculo_membro','empresa_usuarios', _target, 'Membro vinculado à empresa ' || _empresa_user_id::text || ' como ' || _papel, NULL, jsonb_build_object('papel',_papel,'empresa_user_id',_empresa_user_id,'target',_target,'actor',v_actor), 'info');
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_add_membro(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_add_membro(uuid,text,uuid) TO authenticated, service_role;

-- 2) Limpar auto-vínculos já existentes (empresa_user_id = user_id)
DELETE FROM public.empresa_usuarios WHERE empresa_user_id = user_id;

-- 3) Corrigir profiles onde nome = razão social mas deveria ser nome da pessoa
-- Para usuários que são membros equipe mas têm empresa_perfil? Não — apenas limpar auto-vínculos já resolve exibição.
-- Garantir que profiles de equipe mostrem email quando nome é igual à empresa: não fazer update automático, apenas garantir fallback no frontend.

SELECT pg_notify('pgrst', 'reload schema');
