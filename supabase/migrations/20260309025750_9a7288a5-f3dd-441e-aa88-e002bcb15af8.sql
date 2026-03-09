
-- =====================================================
-- TalentOps Database Schema
-- =====================================================

-- Enum for user types
CREATE TYPE public.app_role AS ENUM ('admin', 'consultor', 'empresa');

-- Enum for seniority levels
CREATE TYPE public.nivel_senioridade AS ENUM ('junior', 'pleno', 'senior', 'especialista');

-- Enum for consultant subscription plans
CREATE TYPE public.plano_assinatura AS ENUM ('standard', 'premium');

-- Enum for project status
CREATE TYPE public.status_projeto AS ENUM ('rascunho', 'publicado', 'em_selecao', 'em_andamento', 'concluido', 'cancelado');

-- Enum for project phase status
CREATE TYPE public.status_fase AS ENUM ('pendente', 'em_andamento', 'aguardando_aprovacao', 'aprovada', 'reprovada', 'em_mediacao');

-- Enum for proposal status
CREATE TYPE public.status_proposta AS ENUM ('enviada', 'aceita', 'recusada');

-- =====================================================
-- 1. Timestamp trigger function
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =====================================================
-- 2. User Roles table
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: users can read their own roles, admins can manage all
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 3. Profiles table
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  cidade TEXT,
  estado TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 4. Consultant profiles
-- =====================================================
CREATE TABLE public.consultor_perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  linkedin TEXT,
  curriculo_url TEXT,
  bio_profissional TEXT,
  plano plano_assinatura NOT NULL DEFAULT 'standard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consultor_perfil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultant profiles viewable by authenticated" ON public.consultor_perfil
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Consultants can update own profile" ON public.consultor_perfil
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Consultants can insert own profile" ON public.consultor_perfil
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_consultor_perfil_updated_at
  BEFORE UPDATE ON public.consultor_perfil
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 5. Company profiles
-- =====================================================
CREATE TABLE public.empresa_perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  segmento TEXT,
  numero_funcionarios INTEGER,
  endereco TEXT,
  inscricao_estadual TEXT,
  dados_faturamento JSONB,
  dados_emissao_nf JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.empresa_perfil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company profiles viewable by authenticated" ON public.empresa_perfil
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Companies can update own profile" ON public.empresa_perfil
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Companies can insert own profile" ON public.empresa_perfil
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_empresa_perfil_updated_at
  BEFORE UPDATE ON public.empresa_perfil
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 6. ERP Softwares
-- =====================================================
CREATE TABLE public.softwares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  empresa_desenvolvedora TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.softwares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Softwares viewable by all authenticated" ON public.softwares
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage softwares" ON public.softwares
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_softwares_updated_at
  BEFORE UPDATE ON public.softwares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 7. Modules
