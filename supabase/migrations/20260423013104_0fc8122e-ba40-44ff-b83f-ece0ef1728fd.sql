CREATE OR REPLACE FUNCTION public.notify_consultores_prazo_propostas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text;
  v_mensagem text;
  v_nova text;
  v_antiga text;
  v_status_label text;
BEGIN
  IF NEW.prazo_propostas IS NOT DISTINCT FROM OLD.prazo_propostas THEN
    RETURN NEW;
  END IF;

  v_nova := COALESCE(to_char(NEW.prazo_propostas, 'DD/MM/YYYY'), 'sem prazo');
  v_antiga := COALESCE(to_char(OLD.prazo_propostas, 'DD/MM/YYYY'), 'sem prazo');

  v_status_label := CASE NEW.status::text
    WHEN 'rascunho' THEN 'Rascunho'
    WHEN 'publicado' THEN 'Publicado'
    WHEN 'em_selecao' THEN 'Em seleção'
    WHEN 'em_andamento' THEN 'Em andamento'
    WHEN 'concluido' THEN 'Concluído'
    WHEN 'cancelado' THEN 'Cancelado'
    ELSE NEW.status::text
  END;

  IF NEW.prazo_propostas IS NULL THEN
    v_titulo := 'Prazo de propostas removido';
  ELSIF OLD.prazo_propostas IS NULL THEN
    v_titulo := 'Novo prazo de propostas definido';
  ELSE
    v_titulo := 'Prazo de propostas atualizado';
  END IF;

  v_mensagem := 'Projeto "' || NEW.nome || '" [' || v_status_label || '] · '
             || 'Prazo anterior: ' || v_antiga || ' → Novo prazo: ' || v_nova || '.';

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