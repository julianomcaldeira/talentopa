-- CT-17 (Onda 3): seleção múltipla de consultores numa demanda
-- Arquivo 2/2 — RPCs e triggers. Depende do arquivo ...000 (enums).
-- Onda 0 (is_empresa_team_member) NÃO é pré-requisito: a versão antiga da
-- função já cobre a checagem (menos restritiva), então tudo roda antes da
-- Onda 0 ser aplicada.

-- ============================================================
-- 1) SELECIONAR PROPOSTA DIRETA (multi-select)
--    Marca 'selecionada' e NÃO recusa as demais. RMO pode selecionar vários.
-- ============================================================
CREATE OR REPLACE FUNCTION public.empresa_selecionar_proposta(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proposta record;
  v_projeto record;
BEGIN
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;

  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_proposta.projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para selecionar propostas deste projeto';
  END IF;

  IF v_proposta.status NOT IN ('enviada','pre_aprovada','contraproposta_consultor') THEN
    RAISE EXCEPTION 'Proposta já foi processada';
  END IF;
  IF v_projeto.status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Demanda não está mais aceitando seleção';
  END IF;

  UPDATE public.propostas
     SET status = 'selecionada'::public.status_proposta, updated_at = now()
   WHERE id = p_proposta_id;

  UPDATE public.projetos
     SET status = 'em_selecao'::public.status_projeto, updated_at = now()
   WHERE id = v_projeto.id
     AND status IN ('publicado'::public.status_projeto, 'em_selecao'::public.status_projeto);

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    v_proposta.consultor_user_id, 'sucesso', 'Você foi selecionado',
    'Você foi selecionado para a demanda "' || v_projeto.nome || '".',
    v_projeto.id, 'projeto'
  );

  RETURN jsonb_build_object('success', true, 'status', 'selecionada', 'consultor_user_id', v_proposta.consultor_user_id);
END $$;

REVOKE ALL ON FUNCTION public.empresa_selecionar_proposta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_selecionar_proposta(uuid) TO authenticated, service_role;

-- ============================================================
-- 2) SELECIONAR INDICAÇÃO DE PARCEIRO (rewrite)
--    Mantém seleção + alocação, mas REMOVE a recusa automática das demais
--    indicações e propostas do projeto.
-- ============================================================
CREATE OR REPLACE FUNCTION public.empresa_selecionar_indicacao(p_indicacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ind record;
  v_resp record;
  v_projeto record;
  v_canal record;
  v_consultor_nome text;
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
  IF v_projeto.status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Demanda não está mais aceitando seleção';
  END IF;

  SELECT * INTO v_canal FROM public.canais WHERE id = v_ind.canal_id;
  SELECT COALESCE(nome, 'consultor') INTO v_consultor_nome
    FROM public.profiles WHERE user_id = v_ind.consultor_user_id;

  UPDATE public.parceiro_indicacoes SET status = 'selecionado' WHERE id = p_indicacao_id;

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

  UPDATE public.projetos
     SET status = 'em_selecao'::public.status_projeto, updated_at = now()
   WHERE id = v_projeto.id
     AND status IN ('publicado'::public.status_projeto, 'em_selecao'::public.status_projeto);

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    v_ind.consultor_user_id, 'sucesso', 'Você foi selecionado',
    'Você foi selecionado para a demanda "' || v_projeto.nome || '" via parceiro ' ||
      COALESCE(v_canal.nome, 'parceiro') || '.',
    v_projeto.id, 'projeto'
  );

  IF v_canal.user_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      v_canal.user_id, 'sucesso', 'Indicação aceita pela empresa',
      'Seu consultor ' || v_consultor_nome || ' foi selecionado na demanda "' || v_projeto.nome || '".',
      v_projeto.id, 'projeto'
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'selecionado', 'consultor_user_id', v_ind.consultor_user_id, 'canal_id', v_ind.canal_id);
END $$;

REVOKE ALL ON FUNCTION public.empresa_selecionar_indicacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_selecionar_indicacao(uuid) TO authenticated, service_role;

