-- ============================================================
-- BLOCO A - TRANSACAO 1: Onda 0 consolidada + CT-17 enums/colunas
-- ============================================================
BEGIN;

-- =====================================================================
-- ONDA 0 - Consolidada (12 migrations pendentes em 1 arquivo)
-- =====================================================================
-- Consolidacao das migrations 20260826000001 ... 20260831000012 na
-- ordem de timestamp, num unico arquivo. Substitui o lote pendente que
-- o db push do Lovable falhou em aplicar calado.
--
-- SEGURANCA:
-- * Roda como UMA transacao unica (BEGIN/COMMIT). DDL e transacional
--   no Postgres (MVCC): sessoes logadas continuam vendo o estado
--   antigo ate o COMMIT, entao NAO ha janela sem policy/view/constraint
--   durante os DROP + recriacao. Se qualquer statement falhar, o lote
--   inteiro e revertido.
-- * Idempotente por pacote: todos os DDL destrutivos foram blindados
--   (DROP POLICY/VIEW/TRIGGER/INDEX IF EXISTS antes de recriar), de
--   forma que rodar junto com os 12 arquivos antigos (ou re-rodar no
--   futuro) nao gera conflito de objetos duplicados.
-- * Prerequisitos conferidos no repo: has_role, log_audit_event,
--   consultor_tem_vinculo_ativo(uuid), uq_canal_consultor_ativo,
--   enum papel_empresa_usuario com rmo/coordenador, trigger
--   on_auth_user_created -> handle_new_user.
-- =====================================================================


-- [01/12] Fix RMO/equipe vinculado como consultor caindo em /consultor ao inves de /empresa
-- 1) RPC para vincular membro à empresa garantindo role 'empresa' (SECURITY DEFINER)
--    Permite que dono da empresa vincule qualquer usuário já cadastrado (find_user_id_by_email)
--    e garante que ele ganhe role empresa mesmo se foi cadastrado como consultor.

CREATE OR REPLACE FUNCTION public.empresa_add_membro(
  _target uuid,
  _papel text,
  _empresa_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_owner boolean;
  v_is_admin boolean;
  v_is_membro_gestor boolean;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF _target IS NULL OR _empresa_user_id IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes';
  END IF;
  IF _papel NOT IN ('rmo','coordenador','responsavel','financeiro','operacional') THEN
    RAISE EXCEPTION 'Papel inválido: %', _papel;
  END IF;

  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  -- permite que RMO/coordenador/responsavel da mesma empresa também adicionem membros
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.user_id = v_actor
      AND eu.empresa_user_id = _empresa_user_id
      AND eu.papel IN ('rmo','coordenador','responsavel')
  ) INTO v_is_membro_gestor;

  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN
    RAISE EXCEPTION 'Sem permissão para adicionar membros a esta empresa';
  END IF;

  -- garantir que alvo existe em profiles
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _target) THEN
    RAISE EXCEPTION 'Usuário alvo não encontrado';
  END IF;

  -- garantir role empresa (mantém outras roles, mas adiciona empresa)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target, 'empresa'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- upsert vínculo
  IF EXISTS (SELECT 1 FROM public.empresa_usuarios WHERE user_id = _target) THEN
    UPDATE public.empresa_usuarios
       SET empresa_user_id = _empresa_user_id,
           papel = _papel::public.papel_empresa_usuario,
           updated_at = now()
     WHERE user_id = _target;
  ELSE
    INSERT INTO public.empresa_usuarios (empresa_user_id, user_id, papel)
    VALUES (_empresa_user_id, _target, _papel::public.papel_empresa_usuario);
  END IF;

  PERFORM public.log_audit_event(
    'empresa','vinculo_membro','empresa_usuarios', _target,
    'Membro vinculado à empresa ' || _empresa_user_id::text || ' como ' || _papel,
    NULL,
    jsonb_build_object('papel',_papel,'empresa_user_id',_empresa_user_id,'target',_target,'actor',v_actor),
    'info'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.empresa_add_membro(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_add_membro(uuid,text,uuid) TO authenticated, service_role;

-- 2) Corrigir política de empresa_usuarios para permitir que membros gestores (rmo/coordenador/responsavel)
--    também insiram/removam membros da mesma empresa (além do dono)
--    (DROP da policy antiga + DROP da nova: garante idempotencia se os 12 arquivos antigos rodaram antes)

DROP POLICY IF EXISTS "Empresa owner manages own links" ON public.empresa_usuarios;
DROP POLICY IF EXISTS "Empresa gestores manage links" ON public.empresa_usuarios;

CREATE POLICY "Empresa gestores manage links"
ON public.empresa_usuarios
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR auth.uid() = empresa_user_id
  OR EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.user_id = auth.uid()
      AND eu.empresa_user_id = empresa_usuarios.empresa_user_id
      AND eu.papel IN ('rmo','coordenador','responsavel')
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR auth.uid() = empresa_user_id
  OR EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.user_id = auth.uid()
      AND eu.empresa_user_id = empresa_usuarios.empresa_user_id
      AND eu.papel IN ('rmo','coordenador','responsavel')
  )
);

-- 3) Backfill: quem já está em empresa_usuarios mas não tem role empresa, ganha role empresa
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT eu.user_id, 'empresa'::public.app_role
FROM public.empresa_usuarios eu
LEFT JOIN public.user_roles ur ON ur.user_id = eu.user_id AND ur.role = 'empresa'::public.app_role
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- [02/12] Suporte a cadastro tipo "equipe" (RMO/Coordenador vinculado) sem criar empresa_perfil/consultor_perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_nome text;
  v_created_by uuid;
  v_raw_tipo text;
  v_is_equipe boolean := false;
