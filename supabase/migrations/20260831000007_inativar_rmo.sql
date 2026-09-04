-- Inativar RMO/equipe sem excluir (preserva histórico/demandas vinculadas à empresa)
-- Demanda: Empresa precisa revogar acesso do RMO mas manter projetos/demandas criados por ele (empresa_user_id = dono)

-- 1) Adicionar soft-delete em empresa_usuarios
ALTER TABLE public.empresa_usuarios
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inativado_em timestamptz,
  ADD COLUMN IF NOT EXISTS inativado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_empresa_usuarios_ativo ON public.empresa_usuarios(ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_empresa_usuarios_user_ativo ON public.empresa_usuarios(user_id) WHERE ativo = true;

-- Backfill: já existentes são ativos
UPDATE public.empresa_usuarios SET ativo = true WHERE ativo IS NULL;

-- 2) RPC para inativar (revoga acesso, preserva linha e histórico)
CREATE OR REPLACE FUNCTION public.empresa_inativar_membro(
  _target uuid,
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
  v_has_perfil boolean;
  v_remaining int;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _target IS NULL OR _empresa_user_id IS NULL THEN RAISE EXCEPTION 'Parâmetros obrigatórios ausentes'; END IF;

  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.user_id = v_actor AND eu.empresa_user_id = _empresa_user_id AND eu.papel IN ('rmo','coordenador','responsavel') AND eu.ativo = true
  ) INTO v_is_membro_gestor;

  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN
    RAISE EXCEPTION 'Sem permissão para inativar membros desta empresa';
  END IF;

  UPDATE public.empresa_usuarios
     SET ativo = false,
         inativado_em = now(),
         inativado_por = v_actor,
         updated_at = now()
   WHERE user_id = _target AND empresa_user_id = _empresa_user_id AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vínculo ativo não encontrado';
  END IF;

  -- se não tem mais nenhum vínculo ATIVO e não é dono (sem empresa_perfil), revogar role empresa
  SELECT COUNT(*) INTO v_remaining FROM public.empresa_usuarios WHERE user_id = _target AND ativo = true;
  IF v_remaining = 0 THEN
    SELECT EXISTS (SELECT 1 FROM public.empresa_perfil WHERE user_id = _target) INTO v_has_perfil;
    IF NOT v_has_perfil THEN
      DELETE FROM public.user_roles WHERE user_id = _target AND role = 'empresa'::public.app_role;
    END IF;
  END IF;

  PERFORM public.log_audit_event('empresa','inativacao_membro','empresa_usuarios', _target,
    'Membro inativado na empresa ' || _empresa_user_id::text,
    NULL, jsonb_build_object('target',_target,'empresa_user_id',_empresa_user_id,'actor',v_actor), 'warning');

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_inativar_membro(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_inativar_membro(uuid,uuid) TO authenticated, service_role;

-- 3) RPC para reativar
CREATE OR REPLACE FUNCTION public.empresa_reativar_membro(
  _target uuid,
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
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  IF NOT (v_is_owner OR v_is_admin) THEN RAISE EXCEPTION 'Sem permissão para reativar'; END IF;

  UPDATE public.empresa_usuarios
     SET ativo = true,
         inativado_em = NULL,
         inativado_por = NULL,
         updated_at = now()
   WHERE user_id = _target AND empresa_user_id = _empresa_user_id AND ativo = false;

  IF NOT FOUND THEN RAISE EXCEPTION 'Vínculo inativo não encontrado'; END IF;

  -- garantir role empresa de volta
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'empresa'::public.app_role) ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM public.log_audit_event('empresa','reativacao_membro','empresa_usuarios', _target,
    'Membro reativado na empresa ' || _empresa_user_id::text,
    NULL, jsonb_build_object('target',_target,'empresa_user_id',_empresa_user_id,'actor',v_actor), 'info');

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_reativar_membro(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_reativar_membro(uuid,uuid) TO authenticated, service_role;

-- 4) Ajustar empresa_add_membro para reativar se já existe inativo
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
  SELECT EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.user_id = v_actor AND eu.empresa_user_id = _empresa_user_id AND eu.papel IN ('rmo','coordenador','responsavel') AND eu.ativo = true) INTO v_is_membro_gestor;
  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN RAISE EXCEPTION 'Sem permissão para adicionar membros a esta empresa'; END IF;
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

-- 5) Ajustar empresa_remove_membro (hard delete) para considerar apenas ativo
CREATE OR REPLACE FUNCTION public.empresa_remove_membro(
  _target uuid,
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
  v_has_perfil boolean;
  v_remaining int;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _target IS NULL OR _empresa_user_id IS NULL THEN RAISE EXCEPTION 'Parâmetros obrigatórios ausentes'; END IF;
  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  SELECT EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.user_id = v_actor AND eu.empresa_user_id = _empresa_user_id AND eu.papel IN ('rmo','coordenador','responsavel') AND eu.ativo = true) INTO v_is_membro_gestor;
  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN RAISE EXCEPTION 'Sem permissão para remover membros desta empresa'; END IF;
  DELETE FROM public.empresa_usuarios WHERE user_id = _target AND empresa_user_id = _empresa_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vínculo não encontrado'; END IF;
  SELECT COUNT(*) INTO v_remaining FROM public.empresa_usuarios WHERE user_id = _target AND ativo = true;
  IF v_remaining = 0 THEN
    SELECT EXISTS (SELECT 1 FROM public.empresa_perfil WHERE user_id = _target) INTO v_has_perfil;
    IF NOT v_has_perfil THEN DELETE FROM public.user_roles WHERE user_id = _target AND role = 'empresa'::public.app_role; END IF;
  END IF;
  PERFORM public.log_audit_event('empresa','remocao_membro','empresa_usuarios', _target, 'Membro removido da empresa ' || _empresa_user_id::text, NULL, jsonb_build_object('target',_target,'empresa_user_id',_empresa_user_id,'actor',v_actor), 'warning');
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_remove_membro(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_remove_membro(uuid,uuid) TO authenticated, service_role;

SELECT pg_notify('pgrst', 'reload schema');