-- =====================================================
CREATE TABLE public.modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id UUID REFERENCES public.softwares(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Modules viewable by authenticated" ON public.modulos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage modules" ON public.modulos
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_modulos_updated_at
  BEFORE UPDATE ON public.modulos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 8. Features / Funcionalidades
-- =====================================================
CREATE TABLE public.funcionalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id UUID REFERENCES public.modulos(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  horas_media_estimadas NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcionalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Features viewable by authenticated" ON public.funcionalidades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage features" ON public.funcionalidades
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_funcionalidades_updated_at
  BEFORE UPDATE ON public.funcionalidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 9. Templates
-- =====================================================
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates viewable by authenticated" ON public.templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage templates" ON public.templates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 10. Template features (junction)
-- =====================================================
CREATE TABLE public.template_funcionalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.templates(id) ON DELETE CASCADE NOT NULL,
  funcionalidade_id UUID REFERENCES public.funcionalidades(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(template_id, funcionalidade_id)
);

ALTER TABLE public.template_funcionalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Template features viewable by authenticated" ON public.template_funcionalidades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage template features" ON public.template_funcionalidades
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 11. Consultant skills
-- =====================================================
CREATE TABLE public.consultor_habilidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  software_id UUID REFERENCES public.softwares(id) ON DELETE CASCADE NOT NULL,
  modulo_id UUID REFERENCES public.modulos(id) ON DELETE CASCADE,
  funcionalidade_id UUID REFERENCES public.funcionalidades(id) ON DELETE CASCADE,
  nivel nivel_senioridade NOT NULL DEFAULT 'pleno',
  valor_hora NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consultor_habilidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Skills viewable by authenticated" ON public.consultor_habilidades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Consultants can manage own skills" ON public.consultor_habilidades
  FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- 12. Projects
-- =====================================================
CREATE TABLE public.projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  problema_atual TEXT,
  objetivo TEXT,
  prazo_estimado DATE,
  status status_projeto NOT NULL DEFAULT 'rascunho',
  software_id UUID REFERENCES public.softwares(id),
  template_id UUID REFERENCES public.templates(id),
  observacoes TEXT,
  protocolo TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published projects viewable by consultants" ON public.projetos
  FOR SELECT TO authenticated USING (
    status != 'rascunho' OR empresa_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Companies can create own projects" ON public.projetos
  FOR INSERT WITH CHECK (auth.uid() = empresa_user_id);

CREATE POLICY "Companies can update own projects" ON public.projetos
  FOR UPDATE USING (auth.uid() = empresa_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_projetos_updated_at
  BEFORE UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate project protocol
CREATE OR REPLACE FUNCTION public.generate_protocolo()
RETURNS TRIGGER AS $$
BEGIN
  NEW.protocolo := 'PRJ-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_project_protocolo
  BEFORE INSERT ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.generate_protocolo();

-- =====================================================
-- 13. Project modules (scope)
-- =====================================================
CREATE TABLE public.projeto_modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
  modulo_id UUID REFERENCES public.modulos(id) ON DELETE CASCADE NOT NULL,
  prazo_dias INTEGER,
  UNIQUE(projeto_id, modulo_id)
);

ALTER TABLE public.projeto_modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project modules viewable by authenticated" ON public.projeto_modulos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Companies can manage project modules" ON public.projeto_modulos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projetos WHERE id = projeto_id AND empresa_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- =====================================================
-- 14. Project features (scope)
-- =====================================================
CREATE TABLE public.projeto_funcionalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
  funcionalidade_id UUID REFERENCES public.funcionalidades(id) ON DELETE CASCADE NOT NULL,
  prazo_dias INTEGER,
  UNIQUE(projeto_id, funcionalidade_id)
);

ALTER TABLE public.projeto_funcionalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project features viewable by authenticated" ON public.projeto_funcionalidades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Companies can manage project features" ON public.projeto_funcionalidades
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projetos WHERE id = projeto_id AND empresa_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- =====================================================
-- 15. Project phases (entregáveis)
-- =====================================================
CREATE TABLE public.projeto_fases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  prazo DATE,
  valor NUMERIC(12,2),
  status status_fase NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_fases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project phases viewable by authenticated" ON public.projeto_fases
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Companies can manage phases" ON public.projeto_fases
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projetos WHERE id = projeto_id AND empresa_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_projeto_fases_updated_at
  BEFORE UPDATE ON public.projeto_fases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 16. Proposals (consultant applies to project)
-- =====================================================
CREATE TABLE public.propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
  consultor_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  estimativa_horas NUMERIC(10,2),
  valor_proposta NUMERIC(12,2),
  comentarios TEXT,
  status status_proposta NOT NULL DEFAULT 'enviada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(projeto_id, consultor_user_id)
);

ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proposals viewable by relevant parties" ON public.propostas
  FOR SELECT TO authenticated USING (
    consultor_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projetos WHERE id = projeto_id AND empresa_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Consultants can create proposals" ON public.propostas
  FOR INSERT WITH CHECK (auth.uid() = consultor_user_id);

CREATE POLICY "Consultants can update own proposals" ON public.propostas
  FOR UPDATE USING (auth.uid() = consultor_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_propostas_updated_at
  BEFORE UPDATE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 17. Reviews
-- =====================================================
CREATE TABLE public.avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
  avaliador_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  avaliado_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario TEXT,
  recomendacao BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(projeto_id, avaliador_user_id, avaliado_user_id)
);

ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews viewable by authenticated" ON public.avaliacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create reviews for their projects" ON public.avaliacoes
  FOR INSERT WITH CHECK (auth.uid() = avaliador_user_id);

-- =====================================================
-- 18. Auto-create profile on signup trigger
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    NEW.email
  );

  -- Insert role based on user metadata
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'tipo_usuario')::app_role, 'consultor')
  );

  -- Create consultant or company profile based on type
  IF COALESCE(NEW.raw_user_meta_data->>'tipo_usuario', 'consultor') = 'consultor' THEN
    INSERT INTO public.consultor_perfil (user_id) VALUES (NEW.id);
  ELSIF NEW.raw_user_meta_data->>'tipo_usuario' = 'empresa' THEN
    INSERT INTO public.empresa_perfil (user_id, razao_social)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', 'Empresa'));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 19. Seed initial ERP software data
-- =====================================================
INSERT INTO public.softwares (nome, descricao, empresa_desenvolvedora) VALUES
  ('TOTVS Protheus', 'ERP TOTVS Protheus para médias e grandes empresas', 'TOTVS'),
  ('TOTVS RM', 'ERP TOTVS RM para gestão corporativa', 'TOTVS'),
  ('SAP S/4HANA', 'ERP SAP de nova geração', 'SAP'),
  ('Oracle EBS', 'Oracle E-Business Suite', 'Oracle'),
  ('Fluig', 'Plataforma de processos e documentos TOTVS', 'TOTVS');
