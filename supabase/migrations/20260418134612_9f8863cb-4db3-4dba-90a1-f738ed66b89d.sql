-- Create enum for role within company
DO $$ BEGIN
  CREATE TYPE public.papel_empresa_usuario AS ENUM ('responsavel', 'financeiro', 'operacional');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create empresa_usuarios table
CREATE TABLE IF NOT EXISTS public.empresa_usuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_user_id UUID NOT NULL,
  user_id UUID NOT NULL,
  papel public.papel_empresa_usuario NOT NULL DEFAULT 'operacional',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (empresa_user_id, user_id, papel)
);

CREATE INDEX IF NOT EXISTS idx_empresa_usuarios_empresa ON public.empresa_usuarios(empresa_user_id);
CREATE INDEX IF NOT EXISTS idx_empresa_usuarios_user ON public.empresa_usuarios(user_id);

-- Enable RLS
ALTER TABLE public.empresa_usuarios ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins manage empresa_usuarios"
ON public.empresa_usuarios
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Empresa owner manages own links"
ON public.empresa_usuarios
FOR ALL
TO authenticated
USING (auth.uid() = empresa_user_id)
WITH CHECK (auth.uid() = empresa_user_id);

CREATE POLICY "Linked user can view own links"
ON public.empresa_usuarios
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_empresa_usuarios_updated_at ON public.empresa_usuarios;
CREATE TRIGGER update_empresa_usuarios_updated_at
BEFORE UPDATE ON public.empresa_usuarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();