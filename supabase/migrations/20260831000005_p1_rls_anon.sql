-- P1: restringir consultor_tem_vinculo_ativo para apenas authenticated (remover anon)
REVOKE ALL ON FUNCTION public.consultor_tem_vinculo_ativo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultor_tem_vinculo_ativo(uuid) TO authenticated, service_role;

-- Garantir que postgREST recarregue schema após revoke
SELECT pg_notify('pgrst', 'reload schema');
