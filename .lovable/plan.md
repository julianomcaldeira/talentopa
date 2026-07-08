## Objetivo

Alinhar o Workz ao fluxo do documento `workz_fluxo_papeis_v2`: 4 papéis (Consultor, RMO no Canal, Coordenador na Empresa, Empresa) e um ciclo formal de shortlist → parecer → aprovação → kickoff → fases com encerramento documentado.

## Papéis (decisões já confirmadas)

- **Coordenador**: usuário Empresa marcado com papel `coordenador` em `empresa_usuarios`. Sem novo tipo de conta. Recebe UI própria e restrita.
- **RMO**: sub-usuário do Canal via nova tabela `canal_membros` (canal_id, user_id, role `admin` | `rmo`). O dono do Canal continua sendo admin. RMOs executam o dia-a-dia operacional.
- **Empresa** e **Consultor** continuam como estão, com pequenos ajustes.

## Mudanças de banco (uma migração)

Enums / tabelas:
- `papel_empresa_usuario` → adicionar valor `coordenador`.
- Nova tabela `canal_membros(canal_id, user_id, role text check in ('admin','rmo'), status, created_at, updated_at)` com GRANT e RLS.
- `projetos` → adicionar `coordenador_user_id uuid null` (definido pelo RMO ou pela Empresa ao publicar) e `canal_id uuid null` (canal responsável pelo projeto).
- `projeto_fases` → adicionar `documento_encerramento_url text`, `encerrada_por uuid`, `encerrada_em timestamptz`, `co_validada_por uuid`, `co_validada_em timestamptz`, `rmo_validada_por uuid`, `rmo_validada_em timestamptz`.
- Nova tabela `projeto_shortlist(id, projeto_id, proposta_id, adicionada_por, adicionada_em, status enum(`na_shortlist`,`em_entrevista`,`aprovada_coordenador`,`reprovada_coordenador`,`selecionada_rmo`))`.
- Nova tabela `projeto_shortlist_pareceres(id, shortlist_id, coordenador_user_id, aprovado bool, comentario text, created_at)`.

RPCs novas (todas SECURITY DEFINER com checagem de papel):
- `rmo_publicar_demanda(projeto_id, coordenador_user_id)` — vincula coordenador e publica.
- `rmo_montar_shortlist(projeto_id, proposta_ids[])` — cria shortlist e notifica coordenador.
- `coordenador_emitir_parecer(shortlist_id, aprovado, comentario)`.
- `rmo_aprovacao_final(shortlist_id)` — chama fluxo já existente de `empresa_aceitar_proposta` internamente.
- `consultor_encerrar_fase(fase_id, documento_url)` — muda para `aguardando_aprovacao` e notifica RMO.
- `rmo_validar_fase(fase_id)` + `coordenador_co_validar_fase(fase_id)` — aprovação em duas assinaturas (co-validação opcional).

Policies chave:
- Coordenador (`empresa_usuarios.papel='coordenador'`) só lê projetos onde é `projetos.coordenador_user_id = auth.uid()`.
- RMO (`canal_membros.role='rmo'`) tem os mesmos direitos operacionais que o dono do Canal, via helper `is_canal_operador(canal_id, user_id)`.

## Frontend

Rotas novas em `App.tsx`:
- `/coordenador/dashboard`, `/coordenador/entrevistas`, `/coordenador/projetos/:id` — protegidas por `role=empresa` + `papel=coordenador`.
- Dentro de `/canal/*`, aba **Equipe RMO** para o admin do Canal gerenciar membros e uma tela **Shortlist** para o RMO montar/gerenciar shortlists.

Telas alteradas:
- **CanalDashboard**: novas métricas (demandas publicadas, shortlists abertas, pareceres pendentes, aprovações finais do mês). Se usuário é RMO, mostra fila operacional; se é admin, mostra visão gerencial + equipe.
- **CanalProjetos**: botão "Publicar demanda" (RPC) + "Montar shortlist" com seleção múltipla de propostas.
- **EmpresaProjetos**: se a Empresa tiver Coordenador definido, permite indicá-lo por projeto; passa a mostrar aba "Shortlist e pareceres" (somente leitura).
- **ConsultorProjetos** / **Fases**: novo botão "Encerrar fase" com upload de documento (bucket `projeto-anexos` já existente) → chama `consultor_encerrar_fase`.
- **ConsultorDashboard**: card "Agenda" (agendados/bloqueados) mais visível ligado a `consultor_agenda`.

Componentes novos:
- `ShortlistBuilder` (RMO), `ShortlistCoordenadorView`, `ParecerDialog`, `EncerrarFaseDialog`, `CoValidarFaseDialog`, `CanalMembrosPanel`, `IndicarCoordenadorDialog`.

## Landing page

- `HeroSection`: manter identidade; ajustar copy para "Empresa, Canal (RMO), Coordenador e Consultor".
- `ForWhomSection`: 4 cards (Empresa, Canal/RMO, Coordenador, Consultor) com descrição do papel do documento e CTA.
- `HowItWorksSection`: refazer os 4 passos como fases do documento (Cadastro & Publicação → Candidatura & Seleção → Kickoff & Execução → Fases & Encerramento com documento).
- `Navbar` e `CTASection`: atualizar CTAs para os 4 papéis; consultor e coordenador entram como "quero ser".

## Registro / login

- Página de registro ganha opção "Coordenador (indicado pela empresa)" via link com token de convite (usa `empresa_usuarios` existente, com papel = coordenador).
- Canal ganha tela "Convidar RMO" que insere em `canal_membros` com status `pendente` até o convite ser aceito no primeiro login.

## Como será testado

1. Migração aplicada e types regenerados.
2. Fluxo end-to-end via UI: Empresa publica → RMO recebe → monta shortlist → Coordenador dá parecer → RMO aprova → Consultor confirma → kickoff → fase iniciada → Consultor encerra com PDF → RMO valida → Coordenador co-valida.
3. Landing revisada em desktop e mobile; verificação visual das 4 personas e do fluxo.

## O que **não** entra agora

- Assinatura eletrônica de contrato (segue com aceite existente).
- Reunião de kickoff dentro do próprio produto (continua no módulo de reuniões atuais).
- Realocação de projetos legados: os já existentes não recebem coordenador automaticamente — a Empresa indica quando quiser.
