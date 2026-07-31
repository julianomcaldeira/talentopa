
-- Helper functions (SECURITY DEFINER) to avoid recursive RLS between projetos <-> propostas/alocacoes/parceiro_*
CREATE OR REPLACE FUNCTION public.consultor_tem_relacao_projeto(_projeto_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.propostas p WHERE p.projeto_id = _projeto_id AND p.consultor_user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.alocacoes a WHERE a.projeto_id = _projeto_id AND a.consultor_user_id = _user_id)
      OR EXISTS (
           SELECT 1 FROM public.parceiro_indicacoes pi
           JOIN public.parceiro_respostas pr ON pr.id = pi.resposta_id
           WHERE pr.projeto_id = _projeto_id AND pi.consultor_user_id = _user_id
         );
$$;

REVOKE ALL ON FUNCTION public.consultor_tem_relacao_projeto(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consultor_tem_relacao_projeto(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Published projects viewable by consultants" ON public.projetos;
CREATE POLICY "Published projects viewable by consultants"
ON public.projetos
FOR SELECT
USING (
  empresa_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    status <> 'rascunho'::status_projeto
    AND (
      roteamento_v2 = false
      OR public.consultor_tem_vinculo_ativo(auth.uid()) IS NULL
      OR public.consultor_tem_relacao_projeto(id, auth.uid())
    )
  )
);

-- Company team (RMO, coordinators, etc.) can see/create/update their company's projects
DROP POLICY IF EXISTS "Company team can view company projects" ON public.projetos;
CREATE POLICY "Company team can view company projects"
ON public.projetos
FOR SELECT
TO authenticated
USING (public.is_empresa_team_member(auth.uid(), empresa_user_id));

DROP POLICY IF EXISTS "Company team can create company projects" ON public.projetos;
CREATE POLICY "Company team can create company projects"
ON public.projetos
FOR INSERT
TO authenticated
WITH CHECK (public.is_empresa_team_member(auth.uid(), empresa_user_id));

DROP POLICY IF EXISTS "Company team can update company projects" ON public.projetos;
CREATE POLICY "Company team can update company projects"
ON public.projetos
FOR UPDATE
TO authenticated
USING (public.is_empresa_team_member(auth.uid(), empresa_user_id))
WITH CHECK (public.is_empresa_team_member(auth.uid(), empresa_user_id));
