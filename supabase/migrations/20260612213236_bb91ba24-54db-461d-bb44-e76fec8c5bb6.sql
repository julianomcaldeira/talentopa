CREATE POLICY "Channels can view projects of linked consultants"
ON public.projetos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.canais c
    WHERE c.user_id = auth.uid()
      AND (
        EXISTS (
          SELECT 1 FROM public.alocacoes a
          WHERE a.projeto_id = projetos.id AND a.canal_id = c.id
        )
        OR EXISTS (
          SELECT 1 FROM public.propostas p
          JOIN public.canal_consultores cc
            ON cc.consultor_user_id = p.consultor_user_id
           AND cc.canal_id = c.id
           AND cc.status = 'ativo'
          WHERE p.projeto_id = projetos.id
            AND p.status IN ('aceita','pre_aprovada')
        )
      )
  )
);