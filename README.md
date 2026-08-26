# Workz

Crie um sistema web SaaS chamado TalentOps.

O sistema é um marketplace especializado em conectar empresas que precisam implementar ou evoluir sistemas ERP com consultores especializados nesses sistemas.

A plataforma deve permitir que empresas publiquem projetos e que consultores especializados se candidatem para executá-los.

O sistema deve possuir três perfis principais de usuários:

Administrador da plataforma

Consultor

Empresa (cliente)

A interface deve ser moderna, intuitiva, responsiva e focada em experiência do usuário.

O sistema deve ter as seguintes áreas principais:

Autenticação e controle de usuários

Administração da plataforma

Gestão de consultores

Gestão de empresas

Gestão de projetos

Sistema de matching entre projetos e consultores

Gestão de execução de projetos

Sistema de faturamento e pagamentos

Sistema de avaliação

1. SISTEMA DE AUTENTICAÇÃO E USUÁRIOS

Criar sistema completo de autenticação com:

Login
Cadastro
Recuperação de senha
Verificação de email
Controle de sessão

Tipos de usuário:

ADMIN
CONSULTOR
EMPRESA

Cada usuário deve possuir:

id
nome
email
senha
tipo_usuario
status
data_criacao

O acesso às funcionalidades deve ser controlado por perfil de usuário.

2. PAINEL ADMINISTRADOR DA PLATAFORMA

O administrador controla toda a estrutura da plataforma.

O painel administrativo deve permitir:

Gestão de softwares ERP
Gestão de módulos
Gestão de funcionalidades
Gestão de templates de implementação
Gestão de consultores
Gestão de empresas
Gestão de projetos
Gestão financeira da plataforma

3. GESTÃO DE SOFTWARES ERP

Criar estrutura hierárquica para representar conhecimentos técnicos.

Níveis:

Software ERP
Módulos
Funcionalidades

Tabela Software:

id
nome
descricao
empresa_desenvolvedora

Exemplos de software:

TOTVS Protheus
TOTVS RM
SAP
Oracle
Fluig

4. GESTÃO DE MÓDULOS

Cada software ERP possui módulos.

Tabela módulos:

id
software_id
nome
descricao

Exemplos de módulos:

Financeiro
Fiscal
Compras
Estoque
RH
Faturamento

5. GESTÃO DE FUNCIONALIDADES

Cada módulo possui funcionalidades específicas.

Tabela funcionalidades:

id
modulo_id
nome
descricao
horas_media_estimadas

Exemplos:

Parametrização fiscal
Integração bancária
Automação de faturamento
Importação de dados
Configuração de impostos

O campo horas_media_estimadas será usado para ajudar na estimativa de projetos.

6. SISTEMA DE TEMPLATES DE IMPLEMENTAÇÃO

O administrador pode criar templates de projetos.

Templates são pacotes de funcionalidades pré-definidas.

Tabela templates:

id
nome
descricao

Tabela template_funcionalidades:

id
template_id
funcionalidade_id

Isso permite que empresas criem projetos rapidamente escolhendo um template.

7. PERFIL DO CONSULTOR

O consultor deve possuir um perfil completo.

Dados do consultor:

nome
email
telefone
cidade
estado
linkedin
curriculo
foto
bio_profissional

8. PERFIL TÉCNICO DO CONSULTOR

O consultor deve informar suas habilidades técnicas.

Cada habilidade deve conter:

software
modulo
funcionalidade
nivel_senioridade
valor_hora

Níveis de senioridade:

Junior
Pleno
Senior
Especialista

O consultor pode ter várias habilidades cadastradas.

9. ASSINATURA DO CONSULTOR

O sistema deve suportar planos de assinatura para consultores.

Planos:

STANDARD
PREMIUM

Plano STANDARD:

acesso a projetos

Plano PREMIUM:

acesso a projetos
acesso a demandas de sustentação
acesso a treinamentos
maior visibilidade na plataforma

O consultor deve poder gerenciar sua assinatura.

10. PERFIL DA EMPRESA

Empresas devem possuir cadastro completo.

Campos:

razao_social
nome_fantasia
cnpj
segmento
numero_funcionarios
cidade
estado
telefone
email_contato

11. DADOS FISCAIS DA EMPRESA

Campos adicionais:

endereco
inscricao_estadual
dados_faturamento
dados_emissao_nf

