-- ============================================================================
-- verificar_schema.sql  —  Check pós-deploy de divergência de schema (Fase 1)
-- ============================================================================
-- O que é: script READ-ONLY, standalone, para rodar no SQL editor do Lovable.
--          Confere se os objetos-chave de cada onda existem no banco e aponta
--          exatamente o que está faltando. Não altera nada.
--
-- Como usar: cole o arquivo inteiro no SQL editor e execute. A primeira linha
--            do resultado é o resumo (OK / FALTA); depois vêm os faltantes e,
--            por fim, os objetos conferidos com sucesso.
--
-- IMPORTANTE (manutenção):
--   Ao final de CADA nova onda/migration, adicione aqui os novos objetos-chave.
--   O MESMO manifesto existe na função public.checar_schema()
--   (migration 20260916000001_checar_schema.sql). Se você atualizar um, ATUALIZE
--   o outro — senão este check fica cego para a onda nova.
--
-- Por que não usar supabase_migrations.schema_migrations: essa tabela não é
-- populada quando o SQL é aplicado manualmente pelo editor, então ela não serve
-- como fonte de verdade. A verificação por objeto funciona independente de como
-- o objeto foi criado.
-- ============================================================================

WITH esperados(onda, tipo, objeto, parametro, descricao) AS (
  VALUES
    -- ---------------------------------------------------------------- Onda 0
    ('Onda 0', 'coluna',       'empresa_usuarios.ativo',                    NULL,          'flag de membro ativo na equipe'),
    ('Onda 0', 'funcao_corpo', 'public.is_empresa_team_member(uuid,uuid)',  'ativo = true','is_empresa_team_member exige ativo=true'),
    ('Onda 0', 'funcao',       'public.empresa_add_membro(uuid,text,uuid)', NULL,         'adicionar membro à empresa'),
    ('Onda 0', 'funcao',       'public.empresa_remove_membro(uuid,uuid)',   NULL,          'remover membro da empresa'),
    ('Onda 0', 'funcao',       'public.empresa_inativar_membro(uuid,uuid)', NULL,          'inativar membro da empresa'),
    ('Onda 0', 'funcao',       'public.empresa_reativar_membro(uuid,uuid)', NULL,          'reativar membro da empresa'),
    ('Onda 0', 'coluna',       'canais_public.nome',                        NULL,          'view pública de canais expõe nome'),
    ('Onda 0', 'coluna',       'profiles_public.nome',                      NULL,          'view pública de profiles expõe nome'),

    -- ----------------------------------------------------------------- CT-17
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

    -- ----------------------------------------------------------------- CT-15
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
SELECT resultado.status, resultado.onda, resultado.tipo, resultado.objeto, resultado.descricao
FROM (
  -- Resumo
  SELECT 0 AS ordem, 'RESUMO' AS status, '' AS onda, '' AS tipo, '' AS objeto,
         CASE WHEN count(*) FILTER (WHERE NOT existe) = 0
              THEN 'OK — banco em dia (' || count(*) || ' objetos conferidos)'
              ELSE 'FALTA — ' || count(*) FILTER (WHERE NOT existe) || ' de ' || count(*) || ' objetos ausentes'
         END AS descricao
  FROM avaliado
  UNION ALL
  -- Faltantes (lista principal)
  SELECT 1, 'FALTA', onda, tipo, objeto, descricao FROM avaliado WHERE NOT existe
  UNION ALL
  -- Conferidos com sucesso
  SELECT 2, 'OK', onda, tipo, objeto, descricao FROM avaliado WHERE existe
) AS resultado
ORDER BY resultado.ordem, resultado.onda, resultado.objeto;
