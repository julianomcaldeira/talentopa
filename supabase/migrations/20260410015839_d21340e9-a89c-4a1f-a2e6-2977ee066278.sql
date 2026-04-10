
-- 1. NOTIFICAÇÕES
CREATE TABLE public.notificacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'info',
  titulo text NOT NULL,
  mensagem text,
  lida boolean NOT NULL DEFAULT false,
  referencia_id uuid,
  referencia_tipo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notificacoes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notificacoes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_notificacoes_user_id ON public.notificacoes(user_id);
CREATE INDEX idx_notificacoes_lida ON public.notificacoes(user_id, lida);

-- 2. PAGAMENTOS
CREATE TYPE public.status_pagamento AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
CREATE TABLE public.pagamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id),
  proposta_id uuid NOT NULL REFERENCES public.propostas(id),
  empresa_user_id uuid NOT NULL,
  consultor_user_id uuid NOT NULL,
  valor_total numeric NOT NULL DEFAULT 0,
  comissao_plataforma numeric NOT NULL DEFAULT 0,
  valor_consultor numeric NOT NULL DEFAULT 0,
  status status_pagamento NOT NULL DEFAULT 'pendente',
  metodo_pagamento text,
  data_vencimento date,
  data_pagamento date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all payments" ON public.pagamentos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Companies can view own payments" ON public.pagamentos FOR SELECT TO authenticated USING (auth.uid() = empresa_user_id);
CREATE POLICY "Consultants can view own payments" ON public.pagamentos FOR SELECT TO authenticated USING (auth.uid() = consultor_user_id);
CREATE TRIGGER update_pagamentos_updated_at BEFORE UPDATE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. FATURAS
CREATE TYPE public.status_fatura AS ENUM ('rascunho', 'emitida', 'paga', 'cancelada');
CREATE TYPE public.tipo_fatura AS ENUM ('empresa', 'consultor', 'plataforma');
CREATE TABLE public.faturas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pagamento_id uuid NOT NULL REFERENCES public.pagamentos(id),
  numero_fatura text NOT NULL,
  empresa_user_id uuid,
  consultor_user_id uuid,
  valor numeric NOT NULL DEFAULT 0,
  tipo tipo_fatura NOT NULL,
  status status_fatura NOT NULL DEFAULT 'rascunho',
  pdf_url text,
  emitida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all invoices" ON public.faturas FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Companies can view own invoices" ON public.faturas FOR SELECT TO authenticated USING (auth.uid() = empresa_user_id);
CREATE POLICY "Consultants can view own invoices" ON public.faturas FOR SELECT TO authenticated USING (auth.uid() = consultor_user_id);
CREATE TRIGGER update_faturas_updated_at BEFORE UPDATE ON public.faturas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. ACEITAR PROPOSTA
CREATE OR REPLACE FUNCTION public.aceitar_proposta(p_proposta_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proposta RECORD; v_projeto RECORD; v_valor numeric; v_comissao numeric; v_pagamento_id uuid; v_rejected RECORD;
BEGIN
  SELECT * INTO v_proposta FROM propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  SELECT * INTO v_projeto FROM projetos WHERE id = v_proposta.projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF auth.uid() != v_projeto.empresa_user_id THEN RAISE EXCEPTION 'Apenas o dono do projeto pode aceitar propostas'; END IF;
  IF v_proposta.status != 'enviada' THEN RAISE EXCEPTION 'Proposta já foi processada'; END IF;
  v_valor := COALESCE(v_proposta.valor_proposta, 0);
  v_comissao := ROUND(v_valor * 0.15, 2);
  UPDATE propostas SET status = 'aceita', updated_at = now() WHERE id = p_proposta_id;
  UPDATE projetos SET status = 'em_andamento', updated_at = now() WHERE id = v_projeto.id;
  UPDATE propostas SET status = 'recusada', updated_at = now() WHERE projeto_id = v_projeto.id AND id != p_proposta_id AND status = 'enviada';
  INSERT INTO pagamentos (projeto_id, proposta_id, empresa_user_id, consultor_user_id, valor_total, comissao_plataforma, valor_consultor)
  VALUES (v_projeto.id, p_proposta_id, v_projeto.empresa_user_id, v_proposta.consultor_user_id, v_valor, v_comissao, v_valor - v_comissao)
  RETURNING id INTO v_pagamento_id;
  INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (v_proposta.consultor_user_id, 'sucesso', 'Proposta aceita!', 'Sua proposta para o projeto "' || v_projeto.nome || '" foi aceita.', v_projeto.id, 'projeto');
  FOR v_rejected IN SELECT consultor_user_id FROM propostas WHERE projeto_id = v_projeto.id AND id != p_proposta_id AND status = 'recusada' LOOP
    INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_rejected.consultor_user_id, 'info', 'Proposta não selecionada', 'Sua proposta para o projeto "' || v_projeto.nome || '" não foi selecionada.', v_projeto.id, 'projeto');
  END LOOP;
  INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (v_projeto.empresa_user_id, 'sucesso', 'Consultor selecionado', 'O projeto "' || v_projeto.nome || '" está em andamento.', v_projeto.id, 'projeto');
  RETURN jsonb_build_object('success', true, 'pagamento_id', v_pagamento_id);
