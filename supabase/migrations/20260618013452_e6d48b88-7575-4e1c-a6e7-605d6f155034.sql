
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_created
  ON public.notificacoes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projetos_empresa_created
  ON public.projetos (empresa_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projetos_status_created
  ON public.projetos (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projeto_fases_projeto_ordem
  ON public.projeto_fases (projeto_id, ordem);

CREATE INDEX IF NOT EXISTS idx_propostas_consultor
  ON public.propostas (consultor_user_id);

CREATE INDEX IF NOT EXISTS idx_propostas_projeto_status
  ON public.propostas (projeto_id, status);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_avaliado
  ON public.avaliacoes (avaliado_user_id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_consultor
  ON public.pagamentos (consultor_user_id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_empresa_status
  ON public.pagamentos (empresa_user_id, status);

CREATE INDEX IF NOT EXISTS idx_consultor_habilidades_user
  ON public.consultor_habilidades (user_id);

ANALYZE public.notificacoes;
ANALYZE public.projetos;
ANALYZE public.projeto_fases;
ANALYZE public.propostas;
ANALYZE public.avaliacoes;
ANALYZE public.pagamentos;
ANALYZE public.consultor_habilidades;
