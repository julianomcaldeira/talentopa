-- Onda 5 / CT-15: parceiro (dono do canal) pode EDITAR e REMOVER as próprias
-- indicações, enquanto a empresa ainda não processou (status = 'indicado').
--   Regra 1 (editar): alterar valor_proposto e observacao, só com status 'indicado'.
--   Regra 2 (remover): soft-delete via status = 'retirado' (preserva histórico);
--     'retirado' já sai do rol de candidatos do RMO.
--   Regra 3 (permissão): apenas canais.user_id = auth.uid() (ou admin).
--   Regra 4 (prazo): demanda aberta (publicado/em_selecao) e dentro de
--     prazo_propostas — coerente com CT-17.
-- Executar no SQL editor (Lovable) — BEGIN...COMMIT + pg_notify no fim.

BEGIN;

-- ------------------------------------------------------------------
-- 1) EDITAR indicação (valor proposto / observação)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.parceiro_editar_indicacao(
  p_indicacao_id uuid,
  p_valor_proposto numeric,
  p_observacao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ind record;
  v_resp record;
  v_projeto record;
BEGIN
  SELECT * INTO v_ind FROM public.parceiro_indicacoes WHERE id = p_indicacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Indicação não encontrada'; END IF;

  -- Regra 3: só o parceiro dono do canal (ou admin)
  IF NOT EXISTS (
        SELECT 1 FROM public.canais c
        WHERE c.id = v_ind.canal_id AND c.user_id = auth.uid()
      )
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para editar esta indicação';
  END IF;

  -- Regra 1: apenas enquanto a empresa ainda não processou
  IF v_ind.status <> 'indicado' THEN
    RAISE EXCEPTION 'Indicação já foi processada pela empresa e não pode mais ser alterada';
  END IF;

  SELECT * INTO v_resp FROM public.parceiro_respostas WHERE id = v_ind.resposta_id;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_resp.projeto_id;

  -- Regra 4: demanda aberta e dentro do prazo de recebimento
  IF v_projeto.status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Demanda não está mais aceitando alterações de indicação';
  END IF;
  IF v_projeto.prazo_propostas IS NOT NULL AND v_projeto.prazo_propostas < current_date THEN
    RAISE EXCEPTION 'Prazo de propostas encerrado para esta demanda';
  END IF;

  IF p_valor_proposto IS NOT NULL AND p_valor_proposto < 0 THEN
    RAISE EXCEPTION 'Valor proposto não pode ser negativo';
  END IF;

  UPDATE public.parceiro_indicacoes
     SET valor_proposto = p_valor_proposto,
         observacao = p_observacao
   WHERE id = p_indicacao_id;

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.parceiro_editar_indicacao(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parceiro_editar_indicacao(uuid, numeric, text) TO authenticated, service_role;

-- ------------------------------------------------------------------
-- 2) REMOVER (retirar) indicação — soft-delete preserva histórico
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.parceiro_remover_indicacao(p_indicacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ind record;
  v_resp record;
  v_projeto record;
BEGIN
  SELECT * INTO v_ind FROM public.parceiro_indicacoes WHERE id = p_indicacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Indicação não encontrada'; END IF;

  -- Regra 3: só o parceiro dono do canal (ou admin)
  IF NOT EXISTS (
        SELECT 1 FROM public.canais c
        WHERE c.id = v_ind.canal_id AND c.user_id = auth.uid()
      )
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para remover esta indicação';
  END IF;

  -- Regra 2: só enquanto a empresa ainda não processou
  IF v_ind.status <> 'indicado' THEN
    RAISE EXCEPTION 'Indicação já foi processada pela empresa e não pode mais ser removida';
  END IF;

  SELECT * INTO v_resp FROM public.parceiro_respostas WHERE id = v_ind.resposta_id;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_resp.projeto_id;

  -- Regra 4: demanda aberta e dentro do prazo de recebimento
  IF v_projeto.status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Demanda não está mais aceitando alterações de indicação';
  END IF;
  IF v_projeto.prazo_propostas IS NOT NULL AND v_projeto.prazo_propostas < current_date THEN
    RAISE EXCEPTION 'Prazo de propostas encerrado para esta demanda';
  END IF;

  UPDATE public.parceiro_indicacoes
     SET status = 'retirado'
   WHERE id = p_indicacao_id;

  RETURN jsonb_build_object('success', true, 'status', 'retirado');
END $$;

REVOKE ALL ON FUNCTION public.parceiro_remover_indicacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parceiro_remover_indicacao(uuid) TO authenticated, service_role;

COMMIT;

-- Reload do schema cache do PostgREST (expõe as RPCs novas)
SELECT pg_notify('pgrst', 'reload schema');