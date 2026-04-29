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

    IF NEW.escopo = 'compartilhado' THEN
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
        'aprovado_pre_aprovacao',
        NEW.mime_type,
        NEW.nome,
        jsonb_build_object(
          'recipient_user_id', NEW.recipient_user_id,
          'escopo', NEW.escopo,
          'origem', NEW.origem,
          'motivo', 'Anexo de chat autorizado porque a conversa já estava liberada pela pré-aprovação.'
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;