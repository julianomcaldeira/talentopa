
CREATE OR REPLACE FUNCTION public.get_user_audit_logs(_target uuid)
RETURNS TABLE (
  id uuid,
  actor_user_id uuid,
  actor_role text,
  actor_nome text,
  categoria text,
  acao text,
  entidade text,
  descricao text,
  dados_novos jsonb,
  severidade text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_manage_user(_target, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para ver o histórico deste usuário';
  END IF;

  RETURN QUERY
    SELECT a.id, a.actor_user_id, a.actor_role, a.actor_nome, a.categoria, a.acao,
           a.entidade, a.descricao, a.dados_novos, a.severidade, a.created_at
      FROM public.audit_logs a
     WHERE a.entidade_id = _target
       AND a.categoria = 'usuario'
     ORDER BY a.created_at DESC
     LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_audit_logs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_audit_logs(uuid) TO authenticated, service_role;
