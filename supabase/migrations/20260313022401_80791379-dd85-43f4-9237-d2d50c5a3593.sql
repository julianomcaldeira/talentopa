
-- Portfolio cases table: auto-generated from completed projects
CREATE TABLE public.portfolio_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_user_id uuid NOT NULL,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  software_nome text,
  modulos_implementados text[] DEFAULT '{}',
  horas_trabalhadas numeric DEFAULT 0,
  nota_recebida numeric,
  depoimento_empresa text,
  publicado boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(consultor_user_id, projeto_id)
);

ALTER TABLE public.portfolio_cases ENABLE ROW LEVEL SECURITY;

-- Public cases viewable by everyone authenticated
CREATE POLICY "Portfolio cases viewable by authenticated"
  ON public.portfolio_cases FOR SELECT TO authenticated
  USING (true);

-- Consultants can manage own cases
CREATE POLICY "Consultants can manage own cases"
  ON public.portfolio_cases FOR ALL TO authenticated
  USING (auth.uid() = consultor_user_id)
  WITH CHECK (auth.uid() = consultor_user_id);

-- Admins can manage all cases
CREATE POLICY "Admins can manage all cases"
  ON public.portfolio_cases FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to auto-generate portfolio case when a project is completed
CREATE OR REPLACE FUNCTION public.auto_generate_portfolio_case()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _proposta RECORD;
  _software_nome TEXT;
  _modulos TEXT[];
  _horas NUMERIC;
  _avaliacao RECORD;
BEGIN
  -- Only trigger when status changes to 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status <> 'concluido') THEN
    -- Get software name
    SELECT s.nome INTO _software_nome
    FROM softwares s WHERE s.id = NEW.software_id;

    -- Get modules
    SELECT ARRAY_AGG(m.nome) INTO _modulos
    FROM projeto_modulos pm JOIN modulos m ON m.id = pm.modulo_id
    WHERE pm.projeto_id = NEW.id;

    -- Get total hours from phases
    SELECT COALESCE(SUM(pf.horas_executadas), 0) INTO _horas
    FROM projeto_fases pf WHERE pf.projeto_id = NEW.id;

    -- For each accepted consultant, create a portfolio case
    FOR _proposta IN
      SELECT * FROM propostas WHERE projeto_id = NEW.id AND status = 'aceita'
    LOOP
      -- Get evaluation if exists
      SELECT nota, comentario INTO _avaliacao
      FROM avaliacoes WHERE projeto_id = NEW.id AND avaliado_user_id = _proposta.consultor_user_id
      LIMIT 1;

      INSERT INTO portfolio_cases (consultor_user_id, projeto_id, titulo, descricao, software_nome, modulos_implementados, horas_trabalhadas, nota_recebida, depoimento_empresa)
      VALUES (
        _proposta.consultor_user_id,
        NEW.id,
        NEW.nome,
        NEW.descricao,
        _software_nome,
        COALESCE(_modulos, '{}'),
        _horas,
        _avaliacao.nota,
        _avaliacao.comentario
      )
      ON CONFLICT (consultor_user_id, projeto_id) DO UPDATE SET
        titulo = EXCLUDED.titulo,
        descricao = EXCLUDED.descricao,
        software_nome = EXCLUDED.software_nome,
        modulos_implementados = EXCLUDED.modulos_implementados,
        horas_trabalhadas = EXCLUDED.horas_trabalhadas,
        nota_recebida = EXCLUDED.nota_recebida,
        depoimento_empresa = EXCLUDED.depoimento_empresa,
        updated_at = now();
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_portfolio_case
  AFTER UPDATE ON public.projetos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_portfolio_case();
