CREATE TABLE public.score_config_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_values JSONB NOT NULL,
  new_values JSONB NOT NULL,
  changes JSONB NOT NULL
);

ALTER TABLE public.score_config_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit log"
ON public.score_config_audit FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can insert audit log"
ON public.score_config_audit FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_score_config_audit_changed_at ON public.score_config_audit(changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_score_config_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old JSONB;
  v_new JSONB;
  v_changes JSONB := '{}'::jsonb;
  v_key TEXT;
  v_fields TEXT[] := ARRAY[
    'perf_nota_media','perf_projetos_concluidos','perf_taxa_aceitacao','perf_pontualidade','perf_recomendacoes',
    'match_software','match_modulos','match_funcionalidades','match_senioridade'
  ];
BEGIN
  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  FOREACH v_key IN ARRAY v_fields LOOP
    IF (v_old->>v_key) IS DISTINCT FROM (v_new->>v_key) THEN
      v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('from', v_old->v_key, 'to', v_new->v_key));
    END IF;
  END LOOP;

  IF v_changes <> '{}'::jsonb THEN
    INSERT INTO public.score_config_audit (changed_by, old_values, new_values, changes)
    VALUES (NEW.updated_by, v_old - 'updated_at' - 'updated_by', v_new - 'updated_at' - 'updated_by', v_changes);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_score_config_change
AFTER UPDATE ON public.score_config
FOR EACH ROW
EXECUTE FUNCTION public.log_score_config_change();