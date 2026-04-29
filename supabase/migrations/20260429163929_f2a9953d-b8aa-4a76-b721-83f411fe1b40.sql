CREATE OR REPLACE FUNCTION public.empresa_pre_aprovar_proposta(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposta record;
  v_projeto record;
BEGIN
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_proposta.projeto_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para pré-aprovar propostas';
  END IF;

  IF v_proposta.status NOT IN ('enviada'::public.status_proposta, 'pre_aprovada'::public.status_proposta) THEN
    RAISE EXCEPTION 'Somente propostas enviadas podem ser pré-aprovadas';
  END IF;

  UPDATE public.propostas
     SET status = 'pre_aprovada'::public.status_proposta,
         updated_at = now()
   WHERE id = p_proposta_id;

  UPDATE public.projetos
     SET status = 'em_selecao'::public.status_projeto,
         updated_at = now()
   WHERE id = v_projeto.id
     AND status IN ('publicado'::public.status_projeto, 'em_selecao'::public.status_projeto);

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    v_proposta.consultor_user_id,
    'sucesso',
    'Projeto pré-aprovado',
    'A empresa pré-aprovou sua proposta para "' || v_projeto.nome || '". A comunicação foi liberada para alinhamentos antes da aprovação final.',
    v_projeto.id,
    'projeto'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.empresa_aceitar_proposta(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposta record;
  v_projeto record;
BEGIN
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_proposta.projeto_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para aceitar propostas';
  END IF;

  IF v_proposta.status NOT IN ('enviada'::public.status_proposta, 'pre_aprovada'::public.status_proposta) THEN
    RAISE EXCEPTION 'Proposta já foi processada';
  END IF;

  UPDATE public.propostas
     SET status = 'aguardando_consultor'::public.status_proposta,
         updated_at = now()
   WHERE id = p_proposta_id;

  UPDATE public.projetos
     SET status = 'em_selecao'::public.status_projeto,
         updated_at = now()
   WHERE id = v_projeto.id;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    v_proposta.consultor_user_id,
    'sucesso',
    'Aprovação final solicitada',
    'A empresa aprovou sua proposta para "' || v_projeto.nome || '". Confirme o início para começar a gestão compartilhada.',
    v_projeto.id,
    'projeto'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_project_linked_consultants(p_projeto_id uuid, p_mensagem text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto record;
  v_consultor record;
  v_msg text;
BEGIN
  SELECT * INTO v_projeto FROM public.projetos WHERE id = p_projeto_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para notificar consultores';
  END IF;

  v_msg := COALESCE(NULLIF(trim(p_mensagem), ''), 'Houve uma atualização importante no projeto "' || v_projeto.nome || '". Acesse a plataforma para revisar os detalhes.');

  FOR v_consultor IN
    SELECT DISTINCT consultor_user_id
      FROM public.propostas
     WHERE projeto_id = p_projeto_id
       AND status IN ('enviada'::public.status_proposta, 'pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
  LOOP
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_consultor.consultor_user_id, 'info', 'Projeto atualizado', v_msg, p_projeto_id, 'projeto');
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.empresa_pre_aprovar_proposta(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_project_linked_consultants(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.empresa_pre_aprovar_proposta(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_project_linked_consultants(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Consultor sees only shared messages" ON public.mensagens;
CREATE POLICY "Consultor sees selected shared messages"
ON public.mensagens
FOR SELECT
USING (
  escopo = 'compartilhado'::text
  AND EXISTS (
    SELECT 1
    FROM public.propostas pr
    WHERE pr.projeto_id = mensagens.projeto_id
      AND pr.consultor_user_id = auth.uid()
      AND pr.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
  )
);

DROP POLICY IF EXISTS "Users insert messages they author" ON public.mensagens;
CREATE POLICY "Users insert messages they author"
ON public.mensagens
FOR INSERT
WITH CHECK (
  sender_user_id = auth.uid()
  AND (
    (
      escopo = 'compartilhado'::text
      AND (
        EXISTS (
          SELECT 1 FROM public.projetos p
          WHERE p.id = mensagens.projeto_id
            AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.propostas pr
          WHERE pr.projeto_id = mensagens.projeto_id
            AND pr.consultor_user_id = auth.uid()
            AND pr.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
        )
      )
    )
    OR (
      escopo = 'interno_empresa'::text
      AND EXISTS (
        SELECT 1 FROM public.projetos p
        WHERE p.id = mensagens.projeto_id
          AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
      )
    )
  )
);

CREATE OR REPLACE FUNCTION public.notify_nova_mensagem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto record;
  v_nome text;
  v_p record;
BEGIN
  IF NEW.bloqueado = true OR NEW.escopo <> 'compartilhado'::text THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_projeto FROM public.projetos WHERE id = NEW.projeto_id;
  SELECT nome INTO v_nome FROM public.profiles WHERE user_id = NEW.sender_user_id;

  IF v_projeto.empresa_user_id != NEW.sender_user_id THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_projeto.empresa_user_id, 'mensagem', 'Nova mensagem', COALESCE(v_nome, 'Alguém') || ' enviou uma mensagem em "' || v_projeto.nome || '".', NEW.projeto_id, 'projeto');
  END IF;

  FOR v_p IN
    SELECT consultor_user_id
    FROM public.propostas
    WHERE projeto_id = NEW.projeto_id
      AND status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
      AND consultor_user_id != NEW.sender_user_id
  LOOP
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_p.consultor_user_id, 'mensagem', 'Nova mensagem no projeto', COALESCE(v_nome, 'Empresa') || ' enviou uma mensagem em "' || v_projeto.nome || '".', NEW.projeto_id, 'projeto');
  END LOOP;

  RETURN NEW;
END;
$$;