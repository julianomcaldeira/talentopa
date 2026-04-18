-- =========================================================
-- AUDIT LOGS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID,
  actor_role TEXT,
  actor_nome TEXT,
  categoria TEXT NOT NULL,
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id UUID,
  descricao TEXT,
  dados_antigos JSONB,
  dados_novos JSONB,
  severidade TEXT NOT NULL DEFAULT 'info',
  ip_address TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_categoria ON public.audit_logs(categoria);
CREATE INDEX IF NOT EXISTS idx_audit_logs_acao ON public.audit_logs(acao);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entidade ON public.audit_logs(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severidade ON public.audit_logs(severidade);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (true);

-- =========================================================
-- HELPER: log event
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_categoria TEXT,
  p_acao TEXT,
  p_entidade TEXT,
  p_entidade_id UUID,
  p_descricao TEXT,
  p_dados_antigos JSONB DEFAULT NULL,
  p_dados_novos JSONB DEFAULT NULL,
  p_severidade TEXT DEFAULT 'info'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_role TEXT;
  v_nome TEXT;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT role::text INTO v_role FROM user_roles WHERE user_id = v_actor LIMIT 1;
    SELECT nome INTO v_nome FROM profiles WHERE user_id = v_actor LIMIT 1;
  ELSE
    v_role := 'sistema';
    v_nome := 'Sistema';
  END IF;

  INSERT INTO audit_logs (actor_user_id, actor_role, actor_nome, categoria, acao, entidade, entidade_id, descricao, dados_antigos, dados_novos, severidade)
  VALUES (v_actor, COALESCE(v_role,'sistema'), COALESCE(v_nome,'Sistema'), p_categoria, p_acao, p_entidade, p_entidade_id, p_descricao, p_dados_antigos, p_dados_novos, p_severidade);
END;
$$;

-- =========================================================
-- TRIGGER: projetos
-- =========================================================
CREATE OR REPLACE FUNCTION public.audit_projetos_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event('projeto','criado','projetos',NEW.id,'Projeto criado: '||NEW.nome, NULL, to_jsonb(NEW),'info');
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM log_audit_event('projeto','mudanca_status','projetos',NEW.id,
        'Projeto "'||NEW.nome||'" mudou de '||OLD.status||' para '||NEW.status,
        jsonb_build_object('status',OLD.status), jsonb_build_object('status',NEW.status),
        CASE WHEN NEW.status='cancelado' THEN 'warning' WHEN NEW.status='concluido' THEN 'success' ELSE 'info' END);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS audit_projetos ON public.projetos;
CREATE TRIGGER audit_projetos AFTER INSERT OR UPDATE ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.audit_projetos_trg();

-- =========================================================
-- TRIGGER: propostas
-- =========================================================
CREATE OR REPLACE FUNCTION public.audit_propostas_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_proj TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT nome INTO v_proj FROM projetos WHERE id = NEW.projeto_id;
    PERFORM log_audit_event('proposta','criada','propostas',NEW.id,'Nova proposta enviada para "'||COALESCE(v_proj,'?')||'"', NULL, to_jsonb(NEW),'info');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT nome INTO v_proj FROM projetos WHERE id = NEW.projeto_id;
    PERFORM log_audit_event('proposta', NEW.status::text,'propostas',NEW.id,
      'Proposta '||NEW.status||' em "'||COALESCE(v_proj,'?')||'"',
      jsonb_build_object('status',OLD.status), jsonb_build_object('status',NEW.status),
      CASE WHEN NEW.status='aceita' THEN 'success' WHEN NEW.status='recusada' THEN 'warning' ELSE 'info' END);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS audit_propostas ON public.propostas;
CREATE TRIGGER audit_propostas AFTER INSERT OR UPDATE ON public.propostas
FOR EACH ROW EXECUTE FUNCTION public.audit_propostas_trg();

-- =========================================================
-- TRIGGER: pagamentos
-- =========================================================
CREATE OR REPLACE FUNCTION public.audit_pagamentos_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event('financeiro','pagamento_criado','pagamentos',NEW.id,
      'Pagamento criado no valor de R$ '||NEW.valor_total, NULL, to_jsonb(NEW),'info');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_audit_event('financeiro','pagamento_'||NEW.status,'pagamentos',NEW.id,
      'Pagamento atualizado para '||NEW.status||' (R$ '||NEW.valor_total||')',
      jsonb_build_object('status',OLD.status), jsonb_build_object('status',NEW.status),
      CASE WHEN NEW.status='pago' THEN 'success' WHEN NEW.status='atrasado' THEN 'warning' WHEN NEW.status='cancelado' THEN 'critical' ELSE 'info' END);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS audit_pagamentos ON public.pagamentos;
CREATE TRIGGER audit_pagamentos AFTER INSERT OR UPDATE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.audit_pagamentos_trg();

-- =========================================================
-- TRIGGER: faturas
-- =========================================================
CREATE OR REPLACE FUNCTION public.audit_faturas_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event('financeiro','fatura_criada','faturas',NEW.id,
      'Fatura '||NEW.numero_fatura||' criada (R$ '||NEW.valor||')', NULL, to_jsonb(NEW),'info');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_audit_event('financeiro','fatura_'||NEW.status,'faturas',NEW.id,
      'Fatura '||NEW.numero_fatura||' atualizada para '||NEW.status,
      jsonb_build_object('status',OLD.status), jsonb_build_object('status',NEW.status),'info');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS audit_faturas ON public.faturas;
CREATE TRIGGER audit_faturas AFTER INSERT OR UPDATE ON public.faturas
FOR EACH ROW EXECUTE FUNCTION public.audit_faturas_trg();

-- =========================================================
-- TRIGGER: moderação (mensagens bloqueadas)
-- =========================================================
CREATE OR REPLACE FUNCTION public.audit_mensagens_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.bloqueado = true AND (TG_OP='INSERT' OR OLD.bloqueado IS DISTINCT FROM NEW.bloqueado) THEN
    PERFORM log_audit_event('moderacao','mensagem_bloqueada','mensagens',NEW.id,
      'Mensagem bloqueada automaticamente: '||COALESCE(NEW.motivo_bloqueio,'sem motivo'),
      NULL, jsonb_build_object('motivo',NEW.motivo_bloqueio,'projeto_id',NEW.projeto_id),'warning');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS audit_mensagens ON public.mensagens;
CREATE TRIGGER audit_mensagens AFTER INSERT OR UPDATE ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.audit_mensagens_trg();

-- =========================================================
-- TRIGGER: ações admin (catálogo, score, roles, empresa_usuarios)
-- =========================================================
CREATE OR REPLACE FUNCTION public.audit_admin_changes_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_desc TEXT; v_entidade TEXT := TG_TABLE_NAME; v_id UUID;
BEGIN
  v_id := COALESCE((CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END), gen_random_uuid());
  v_desc := TG_OP||' em '||v_entidade;
  PERFORM log_audit_event('admin', lower(TG_OP)||'_'||v_entidade, v_entidade, v_id, v_desc,
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    CASE WHEN TG_OP='DELETE' THEN 'warning' ELSE 'info' END);
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS audit_softwares ON public.softwares;
CREATE TRIGGER audit_softwares AFTER INSERT OR UPDATE OR DELETE ON public.softwares
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_changes_trg();

DROP TRIGGER IF EXISTS audit_modulos ON public.modulos;
CREATE TRIGGER audit_modulos AFTER INSERT OR UPDATE OR DELETE ON public.modulos
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_changes_trg();

DROP TRIGGER IF EXISTS audit_funcionalidades ON public.funcionalidades;
CREATE TRIGGER audit_funcionalidades AFTER INSERT OR UPDATE OR DELETE ON public.funcionalidades
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_changes_trg();

DROP TRIGGER IF EXISTS audit_score_config ON public.score_config;
CREATE TRIGGER audit_score_config AFTER UPDATE ON public.score_config
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_changes_trg();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_changes_trg();

DROP TRIGGER IF EXISTS audit_empresa_usuarios ON public.empresa_usuarios;
CREATE TRIGGER audit_empresa_usuarios AFTER INSERT OR UPDATE OR DELETE ON public.empresa_usuarios
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_changes_trg();

-- =========================================================
-- RPC: métricas avançadas para tela de Métricas
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_admin_advanced_metrics()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'funil', jsonb_build_object(
      'publicados', (SELECT count(*) FROM projetos WHERE status <> 'rascunho'),
      'com_propostas', (SELECT count(DISTINCT projeto_id) FROM propostas),
      'aceitas', (SELECT count(*) FROM propostas WHERE status='aceita'),
      'em_andamento', (SELECT count(*) FROM projetos WHERE status='em_andamento'),
      'concluidos', (SELECT count(*) FROM projetos WHERE status='concluido'),
      'cancelados', (SELECT count(*) FROM projetos WHERE status='cancelado')
    ),
    'tempos', jsonb_build_object(
      'avg_horas_ate_primeira_proposta', (
        SELECT coalesce(round(avg(EXTRACT(EPOCH FROM (pr.first_at - p.created_at))/3600)::numeric,1),0)
        FROM projetos p
        JOIN (SELECT projeto_id, min(created_at) first_at FROM propostas GROUP BY projeto_id) pr ON pr.projeto_id = p.id
      ),
      'avg_dias_aceite_a_conclusao', (
        SELECT coalesce(round(avg(EXTRACT(EPOCH FROM (p.updated_at - pr.updated_at))/86400)::numeric,1),0)
        FROM projetos p JOIN propostas pr ON pr.projeto_id=p.id AND pr.status='aceita'
        WHERE p.status='concluido'
      ),
      'projetos_atrasados', (
        SELECT count(*) FROM projetos WHERE status='em_andamento' AND prazo_estimado < CURRENT_DATE
      )
    ),
    'erp_demanda_oferta', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT s.nome AS software,
          (SELECT count(*) FROM projetos p WHERE p.software_id=s.id) AS demanda,
          (SELECT count(DISTINCT ch.user_id) FROM consultor_habilidades ch WHERE ch.software_id=s.id) AS oferta
        FROM softwares s
        ORDER BY demanda DESC LIMIT 15
      ) t
    ),
    'modulos_quentes', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT m.nome AS modulo, count(pm.id) AS demanda,
          (SELECT count(DISTINCT user_id) FROM consultor_habilidades WHERE modulo_id=m.id) AS consultores
        FROM modulos m LEFT JOIN projeto_modulos pm ON pm.modulo_id=m.id
        GROUP BY m.id, m.nome ORDER BY count(pm.id) DESC LIMIT 10
      ) t
    ),
    'financeiro', jsonb_build_object(
      'receita_total', (SELECT coalesce(sum(comissao_plataforma),0) FROM pagamentos),
      'gmv_total', (SELECT coalesce(sum(valor_total),0) FROM pagamentos),
      'ticket_medio', (SELECT coalesce(round(avg(valor_total)::numeric,2),0) FROM pagamentos),
      'pendente', (SELECT coalesce(sum(valor_total),0) FROM pagamentos WHERE status='pendente'),
      'atrasado', (SELECT coalesce(sum(valor_total),0) FROM pagamentos WHERE status='atrasado'),
      'pago', (SELECT coalesce(sum(valor_total),0) FROM pagamentos WHERE status='pago')
    ),
    'engajamento', jsonb_build_object(
      'total_consultores', (SELECT count(*) FROM user_roles WHERE role='consultor'),
      'consultores_ativos_30d', (SELECT count(DISTINCT consultor_user_id) FROM propostas WHERE created_at > now() - interval '30 days'),
      'total_empresas', (SELECT count(*) FROM user_roles WHERE role='empresa'),
      'empresas_ativas_30d', (SELECT count(DISTINCT empresa_user_id) FROM projetos WHERE created_at > now() - interval '30 days'),
      'consultores_inativos_60d', (
        SELECT count(*) FROM user_roles ur WHERE ur.role='consultor'
        AND NOT EXISTS (SELECT 1 FROM propostas p WHERE p.consultor_user_id=ur.user_id AND p.created_at > now() - interval '60 days')
      ),
      'nps_recomendacao_pct', (
        SELECT coalesce(round((count(*) FILTER (WHERE recomendacao=true)::numeric / NULLIF(count(*),0))*100,1),0) FROM avaliacoes
      ),
      'nota_media_geral', (SELECT coalesce(round(avg(nota)::numeric,2),0) FROM avaliacoes)
    ),
    'geografia', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT coalesce(estado,'N/I') AS estado, count(*) AS total
        FROM profiles GROUP BY estado ORDER BY count(*) DESC LIMIT 15
      ) t
    ),
    'top_empresas', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT pf.nome, sum(pg.valor_total) AS valor, count(pg.id) AS pagamentos
        FROM pagamentos pg JOIN profiles pf ON pf.user_id=pg.empresa_user_id
        GROUP BY pf.nome ORDER BY sum(pg.valor_total) DESC LIMIT 10
      ) t
    )
  );
$$;