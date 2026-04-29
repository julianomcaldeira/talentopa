CREATE TABLE IF NOT EXISTS public.projeto_anexo_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL,
  anexo_id uuid,
  mensagem_id uuid,
  actor_user_id uuid NOT NULL,
  evento text NOT NULL,
  mime_type text,
  nome_arquivo text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_anexo_eventos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_projeto_anexo_eventos_projeto_created
ON public.projeto_anexo_eventos (projeto_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projeto_anexo_eventos_anexo_created
ON public.projeto_anexo_eventos (anexo_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projeto_anexo_eventos_mensagem_created
ON public.projeto_anexo_eventos (mensagem_id, created_at DESC);

DROP POLICY IF EXISTS "Project parties view attachment events" ON public.projeto_anexo_eventos;
CREATE POLICY "Project parties view attachment events"
ON public.projeto_anexo_eventos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_anexo_eventos.projeto_id
      AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
  )
  OR actor_user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.projeto_anexos pa
    WHERE pa.id = projeto_anexo_eventos.anexo_id
      AND (
        pa.uploader_user_id = auth.uid()
        OR pa.recipient_user_id = auth.uid()
        OR (
          pa.escopo = 'compartilhado'
          AND EXISTS (
            SELECT 1 FROM public.propostas pr
            WHERE pr.projeto_id = pa.projeto_id
              AND pr.consultor_user_id = auth.uid()
              AND pr.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "Users insert own attachment view events" ON public.projeto_anexo_eventos;
CREATE POLICY "Users insert own attachment view events"
ON public.projeto_anexo_eventos
FOR INSERT
TO authenticated
WITH CHECK (
  actor_user_id = auth.uid()
  AND evento = 'visualizado'
  AND EXISTS (
    SELECT 1 FROM public.projeto_anexos pa
    WHERE pa.id = projeto_anexo_eventos.anexo_id
      AND pa.projeto_id = projeto_anexo_eventos.projeto_id
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR pa.uploader_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.projetos p
          WHERE p.id = pa.projeto_id
            AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
        )
        OR (
          pa.escopo = 'compartilhado'
          AND (pa.recipient_user_id IS NULL OR pa.recipient_user_id = auth.uid())
          AND EXISTS (
            SELECT 1 FROM public.propostas pr
            WHERE pr.projeto_id = pa.projeto_id
              AND pr.consultor_user_id = auth.uid()
              AND pr.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
          )
        )
      )
  )
);

CREATE OR REPLACE FUNCTION public.registrar_anexo_chat_enviado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg uuid;
BEGIN
  IF NEW.origem = 'chat' THEN
    SELECT m.id INTO v_msg
    FROM public.mensagens m
    WHERE m.projeto_id = NEW.projeto_id
      AND m.sender_user_id = NEW.uploader_user_id
      AND m.tipo = 'anexo'
      AND (m.conteudo::jsonb ->> 'path') = NEW.arquivo_url
    ORDER BY m.created_at DESC
    LIMIT 1;

    INSERT INTO public.projeto_anexo_eventos (
      projeto_id,
      anexo_id,
      mensagem_id,
      actor_user_id,
      evento,
      mime_type,
      nome_arquivo,
      metadata
    ) VALUES (
      NEW.projeto_id,
      NEW.id,
      v_msg,
      NEW.uploader_user_id,
      'enviado',
      NEW.mime_type,
      NEW.nome,
      jsonb_build_object(
        'recipient_user_id', NEW.recipient_user_id,
        'escopo', NEW.escopo,
        'origem', NEW.origem,
        'tamanho_bytes', NEW.tamanho_bytes
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrar_anexo_chat_enviado_trg ON public.projeto_anexos;
CREATE TRIGGER registrar_anexo_chat_enviado_trg
AFTER INSERT ON public.projeto_anexos
FOR EACH ROW
EXECUTE FUNCTION public.registrar_anexo_chat_enviado();

CREATE OR REPLACE FUNCTION public.registrar_anexos_liberados_pre_aprovacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.projeto_anexo_eventos (
      projeto_id,
      anexo_id,
      mensagem_id,
      actor_user_id,
      evento,
      mime_type,
      nome_arquivo,
      metadata
    )
    SELECT
      pa.projeto_id,
      pa.id,
      m.id,
      auth.uid(),
      'aprovado_pre_aprovacao',
      pa.mime_type,
      pa.nome,
      jsonb_build_object(
        'proposta_id', NEW.id,
        'consultor_user_id', NEW.consultor_user_id,
        'status_proposta', NEW.status,
        'recipient_user_id', pa.recipient_user_id
      )
    FROM public.projeto_anexos pa
    LEFT JOIN public.mensagens m
      ON m.projeto_id = pa.projeto_id
      AND m.tipo = 'anexo'
      AND (m.conteudo::jsonb ->> 'path') = pa.arquivo_url
    WHERE pa.projeto_id = NEW.projeto_id
      AND pa.origem = 'chat'
      AND pa.escopo = 'compartilhado'
      AND (pa.recipient_user_id IS NULL OR pa.recipient_user_id = NEW.consultor_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.projeto_anexo_eventos e
        WHERE e.anexo_id = pa.id
          AND e.evento = 'aprovado_pre_aprovacao'
          AND e.metadata ->> 'proposta_id' = NEW.id::text
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrar_anexos_liberados_pre_aprovacao_trg ON public.propostas;
CREATE TRIGGER registrar_anexos_liberados_pre_aprovacao_trg
AFTER UPDATE OF status ON public.propostas
FOR EACH ROW
EXECUTE FUNCTION public.registrar_anexos_liberados_pre_aprovacao();