BEGIN
  v_nome := COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email);
  v_raw_tipo := COALESCE(NEW.raw_user_meta_data ->> 'tipo_usuario', '');
  v_is_equipe := (v_raw_tipo = 'equipe');

  IF v_is_equipe THEN
    v_role := 'empresa'::public.app_role;
  ELSIF v_raw_tipo IN ('admin', 'consultor', 'empresa', 'canal') THEN
    v_role := v_raw_tipo::public.app_role;
  ELSE
    v_role := 'consultor'::public.app_role;
  END IF;

  BEGIN
    v_created_by := NULLIF(NEW.raw_user_meta_data ->> 'created_by','')::uuid;
  EXCEPTION WHEN others THEN
    v_created_by := NULL;
  END;

  INSERT INTO public.profiles (user_id, nome, email, telefone, created_by)
  VALUES (
    NEW.id,
    v_nome,
    NEW.email,
    NEW.raw_user_meta_data ->> 'telefone',
    v_created_by
  )
  ON CONFLICT (user_id) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    telefone = COALESCE(EXCLUDED.telefone, public.profiles.telefone),
    created_by = COALESCE(public.profiles.created_by, EXCLUDED.created_by),
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- equipe não cria perfil específico; vínculo será feito via empresa_add_membro
  IF v_is_equipe THEN
    -- nada: evita criar consultor_perfil/empresa_perfil/canal
    NULL;
  ELSIF v_role = 'consultor'::public.app_role THEN
    INSERT INTO public.consultor_perfil (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF v_role = 'empresa'::public.app_role THEN
    INSERT INTO public.empresa_perfil (user_id, razao_social, cnpj, nome_fantasia, endereco, segmento)
    VALUES (
      NEW.id, v_nome,
      NEW.raw_user_meta_data ->> 'cnpj',
      NEW.raw_user_meta_data ->> 'nome_fantasia',
      NEW.raw_user_meta_data ->> 'endereco',
      NEW.raw_user_meta_data ->> 'segmento'
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF v_role = 'canal'::public.app_role THEN
    INSERT INTO public.canais (user_id, nome, cnpj, responsavel_nome, email_contato, telefone, status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'nome_fantasia', v_nome),
      NEW.raw_user_meta_data ->> 'cnpj',
      COALESCE(NEW.raw_user_meta_data ->> 'contato_nome', v_nome),
      NEW.email,
      NEW.raw_user_meta_data ->> 'telefone',
      'pendente'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      nome = EXCLUDED.nome,
      cnpj = COALESCE(EXCLUDED.cnpj, public.canais.cnpj),
      responsavel_nome = COALESCE(EXCLUDED.responsavel_nome, public.canais.responsavel_nome),
      email_contato = EXCLUDED.email_contato,
      telefone = COALESCE(EXCLUDED.telefone, public.canais.telefone),
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$function$;

-- [03/12] Reaplicar empresa_add_membro para garantir que Lovable/Supabase atualize o schema cache
-- (o push anterior coincidiu com 521, então PostgREST não viu a função)
SELECT pg_notify('pgrst', 'reload schema');

-- Garante que a função existe mesmo se a migration anterior não rodou
CREATE OR REPLACE FUNCTION public.empresa_add_membro(
  _target uuid,
  _papel text,
  _empresa_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_owner boolean;
  v_is_admin boolean;
  v_is_membro_gestor boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _target IS NULL OR _empresa_user_id IS NULL THEN RAISE EXCEPTION 'Parâmetros obrigatórios ausentes'; END IF;
  IF _papel NOT IN ('rmo','coordenador','responsavel','financeiro','operacional') THEN RAISE EXCEPTION 'Papel inválido: %', _papel; END IF;
  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  SELECT EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.user_id = v_actor AND eu.empresa_user_id = _empresa_user_id AND eu.papel IN ('rmo','coordenador','responsavel')) INTO v_is_membro_gestor;
  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN RAISE EXCEPTION 'Sem permissão para adicionar membros a esta empresa'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _target) THEN RAISE EXCEPTION 'Usuário alvo não encontrado'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'empresa'::public.app_role) ON CONFLICT (user_id, role) DO NOTHING;
  IF EXISTS (SELECT 1 FROM public.empresa_usuarios WHERE user_id = _target) THEN
    UPDATE public.empresa_usuarios SET empresa_user_id = _empresa_user_id, papel = _papel::public.papel_empresa_usuario, updated_at = now() WHERE user_id = _target;
  ELSE
    INSERT INTO public.empresa_usuarios (empresa_user_id, user_id, papel) VALUES (_empresa_user_id, _target, _papel::public.papel_empresa_usuario);
  END IF;
  PERFORM public.log_audit_event('empresa','vinculo_membro','empresa_usuarios', _target, 'Membro vinculado à empresa ' || _empresa_user_id::text || ' como ' || _papel, NULL, jsonb_build_object('papel',_papel,'empresa_user_id',_empresa_user_id,'target',_target,'actor',v_actor), 'info');
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_add_membro(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_add_membro(uuid,text,uuid) TO authenticated, service_role;
SELECT pg_notify('pgrst', 'reload schema');

-- [04/12] Fix UNIQUE empresa_usuarios: 1 vínculo por user_id (evita duplicatas com papéis diferentes)
-- e corrige empresa_add_membro para atualizar por user_id (não por tripla)

-- 1) Limpar duplicatas: manter apenas o vínculo mais recente por user_id
DELETE FROM public.empresa_usuarios
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.empresa_usuarios
  ORDER BY user_id, updated_at DESC
);

-- 2) Dropar constraint antiga (empresa_user_id, user_id, papel) se existir
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.empresa_usuarios'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 3;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.empresa_usuarios DROP CONSTRAINT %I', cname);
  END IF;
END $$;

-- Dropar índices únicos antigos que podem ter sido criados implícitamente
DROP INDEX IF EXISTS public.empresa_usuarios_empresa_user_id_user_id_papel_key;
DROP INDEX IF EXISTS public.empresa_usuarios_empresa_user_id_user_id_key;

-- 3) Criar UNIQUE correta em user_id (um usuário só pode estar em uma empresa por vez)
CREATE UNIQUE INDEX IF NOT EXISTS uq_empresa_usuarios_user_id ON public.empresa_usuarios(user_id);

