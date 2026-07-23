
-- Substitui a policy pública para respeitar o roteamento v2
DROP POLICY IF EXISTS "Published projects viewable by consultants" ON public.projetos;

CREATE POLICY "Published projects viewable by consultants"
ON public.projetos
FOR SELECT
TO authenticated
USING (
  empresa_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    status <> 'rascunho'::status_projeto
    AND (
      roteamento_v2 = false
      OR public.consultor_tem_vinculo_ativo(auth.uid()) IS NULL
      OR EXISTS (
        SELECT 1 FROM public.parceiro_indicacoes pi
        JOIN public.parceiro_respostas pr ON pr.id = pi.resposta_id
        WHERE pr.projeto_id = projetos.id AND pi.consultor_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.alocacoes a
        WHERE a.projeto_id = projetos.id AND a.consultor_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.propostas p
        WHERE p.projeto_id = projetos.id AND p.consultor_user_id = auth.uid()
      )
    )
  )
);

-- Trigger que bloqueia proposta direta de consultor vinculado em demanda v2
CREATE OR REPLACE FUNCTION public.block_proposta_consultor_vinculado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_v2 boolean;
  v_vinculo uuid;
BEGIN
  SELECT roteamento_v2 INTO v_v2 FROM public.projetos WHERE id = NEW.projeto_id;
  IF v_v2 IS TRUE THEN
    v_vinculo := public.consultor_tem_vinculo_ativo(NEW.consultor_user_id);
    IF v_vinculo IS NOT NULL THEN
      RAISE EXCEPTION 'Consultor vinculado a um parceiro nao pode enviar proposta direta. A resposta a esta demanda deve ser feita pelo parceiro do canal.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_proposta_consultor_vinculado ON public.propostas;
CREATE TRIGGER trg_block_proposta_consultor_vinculado
  BEFORE INSERT ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.block_proposta_consultor_vinculado();
