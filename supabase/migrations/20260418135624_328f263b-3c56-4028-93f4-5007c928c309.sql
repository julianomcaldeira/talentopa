-- Helper: envia notificação para usuários de uma empresa com um papel específico
CREATE OR REPLACE FUNCTION public.notify_empresa_por_papel(
  p_empresa_user_id uuid,
  p_papel papel_empresa_usuario,
  p_tipo text,
  p_titulo text,
  p_mensagem text,
  p_referencia_id uuid,
  p_referencia_tipo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_count int := 0;
BEGIN
  -- Notifica todos os usuários vinculados à empresa com o papel solicitado
  FOR v_user IN
    SELECT user_id FROM empresa_usuarios
    WHERE empresa_user_id = p_empresa_user_id AND papel = p_papel
  LOOP
    INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_user.user_id, p_tipo, p_titulo, p_mensagem, p_referencia_id, p_referencia_tipo);
    v_count := v_count + 1;
  END LOOP;

  -- Fallback: se ninguém tem esse papel, envia para o dono da conta empresa
  IF v_count = 0 THEN
    INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (p_empresa_user_id, p_tipo, p_titulo, p_mensagem, p_referencia_id, p_referencia_tipo);
  END IF;
END;
$$;

-- =========================================================
-- NOVA PROPOSTA → responsável (decisão)
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_nova_proposta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_projeto RECORD; v_nome text;
BEGIN
  SELECT * INTO v_projeto FROM projetos WHERE id = NEW.projeto_id;
  SELECT nome INTO v_nome FROM profiles WHERE user_id = NEW.consultor_user_id;

  PERFORM notify_empresa_por_papel(
    v_projeto.empresa_user_id,
    'responsavel'::papel_empresa_usuario,
    'info',
    'Nova proposta recebida',
    'O consultor ' || COALESCE(v_nome, 'Anônimo') || ' enviou uma proposta para "' || v_projeto.nome || '".',
    NEW.projeto_id,
    'projeto'
  );
  RETURN NEW;
END; $$;

-- =========================================================
-- NOVA MENSAGEM → operacional
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_nova_mensagem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_projeto RECORD; v_nome text; v_p RECORD;
BEGIN
  SELECT * INTO v_projeto FROM projetos WHERE id = NEW.projeto_id;
  SELECT nome INTO v_nome FROM profiles WHERE user_id = NEW.sender_user_id;

  -- Notifica operacional da empresa (exceto se o próprio remetente for da empresa)
  IF v_projeto.empresa_user_id != NEW.sender_user_id
     AND NOT EXISTS (SELECT 1 FROM empresa_usuarios WHERE empresa_user_id = v_projeto.empresa_user_id AND user_id = NEW.sender_user_id)
  THEN
    PERFORM notify_empresa_por_papel(
      v_projeto.empresa_user_id,
      'operacional'::papel_empresa_usuario,
      'mensagem',
      'Nova mensagem',
      COALESCE(v_nome, 'Alguém') || ' enviou uma mensagem em "' || v_projeto.nome || '".',
      NEW.projeto_id,
      'projeto'
    );
  END IF;

  -- Notifica consultores aceitos (mantém comportamento)
  FOR v_p IN
    SELECT consultor_user_id FROM propostas
    WHERE projeto_id = NEW.projeto_id AND status = 'aceita' AND consultor_user_id != NEW.sender_user_id
  LOOP
    INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_p.consultor_user_id, 'mensagem', 'Nova mensagem',
      COALESCE(v_nome, 'Alguém') || ' enviou uma mensagem em "' || v_projeto.nome || '".',
      NEW.projeto_id, 'projeto');
  END LOOP;
  RETURN NEW;
END; $$;

-- =========================================================
-- ACEITAR PROPOSTA → responsável recebe confirmação; pagamento criado vai p/ financeiro
-- =========================================================
CREATE OR REPLACE FUNCTION public.aceitar_proposta(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposta RECORD; v_projeto RECORD; v_valor numeric; v_comissao numeric; v_pagamento_id uuid; v_rejected RECORD;
BEGIN
  SELECT * INTO v_proposta FROM propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  SELECT * INTO v_projeto FROM projetos WHERE id = v_proposta.projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF auth.uid() != v_projeto.empresa_user_id
     AND NOT EXISTS (SELECT 1 FROM empresa_usuarios WHERE empresa_user_id = v_projeto.empresa_user_id AND user_id = auth.uid() AND papel = 'responsavel')
  THEN
    RAISE EXCEPTION 'Apenas o responsável pode aceitar propostas';
  END IF;
  IF v_proposta.status != 'enviada' THEN RAISE EXCEPTION 'Proposta já foi processada'; END IF;
  v_valor := COALESCE(v_proposta.valor_proposta, 0);
  v_comissao := ROUND(v_valor * 0.15, 2);
  UPDATE propostas SET status = 'aceita', updated_at = now() WHERE id = p_proposta_id;
  UPDATE projetos SET status = 'em_andamento', updated_at = now() WHERE id = v_projeto.id;
  UPDATE propostas SET status = 'recusada', updated_at = now()
    WHERE projeto_id = v_projeto.id AND id != p_proposta_id AND status = 'enviada';
  INSERT INTO pagamentos (projeto_id, proposta_id, empresa_user_id, consultor_user_id, valor_total, comissao_plataforma, valor_consultor)
  VALUES (v_projeto.id, p_proposta_id, v_projeto.empresa_user_id, v_proposta.consultor_user_id, v_valor, v_comissao, v_valor - v_comissao)
  RETURNING id INTO v_pagamento_id;

  -- Consultor (mantém)
  INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (v_proposta.consultor_user_id, 'sucesso', 'Proposta aceita!',
    'Sua proposta para o projeto "' || v_projeto.nome || '" foi aceita.', v_projeto.id, 'projeto');

  -- Recusados (mantém)
  FOR v_rejected IN
    SELECT consultor_user_id FROM propostas
    WHERE projeto_id = v_projeto.id AND id != p_proposta_id AND status = 'recusada'
  LOOP
    INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_rejected.consultor_user_id, 'info', 'Proposta não selecionada',
      'Sua proposta para o projeto "' || v_projeto.nome || '" não foi selecionada.', v_projeto.id, 'projeto');
  END LOOP;

  -- Empresa: responsável → decisão confirmada
  PERFORM notify_empresa_por_papel(
    v_projeto.empresa_user_id, 'responsavel'::papel_empresa_usuario,
    'sucesso', 'Consultor selecionado',
    'O projeto "' || v_projeto.nome || '" está em andamento.', v_projeto.id, 'projeto'
  );

  RETURN jsonb_build_object('success', true, 'pagamento_id', v_pagamento_id);