-- 4) Recriar empresa_add_membro corretamente (upsert por user_id, com fallback user_roles)
CREATE OR REPLACE FUNCTION public.empresa_add_membro(
  _target uuid,
  _papel text,
  _empresa_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_owner boolean;
  v_is_admin boolean;
  v_is_membro_gestor boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _target IS NULL OR _empresa_user_id IS NULL THEN RAISE EXCEPTION 'Parâmetros obrigatórios ausentes'; END IF;
  IF _papel NOT IN ('rmo','coordenador','responsavel','financeiro','operacional') THEN RAISE EXCEPTION 'Papel inválido: %', _papel; END IF;
  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  SELECT EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.user_id = v_actor AND eu.empresa_user_id = _empresa_user_id AND eu.papel IN ('rmo','coordenador','responsavel')) INTO v_is_membro_gestor;
  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN RAISE EXCEPTION 'Sem permissão para adicionar membros a esta empresa'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _target) THEN RAISE EXCEPTION 'Usuário alvo não encontrado'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'empresa'::public.app_role) ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.empresa_usuarios (empresa_user_id, user_id, papel)
  VALUES (_empresa_user_id, _target, _papel::public.papel_empresa_usuario)
  ON CONFLICT (user_id) DO UPDATE SET empresa_user_id = EXCLUDED.empresa_user_id, papel = EXCLUDED.papel, updated_at = now();
  PERFORM public.log_audit_event('empresa','vinculo_membro','empresa_usuarios', _target, 'Membro vinculado à empresa ' || _empresa_user_id::text || ' como ' || _papel, NULL, jsonb_build_object('papel',_papel,'empresa_user_id',_empresa_user_id,'target',_target,'actor',v_actor), 'info');
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_add_membro(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_add_membro(uuid,text,uuid) TO authenticated, service_role;

-- Garantir backfill de role empresa para quem já está vinculado
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT eu.user_id, 'empresa'::public.app_role
FROM public.empresa_usuarios eu
LEFT JOIN public.user_roles ur ON ur.user_id = eu.user_id AND ur.role = 'empresa'::public.app_role
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

SELECT pg_notify('pgrst', 'reload schema');

-- [05/12] P1: restringir consultor_tem_vinculo_ativo para apenas authenticated (remover anon)
REVOKE ALL ON FUNCTION public.consultor_tem_vinculo_ativo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultor_tem_vinculo_ativo(uuid) TO authenticated, service_role;

-- Garantir que postgREST recarregue schema após revoke
SELECT pg_notify('pgrst', 'reload schema');

-- [06/12] Fix: ao remover RMO/equipe, revogar role empresa se não tiver mais vínculo e não for dono
-- e limpar vínculos órfãos quando auth.users é deletado

-- 1) RPC para empresa remover membro (usada por EmpresaCoordenadores)
CREATE OR REPLACE FUNCTION public.empresa_remove_membro(
  _target uuid,
  _empresa_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_owner boolean;
  v_is_admin boolean;
  v_is_membro_gestor boolean;
  v_has_perfil boolean;
  v_remaining int;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _target IS NULL OR _empresa_user_id IS NULL THEN RAISE EXCEPTION 'Parâmetros obrigatórios ausentes'; END IF;

  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.user_id = v_actor AND eu.empresa_user_id = _empresa_user_id AND eu.papel IN ('rmo','coordenador','responsavel')
  ) INTO v_is_membro_gestor;

  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN
    RAISE EXCEPTION 'Sem permissão para remover membros desta empresa';
  END IF;

  -- remover vínculo específico
  DELETE FROM public.empresa_usuarios
  WHERE user_id = _target AND empresa_user_id = _empresa_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vínculo não encontrado';
  END IF;

  -- se não tem mais nenhum vínculo, e não é dono (sem empresa_perfil), revogar role empresa
  SELECT COUNT(*) INTO v_remaining FROM public.empresa_usuarios WHERE user_id = _target;
  IF v_remaining = 0 THEN
    SELECT EXISTS (SELECT 1 FROM public.empresa_perfil WHERE user_id = _target) INTO v_has_perfil;
    IF NOT v_has_perfil THEN
      DELETE FROM public.user_roles WHERE user_id = _target AND role = 'empresa'::public.app_role;
    END IF;
  END IF;

  PERFORM public.log_audit_event('empresa','remocao_membro','empresa_usuarios', _target,
    'Membro removido da empresa ' || _empresa_user_id::text,
    NULL, jsonb_build_object('target',_target,'empresa_user_id',_empresa_user_id,'actor',v_actor), 'warning');

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_remove_membro(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_remove_membro(uuid,uuid) TO authenticated, service_role;

-- 2) Trigger: quando auth.users é deletado, limpar vínculos órfãos e roles
CREATE OR REPLACE FUNCTION public.cleanup_empresa_usuarios_on_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.empresa_usuarios WHERE user_id = OLD.id;
  -- roles são cascade via profiles? mas garantir limpeza se ficar órfão
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_empresa_usuarios_on_auth_delete ON auth.users;
CREATE TRIGGER trg_cleanup_empresa_usuarios_on_auth_delete
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_empresa_usuarios_on_user_delete();

SELECT pg_notify('pgrst', 'reload schema');

-- [07/12] Inativar RMO/equipe sem excluir (preserva histórico/demandas vinculadas à empresa)
-- Demanda: Empresa precisa revogar acesso do RMO mas manter projetos/demandas criados por ele (empresa_user_id = dono)

