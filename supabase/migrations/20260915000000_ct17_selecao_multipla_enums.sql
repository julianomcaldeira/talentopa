-- CT-17 (Onda 3): seleção múltipla de consultores numa demanda
-- Arquivo 1/2 — enums e colunas (separado do arquivo das RPCs porque
-- valores de enum recém-criados não podem ser usados na MESMA transação).

-- 1) Novos estados de proposta: 'selecionada' (multi-select do RMO) e
--    'desconsiderada' (recusa individual, REVERSÍVEL dentro do prazo).
ALTER TYPE public.status_proposta ADD VALUE IF NOT EXISTS 'selecionada';
ALTER TYPE public.status_proposta ADD VALUE IF NOT EXISTS 'desconsiderada';

-- 2) Novo estado de projeto: 'encerrada' (demanda de seleção encerrada
--    manualmente pelo RMO; diferente de 'concluida' que é fim da execução).
ALTER TYPE public.status_projeto ADD VALUE IF NOT EXISTS 'encerrada';

-- 3) parceiro_indicacoes.status passa a aceitar 'desconsiderado'
DO $$
DECLARE v_cons text;
BEGIN
  SELECT conname INTO v_cons
    FROM pg_constraint
   WHERE conrelid = 'public.parceiro_indicacoes'::regclass
     AND contype = 'c';
  IF v_cons IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.parceiro_indicacoes DROP CONSTRAINT %I', v_cons);
  END IF;
END $$;

ALTER TABLE public.parceiro_indicacoes
  ADD CONSTRAINT parceiro_indicacoes_status_check
  CHECK (status IN ('indicado','selecionado','desconsiderado','recusado','retirado'));

-- 4) Guarda o status anterior ao desconsiderar (para reversão dentro do prazo)
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS status_anterior text;

-- Reload do schema cache do PostgREST (sem isso RPCs/colunas novas demoram)
SELECT pg_notify('pgrst', 'reload schema');