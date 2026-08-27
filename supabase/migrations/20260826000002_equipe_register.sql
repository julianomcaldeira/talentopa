-- Suporte a cadastro tipo "equipe" (RMO/Coordenador vinculado) sem criar empresa_perfil/consultor_perfil
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
  v_raw_tipo text;
  v_is_equipe boolean := false;
BEGIN
  v_nome := COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email);
  v_raw_tipo := COALESCE(NEW.raw_user_meta_data ->> 'tipo_usuario', '');
  v_is_equipe := (v_raw_tipo = 'equipe');

  IF v_is_equipe THEN
    v_role := 'empresa'::public.app_role;
  ELSIF v_raw_tipo IN ('admin', 'consultor', 'empresa', 'canal') THEN
    v_role := v_raw_tipo::public.app_role;
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

  -- equipe não cria perfil específico; vínculo será feito via empresa_add_membro
  IF v_is_equipe THEN
    -- nada: evita criar consultor_perfil/empresa_perfil/canai
    NULL;
  ELSIF v_role = 'consultor'::public.app_role THEN
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
