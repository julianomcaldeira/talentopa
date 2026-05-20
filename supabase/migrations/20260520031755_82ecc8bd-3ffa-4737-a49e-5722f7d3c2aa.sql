ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'canal';
ALTER TYPE public.status_proposta ADD VALUE IF NOT EXISTS 'pendente_aprovacao_canal';

DO $$
BEGIN
  CREATE TYPE public.status_canal AS ENUM ('pendente', 'ativo', 'suspenso', 'inativo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.status_canal_convite AS ENUM ('pendente', 'aceito', 'recusado', 'expirado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.status_canal_consultor AS ENUM ('pendente', 'ativo', 'recusado', 'desvinculado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.status_alocacao_canal AS ENUM ('pendente_aprovacao', 'aprovada', 'recusada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.canais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nome text NOT NULL,
  cnpj text UNIQUE,
  responsavel_nome text,
  email_contato text,
  telefone text,
  status public.status_canal NOT NULL DEFAULT 'pendente',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.canal_convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id uuid NOT NULL REFERENCES public.canais(id) ON DELETE CASCADE,
  email text NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status public.status_canal_convite NOT NULL DEFAULT 'pendente',
  convidado_por uuid,
  consultor_user_id uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  data_resposta timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.canal_consultores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id uuid NOT NULL REFERENCES public.canais(id) ON DELETE CASCADE,
  consultor_user_id uuid NOT NULL,
  convite_id uuid REFERENCES public.canal_convites(id) ON DELETE SET NULL,
  convite_email text,
  status public.status_canal_consultor NOT NULL DEFAULT 'pendente',
  convidado_por uuid,
  data_vinculo timestamptz,
  data_resposta timestamptz,
  motivo_desvinculo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alocacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  proposta_id uuid REFERENCES public.propostas(id) ON DELETE SET NULL,
  consultor_user_id uuid NOT NULL,
  canal_id uuid NOT NULL REFERENCES public.canais(id) ON DELETE CASCADE,
  status public.status_alocacao_canal NOT NULL DEFAULT 'pendente_aprovacao',
  valor numeric(12,2),
  prazo_estimado date,
  solicitado_por uuid,
  aprovado_por uuid,
  motivo_recusa text,
  data_aprovacao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(projeto_id, consultor_user_id, canal_id)
);

ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS canal_id uuid REFERENCES public.canais(id) ON DELETE SET NULL;
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS criado_por_tipo text NOT NULL DEFAULT 'empresa';
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS valor_estimado numeric(12,2);

DO $$
BEGIN
  ALTER TABLE public.projetos ADD CONSTRAINT projetos_criado_por_tipo_check CHECK (criado_por_tipo IN ('empresa', 'canal'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_canais_user_id ON public.canais(user_id);
CREATE INDEX IF NOT EXISTS idx_canal_convites_canal_status ON public.canal_convites(canal_id, status);
CREATE INDEX IF NOT EXISTS idx_canal_convites_email_status ON public.canal_convites(lower(email), status);
CREATE INDEX IF NOT EXISTS idx_canal_consultores_canal_status ON public.canal_consultores(canal_id, status);
CREATE INDEX IF NOT EXISTS idx_canal_consultores_consultor_status ON public.canal_consultores(consultor_user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canal_consultor_ativo ON public.canal_consultores(consultor_user_id) WHERE status = 'ativo';
CREATE INDEX IF NOT EXISTS idx_alocacoes_canal_status ON public.alocacoes(canal_id, status);
CREATE INDEX IF NOT EXISTS idx_alocacoes_projeto ON public.alocacoes(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projetos_canal_id ON public.projetos(canal_id);

ALTER TABLE public.canais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canal_convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canal_consultores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alocacoes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_canal_owner(_canal_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.canais
    WHERE id = _canal_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_consultor_do_canal(_canal_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.canal_consultores
    WHERE canal_id = _canal_id
      AND consultor_user_id = _user_id
      AND status = 'ativo'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_canal_id(_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.canais WHERE user_id = _user_id LIMIT 1
$$;

DROP POLICY IF EXISTS "Admins can manage canais" ON public.canais;
CREATE POLICY "Admins can manage canais" ON public.canais
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Canal owners can view own canal" ON public.canais;
CREATE POLICY "Canal owners can view own canal" ON public.canais
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_consultor_do_canal(id, auth.uid()));

DROP POLICY IF EXISTS "Canal owners can update own canal" ON public.canais;
CREATE POLICY "Canal owners can update own canal" ON public.canais
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Canal owners can insert own canal" ON public.canais;
CREATE POLICY "Canal owners can insert own canal" ON public.canais
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage canal convites" ON public.canal_convites;
CREATE POLICY "Admins can manage canal convites" ON public.canal_convites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Canal owners manage own convites" ON public.canal_convites;
CREATE POLICY "Canal owners manage own convites" ON public.canal_convites
  FOR ALL TO authenticated
  USING (public.is_canal_owner(canal_id, auth.uid()))
  WITH CHECK (public.is_canal_owner(canal_id, auth.uid()));

DROP POLICY IF EXISTS "Consultants view own canal convites" ON public.canal_convites;
CREATE POLICY "Consultants view own canal convites" ON public.canal_convites
  FOR SELECT TO authenticated
  USING (lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')) OR consultor_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage canal consultores" ON public.canal_consultores;
CREATE POLICY "Admins can manage canal consultores" ON public.canal_consultores
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Canal owners manage own consultores" ON public.canal_consultores;
CREATE POLICY "Canal owners manage own consultores" ON public.canal_consultores
  FOR ALL TO authenticated
  USING (public.is_canal_owner(canal_id, auth.uid()))
  WITH CHECK (public.is_canal_owner(canal_id, auth.uid()));

DROP POLICY IF EXISTS "Consultants view own canal links" ON public.canal_consultores;
CREATE POLICY "Consultants view own canal links" ON public.canal_consultores
  FOR SELECT TO authenticated
  USING (consultor_user_id = auth.uid());

DROP POLICY IF EXISTS "Consultants update own pending canal links" ON public.canal_consultores;
CREATE POLICY "Consultants update own pending canal links" ON public.canal_consultores
  FOR UPDATE TO authenticated
  USING (consultor_user_id = auth.uid() AND status = 'pendente')
  WITH CHECK (consultor_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage alocacoes" ON public.alocacoes;
CREATE POLICY "Admins can manage alocacoes" ON public.alocacoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Relevant parties view alocacoes" ON public.alocacoes;
CREATE POLICY "Relevant parties view alocacoes" ON public.alocacoes
  FOR SELECT TO authenticated
  USING (
    consultor_user_id = auth.uid()
    OR public.is_canal_owner(canal_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id))
  );

DROP POLICY IF EXISTS "Companies and channels create alocacoes" ON public.alocacoes;
CREATE POLICY "Companies and channels create alocacoes" ON public.alocacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_canal_owner(canal_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND public.is_empresa_team_member(auth.uid(), p.empresa_user_id))
  );

DROP POLICY IF EXISTS "Canal owners update own alocacoes" ON public.alocacoes;
CREATE POLICY "Canal owners update own alocacoes" ON public.alocacoes
  FOR UPDATE TO authenticated
  USING (public.is_canal_owner(canal_id, auth.uid()))
  WITH CHECK (public.is_canal_owner(canal_id, auth.uid()));

DROP POLICY IF EXISTS "Channels can view own projects" ON public.projetos;
CREATE POLICY "Channels can view own projects" ON public.projetos
  FOR SELECT TO authenticated
  USING (canal_id IS NOT NULL AND public.is_canal_owner(canal_id, auth.uid()));

DROP POLICY IF EXISTS "Channels can create linked projects" ON public.projetos;
CREATE POLICY "Channels can create linked projects" ON public.projetos
  FOR INSERT TO authenticated
  WITH CHECK (canal_id IS NOT NULL AND criado_por_tipo = 'canal' AND public.is_canal_owner(canal_id, auth.uid()));

DROP POLICY IF EXISTS "Channels can update own linked projects" ON public.projetos;
CREATE POLICY "Channels can update own linked projects" ON public.projetos
  FOR UPDATE TO authenticated
  USING (canal_id IS NOT NULL AND public.is_canal_owner(canal_id, auth.uid()))
  WITH CHECK (canal_id IS NOT NULL AND public.is_canal_owner(canal_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_nome text;
BEGIN
  v_nome := COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email);

  IF COALESCE(NEW.raw_user_meta_data ->> 'tipo_usuario', '') IN ('admin', 'consultor', 'empresa', 'canal') THEN
    v_role := (NEW.raw_user_meta_data ->> 'tipo_usuario')::public.app_role;
  ELSE
    v_role := 'consultor'::public.app_role;
  END IF;

  INSERT INTO public.profiles (user_id, nome, email, telefone)
  VALUES (
    NEW.id,
    v_nome,
    NEW.email,
    NEW.raw_user_meta_data ->> 'telefone'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    telefone = COALESCE(EXCLUDED.telefone, public.profiles.telefone),
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_role = 'consultor'::public.app_role THEN
    INSERT INTO public.consultor_perfil (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF v_role = 'empresa'::public.app_role THEN
    INSERT INTO public.empresa_perfil (user_id, razao_social, cnpj, nome_fantasia, endereco, segmento)
    VALUES (
      NEW.id,
      v_nome,
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
$$;

CREATE OR REPLACE FUNCTION public.canal_convidar_consultor(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canal_id uuid;
  v_convite_id uuid;
BEGIN
  v_canal_id := public.get_user_canal_id(auth.uid());
  IF v_canal_id IS NULL THEN
    RAISE EXCEPTION 'Canal não encontrado para o usuário atual';
  END IF;

  INSERT INTO public.canal_convites (canal_id, email, convidado_por)
  VALUES (v_canal_id, lower(trim(p_email)), auth.uid())
  RETURNING id INTO v_convite_id;

  RETURN v_convite_id;
END;
$$;

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
BEGIN
  SELECT * INTO v_convite
  FROM public.canal_convites
  WHERE token = p_token
    AND status = 'pendente'
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido ou expirado';
  END IF;

  IF lower(v_convite.email) <> lower(COALESCE(auth.jwt() ->> 'email', '')) THEN
    RAISE EXCEPTION 'Este convite pertence a outro e-mail';
  END IF;

  v_status := CASE WHEN p_aceitar THEN 'aceito'::public.status_canal_convite ELSE 'recusado'::public.status_canal_convite END;
  v_link_status := CASE WHEN p_aceitar THEN 'ativo'::public.status_canal_consultor ELSE 'recusado'::public.status_canal_consultor END;

  UPDATE public.canal_convites
  SET status = v_status,
      consultor_user_id = auth.uid(),
      data_resposta = now(),
      updated_at = now()
  WHERE id = v_convite.id;

  INSERT INTO public.canal_consultores (canal_id, consultor_user_id, convite_id, convite_email, status, convidado_por, data_vinculo, data_resposta)
  VALUES (v_convite.canal_id, auth.uid(), v_convite.id, v_convite.email, v_link_status, v_convite.convidado_por, CASE WHEN p_aceitar THEN now() ELSE NULL END, now())
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.responder_alocacao_canal(p_alocacao_id uuid, p_aprovar boolean, p_justificativa text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alocacao record;
  v_status public.status_alocacao_canal;
BEGIN
  SELECT * INTO v_alocacao
  FROM public.alocacoes
  WHERE id = p_alocacao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alocação não encontrada';
  END IF;

  IF NOT public.is_canal_owner(v_alocacao.canal_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para responder esta alocação';
  END IF;

  IF v_alocacao.status <> 'pendente_aprovacao' THEN
    RAISE EXCEPTION 'Esta alocação já foi respondida';
  END IF;

  v_status := CASE WHEN p_aprovar THEN 'aprovada'::public.status_alocacao_canal ELSE 'recusada'::public.status_alocacao_canal END;

  UPDATE public.alocacoes
  SET status = v_status,
      aprovado_por = auth.uid(),
      motivo_recusa = CASE WHEN p_aprovar THEN NULL ELSE p_justificativa END,
      data_aprovacao = now(),
      updated_at = now()
  WHERE id = p_alocacao_id;

  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_canal_dashboard_metrics(p_canal_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canal_id uuid;
  v_result jsonb;
BEGIN
  v_canal_id := COALESCE(p_canal_id, public.get_user_canal_id(auth.uid()));
  IF v_canal_id IS NULL OR NOT (public.is_canal_owner(v_canal_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Sem permissão para acessar métricas do Canal';
  END IF;

  SELECT jsonb_build_object(
    'consultores_ativos', (SELECT count(*) FROM public.canal_consultores WHERE canal_id = v_canal_id AND status = 'ativo'),
    'convites_pendentes', (SELECT count(*) FROM public.canal_convites WHERE canal_id = v_canal_id AND status = 'pendente'),
    'aprovacoes_pendentes', (SELECT count(*) FROM public.alocacoes WHERE canal_id = v_canal_id AND status = 'pendente_aprovacao'),
    'projetos_ativos', (SELECT count(DISTINCT projeto_id) FROM public.alocacoes WHERE canal_id = v_canal_id AND status = 'aprovada'),
    'valor_total_aprovado', COALESCE((SELECT sum(valor) FROM public.alocacoes WHERE canal_id = v_canal_id AND status = 'aprovada'), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_canal_convite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consultor_user_id uuid;
  v_canal_nome text;
BEGIN
  SELECT user_id INTO v_consultor_user_id FROM public.profiles WHERE lower(email) = lower(NEW.email) LIMIT 1;
  SELECT nome INTO v_canal_nome FROM public.canais WHERE id = NEW.canal_id;

  IF v_consultor_user_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      v_consultor_user_id,
      'convite_canal',
      'Convite de Canal recebido',
      'O Canal ' || COALESCE(v_canal_nome, 'parceiro') || ' convidou você para fazer parte da equipe de consultores.',
      NEW.id,
      'canal_convite'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_canal_convite ON public.canal_convites;
CREATE TRIGGER trg_notify_canal_convite
  AFTER INSERT ON public.canal_convites
  FOR EACH ROW EXECUTE FUNCTION public.notify_canal_convite();

CREATE OR REPLACE FUNCTION public.notify_canal_consultor_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canal record;
  v_consultor_nome text;
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT * INTO v_canal FROM public.canais WHERE id = NEW.canal_id;
    SELECT nome INTO v_consultor_nome FROM public.profiles WHERE user_id = NEW.consultor_user_id;

    IF NEW.status = 'ativo' THEN
      INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
      VALUES (v_canal.user_id, 'vinculo_aceito', 'Consultor aceitou o vínculo', COALESCE(v_consultor_nome, 'Um consultor') || ' agora está vinculado ao Canal.', NEW.id, 'canal_consultor');
    ELSIF NEW.status = 'recusado' THEN
      INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
      VALUES (v_canal.user_id, 'convite_recusado', 'Convite recusado', COALESCE(v_consultor_nome, 'Um consultor') || ' recusou o vínculo com o Canal.', NEW.id, 'canal_consultor');
    ELSIF NEW.status = 'desvinculado' THEN
      INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
      VALUES (NEW.consultor_user_id, 'canal_desvinculado', 'Vínculo encerrado', 'Seu vínculo com o Canal ' || COALESCE(v_canal.nome, '') || ' foi encerrado.', NEW.id, 'canal_consultor');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_canal_consultor_status ON public.canal_consultores;
CREATE TRIGGER trg_notify_canal_consultor_status
  AFTER INSERT OR UPDATE OF status ON public.canal_consultores
  FOR EACH ROW EXECUTE FUNCTION public.notify_canal_consultor_status();

CREATE OR REPLACE FUNCTION public.notify_alocacao_canal_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canal record;
  v_projeto record;
  v_consultor_nome text;
BEGIN
  SELECT * INTO v_canal FROM public.canais WHERE id = NEW.canal_id;
  SELECT * INTO v_projeto FROM public.projetos WHERE id = NEW.projeto_id;
  SELECT nome INTO v_consultor_nome FROM public.profiles WHERE user_id = NEW.consultor_user_id;

  IF TG_OP = 'INSERT' AND NEW.status = 'pendente_aprovacao' THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_canal.user_id, 'alocacao_pendente', 'Aprovação de alocação pendente', 'O projeto "' || COALESCE(v_projeto.nome, '') || '" solicitou ' || COALESCE(v_consultor_nome, 'um consultor') || '.', NEW.id, 'alocacao');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'aprovada' THEN
      INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
      VALUES (v_projeto.empresa_user_id, 'alocacao_aprovada', 'Alocação aprovada pelo Canal', 'O Canal ' || COALESCE(v_canal.nome, '') || ' aprovou a alocação de ' || COALESCE(v_consultor_nome, 'consultor') || '.', NEW.id, 'alocacao');
      INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
      VALUES (NEW.consultor_user_id, 'alocacao_aprovada', 'Alocação aprovada', 'O Canal aprovou sua participação no projeto "' || COALESCE(v_projeto.nome, '') || '".', NEW.id, 'alocacao');
    ELSIF NEW.status = 'recusada' THEN
      INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
      VALUES (v_projeto.empresa_user_id, 'alocacao_recusada', 'Alocação recusada pelo Canal', 'O Canal ' || COALESCE(v_canal.nome, '') || ' recusou a alocação de ' || COALESCE(v_consultor_nome, 'consultor') || '.', NEW.id, 'alocacao');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_alocacao_canal_status ON public.alocacoes;
CREATE TRIGGER trg_notify_alocacao_canal_status
  AFTER INSERT OR UPDATE OF status ON public.alocacoes
  FOR EACH ROW EXECUTE FUNCTION public.notify_alocacao_canal_status();

DROP TRIGGER IF EXISTS update_canais_updated_at ON public.canais;
CREATE TRIGGER update_canais_updated_at BEFORE UPDATE ON public.canais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_canal_convites_updated_at ON public.canal_convites;
CREATE TRIGGER update_canal_convites_updated_at BEFORE UPDATE ON public.canal_convites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_canal_consultores_updated_at ON public.canal_consultores;
CREATE TRIGGER update_canal_consultores_updated_at BEFORE UPDATE ON public.canal_consultores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_alocacoes_updated_at ON public.alocacoes;
CREATE TRIGGER update_alocacoes_updated_at BEFORE UPDATE ON public.alocacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();