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

    RAISE EXCEPTION '%', v_reason;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_blocked_message_attempt_trg ON public.mensagens;
CREATE TRIGGER audit_blocked_message_attempt_trg
BEFORE INSERT OR UPDATE OF escopo ON public.mensagens
FOR EACH ROW
EXECUTE FUNCTION public.audit_blocked_message_attempt();