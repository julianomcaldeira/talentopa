CREATE TABLE IF NOT EXISTS public.mensagem_tentativas_bloqueadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  recipient_user_id uuid NULL,
  escopo text NOT NULL DEFAULT 'compartilhado',
  motivo text NOT NULL,
  status text NOT NULL DEFAULT 'auditada',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.mensagem_tentativas_bloqueadas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mensagem_tentativas_bloqueadas_projeto_created
ON public.mensagem_tentativas_bloqueadas (projeto_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mensagem_tentativas_bloqueadas_sender_created
ON public.mensagem_tentativas_bloqueadas (sender_user_id, created_at DESC);

DROP POLICY IF EXISTS "Admins view blocked message attempts" ON public.mensagem_tentativas_bloqueadas;
CREATE POLICY "Admins view blocked message attempts"
ON public.mensagem_tentativas_bloqueadas
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Company team view blocked attempts on own projects" ON public.mensagem_tentativas_bloqueadas;
CREATE POLICY "Company team view blocked attempts on own projects"
ON public.mensagem_tentativas_bloqueadas
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projetos p
    WHERE p.id = mensagem_tentativas_bloqueadas.projeto_id
      AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
  )
);

DROP POLICY IF EXISTS "Users view own blocked message attempts" ON public.mensagem_tentativas_bloqueadas;
CREATE POLICY "Users view own blocked message attempts"
ON public.mensagem_tentativas_bloqueadas
FOR SELECT
USING (sender_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.registrar_mensagem_bloqueada_pre_aprovacao(
  p_projeto_id uuid,
  p_recipient_user_id uuid DEFAULT NULL,
  p_escopo text DEFAULT 'compartilhado',
  p_motivo text DEFAULT 'Conversa bloqueada: a troca de mensagens com consultores só é permitida após a pré-aprovação do projeto.'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF public.can_user_send_project_message(p_projeto_id, v_user, p_recipient_user_id, p_escopo) THEN
    RAISE EXCEPTION 'A conversa já está liberada para este projeto.';
  END IF;

  INSERT INTO public.mensagem_tentativas_bloqueadas (
    projeto_id,
    sender_user_id,
    recipient_user_id,
    escopo,
    motivo
  ) VALUES (
    p_projeto_id,
    v_user,
    p_recipient_user_id,
    COALESCE(NULLIF(p_escopo, ''), 'compartilhado'),
    COALESCE(NULLIF(p_motivo, ''), 'Conversa bloqueada antes da pré-aprovação.')
  )
  RETURNING id INTO v_id;

  PERFORM public.log_audit_event(
    'comunicacao',
    'tentativa_mensagem_antes_pre_aprovacao',
    'mensagem_tentativas_bloqueadas',
    v_id,
    COALESCE(NULLIF(p_motivo, ''), 'Conversa bloqueada antes da pré-aprovação.'),
    NULL,
    jsonb_build_object(
      'projeto_id', p_projeto_id,
      'sender_user_id', v_user,
      'recipient_user_id', p_recipient_user_id,
      'escopo', p_escopo
    ),
    'warning'
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_blocked_message_attempt() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_mensagem_bloqueada_pre_aprovacao(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_mensagem_bloqueada_pre_aprovacao(uuid, uuid, text, text) TO authenticated;