
CREATE OR REPLACE FUNCTION public.manage_user_set_role(_target uuid, _new_role public.app_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_nome text;
  v_email text;
BEGIN
  IF NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores centrais podem alterar o perfil de acesso';
  END IF;
  IF v_actor = _target THEN
    RAISE EXCEPTION 'Você não pode alterar o próprio perfil de acesso';
  END IF;

  SELECT nome, email INTO v_nome, v_email FROM public.profiles WHERE user_id = _target;

  DELETE FROM public.user_roles WHERE user_id = _target;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, _new_role);

  -- Garante linha de perfil específico para o novo papel
  IF _new_role = 'consultor'::public.app_role THEN
    INSERT INTO public.consultor_perfil (user_id) VALUES (_target)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF _new_role = 'empresa'::public.app_role THEN
    INSERT INTO public.empresa_perfil (user_id, razao_social)
    VALUES (_target, COALESCE(v_nome, v_email, 'Empresa'))
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF _new_role = 'canal'::public.app_role THEN
    INSERT INTO public.canais (user_id, nome, email_contato, responsavel_nome, status)
    VALUES (_target, COALESCE(v_nome, v_email, 'Canal'), v_email, v_nome, 'pendente')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  PERFORM public.log_audit_event(
    'usuario','mudanca_role','user_roles', _target,
    'Perfil de acesso alterado para ' || _new_role::text,
    NULL, jsonb_build_object('role', _new_role), 'warning'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