-- ============================================================
-- 3) ACEITAR PROPOSTA (formalização pós-seleção)
--    Rewrite: mantém transição para 'aguardando_consultor' (confirmação do
--    consultor → 'aceita'), mas REMOVE a recusa automática das demais.
--    Passa a aceitar também propostas já 'selecionada'.
-- ============================================================
CREATE OR REPLACE FUNCTION public.empresa_aceitar_proposta(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  IF v_proposta.status NOT IN ('selecionada'::public.status_proposta,
                                'enviada'::public.status_proposta,
                                'pre_aprovada'::public.status_proposta,
                                'contraproposta_consultor'::public.status_proposta) THEN
    RAISE EXCEPTION 'Proposta já foi processada';
  END IF;

  UPDATE public.propostas
     SET status = 'aguardando_consultor'::public.status_proposta, updated_at = now()
   WHERE id = p_proposta_id;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    v_proposta.consultor_user_id, 'sucesso', 'Aprovação final solicitada',
    'A empresa formalizou sua proposta para "' || v_projeto.nome || '". Confirme o início para começar.',
    v_projeto.id, 'projeto'
  );

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.empresa_aceitar_proposta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_aceitar_proposta(uuid) TO authenticated, service_role;

-- ============================================================
-- 4) RMO APROVAÇÃO FINAL (shortlist do canal)
--    Rewrite: marca shortlist + proposta como selecionada e REMOVE a recusa
--    automática das demais propostas abertas.
-- ============================================================
CREATE OR REPLACE FUNCTION public.rmo_aprovacao_final(p_shortlist_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item record; v_projeto record;
BEGIN
  SELECT * INTO v_item FROM public.projeto_shortlist WHERE id = p_shortlist_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shortlist não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_item.projeto_id;
  IF v_projeto.canal_id IS NULL OR NOT public.is_canal_operador(v_projeto.canal_id, auth.uid()) THEN
    IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Apenas o RMO/Canal deste projeto pode aprovar';
    END IF;
  END IF;
  IF v_projeto.status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Demanda não está mais aceitando seleção';
  END IF;

  UPDATE public.projeto_shortlist SET status='selecionada_rmo'::public.status_shortlist_item, updated_at=now()
   WHERE id = p_shortlist_id;

  -- Marca a proposta da shortlist como selecionada (demais permanecem pendentes)
  UPDATE public.propostas
     SET status='selecionada'::public.status_proposta, updated_at=now()
   WHERE id = v_item.proposta_id
     AND status IN ('enviada'::public.status_proposta,'pre_aprovada'::public.status_proposta,'contraproposta_consultor'::public.status_proposta);

  UPDATE public.projetos SET status='em_selecao'::public.status_projeto, updated_at=now()
   WHERE id = v_projeto.id;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  SELECT pr.consultor_user_id, 'sucesso', 'Você foi selecionado!',
    'O RMO aprovou sua proposta para "' || v_projeto.nome || '".',
    v_projeto.id, 'projeto'
  FROM public.propostas pr WHERE pr.id = v_item.proposta_id;

  RETURN jsonb_build_object('success', true, 'status', 'selecionada');
END $$;

REVOKE ALL ON FUNCTION public.rmo_aprovacao_final(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rmo_aprovacao_final(uuid) TO authenticated, service_role;

-- ============================================================
-- 5) ENCERRAR DEMANDA (manual)
--    Só aqui os NÃO selecionados viram 'recusada'/'recusado'. Selecionados
--    permanecem. Demanda sai da listagem em aberto (status 'encerrada').
-- ============================================================
CREATE OR REPLACE FUNCTION public.empresa_encerrar_demanda(p_projeto_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_projeto record;
  v_consultaor public.propostas;
BEGIN
  SELECT * INTO v_projeto FROM public.projetos WHERE id = p_projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para encerrar esta demanda';
  END IF;

  IF v_projeto.status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Demanda não está em seleção';
  END IF;

  -- Propostas abertas não selecionadas (inclui desconsideradas) viram recusada
  FOR v_consultaor IN
    SELECT * FROM public.propostas
     WHERE projeto_id = v_projeto.id
       AND status IN ('enviada'::public.status_proposta,
                      'pre_aprovada'::public.status_proposta,
                      'contraproposta_consultor'::public.status_proposta,
                      'desconsiderada'::public.status_proposta)
  LOOP
    UPDATE public.propostas
       SET status = 'recusada'::public.status_proposta, updated_at = now()
     WHERE id = v_consultaor.id;

    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      v_consultaor.consultor_user_id, 'aviso', 'Demanda encerrada sem sua seleção',
      'A demanda "' || v_projeto.nome || '" foi encerrada e sua proposta não foi selecionada.',
      v_projeto.id, 'projeto'
    );
  END LOOP;

  -- Indicações abertas não selecionadas viram recusado
  UPDATE public.parceiro_indicacoes pi
     SET status = 'recusado'
   WHERE pi.status IN ('indicado','desconsiderado')
     AND pi.resposta_id IN (
       SELECT pr.id FROM public.parceiro_respostas pr
        WHERE pr.projeto_id = v_projeto.id
     );

  UPDATE public.projetos
     SET status = 'encerrada'::public.status_projeto, updated_at = now()
   WHERE id = v_projeto.id;

  RETURN jsonb_build_object('success', true, 'status', 'encerrada');
END $$;

REVOKE ALL ON FUNCTION public.empresa_encerrar_demanda(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_encerrar_demanda(uuid) TO authenticated, service_role;

-- ============================================================
-- 6) DESCONSIDERAR / RECONSIDERAR PROPOSTA (individual, reversível no prazo)
-- ============================================================
CREATE OR REPLACE FUNCTION public.empresa_desconsiderar_proposta(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_proposta record; v_projeto record; v_novo_status text;
BEGIN
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_proposta.projeto_id;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para avaliar propostas deste projeto';
  END IF;

  IF v_proposta.status NOT IN ('enviada','pre_aprovada','contraproposta_consultor') THEN
    RAISE EXCEPTION 'Proposta não está em avaliação: %', v_proposta.status;
  END IF;

  v_novo_status := v_proposta.status::text;
  UPDATE public.propostas
     SET status = 'desconsiderada'::public.status_proposta,
         status_anterior = v_novo_status,
         updated_at = now()
   WHERE id = p_proposta_id;

  RETURN jsonb_build_object('success', true, 'status', 'desconsiderada');
END $$;

CREATE OR REPLACE FUNCTION public.empresa_reconsiderar_proposta(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_proposta record; v_projeto record;
BEGIN
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_proposta.projeto_id;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para avaliar propostas deste projeto';
  END IF;

  IF v_proposta.status <> 'desconsiderada' THEN
    RAISE EXCEPTION 'Proposta não está desconsiderada';
  END IF;
  IF v_projeto.status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Demanda já encerrada — seleção não é mais reversível';
  END IF;
  IF v_projeto.prazo_propostas IS NOT NULL AND v_projeto.prazo_propostas < current_date THEN
    RAISE EXCEPTION 'Prazo de propostas encerrado — não é mais possível reconsiderar';
  END IF;

  UPDATE public.propostas
     SET status = COALESCE(v_proposta.status_anterior, 'enviada')::public.status_proposta,
         status_anterior = NULL,
         updated_at = now()
   WHERE id = p_proposta_id;

  RETURN jsonb_build_object('success', true, 'status', COALESCE(v_proposta.status_anterior, 'enviada'));
END $$;

REVOKE ALL ON FUNCTION public.empresa_desconsiderar_proposta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_desconsiderar_proposta(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.empresa_reconsiderar_proposta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_reconsiderar_proposta(uuid) TO authenticated, service_role;

-- ============================================================
-- 7) DESCONSIDERAR / RECONSIDERAR INDICAÇÃO (individual, reversível no prazo)
-- ============================================================
CREATE OR REPLACE FUNCTION public.empresa_desconsiderar_indicacao(p_indicacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_ind record; v_resp record; v_projeto record;
BEGIN
  SELECT * INTO v_ind FROM public.parceiro_indicacoes WHERE id = p_indicacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Indicação não encontrada'; END IF;
  SELECT * INTO v_resp FROM public.parceiro_respostas WHERE id = v_ind.resposta_id;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_resp.projeto_id;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para avaliar indicações deste projeto';
  END IF;

  IF v_ind.status <> 'indicado' THEN
    RAISE EXCEPTION 'Indicação não está em avaliação';
  END IF;

  UPDATE public.parceiro_indicacoes SET status = 'desconsiderado' WHERE id = p_indicacao_id;
  RETURN jsonb_build_object('success', true, 'status', 'desconsiderado');
END $$;

CREATE OR REPLACE FUNCTION public.empresa_reconsiderar_indicacao(p_indicacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_ind record; v_resp record; v_projeto record;
BEGIN
  SELECT * INTO v_ind FROM public.parceiro_indicacoes WHERE id = p_indicacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Indicação não encontrada'; END IF;
  SELECT * INTO v_resp FROM public.parceiro_respostas WHERE id = v_ind.resposta_id;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_resp.projeto_id;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para avaliar indicações deste projeto';
  END IF;

  IF v_ind.status <> 'desconsiderado' THEN
    RAISE EXCEPTION 'Indicação não está desconsiderada';
  END IF;
  IF v_projeto.status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Demanda já encerrada — seleção não é mais reversível';
  END IF;
  IF v_projeto.prazo_propostas IS NOT NULL AND v_projeto.prazo_propostas < current_date THEN
    RAISE EXCEPTION 'Prazo de propostas encerrado — não é mais possível reconsiderar';
  END IF;

  UPDATE public.parceiro_indicacoes SET status = 'indicado' WHERE id = p_indicacao_id;
  RETURN jsonb_build_object('success', true, 'status', 'indicado');
END $$;

REVOKE ALL ON FUNCTION public.empresa_desconsiderar_indicacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_desconsiderar_indicacao(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.empresa_reconsiderar_indicacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_reconsiderar_indicacao(uuid) TO authenticated, service_role;

-- ============================================================
-- 8) TRIGGERS: data de validade = apenas prazo de RECEBIMENTO de propostas
--    Bloqueia candidatura NOVA (avulso e parceiro) fora do prazo ou com a
--    demanda fora de seleção. A demanda segue aberta para seleção.
-- ============================================================
CREATE OR REPLACE FUNCTION public.bloquear_candidatura_fora_prazo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_status public.status_projeto; v_prazo date;
BEGIN
  SELECT status, prazo_propostas INTO v_status, v_prazo FROM public.projetos WHERE id = NEW.projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF v_status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Esta demanda não está aceitando novas candidaturas';
  END IF;
  IF v_prazo IS NOT NULL AND v_prazo < current_date THEN
    RAISE EXCEPTION 'Prazo de propostas encerrado para esta demanda';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.bloquear_indicacao_fora_prazo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_projeto_id uuid; v_status public.status_projeto; v_prazo date;
BEGIN
  SELECT pr.projeto_id INTO v_projeto_id FROM public.parceiro_respostas pr WHERE pr.id = NEW.resposta_id;
  IF v_projeto_id IS NULL THEN RAISE EXCEPTION 'Resposta de parceiro não encontrada'; END IF;
  SELECT status, prazo_propostas INTO v_status, v_prazo FROM public.projetos WHERE id = v_projeto_id;
  IF v_status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Esta demanda não está aceitando novas candidaturas';
  END IF;
  IF v_prazo IS NOT NULL AND v_prazo < current_date THEN
    RAISE EXCEPTION 'Prazo de propostas encerrado para esta demanda';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bloquear_candidatura_fora_prazo ON public.propostas;
CREATE TRIGGER trg_bloquear_candidatura_fora_prazo
  BEFORE INSERT ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_candidatura_fora_prazo();

DROP TRIGGER IF EXISTS trg_bloquear_indicacao_fora_prazo ON public.parceiro_indicacoes;
CREATE TRIGGER trg_bloquear_indicacao_fora_prazo
  BEFORE INSERT ON public.parceiro_indicacoes
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_indicacao_fora_prazo();

-- Reload do schema cache do PostgREST (expõe as RPCs novas)
SELECT pg_notify('pgrst', 'reload schema');