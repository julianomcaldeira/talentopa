CREATE OR REPLACE FUNCTION public.notify_consultores_prazo_propostas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text;
  v_mensagem text;
  v_data_fmt text;
BEGIN
  -- Só dispara se o prazo realmente mudou (incluindo passar de NULL para data ou vice-versa)
  IF NEW.prazo_propostas IS NOT DISTINCT FROM OLD.prazo_propostas THEN
    RETURN NEW;
  END IF;

  IF NEW.prazo_propostas IS NULL THEN
    v_titulo := 'Prazo de propostas removido';
    v_mensagem := 'O prazo para envio de propostas do projeto "' || NEW.nome || '" foi removido pela empresa.';
  ELSE
    v_data_fmt := to_char(NEW.prazo_propostas, 'DD/MM/YYYY');
    IF OLD.prazo_propostas IS NULL THEN
      v_titulo := 'Novo prazo de propostas definido';
      v_mensagem := 'A empresa definiu ' || v_data_fmt || ' como prazo limite para envio de propostas no projeto "' || NEW.nome || '".';
    ELSE
      v_titulo := 'Prazo de propostas atualizado';
      v_mensagem := 'O prazo de propostas do projeto "' || NEW.nome || '" foi alterado para ' || v_data_fmt || '.';
    END IF;
  END IF;

  -- Notifica todos os consultores que enviaram proposta (qualquer status, exceto recusada)
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo, referencia_tipo, referencia_id)
  SELECT DISTINCT pr.consultor_user_id,
         v_titulo,
         v_mensagem,
         'info',
         'projeto',
         NEW.id
  FROM public.propostas pr
  WHERE pr.projeto_id = NEW.id
    AND pr.status <> 'recusada';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_consultores_prazo_propostas ON public.projetos;
CREATE TRIGGER trg_notify_consultores_prazo_propostas
AFTER UPDATE OF prazo_propostas ON public.projetos
FOR EACH ROW
EXECUTE FUNCTION public.notify_consultores_prazo_propostas();