-- 1) Adicionar soft-delete em empresa_usuarios
ALTER TABLE public.empresa_usuarios
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inativado_em timestamptz,
  ADD COLUMN IF NOT EXISTS inativado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_empresa_usuarios_ativo ON public.empresa_usuarios(ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_empresa_usuarios_user_ativo ON public.empresa_usuarios(user_id) WHERE ativo = true;

-- Backfill: já existentes são ativos
UPDATE public.empresa_usuarios SET ativo = true WHERE ativo IS NULL;

-- 2) RPC para inativar (revoga acesso, preserva linha e histórico)
CREATE OR REPLACE FUNCTION public.empresa_inativar_membro(
  _target uuid,
  _empresa_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_owner boolean;
  v_is_admin boolean;
  v_is_membro_gestor boolean;
  v_has_perfil boolean;
  v_remaining int;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _target IS NULL OR _empresa_user_id IS NULL THEN RAISE EXCEPTION 'Parâmetros obrigatórios ausentes'; END IF;

  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.user_id = v_actor AND eu.empresa_user_id = _empresa_user_id AND eu.papel IN ('rmo','coordenador','responsavel') AND eu.ativo = true
  ) INTO v_is_membro_gestor;

  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN
    RAISE EXCEPTION 'Sem permissão para inativar membros desta empresa';
  END IF;

  UPDATE public.empresa_usuarios
     SET ativo = false,
         inativado_em = now(),
         inativado_por = v_actor,
         updated_at = now()
   WHERE user_id = _target AND empresa_user_id = _empresa_user_id AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vínculo ativo não encontrado';
  END IF;

  -- se não tem mais nenhum vínculo ATIVO e não é dono (sem empresa_perfil), revogar role empresa
  SELECT COUNT(*) INTO v_remaining FROM public.empresa_usuarios WHERE user_id = _target AND ativo = true;
  IF v_remaining = 0 THEN
    SELECT EXISTS (SELECT 1 FROM public.empresa_perfil WHERE user_id = _target) INTO v_has_perfil;
    IF NOT v_has_perfil THEN
      DELETE FROM public.user_roles WHERE user_id = _target AND role = 'empresa'::public.app_role;
    END IF;
  END IF;

  PERFORM public.log_audit_event('empresa','inativacao_membro','empresa_usuarios', _target,
    'Membro inativado na empresa ' || _empresa_user_id::text,
    NULL, jsonb_build_object('target',_target,'empresa_user_id',_empresa_user_id,'actor',v_actor), 'warning');

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_inativar_membro(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_inativar_membro(uuid,uuid) TO authenticated, service_role;

-- 3) RPC para reativar
CREATE OR REPLACE FUNCTION public.empresa_reativar_membro(
  _target uuid,
  _empresa_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_owner boolean;
  v_is_admin boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  IF NOT (v_is_owner OR v_is_admin) THEN RAISE EXCEPTION 'Sem permissão para reativar'; END IF;

  UPDATE public.empresa_usuarios
     SET ativo = true,
         inativado_em = NULL,
         inativado_por = NULL,
         updated_at = now()
   WHERE user_id = _target AND empresa_user_id = _empresa_user_id AND ativo = false;

  IF NOT FOUND THEN RAISE EXCEPTION 'Vínculo inativo não encontrado'; END IF;

  -- garantir role empresa de volta
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'empresa'::public.app_role) ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM public.log_audit_event('empresa','reativacao_membro','empresa_usuarios', _target,
    'Membro reativado na empresa ' || _empresa_user_id::text,
    NULL, jsonb_build_object('target',_target,'empresa_user_id',_empresa_user_id,'actor',v_actor), 'info');

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_reativar_membro(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_reativar_membro(uuid,uuid) TO authenticated, service_role;

-- 4) Ajustar empresa_add_membro para reativar se já existe inativo
CREATE OR REPLACE FUNCTION public.empresa_add_membro(
  _target uuid,
  _papel text,
  _empresa_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_owner boolean;
  v_is_admin boolean;
  v_is_membro_gestor boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _target IS NULL OR _empresa_user_id IS NULL THEN RAISE EXCEPTION 'Parâmetros obrigatórios ausentes'; END IF;
  IF _papel NOT IN ('rmo','coordenador','responsavel','financeiro','operacional') THEN RAISE EXCEPTION 'Papel inválido: %', _papel; END IF;
  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  SELECT EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.user_id = v_actor AND eu.empresa_user_id = _empresa_user_id AND eu.papel IN ('rmo','coordenador','responsavel') AND eu.ativo = true) INTO v_is_membro_gestor;
  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN RAISE EXCEPTION 'Sem permissão para adicionar membros a esta empresa'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _target) THEN RAISE EXCEPTION 'Usuário alvo não encontrado'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'empresa'::public.app_role) ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.empresa_usuarios (empresa_user_id, user_id, papel, ativo)
  VALUES (_empresa_user_id, _target, _papel::public.papel_empresa_usuario, true)
  ON CONFLICT (user_id) DO UPDATE SET empresa_user_id = EXCLUDED.empresa_user_id, papel = EXCLUDED.papel, ativo = true, inativado_em = NULL, inativado_por = NULL, updated_at = now();
  PERFORM public.log_audit_event('empresa','vinculo_membro','empresa_usuarios', _target, 'Membro vinculado à empresa ' || _empresa_user_id::text || ' como ' || _papel, NULL, jsonb_build_object('papel',_papel,'empresa_user_id',_empresa_user_id,'target',_target,'actor',v_actor), 'info');
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_add_membro(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_add_membro(uuid,text,uuid) TO authenticated, service_role;

-- 5) Ajustar empresa_remove_membro (hard delete) para considerar apenas ativo
CREATE OR REPLACE FUNCTION public.empresa_remove_membro(
  _target uuid,
  _empresa_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_owner boolean;
  v_is_admin boolean;
  v_is_membro_gestor boolean;
  v_has_perfil boolean;
  v_remaining int;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _target IS NULL OR _empresa_user_id IS NULL THEN RAISE EXCEPTION 'Parâmetros obrigatórios ausentes'; END IF;
  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  SELECT EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.user_id = v_actor AND eu.empresa_user_id = _empresa_user_id AND eu.papel IN ('rmo','coordenador','responsavel') AND eu.ativo = true) INTO v_is_membro_gestor;
  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN RAISE EXCEPTION 'Sem permissão para remover membros desta empresa'; END IF;
  DELETE FROM public.empresa_usuarios WHERE user_id = _target AND empresa_user_id = _empresa_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vínculo não encontrado'; END IF;
  SELECT COUNT(*) INTO v_remaining FROM public.empresa_usuarios WHERE user_id = _target AND ativo = true;
  IF v_remaining = 0 THEN
    SELECT EXISTS (SELECT 1 FROM public.empresa_perfil WHERE user_id = _target) INTO v_has_perfil;
    IF NOT v_has_perfil THEN DELETE FROM public.user_roles WHERE user_id = _target AND role = 'empresa'::public.app_role; END IF;
  END IF;
  PERFORM public.log_audit_event('empresa','remocao_membro','empresa_usuarios', _target, 'Membro removido da empresa ' || _empresa_user_id::text, NULL, jsonb_build_object('target',_target,'empresa_user_id',_empresa_user_id,'actor',v_actor), 'warning');
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_remove_membro(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_remove_membro(uuid,uuid) TO authenticated, service_role;

SELECT pg_notify('pgrst', 'reload schema');

-- [08/12] Limpeza de RMO removido que continua como empresa (falha de revogação quando fallback foi usado)
-- Remove role empresa órfã de usuários sem vínculo ativo e sem empresa_perfil
DELETE FROM public.user_roles
WHERE role = 'empresa'::public.app_role
  AND user_id IN (
    SELECT ur.user_id FROM public.user_roles ur
    LEFT JOIN public.empresa_usuarios eu ON eu.user_id = ur.user_id AND eu.ativo = true
    LEFT JOIN public.empresa_perfil ep ON ep.user_id = ur.user_id
    WHERE ur.role = 'empresa'::public.app_role
      AND eu.user_id IS NULL
      AND ep.user_id IS NULL
  );

-- Caso coluna ativo ainda não exista em alguns ambientes (fallback), garantir limpeza legacy
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='empresa_usuarios' AND column_name='ativo') THEN
    DELETE FROM public.user_roles
    WHERE role = 'empresa'::public.app_role
      AND user_id IN (
        SELECT ur.user_id FROM public.user_roles ur
        LEFT JOIN public.empresa_usuarios eu2 ON eu2.user_id = ur.user_id
        LEFT JOIN public.empresa_perfil ep2 ON ep2.user_id = ur.user_id
        WHERE ur.role = 'empresa'::public.app_role AND eu2.user_id IS NULL AND ep2.user_id IS NULL
      );
  END IF;
END $$;

SELECT pg_notify('pgrst', 'reload schema');

-- [09/12] Fix: nome exibido como empresa e auto-convite de si mesmo como RMO

-- 1) Bloquear auto-convite no backend também
CREATE OR REPLACE FUNCTION public.empresa_add_membro(
  _target uuid,
  _papel text,
  _empresa_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_owner boolean;
  v_is_admin boolean;
  v_is_membro_gestor boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _target IS NULL OR _empresa_user_id IS NULL THEN RAISE EXCEPTION 'Parâmetros obrigatórios ausentes'; END IF;
  IF _target = v_actor THEN RAISE EXCEPTION 'Você não pode convidar a si mesmo'; END IF;
  IF _target = _empresa_user_id THEN RAISE EXCEPTION 'Você não pode convidar a si mesmo'; END IF;
  IF _papel NOT IN ('rmo','coordenador','responsavel','financeiro','operacional') THEN RAISE EXCEPTION 'Papel inválido: %', _papel; END IF;
  v_is_owner := (v_actor = _empresa_user_id);
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  SELECT EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.user_id = v_actor AND eu.empresa_user_id = _empresa_user_id AND eu.papel IN ('rmo','coordenador','responsavel') AND eu.ativo = true) INTO v_is_membro_gestor;
  -- se o actor não tem vínculo ativo nem é dono, bloquear (evita login sem papel convidar a si mesmo)
  IF NOT (v_is_owner OR v_is_admin OR v_is_membro_gestor) THEN
    -- também checar se actor é dono via empresa_perfil (para equipe sem vínculo mas que é dono)
    IF NOT EXISTS (SELECT 1 FROM public.empresa_perfil WHERE user_id = v_actor) THEN
      RAISE EXCEPTION 'Sem permissão para adicionar membros a esta empresa';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _target) THEN RAISE EXCEPTION 'Usuário alvo não encontrado'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'empresa'::public.app_role) ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.empresa_usuarios (empresa_user_id, user_id, papel, ativo)
  VALUES (_empresa_user_id, _target, _papel::public.papel_empresa_usuario, true)
  ON CONFLICT (user_id) DO UPDATE SET empresa_user_id = EXCLUDED.empresa_user_id, papel = EXCLUDED.papel, ativo = true, inativado_em = NULL, inativado_por = NULL, updated_at = now();
  PERFORM public.log_audit_event('empresa','vinculo_membro','empresa_usuarios', _target, 'Membro vinculado à empresa ' || _empresa_user_id::text || ' como ' || _papel, NULL, jsonb_build_object('papel',_papel,'empresa_user_id',_empresa_user_id,'target',_target,'actor',v_actor), 'info');
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.empresa_add_membro(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_add_membro(uuid,text,uuid) TO authenticated, service_role;

-- 2) Limpar auto-vínculos já existentes (empresa_user_id = user_id)
DELETE FROM public.empresa_usuarios WHERE empresa_user_id = user_id;

