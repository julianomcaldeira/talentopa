ALTER TABLE public.mensagem_tentativas_bloqueadas
ADD COLUMN IF NOT EXISTS revisado_por uuid,
ADD COLUMN IF NOT EXISTS revisado_em timestamp with time zone,
ADD COLUMN IF NOT EXISTS observacao_revisao text;

CREATE INDEX IF NOT EXISTS idx_mensagem_tentativas_bloqueadas_status_created
ON public.mensagem_tentativas_bloqueadas (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_aprovar_tentativa_mensagem_bloqueada(
  p_tentativa_id uuid,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tentativa public.mensagem_tentativas_bloqueadas%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar tentativas bloqueadas';
  END IF;

  SELECT * INTO v_tentativa
  FROM public.mensagem_tentativas_bloqueadas
  WHERE id = p_tentativa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tentativa bloqueada não encontrada';
  END IF;

  IF v_tentativa.status = 'aprovada' THEN
    RAISE EXCEPTION 'Esta tentativa já foi aprovada';
  END IF;

  UPDATE public.mensagem_tentativas_bloqueadas
  SET status = 'aprovada',
      revisado_por = auth.uid(),
      revisado_em = now(),
      observacao_revisao = COALESCE(NULLIF(p_observacao, ''), 'Aprovada manualmente pelo administrador')
  WHERE id = p_tentativa_id;

  PERFORM public.log_audit_event(
    'comunicacao',
    'tentativa_mensagem_aprovada_manual',
    'mensagem_tentativas_bloqueadas',
    p_tentativa_id,
    COALESCE(NULLIF(p_observacao, ''), 'Tentativa de mensagem aprovada manualmente pelo administrador'),
    to_jsonb(v_tentativa),
    jsonb_build_object(
      'status', 'aprovada',
      'revisado_por', auth.uid(),
      'revisado_em', now(),
      'observacao', COALESCE(NULLIF(p_observacao, ''), 'Aprovada manualmente pelo administrador')
    ),
    'info'
  );

  RETURN jsonb_build_object('success', true, 'tentativa_id', p_tentativa_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_aprovar_tentativa_mensagem_bloqueada(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_aprovar_tentativa_mensagem_bloqueada(uuid, text) TO authenticated;