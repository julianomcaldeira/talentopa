CREATE OR REPLACE FUNCTION public.prevent_critical_project_changes_after_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'concluido'::public.status_projeto THEN
    IF NEW.nome IS DISTINCT FROM OLD.nome
      OR NEW.empresa_user_id IS DISTINCT FROM OLD.empresa_user_id
      OR NEW.software_id IS DISTINCT FROM OLD.software_id
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.prazo_estimado IS DISTINCT FROM OLD.prazo_estimado
      OR NEW.prazo_propostas IS DISTINCT FROM OLD.prazo_propostas
      OR NEW.objetivo IS DISTINCT FROM OLD.objetivo
      OR NEW.problema_atual IS DISTINCT FROM OLD.problema_atual
      OR NEW.modelo_contratacao IS DISTINCT FROM OLD.modelo_contratacao
      OR NEW.escopo_ia IS DISTINCT FROM OLD.escopo_ia
      OR NEW.classificacao_ia IS DISTINCT FROM OLD.classificacao_ia
      OR NEW.template_id IS DISTINCT FROM OLD.template_id
      OR NEW.protocolo IS DISTINCT FROM OLD.protocolo
    THEN
      RAISE EXCEPTION 'Projeto concluído: alterações críticas estão bloqueadas. Apenas descrição e observações podem ser atualizadas.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_critical_project_changes_after_completion_trigger ON public.projetos;
CREATE TRIGGER prevent_critical_project_changes_after_completion_trigger
BEFORE UPDATE ON public.projetos
FOR EACH ROW
EXECUTE FUNCTION public.prevent_critical_project_changes_after_completion();