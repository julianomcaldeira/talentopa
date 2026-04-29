CREATE OR REPLACE FUNCTION public.can_user_send_project_message(p_projeto_id uuid, p_sender_user_id uuid DEFAULT auth.uid(), p_recipient_user_id uuid DEFAULT NULL, p_escopo text DEFAULT 'compartilhado')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_sender_user_id IS NULL THEN false
    WHEN public.has_role(p_sender_user_id, 'admin'::public.app_role) THEN true
    WHEN p_escopo = 'interno_empresa' THEN EXISTS (
      SELECT 1
      FROM public.projetos p
      WHERE p.id = p_projeto_id
        AND public.is_empresa_team_member(p_sender_user_id, p.empresa_user_id)
    )
    WHEN p_escopo = 'compartilhado' AND p_recipient_user_id IS NULL THEN public.can_user_message_project(p_projeto_id, p_sender_user_id, p_escopo)
    WHEN p_escopo = 'compartilhado' AND p_recipient_user_id IS NOT NULL THEN EXISTS (
      SELECT 1
      FROM public.projetos p
      WHERE p.id = p_projeto_id
        AND (
          (
            public.is_empresa_team_member(p_sender_user_id, p.empresa_user_id)
            AND EXISTS (
              SELECT 1 FROM public.propostas pr
              WHERE pr.projeto_id = p_projeto_id
                AND pr.consultor_user_id = p_recipient_user_id
                AND pr.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
            )
          )
          OR (
            public.is_empresa_team_member(p_recipient_user_id, p.empresa_user_id)
            AND EXISTS (
              SELECT 1 FROM public.propostas pr
              WHERE pr.projeto_id = p_projeto_id
                AND pr.consultor_user_id = p_sender_user_id
                AND pr.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
            )
          )
        )
    )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.audit_blocked_message_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
BEGIN
  IF NEW.escopo = 'compartilhado'::text
     AND NOT public.can_user_send_project_message(NEW.projeto_id, NEW.sender_user_id, NEW.recipient_user_id, NEW.escopo) THEN
    v_reason := 'Conversa bloqueada: a troca de mensagens com consultores só é permitida após a pré-aprovação do projeto.';

    PERFORM public.log_audit_event(
      'comunicacao',
      'mensagem_bloqueada_pre_aprovacao',
      'mensagens',
      NEW.projeto_id,
      v_reason,
      NULL,
      jsonb_build_object(
        'projeto_id', NEW.projeto_id,
        'sender_user_id', NEW.sender_user_id,
        'recipient_user_id', NEW.recipient_user_id,
        'escopo', NEW.escopo,
        'motivo', v_reason
      ),
      'warning'
    );

    RAISE EXCEPTION '%', v_reason;
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Users insert messages only when conversation is open" ON public.mensagens;
CREATE POLICY "Users insert messages only when conversation is open"
ON public.mensagens
FOR INSERT
WITH CHECK (
  sender_user_id = auth.uid()
  AND public.can_user_send_project_message(projeto_id, auth.uid(), recipient_user_id, escopo)
);

DROP POLICY IF EXISTS "Participants see direct messages after pre approval" ON public.mensagens;
CREATE POLICY "Participants see direct messages after pre approval"
ON public.mensagens
FOR SELECT
USING (
  recipient_user_id IS NOT NULL
  AND (sender_user_id = auth.uid() OR recipient_user_id = auth.uid())
  AND public.can_user_send_project_message(mensagens.projeto_id, mensagens.sender_user_id, mensagens.recipient_user_id, mensagens.escopo)
);

REVOKE ALL ON FUNCTION public.can_user_send_project_message(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_user_send_project_message(uuid, uuid, uuid, text) TO authenticated;