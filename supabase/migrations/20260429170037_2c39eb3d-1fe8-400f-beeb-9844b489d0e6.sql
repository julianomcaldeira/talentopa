CREATE OR REPLACE FUNCTION public.audit_blocked_message_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_attempt_id uuid;
BEGIN
  IF NEW.escopo = 'compartilhado'::text
     AND NOT public.can_user_send_project_message(NEW.projeto_id, NEW.sender_user_id, NEW.recipient_user_id, NEW.escopo) THEN
    v_reason := 'Conversa bloqueada: a troca de mensagens com consultores só é permitida após a pré-aprovação do projeto.';

    INSERT INTO public.mensagem_tentativas_bloqueadas (
      projeto_id,
      sender_user_id,
      recipient_user_id,
      escopo,
      motivo
    ) VALUES (
      NEW.projeto_id,
      NEW.sender_user_id,
      NEW.recipient_user_id,
      NEW.escopo,
      v_reason
    )
    RETURNING id INTO v_attempt_id;

    PERFORM public.log_audit_event(
      'comunicacao',
      CASE WHEN TG_OP = 'UPDATE' THEN 'liberacao_mensagem_bloqueada_pre_aprovacao' ELSE 'mensagem_bloqueada_pre_aprovacao' END,
      'mensagem_tentativas_bloqueadas',
      v_attempt_id,
      v_reason,
      CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
      jsonb_build_object(
        'projeto_id', NEW.projeto_id,
        'sender_user_id', NEW.sender_user_id,
        'recipient_user_id', NEW.recipient_user_id,
        'escopo', NEW.escopo,
        'motivo', v_reason
      ),
      'warning'
    );

    IF TG_OP = 'UPDATE' THEN
      NEW.escopo := OLD.escopo;
      RETURN NEW;
    END IF;

    NEW.bloqueado := true;
    NEW.moderado := true;
    NEW.motivo_bloqueio := v_reason;
    NEW.conteudo := '[Mensagem bloqueada antes da pré-aprovação]';
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
  AND (
    public.can_user_send_project_message(projeto_id, auth.uid(), recipient_user_id, escopo)
    OR (
      bloqueado = true
      AND motivo_bloqueio = 'Conversa bloqueada: a troca de mensagens com consultores só é permitida após a pré-aprovação do projeto.'
    )
  )
);