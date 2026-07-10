## Correção estrutural: RMO pertence à Empresa

Erro atual: o RMO foi modelado como sub-usuário do Canal (tabela `canal_membros`). O correto é que o RMO seja um sub-usuário da **Empresa** — igual ao Coordenador, mas com papel próprio. Uma empresa pode ter vários RMOs; cada RMO pertence a exatamente uma empresa; RMO não é vinculado a projetos individualmente (é papel institucional, dialoga com o Coordenador de Projeto).

## 1. Banco de dados (uma migração)

**Enum**
- `papel_empresa_usuario`: adicionar valor `rmo` (já tem `coordenador`, `responsavel`, `financeiro`, `operacional`).

**Remover**
- `DROP TABLE public.canal_membros CASCADE` — remove tabela, policies, grants.
- `DROP FUNCTION` das RPCs `canal_convidar_rmo`, `is_canal_operador` (e helpers correlatos).

**Reescrever RPCs que hoje checam `canal_membros`**
- `rmo_publicar_demanda`, `rmo_montar_shortlist`, `rmo_aprovacao_final`
- `rmo_validar_fase`, `rmo_solicitar_ajustes_fase`, `rmo_invalidar_fase`
- `notificar_envolvidos_fase`

Nova regra de autorização (helper `is_empresa_rmo(_empresa_user_id uuid, _user_id uuid) returns boolean`, SECURITY DEFINER):
```
select exists (
  select 1 from empresa_usuarios eu
  join empresa_perfil ep on ep.user_id = eu.empresa_user_id
  where eu.user_id = _user_id
    and eu.papel = 'rmo'
    and eu.empresa_user_id = _empresa_user_id
);
```
As RPCs passam a validar `is_empresa_rmo(projeto.empresa_user_id, auth.uid())` em vez de `is_canal_operador(projeto.canal_id, auth.uid())`.

Em `notificar_envolvidos_fase`: notificar todos os RMOs da empresa dona do projeto (via `empresa_usuarios.papel='rmo'`), não mais admins/RMOs do canal.

**Não mexer** em: `canal_consultores`, `canais`, `canal_convites`, `canal_aprovacoes` — o Canal continua existindo normalmente para o relacionamento com consultores. Só o conceito "sub-usuário do canal" some.

## 2. Frontend

**AuthContext**
- Remover `canalRole` do contexto e a query em `canal_membros`.
- Adicionar helper derivado: `isRmo = empresaPapel === 'rmo'`, `isCoordenador = empresaPapel === 'coordenador'`.

**Rotas / telas**
- Deletar `src/pages/canal/CanalEquipe.tsx` e rota `/canal/equipe`.
- Criar `src/pages/empresa/EmpresaRMOs.tsx` (espelho de `EmpresaCoordenadores.tsx`): admin da empresa cadastra e-mails, insere em `empresa_usuarios` com papel `rmo`.
- Adicionar link "Equipe RMO" no menu Empresa (só para o dono/responsável, não para RMO nem Coordenador).
- `ProtectedRoute`: RMO continua com role `empresa` (já que é sub-usuário da empresa). Restringir telas sensíveis pelo `empresaPapel` quando necessário.

**Componentes de validação de fase**
- `ValidarFaseActions.tsx` e `ProjetoGestao.tsx`: trocar detecção `isRmo` — hoje olha `canal_membros`; passa a olhar `empresaPapel === 'rmo'` **e** confere que o `projeto.empresa_user_id` bate com a empresa do RMO logado.

**Sidebar / dashboard**
- `DashboardLayout`: onde hoje aparece "Equipe (RMO)" dentro do menu do Canal, remover. Adicionar "RMOs" no menu Empresa (visível só para dono/responsável).

## 3. Documentos e landing

- Atualizar `.lovable/plan.md` refletindo a nova regra (RMO = sub-usuário da Empresa).
- `ForWhomSection` e `HowItWorksSection`: mover RMO do bloco "Canal" para o bloco "Empresa", descrevendo-o como o operacional da empresa que orquestra os projetos junto ao Coordenador.

## 4. Detalhes técnicos

- Migração deve rodar em ordem: `ALTER TYPE ... ADD VALUE 'rmo'` (fora de bloco), depois `DROP` de `canal_membros` e RPCs, depois recriação de helper + RPCs.
- `ALTER TYPE ADD VALUE` não pode ser usado no mesmo statement em que é referenciado, então: 1ª migração adiciona o enum; 2ª migração recria as RPCs usando o valor. Vou dividir em duas migrações no mesmo commit.
- Types do Supabase serão regenerados após aprovação — só depois atualizo `AuthContext`, `ValidarFaseActions`, `ProjetoGestao`, novas telas.

## 5. Fora deste escopo

- Não crio dashboard próprio de RMO agora. Ele acessa as mesmas telas de Empresa (com filtros de papel onde já existirem). Se quiser painel dedicado depois, faço em passo separado.
- Projetos legados: nenhum campo de projeto muda; a autorização é sempre calculada em tempo real por `empresa_user_id`.
