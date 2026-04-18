CREATE TABLE public.consultor_buscas_favoritas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.consultor_buscas_favoritas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved searches"
ON public.consultor_buscas_favoritas
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_consultor_buscas_favoritas_user ON public.consultor_buscas_favoritas(user_id, created_at DESC);