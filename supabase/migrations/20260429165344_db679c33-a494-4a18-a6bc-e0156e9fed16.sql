CREATE OR REPLACE FUNCTION public.prevent_completed_project_child_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_projeto_id uuid;
  v_status public.status_projeto;
BEGIN
  v_projeto_id := COALESCE(NEW.projeto_id, OLD.projeto_id);

  SELECT status INTO v_status
  FROM public.projetos
  WHERE id = v_projeto_id;

  IF v_status = 'concluido'::public.status_projeto THEN
    RAISE EXCEPTION 'Projeto concluído: alterações críticas de escopo, módulos, funcionalidades ou fases estão bloqueadas.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS prevent_completed_project_modulos_changes_trigger ON public.projeto_modulos;
CREATE TRIGGER prevent_completed_project_modulos_changes_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.projeto_modulos
FOR EACH ROW
EXECUTE FUNCTION public.prevent_completed_project_child_changes();

DROP TRIGGER IF EXISTS prevent_completed_project_funcionalidades_changes_trigger ON public.projeto_funcionalidades;
CREATE TRIGGER prevent_completed_project_funcionalidades_changes_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.projeto_funcionalidades
FOR EACH ROW
EXECUTE FUNCTION public.prevent_completed_project_child_changes();

DROP TRIGGER IF EXISTS prevent_completed_project_fases_changes_trigger ON public.projeto_fases;
CREATE TRIGGER prevent_completed_project_fases_changes_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.projeto_fases
FOR EACH ROW
EXECUTE FUNCTION public.prevent_completed_project_child_changes();