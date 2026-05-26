
-- 1. PUBLIC VIEWS
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT id, user_id, nome, avatar_url, cidade, estado, status, created_at
FROM public.profiles;

CREATE OR REPLACE VIEW public.empresa_perfil_public
WITH (security_invoker=on) AS
SELECT id, user_id, razao_social, nome_fantasia, segmento, numero_funcionarios, created_at
FROM public.empresa_perfil;

CREATE OR REPLACE VIEW public.canais_public
WITH (security_invoker=on) AS
SELECT id, user_id, nome, status, created_at
FROM public.canais;

GRANT SELECT ON public.profiles_public TO authenticated, anon;
GRANT SELECT ON public.empresa_perfil_public TO authenticated, anon;
GRANT SELECT ON public.canais_public TO authenticated, anon;

-- 2. BASE TABLE SELECT
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Users view own profile or admins view all"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Company profiles viewable by authenticated" ON public.empresa_perfil;
CREATE POLICY "Empresa team and admins view full company profile"
ON public.empresa_perfil FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR is_empresa_team_member(auth.uid(), user_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Canal owners can view own canal" ON public.canais;
CREATE POLICY "Canal owner and admins view full canal"
ON public.canais FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 3. AUDIT LOGS
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Only admins can insert audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. is_projeto_party helper
CREATE OR REPLACE FUNCTION public.is_projeto_party(_projeto_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = _projeto_id
      AND is_empresa_team_member(_user_id, p.empresa_user_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.propostas pr
    WHERE pr.projeto_id = _projeto_id
      AND pr.consultor_user_id = _user_id
      AND pr.status IN ('pre_aprovada'::status_proposta,'aguardando_consultor'::status_proposta,'aceita'::status_proposta)
  )
  OR EXISTS (
    SELECT 1 FROM public.alocacoes a
    WHERE a.projeto_id = _projeto_id
      AND (a.consultor_user_id = _user_id OR is_canal_owner(a.canal_id, _user_id))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_projeto_party(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_projeto_party(uuid, uuid) TO authenticated;

-- 5. PROJETO_* SELECT
DROP POLICY IF EXISTS "Alerts viewable by authenticated" ON public.projeto_alertas;
CREATE POLICY "Project parties view alerts"
ON public.projeto_alertas FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_projeto_party(projeto_id, auth.uid()));

DROP POLICY IF EXISTS "Learnings viewable by authenticated" ON public.projeto_aprendizados;
CREATE POLICY "Project parties view learnings"
ON public.projeto_aprendizados FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_projeto_party(projeto_id, auth.uid()));

DROP POLICY IF EXISTS "Project phases viewable by authenticated" ON public.projeto_fases;
CREATE POLICY "Project parties view phases"
ON public.projeto_fases FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_projeto_party(projeto_id, auth.uid()));

DROP POLICY IF EXISTS "Project features viewable by authenticated" ON public.projeto_funcionalidades;
CREATE POLICY "Project parties view project features"
ON public.projeto_funcionalidades FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_projeto_party(projeto_id, auth.uid()));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='projeto_modulos') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Project modules viewable by authenticated" ON public.projeto_modulos';
    EXECUTE 'DROP POLICY IF EXISTS "Modules viewable by authenticated" ON public.projeto_modulos';
    EXECUTE $p$CREATE POLICY "Project parties view project modules"
      ON public.projeto_modulos FOR SELECT TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role) OR is_projeto_party(projeto_id, auth.uid()))$p$;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='projeto_perguntas') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Questions viewable by authenticated" ON public.projeto_perguntas';
    EXECUTE $p$CREATE POLICY "Project parties view project questions"
      ON public.projeto_perguntas FOR SELECT TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role) OR is_projeto_party(projeto_id, auth.uid()))$p$;
  END IF;
END$$;

-- 6. STORAGE projeto-anexos INSERT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Partes autorizadas enviam anexos do projeto'
  ) THEN
    EXECUTE 'DROP POLICY "Partes autorizadas enviam anexos do projeto" ON storage.objects';
  END IF;
END$$;

CREATE POLICY "Project parties upload to projeto-anexos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'projeto-anexos'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_projeto_party(
      NULLIF((storage.foldername(name))[2], '')::uuid,
      auth.uid()
    )
  )
);
