
-- 1. Adicionar coluna para escopo gerado por IA e classificação
ALTER TABLE public.projetos 
  ADD COLUMN IF NOT EXISTS escopo_ia text,
  ADD COLUMN IF NOT EXISTS classificacao_ia jsonb;

-- 2. Tabela de anexos do projeto (até 5 arquivos para análise)
CREATE TABLE IF NOT EXISTS public.projeto_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  uploader_user_id uuid NOT NULL,
  nome text NOT NULL,
  arquivo_url text NOT NULL,
  tamanho_bytes bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anexos viewable by project parties"
ON public.projeto_anexos FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_anexos.projeto_id AND is_empresa_team_member(auth.uid(), p.empresa_user_id))
  OR EXISTS (SELECT 1 FROM propostas pr WHERE pr.projeto_id = projeto_anexos.projeto_id AND pr.consultor_user_id = auth.uid())
);

CREATE POLICY "Empresa pode inserir anexos"
ON public.projeto_anexos FOR INSERT
WITH CHECK (
  uploader_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_anexos.projeto_id AND is_empresa_team_member(auth.uid(), p.empresa_user_id))
);

CREATE POLICY "Empresa pode deletar anexos"
ON public.projeto_anexos FOR DELETE
USING (
  uploader_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_anexos.projeto_id AND is_empresa_team_member(auth.uid(), p.empresa_user_id))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 3. Storage bucket para anexos
INSERT INTO storage.buckets (id, name, public)
VALUES ('projeto-anexos', 'projeto-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Empresa upload anexos projeto"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'projeto-anexos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Partes do projeto leem anexos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'projeto-anexos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM projeto_anexos pa
      JOIN projetos p ON p.id = pa.projeto_id
      WHERE pa.arquivo_url LIKE '%' || name
      AND (
        is_empresa_team_member(auth.uid(), p.empresa_user_id)
        OR EXISTS (SELECT 1 FROM propostas pr WHERE pr.projeto_id = p.id AND pr.consultor_user_id = auth.uid())
      )
    )
  )
);

CREATE POLICY "Empresa deleta anexos projeto"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'projeto-anexos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
