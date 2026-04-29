ALTER TABLE public.propostas
ADD COLUMN IF NOT EXISTS visualizada_empresa_em timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_propostas_projeto_visualizada_empresa
ON public.propostas (projeto_id, visualizada_empresa_em)
WHERE visualizada_empresa_em IS NULL;

CREATE OR REPLACE FUNCTION public.marcar_propostas_visualizadas_empresa(p_projeto_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_empresa_user_id uuid;
BEGIN
  SELECT empresa_user_id INTO v_empresa_user_id
  FROM public.projetos
  WHERE id = p_projeto_id;

  IF v_empresa_user_id IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF NOT public.is_empresa_team_member(auth.uid(), v_empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar propostas deste projeto';
  END IF;

  UPDATE public.propostas
  SET visualizada_empresa_em = COALESCE(visualizada_empresa_em, now()),
      updated_at = now()
  WHERE projeto_id = p_projeto_id
    AND visualizada_empresa_em IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_propostas_visualizadas_empresa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_propostas_visualizadas_empresa(uuid) TO authenticated;