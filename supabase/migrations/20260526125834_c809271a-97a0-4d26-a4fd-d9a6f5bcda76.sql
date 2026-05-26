
-- Canal owner sees profiles of own consultors
CREATE POLICY "Canal owners view linked consultor profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.canal_consultores cc
    JOIN public.canais c ON c.id = cc.canal_id
    WHERE cc.consultor_user_id = profiles.user_id
      AND c.user_id = auth.uid()
  )
);

-- Empresa team sees profiles of consultors with propostas/alocacoes on their projects
CREATE POLICY "Empresa team views collaborating consultor profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.propostas pr
    JOIN public.projetos p ON p.id = pr.projeto_id
    WHERE pr.consultor_user_id = profiles.user_id
      AND is_empresa_team_member(auth.uid(), p.empresa_user_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.alocacoes a
    JOIN public.projetos p ON p.id = a.projeto_id
    WHERE a.consultor_user_id = profiles.user_id
      AND is_empresa_team_member(auth.uid(), p.empresa_user_id)
  )
);

-- Consultors see profiles of empresa team members they collaborate with
CREATE POLICY "Consultors view collaborating empresa profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    JOIN public.projetos p ON p.empresa_user_id = eu.empresa_user_id
    JOIN public.propostas pr ON pr.projeto_id = p.id
    WHERE eu.user_id = profiles.user_id
      AND pr.consultor_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projetos p
    JOIN public.propostas pr ON pr.projeto_id = p.id
    WHERE p.empresa_user_id = profiles.user_id
      AND pr.consultor_user_id = auth.uid()
  )
);
