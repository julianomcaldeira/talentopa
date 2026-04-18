CREATE TABLE public.score_config (
  id TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton' CHECK (id = 'singleton'),
  -- Performance score weights (0-10) — must sum to 100
  perf_nota_media INTEGER NOT NULL DEFAULT 30,
  perf_projetos_concluidos INTEGER NOT NULL DEFAULT 25,
  perf_taxa_aceitacao INTEGER NOT NULL DEFAULT 15,
  perf_pontualidade INTEGER NOT NULL DEFAULT 20,
  perf_recomendacoes INTEGER NOT NULL DEFAULT 10,
  -- Match score weights (0-100%) — must sum to 100
  match_software INTEGER NOT NULL DEFAULT 20,
  match_modulos INTEGER NOT NULL DEFAULT 40,
  match_funcionalidades INTEGER NOT NULL DEFAULT 30,
  match_senioridade INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT perf_sum_100 CHECK (perf_nota_media + perf_projetos_concluidos + perf_taxa_aceitacao + perf_pontualidade + perf_recomendacoes = 100),
  CONSTRAINT match_sum_100 CHECK (match_software + match_modulos + match_funcionalidades + match_senioridade = 100)
);

ALTER TABLE public.score_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Score config viewable by authenticated"
ON public.score_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can modify score config"
ON public.score_config FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.score_config (id) VALUES ('singleton') ON CONFLICT DO NOTHING;