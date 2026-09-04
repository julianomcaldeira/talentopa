-- CT-02/CT-03: is_empresa_team_member deve considerar apenas vínculos ativos
-- Sem isso, RMO inativado (ativo=false) ainda passa em RLS e continua operando

CREATE OR REPLACE FUNCTION public.is_empresa_team_member(_user_id uuid, _empresa_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = _empresa_user_id
    OR EXISTS (
      SELECT 1 FROM empresa_usuarios
      WHERE empresa_user_id = _empresa_user_id
        AND user_id = _user_id
        AND ativo = true
    );
$$;

-- Fallback para caso coluna ativo ainda não exista em algum ambiente (evita quebrar)
-- Se a coluna não existir, a função acima falhará; então garantir que a coluna existe antes é feito na migration 00007

SELECT pg_notify('pgrst', 'reload schema');
