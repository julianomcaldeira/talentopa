-- 1) Remover tabela canal_membros e funções que dependiam dela
DROP FUNCTION IF EXISTS public.canal_convidar_rmo(text) CASCADE;
DROP FUNCTION IF EXISTS public.is_canal_operador(uuid, uuid) CASCADE;
DROP TABLE IF EXISTS public.canal_membros CASCADE;

-- 2) Helper: verifica se _user_id é RMO da empresa _empresa_user_id
CREATE OR REPLACE FUNCTION public.is_empresa_rmo(_empresa_user_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_usuarios
     WHERE empresa_user_id = _empresa_user_id
       AND user_id = _user_id
       AND papel = 'rmo'::public.papel_empresa_usuario
  );
$$;

-- 3) Reescrever RPCs do RMO trocando is_canal_operador(canal_id,uid) por is_empresa_rmo(empresa_user_id,uid)

CREATE OR REPLACE FUNCTION public.rmo_montar_shortlist(p_projeto_id uuid, p_proposta_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_projeto record; v_pid uuid;
BEGIN
  SELECT * INTO v_projeto FROM public.projetos WHERE id = p_projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF NOT public.is_empresa_rmo(v_projeto.empresa_user_id, auth.uid())
     AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas o RMO da empresa pode montar shortlist';
  END IF;

  FOREACH v_pid IN ARRAY p_proposta_ids LOOP
    INSERT INTO public.projeto_shortlist (projeto_id, proposta_id, adicionada_por)
    VALUES (p_projeto_id, v_pid, auth.uid())
    ON CONFLICT (projeto_id, proposta_id) DO NOTHING;
    UPDATE public.propostas SET status='pre_aprovada'::public.status_proposta, updated_at=now()
     WHERE id = v_pid AND status = 'enviada'::public.status_proposta;
  END LOOP;

  IF v_projeto.coordenador_user_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_projeto.coordenador_user_id, 'info', 'Shortlist recebida',
      'Uma nova shortlist foi enviada para o projeto "' || v_projeto.nome || '" para sua avaliação técnica.',
      p_projeto_id, 'projeto');
  END IF;

  RETURN jsonb_build_object('success', true, 'count', array_length(p_proposta_ids,1));
END $function$;

CREATE OR REPLACE FUNCTION public.rmo_aprovacao_final(p_shortlist_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_item record; v_projeto record;
BEGIN
  SELECT * INTO v_item FROM public.projeto_shortlist WHERE id = p_shortlist_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shortlist não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_item.projeto_id;
  IF NOT public.is_empresa_rmo(v_projeto.empresa_user_id, auth.uid())
     AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas o RMO da empresa pode aprovar';
  END IF;

  UPDATE public.projeto_shortlist SET status='selecionada_rmo'::public.status_shortlist_item, updated_at=now()
   WHERE id = p_shortlist_id;

  UPDATE public.propostas
     SET status='aguardando_consultor'::public.status_proposta, updated_at=now()
   WHERE id = v_item.proposta_id;

  UPDATE public.projetos SET status='em_selecao'::public.status_projeto, updated_at=now()
   WHERE id = v_projeto.id;

  UPDATE public.propostas
     SET status='recusada'::public.status_proposta, updated_at=now()
   WHERE projeto_id = v_projeto.id
     AND id <> v_item.proposta_id
     AND status IN ('enviada'::public.status_proposta,'pre_aprovada'::public.status_proposta,'contraproposta_consultor'::public.status_proposta);

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  SELECT pr.consultor_user_id, 'sucesso', 'Você foi selecionado!',
    'O RMO aprovou sua proposta para "' || v_projeto.nome || '". Confirme o início do projeto.',
    v_projeto.id, 'projeto'
  FROM public.propostas pr WHERE pr.id = v_item.proposta_id;

  RETURN jsonb_build_object('success', true);
END $function$;

CREATE OR REPLACE FUNCTION public.rmo_validar_fase(p_fase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_fase record; v_projeto record;
BEGIN
  SELECT * INTO v_fase FROM public.projeto_fases WHERE id = p_fase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_fase.projeto_id;
  IF NOT public.is_empresa_rmo(v_projeto.empresa_user_id, auth.uid())
     AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas o RMO da empresa pode validar a fase';
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
END $function$;

CREATE OR REPLACE FUNCTION public.rmo_solicitar_ajustes_fase(p_fase_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_fase record; v_projeto record;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Informe o motivo para solicitar ajustes';
  END IF;
  SELECT * INTO v_fase FROM public.projeto_fases WHERE id = p_fase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_fase.projeto_id;
  IF NOT public.is_empresa_rmo(v_projeto.empresa_user_id, auth.uid())
     AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas o RMO da empresa pode solicitar ajustes';
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
END $function$;

CREATE OR REPLACE FUNCTION public.rmo_invalidar_fase(p_fase_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_fase record; v_projeto record;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da invalidação';
  END IF;
  SELECT * INTO v_fase FROM public.projeto_fases WHERE id = p_fase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_fase.projeto_id;
  IF NOT public.is_empresa_rmo(v_projeto.empresa_user_id, auth.uid())
     AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas o RMO da empresa pode invalidar a fase';
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
END $function$;

-- 4) Reescreve notificação de envolvidos para incluir RMOs da empresa dona
CREATE OR REPLACE FUNCTION public.notificar_envolvidos_fase(
  p_projeto_id uuid, p_fase_nome text, p_titulo text, p_mensagem text,
  p_tipo text DEFAULT 'info'::text, p_excluir uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF v_consultor IS NOT NULL AND v_consultor IS DISTINCT FROM p_excluir THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_consultor, p_tipo, p_titulo, p_mensagem, p_projeto_id, 'projeto');
  END IF;

  IF v_projeto.empresa_user_id IS NOT NULL AND v_projeto.empresa_user_id IS DISTINCT FROM p_excluir THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_projeto.empresa_user_id, p_tipo, p_titulo, p_mensagem, p_projeto_id, 'projeto');
  END IF;

  IF v_projeto.coordenador_user_id IS NOT NULL
     AND v_projeto.coordenador_user_id IS DISTINCT FROM p_excluir THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_projeto.coordenador_user_id, p_tipo, p_titulo, p_mensagem, p_projeto_id, 'projeto');
  END IF;

  -- RMOs da empresa dona do projeto
  IF v_projeto.empresa_user_id IS NOT NULL THEN
    FOR r IN
      SELECT user_id FROM public.empresa_usuarios
       WHERE empresa_user_id = v_projeto.empresa_user_id
         AND papel = 'rmo'::public.papel_empresa_usuario
    LOOP
      IF r.user_id IS DISTINCT FROM p_excluir THEN
        INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
        VALUES (r.user_id, p_tipo, p_titulo, p_mensagem, p_projeto_id, 'projeto');
      END IF;
    END LOOP;
  END IF;
END $function$;