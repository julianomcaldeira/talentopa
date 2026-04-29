CREATE TABLE IF NOT EXISTS public.proposta_visualizacoes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL,
  projeto_id uuid NOT NULL,
  visualizado_por uuid NOT NULL,
  visualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.proposta_visualizacoes_historico ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_proposta_visualizacoes_projeto
ON public.proposta_visualizacoes_historico (projeto_id, visualizado_em DESC);

CREATE INDEX IF NOT EXISTS idx_proposta_visualizacoes_proposta
ON public.proposta_visualizacoes_historico (proposta_id, visualizado_em DESC);

DROP POLICY IF EXISTS "Admins view proposal view history" ON public.proposta_visualizacoes_historico;
CREATE POLICY "Admins view proposal view history"
ON public.proposta_visualizacoes_historico
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Company team view own proposal view history" ON public.proposta_visualizacoes_historico;
CREATE POLICY "Company team view own proposal view history"
ON public.proposta_visualizacoes_historico
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projetos p
    WHERE p.id = proposta_visualizacoes_historico.projeto_id
      AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
  )
);

CREATE OR REPLACE FUNCTION public.marcar_propostas_visualizadas_empresa(p_projeto_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_empresa_user_id uuid;
  v_visualizador uuid := auth.uid();
BEGIN
  IF v_visualizador IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT empresa_user_id INTO v_empresa_user_id
  FROM public.projetos
  WHERE id = p_projeto_id;

  IF v_empresa_user_id IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF NOT public.is_empresa_team_member(v_visualizador, v_empresa_user_id)
     AND NOT public.has_role(v_visualizador, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar propostas deste projeto';
  END IF;

  WITH propostas_marcadas AS (
    UPDATE public.propostas
    SET visualizada_empresa_em = now(),
        updated_at = now()
    WHERE projeto_id = p_projeto_id
      AND visualizada_empresa_em IS NULL
    RETURNING id, projeto_id
  ), historico AS (
    INSERT INTO public.proposta_visualizacoes_historico (
      proposta_id,
      projeto_id,
      visualizado_por,
      visualizado_em
    )
    SELECT
      pm.id,
      pm.projeto_id,
      v_visualizador,
      now()
    FROM propostas_marcadas pm
    RETURNING id
  )
  SELECT count(*)::integer INTO v_count
  FROM historico;

  IF v_count > 0 THEN
    PERFORM public.log_audit_event(
      'propostas',
      'propostas_visualizadas_empresa',
      'proposta_visualizacoes_historico',
      p_projeto_id,
      'Propostas marcadas como visualizadas pela empresa',
      NULL,
      jsonb_build_object(
        'projeto_id', p_projeto_id,
        'visualizado_por', v_visualizador,
        'quantidade', v_count,
        'visualizado_em', now()
      ),
      'info'
    );
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON TABLE public.proposta_visualizacoes_historico FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.proposta_visualizacoes_historico TO authenticated;

REVOKE ALL ON FUNCTION public.marcar_propostas_visualizadas_empresa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_propostas_visualizadas_empresa(uuid) TO authenticated;