-- 3) Corrigir profiles onde nome = razão social mas deveria ser nome da pessoa
-- Para usuários que são membros equipe mas têm empresa_perfil? Não — apenas limpar auto-vínculos já resolve exibição.
-- Garantir que profiles de equipe mostrem email quando nome é igual à empresa: não fazer update automático, apenas garantir fallback no frontend.

SELECT pg_notify('pgrst', 'reload schema');

-- [10/12] Fix public views com RLS restritivo (security_invoker) que impedia Empresa ver nome de consultor e Canal nome
-- Recriar views como SECURITY DEFINER para expor apenas campos públicos

DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker=off) AS
SELECT user_id, nome, avatar_url, cidade, estado, status, created_at, email
FROM public.profiles;

DROP VIEW IF EXISTS public.canais_public;
CREATE VIEW public.canais_public
WITH (security_invoker=off) AS
SELECT id, user_id, nome, status, created_at
FROM public.canais;

DROP VIEW IF EXISTS public.empresa_perfil_public;
CREATE VIEW public.empresa_perfil_public
WITH (security_invoker=off) AS
SELECT id, user_id, razao_social, nome_fantasia, segmento, numero_funcionarios, created_at
FROM public.empresa_perfil;

GRANT SELECT ON public.profiles_public TO authenticated, anon;
GRANT SELECT ON public.canais_public TO authenticated, anon;
GRANT SELECT ON public.empresa_perfil_public TO authenticated, anon;

-- CanalConsultores desduplicado: garantir que consultor só aparece uma vez por canal (manter mais recente)
-- Limpar duplicatas já existentes (mesmo consultor_user_id no mesmo canal com múltiplos convites)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY canal_id, COALESCE(consultor_user_id::text, convite_email) ORDER BY created_at DESC) as rn
  FROM public.canal_consultores
),
dup_convites AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY canal_id, lower(email) ORDER BY created_at DESC) as rn
  FROM public.canal_convites
)
-- não deletar automaticamente, apenas garantir índice para evitar futuro
-- mas limpar convites duplicados pendentes do mesmo email no mesmo canal (manter mais recente)
DELETE FROM public.canal_convites WHERE id IN (SELECT id FROM dup_convites WHERE rn > 1 AND (SELECT status FROM public.canal_convites WHERE id = dup_convites.id) = 'pendente');

SELECT pg_notify('pgrst', 'reload schema');

-- [11/12] Fix elegibilidade: aceitar convite quando já tem vínculo ativo em outro canal deve falhar com mensagem clara
CREATE OR REPLACE FUNCTION public.responder_convite_canal(p_token uuid, p_aceitar boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_convite record;
  v_status public.status_canal_convite;
  v_link_status public.status_canal_consultor;
  v_canal_nome text;
  v_actor_nome text;
  v_actor_role text;
  v_existing_canal uuid;
BEGIN
  SELECT * INTO v_convite FROM public.canal_convites WHERE token = p_token AND status = 'pendente' AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite inválido ou expirado'; END IF;
  IF lower(v_convite.email) <> lower(COALESCE(auth.jwt() ->> 'email', '')) THEN RAISE EXCEPTION 'Este convite pertence a outro e-mail'; END IF;

  -- se já tem vínculo ativo em outro canal, bloquear com mensagem clara (único ativo por consultor)
  IF p_aceitar THEN
    SELECT canal_id INTO v_existing_canal FROM public.canal_consultores WHERE consultor_user_id = auth.uid() AND status = 'ativo' LIMIT 1;
    IF v_existing_canal IS NOT NULL AND v_existing_canal <> v_convite.canal_id THEN
      RAISE EXCEPTION 'Você já possui vínculo ativo com outro canal. Desvincule-se antes de aceitar novo convite.';
    END IF;
  END IF;

  v_status := CASE WHEN p_aceitar THEN 'aceito'::public.status_canal_convite ELSE 'recusado'::public.status_canal_convite END;
  v_link_status := CASE WHEN p_aceitar THEN 'ativo'::public.status_canal_consultor ELSE 'recusado'::public.status_canal_consultor END;

  UPDATE public.canal_convites SET status = v_status, consultor_user_id = auth.uid(), data_resposta = now(), updated_at = now() WHERE id = v_convite.id;

  -- tentar inserir vínculo; se já existe ativo no mesmo canal (re-aceite), atualizar
  INSERT INTO public.canal_consultores (canal_id, consultor_user_id, convite_id, convite_email, status, convidado_por, data_vinculo, data_resposta)
  VALUES (v_convite.canal_id, auth.uid(), v_convite.id, v_convite.email, v_link_status, v_convite.convidado_por, CASE WHEN p_aceitar THEN now() ELSE NULL END, now())
  ON CONFLICT (consultor_user_id) WHERE status = 'ativo' DO NOTHING;

  -- se ON CONFLICT impediu (já ativo no mesmo canal), garantir que convite aceito reflita
  IF p_aceitar AND NOT EXISTS (SELECT 1 FROM public.canal_consultores WHERE consultor_user_id = auth.uid() AND canal_id = v_convite.canal_id AND status = 'ativo') THEN
    -- verificar se é porque já está ativo no mesmo canal (re-aceite idempotente)
    IF EXISTS (SELECT 1 FROM public.canal_consultores WHERE consultor_user_id = auth.uid() AND canal_id = v_convite.canal_id) THEN
      UPDATE public.canal_consultores SET status = 'ativo', data_vinculo = now(), data_resposta = now(), updated_at = now() WHERE consultor_user_id = auth.uid() AND canal_id = v_convite.canal_id;
    END IF;
  END IF;

  SELECT nome INTO v_canal_nome FROM public.canais WHERE id = v_convite.canal_id;
  SELECT nome INTO v_actor_nome FROM public.profiles WHERE user_id = auth.uid();
  SELECT role::text INTO v_actor_role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;

  INSERT INTO public.audit_logs (categoria, acao, entidade, entidade_id, actor_user_id, actor_nome, actor_role, descricao, severidade, metadata) VALUES (
    'canal_convite', CASE WHEN p_aceitar THEN 'convite_aceito' ELSE 'convite_recusado' END, 'canal_convite', v_convite.id, auth.uid(), v_actor_nome, v_actor_role,
    format('Consultor %s o convite do canal %s', CASE WHEN p_aceitar THEN 'aceitou' ELSE 'recusou' END, COALESCE(v_canal_nome, 'desconhecido')), 'info',
    jsonb_build_object('canal_id', v_convite.canal_id, 'canal_nome', v_canal_nome, 'convite_id', v_convite.id, 'consultor_user_id', auth.uid())
  );

  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$$;

-- Permitir que partes do projeto vejam nome do canal (empresa dona do projeto vê canal que respondeu)
DROP POLICY IF EXISTS "Canal owner and admins view full canal" ON public.canais;
CREATE POLICY "Canal owner and admins view full canal"
ON public.canais FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Project parties view canal" ON public.canais;
CREATE POLICY "Project parties view canal"
ON public.canais FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projetos p
    JOIN public.parceiro_respostas pr ON pr.projeto_id = p.id
    WHERE pr.canal_id = canais.id AND p.empresa_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.parceiro_respostas pr2 WHERE pr2.canal_id = canais.id AND pr2.canal_id IN (
      SELECT canal_id FROM public.canal_consultores WHERE consultor_user_id = auth.uid() AND status = 'ativo'
    )
  )
);