Essas informações serão usadas para faturamento.

12. HISTÓRICO DA EMPRESA

A empresa deve ter uma área com:

histórico de projetos realizados
consultores que participaram
avaliações recebidas

13. CRIAÇÃO DE NOVO PROJETO

Empresas devem poder criar novos projetos.

Etapa 1 — Informações gerais:

nome_projeto
descricao_projeto
problema_atual
objetivo_projeto
prazo_estimado

14. DEFINIÇÃO DO ESCOPO DO PROJETO

A empresa deve escolher:

software ERP
módulos
funcionalidades

OU

escolher um template de projeto.

Também deve poder adicionar observações personalizadas.

15. DEFINIÇÃO DO CRONOGRAMA

A empresa deve definir prazo esperado para cada módulo ou funcionalidade.

O sistema deve gerar automaticamente um cronograma sugerido baseado nas horas estimadas das funcionalidades.

16. DEFINIÇÃO DOS ENTREGÁVEIS

A empresa define como o projeto será dividido em fases.

Exemplo de fases:

Planejamento
Implantação
Testes
Treinamento
Go-live

Cada fase deve possuir:

nome
descricao
prazo
valor

17. PERFIL DO TIME DESEJADO

A empresa pode definir quais tipos de profissionais deseja no projeto.

Exemplos:

Consultor
Coordenador
Gestor
PMO

18. PUBLICAÇÃO DO PROJETO

Após finalizar a criação do projeto:

O sistema deve gerar um protocolo do projeto.

O sistema deve identificar automaticamente consultores com perfil compatível.

Critérios de matching:

software
modulo
funcionalidade
senioridade

Esses consultores devem receber notificação do novo projeto.

19. VISÃO DO CONSULTOR SOBRE PROJETOS

Consultores devem visualizar uma lista de projetos disponíveis.

Cada projeto deve mostrar:

descrição
escopo
horas estimadas
prazo
tipo de trabalho (remoto ou presencial)

O consultor pode:

participar do projeto
recusar participar

Caso participe, pode informar:

estimativa de horas
valor da proposta
comentários técnicos

20. ESCOLHA DO CONSULTOR PELA EMPRESA

Após o prazo de resposta dos consultores:

A empresa deve visualizar uma lista com todos os candidatos.

Cada consultor deve mostrar:

perfil
nota média
experiência
valor da proposta
estimativa de horas

A empresa escolhe o consultor.

21. CONTRATAÇÃO DO PROJETO

Após escolher o consultor:

O sistema gera automaticamente:

contrato digital
plano de pagamento
cronograma do projeto

22. EXECUÇÃO DO PROJETO

O projeto deve ser dividido em fases.

Fluxo de cada fase:

1 consultor executa atividade
2 consultor marca fase como concluída
3 empresa avalia entrega

A empresa pode:

aprovar fase
solicitar ajustes
reprovar fase

23. MODELO DE PAGAMENTO

Antes do início de cada fase:

a empresa deve realizar o pagamento da fase.

Após aprovação da fase:

o consultor recebe o pagamento.

A plataforma retém automaticamente 25% de comissão sobre cada fase.

24. SISTEMA DE MEDIAÇÃO

Se a empresa reprovar uma entrega:

o sistema deve abrir um fluxo de mediação.

O administrador da plataforma pode intervir.

25. SISTEMA DE AVALIAÇÃO

Após finalização do projeto:

A empresa avalia o consultor.

Campos:

nota
comentário
recomendação

Consultor também pode avaliar a empresa.

26. HISTÓRICO DE PROJETOS

Consultores e empresas devem ter acesso ao histórico completo de projetos:

status
consultores envolvidos
pagamentos
avaliações

27. SISTEMA DE SUSTENTAÇÃO

Empresas podem contratar suporte recorrente.

Funciona como pacote de horas mensais.

Essas demandas devem ser enviadas apenas para consultores com plano premium.

28. PAINEL FINANCEIRO

O sistema deve registrar:

pagamentos de clientes
pagamentos a consultores
comissão da plataforma
histórico financeiro por projeto

29. SEGURANÇA E REGRAS

A plataforma deve impedir que:

empresa e consultor negociem fora da plataforma após conexão.

O sistema deve permitir:

bloqueio de usuários
suspensão de contas
registro de logs de atividade

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://talentopa.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/06f2493e-4259-44b4-93fe-e1a810f8f0fa).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
