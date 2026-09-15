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

BEGIN;

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
  SELECT id, ROW_NUMBER() OVER (PARTITION BY canal_id, COALESCE(consultor_user_id::text, email) ORDER BY created_at DESC) as rn
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

COMMIT;

-- Recarga final do schema para o PostgREST enxergar tudo aplicado de uma vez
select pg_notify('pgrst','reload schema');