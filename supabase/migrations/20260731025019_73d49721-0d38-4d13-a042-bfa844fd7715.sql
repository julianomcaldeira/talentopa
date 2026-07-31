
CREATE OR REPLACE FUNCTION public.is_projeto_empresa_team(_projeto_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = _projeto_id
      AND public.is_empresa_team_member(_user_id, p.empresa_user_id)
  );
$$;

REVOKE ALL ON FUNCTION public.is_projeto_empresa_team(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_projeto_empresa_team(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Company team manage phases" ON public.projeto_fases;
CREATE POLICY "Company team manage phases" ON public.projeto_fases FOR ALL TO authenticated
USING (public.is_projeto_empresa_team(projeto_id, auth.uid()))
WITH CHECK (public.is_projeto_empresa_team(projeto_id, auth.uid()));

DROP POLICY IF EXISTS "Company team manage project modules" ON public.projeto_modulos;
CREATE POLICY "Company team manage project modules" ON public.projeto_modulos FOR ALL TO authenticated
USING (public.is_projeto_empresa_team(projeto_id, auth.uid()))
WITH CHECK (public.is_projeto_empresa_team(projeto_id, auth.uid()));

DROP POLICY IF EXISTS "Company team manage project features" ON public.projeto_funcionalidades;
CREATE POLICY "Company team manage project features" ON public.projeto_funcionalidades FOR ALL TO authenticated
USING (public.is_projeto_empresa_team(projeto_id, auth.uid()))
WITH CHECK (public.is_projeto_empresa_team(projeto_id, auth.uid()));

DROP POLICY IF EXISTS "Company team manage project questions" ON public.projeto_perguntas;
CREATE POLICY "Company team manage project questions" ON public.projeto_perguntas FOR ALL TO authenticated
USING (public.is_projeto_empresa_team(projeto_id, auth.uid()))
WITH CHECK (public.is_projeto_empresa_team(projeto_id, auth.uid()));
