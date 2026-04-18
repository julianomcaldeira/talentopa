-- Add recipient column for 1-1 private messages
ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_mensagens_recipient ON public.mensagens(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_projeto_recipient ON public.mensagens(projeto_id, recipient_user_id);

-- Update SELECT policy: private messages visible only to sender, recipient and admins;
-- public (recipient null) visible to project participants as before.
DROP POLICY IF EXISTS "Messages viewable by project participants" ON public.mensagens;

CREATE POLICY "Messages viewable by project participants"
ON public.mensagens
FOR SELECT
TO authenticated
USING (
  -- Admin sees everything
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Private message: only sender or recipient
  (
    recipient_user_id IS NOT NULL
    AND (sender_user_id = auth.uid() OR recipient_user_id = auth.uid())
  )
  OR
  -- Public message in project: company owner, linked company users, or accepted consultants
  (
    recipient_user_id IS NULL
    AND (
      sender_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM projetos
        WHERE projetos.id = mensagens.projeto_id
          AND projetos.empresa_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM empresa_usuarios eu
        JOIN projetos p ON p.empresa_user_id = eu.empresa_user_id
        WHERE p.id = mensagens.projeto_id AND eu.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM propostas
        WHERE propostas.projeto_id = mensagens.projeto_id
          AND propostas.consultor_user_id = auth.uid()
      )
    )
  )
);

-- Update INSERT policy: allow sending private messages between project parties
DROP POLICY IF EXISTS "Participants can send messages" ON public.mensagens;

CREATE POLICY "Participants can send messages"
ON public.mensagens
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_user_id
  AND (
    -- Sender must be company owner, linked company user, or a consultant who sent a proposal
    EXISTS (
      SELECT 1 FROM projetos
      WHERE projetos.id = mensagens.projeto_id
        AND projetos.empresa_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN projetos p ON p.empresa_user_id = eu.empresa_user_id
      WHERE p.id = mensagens.projeto_id AND eu.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM propostas
      WHERE propostas.projeto_id = mensagens.projeto_id
        AND propostas.consultor_user_id = auth.uid()
    )
  )
  AND (
    -- If private, recipient must also belong to the project (company side or proposing consultant)
    recipient_user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projetos p
      WHERE p.id = mensagens.projeto_id
        AND (
          p.empresa_user_id = mensagens.recipient_user_id
          OR EXISTS (SELECT 1 FROM empresa_usuarios eu WHERE eu.empresa_user_id = p.empresa_user_id AND eu.user_id = mensagens.recipient_user_id)
          OR EXISTS (SELECT 1 FROM propostas pr WHERE pr.projeto_id = p.id AND pr.consultor_user_id = mensagens.recipient_user_id)
          -- Or recipient is a consultant in the platform that the company is reaching out to
          OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = mensagens.recipient_user_id AND ur.role = 'consultor')
        )
    )
  )
);

-- Notify recipient on private messages (in addition to existing public-message trigger logic)
CREATE OR REPLACE FUNCTION public.notify_mensagem_privada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_projeto RECORD; v_nome text;
BEGIN
  IF NEW.recipient_user_id IS NULL OR NEW.bloqueado = true THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_projeto FROM projetos WHERE id = NEW.projeto_id;
  SELECT nome INTO v_nome FROM profiles WHERE user_id = NEW.sender_user_id;
  INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    NEW.recipient_user_id,
    'mensagem',
    'Nova mensagem privada',
    COALESCE(v_nome, 'Alguém') || ' enviou uma mensagem privada sobre "' || COALESCE(v_projeto.nome,'projeto') || '".',
    NEW.projeto_id,
    'projeto'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notify_mensagem_privada_trg ON public.mensagens;
CREATE TRIGGER notify_mensagem_privada_trg
AFTER INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.notify_mensagem_privada();