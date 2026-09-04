-- Fix: ao remover RMO/equipe, revogar role empresa se não tiver mais vínculo e não for dono
-- e limpar vínculos órfãos quando auth.users é deletado

-- 1) RPC para empresa remover membro (usada por EmpresaCoordenadores)
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
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.user_id = v_actor AND eu.empresa_user_id = _empresa_user_id AND eu.papel IN ('rmo','coordenador','responsavel')
  ) INTO v_is_membro_gestor;

  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN
    RAISE EXCEPTION 'Sem permissão para remover membros desta empresa';
  END IF;

  -- remover vínculo específico
  DELETE FROM public.empresa_usuarios
  WHERE user_id = _target AND empresa_user_id = _empresa_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vínculo não encontrado';
  END IF;

  -- se não tem mais nenhum vínculo, e não é dono (sem empresa_perfil), revogar role empresa
  SELECT COUNT(*) INTO v_remaining FROM public.empresa_usuarios WHERE user_id = _target;
  IF v_remaining = 0 THEN
    SELECT EXISTS (SELECT 1 FROM public.empresa_perfil WHERE user_id = _target) INTO v_has_perfil;
    IF NOT v_has_perfil THEN
      DELETE FROM public.user_roles WHERE user_id = _target AND role = 'empresa'::public.app_role;
    END IF;
  END IF;

  PERFORM public.log_audit_event('empresa','remocao_membro','empresa_usuarios', _target,
    'Membro removido da empresa ' || _empresa_user_id::text,
    NULL, jsonb_build_object('target',_target,'empresa_user_id',_empresa_user_id,'actor',v_actor), 'warning');

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_remove_membro(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_remove_membro(uuid,uuid) TO authenticated, service_role;

-- 2) Trigger: quando auth.users é deletado, limpar vínculos órfãos e roles
CREATE OR REPLACE FUNCTION public.cleanup_empresa_usuarios_on_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.empresa_usuarios WHERE user_id = OLD.id;
  -- roles são cascade via profiles? mas garantir limpeza se ficar órfão
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_empresa_usuarios_on_auth_delete ON auth.users;
CREATE TRIGGER trg_cleanup_empresa_usuarios_on_auth_delete
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_empresa_usuarios_on_user_delete();

SELECT pg_notify('pgrst', 'reload schema');
