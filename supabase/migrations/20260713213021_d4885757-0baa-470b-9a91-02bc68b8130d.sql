
-- 1) Add created_by to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_created_by ON public.profiles(created_by);

-- 2) Update handle_new_user to capture created_by from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_nome text;
  v_created_by uuid;
BEGIN
  v_nome := COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email);

  IF COALESCE(NEW.raw_user_meta_data ->> 'tipo_usuario', '') IN ('admin', 'consultor', 'empresa', 'canal') THEN
    v_role := (NEW.raw_user_meta_data ->> 'tipo_usuario')::public.app_role;
  ELSE
    v_role := 'consultor'::public.app_role;
  END IF;

  BEGIN
    v_created_by := NULLIF(NEW.raw_user_meta_data ->> 'created_by','')::uuid;
  EXCEPTION WHEN others THEN
    v_created_by := NULL;
  END;

  INSERT INTO public.profiles (user_id, nome, email, telefone, created_by)
  VALUES (
    NEW.id,
    v_nome,
    NEW.email,
    NEW.raw_user_meta_data ->> 'telefone',
    v_created_by
  )
  ON CONFLICT (user_id) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    telefone = COALESCE(EXCLUDED.telefone, public.profiles.telefone),
    created_by = COALESCE(public.profiles.created_by, EXCLUDED.created_by),
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_role = 'consultor'::public.app_role THEN
    INSERT INTO public.consultor_perfil (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF v_role = 'empresa'::public.app_role THEN
    INSERT INTO public.empresa_perfil (user_id, razao_social, cnpj, nome_fantasia, endereco, segmento)
    VALUES (
      NEW.id, v_nome,
      NEW.raw_user_meta_data ->> 'cnpj',
      NEW.raw_user_meta_data ->> 'nome_fantasia',
      NEW.raw_user_meta_data ->> 'endereco',
      NEW.raw_user_meta_data ->> 'segmento'
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF v_role = 'canal'::public.app_role THEN
    INSERT INTO public.canais (user_id, nome, cnpj, responsavel_nome, email_contato, telefone, status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'nome_fantasia', v_nome),
      NEW.raw_user_meta_data ->> 'cnpj',
      COALESCE(NEW.raw_user_meta_data ->> 'contato_nome', v_nome),
      NEW.email,
      NEW.raw_user_meta_data ->> 'telefone',
      'pendente'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      nome = EXCLUDED.nome,
      cnpj = COALESCE(EXCLUDED.cnpj, public.canais.cnpj),
      responsavel_nome = COALESCE(EXCLUDED.responsavel_nome, public.canais.responsavel_nome),
      email_contato = EXCLUDED.email_contato,
      telefone = COALESCE(EXCLUDED.telefone, public.canais.telefone),
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) can_manage_user: admin or original creator
CREATE OR REPLACE FUNCTION public.can_manage_user(_target uuid, _actor uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _actor IS NULL OR _target IS NULL THEN false
    WHEN _actor = _target THEN true
    WHEN public.has_role(_actor, 'admin'::public.app_role) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = _target AND p.created_by = _actor
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_user(uuid, uuid) TO authenticated, service_role;

-- 4) manage_user_update: nome/telefone/cidade/estado/status/empresa sub-papel
CREATE OR REPLACE FUNCTION public.manage_user_update(
  _target uuid,
  _nome text DEFAULT NULL,
  _telefone text DEFAULT NULL,
  _cidade text DEFAULT NULL,
  _estado text DEFAULT NULL,
  _status text DEFAULT NULL,
  _empresa_papel text DEFAULT NULL,       -- 'rmo','coordenador','responsavel','financeiro','operacional' or 'remove' to clear
  _empresa_user_id uuid DEFAULT NULL      -- empresa titular; obrigatório se _empresa_papel definir vínculo
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.can_manage_user(_target, v_actor) THEN
    RAISE EXCEPTION 'Sem permissão para editar este usuário';
  END IF;

  UPDATE public.profiles
     SET nome     = COALESCE(_nome, nome),
         telefone = COALESCE(_telefone, telefone),
         cidade   = COALESCE(_cidade, cidade),
         estado   = COALESCE(_estado, estado),
         status   = COALESCE(_status, status),
         updated_at = now()
   WHERE user_id = _target;

  IF _empresa_papel IS NOT NULL THEN
    IF _empresa_papel = 'remove' THEN
      DELETE FROM public.empresa_usuarios WHERE user_id = _target;
    ELSE
      IF _empresa_user_id IS NULL THEN
        RAISE EXCEPTION 'empresa_user_id é obrigatório para atribuir sub-papel';
      END IF;
      -- garantir role empresa
      INSERT INTO public.user_roles (user_id, role)
      VALUES (_target, 'empresa'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;

      -- upsert do vínculo
      IF EXISTS (SELECT 1 FROM public.empresa_usuarios WHERE user_id = _target) THEN
        UPDATE public.empresa_usuarios
           SET empresa_user_id = _empresa_user_id,
               papel = _empresa_papel::public.papel_empresa_usuario,
               updated_at = now()
         WHERE user_id = _target;
      ELSE
        INSERT INTO public.empresa_usuarios (empresa_user_id, user_id, papel)
        VALUES (_empresa_user_id, _target, _empresa_papel::public.papel_empresa_usuario);
      END IF;
    END IF;
  END IF;

  PERFORM public.log_audit_event(
    'usuario','edicao','profiles', _target,
    'Usuário editado por ' || v_actor::text,
    NULL,
    jsonb_build_object('nome',_nome,'telefone',_telefone,'cidade',_cidade,'estado',_estado,'status',_status,'empresa_papel',_empresa_papel,'empresa_user_id',_empresa_user_id),
    'info'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.manage_user_update(uuid,text,text,text,text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_user_update(uuid,text,text,text,text,text,text,uuid) TO authenticated, service_role;

-- 5) manage_user_set_role: alterar papel principal (apenas admin)
CREATE OR REPLACE FUNCTION public.manage_user_set_role(_target uuid, _new_role public.app_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores centrais podem alterar o perfil de acesso';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, _new_role);

  PERFORM public.log_audit_event(
    'usuario','mudanca_role','user_roles', _target,
    'Perfil de acesso alterado para ' || _new_role::text,
    NULL, jsonb_build_object('role', _new_role), 'warning'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.manage_user_set_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_user_set_role(uuid, public.app_role) TO authenticated, service_role;
