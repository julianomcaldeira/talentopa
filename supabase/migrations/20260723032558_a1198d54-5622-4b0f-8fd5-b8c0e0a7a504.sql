
-- 1. parceiro_respostas
CREATE TABLE public.parceiro_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  canal_id uuid NOT NULL REFERENCES public.canais(id) ON DELETE CASCADE,
  respondido_por uuid,
  comentarios text,
  status text NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviada','cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (projeto_id, canal_id)
);
CREATE INDEX idx_parceiro_respostas_projeto ON public.parceiro_respostas(projeto_id);
CREATE INDEX idx_parceiro_respostas_canal ON public.parceiro_respostas(canal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiro_respostas TO authenticated;
GRANT ALL ON public.parceiro_respostas TO service_role;
ALTER TABLE public.parceiro_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full parceiro_respostas" ON public.parceiro_respostas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Canal dono gerencia respostas" ON public.parceiro_respostas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.canais c WHERE c.id = parceiro_respostas.canal_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.canais c WHERE c.id = parceiro_respostas.canal_id AND c.user_id = auth.uid()));

CREATE POLICY "Empresa dona do projeto le respostas" ON public.parceiro_respostas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = parceiro_respostas.projeto_id AND p.empresa_user_id = auth.uid()));

CREATE TRIGGER trg_parceiro_respostas_updated
  BEFORE UPDATE ON public.parceiro_respostas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. parceiro_indicacoes
CREATE TABLE public.parceiro_indicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id uuid NOT NULL REFERENCES public.parceiro_respostas(id) ON DELETE CASCADE,
  consultor_user_id uuid NOT NULL,
  canal_id uuid NOT NULL REFERENCES public.canais(id),
  valor_proposto numeric(12,2),
  observacao text,
  status text NOT NULL DEFAULT 'indicado' CHECK (status IN ('indicado','selecionado','recusado','retirado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resposta_id, consultor_user_id)
);
CREATE INDEX idx_parceiro_indicacoes_resposta ON public.parceiro_indicacoes(resposta_id);
CREATE INDEX idx_parceiro_indicacoes_consultor ON public.parceiro_indicacoes(consultor_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiro_indicacoes TO authenticated;
GRANT ALL ON public.parceiro_indicacoes TO service_role;
ALTER TABLE public.parceiro_indicacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full parceiro_indicacoes" ON public.parceiro_indicacoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Canal dono gerencia indicacoes" ON public.parceiro_indicacoes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.canais c WHERE c.id = parceiro_indicacoes.canal_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.canais c WHERE c.id = parceiro_indicacoes.canal_id AND c.user_id = auth.uid()));

CREATE POLICY "Empresa dona le indicacoes" ON public.parceiro_indicacoes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.parceiro_respostas r
    JOIN public.projetos p ON p.id = r.projeto_id
    WHERE r.id = parceiro_indicacoes.resposta_id AND p.empresa_user_id = auth.uid()
  ));

CREATE POLICY "Consultor le suas indicacoes" ON public.parceiro_indicacoes
  FOR SELECT TO authenticated
  USING (consultor_user_id = auth.uid());

-- 3. consultor_perfil: novos campos
ALTER TABLE public.consultor_perfil
  ADD COLUMN IF NOT EXISTS jornada_diaria_horas numeric(4,1) DEFAULT 8,
  ADD COLUMN IF NOT EXISTS dias_semana_disponiveis int[] DEFAULT '{1,2,3,4,5}';

-- 4. consultor_agenda_dias
CREATE TABLE public.consultor_agenda_dias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_user_id uuid NOT NULL,
  canal_id uuid NOT NULL REFERENCES public.canais(id) ON DELETE CASCADE,
  dia date NOT NULL,
  estado text NOT NULL CHECK (estado IN ('disponivel','alocado','bloqueado')),
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  jornada_horas numeric(4,1) NOT NULL DEFAULT 8,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consultor_user_id, dia),
  CHECK (estado <> 'alocado' OR projeto_id IS NOT NULL)
);
CREATE INDEX idx_consultor_agenda_dias_consultor_dia ON public.consultor_agenda_dias(consultor_user_id, dia);
CREATE INDEX idx_consultor_agenda_dias_canal ON public.consultor_agenda_dias(canal_id);
CREATE INDEX idx_consultor_agenda_dias_projeto ON public.consultor_agenda_dias(projeto_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultor_agenda_dias TO authenticated;
GRANT ALL ON public.consultor_agenda_dias TO service_role;
ALTER TABLE public.consultor_agenda_dias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full agenda_dias" ON public.consultor_agenda_dias
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Canal dono gerencia agenda_dias" ON public.consultor_agenda_dias
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.canais c WHERE c.id = consultor_agenda_dias.canal_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.canais c WHERE c.id = consultor_agenda_dias.canal_id AND c.user_id = auth.uid()));

CREATE POLICY "Consultor le sua agenda_dias" ON public.consultor_agenda_dias
  FOR SELECT TO authenticated
  USING (consultor_user_id = auth.uid());

CREATE TRIGGER trg_agenda_dias_updated
  BEFORE UPDATE ON public.consultor_agenda_dias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. projetos.roteamento_v2
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS roteamento_v2 boolean NOT NULL DEFAULT false;

-- 6. canal_consultores unique parcial (idempotente — já existe)
CREATE UNIQUE INDEX IF NOT EXISTS uq_canal_consultor_ativo_global
  ON public.canal_consultores (consultor_user_id)
  WHERE status = 'ativo';

-- 7. Policy adicional em consultor_agenda para o canal parceiro
CREATE POLICY "Canal parceiro le agenda pessoal do consultor" ON public.consultor_agenda
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.canal_consultores cc
    JOIN public.canais c ON c.id = cc.canal_id
    WHERE cc.consultor_user_id = consultor_agenda.consultor_user_id
      AND cc.status = 'ativo'
      AND c.user_id = auth.uid()
  ));

-- 8. Função helper
CREATE OR REPLACE FUNCTION public.consultor_tem_vinculo_ativo(p_consultor uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT canal_id FROM public.canal_consultores
  WHERE consultor_user_id = p_consultor AND status = 'ativo'
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.consultor_tem_vinculo_ativo(uuid) TO authenticated, anon;
