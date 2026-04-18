-- 1. Add columns
ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS escopo text NOT NULL DEFAULT 'compartilhado',
  ADD COLUMN IF NOT EXISTS mencionados uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.mensagens
  ADD CONSTRAINT mensagens_escopo_check
  CHECK (escopo IN ('compartilhado', 'interno_empresa'));

CREATE INDEX IF NOT EXISTS idx_mensagens_projeto_escopo ON public.mensagens(projeto_id, escopo);

-- 2. Helper function: is user part of empresa team?
CREATE OR REPLACE FUNCTION public.is_empresa_team_member(_user_id uuid, _empresa_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = _empresa_user_id
    OR EXISTS (
      SELECT 1 FROM empresa_usuarios
      WHERE empresa_user_id = _empresa_user_id AND user_id = _user_id
    );
$$;

-- 3. Drop existing SELECT policies on mensagens and rebuild
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.mensagens'::regclass AND polcmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.mensagens', pol.polname);
  END LOOP;
END $$;

-- SELECT: admin sees everything
CREATE POLICY "Admins see all messages"
  ON public.mensagens FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- SELECT: empresa team sees both escopos of their projects
CREATE POLICY "Empresa team sees all project messages"
  ON public.mensagens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projetos p
      WHERE p.id = mensagens.projeto_id
        AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
    )
  );

-- SELECT: consultores accepted on the project see ONLY shared messages
CREATE POLICY "Consultor sees only shared messages"
  ON public.mensagens FOR SELECT
  USING (
    escopo = 'compartilhado'
    AND EXISTS (
      SELECT 1 FROM propostas pr
      WHERE pr.projeto_id = mensagens.projeto_id
        AND pr.consultor_user_id = auth.uid()
        AND pr.status = 'aceita'
    )
  );

-- SELECT: private DMs (recipient_user_id) — keep visible to recipient regardless
CREATE POLICY "Recipient sees direct messages"
  ON public.mensagens FOR SELECT
  USING (recipient_user_id = auth.uid() OR sender_user_id = auth.uid());

-- 4. INSERT policy: ensure only empresa team can post escopo='interno_empresa'
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.mensagens'::regclass AND polcmd = 'a'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.mensagens', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "Users insert messages they author"
  ON public.mensagens FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND (
      -- shared messages: anyone with project access (empresa team OR accepted consultor)
      (escopo = 'compartilhado' AND (
        EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_id AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id))
        OR EXISTS (SELECT 1 FROM propostas pr WHERE pr.projeto_id = mensagens.projeto_id AND pr.consultor_user_id = auth.uid() AND pr.status = 'aceita')
      ))
      OR
      -- internal messages: ONLY empresa team
      (escopo = 'interno_empresa' AND EXISTS (
        SELECT 1 FROM projetos p WHERE p.id = projeto_id AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
      ))
    )
  );

-- 5. UPDATE policy: allow empresa team to "promote" interno → compartilhado (release)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.mensagens'::regclass AND polcmd = 'w'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.mensagens', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "Empresa team can update message scope"
  ON public.mensagens FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projetos p
      WHERE p.id = mensagens.projeto_id
        AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
    )
  );

-- 6. Update notify_nova_mensagem to skip consultor notifications for internal messages
CREATE OR REPLACE FUNCTION public.notify_nova_mensagem()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_projeto RECORD; v_nome text; v_p RECORD; v_mentioned uuid;
BEGIN
  SELECT * INTO v_projeto FROM projetos WHERE id = NEW.projeto_id;
  SELECT nome INTO v_nome FROM profiles WHERE user_id = NEW.sender_user_id;

  -- Notifica operacional da empresa (exceto se o próprio remetente for da empresa)
  IF v_projeto.empresa_user_id != NEW.sender_user_id
     AND NOT EXISTS (SELECT 1 FROM empresa_usuarios WHERE empresa_user_id = v_projeto.empresa_user_id AND user_id = NEW.sender_user_id)
  THEN
    PERFORM notify_empresa_por_papel(
      v_projeto.empresa_user_id,
      'operacional'::papel_empresa_usuario,
      'mensagem',
      'Nova mensagem',
      COALESCE(v_nome, 'Alguém') || ' enviou uma mensagem em "' || v_projeto.nome || '".',
      NEW.projeto_id,
      'projeto'
    );
  END IF;

  -- Notifica menções (@) — sempre
  IF NEW.mencionados IS NOT NULL AND array_length(NEW.mencionados, 1) > 0 THEN
    FOREACH v_mentioned IN ARRAY NEW.mencionados LOOP
      IF v_mentioned != NEW.sender_user_id THEN
        INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
        VALUES (v_mentioned, 'mensagem', 'Você foi mencionado',
          COALESCE(v_nome, 'Alguém') || ' mencionou você em "' || v_projeto.nome || '".',
          NEW.projeto_id, 'projeto');
      END IF;
    END LOOP;
  END IF;

  -- Notifica consultores aceitos APENAS se a mensagem for compartilhada
  IF NEW.escopo = 'compartilhado' THEN
    FOR v_p IN
      SELECT consultor_user_id FROM propostas
      WHERE projeto_id = NEW.projeto_id AND status = 'aceita' AND consultor_user_id != NEW.sender_user_id
    LOOP
      INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
      VALUES (v_p.consultor_user_id, 'mensagem', 'Nova mensagem',
        COALESCE(v_nome, 'Alguém') || ' enviou uma mensagem em "' || v_projeto.nome || '".',
        NEW.projeto_id, 'projeto');
    END LOOP;
  END IF;
  RETURN NEW;
END; $function$;