END; $$;

-- =========================================================
-- CONCLUIR PROJETO → responsável (decisão / encerramento)
-- =========================================================
CREATE OR REPLACE FUNCTION public.concluir_projeto(p_projeto_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_projeto RECORD; v_consultor RECORD;
BEGIN
  SELECT * INTO v_projeto FROM projetos WHERE id = p_projeto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF auth.uid() != v_projeto.empresa_user_id
     AND NOT has_role(auth.uid(), 'admin')
     AND NOT EXISTS (SELECT 1 FROM empresa_usuarios WHERE empresa_user_id = v_projeto.empresa_user_id AND user_id = auth.uid() AND papel = 'responsavel')
  THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF v_projeto.status != 'em_andamento' THEN RAISE EXCEPTION 'Projeto precisa estar em andamento'; END IF;
  UPDATE projetos SET status = 'concluido', updated_at = now() WHERE id = p_projeto_id;

  PERFORM notify_empresa_por_papel(
    v_projeto.empresa_user_id, 'responsavel'::papel_empresa_usuario,
    'sucesso', 'Projeto concluído',
    'O projeto "' || v_projeto.nome || '" foi concluído!', p_projeto_id, 'projeto'
  );

  FOR v_consultor IN SELECT consultor_user_id FROM propostas WHERE projeto_id = p_projeto_id AND status = 'aceita' LOOP
    INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_consultor.consultor_user_id, 'sucesso', 'Projeto concluído',
      'O projeto "' || v_projeto.nome || '" foi concluído!', p_projeto_id, 'projeto');
  END LOOP;
  RETURN jsonb_build_object('success', true);
END; $$;

-- =========================================================
-- TRIGGER NOVO: pagamentos → financeiro
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_pagamento_financeiro_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_projeto_nome text;
BEGIN
  SELECT nome INTO v_projeto_nome FROM projetos WHERE id = NEW.projeto_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM notify_empresa_por_papel(
      NEW.empresa_user_id, 'financeiro'::papel_empresa_usuario,
      'info', 'Novo pagamento gerado',
      'Pagamento de R$ ' || NEW.valor_total || ' criado para o projeto "' || COALESCE(v_projeto_nome,'?') || '".',
      NEW.id, 'pagamento'
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM notify_empresa_por_papel(
      NEW.empresa_user_id, 'financeiro'::papel_empresa_usuario,
      CASE WHEN NEW.status='pago' THEN 'sucesso' WHEN NEW.status='atrasado' THEN 'alerta' ELSE 'info' END,
      'Pagamento atualizado',
      'Pagamento do projeto "' || COALESCE(v_projeto_nome,'?') || '" agora está ' || NEW.status || ' (R$ ' || NEW.valor_total || ').',
      NEW.id, 'pagamento'
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notify_pagamento_financeiro ON public.pagamentos;
CREATE TRIGGER notify_pagamento_financeiro
AFTER INSERT OR UPDATE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.notify_pagamento_financeiro_trg();

-- =========================================================
-- TRIGGER NOVO: faturas → financeiro
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_fatura_financeiro_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_user_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM notify_empresa_por_papel(
      NEW.empresa_user_id, 'financeiro'::papel_empresa_usuario,
      'info', 'Nova fatura emitida',
      'Fatura ' || NEW.numero_fatura || ' no valor de R$ ' || NEW.valor || ' foi gerada.',
      NEW.id, 'fatura'
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM notify_empresa_por_papel(
      NEW.empresa_user_id, 'financeiro'::papel_empresa_usuario,
      CASE WHEN NEW.status='paga' THEN 'sucesso' WHEN NEW.status='cancelada' THEN 'alerta' ELSE 'info' END,
      'Fatura atualizada',
      'Fatura ' || NEW.numero_fatura || ' agora está: ' || NEW.status || '.',
      NEW.id, 'fatura'
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notify_fatura_financeiro ON public.faturas;
CREATE TRIGGER notify_fatura_financeiro
AFTER INSERT OR UPDATE ON public.faturas
FOR EACH ROW EXECUTE FUNCTION public.notify_fatura_financeiro_trg();