SELECT pg_notify('pgrst', 'reload schema');

-- [12/12] CT-02/CT-03: is_empresa_team_member deve considerar apenas vínculos ativos
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

-- CT-17 (Onda 3): seleção múltipla de consultores numa demanda
-- Arquivo 1/2 — enums e colunas (separado do arquivo das RPCs porque
-- valores de enum recém-criados não podem ser usados na MESMA transação).

-- 1) Novos estados de proposta: 'selecionada' (multi-select do RMO) e
--    'desconsiderada' (recusa individual, REVERSÍVEL dentro do prazo).
ALTER TYPE public.status_proposta ADD VALUE IF NOT EXISTS 'selecionada';
ALTER TYPE public.status_proposta ADD VALUE IF NOT EXISTS 'desconsiderada';

-- 2) Novo estado de projeto: 'encerrada' (demanda de seleção encerrada
--    manualmente pelo RMO; diferente de 'concluida' que é fim da execução).
ALTER TYPE public.status_projeto ADD VALUE IF NOT EXISTS 'encerrada';

-- 3) parceiro_indicacoes.status passa a aceitar 'desconsiderado'
DO $$
DECLARE v_cons text;
BEGIN
  SELECT conname INTO v_cons
    FROM pg_constraint
   WHERE conrelid = 'public.parceiro_indicacoes'::regclass
     AND contype = 'c';
  IF v_cons IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.parceiro_indicacoes DROP CONSTRAINT %I', v_cons);
  END IF;
END $$;

ALTER TABLE public.parceiro_indicacoes
  ADD CONSTRAINT parceiro_indicacoes_status_check
  CHECK (status IN ('indicado','selecionado','desconsiderado','recusado','retirado'));

-- 4) Guarda o status anterior ao desconsiderar (para reversão dentro do prazo)
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS status_anterior text;


COMMIT;

-- Reload do schema cache apos o COMMIT (entrega o notify ao PostgREST)
SELECT pg_notify('pgrst','reload schema');

-- ============================================================
-- BLOCO B - TRANSACAO 2: CT-17 RPCs/triggers (usa os enums do BLOCO A)
-- ============================================================
-- OBS: rodar DEPOIS do Bloco A (ja commitado). Nao pode estar na MESMA
-- transacao do ADD VALUE: o Postgres proibe usar um novo valor de enum
-- antes do COMMIT que o criou (o Bloco B faz 25 casts desses enums).
BEGIN;

-- CT-17 (Onda 3): seleção múltipla de consultores numa demanda
-- Arquivo 2/2 — RPCs e triggers. Depende do arquivo ...000 (enums).
-- Onda 0 (is_empresa_team_member) NÃO é pré-requisito: a versão antiga da
-- função já cobre a checagem (menos restritiva), então tudo roda antes da
-- Onda 0 ser aplicada.

-- ============================================================
-- 1) SELECIONAR PROPOSTA DIRETA (multi-select)
--    Marca 'selecionada' e NÃO recusa as demais. RMO pode selecionar vários.
-- ============================================================
CREATE OR REPLACE FUNCTION public.empresa_selecionar_proposta(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proposta record;
  v_projeto record;
BEGIN
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;

  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_proposta.projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para selecionar propostas deste projeto';
  END IF;

  IF v_proposta.status NOT IN ('enviada','pre_aprovada','contraproposta_consultor') THEN
    RAISE EXCEPTION 'Proposta já foi processada';
  END IF;
  IF v_projeto.status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Demanda não está mais aceitando seleção';
  END IF;

  UPDATE public.propostas
     SET status = 'selecionada'::public.status_proposta, updated_at = now()
   WHERE id = p_proposta_id;

  UPDATE public.projetos
     SET status = 'em_selecao'::public.status_projeto, updated_at = now()
   WHERE id = v_projeto.id
     AND status IN ('publicado'::public.status_projeto, 'em_selecao'::public.status_projeto);

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    v_proposta.consultor_user_id, 'sucesso', 'Você foi selecionado',
    'Você foi selecionado para a demanda "' || v_projeto.nome || '".',
    v_projeto.id, 'projeto'
  );

  RETURN jsonb_build_object('success', true, 'status', 'selecionada', 'consultor_user_id', v_proposta.consultor_user_id);
END $$;

REVOKE ALL ON FUNCTION public.empresa_selecionar_proposta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_selecionar_proposta(uuid) TO authenticated, service_role;

-- ============================================================
-- 2) SELECIONAR INDICAÇÃO DE PARCEIRO (rewrite)
--    Mantém seleção + alocação, mas REMOVE a recusa automática das demais
--    indicações e propostas do projeto.
-- ============================================================
CREATE OR REPLACE FUNCTION public.empresa_selecionar_indicacao(p_indicacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ind record;
  v_resp record;
  v_projeto record;
  v_canal record;
  v_consultor_nome text;
BEGIN
  SELECT * INTO v_ind FROM public.parceiro_indicacoes WHERE id = p_indicacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Indicação não encontrada'; END IF;

  SELECT * INTO v_resp FROM public.parceiro_respostas WHERE id = v_ind.resposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resposta do parceiro não encontrada'; END IF;

  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_resp.projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para selecionar indicações deste projeto';
  END IF;

  IF v_ind.status <> 'indicado' THEN
    RAISE EXCEPTION 'Esta indicação não está mais disponível para seleção';
  END IF;
  IF v_projeto.status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Demanda não está mais aceitando seleção';
  END IF;

  SELECT * INTO v_canal FROM public.canais WHERE id = v_ind.canal_id;
  SELECT COALESCE(nome, 'consultor') INTO v_consultor_nome
    FROM public.profiles WHERE user_id = v_ind.consultor_user_id;

  UPDATE public.parceiro_indicacoes SET status = 'selecionado' WHERE id = p_indicacao_id;

  INSERT INTO public.alocacoes (
    projeto_id, consultor_user_id, canal_id, status,
    valor, solicitado_por, aprovado_por, data_aprovacao
  ) VALUES (
    v_projeto.id, v_ind.consultor_user_id, v_ind.canal_id, 'aprovada'::public.status_alocacao_canal,
    v_ind.valor_proposto, auth.uid(), auth.uid(), now()
  )
  ON CONFLICT (projeto_id, consultor_user_id, canal_id)
    DO UPDATE SET status = 'aprovada'::public.status_alocacao_canal,
                  aprovado_por = auth.uid(),
                  data_aprovacao = now(),
                  updated_at = now();

  UPDATE public.projetos
     SET status = 'em_selecao'::public.status_projeto, updated_at = now()
   WHERE id = v_projeto.id
     AND status IN ('publicado'::public.status_projeto, 'em_selecao'::public.status_projeto);

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    v_ind.consultor_user_id, 'sucesso', 'Você foi selecionado',
    'Você foi selecionado para a demanda "' || v_projeto.nome || '" via parceiro ' ||
      COALESCE(v_canal.nome, 'parceiro') || '.',
    v_projeto.id, 'projeto'
  );

  IF v_canal.user_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      v_canal.user_id, 'sucesso', 'Indicação aceita pela empresa',
      'Seu consultor ' || v_consultor_nome || ' foi selecionado na demanda "' || v_projeto.nome || '".',
      v_projeto.id, 'projeto'
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'selecionado', 'consultor_user_id', v_ind.consultor_user_id, 'canal_id', v_ind.canal_id);
END $$;

