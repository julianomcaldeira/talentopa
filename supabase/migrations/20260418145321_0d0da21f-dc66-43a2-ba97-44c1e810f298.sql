
-- Tabela de entregáveis por fase
CREATE TABLE IF NOT EXISTS public.projeto_entregaveis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  fase_id UUID REFERENCES public.projeto_fases(id) ON DELETE SET NULL,
  uploader_user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'arquivo',
  arquivo_url TEXT,
  link_url TEXT,
  aprovado BOOLEAN,
  aprovado_em TIMESTAMPTZ,
  aprovado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_entregaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entregaveis viewable by project parties"
ON public.projeto_entregaveis FOR SELECT
USING (
  has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_id AND is_empresa_team_member(auth.uid(), p.empresa_user_id))
  OR EXISTS (SELECT 1 FROM propostas pr WHERE pr.projeto_id = projeto_entregaveis.projeto_id AND pr.consultor_user_id = auth.uid() AND pr.status IN ('aceita','aguardando_consultor'))
);

CREATE POLICY "Project parties can insert entregaveis"
ON public.projeto_entregaveis FOR INSERT
WITH CHECK (
  uploader_user_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_id AND is_empresa_team_member(auth.uid(), p.empresa_user_id))
    OR EXISTS (SELECT 1 FROM propostas pr WHERE pr.projeto_id = projeto_entregaveis.projeto_id AND pr.consultor_user_id = auth.uid() AND pr.status = 'aceita')
  )
);

CREATE POLICY "Empresa team can update entregaveis"
ON public.projeto_entregaveis FOR UPDATE
USING (EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_id AND is_empresa_team_member(auth.uid(), p.empresa_user_id)))
WITH CHECK (EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_id AND is_empresa_team_member(auth.uid(), p.empresa_user_id)));

CREATE POLICY "Uploader can delete own entregavel"
ON public.projeto_entregaveis FOR DELETE
USING (uploader_user_id = auth.uid() OR has_role(auth.uid(),'admin'));

-- Bucket de entregáveis (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('entregaveis','entregaveis', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Entregaveis storage read for project parties"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'entregaveis' AND (
    has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM projetos p WHERE p.id::text = (storage.foldername(name))[1] AND is_empresa_team_member(auth.uid(), p.empresa_user_id))
    OR EXISTS (SELECT 1 FROM propostas pr WHERE pr.projeto_id::text = (storage.foldername(name))[1] AND pr.consultor_user_id = auth.uid() AND pr.status IN ('aceita','aguardando_consultor'))
  )
);

CREATE POLICY "Entregaveis storage insert for project parties"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'entregaveis' AND (
    EXISTS (SELECT 1 FROM projetos p WHERE p.id::text = (storage.foldername(name))[1] AND is_empresa_team_member(auth.uid(), p.empresa_user_id))
    OR EXISTS (SELECT 1 FROM propostas pr WHERE pr.projeto_id::text = (storage.foldername(name))[1] AND pr.consultor_user_id = auth.uid() AND pr.status = 'aceita')
  )
);

CREATE POLICY "Entregaveis storage delete by owner or admin"
ON storage.objects FOR DELETE
USING (bucket_id = 'entregaveis' AND (owner = auth.uid() OR has_role(auth.uid(),'admin')));

