-- Fix elegibilidade: aceitar convite quando já tem vínculo ativo em outro canal deve falhar com mensagem clara
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
  v_existing_canal uuid;
BEGIN
  SELECT * INTO v_convite FROM public.canal_convites WHERE token = p_token AND status = 'pendente' AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite inválido ou expirado'; END IF;
  IF lower(v_convite.email) <> lower(COALESCE(auth.jwt() ->> 'email', '')) THEN RAISE EXCEPTION 'Este convite pertence a outro e-mail'; END IF;

  -- se já tem vínculo ativo em outro canal, bloquear com mensagem clara (único ativo por consultor)
  IF p_aceitar THEN
    SELECT canal_id INTO v_existing_canal FROM public.canal_consultores WHERE consultor_user_id = auth.uid() AND status = 'ativo' LIMIT 1;
    IF v_existing_canal IS NOT NULL AND v_existing_canal <> v_convite.canal_id THEN
      RAISE EXCEPTION 'Você já possui vínculo ativo com outro canal. Desvincule-se antes de aceitar novo convite.';
    END IF;
  END IF;

  v_status := CASE WHEN p_aceitar THEN 'aceito'::public.status_canal_convite ELSE 'recusado'::public.status_canal_convite END;
  v_link_status := CASE WHEN p_aceitar THEN 'ativo'::public.status_canal_consultor ELSE 'recusado'::public.status_canal_consultor END;

  UPDATE public.canal_convites SET status = v_status, consultor_user_id = auth.uid(), data_resposta = now(), updated_at = now() WHERE id = v_convite.id;

  -- tentar inserir vínculo; se já existe ativo no mesmo canal (re-aceite), atualizar
  INSERT INTO public.canal_consultores (canal_id, consultor_user_id, convite_id, convite_email, status, convidado_por, data_vinculo, data_resposta)
  VALUES (v_convite.canal_id, auth.uid(), v_convite.id, v_convite.email, v_link_status, v_convite.convidado_por, CASE WHEN p_aceitar THEN now() ELSE NULL END, now())
  ON CONFLICT (consultor_user_id) WHERE status = 'ativo' DO NOTHING;

  -- se ON CONFLICT impediu (já ativo no mesmo canal), garantir que convite aceito reflita
  IF p_aceitar AND NOT EXISTS (SELECT 1 FROM public.canal_consultores WHERE consultor_user_id = auth.uid() AND canal_id = v_convite.canal_id AND status = 'ativo') THEN
    -- verificar se é porque já está ativo no mesmo canal (re-aceite idempotente)
    IF EXISTS (SELECT 1 FROM public.canal_consultores WHERE consultor_user_id = auth.uid() AND canal_id = v_convite.canal_id) THEN
      UPDATE public.canal_consultores SET status = 'ativo', data_vinculo = now(), data_resposta = now(), updated_at = now() WHERE consultor_user_id = auth.uid() AND canal_id = v_convite.canal_id;
    END IF;
  END IF;

  SELECT nome INTO v_canal_nome FROM public.canais WHERE id = v_convite.canal_id;
  SELECT nome INTO v_actor_nome FROM public.profiles WHERE user_id = auth.uid();
  SELECT role::text INTO v_actor_role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;

  INSERT INTO public.audit_logs (categoria, acao, entidade, entidade_id, actor_user_id, actor_nome, actor_role, descricao, severidade, metadata) VALUES (
    'canal_convite', CASE WHEN p_aceitar THEN 'convite_aceito' ELSE 'convite_recusado' END, 'canal_convite', v_convite.id, auth.uid(), v_actor_nome, v_actor_role,
    format('Consultor %s o convite do canal %s', CASE WHEN p_aceitar THEN 'aceitou' ELSE 'recusou' END, COALESCE(v_canal_nome, 'desconhecido')), 'info',
    jsonb_build_object('canal_id', v_convite.canal_id, 'canal_nome', v_canal_nome, 'convite_id', v_convite.id, 'consultor_user_id', auth.uid())
  );

  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$$;

-- Permitir que partes do projeto vejam nome do canal (empresa dona do projeto vê canal que respondeu)
DROP POLICY IF EXISTS "Canal owner and admins view full canal" ON public.canais;
CREATE POLICY "Canal owner and admins view full canal"
ON public.canais FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Project parties view canal" ON public.canais;
CREATE POLICY "Project parties view canal"
ON public.canais FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projetos p
    JOIN public.parceiro_respostas pr ON pr.projeto_id = p.id
    WHERE pr.canal_id = canais.id AND p.empresa_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.parceiro_respostas pr2 WHERE pr2.canal_id = canais.id AND pr2.canal_id IN (
      SELECT canal_id FROM public.canal_consultores WHERE consultor_user_id = auth.uid() AND status = 'ativo'
    )
  )
);

SELECT pg_notify('pgrst', 'reload schema');
