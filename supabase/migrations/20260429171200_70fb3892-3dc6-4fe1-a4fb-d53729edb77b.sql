DROP POLICY IF EXISTS "Anexos viewable by project parties" ON public.projeto_anexos;

CREATE POLICY "Project parties view attachments with chat rules"
ON public.projeto_anexos
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_anexos.projeto_id
      AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
  )
  OR (
    projeto_anexos.escopo = 'compartilhado'
    AND EXISTS (
      SELECT 1 FROM public.propostas pr
      WHERE pr.projeto_id = projeto_anexos.projeto_id
        AND pr.consultor_user_id = auth.uid()
        AND pr.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
    )
  )
);