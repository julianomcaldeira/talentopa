
CREATE OR REPLACE FUNCTION public.get_canal_dashboard_metrics(p_canal_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_canal_id uuid;
  v_result jsonb;
  v_start date;
  v_end date;
  v_horas_disponiveis numeric := 0;
  v_horas_alocadas numeric := 0;
  v_projetos_disponiveis int := 0;
  v_consultores_vinculados int := 0;
BEGIN
  v_canal_id := COALESCE(p_canal_id, public.get_user_canal_id(auth.uid()));
  IF v_canal_id IS NULL OR NOT (public.is_canal_owner(v_canal_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Sem permissão para acessar métricas do Canal';
  END IF;

  v_start := (CURRENT_DATE + INTERVAL '1 day')::date;
  v_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date;

  SELECT count(*) INTO v_projetos_disponiveis
  FROM public.projetos
  WHERE status IN ('publicado','em_selecao') AND roteamento_v2 = true;

  SELECT count(*) INTO v_consultores_vinculados
  FROM public.canal_consultores
  WHERE canal_id = v_canal_id AND status = 'ativo';

  -- Horas disponíveis (dias restantes do mês vigente)
  IF v_start <= v_end THEN
    WITH vinculos AS (
      SELECT cc.consultor_user_id,
             COALESCE(cp.jornada_diaria_horas, 8) AS jornada,
             COALESCE(cp.dias_semana_disponiveis, ARRAY[1,2,3,4,5]) AS dias_semana
      FROM public.canal_consultores cc
      LEFT JOIN public.consultor_perfil cp ON cp.user_id = cc.consultor_user_id
      WHERE cc.canal_id = v_canal_id AND cc.status = 'ativo'
    ),
    dias AS (
      SELECT generate_series(v_start, v_end, INTERVAL '1 day')::date AS dia
    ),
    candidatos AS (
      SELECT v.consultor_user_id, d.dia, v.jornada, v.dias_semana
      FROM vinculos v
      CROSS JOIN dias d
      WHERE EXTRACT(ISODOW FROM d.dia)::int = ANY(v.dias_semana)
    ),
    validos AS (
      SELECT c.consultor_user_id, c.dia,
             COALESCE(cad.jornada_horas, c.jornada) AS horas
      FROM candidatos c
      LEFT JOIN public.consultor_agenda_dias cad
        ON cad.consultor_user_id = c.consultor_user_id
       AND cad.dia = c.dia
       AND cad.canal_id = v_canal_id
      WHERE (cad.estado IS NULL OR cad.estado NOT IN ('alocado','bloqueado'))
        AND NOT EXISTS (
          SELECT 1 FROM public.consultor_agenda ca
          WHERE ca.consultor_user_id = c.consultor_user_id
            AND ca.status IN ('agendado','bloqueado')
            AND c.dia BETWEEN ca.inicio::date AND ca.fim::date
        )
    )
    SELECT COALESCE(SUM(horas), 0) INTO v_horas_disponiveis FROM validos;
  END IF;

  -- Horas alocadas no mês vigente inteiro
  SELECT COALESCE(SUM(cad.jornada_horas), 0) INTO v_horas_alocadas
  FROM public.consultor_agenda_dias cad
  WHERE cad.canal_id = v_canal_id
    AND cad.estado = 'alocado'
    AND cad.dia >= date_trunc('month', CURRENT_DATE)::date
    AND cad.dia <= (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date;

  v_result := jsonb_build_object(
    'projetos_disponiveis', v_projetos_disponiveis,
    'consultores_vinculados', v_consultores_vinculados,
    'horas_disponiveis', v_horas_disponiveis,
    'horas_alocadas', v_horas_alocadas,
    'capacidade_ociosa', GREATEST(v_horas_disponiveis - v_horas_alocadas, 0),
    -- legado
    'consultores_ativos', v_consultores_vinculados,
    'convites_pendentes', (SELECT count(*) FROM public.canal_convites WHERE canal_id = v_canal_id AND status = 'pendente'),
    'aprovacoes_pendentes', (SELECT count(*) FROM public.alocacoes WHERE canal_id = v_canal_id AND status = 'pendente_aprovacao'),
    'projetos_ativos', (SELECT count(DISTINCT projeto_id) FROM public.alocacoes WHERE canal_id = v_canal_id AND status = 'aprovada'),
    'valor_total_aprovado', COALESCE((SELECT sum(valor) FROM public.alocacoes WHERE canal_id = v_canal_id AND status = 'aprovada'), 0)
  );

  RETURN v_result;
END;
$function$;
