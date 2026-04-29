CREATE TABLE IF NOT EXISTS public.projeto_alteracoes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL,
  alterado_por uuid NOT NULL,
  tipo_alteracao text NOT NULL DEFAULT 'alteracao_significativa',
  descricao text,
  campos_alterados text[] NOT NULL DEFAULT '{}'::text[],
  dados_anteriores jsonb NOT NULL DEFAULT '{}'::jsonb,
  dados_novos jsonb NOT NULL DEFAULT '{}'::jsonb,
  notificar_consultores boolean NOT NULL DEFAULT false,
  mensagem_notificacao text,
  consultores_notificados jsonb NOT NULL DEFAULT '[]'::jsonb,
  notificado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_alteracoes_historico_projeto ON public.projeto_alteracoes_historico(projeto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projeto_alteracoes_historico_alterado_por ON public.projeto_alteracoes_historico(alterado_por);
CREATE INDEX IF NOT EXISTS idx_projeto_alteracoes_historico_notificado ON public.projeto_alteracoes_historico(notificar_consultores, notificado_em DESC);

ALTER TABLE public.projeto_alteracoes_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all project change history" ON public.projeto_alteracoes_historico;
CREATE POLICY "Admins can view all project change history"
ON public.projeto_alteracoes_historico
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Company team can view own project change history" ON public.projeto_alteracoes_historico;
CREATE POLICY "Company team can view own project change history"
ON public.projeto_alteracoes_historico
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_alteracoes_historico.projeto_id
      AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
  )
);

DROP POLICY IF EXISTS "Linked consultants can view project change history" ON public.projeto_alteracoes_historico;
CREATE POLICY "Linked consultants can view project change history"
ON public.projeto_alteracoes_historico
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.propostas pr
    WHERE pr.projeto_id = projeto_alteracoes_historico.projeto_id
      AND pr.consultor_user_id = auth.uid()
      AND pr.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
  )
);

DROP POLICY IF EXISTS "Company team can insert own project change history" ON public.projeto_alteracoes_historico;
CREATE POLICY "Company team can insert own project change history"
ON public.projeto_alteracoes_historico
FOR INSERT
TO authenticated
WITH CHECK (
  alterado_por = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_alteracoes_historico.projeto_id
      AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
  )
);

DROP POLICY IF EXISTS "Admins can insert project change history" ON public.projeto_alteracoes_historico;
CREATE POLICY "Admins can insert project change history"
ON public.projeto_alteracoes_historico
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.registrar_projeto_alteracao(
  p_projeto_id uuid,
  p_tipo_alteracao text,
  p_descricao text,
  p_campos_alterados text[],
  p_dados_anteriores jsonb,
  p_dados_novos jsonb,
  p_notificar_consultores boolean,
  p_mensagem text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto public.projetos%ROWTYPE;
  v_consultores jsonb := '[]'::jsonb;
  v_hist_id uuid;
BEGIN
  SELECT * INTO v_projeto
  FROM public.projetos
  WHERE id = p_projeto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF NOT (public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para registrar alterações neste projeto';
  END IF;

  IF p_notificar_consultores THEN
    WITH linked AS (
      SELECT DISTINCT pr.consultor_user_id, COALESCE(pf.nome, 'Consultor') AS nome, pr.status::text AS status
      FROM public.propostas pr
      LEFT JOIN public.profiles pf ON pf.user_id = pr.consultor_user_id
      WHERE pr.projeto_id = p_projeto_id
        AND pr.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
    ), inserted AS (
      INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
      SELECT consultor_user_id, 'alteracao_projeto', 'Alteração importante no projeto', COALESCE(NULLIF(p_mensagem, ''), 'Houve uma atualização importante no projeto "' || v_projeto.nome || '".'), p_projeto_id, 'projeto'
      FROM linked
      RETURNING user_id
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', l.consultor_user_id, 'nome', l.nome, 'status', l.status, 'notificado_em', now())), '[]'::jsonb)
    INTO v_consultores
    FROM linked l;
  END IF;

  INSERT INTO public.projeto_alteracoes_historico (
    projeto_id,
    alterado_por,
    tipo_alteracao,
    descricao,
    campos_alterados,
    dados_anteriores,
    dados_novos,
    notificar_consultores,
    mensagem_notificacao,
    consultores_notificados,
    notificado_em
  ) VALUES (
    p_projeto_id,
    auth.uid(),
    COALESCE(NULLIF(p_tipo_alteracao, ''), 'alteracao_significativa'),
    p_descricao,
    COALESCE(p_campos_alterados, '{}'::text[]),
    COALESCE(p_dados_anteriores, '{}'::jsonb),
    COALESCE(p_dados_novos, '{}'::jsonb),
    COALESCE(p_notificar_consultores, false),
    CASE WHEN p_notificar_consultores THEN p_mensagem ELSE NULL END,
    CASE WHEN p_notificar_consultores THEN v_consultores ELSE '[]'::jsonb END,
    CASE WHEN p_notificar_consultores THEN now() ELSE NULL END
  )
  RETURNING id INTO v_hist_id;

  RETURN v_hist_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_projeto_alteracao(uuid, text, text, text[], jsonb, jsonb, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_projeto_alteracao(uuid, text, text, text[], jsonb, jsonb, boolean, text) TO authenticated;