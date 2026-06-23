-- Add RPC for empresa to reject a proposal, and auto-reject siblings when one is accepted
CREATE OR REPLACE FUNCTION public.empresa_recusar_proposta(p_proposta_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_proposta record; v_projeto record;
BEGIN
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_proposta.projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para recusar propostas';
  END IF;
  IF v_proposta.status IN ('aceita'::public.status_proposta, 'recusada'::public.status_proposta) THEN
    RAISE EXCEPTION 'Proposta já foi processada';
  END IF;

  UPDATE public.propostas
     SET status = 'recusada'::public.status_proposta,
         updated_at = now()
   WHERE id = p_proposta_id;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    v_proposta.consultor_user_id,
    'aviso',
    'Proposta não selecionada',
    'A empresa decidiu não seguir com sua proposta para "' || v_projeto.nome || '".'
      || COALESCE(' Motivo: ' || p_motivo, ''),
    v_projeto.id,
    'projeto'
  );

  RETURN jsonb_build_object('success', true);
END $function$;

-- Update accept function to auto-reject other open proposals on the same project
CREATE OR REPLACE FUNCTION public.empresa_aceitar_proposta(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_proposta record; v_projeto record; v_other record;
BEGIN
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_proposta.projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para aceitar propostas';
  END IF;
  IF v_proposta.status NOT IN ('enviada'::public.status_proposta,
                                'pre_aprovada'::public.status_proposta,
                                'contraproposta_consultor'::public.status_proposta) THEN
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

  -- Auto-reject other open proposals on the same project
  FOR v_other IN
    SELECT id, consultor_user_id
      FROM public.propostas
     WHERE projeto_id = v_projeto.id
       AND id <> p_proposta_id
       AND status IN ('enviada'::public.status_proposta,
                      'pre_aprovada'::public.status_proposta,
                      'contraproposta_consultor'::public.status_proposta)
  LOOP
    UPDATE public.propostas
       SET status = 'recusada'::public.status_proposta, updated_at = now()
     WHERE id = v_other.id;

    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      v_other.consultor_user_id,
      'aviso',
      'Proposta não selecionada',
      'A empresa selecionou outra proposta para o projeto "' || v_projeto.nome || '".',
      v_projeto.id,
      'projeto'
    );
  END LOOP;

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
END $function$;