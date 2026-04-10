
-- Platform-wide KPI metrics
CREATE OR REPLACE FUNCTION public.get_platform_metrics()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_projetos', (SELECT count(*) FROM projetos),
    'total_consultores', (SELECT count(*) FROM user_roles WHERE role = 'consultor'),
    'total_empresas', (SELECT count(*) FROM user_roles WHERE role = 'empresa'),
    'avg_valor_proposta', (SELECT coalesce(round(avg(valor_proposta)::numeric, 2), 0) FROM propostas WHERE valor_proposta > 0),
    'avg_nota', (SELECT coalesce(round(avg(nota)::numeric, 2), 0) FROM avaliacoes),
    'total_avaliacoes', (SELECT count(*) FROM avaliacoes),
    'taxa_aceitacao', (
      SELECT CASE WHEN count(*) > 0 
        THEN round((count(*) FILTER (WHERE status = 'aceita')::numeric / count(*)::numeric) * 100, 1)
        ELSE 0 END
      FROM propostas
    ),
    'avg_horas_projeto', (SELECT coalesce(round(avg(estimativa_horas)::numeric, 0), 0) FROM propostas WHERE estimativa_horas > 0),
    'avg_duracao_dias', (
      SELECT coalesce(round(avg(
        EXTRACT(EPOCH FROM (coalesce(prazo_estimado::timestamp, now()) - created_at)) / 86400
      )::numeric, 0), 0)
      FROM projetos WHERE prazo_estimado IS NOT NULL
    ),
    'valor_total_contratado', (SELECT coalesce(round(sum(valor_total)::numeric, 2), 0) FROM pagamentos),
    'receita_plataforma', (SELECT coalesce(round(sum(comissao_plataforma)::numeric, 2), 0) FROM pagamentos)
  );
$$;

-- Projects grouped by status
CREATE OR REPLACE FUNCTION public.get_projects_by_status()
RETURNS TABLE(status text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.status::text, count(*) 
  FROM projetos p
  GROUP BY p.status
  ORDER BY count(*) DESC;
$$;

-- Projects grouped by software (top 10)
CREATE OR REPLACE FUNCTION public.get_projects_by_software()
RETURNS TABLE(software_nome text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(s.nome, 'Sem software') as software_nome, count(*)
  FROM projetos p
  LEFT JOIN softwares s ON s.id = p.software_id
  GROUP BY s.nome
  ORDER BY count(*) DESC
  LIMIT 10;
$$;

-- Monthly project creation/completion stats (last 12 months)
CREATE OR REPLACE FUNCTION public.get_monthly_project_stats()
RETURNS TABLE(mes text, criados bigint, concluidos bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now() - interval '11 months'),
      date_trunc('month', now()),
      interval '1 month'
    )::date AS month_start
  )
  SELECT 
    to_char(m.month_start, 'YYYY-MM') AS mes,
    count(p.id) FILTER (WHERE date_trunc('month', p.created_at) = m.month_start) AS criados,
    count(p.id) FILTER (WHERE p.status = 'concluido' AND date_trunc('month', p.updated_at) = m.month_start) AS concluidos
  FROM months m
  LEFT JOIN projetos p ON date_trunc('month', p.created_at) = m.month_start 
    OR (p.status = 'concluido' AND date_trunc('month', p.updated_at) = m.month_start)
  GROUP BY m.month_start
  ORDER BY m.month_start;
$$;

-- Top consultants by accepted proposals
CREATE OR REPLACE FUNCTION public.get_top_consultants(p_limit int DEFAULT 10)
RETURNS TABLE(consultor_user_id uuid, nome text, total_projetos bigint, nota_media numeric, valor_total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pr.consultor_user_id,
    coalesce(pf.nome, 'Consultor') as nome,
    count(DISTINCT pr.projeto_id) as total_projetos,
    coalesce(round(avg(a.nota)::numeric, 1), 0) as nota_media,
    coalesce(round(sum(pr.valor_proposta)::numeric, 2), 0) as valor_total
  FROM propostas pr
  LEFT JOIN profiles pf ON pf.user_id = pr.consultor_user_id
  LEFT JOIN avaliacoes a ON a.avaliado_user_id = pr.consultor_user_id AND a.projeto_id = pr.projeto_id
  WHERE pr.status = 'aceita'
  GROUP BY pr.consultor_user_id, pf.nome
  ORDER BY total_projetos DESC, nota_media DESC
  LIMIT p_limit;
$$;
