
-- Realtime para fases de projeto (idempotente)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_fases;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper interno: notifica todos os envolvidos numa fase
CREATE OR REPLACE FUNCTION public.notificar_envolvidos_fase(
  p_projeto_id uuid,
  p_fase_nome text,
  p_titulo text,
  p_mensagem text,
  p_tipo text DEFAULT 'info',
  p_excluir uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_projeto record;
  v_consultor uuid;
  r record;
BEGIN
  SELECT * INTO v_projeto FROM public.projetos WHERE id = p_projeto_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT consultor_user_id INTO v_consultor
    FROM public.propostas
   WHERE projeto_id = p_projeto_id AND status = 'aceita'
   LIMIT 1;

  -- Consultor
  IF v_consultor IS NOT NULL AND v_consultor IS DISTINCT FROM p_excluir THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_consultor, p_tipo, p_titulo, p_mensagem, p_projeto_id, 'projeto');
  END IF;

  -- Empresa (dono do projeto)
  IF v_projeto.empresa_user_id IS NOT NULL AND v_projeto.empresa_user_id IS DISTINCT FROM p_excluir THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_projeto.empresa_user_id, p_tipo, p_titulo, p_mensagem, p_projeto_id, 'projeto');
  END IF;

  -- Coordenador
  IF v_projeto.coordenador_user_id IS NOT NULL
     AND v_projeto.coordenador_user_id IS DISTINCT FROM p_excluir THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_projeto.coordenador_user_id, p_tipo, p_titulo, p_mensagem, p_projeto_id, 'projeto');
  END IF;

  -- RMOs / admins do canal
  IF v_projeto.canal_id IS NOT NULL THEN
    FOR r IN
      SELECT user_id FROM public.canal_membros
       WHERE canal_id = v_projeto.canal_id
         AND status = 'ativo'
         AND role IN ('rmo','admin')
    LOOP
      IF r.user_id IS DISTINCT FROM p_excluir THEN
        INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
        VALUES (r.user_id, p_tipo, p_titulo, p_mensagem, p_projeto_id, 'projeto');
      END IF;
    END LOOP;
  END IF;
END $$;

-- ============ RMO VALIDA ============
CREATE OR REPLACE FUNCTION public.rmo_validar_fase(p_fase_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fase record; v_projeto record;
BEGIN
  SELECT * INTO v_fase FROM public.projeto_fases WHERE id = p_fase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_fase.projeto_id;
  IF v_projeto.canal_id IS NULL OR NOT public.is_canal_operador(v_projeto.canal_id, auth.uid()) THEN
    IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Apenas o RMO/Canal pode validar a fase';
    END IF;
  END IF;

  UPDATE public.projeto_fases
     SET rmo_validada_por = auth.uid(), rmo_validada_em = now(),
         status = 'aprovada'::public.status_fase, updated_at = now()
   WHERE id = p_fase_id;

  PERFORM public.notificar_envolvidos_fase(
    v_projeto.id, v_fase.nome,
    'Fase aprovada pelo RMO',
    'O RMO aprovou a fase "' || v_fase.nome || '" do projeto "' || v_projeto.nome || '".',
    'sucesso', auth.uid());

  RETURN jsonb_build_object('success', true);
END $$;

-- ============ COORDENADOR CO-VALIDA ============
CREATE OR REPLACE FUNCTION public.coordenador_co_validar_fase(p_fase_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fase record; v_projeto record;
BEGIN
  SELECT * INTO v_fase FROM public.projeto_fases WHERE id = p_fase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_fase.projeto_id;
  IF v_projeto.coordenador_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Apenas o coordenador designado pode co-validar';
  END IF;

  UPDATE public.projeto_fases
     SET co_validada_por = auth.uid(), co_validada_em = now(), updated_at = now()
   WHERE id = p_fase_id;

  PERFORM public.notificar_envolvidos_fase(
    v_projeto.id, v_fase.nome,
    'Fase co-validada pelo Coordenador',
    'O Coordenador co-validou a fase "' || v_fase.nome || '" do projeto "' || v_projeto.nome || '".',
    'sucesso', auth.uid());

  RETURN jsonb_build_object('success', true);
END $$;

-- ============ RMO SOLICITA AJUSTES ============
CREATE OR REPLACE FUNCTION public.rmo_solicitar_ajustes_fase(p_fase_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fase record; v_projeto record;
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
         rmo_validada_por = NULL, rmo_validada_em = NULL,
         co_validada_por = NULL, co_validada_em = NULL,
         validacao_observacao = p_motivo, updated_at = now()
   WHERE id = p_fase_id;

  PERFORM public.notificar_envolvidos_fase(
    v_projeto.id, v_fase.nome,
    'RMO solicitou ajustes na fase',
    'RMO solicitou ajustes na fase "' || v_fase.nome || '": ' || p_motivo,
    'aviso', auth.uid());

  RETURN jsonb_build_object('success', true);
END $$;

-- ============ RMO INVALIDA ============
CREATE OR REPLACE FUNCTION public.rmo_invalidar_fase(p_fase_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fase record; v_projeto record;
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
         rmo_validada_por = auth.uid(), rmo_validada_em = now(),
         updated_at = now()
   WHERE id = p_fase_id;

  PERFORM public.notificar_envolvidos_fase(
    v_projeto.id, v_fase.nome,
    'Fase invalidada pelo RMO',
    'RMO invalidou a fase "' || v_fase.nome || '": ' || p_motivo,
    'aviso', auth.uid());

  RETURN jsonb_build_object('success', true);
END $$;

-- ============ COORDENADOR SOLICITA AJUSTES ============
CREATE OR REPLACE FUNCTION public.coordenador_solicitar_ajustes_fase(p_fase_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fase record; v_projeto record;
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
         co_validada_por = NULL, co_validada_em = NULL,
         validacao_observacao = p_motivo, updated_at = now()
   WHERE id = p_fase_id;

  PERFORM public.notificar_envolvidos_fase(
    v_projeto.id, v_fase.nome,
    'Coordenador solicitou ajustes',
    'Coordenador solicitou ajustes na fase "' || v_fase.nome || '": ' || p_motivo,
    'aviso', auth.uid());

  RETURN jsonb_build_object('success', true);
END $$;

-- ============ COORDENADOR INVALIDA ============
CREATE OR REPLACE FUNCTION public.coordenador_invalidar_fase(p_fase_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fase record; v_projeto record;
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
         co_validada_por = auth.uid(), co_validada_em = now(),
         updated_at = now()
   WHERE id = p_fase_id;

  PERFORM public.notificar_envolvidos_fase(
    v_projeto.id, v_fase.nome,
    'Fase invalidada pelo Coordenador',
    'Coordenador invalidou a fase "' || v_fase.nome || '": ' || p_motivo,
    'aviso', auth.uid());

  RETURN jsonb_build_object('success', true);
END $$;
