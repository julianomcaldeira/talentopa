
CREATE OR REPLACE FUNCTION public.canal_can_view_projeto(_projeto_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.canais c
    WHERE c.user_id = _user_id
      AND (
        EXISTS (SELECT 1 FROM public.alocacoes a WHERE a.projeto_id = _projeto_id AND a.canal_id = c.id)
        OR EXISTS (
          SELECT 1 FROM public.propostas p
          JOIN public.canal_consultores cc
            ON cc.consultor_user_id = p.consultor_user_id
           AND cc.canal_id = c.id
           AND cc.status = 'ativo'
          WHERE p.projeto_id = _projeto_id
            AND p.status IN ('aceita','pre_aprovada')
        )
      )
  );
$$;

DROP POLICY IF EXISTS "Channels can view projects of linked consultants" ON public.projetos;

CREATE POLICY "Channels can view projects of linked consultants"
ON public.projetos
FOR SELECT
USING (public.canal_can_view_projeto(id, auth.uid()));
