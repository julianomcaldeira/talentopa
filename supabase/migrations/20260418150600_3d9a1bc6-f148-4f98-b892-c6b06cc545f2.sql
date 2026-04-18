-- Reuniões / Atas
CREATE TABLE public.projeto_reunioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  data_reuniao TIMESTAMPTZ NOT NULL,
  duracao_min INTEGER DEFAULT 60,
  link TEXT,
  pauta TEXT,
  ata TEXT,
  participantes UUID[] NOT NULL DEFAULT '{}',
  criado_por UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projeto_reunioes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reunioes view by parties" ON public.projeto_reunioes FOR SELECT
USING (
  has_role(auth.uid(),'admin')
  OR EXISTS(SELECT 1 FROM projetos p WHERE p.id=projeto_id AND is_empresa_team_member(auth.uid(),p.empresa_user_id))
  OR EXISTS(SELECT 1 FROM propostas pr WHERE pr.projeto_id=projeto_reunioes.projeto_id AND pr.consultor_user_id=auth.uid() AND pr.status='aceita')
);
CREATE POLICY "Reunioes insert by parties" ON public.projeto_reunioes FOR INSERT
WITH CHECK (
  criado_por = auth.uid() AND (
    EXISTS(SELECT 1 FROM projetos p WHERE p.id=projeto_id AND is_empresa_team_member(auth.uid(),p.empresa_user_id))
    OR EXISTS(SELECT 1 FROM propostas pr WHERE pr.projeto_id=projeto_reunioes.projeto_id AND pr.consultor_user_id=auth.uid() AND pr.status='aceita')
  )
);
CREATE POLICY "Reunioes update by parties" ON public.projeto_reunioes FOR UPDATE
USING (
  criado_por=auth.uid()
  OR EXISTS(SELECT 1 FROM projetos p WHERE p.id=projeto_id AND is_empresa_team_member(auth.uid(),p.empresa_user_id))
);
CREATE POLICY "Reunioes delete by creator" ON public.projeto_reunioes FOR DELETE
USING (criado_por=auth.uid() OR has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_reunioes_updated BEFORE UPDATE ON public.projeto_reunioes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Horas lançadas (timesheet)
CREATE TABLE public.projeto_horas_lancadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  fase_id UUID REFERENCES public.projeto_fases(id) ON DELETE SET NULL,
  consultor_user_id UUID NOT NULL,
  data_execucao DATE NOT NULL,
  horas NUMERIC(5,2) NOT NULL CHECK (horas > 0 AND horas <= 24),
  descricao TEXT,
  aprovado BOOLEAN,
  aprovado_por UUID,
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projeto_horas_lancadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Horas view by parties" ON public.projeto_horas_lancadas FOR SELECT
USING (
  has_role(auth.uid(),'admin')
  OR consultor_user_id = auth.uid()
  OR EXISTS(SELECT 1 FROM projetos p WHERE p.id=projeto_id AND is_empresa_team_member(auth.uid(),p.empresa_user_id))
);
CREATE POLICY "Consultor insere proprias horas" ON public.projeto_horas_lancadas FOR INSERT
WITH CHECK (
  consultor_user_id = auth.uid()
  AND EXISTS(SELECT 1 FROM propostas pr WHERE pr.projeto_id=projeto_horas_lancadas.projeto_id AND pr.consultor_user_id=auth.uid() AND pr.status='aceita')
);
CREATE POLICY "Consultor edita proprias horas pendentes" ON public.projeto_horas_lancadas FOR UPDATE
USING (consultor_user_id = auth.uid() AND aprovado IS NULL);
CREATE POLICY "Empresa aprova horas" ON public.projeto_horas_lancadas FOR UPDATE
USING (EXISTS(SELECT 1 FROM projetos p WHERE p.id=projeto_id AND is_empresa_team_member(auth.uid(),p.empresa_user_id)));
CREATE POLICY "Consultor deleta proprias horas pendentes" ON public.projeto_horas_lancadas FOR DELETE
USING (consultor_user_id = auth.uid() AND aprovado IS NULL);

CREATE TRIGGER trg_horas_updated BEFORE UPDATE ON public.projeto_horas_lancadas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atualiza empresa_aceitar_proposta: recusa demais imediatamente + notifica
CREATE OR REPLACE FUNCTION public.empresa_aceitar_proposta(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_proposta RECORD; v_projeto RECORD; v_rej RECORD;
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

  -- Recusa imediatamente os demais e notifica
  FOR v_rej IN
    SELECT id, consultor_user_id FROM propostas
    WHERE projeto_id = v_projeto.id AND id != p_proposta_id AND status = 'enviada'::status_proposta
  LOOP
    UPDATE propostas SET status='recusada'::status_proposta, updated_at=now() WHERE id = v_rej.id;
    INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_rej.consultor_user_id, 'info', 'Projeto em seleção avançada',
      'A empresa escolheu outro consultor para o projeto "'||v_projeto.nome||'". Sua proposta foi encerrada.',
      v_projeto.id, 'projeto');
  END LOOP;

  -- Notifica o escolhido
  INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (v_proposta.consultor_user_id, 'sucesso', 'Sua proposta foi escolhida!',
    'A empresa selecionou sua proposta para "'||v_projeto.nome||'". Confirme o início para começar a gestão compartilhada.',
    v_projeto.id, 'projeto');

  RETURN jsonb_build_object('success', true);
END $function$;