REVOKE ALL ON FUNCTION public.empresa_selecionar_indicacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_selecionar_indicacao(uuid) TO authenticated, service_role;

-- ============================================================
-- 3) ACEITAR PROPOSTA (formalização pós-seleção)
--    Rewrite: mantém transição para 'aguardando_consultor' (confirmação do
--    consultor → 'aceita'), mas REMOVE a recusa automática das demais.
--    Passa a aceitar também propostas já 'selecionada'.
-- ============================================================
CREATE OR REPLACE FUNCTION public.empresa_aceitar_proposta(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_proposta record; v_projeto record;
BEGIN
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_proposta.projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para aceitar propostas';
  END IF;
  IF v_proposta.status NOT IN ('selecionada'::public.status_proposta,
                                'enviada'::public.status_proposta,
                                'pre_aprovada'::public.status_proposta,
                                'contraproposta_consultor'::public.status_proposta) THEN
    RAISE EXCEPTION 'Proposta já foi processada';
  END IF;

  UPDATE public.propostas
     SET status = 'aguardando_consultor'::public.status_proposta, updated_at = now()
   WHERE id = p_proposta_id;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    v_proposta.consultor_user_id, 'sucesso', 'Aprovação final solicitada',
    'A empresa formalizou sua proposta para "' || v_projeto.nome || '". Confirme o início para começar.',
    v_projeto.id, 'projeto'
  );

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.empresa_aceitar_proposta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_aceitar_proposta(uuid) TO authenticated, service_role;

