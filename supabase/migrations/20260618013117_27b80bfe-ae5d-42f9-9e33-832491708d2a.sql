
-- 1) Move consultor_perfil.plano to a private table
CREATE TABLE IF NOT EXISTS public.consultor_assinatura (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plano plano_assinatura NOT NULL DEFAULT 'standard',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.consultor_assinatura TO authenticated;
GRANT ALL ON public.consultor_assinatura TO service_role;
ALTER TABLE public.consultor_assinatura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or admin can read plan"
  ON public.consultor_assinatura FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner can insert own plan row"
  ON public.consultor_assinatura FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can update plan"
  ON public.consultor_assinatura FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Backfill from consultor_perfil
INSERT INTO public.consultor_assinatura (user_id, plano)
SELECT user_id, plano FROM public.consultor_perfil
ON CONFLICT (user_id) DO NOTHING;

-- Drop the public-readable plano column
ALTER TABLE public.consultor_perfil DROP COLUMN IF EXISTS plano;

-- 2) Audit logs: explicitly block UPDATE/DELETE
DROP POLICY IF EXISTS "No update on audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "No delete on audit logs" ON public.audit_logs;
CREATE POLICY "No update on audit logs"
  ON public.audit_logs FOR UPDATE
  TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "No delete on audit logs"
  ON public.audit_logs FOR DELETE
  TO authenticated
  USING (false);

-- 3) Notificacoes: remove arbitrary user insert; provide controlled SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notificacoes;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_tipo text,
  p_titulo text,
  p_mensagem text,
  p_referencia_id uuid DEFAULT NULL,
  p_referencia_tipo text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_id uuid;
  v_allowed boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Self-notify always allowed
  IF v_caller = p_user_id THEN
    v_allowed := true;
  ELSIF public.has_role(v_caller, 'admin') THEN
    v_allowed := true;
  ELSIF p_referencia_tipo = 'projeto' AND p_referencia_id IS NOT NULL THEN
    -- Caller must be party of the project AND target must be party of the project
    IF public.is_projeto_party(p_referencia_id, v_caller)
       AND (
         public.is_projeto_party(p_referencia_id, p_user_id)
         OR EXISTS (
           SELECT 1 FROM public.projetos pj
           WHERE pj.id = p_referencia_id
             AND public.is_empresa_team_member(p_user_id, pj.empresa_user_id)
         )
       ) THEN
      v_allowed := true;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized to create notification for this user';
  END IF;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (p_user_id, p_tipo, p_titulo, p_mensagem, p_referencia_id, p_referencia_tipo)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid, text) TO authenticated;

-- 4) Storage: tighten DELETE on 'projeto-anexos' to require active project membership
DROP POLICY IF EXISTS "Empresa deleta anexos projeto" ON storage.objects;
CREATE POLICY "Project parties delete projeto-anexos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'projeto-anexos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        (auth.uid())::text = (storage.foldername(name))[1]
        AND public.is_projeto_party(
          (NULLIF((storage.foldername(name))[2], ''))::uuid,
          auth.uid()
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.projeto_anexos pa
        JOIN public.projetos p ON p.id = pa.projeto_id
        WHERE pa.arquivo_url = storage.objects.name
          AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
      )
    )
  );