END; $$;

-- 5. CONCLUIR PROJETO
CREATE OR REPLACE FUNCTION public.concluir_projeto(p_projeto_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_projeto RECORD; v_consultor RECORD;
BEGIN
  SELECT * INTO v_projeto FROM projetos WHERE id = p_projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF auth.uid() != v_projeto.empresa_user_id AND NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF v_projeto.status != 'em_andamento' THEN RAISE EXCEPTION 'Projeto precisa estar em andamento'; END IF;
  UPDATE projetos SET status = 'concluido', updated_at = now() WHERE id = p_projeto_id;
  INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (v_projeto.empresa_user_id, 'sucesso', 'Projeto concluído', 'O projeto "' || v_projeto.nome || '" foi concluído!', p_projeto_id, 'projeto');
  FOR v_consultor IN SELECT consultor_user_id FROM propostas WHERE projeto_id = p_projeto_id AND status = 'aceita' LOOP
    INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_consultor.consultor_user_id, 'sucesso', 'Projeto concluído', 'O projeto "' || v_projeto.nome || '" foi concluído!', p_projeto_id, 'projeto');
  END LOOP;
  RETURN jsonb_build_object('success', true);
END; $$;

-- 6. TRIGGER: NOVA PROPOSTA
CREATE OR REPLACE FUNCTION public.notify_nova_proposta() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_projeto RECORD; v_nome text;
BEGIN
  SELECT * INTO v_projeto FROM projetos WHERE id = NEW.projeto_id;
  SELECT nome INTO v_nome FROM profiles WHERE user_id = NEW.consultor_user_id;
  INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (v_projeto.empresa_user_id, 'info', 'Nova proposta recebida', 'O consultor ' || COALESCE(v_nome, 'Anônimo') || ' enviou uma proposta para "' || v_projeto.nome || '".', NEW.projeto_id, 'projeto');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_nova_proposta AFTER INSERT ON public.propostas FOR EACH ROW EXECUTE FUNCTION public.notify_nova_proposta();

-- 7. TRIGGER: NOVA MENSAGEM
CREATE OR REPLACE FUNCTION public.notify_nova_mensagem() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_projeto RECORD; v_nome text; v_p RECORD;
BEGIN
  SELECT * INTO v_projeto FROM projetos WHERE id = NEW.projeto_id;
  SELECT nome INTO v_nome FROM profiles WHERE user_id = NEW.sender_user_id;
  IF v_projeto.empresa_user_id != NEW.sender_user_id THEN
    INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_projeto.empresa_user_id, 'mensagem', 'Nova mensagem', COALESCE(v_nome, 'Alguém') || ' enviou uma mensagem em "' || v_projeto.nome || '".', NEW.projeto_id, 'projeto');
  END IF;
  FOR v_p IN SELECT consultor_user_id FROM propostas WHERE projeto_id = NEW.projeto_id AND status = 'aceita' AND consultor_user_id != NEW.sender_user_id LOOP
    INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_p.consultor_user_id, 'mensagem', 'Nova mensagem', COALESCE(v_nome, 'Alguém') || ' enviou uma mensagem em "' || v_projeto.nome || '".', NEW.projeto_id, 'projeto');
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_nova_mensagem AFTER INSERT ON public.mensagens FOR EACH ROW EXECUTE FUNCTION public.notify_nova_mensagem();

-- 8. TRIGGER: FASE STATUS
CREATE OR REPLACE FUNCTION public.notify_fase_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_projeto RECORD; v_p RECORD; v_label text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT * INTO v_projeto FROM projetos WHERE id = NEW.projeto_id;
    v_label := CASE NEW.status WHEN 'em_andamento' THEN 'iniciada' WHEN 'aguardando_aprovacao' THEN 'aguardando aprovação' WHEN 'aprovada' THEN 'aprovada' WHEN 'reprovada' THEN 'reprovada' WHEN 'em_mediacao' THEN 'em mediação' ELSE NEW.status::text END;
    INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_projeto.empresa_user_id, 'info', 'Fase atualizada', 'A fase "' || NEW.nome || '" de "' || v_projeto.nome || '" foi ' || v_label || '.', NEW.projeto_id, 'projeto');
    FOR v_p IN SELECT consultor_user_id FROM propostas WHERE projeto_id = NEW.projeto_id AND status = 'aceita' LOOP
      INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
      VALUES (v_p.consultor_user_id, 'info', 'Fase atualizada', 'A fase "' || NEW.nome || '" de "' || v_projeto.nome || '" foi ' || v_label || '.', NEW.projeto_id, 'projeto');
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_fase_status AFTER UPDATE ON public.projeto_fases FOR EACH ROW EXECUTE FUNCTION public.notify_fase_status();

-- 9. REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
