
-- =====================================================
-- 1. NOVO PAPEL DE EMPRESA: coordenador
-- =====================================================
ALTER TYPE public.papel_empresa_usuario ADD VALUE IF NOT EXISTS 'coordenador';

-- =====================================================
-- 2. CANAL_MEMBROS (RMO / admin do canal)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.canal_membros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  canal_id UUID NOT NULL REFERENCES public.canais(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','rmo')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('pendente','ativo','removido')),
  convite_email TEXT,
  convidado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (canal_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.canal_membros TO authenticated;
GRANT ALL ON public.canal_membros TO service_role;

ALTER TABLE public.canal_membros ENABLE ROW LEVEL SECURITY;

-- Seed: cada dono de canal atual é admin em canal_membros
INSERT INTO public.canal_membros (canal_id, user_id, role, status)
SELECT c.id, c.user_id, 'admin', 'ativo'
FROM public.canais c
WHERE c.user_id IS NOT NULL
ON CONFLICT (canal_id, user_id) DO NOTHING;

-- Helper: é operador (admin ou rmo) do canal
CREATE OR REPLACE FUNCTION public.is_canal_operador(_canal_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.canal_membros
    WHERE canal_id = _canal_id AND user_id = _user_id AND status = 'ativo'
  ) OR EXISTS (
    SELECT 1 FROM public.canais c WHERE c.id = _canal_id AND c.user_id = _user_id
  );
$$;

-- Helper: canal_id do usuário (admin ou RMO)
CREATE OR REPLACE FUNCTION public.get_user_canal_operador_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT canal_id FROM public.canal_membros
  WHERE user_id = _user_id AND status = 'ativo'
  ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE POLICY "Admin do canal gerencia membros" ON public.canal_membros
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.canais c WHERE c.id = canal_id AND c.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.canais c WHERE c.id = canal_id AND c.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Membro vê a si mesmo" ON public.canal_membros
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER canal_membros_updated_at
BEFORE UPDATE ON public.canal_membros
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 3. PROJETOS: coordenador_user_id
-- =====================================================
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS coordenador_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_projetos_coordenador
  ON public.projetos(coordenador_user_id);

-- Helper: é coordenador de um projeto
CREATE OR REPLACE FUNCTION public.is_projeto_coordenador(_projeto_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projetos WHERE id = _projeto_id AND coordenador_user_id = _user_id
  );
$$;

-- Policy adicional: coordenador vê o projeto que coordena
DROP POLICY IF EXISTS "Coordenador vê projetos que coordena" ON public.projetos;
CREATE POLICY "Coordenador vê projetos que coordena" ON public.projetos
FOR SELECT TO authenticated
USING (coordenador_user_id = auth.uid());

-- =====================================================
-- 4. PROJETO_FASES: encerramento com documento + validações
-- =====================================================
ALTER TABLE public.projeto_fases
  ADD COLUMN IF NOT EXISTS documento_encerramento_url TEXT,
  ADD COLUMN IF NOT EXISTS documento_encerramento_nome TEXT,
  ADD COLUMN IF NOT EXISTS encerrada_por UUID,
  ADD COLUMN IF NOT EXISTS encerrada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rmo_validada_por UUID,
  ADD COLUMN IF NOT EXISTS rmo_validada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS co_validada_por UUID,
  ADD COLUMN IF NOT EXISTS co_validada_em TIMESTAMPTZ;

-- =====================================================
-- 5. SHORTLIST + PARECERES
-- =====================================================
DO $$ BEGIN
  CREATE TYPE public.status_shortlist_item AS ENUM (
    'na_shortlist','em_entrevista','aprovada_coordenador','reprovada_coordenador','selecionada_rmo'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.projeto_shortlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  proposta_id UUID NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  adicionada_por UUID NOT NULL,
  adicionada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.status_shortlist_item NOT NULL DEFAULT 'na_shortlist',
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (projeto_id, proposta_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_shortlist TO authenticated;
GRANT ALL ON public.projeto_shortlist TO service_role;

ALTER TABLE public.projeto_shortlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RMO/canal gerencia shortlist do projeto" ON public.projeto_shortlist
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_id
      AND p.canal_id IS NOT NULL
      AND public.is_canal_operador(p.canal_id, auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_id
      AND p.canal_id IS NOT NULL
      AND public.is_canal_operador(p.canal_id, auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Empresa e coordenador leem shortlist" ON public.projeto_shortlist
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_id
      AND (
        public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
        OR p.coordenador_user_id = auth.uid()
      )
  )
);

CREATE POLICY "Consultor lê a própria linha da shortlist" ON public.projeto_shortlist
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.propostas pr WHERE pr.id = proposta_id AND pr.consultor_user_id = auth.uid())
);

CREATE TRIGGER projeto_shortlist_updated_at
BEFORE UPDATE ON public.projeto_shortlist
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_shortlist_projeto ON public.projeto_shortlist(projeto_id);
CREATE INDEX IF NOT EXISTS idx_shortlist_proposta ON public.projeto_shortlist(proposta_id);

-- Pareceres
CREATE TABLE IF NOT EXISTS public.projeto_shortlist_pareceres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shortlist_id UUID NOT NULL REFERENCES public.projeto_shortlist(id) ON DELETE CASCADE,
  coordenador_user_id UUID NOT NULL,
  aprovado BOOLEAN NOT NULL,
  comentario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_shortlist_pareceres TO authenticated;
GRANT ALL ON public.projeto_shortlist_pareceres TO service_role;

ALTER TABLE public.projeto_shortlist_pareceres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordenador registra parecer" ON public.projeto_shortlist_pareceres
FOR INSERT TO authenticated
WITH CHECK (
  coordenador_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.projeto_shortlist s
    JOIN public.projetos p ON p.id = s.projeto_id
    WHERE s.id = shortlist_id AND p.coordenador_user_id = auth.uid()
  )
);

CREATE POLICY "Partes leem pareceres" ON public.projeto_shortlist_pareceres
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projeto_shortlist s
    JOIN public.projetos p ON p.id = s.projeto_id
    WHERE s.id = shortlist_id
      AND (
        public.is_empresa_team_member(auth.uid(), p.empresa_user_id)
        OR p.coordenador_user_id = auth.uid()
        OR (p.canal_id IS NOT NULL AND public.is_canal_operador(p.canal_id, auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);

CREATE INDEX IF NOT EXISTS idx_pareceres_shortlist ON public.projeto_shortlist_pareceres(shortlist_id);

-- =====================================================
-- 6. RPCs
-- =====================================================

-- 6.1 RMO monta shortlist com N propostas
CREATE OR REPLACE FUNCTION public.rmo_montar_shortlist(p_projeto_id uuid, p_proposta_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_projeto record; v_pid uuid;
BEGIN
  SELECT * INTO v_projeto FROM public.projetos WHERE id = p_projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF v_projeto.canal_id IS NULL OR NOT public.is_canal_operador(v_projeto.canal_id, auth.uid()) THEN
    IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Apenas o RMO/Canal deste projeto pode montar shortlist';
    END IF;
  END IF;

  FOREACH v_pid IN ARRAY p_proposta_ids LOOP
    INSERT INTO public.projeto_shortlist (projeto_id, proposta_id, adicionada_por)
    VALUES (p_projeto_id, v_pid, auth.uid())
    ON CONFLICT (projeto_id, proposta_id) DO NOTHING;
    UPDATE public.propostas SET status='pre_aprovada'::public.status_proposta, updated_at=now()
     WHERE id = v_pid AND status = 'enviada'::public.status_proposta;
  END LOOP;

  -- Notifica coordenador do projeto
  IF v_projeto.coordenador_user_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_projeto.coordenador_user_id, 'info', 'Shortlist recebida',
      'Uma nova shortlist foi enviada para o projeto "' || v_projeto.nome || '" para sua avaliação técnica.',
      p_projeto_id, 'projeto');
  END IF;

  RETURN jsonb_build_object('success', true, 'count', array_length(p_proposta_ids,1));
END $$;

-- 6.2 Coordenador emite parecer
CREATE OR REPLACE FUNCTION public.coordenador_emitir_parecer(p_shortlist_id uuid, p_aprovado boolean, p_comentario text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item record; v_projeto record;
BEGIN
  SELECT * INTO v_item FROM public.projeto_shortlist WHERE id = p_shortlist_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shortlist não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_item.projeto_id;
  IF v_projeto.coordenador_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Apenas o coordenador designado pode emitir parecer';
  END IF;

  INSERT INTO public.projeto_shortlist_pareceres (shortlist_id, coordenador_user_id, aprovado, comentario)
  VALUES (p_shortlist_id, auth.uid(), p_aprovado, p_comentario);

  UPDATE public.projeto_shortlist
     SET status = CASE WHEN p_aprovado THEN 'aprovada_coordenador'::public.status_shortlist_item
                       ELSE 'reprovada_coordenador'::public.status_shortlist_item END,
         updated_at = now()
   WHERE id = p_shortlist_id;

  -- Notifica RMO/canal
  IF v_projeto.canal_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    SELECT cm.user_id, 'info', 'Parecer do coordenador recebido',
      'O coordenador ' || CASE WHEN p_aprovado THEN 'aprovou' ELSE 'reprovou' END
      || ' um candidato da shortlist de "' || v_projeto.nome || '".',
      v_projeto.id, 'projeto'
    FROM public.canal_membros cm WHERE cm.canal_id = v_projeto.canal_id AND cm.status='ativo';
  END IF;

  RETURN jsonb_build_object('success', true);
END $$;

-- 6.3 RMO aprovação final (marca shortlist selecionada + delega ao fluxo existente)
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

  UPDATE public.projeto_shortlist SET status='selecionada_rmo'::public.status_shortlist_item, updated_at=now()
   WHERE id = p_shortlist_id;

  -- Move proposta para aguardando_consultor e recusa as demais
  UPDATE public.propostas
     SET status='aguardando_consultor'::public.status_proposta, updated_at=now()
   WHERE id = v_item.proposta_id;

  UPDATE public.projetos SET status='em_selecao'::public.status_projeto, updated_at=now()
   WHERE id = v_projeto.id;

  -- Recusa outras propostas abertas
  UPDATE public.propostas
     SET status='recusada'::public.status_proposta, updated_at=now()
   WHERE projeto_id = v_projeto.id
     AND id <> v_item.proposta_id
     AND status IN ('enviada'::public.status_proposta,'pre_aprovada'::public.status_proposta,'contraproposta_consultor'::public.status_proposta);

  -- Notifica consultor selecionado
  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  SELECT pr.consultor_user_id, 'sucesso', 'Você foi selecionado!',
    'O RMO aprovou sua proposta para "' || v_projeto.nome || '". Confirme o início do projeto.',
    v_projeto.id, 'projeto'
  FROM public.propostas pr WHERE pr.id = v_item.proposta_id;

  RETURN jsonb_build_object('success', true);
END $$;

-- 6.4 Consultor encerra fase com documento
CREATE OR REPLACE FUNCTION public.consultor_encerrar_fase(p_fase_id uuid, p_documento_url text, p_documento_nome text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fase record; v_projeto record; v_is_consultor boolean;
BEGIN
  SELECT * INTO v_fase FROM public.projeto_fases WHERE id = p_fase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_fase.projeto_id;

  SELECT EXISTS (
    SELECT 1 FROM public.propostas pr
    WHERE pr.projeto_id = v_fase.projeto_id
      AND pr.consultor_user_id = auth.uid()
      AND pr.status = 'aceita'::public.status_proposta
  ) INTO v_is_consultor;

  IF NOT v_is_consultor THEN RAISE EXCEPTION 'Apenas o consultor alocado pode encerrar a fase'; END IF;

  UPDATE public.projeto_fases
     SET documento_encerramento_url = p_documento_url,
         documento_encerramento_nome = p_documento_nome,
         encerrada_por = auth.uid(),
         encerrada_em = now(),
         status = 'aguardando_aprovacao'::public.status_fase,
         updated_at = now()
   WHERE id = p_fase_id;

  -- Notifica RMO
  IF v_projeto.canal_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    SELECT cm.user_id, 'info', 'Fase encerrada pelo consultor',
      'A fase "' || v_fase.nome || '" do projeto "' || v_projeto.nome || '" foi encerrada e aguarda sua validação.',
      v_projeto.id, 'projeto'
    FROM public.canal_membros cm WHERE cm.canal_id = v_projeto.canal_id AND cm.status='ativo';
  END IF;
  -- Notifica coordenador
  IF v_projeto.coordenador_user_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_projeto.coordenador_user_id, 'info', 'Fase pronta para co-validação',
      'A fase "' || v_fase.nome || '" do projeto "' || v_projeto.nome || '" está aguardando co-validação.',
      v_projeto.id, 'projeto');
  END IF;

  RETURN jsonb_build_object('success', true);
END $$;

-- 6.5 RMO valida fase
CREATE OR REPLACE FUNCTION public.rmo_validar_fase(p_fase_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fase record; v_projeto record;
BEGIN
  SELECT * INTO v_fase FROM public.projeto_fases WHERE id = p_fase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_fase.projeto_id;
  IF v_projeto.canal_id IS NULL OR NOT public.is_canal_operador(v_projeto.canal_id, auth.uid()) THEN
    IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Apenas o RMO/Canal pode validar a fase';
    END IF;
  END IF;

  UPDATE public.projeto_fases
     SET rmo_validada_por = auth.uid(), rmo_validada_em = now(),
         status = 'aprovada'::public.status_fase, updated_at = now()
   WHERE id = p_fase_id;

  RETURN jsonb_build_object('success', true);
END $$;

-- 6.6 Coordenador co-valida
CREATE OR REPLACE FUNCTION public.coordenador_co_validar_fase(p_fase_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fase record; v_projeto record;
BEGIN
  SELECT * INTO v_fase FROM public.projeto_fases WHERE id = p_fase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase não encontrada'; END IF;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = v_fase.projeto_id;
  IF v_projeto.coordenador_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Apenas o coordenador designado pode co-validar';
  END IF;

  UPDATE public.projeto_fases
     SET co_validada_por = auth.uid(), co_validada_em = now(), updated_at = now()
   WHERE id = p_fase_id;

  RETURN jsonb_build_object('success', true);
END $$;

-- 6.7 Empresa indica coordenador do projeto
CREATE OR REPLACE FUNCTION public.empresa_indicar_coordenador(p_projeto_id uuid, p_coordenador_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_projeto record; v_papel public.papel_empresa_usuario;
BEGIN
  SELECT * INTO v_projeto FROM public.projetos WHERE id = p_projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT papel INTO v_papel FROM public.empresa_usuarios
   WHERE empresa_user_id = v_projeto.empresa_user_id AND user_id = p_coordenador_user_id;
  IF v_papel IS DISTINCT FROM 'coordenador'::public.papel_empresa_usuario THEN
    RAISE EXCEPTION 'O usuário indicado não é coordenador desta empresa';
  END IF;

  UPDATE public.projetos SET coordenador_user_id = p_coordenador_user_id, updated_at = now()
   WHERE id = p_projeto_id;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (p_coordenador_user_id, 'info', 'Você foi designado como coordenador',
    'Você foi indicado como coordenador técnico do projeto "' || v_projeto.nome || '".',
    p_projeto_id, 'projeto');

  RETURN jsonb_build_object('success', true);
END $$;

-- 6.8 Canal convida RMO
CREATE OR REPLACE FUNCTION public.canal_convidar_rmo(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_canal_id uuid; v_user_id uuid;
BEGIN
  v_canal_id := public.get_user_canal_id(auth.uid());
  IF v_canal_id IS NULL THEN RAISE EXCEPTION 'Canal não encontrado'; END IF;

  SELECT user_id INTO v_user_id FROM public.profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.canal_membros (canal_id, user_id, role, status, convite_email, convidado_por)
    VALUES (v_canal_id, v_user_id, 'rmo', 'ativo', p_email, auth.uid())
    ON CONFLICT (canal_id, user_id) DO UPDATE SET status='ativo', role='rmo', updated_at=now();
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_user_id, 'info', 'Você foi adicionado como RMO',
      'Você agora é RMO no canal.', v_canal_id, 'canal');
    RETURN jsonb_build_object('success', true, 'ativado', true);
  ELSE
    RAISE EXCEPTION 'Usuário com este e-mail não encontrado. Peça para se cadastrar primeiro.';
  END IF;
END $$;
