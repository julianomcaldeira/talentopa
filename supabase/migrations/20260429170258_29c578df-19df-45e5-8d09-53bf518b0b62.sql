REVOKE ALL ON FUNCTION public.can_user_message_project(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_user_send_project_message(uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_mensagem_bloqueada_pre_aprovacao(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.audit_blocked_message_attempt() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_user_message_project(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_send_project_message(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_mensagem_bloqueada_pre_aprovacao(uuid, uuid, text, text) TO authenticated;