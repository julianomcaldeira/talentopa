
-- Add hours tracking to projeto_fases
ALTER TABLE projeto_fases ADD COLUMN IF NOT EXISTS horas_estimadas numeric DEFAULT 0;
ALTER TABLE projeto_fases ADD COLUMN IF NOT EXISTS horas_executadas numeric DEFAULT 0;

-- Create knowledge base / project learnings table
CREATE TABLE IF NOT EXISTS projeto_aprendizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES projetos(id) ON DELETE CASCADE NOT NULL,
  tipo_projeto text,
  erp_utilizado text,
  modulos_implementados text[] DEFAULT '{}',
  tempo_estimado_dias integer,
  tempo_real_dias integer,
  horas_estimadas numeric DEFAULT 0,
  horas_reais numeric DEFAULT 0,
  dificuldades text,
  licoes_aprendidas text,
  recomendacoes text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid
);

ALTER TABLE projeto_aprendizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learnings viewable by authenticated"
  ON projeto_aprendizados FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage learnings"
  ON projeto_aprendizados FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Project owners can insert learnings"
  ON projeto_aprendizados FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projetos
      WHERE projetos.id = projeto_aprendizados.projeto_id
        AND projetos.empresa_user_id = auth.uid()
    )
  );

-- Create project risks/alerts table
CREATE TABLE IF NOT EXISTS projeto_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES projetos(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'media',
  titulo text NOT NULL,
  descricao text,
  resolvido boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  resolved_at timestamptz
);

ALTER TABLE projeto_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alerts viewable by authenticated"
  ON projeto_alertas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage alerts"
  ON projeto_alertas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Project owners can manage own alerts"
  ON projeto_alertas FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projetos
      WHERE projetos.id = projeto_alertas.projeto_id
        AND projetos.empresa_user_id = auth.uid()
    )
  );

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_alertas;
