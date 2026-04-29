ALTER TABLE public.projeto_anexos
ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'projeto',
ADD COLUMN IF NOT EXISTS escopo text NOT NULL DEFAULT 'compartilhado',
ADD COLUMN IF NOT EXISTS recipient_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_projeto_anexos_origem_projeto
ON public.projeto_anexos (origem, projeto_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_and_validate_project_attachment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
BEGIN
  IF NEW.origem = 'chat' THEN
    IF NEW.escopo = 'compartilhado'
       AND NOT public.can_user_message_project(NEW.projeto_id, NEW.uploader_user_id, 'compartilhado') THEN
      v_reason := 'Anexos no chat só são permitidos após a pré-aprovação do consultor.';

      PERFORM public.log_audit_event(
        'comunicacao',
        'anexo_chat_bloqueado_pre_aprovacao',
        'projeto_anexos',
        NEW.projeto_id,
        v_reason,
        NULL,
        jsonb_build_object(
          'projeto_id', NEW.projeto_id,
          'uploader_user_id', NEW.uploader_user_id,
          'recipient_user_id', NEW.recipient_user_id,
          'nome', NEW.nome,
          'mime_type', NEW.mime_type,
          'tamanho_bytes', NEW.tamanho_bytes,
          'escopo', NEW.escopo,
          'origem', NEW.origem
        ),
        'warning'
      );

      RAISE EXCEPTION '%', v_reason;
    END IF;

    PERFORM public.log_audit_event(
      'comunicacao',
      'anexo_chat_enviado',
      'projeto_anexos',
      NEW.projeto_id,
      'Anexo enviado no chat',
      NULL,
      jsonb_build_object(
        'projeto_id', NEW.projeto_id,
        'anexo_id', NEW.id,
        'uploader_user_id', NEW.uploader_user_id,
        'recipient_user_id', NEW.recipient_user_id,
        'nome', NEW.nome,
        'mime_type', NEW.mime_type,
        'tamanho_bytes', NEW.tamanho_bytes,
        'escopo', NEW.escopo,
        'origem', NEW.origem
      ),
      'info'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_and_validate_project_attachment_trg ON public.projeto_anexos;
CREATE TRIGGER audit_and_validate_project_attachment_trg
BEFORE INSERT ON public.projeto_anexos
FOR EACH ROW
EXECUTE FUNCTION public.audit_and_validate_project_attachment();

DROP POLICY IF EXISTS "Empresa pode inserir anexos" ON public.projeto_anexos;
CREATE POLICY "Project parties insert attachments with chat rules"
ON public.projeto_anexos
FOR INSERT
WITH CHECK (
  uploader_user_id = auth.uid()
  AND (
    (
      origem <> 'chat'
      AND EXISTS (
        SELECT 1 FROM public.projetos p
        WHERE p.id = projeto_anexos.projeto_id
          AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
      )
    )
    OR (
      origem = 'chat'
      AND (
        (
          escopo = 'interno_empresa'
          AND EXISTS (
            SELECT 1 FROM public.projetos p
            WHERE p.id = projeto_anexos.projeto_id
              AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
          )
        )
        OR (
          escopo = 'compartilhado'
          AND public.can_user_message_project(projeto_id, auth.uid(), 'compartilhado')
        )
      )
    )
  )
);

DROP POLICY IF EXISTS "Partes do projeto leem anexos" ON storage.objects;
CREATE POLICY "Partes do projeto leem anexos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'projeto-anexos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.projeto_anexos pa
      JOIN public.projetos p ON p.id = pa.projeto_id
      WHERE pa.arquivo_url = name
        AND (
          public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
          OR (
            pa.escopo = 'compartilhado'
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

DROP POLICY IF EXISTS "Empresa upload anexos projeto" ON storage.objects;
CREATE POLICY "Partes autorizadas enviam anexos do projeto"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'projeto-anexos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);