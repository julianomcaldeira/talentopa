
-- Ajuste direto: consultor altera valor enquanto status = pre_aprovada
CREATE OR REPLACE FUNCTION public.consultor_ajustar_proposta(
  p_proposta_id uuid,
  p_valor numeric,
  p_horas numeric DEFAULT NULL,
  p_motivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_proposta record; v_projeto record; v_old_valor numeric; v_old_horas numeric;
BEGIN
  SELECT * INTO v_proposta FROM propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF v_proposta.consultor_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Apenas o consultor pode ajustar a proposta';
  END IF;
  IF v_proposta.status <> 'pre_aprovada'::status_proposta THEN
    RAISE EXCEPTION 'O ajuste rápido só é permitido quando a proposta está pré-aprovada';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Informe um valor válido';
  END IF;

  v_old_valor := v_proposta.valor_proposta;
  v_old_horas := v_proposta.estimativa_horas;

  UPDATE propostas
     SET valor_proposta = p_valor,
         estimativa_horas = COALESCE(p_horas, estimativa_horas),
         updated_at = now()
   WHERE id = p_proposta_id;

  SELECT * INTO v_projeto FROM projetos WHERE id = v_proposta.projeto_id;

  PERFORM notify_empresa_por_papel(
    v_projeto.empresa_user_id, 'responsavel'::papel_empresa_usuario,
    'info', 'Consultor ajustou a proposta',
    'O consultor ajustou a proposta do projeto "'||v_projeto.nome||'" de R$ '||COALESCE(v_old_valor,0)||' para R$ '||p_valor||
      CASE WHEN p_motivo IS NOT NULL AND length(trim(p_motivo))>0 THEN '. Motivo: '||p_motivo ELSE '' END,
    v_projeto.id, 'projeto'
  );

  PERFORM log_audit_event(
    'proposta','ajuste_consultor','propostas', p_proposta_id,
    'Consultor ajustou valor/horas da proposta pré-aprovada',
    jsonb_build_object('valor', v_old_valor, 'horas', v_old_horas),
    jsonb_build_object('valor', p_valor, 'horas', COALESCE(p_horas, v_old_horas), 'motivo', p_motivo),
    'info'
  );

  RETURN jsonb_build_object('success', true);
END $$;

-- Contraproposta formal: consultor responde 'aguardando_consultor' com novo valor; volta para empresa pré-aprovar
CREATE OR REPLACE FUNCTION public.consultor_enviar_contraproposta(
  p_proposta_id uuid,
  p_valor numeric,
  p_horas numeric DEFAULT NULL,
  p_justificativa text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_proposta record; v_projeto record; v_old_valor numeric;
BEGIN
  SELECT * INTO v_proposta FROM propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF v_proposta.consultor_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Apenas o consultor pode enviar contraproposta';
  END IF;
  IF v_proposta.status NOT IN ('aguardando_consultor'::status_proposta, 'pre_aprovada'::status_proposta) THEN
    RAISE EXCEPTION 'A contraproposta só pode ser enviada antes do aceite final';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Informe um valor válido';
  END IF;

  v_old_valor := v_proposta.valor_proposta;

  UPDATE propostas
     SET valor_proposta = p_valor,
         estimativa_horas = COALESCE(p_horas, estimativa_horas),
         comentarios = CASE
            WHEN p_justificativa IS NOT NULL AND length(trim(p_justificativa))>0
              THEN COALESCE(comentarios||E'\n\n','') || '[Contraproposta] ' || p_justificativa
            ELSE comentarios END,
         status = 'contraproposta_consultor'::status_proposta,
         updated_at = now()
   WHERE id = p_proposta_id;

  SELECT * INTO v_projeto FROM projetos WHERE id = v_proposta.projeto_id;

  PERFORM notify_empresa_por_papel(
    v_projeto.empresa_user_id, 'responsavel'::papel_empresa_usuario,
    'alerta', 'Contraproposta recebida',
    'O consultor enviou contraproposta no projeto "'||v_projeto.nome||'": novo valor R$ '||p_valor||
      ' (anterior R$ '||COALESCE(v_old_valor,0)||'). É necessário pré-aprovar novamente.',
    v_projeto.id, 'projeto'
  );

  PERFORM log_audit_event(
    'proposta','contraproposta_enviada','propostas', p_proposta_id,
    'Consultor enviou contraproposta com novo valor',
    jsonb_build_object('valor', v_old_valor, 'status', v_proposta.status),
    jsonb_build_object('valor', p_valor, 'horas', p_horas, 'justificativa', p_justificativa, 'status', 'contraproposta_consultor'),
    'warning'
  );

  RETURN jsonb_build_object('success', true);
END $$;

-- Empresa pode pré-aprovar uma contraproposta também
CREATE OR REPLACE FUNCTION public.empresa_pre_aprovar_proposta(p_proposta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_proposta record; v_projeto record;
BEGIN
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_proposta.projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para pré-aprovar propostas';
  END IF;
  IF v_proposta.status NOT IN ('enviada'::public.status_proposta,
                                'pre_aprovada'::public.status_proposta,
                                'contraproposta_consultor'::public.status_proposta) THEN
    RAISE EXCEPTION 'Somente propostas enviadas ou contrapropostas podem ser pré-aprovadas';
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
    'Proposta pré-aprovada',
    'A empresa pré-aprovou sua proposta para "' || v_projeto.nome || '". A comunicação está liberada para alinhamentos.',
    v_projeto.id,
    'projeto'
  );

  RETURN jsonb_build_object('success', true);
END $$;

-- Empresa aceita contraproposta (vai direto para aguardando_consultor)
CREATE OR REPLACE FUNCTION public.empresa_aceitar_proposta(p_proposta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_proposta record; v_projeto record;
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
END $$;
