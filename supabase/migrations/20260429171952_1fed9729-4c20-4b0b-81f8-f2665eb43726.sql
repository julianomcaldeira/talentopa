DROP POLICY IF EXISTS "Project parties view attachments with chat rules" ON public.projeto_anexos;

CREATE POLICY "Project parties view attachments with chat rules"
ON public.projeto_anexos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR uploader_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_anexos.projeto_id
      AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
  )
  OR (
    projeto_anexos.escopo = 'compartilhado'
    AND (
      projeto_anexos.recipient_user_id IS NULL
      OR projeto_anexos.recipient_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.propostas pr
      WHERE pr.projeto_id = projeto_anexos.projeto_id
        AND pr.consultor_user_id = auth.uid()
        AND pr.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
    )
  )
);

DROP POLICY IF EXISTS "Partes do projeto leem anexos" ON storage.objects;
CREATE POLICY "Partes do projeto leem anexos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'projeto-anexos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.projeto_anexos pa
      JOIN public.projetos p ON p.id = pa.projeto_id
      WHERE pa.arquivo_url = name
        AND (
          public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
          OR (
            pa.escopo = 'compartilhado'
            AND (
              pa.recipient_user_id IS NULL
              OR pa.recipient_user_id = auth.uid()
            )
            AND EXISTS (
              SELECT 1 FROM public.propostas pr
              WHERE pr.projeto_id = p.id
                AND pr.consultor_user_id = auth.uid()
                AND pr.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
            )
          )
        )
    )
  )
);