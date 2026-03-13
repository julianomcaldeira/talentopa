
-- Messages table for project communication
CREATE TABLE public.mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  conteudo text NOT NULL,
  tipo text NOT NULL DEFAULT 'mensagem',
  moderado boolean NOT NULL DEFAULT false,
  bloqueado boolean NOT NULL DEFAULT false,
  motivo_bloqueio text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Project questions (forms) that empresa creates
CREATE TABLE public.projeto_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  pergunta text NOT NULL,
  obrigatoria boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Consultant answers to project questions
CREATE TABLE public.consultor_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta_id uuid NOT NULL REFERENCES public.projeto_perguntas(id) ON DELETE CASCADE,
  consultor_user_id uuid NOT NULL,
  resposta text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pergunta_id, consultor_user_id)
);

-- Enable RLS
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultor_respostas ENABLE ROW LEVEL SECURITY;

-- Mensagens policies
CREATE POLICY "Messages viewable by project participants" ON public.mensagens
  FOR SELECT TO authenticated
  USING (
    sender_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM projetos WHERE projetos.id = mensagens.projeto_id AND projetos.empresa_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM propostas WHERE propostas.projeto_id = mensagens.projeto_id AND propostas.consultor_user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Participants can send messages" ON public.mensagens
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_user_id
    AND (
      EXISTS (SELECT 1 FROM projetos WHERE projetos.id = mensagens.projeto_id AND projetos.empresa_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM propostas WHERE propostas.projeto_id = mensagens.projeto_id AND propostas.consultor_user_id = auth.uid())
    )
  );

-- Projeto perguntas policies
CREATE POLICY "Questions viewable by authenticated" ON public.projeto_perguntas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Companies can manage project questions" ON public.projeto_perguntas
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM projetos WHERE projetos.id = projeto_perguntas.projeto_id AND projetos.empresa_user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Consultor respostas policies
CREATE POLICY "Answers viewable by project participants" ON public.consultor_respostas
  FOR SELECT TO authenticated
  USING (
    consultor_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projeto_perguntas pp
      JOIN projetos p ON p.id = pp.projeto_id
      WHERE pp.id = consultor_respostas.pergunta_id AND p.empresa_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Consultants can insert own answers" ON public.consultor_respostas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = consultor_user_id);

CREATE POLICY "Consultants can update own answers" ON public.consultor_respostas
  FOR UPDATE TO authenticated
  USING (auth.uid() = consultor_user_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
