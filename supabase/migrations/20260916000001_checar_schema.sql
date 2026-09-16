-- ============================================================================
-- 20260916000001_checar_schema.sql  —  RPC de check de schema (Fase 2)
-- ============================================================================
-- Cria public.checar_schema(): função que informa ao app (banner) se o banco
-- está atrasado em relação às ondas aplicadas. Retorna jsonb:
--   { "ok": bool, "manifesto_versao": text, "total": int,
--     "faltando": [ { "onda","tipo","objeto","descricao" } ], "checado_em": ts }
--
-- IMPORTANTE (manutenção): o manifesto dos objetos-chave está logo abaixo.
--   O MESMO manifesto existe em supabase/checks/verificar_schema.sql.
--   Ao final de CADA nova onda/migration, adicione os novos objetos nos DOIS
--   lugares e, se quiser, atualize MANIFESTO_VERSAO. Se não atualizar, o banner
--   fica cego para a onda nova.
--
-- Aplicar este bloco inteiro no SQL editor do Lovable (banco antes do front).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.checar_schema()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH esperados(onda, tipo, objeto, parametro, descricao) AS (
    VALUES
      -- -------------------------------------------------------------- Onda 0
      ('Onda 0', 'coluna',       'empresa_usuarios.ativo',                    NULL,          'flag de membro ativo na equipe'),
      ('Onda 0', 'funcao_corpo', 'public.is_empresa_team_member(uuid,uuid)',  'ativo = true','is_empresa_team_member exige ativo=true'),
      ('Onda 0', 'funcao',       'public.empresa_add_membro(uuid,text,uuid)', NULL,         'adicionar membro à empresa'),
      ('Onda 0', 'funcao',       'public.empresa_remove_membro(uuid,uuid)',   NULL,          'remover membro da empresa'),
      ('Onda 0', 'funcao',       'public.empresa_inativar_membro(uuid,uuid)', NULL,          'inativar membro da empresa'),
      ('Onda 0', 'funcao',       'public.empresa_reativar_membro(uuid,uuid)', NULL,          'reativar membro da empresa'),
      ('Onda 0', 'coluna',       'canais_public.nome',                        NULL,          'view pública de canais expõe nome'),
      ('Onda 0', 'coluna',       'profiles_public.nome',                      NULL,          'view pública de profiles expõe nome'),

      -- --------------------------------------------------------------- CT-17
      ('CT-17',  'enum',         'status_proposta:selecionada',               NULL,          'status de proposta selecionada'),
      ('CT-17',  'enum',         'status_proposta:desconsiderada',            NULL,          'status de proposta desconsiderada'),
      ('CT-17',  'enum',         'status_projeto:encerrada',                  NULL,          'status de projeto encerrado'),
      ('CT-17',  'coluna',       'propostas.status_anterior',                 NULL,          'guarda status para reconsiderar proposta'),
      ('CT-17',  'funcao',       'public.empresa_selecionar_proposta(uuid)',  NULL,          'selecionar proposta'),
      ('CT-17',  'funcao',       'public.empresa_selecionar_indicacao(uuid)', NULL,          'selecionar indicação'),
      ('CT-17',  'funcao',       'public.empresa_aceitar_proposta(uuid)',     NULL,          'aceitar proposta'),
      ('CT-17',  'funcao',       'public.rmo_aprovacao_final(uuid)',          NULL,          'aprovação final do RMO'),
      ('CT-17',  'funcao',       'public.empresa_encerrar_demanda(uuid)',     NULL,          'encerrar demanda'),
      ('CT-17',  'funcao',       'public.empresa_desconsiderar_proposta(uuid)', NULL,        'desconsiderar proposta'),
      ('CT-17',  'funcao',       'public.empresa_reconsiderar_proposta(uuid)',  NULL,        'reconsiderar proposta'),
      ('CT-17',  'funcao',       'public.empresa_desconsiderar_indicacao(uuid)',NULL,        'desconsiderar indicação'),
      ('CT-17',  'funcao',       'public.empresa_reconsiderar_indicacao(uuid)', NULL,        'reconsiderar indicação'),
      ('CT-17',  'funcao',       'public.bloquear_candidatura_fora_prazo()',  NULL,          'trigger fn candidatura fora do prazo'),
      ('CT-17',  'funcao',       'public.bloquear_indicacao_fora_prazo()',    NULL,          'trigger fn indicação fora do prazo'),
      ('CT-17',  'trigger',      'trg_bloquear_candidatura_fora_prazo',       NULL,          'trigger candidatura fora do prazo'),
      ('CT-17',  'trigger',      'trg_bloquear_indicacao_fora_prazo',         NULL,          'trigger indicação fora do prazo'),

      -- --------------------------------------------------------------- CT-15
      ('CT-15',  'funcao',       'public.parceiro_editar_indicacao(uuid,numeric,text)', NULL,  'parceiro edita indicação'),
      ('CT-15',  'funcao',       'public.parceiro_remover_indicacao(uuid)',   NULL,          'parceiro remove indicação')
  ),
  avaliado AS (
    SELECT
      e.onda, e.tipo, e.objeto, e.descricao,
      CASE e.tipo
        WHEN 'funcao' THEN
          to_regprocedure(e.objeto) IS NOT NULL
        WHEN 'funcao_corpo' THEN
          EXISTS (
            SELECT 1 FROM pg_proc p
            WHERE p.oid = to_regprocedure(e.objeto)
              AND p.prosrc ILIKE '%' || e.parametro || '%'
          )
        WHEN 'coluna' THEN
          EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name  = split_part(e.objeto, '.', 1)
              AND c.column_name = split_part(e.objeto, '.', 2)
          )
        WHEN 'enum' THEN
          EXISTS (
            SELECT 1
            FROM pg_enum en
            JOIN pg_type t      ON t.oid = en.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname  = 'public'
              AND t.typname  = split_part(e.objeto, ':', 1)
              AND en.enumlabel = split_part(e.objeto, ':', 2)
          )
        WHEN 'trigger' THEN
          EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = e.objeto AND NOT tgisinternal
          )
        ELSE false
      END AS existe
    FROM esperados e
  )
  SELECT jsonb_build_object(
    'ok',               count(*) FILTER (WHERE NOT existe) = 0,
    'manifesto_versao', '2026-09-16',
    'total',            count(*),
    'faltando',         COALESCE(
                          jsonb_agg(
                            jsonb_build_object(
                              'onda',      onda,
                              'tipo',      tipo,
                              'objeto',    objeto,
                              'descricao', descricao
                            ) ORDER BY onda, objeto
                          ) FILTER (WHERE NOT existe),
                          '[]'::jsonb
                        ),
    'checado_em',       now()
  )
  FROM avaliado;
$function$;

REVOKE ALL ON FUNCTION public.checar_schema() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checar_schema() TO authenticated, service_role;

COMMIT;

-- Recarrega o schema cache do PostgREST
SELECT pg_notify('pgrst', 'reload schema');
