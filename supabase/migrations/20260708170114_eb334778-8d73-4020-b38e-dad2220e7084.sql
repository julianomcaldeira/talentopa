
ALTER TABLE public.projeto_fases
  ADD COLUMN IF NOT EXISTS validacao_observacao TEXT;

-- Helper: notifica consultor da fase
-- (usa proposta aceita para descobrir consultor_user_id)

-- RMO solicita ajustes na fase (retorna para em_andamento, mantém documento)
CREATE OR REPLACE FUNCTION public.rmo_solicitar_ajustes_fase(p_fase_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fase record; v_projeto record; v_consultor uuid;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Informe o motivo para solicitar ajustes';
  END IF;
  SELECT * INTO v_fase FROM public.projeto_fases WHERE id = p_fase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_fase.projeto_id;
  IF v_projeto.canal_id IS NULL OR NOT public.is_canal_operador(v_projeto.canal_id, auth.uid()) THEN
    IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Apenas o RMO/Canal pode solicitar ajustes';
    END IF;
  END IF;

  UPDATE public.projeto_fases
     SET status = 'em_andamento'::public.status_fase,
         rmo_validada_por = NULL,
         rmo_validada_em = NULL,
         co_validada_por = NULL,
         co_validada_em = NULL,
         validacao_observacao = p_motivo,
         updated_at = now()
   WHERE id = p_fase_id;

  SELECT consultor_user_id INTO v_consultor
    FROM public.propostas
   WHERE projeto_id = v_projeto.id AND status = 'aceita'
   LIMIT 1;
  IF v_consultor IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_consultor, 'aviso', 'Ajustes solicitados na fase',
      'RMO solicitou ajustes na fase "' || v_fase.nome || '": ' || p_motivo,
      v_projeto.id, 'projeto');
  END IF;

  RETURN jsonb_build_object('success', true);
END $$;

-- RMO invalida fase (reprovada)
CREATE OR REPLACE FUNCTION public.rmo_invalidar_fase(p_fase_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fase record; v_projeto record; v_consultor uuid;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da invalidação';
  END IF;
  SELECT * INTO v_fase FROM public.projeto_fases WHERE id = p_fase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_fase.projeto_id;
  IF v_projeto.canal_id IS NULL OR NOT public.is_canal_operador(v_projeto.canal_id, auth.uid()) THEN
    IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Apenas o RMO/Canal pode invalidar a fase';
    END IF;
  END IF;

  UPDATE public.projeto_fases
     SET status = 'reprovada'::public.status_fase,
         validacao_observacao = p_motivo,
         rmo_validada_por = auth.uid(),
         rmo_validada_em = now(),
         updated_at = now()
   WHERE id = p_fase_id;

  SELECT consultor_user_id INTO v_consultor
    FROM public.propostas WHERE projeto_id = v_projeto.id AND status = 'aceita' LIMIT 1;
  IF v_consultor IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_consultor, 'aviso', 'Fase invalidada',
      'RMO invalidou a fase "' || v_fase.nome || '": ' || p_motivo,
      v_projeto.id, 'projeto');
  END IF;

  RETURN jsonb_build_object('success', true);
END $$;

-- Coordenador solicita ajustes
CREATE OR REPLACE FUNCTION public.coordenador_solicitar_ajustes_fase(p_fase_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fase record; v_projeto record; v_consultor uuid;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Informe o motivo para solicitar ajustes';
  END IF;
  SELECT * INTO v_fase FROM public.projeto_fases WHERE id = p_fase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_fase.projeto_id;
  IF v_projeto.coordenador_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas o coordenador designado pode solicitar ajustes';
  END IF;

  UPDATE public.projeto_fases
     SET status = 'em_andamento'::public.status_fase,
         co_validada_por = NULL,
         co_validada_em = NULL,
         validacao_observacao = p_motivo,
         updated_at = now()
   WHERE id = p_fase_id;

  SELECT consultor_user_id INTO v_consultor
    FROM public.propostas WHERE projeto_id = v_projeto.id AND status = 'aceita' LIMIT 1;
  IF v_consultor IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_consultor, 'aviso', 'Coordenador solicitou ajustes',
      'Coordenador solicitou ajustes na fase "' || v_fase.nome || '": ' || p_motivo,
      v_projeto.id, 'projeto');
  END IF;

  RETURN jsonb_build_object('success', true);
END $$;

-- Coordenador invalida fase (reprovada)
CREATE OR REPLACE FUNCTION public.coordenador_invalidar_fase(p_fase_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fase record; v_projeto record; v_consultor uuid;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da invalidação';
  END IF;
  SELECT * INTO v_fase FROM public.projeto_fases WHERE id = p_fase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_fase.projeto_id;
  IF v_projeto.coordenador_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas o coordenador designado pode invalidar';
  END IF;

  UPDATE public.projeto_fases
     SET status = 'reprovada'::public.status_fase,
         validacao_observacao = p_motivo,
         co_validada_por = auth.uid(),
         co_validada_em = now(),
         updated_at = now()
   WHERE id = p_fase_id;

  SELECT consultor_user_id INTO v_consultor
    FROM public.propostas WHERE projeto_id = v_projeto.id AND status = 'aceita' LIMIT 1;
  IF v_consultor IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_consultor, 'aviso', 'Fase invalidada pelo coordenador',
      'Coordenador invalidou a fase "' || v_fase.nome || '": ' || p_motivo,
      v_projeto.id, 'projeto');
  END IF;

  RETURN jsonb_build_object('success', true);
END $$;