-- ============================================================
-- 4) RMO APROVAÇÃO FINAL (shortlist do canal)
--    Rewrite: marca shortlist + proposta como selecionada e REMOVE a recusa
--    automática das demais propostas abertas.
-- ============================================================
CREATE OR REPLACE FUNCTION public.rmo_aprovacao_final(p_shortlist_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item record; v_projeto record;
BEGIN
  SELECT * INTO v_item FROM public.projeto_shortlist WHERE id = p_shortlist_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shortlist não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_item.projeto_id;
  IF v_projeto.canal_id IS NULL OR NOT public.is_canal_operador(v_projeto.canal_id, auth.uid()) THEN
    IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Apenas o RMO/Canal deste projeto pode aprovar';
    END IF;
  END IF;
  IF v_projeto.status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Demanda não está mais aceitando seleção';
  END IF;

  UPDATE public.projeto_shortlist SET status='selecionada_rmo'::public.status_shortlist_item, updated_at=now()
   WHERE id = p_shortlist_id;

  -- Marca a proposta da shortlist como selecionada (demais permanecem pendentes)
  UPDATE public.propostas
     SET status='selecionada'::public.status_proposta, updated_at=now()
   WHERE id = v_item.proposta_id
     AND status IN ('enviada'::public.status_proposta,'pre_aprovada'::public.status_proposta,'contraproposta_consultor'::public.status_proposta);

  UPDATE public.projetos SET status='em_selecao'::public.status_projeto, updated_at=now()
   WHERE id = v_projeto.id;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  SELECT pr.consultor_user_id, 'sucesso', 'Você foi selecionado!',
    'O RMO aprovou sua proposta para "' || v_projeto.nome || '".',
    v_projeto.id, 'projeto'
  FROM public.propostas pr WHERE pr.id = v_item.proposta_id;

  RETURN jsonb_build_object('success', true, 'status', 'selecionada');
END $$;

REVOKE ALL ON FUNCTION public.rmo_aprovacao_final(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rmo_aprovacao_final(uuid) TO authenticated, service_role;

-- ============================================================
-- 5) ENCERRAR DEMANDA (manual)
--    Só aqui os NÃO selecionados viram 'recusada'/'recusado'. Selecionados
--    permanecem. Demanda sai da listagem em aberto (status 'encerrada').
-- ============================================================
CREATE OR REPLACE FUNCTION public.empresa_encerrar_demanda(p_projeto_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_projeto record;
  v_consultaor public.propostas;
BEGIN
  SELECT * INTO v_projeto FROM public.projetos WHERE id = p_projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para encerrar esta demanda';
  END IF;

  IF v_projeto.status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Demanda não está em seleção';
  END IF;

  -- Propostas abertas não selecionadas (inclui desconsideradas) viram recusada
  FOR v_consultaor IN
    SELECT * FROM public.propostas
     WHERE projeto_id = v_projeto.id
       AND status IN ('enviada'::public.status_proposta,
                      'pre_aprovada'::public.status_proposta,
                      'contraproposta_consultor'::public.status_proposta,
                      'desconsiderada'::public.status_proposta)
  LOOP
    UPDATE public.propostas
       SET status = 'recusada'::public.status_proposta, updated_at = now()
     WHERE id = v_consultaor.id;

    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      v_consultaor.consultor_user_id, 'aviso', 'Demanda encerrada sem sua seleção',
      'A demanda "' || v_projeto.nome || '" foi encerrada e sua proposta não foi selecionada.',
      v_projeto.id, 'projeto'
    );
  END LOOP;

  -- Indicações abertas não selecionadas viram recusado
  UPDATE public.parceiro_indicacoes pi
     SET status = 'recusado'
   WHERE pi.status IN ('indicado','desconsiderado')
     AND pi.resposta_id IN (
       SELECT pr.id FROM public.parceiro_respostas pr
        WHERE pr.projeto_id = v_projeto.id
     );

  UPDATE public.projetos
     SET status = 'encerrada'::public.status_projeto, updated_at = now()
   WHERE id = v_projeto.id;

  RETURN jsonb_build_object('success', true, 'status', 'encerrada');
END $$;

REVOKE ALL ON FUNCTION public.empresa_encerrar_demanda(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_encerrar_demanda(uuid) TO authenticated, service_role;

-- ============================================================
-- 6) DESCONSIDERAR / RECONSIDERAR PROPOSTA (individual, reversível no prazo)
-- ============================================================
CREATE OR REPLACE FUNCTION public.empresa_desconsiderar_proposta(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_proposta record; v_projeto record; v_novo_status text;
BEGIN
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_proposta.projeto_id;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para avaliar propostas deste projeto';
  END IF;

  IF v_proposta.status NOT IN ('enviada','pre_aprovada','contraproposta_consultor') THEN
    RAISE EXCEPTION 'Proposta não está em avaliação: %', v_proposta.status;
  END IF;

  v_novo_status := v_proposta.status::text;
  UPDATE public.propostas
     SET status = 'desconsiderada'::public.status_proposta,
         status_anterior = v_novo_status,
         updated_at = now()
   WHERE id = p_proposta_id;

  RETURN jsonb_build_object('success', true, 'status', 'desconsiderada');
END $$;

CREATE OR REPLACE FUNCTION public.empresa_reconsiderar_proposta(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_proposta record; v_projeto record;
BEGIN
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_proposta.projeto_id;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para avaliar propostas deste projeto';
  END IF;

  IF v_proposta.status <> 'desconsiderada' THEN
    RAISE EXCEPTION 'Proposta não está desconsiderada';
  END IF;
  IF v_projeto.status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Demanda já encerrada — seleção não é mais reversível';
  END IF;
  IF v_projeto.prazo_propostas IS NOT NULL AND v_projeto.prazo_propostas < current_date THEN
    RAISE EXCEPTION 'Prazo de propostas encerrado — não é mais possível reconsiderar';
  END IF;

  UPDATE public.propostas
     SET status = COALESCE(v_proposta.status_anterior, 'enviada')::public.status_proposta,
         status_anterior = NULL,
         updated_at = now()
   WHERE id = p_proposta_id;

  RETURN jsonb_build_object('success', true, 'status', COALESCE(v_proposta.status_anterior, 'enviada'));
END $$;

REVOKE ALL ON FUNCTION public.empresa_desconsiderar_proposta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_desconsiderar_proposta(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.empresa_reconsiderar_proposta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_reconsiderar_proposta(uuid) TO authenticated, service_role;

-- ============================================================
-- 7) DESCONSIDERAR / RECONSIDERAR INDICAÇÃO (individual, reversível no prazo)
-- ============================================================
CREATE OR REPLACE FUNCTION public.empresa_desconsiderar_indicacao(p_indicacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_ind record; v_resp record; v_projeto record;
BEGIN
  SELECT * INTO v_ind FROM public.parceiro_indicacoes WHERE id = p_indicacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Indicação não encontrada'; END IF;
  SELECT * INTO v_resp FROM public.parceiro_respostas WHERE id = v_ind.resposta_id;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_resp.projeto_id;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para avaliar indicações deste projeto';
  END IF;

  IF v_ind.status <> 'indicado' THEN
    RAISE EXCEPTION 'Indicação não está em avaliação';
  END IF;

  UPDATE public.parceiro_indicacoes SET status = 'desconsiderado' WHERE id = p_indicacao_id;
  RETURN jsonb_build_object('success', true, 'status', 'desconsiderado');
END $$;

CREATE OR REPLACE FUNCTION public.empresa_reconsiderar_indicacao(p_indicacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_ind record; v_resp record; v_projeto record;
BEGIN
  SELECT * INTO v_ind FROM public.parceiro_indicacoes WHERE id = p_indicacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Indicação não encontrada'; END IF;
  SELECT * INTO v_resp FROM public.parceiro_respostas WHERE id = v_ind.resposta_id;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_resp.projeto_id;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para avaliar indicações deste projeto';
  END IF;

  IF v_ind.status <> 'desconsiderado' THEN
    RAISE EXCEPTION 'Indicação não está desconsiderada';
  END IF;
  IF v_projeto.status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Demanda já encerrada — seleção não é mais reversível';
  END IF;
  IF v_projeto.prazo_propostas IS NOT NULL AND v_projeto.prazo_propostas < current_date THEN
    RAISE EXCEPTION 'Prazo de propostas encerrado — não é mais possível reconsiderar';
  END IF;

  UPDATE public.parceiro_indicacoes SET status = 'indicado' WHERE id = p_indicacao_id;
  RETURN jsonb_build_object('success', true, 'status', 'indicado');
END $$;

REVOKE ALL ON FUNCTION public.empresa_desconsiderar_indicacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_desconsiderar_indicacao(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.empresa_reconsiderar_indicacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_reconsiderar_indicacao(uuid) TO authenticated, service_role;

-- ============================================================
-- 8) TRIGGERS: data de validade = apenas prazo de RECEBIMENTO de propostas
--    Bloqueia candidatura NOVA (avulso e parceiro) fora do prazo ou com a
--    demanda fora de seleção. A demanda segue aberta para seleção.
-- ============================================================
CREATE OR REPLACE FUNCTION public.bloquear_candidatura_fora_prazo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_status public.status_projeto; v_prazo date;
BEGIN
  SELECT status, prazo_propostas INTO v_status, v_prazo FROM public.projetos WHERE id = NEW.projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF v_status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Esta demanda não está aceitando novas candidaturas';
  END IF;
  IF v_prazo IS NOT NULL AND v_prazo < current_date THEN
    RAISE EXCEPTION 'Prazo de propostas encerrado para esta demanda';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.bloquear_indicacao_fora_prazo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_projeto_id uuid; v_status public.status_projeto; v_prazo date;
BEGIN
  SELECT pr.projeto_id INTO v_projeto_id FROM public.parceiro_respostas pr WHERE pr.id = NEW.resposta_id;
  IF v_projeto_id IS NULL THEN RAISE EXCEPTION 'Resposta de parceiro não encontrada'; END IF;
  SELECT status, prazo_propostas INTO v_status, v_prazo FROM public.projetos WHERE id = v_projeto_id;
  IF v_status NOT IN ('publicado','em_selecao') THEN
    RAISE EXCEPTION 'Esta demanda não está aceitando novas candidaturas';
  END IF;
  IF v_prazo IS NOT NULL AND v_prazo < current_date THEN
    RAISE EXCEPTION 'Prazo de propostas encerrado para esta demanda';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bloquear_candidatura_fora_prazo ON public.propostas;
CREATE TRIGGER trg_bloquear_candidatura_fora_prazo
  BEFORE INSERT ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_candidatura_fora_prazo();

DROP TRIGGER IF EXISTS trg_bloquear_indicacao_fora_prazo ON public.parceiro_indicacoes;
CREATE TRIGGER trg_bloquear_indicacao_fora_prazo
  BEFORE INSERT ON public.parceiro_indicacoes
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_indicacao_fora_prazo();

-- Reload do schema cache do PostgREST (expõe as RPCs novas)
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;

-- Reload do schema cache apos o COMMIT (expõe as RPCs novas)
SELECT pg_notify('pgrst','reload schema');
