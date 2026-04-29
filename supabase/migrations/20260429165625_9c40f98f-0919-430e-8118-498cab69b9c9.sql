CREATE OR REPLACE FUNCTION public.can_user_message_project(p_projeto_id uuid, p_user_id uuid DEFAULT auth.uid(), p_escopo text DEFAULT 'compartilhado')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN false
    WHEN public.has_role(p_user_id, 'admin'::public.app_role) THEN true
    WHEN p_escopo = 'interno_empresa' THEN EXISTS (
      SELECT 1
      FROM public.projetos p
      WHERE p.id = p_projeto_id
        AND public.is_empresa_team_member(p_user_id, p.empresa_user_id)
    )
    WHEN p_escopo = 'compartilhado' THEN (
      EXISTS (
        SELECT 1
        FROM public.projetos p
        WHERE p.id = p_projeto_id
          AND public.is_empresa_team_member(p_user_id, p.empresa_user_id)
          AND EXISTS (
            SELECT 1
            FROM public.propostas pr
            WHERE pr.projeto_id = p.id
              AND pr.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.propostas pr
        WHERE pr.projeto_id = p_projeto_id
          AND pr.consultor_user_id = p_user_id
          AND pr.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
      )
    )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.audit_blocked_message_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
BEGIN
  IF NEW.escopo = 'compartilhado'::text
     AND NOT public.can_user_message_project(NEW.projeto_id, NEW.sender_user_id, NEW.escopo) THEN
    v_reason := 'Conversa bloqueada: a troca de mensagens com consultores só é permitida após a pré-aprovação do projeto.';

    PERFORM public.log_audit_event(
      'comunicacao',
      'mensagem_bloqueada_pre_aprovacao',
      'mensagens',
      NEW.projeto_id,
      v_reason,
      NULL,
      jsonb_build_object(
        'projeto_id', NEW.projeto_id,
        'sender_user_id', NEW.sender_user_id,
        'recipient_user_id', NEW.recipient_user_id,
        'escopo', NEW.escopo,
        'motivo', v_reason
      ),
      'warning'
    );

    RAISE EXCEPTION '%', v_reason;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_blocked_message_attempt_trg ON public.mensagens;
CREATE TRIGGER audit_blocked_message_attempt_trg
BEFORE INSERT ON public.mensagens
FOR EACH ROW
EXECUTE FUNCTION public.audit_blocked_message_attempt();

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT polname
    FROM pg_policy
    WHERE polrelid = 'public.mensagens'::regclass
      AND polcmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.mensagens', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "Admins see all messages"
ON public.mensagens
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Empresa team sees project messages"
ON public.mensagens
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projetos p
    WHERE p.id = mensagens.projeto_id
      AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
  )
);

CREATE POLICY "Consultants see messages after pre approval"
ON public.mensagens
FOR SELECT
USING (
  escopo = 'compartilhado'::text
  AND EXISTS (
    SELECT 1
    FROM public.propostas pr
    WHERE pr.projeto_id = mensagens.projeto_id
      AND pr.consultor_user_id = auth.uid()
      AND pr.status IN ('pre_aprovada'::public.status_proposta, 'aguardando_consultor'::public.status_proposta, 'aceita'::public.status_proposta)
  )
);

CREATE POLICY "Participants see direct messages after pre approval"
ON public.mensagens
FOR SELECT
USING (
  recipient_user_id IS NOT NULL
  AND (sender_user_id = auth.uid() OR recipient_user_id = auth.uid())
  AND public.can_user_message_project(mensagens.projeto_id, auth.uid(), 'compartilhado')
);

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT polname
    FROM pg_policy
    WHERE polrelid = 'public.mensagens'::regclass
      AND polcmd = 'a'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.mensagens', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "Users insert messages only when conversation is open"
ON public.mensagens
FOR INSERT
WITH CHECK (
  sender_user_id = auth.uid()
  AND public.can_user_message_project(projeto_id, auth.uid(), escopo)
);

REVOKE ALL ON FUNCTION public.can_user_message_project(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_user_message_project(uuid, uuid, text) TO authenticated;