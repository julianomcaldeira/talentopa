
CREATE OR REPLACE FUNCTION public.empresa_selecionar_indicacao(p_indicacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ind record;
  v_resp record;
  v_projeto record;
  v_canal record;
  v_other_ind record;
  v_other_prop record;
BEGIN
  SELECT * INTO v_ind FROM public.parceiro_indicacoes WHERE id = p_indicacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Indicação não encontrada'; END IF;

  SELECT * INTO v_resp FROM public.parceiro_respostas WHERE id = v_ind.resposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resposta do parceiro não encontrada'; END IF;

  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_resp.projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para selecionar indicações deste projeto';
  END IF;

  IF v_ind.status <> 'indicado' THEN
    RAISE EXCEPTION 'Esta indicação não está mais disponível para seleção';
  END IF;

  SELECT * INTO v_canal FROM public.canais WHERE id = v_ind.canal_id;

  -- 1) marca indicação como selecionada
  UPDATE public.parceiro_indicacoes
     SET status = 'selecionado'
   WHERE id = p_indicacao_id;

  -- 2) demais indicações do MESMO projeto (todas as respostas de parceiros) viram 'recusado'
  FOR v_other_ind IN
    SELECT pi.id, pi.consultor_user_id, pi.canal_id, pr.projeto_id
      FROM public.parceiro_indicacoes pi
      JOIN public.parceiro_respostas pr ON pr.id = pi.resposta_id
     WHERE pr.projeto_id = v_projeto.id
       AND pi.id <> p_indicacao_id
       AND pi.status = 'indicado'
  LOOP
    UPDATE public.parceiro_indicacoes
       SET status = 'recusado'
     WHERE id = v_other_ind.id;

    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      v_other_ind.consultor_user_id,
      'aviso',
      'Indicação não selecionada',
      'A empresa selecionou outro consultor para "' || v_projeto.nome || '".',
      v_projeto.id,
      'projeto'
    );
  END LOOP;

  -- 3) recusa propostas diretas abertas no mesmo projeto
  FOR v_other_prop IN
    SELECT id, consultor_user_id
      FROM public.propostas
     WHERE projeto_id = v_projeto.id
       AND status IN ('enviada'::public.status_proposta,
                      'pre_aprovada'::public.status_proposta,
                      'contraproposta_consultor'::public.status_proposta)
  LOOP
    UPDATE public.propostas
       SET status = 'recusada'::public.status_proposta, updated_at = now()
     WHERE id = v_other_prop.id;

    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      v_other_prop.consultor_user_id,
      'aviso',
      'Proposta não selecionada',
      'A empresa selecionou outro consultor para "' || v_projeto.nome || '".',
      v_projeto.id,
      'projeto'
    );
  END LOOP;

  -- 4) cria alocação já aprovada com titularidade do Parceiro
  INSERT INTO public.alocacoes (
    projeto_id, consultor_user_id, canal_id, status,
    valor, solicitado_por, aprovado_por, data_aprovacao
  ) VALUES (
    v_projeto.id, v_ind.consultor_user_id, v_ind.canal_id, 'aprovada'::public.status_alocacao_canal,
    v_ind.valor_proposto, auth.uid(), auth.uid(), now()
  )
  ON CONFLICT (projeto_id, consultor_user_id, canal_id)
    DO UPDATE SET status = 'aprovada'::public.status_alocacao_canal,
                  aprovado_por = auth.uid(),
                  data_aprovacao = now(),
                  updated_at = now();

  -- 5) move projeto para em_selecao (segue o mesmo fluxo do empresa_aceitar_proposta)
  UPDATE public.projetos
     SET status = 'em_selecao'::public.status_projeto,
         updated_at = now()
   WHERE id = v_projeto.id
     AND status IN ('publicado'::public.status_projeto, 'em_selecao'::public.status_projeto);

  -- 6) notifica consultor selecionado
  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    v_ind.consultor_user_id,
    'sucesso',
    'Você foi selecionado',
    'A empresa selecionou você (via ' || COALESCE(v_canal.nome, 'parceiro') || ') para "' || v_projeto.nome || '".',
    v_projeto.id,
    'projeto'
  );

  -- 7) notifica dono do canal
  IF v_canal.user_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      v_canal.user_id,
      'sucesso',
      'Indicação aceita pela empresa',
      'A empresa selecionou o consultor indicado para "' || v_projeto.nome || '".',
      v_projeto.id,
      'projeto'
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'consultor_user_id', v_ind.consultor_user_id, 'canal_id', v_ind.canal_id);
END $function$;

GRANT EXECUTE ON FUNCTION public.empresa_selecionar_indicacao(uuid) TO authenticated;