-- RPC: empresa escolhe proposta -> aguardando consultor
CREATE OR REPLACE FUNCTION public.empresa_aceitar_proposta(p_proposta_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_proposta RECORD; v_projeto RECORD;
BEGIN
  SELECT * INTO v_proposta FROM propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  SELECT * INTO v_projeto FROM projetos WHERE id = v_proposta.projeto_id;

  IF auth.uid() != v_projeto.empresa_user_id
     AND NOT EXISTS (SELECT 1 FROM empresa_usuarios WHERE empresa_user_id = v_projeto.empresa_user_id AND user_id = auth.uid() AND papel IN ('responsavel','operacional'))
  THEN
    RAISE EXCEPTION 'Sem permissão para aceitar propostas';
  END IF;

  IF v_proposta.status != 'enviada' THEN RAISE EXCEPTION 'Proposta já foi processada'; END IF;

  UPDATE propostas SET status = 'aguardando_consultor'::status_proposta, updated_at = now() WHERE id = p_proposta_id;
  UPDATE projetos SET status = 'em_selecao'::status_projeto, updated_at = now() WHERE id = v_projeto.id;

  INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (v_proposta.consultor_user_id, 'sucesso', 'Sua proposta foi escolhida!',
    'A empresa selecionou sua proposta para "'||v_projeto.nome||'". Confirme o início para começar a gestão compartilhada.',
    v_projeto.id, 'projeto');

  RETURN jsonb_build_object('success', true);
END $$;

-- RPC: consultor confirma -> projeto inicia, gera pagamento e recusa demais
CREATE OR REPLACE FUNCTION public.consultor_confirmar_inicio(p_proposta_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_proposta RECORD; v_projeto RECORD; v_valor NUMERIC; v_comissao NUMERIC; v_pagamento_id UUID; v_rej RECORD;
BEGIN
  SELECT * INTO v_proposta FROM propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF v_proposta.consultor_user_id != auth.uid() THEN RAISE EXCEPTION 'Apenas o consultor pode confirmar'; END IF;
  IF v_proposta.status != 'aguardando_consultor'::status_proposta THEN RAISE EXCEPTION 'Proposta não está aguardando confirmação'; END IF;

  SELECT * INTO v_projeto FROM projetos WHERE id = v_proposta.projeto_id;
  v_valor := COALESCE(v_proposta.valor_proposta, 0);
  v_comissao := ROUND(v_valor * 0.15, 2);

  UPDATE propostas SET status = 'aceita'::status_proposta, updated_at = now() WHERE id = p_proposta_id;
  UPDATE projetos SET status = 'em_andamento'::status_projeto, updated_at = now() WHERE id = v_projeto.id;
  UPDATE propostas SET status = 'recusada'::status_proposta, updated_at = now()
    WHERE projeto_id = v_projeto.id AND id != p_proposta_id AND status = 'enviada'::status_proposta;

  INSERT INTO pagamentos (projeto_id, proposta_id, empresa_user_id, consultor_user_id, valor_total, comissao_plataforma, valor_consultor)
  VALUES (v_projeto.id, p_proposta_id, v_projeto.empresa_user_id, v_proposta.consultor_user_id, v_valor, v_comissao, v_valor - v_comissao)
  RETURNING id INTO v_pagamento_id;

  PERFORM notify_empresa_por_papel(
    v_projeto.empresa_user_id, 'responsavel'::papel_empresa_usuario,
    'sucesso', 'Consultor confirmou o início',
    'O consultor confirmou e o projeto "'||v_projeto.nome||'" está em andamento.',
    v_projeto.id, 'projeto'
  );

  FOR v_rej IN SELECT consultor_user_id FROM propostas
    WHERE projeto_id = v_projeto.id AND id != p_proposta_id AND status = 'recusada'::status_proposta
  LOOP
    INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_rej.consultor_user_id, 'info', 'Proposta não selecionada',
      'Sua proposta para "'||v_projeto.nome||'" não foi selecionada.', v_projeto.id, 'projeto');
  END LOOP;

  RETURN jsonb_build_object('success', true, 'pagamento_id', v_pagamento_id);
END $$;

-- RPC: consultor recusa o início após escolha da empresa
CREATE OR REPLACE FUNCTION public.consultor_recusar_inicio(p_proposta_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_proposta RECORD; v_projeto RECORD;
BEGIN
  SELECT * INTO v_proposta FROM propostas WHERE id = p_proposta_id;
  IF v_proposta.consultor_user_id != auth.uid() THEN RAISE EXCEPTION 'Apenas o consultor pode recusar'; END IF;
  IF v_proposta.status != 'aguardando_consultor'::status_proposta THEN RAISE EXCEPTION 'Proposta não está aguardando confirmação'; END IF;
  SELECT * INTO v_projeto FROM projetos WHERE id = v_proposta.projeto_id;

  UPDATE propostas SET status = 'recusada'::status_proposta, updated_at = now() WHERE id = p_proposta_id;
  UPDATE projetos SET status = 'publicado'::status_projeto, updated_at = now() WHERE id = v_projeto.id;

  PERFORM notify_empresa_por_papel(
    v_projeto.empresa_user_id, 'responsavel'::papel_empresa_usuario,
    'alerta', 'Consultor recusou o início',
    'O consultor recusou iniciar o projeto "'||v_projeto.nome||'". Selecione outra proposta.',
    v_projeto.id, 'projeto'
  );
  RETURN jsonb_build_object('success', true);
END $$;

-- RPC: atualizar status/horas de fase
CREATE OR REPLACE FUNCTION public.atualizar_fase(
  p_fase_id UUID,
  p_status status_fase DEFAULT NULL,
  p_horas_executadas NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_fase RECORD; v_projeto RECORD; v_is_consultor BOOLEAN; v_is_empresa BOOLEAN;
BEGIN
  SELECT * INTO v_fase FROM projeto_fases WHERE id = p_fase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fase não encontrada'; END IF;
  SELECT * INTO v_projeto FROM projetos WHERE id = v_fase.projeto_id;

  v_is_empresa := is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id);
  v_is_consultor := EXISTS (SELECT 1 FROM propostas WHERE projeto_id = v_projeto.id AND consultor_user_id = auth.uid() AND status = 'aceita'::status_proposta);

  IF NOT (v_is_empresa OR v_is_consultor OR has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF v_is_consultor AND NOT v_is_empresa AND p_status IN ('aprovada'::status_fase,'reprovada'::status_fase) THEN
    RAISE EXCEPTION 'Apenas a empresa pode aprovar ou reprovar fases';
  END IF;

  UPDATE projeto_fases
     SET status = COALESCE(p_status, status),
         horas_executadas = COALESCE(p_horas_executadas, horas_executadas),
         updated_at = now()
   WHERE id = p_fase_id;

  RETURN jsonb_build_object('success', true);
END $$;
