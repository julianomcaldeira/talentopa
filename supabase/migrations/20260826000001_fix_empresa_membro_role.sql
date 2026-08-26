-- Fix RMO/equipe vinculado como consultor caindo em /consultor ao inves de /empresa
-- 1) RPC para vincular membro à empresa garantindo role 'empresa' (SECURITY DEFINER)
--    Permite que dono da empresa vincule qualquer usuário já cadastrado (find_user_id_by_email)
--    e garante que ele ganhe role empresa mesmo se foi cadastrado como consultor.

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
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF _target IS NULL OR _empresa_user_id IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes';
  END IF;
  IF _papel NOT IN ('rmo','coordenador','responsavel','financeiro','operacional') THEN
    RAISE EXCEPTION 'Papel inválido: %', _papel;
  END IF;

  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  -- permite que RMO/coordenador/responsavel da mesma empresa também adicionem membros
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.user_id = v_actor
      AND eu.empresa_user_id = _empresa_user_id
      AND eu.papel IN ('rmo','coordenador','responsavel')
  ) INTO v_is_membro_gestor;

  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN
    RAISE EXCEPTION 'Sem permissão para adicionar membros a esta empresa';
  END IF;

  -- garantir que alvo existe em profiles
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _target) THEN
    RAISE EXCEPTION 'Usuário alvo não encontrado';
  END IF;

  -- garantir role empresa (mantém outras roles, mas adiciona empresa)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target, 'empresa'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- upsert vínculo
  IF EXISTS (SELECT 1 FROM public.empresa_usuarios WHERE user_id = _target) THEN
    UPDATE public.empresa_usuarios
       SET empresa_user_id = _empresa_user_id,
           papel = _papel::public.papel_empresa_usuario,
           updated_at = now()
     WHERE user_id = _target;
  ELSE
    INSERT INTO public.empresa_usuarios (empresa_user_id, user_id, papel)
    VALUES (_empresa_user_id, _target, _papel::public.papel_empresa_usuario);
  END IF;

  PERFORM public.log_audit_event(
    'empresa','vinculo_membro','empresa_usuarios', _target,
    'Membro vinculado à empresa ' || _empresa_user_id::text || ' como ' || _papel,
    NULL,
    jsonb_build_object('papel',_papel,'empresa_user_id',_empresa_user_id,'target',_target,'actor',v_actor),
    'info'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.empresa_add_membro(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_add_membro(uuid,text,uuid) TO authenticated, service_role;

-- 2) Corrigir política de empresa_usuarios para permitir que membros gestores (rmo/coordenador/responsavel)
--    também insiram/removam membros da mesma empresa (além do dono)

DROP POLICY IF EXISTS "Empresa owner manages own links" ON public.empresa_usuarios;

CREATE POLICY "Empresa gestores manage links"
ON public.empresa_usuarios
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR auth.uid() = empresa_user_id
  OR EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.user_id = auth.uid()
      AND eu.empresa_user_id = empresa_usuarios.empresa_user_id
      AND eu.papel IN ('rmo','coordenador','responsavel')
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR auth.uid() = empresa_user_id
  OR EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.user_id = auth.uid()
      AND eu.empresa_user_id = empresa_usuarios.empresa_user_id
      AND eu.papel IN ('rmo','coordenador','responsavel')
  )
);

-- 3) Backfill: quem já está em empresa_usuarios mas não tem role empresa, ganha role empresa
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT eu.user_id, 'empresa'::public.app_role
FROM public.empresa_usuarios eu
LEFT JOIN public.user_roles ur ON ur.user_id = eu.user_id AND ur.role = 'empresa'::public.app_role
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;
