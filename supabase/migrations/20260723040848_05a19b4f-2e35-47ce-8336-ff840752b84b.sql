
-- 1) Notificação: nova demanda publicada (roteamento_v2) para canais com consultores elegíveis
CREATE OR REPLACE FUNCTION public.notificar_canais_nova_demanda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_canal record;
BEGIN
  -- só dispara quando o projeto entra em 'publicado' e é v2
  IF NEW.roteamento_v2 IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.status <> 'publicado'::public.status_projeto THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.software_id IS NULL THEN RETURN NEW; END IF;

  FOR v_canal IN
    SELECT DISTINCT c.id, c.user_id, c.nome
      FROM public.canais c
      JOIN public.canal_consultores cc
        ON cc.canal_id = c.id AND cc.status = 'ativo'
      JOIN public.consultor_habilidades ch
        ON ch.user_id = cc.consultor_user_id
       AND ch.software_id = NEW.software_id
     WHERE c.user_id IS NOT NULL
  LOOP
    -- idempotência: não duplica notificação para o mesmo canal/projeto
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    SELECT v_canal.user_id, 'info',
           'Nova demanda com consultores elegíveis do seu quadro',
           'A demanda "' || NEW.nome || '" foi publicada e há consultores do seu quadro aderentes ao perfil.',
           NEW.id, 'projeto'
     WHERE NOT EXISTS (
       SELECT 1 FROM public.notificacoes n
        WHERE n.user_id = v_canal.user_id
          AND n.referencia_id = NEW.id
          AND n.referencia_tipo = 'projeto'
          AND n.titulo = 'Nova demanda com consultores elegíveis do seu quadro'
     );
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notificar_canais_nova_demanda_ins ON public.projetos;
DROP TRIGGER IF EXISTS trg_notificar_canais_nova_demanda_upd ON public.projetos;

CREATE TRIGGER trg_notificar_canais_nova_demanda_ins
AFTER INSERT ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.notificar_canais_nova_demanda();

CREATE TRIGGER trg_notificar_canais_nova_demanda_upd
AFTER UPDATE OF status ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.notificar_canais_nova_demanda();


-- 2) Notificação: parceiro envia resposta -> avisa empresa dona do projeto
CREATE OR REPLACE FUNCTION public.notificar_empresa_resposta_parceiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_projeto record;
  v_canal record;
  v_count int;
BEGIN
  SELECT * INTO v_projeto FROM public.projetos WHERE id = NEW.projeto_id;
  IF NOT FOUND OR v_projeto.empresa_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_canal FROM public.canais WHERE id = NEW.canal_id;

  SELECT count(*) INTO v_count
    FROM public.parceiro_indicacoes
   WHERE resposta_id = NEW.id
     AND status = 'indicado';

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  SELECT v_projeto.empresa_user_id, 'info',
         'Nova resposta de parceiro',
         'O parceiro ' || COALESCE(v_canal.nome, 'parceiro') || ' indicou ' ||
           COALESCE(v_count,0) || ' consultor(es) para a demanda "' || v_projeto.nome || '".',
         v_projeto.id, 'projeto'
   WHERE NOT EXISTS (
     SELECT 1 FROM public.notificacoes n
      WHERE n.user_id = v_projeto.empresa_user_id
        AND n.referencia_id = v_projeto.id
        AND n.referencia_tipo = 'projeto'
        AND n.titulo = 'Nova resposta de parceiro'
        AND n.created_at > now() - interval '2 minutes'
   );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notificar_empresa_resposta_parceiro ON public.parceiro_respostas;
CREATE TRIGGER trg_notificar_empresa_resposta_parceiro
AFTER INSERT ON public.parceiro_respostas
FOR EACH ROW EXECUTE FUNCTION public.notificar_empresa_resposta_parceiro();


-- 3) Ajuste dos textos de notificação na seleção da indicação (sem duplicar triggers)
CREATE OR REPLACE FUNCTION public.empresa_selecionar_indicacao(p_indicacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ind record;
  v_resp record;
  v_projeto record;
  v_canal record;
  v_consultor_nome text;
  v_other_ind record;
  v_other_prop record;
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

  SELECT * INTO v_canal FROM public.canais WHERE id = v_ind.canal_id;
  SELECT COALESCE(nome, 'consultor') INTO v_consultor_nome
    FROM public.profiles WHERE user_id = v_ind.consultor_user_id;

  UPDATE public.parceiro_indicacoes SET status = 'selecionado' WHERE id = p_indicacao_id;

  FOR v_other_ind IN
    SELECT pi.id, pi.consultor_user_id, pi.canal_id, pr.projeto_id
      FROM public.parceiro_indicacoes pi
      JOIN public.parceiro_respostas pr ON pr.id = pi.resposta_id
     WHERE pr.projeto_id = v_projeto.id
       AND pi.id <> p_indicacao_id
       AND pi.status = 'indicado'
  LOOP
    UPDATE public.parceiro_indicacoes SET status = 'recusado' WHERE id = v_other_ind.id;

    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_other_ind.consultor_user_id, 'aviso', 'Indicação não selecionada',
      'A empresa selecionou outro consultor para "' || v_projeto.nome || '".',
      v_projeto.id, 'projeto');
  END LOOP;

  FOR v_other_prop IN
    SELECT id, consultor_user_id FROM public.propostas
     WHERE projeto_id = v_projeto.id
       AND status IN ('enviada'::public.status_proposta,
                      'pre_aprovada'::public.status_proposta,
                      'contraproposta_consultor'::public.status_proposta)
  LOOP
    UPDATE public.propostas
       SET status = 'recusada'::public.status_proposta, updated_at = now()
     WHERE id = v_other_prop.id;

    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (v_other_prop.consultor_user_id, 'aviso', 'Proposta não selecionada',
      'A empresa selecionou outro consultor para "' || v_projeto.nome || '".',
      v_projeto.id, 'projeto');
  END LOOP;

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

  -- consultor selecionado (texto ajustado)
  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    v_ind.consultor_user_id, 'sucesso', 'Você foi selecionado',
    'Você foi selecionado para a demanda "' || v_projeto.nome || '" via parceiro ' ||
      COALESCE(v_canal.nome, 'parceiro') || '.',
    v_projeto.id, 'projeto'
  );

  -- dono do canal (texto ajustado com nome do consultor e da demanda)
  IF v_canal.user_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      v_canal.user_id, 'sucesso', 'Indicação aceita pela empresa',
      'Seu consultor ' || v_consultor_nome || ' foi selecionado na demanda "' || v_projeto.nome || '".',
      v_projeto.id, 'projeto'
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'consultor_user_id', v_ind.consultor_user_id, 'canal_id', v_ind.canal_id);
END $function$;
