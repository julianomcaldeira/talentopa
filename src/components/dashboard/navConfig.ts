import {
  LayoutDashboard, Server, FileText, Users, Building2,
  FolderKanban, DollarSign, Star, Settings, BookOpen,
  MessageSquare, Trophy, Bot, FileSpreadsheet, SlidersHorizontal, Activity,
  ScrollText, Briefcase, Workflow, ShieldAlert, ShieldCheck, UserCog, Mail,
  CalendarDays, Network, ListChecks, Handshake,
} from "lucide-react";

export type NavLinkItem = { to: string; icon: React.ElementType; label: string };
export type NavGroup = { label: string; items: NavLinkItem[] };

export const adminGroups: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/admin/metricas", icon: Activity, label: "Métricas" },
      { to: "/admin/relatorios", icon: FileSpreadsheet, label: "Relatórios" },
    ],
  },
  {
    label: "Operação",
    items: [
      { to: "/admin/projetos", icon: FolderKanban, label: "Projetos" },
      { to: "/admin/estados-projeto", icon: Workflow, label: "Estados do Projeto" },
      { to: "/admin/financeiro", icon: DollarSign, label: "Financeiro" },
    ],
  },
  {
    label: "Rede",
    items: [
      { to: "/admin/consultores", icon: Users, label: "Consultores" },
      { to: "/admin/canais", icon: Network, label: "Canais" },
      { to: "/admin/empresas", icon: Building2, label: "Empresas" },
    ],
  },
  {
    label: "Governança",
    items: [
      { to: "/admin/moderacao", icon: MessageSquare, label: "Moderação" },
      { to: "/admin/moderacao/tentativas-bloqueadas", icon: ShieldAlert, label: "Tentativas Bloqueadas" },
      { to: "/admin/audit-logs", icon: ScrollText, label: "Logs de Auditoria" },
      { to: "/admin/usuarios", icon: Users, label: "Usuários" },
      { to: "/admin/administradores", icon: ShieldCheck, label: "Administradores" },
    ],
  },
  {
    label: "Configuração",
    items: [
      { to: "/admin/catalogo", icon: Server, label: "Catálogo ERP" },
      { to: "/admin/score-config", icon: SlidersHorizontal, label: "Config. de Score" },
      { to: "/admin/ai-context", icon: Bot, label: "Contexto IA" },
      { to: "/admin/perfil", icon: UserCog, label: "Meu perfil" },
    ],
  },
];

export const consultorGroups = (temVinculo: boolean): NavGroup[] => [
  {
    label: "Trabalho",
    items: [
      { to: "/consultor", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/consultor/projetos", icon: FolderKanban, label: "Encontrar Projetos" },
      { to: "/consultor/minhas-propostas", icon: FileText, label: "Minhas Propostas" },
      ...(temVinculo
        ? [{ to: "/consultor/minhas-indicacoes", icon: Handshake, label: "Minhas Indicações" }]
        : []),
      { to: "/consultor/gestao", icon: Briefcase, label: "Gestão de Projetos" },
      { to: "/consultor/agenda", icon: CalendarDays, label: "Minha Agenda" },
    ],
  },
  {
    label: "Meu perfil",
    items: [
      { to: "/consultor/perfil", icon: Users, label: "Meu Perfil" },
      { to: "/consultor/habilidades", icon: Star, label: "Habilidades" },
      { to: "/consultor/score", icon: Trophy, label: "Score & Portfólio" },
      { to: "/consultor/convites-canal", icon: Mail, label: "Convites de Canais" },
    ],
  },
  {
    label: "Apoio",
    items: [
      { to: "/consultor/copilot", icon: Bot, label: "Copiloto IA" },
      { to: "/consultor/relatorios", icon: FileSpreadsheet, label: "Relatórios" },
      { to: "/consultor/estados-projeto", icon: Workflow, label: "Estados do Projeto" },
    ],
  },
];

export const empresaGroups: NavGroup[] = [
  {
    label: "Demandas",
    items: [
      { to: "/empresa", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/empresa/projetos", icon: FolderKanban, label: "Projetos" },
      { to: "/empresa/shortlist", icon: ListChecks, label: "Shortlists (RMO)" },
      { to: "/empresa/gestao", icon: Briefcase, label: "Gestão de Projetos" },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { to: "/empresa/coordenacao", icon: UserCog, label: "Coordenação Técnica" },
      { to: "/empresa/coordenadores", icon: Users, label: "Equipe" },
      { to: "/empresa/consultores", icon: Users, label: "Consultores" },
    ],
  },
  {
    label: "Empresa",
    items: [
      { to: "/empresa/perfil", icon: Building2, label: "Perfil da Empresa" },
      { to: "/empresa/relatorios", icon: FileSpreadsheet, label: "Relatórios" },
      { to: "/empresa/estados-projeto", icon: Workflow, label: "Estados do Projeto" },
    ],
  },
];

export const canalGroups: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { to: "/canal", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/canal/projetos", icon: FolderKanban, label: "Projetos" },
      { to: "/canal/aprovacoes", icon: ShieldAlert, label: "Aprovações" },
    ],
  },
  {
    label: "Quadro",
    items: [
      { to: "/canal/consultores", icon: Users, label: "Meus Consultores" },
      { to: "/canal/agenda", icon: CalendarDays, label: "Agenda" },
    ],
  },
  {
    label: "Conta",
    items: [{ to: "/canal/configuracoes", icon: Settings, label: "Configurações" }],
  },
];

export const unusedIcons = { BookOpen };
