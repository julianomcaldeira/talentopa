-- Status da agenda do consultor
DO $$ BEGIN
  CREATE TYPE public.status_agenda_consultor AS ENUM ('agendado','bloqueado','vago');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.consultor_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_user_id uuid NOT NULL,
  projeto_id uuid NULL,
  titulo text NOT NULL,
  descricao text NULL,
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  status public.status_agenda_consultor NOT NULL DEFAULT 'agendado',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consultor_agenda_periodo_chk CHECK (fim > inicio)
);

CREATE INDEX IF NOT EXISTS idx_consultor_agenda_user_inicio ON public.consultor_agenda(consultor_user_id, inicio);
CREATE INDEX IF NOT EXISTS idx_consultor_agenda_projeto ON public.consultor_agenda(projeto_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultor_agenda TO authenticated;
GRANT ALL ON public.consultor_agenda TO service_role;

ALTER TABLE public.consultor_agenda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Consultores gerenciam própria agenda" ON public.consultor_agenda;
CREATE POLICY "Consultores gerenciam própria agenda"
  ON public.consultor_agenda
  FOR ALL TO authenticated
  USING (consultor_user_id = auth.uid())
  WITH CHECK (consultor_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins gerenciam agenda de consultores" ON public.consultor_agenda;
CREATE POLICY "Admins gerenciam agenda de consultores"
  ON public.consultor_agenda
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_consultor_agenda_updated_at ON public.consultor_agenda;
CREATE TRIGGER update_consultor_agenda_updated_at
  BEFORE UPDATE ON public.consultor_agenda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();