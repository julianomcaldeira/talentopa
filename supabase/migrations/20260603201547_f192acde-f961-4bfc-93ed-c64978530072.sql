CREATE OR REPLACE FUNCTION public.responder_convite_canal(p_token uuid, p_aceitar boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_convite record;
  v_status public.status_canal_convite;
  v_link_status public.status_canal_consultor;
  v_canal_nome text;
  v_actor_nome text;
  v_actor_role text;
BEGIN
  SELECT * INTO v_convite
  FROM public.canal_convites
  WHERE token = p_token
    AND status = 'pendente'
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido ou expirado';
  END IF;

  IF lower(v_convite.email) <> lower(COALESCE(auth.jwt() ->> 'email', '')) THEN
    RAISE EXCEPTION 'Este convite pertence a outro e-mail';
  END IF;

  v_status := CASE WHEN p_aceitar THEN 'aceito'::public.status_canal_convite ELSE 'recusado'::public.status_canal_convite END;
  v_link_status := CASE WHEN p_aceitar THEN 'ativo'::public.status_canal_consultor ELSE 'recusado'::public.status_canal_consultor END;

  UPDATE public.canal_convites
  SET status = v_status,
      consultor_user_id = auth.uid(),
      data_resposta = now(),
      updated_at = now()
  WHERE id = v_convite.id;

  INSERT INTO public.canal_consultores (canal_id, consultor_user_id, convite_id, convite_email, status, convidado_por, data_vinculo, data_resposta)
  VALUES (v_convite.canal_id, auth.uid(), v_convite.id, v_convite.email, v_link_status, v_convite.convidado_por, CASE WHEN p_aceitar THEN now() ELSE NULL END, now())
  ON CONFLICT DO NOTHING;

  -- Audit log
  SELECT nome INTO v_canal_nome FROM public.canais WHERE id = v_convite.canal_id;
  SELECT nome INTO v_actor_nome FROM public.profiles WHERE user_id = auth.uid();
  SELECT role::text INTO v_actor_role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;

  INSERT INTO public.audit_logs (
    categoria, acao, entidade, entidade_id,
    actor_user_id, actor_nome, actor_role,
    descricao, severidade, metadata
  ) VALUES (
    'canal_convite',
    CASE WHEN p_aceitar THEN 'convite_aceito' ELSE 'convite_recusado' END,
    'canal_convite',
    v_convite.id,
    auth.uid(),
    v_actor_nome,
    v_actor_role,
    format('Consultor %s o convite do canal %s',
      CASE WHEN p_aceitar THEN 'aceitou' ELSE 'recusou' END,
      COALESCE(v_canal_nome, 'desconhecido')),
    'info',
    jsonb_build_object(
      'canal_id', v_convite.canal_id,
      'canal_nome', v_canal_nome,
      'convite_id', v_convite.id,
      'convite_email', v_convite.email,
      'consultor_user_id', auth.uid(),
      'opcao', CASE WHEN p_aceitar THEN 'aceitar' ELSE 'recusar' END,
      'respondido_em', now()
    )
  );

  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$$;