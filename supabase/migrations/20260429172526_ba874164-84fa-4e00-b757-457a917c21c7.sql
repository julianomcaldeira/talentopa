REVOKE ALL ON FUNCTION public.registrar_anexo_chat_enviado() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_anexo_chat_enviado() FROM anon;
REVOKE ALL ON FUNCTION public.registrar_anexo_chat_enviado() FROM authenticated;

REVOKE ALL ON FUNCTION public.registrar_anexos_liberados_pre_aprovacao() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_anexos_liberados_pre_aprovacao() FROM anon;
REVOKE ALL ON FUNCTION public.registrar_anexos_liberados_pre_aprovacao() FROM authenticated;