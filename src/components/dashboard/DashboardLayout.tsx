import { useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Server, Puzzle, Cog, FileText, Users, Building2,
  FolderKanban, DollarSign, LogOut, Menu, X, ChevronRight, Search, 
  Star, Settings, BarChart3, BookOpen, Brain, Sparkles, MessageSquare, Trophy, Bot, FileSpreadsheet, SlidersHorizontal
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import NotificationBell from "@/components/notifications/NotificationBell";

const DashboardLayout = ({
  links,
  title,
  accent,
}: {
  links: { to: string; icon: React.ElementType; label: string }[];
  title: string;
  accent?: string;
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const initials = profile?.nome
    ? profile.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] sidebar-gradient text-sidebar-foreground flex flex-col transform transition-transform duration-300 ease-out lg:translate-x-0 lg:static ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 h-[72px] px-5 border-b border-sidebar-border/50">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <span className="font-display font-bold text-primary-foreground text-xs tracking-wider">W</span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-display font-semibold text-sm text-sidebar-accent-foreground block">Workz</span>
            <span className="text-[11px] text-sidebar-foreground/50 capitalize">{title}</span>
          </div>
          <button className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          <p className="text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/40 font-semibold px-3 mb-2">
            Menu principal
          </p>
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200 relative ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <link.icon size={18} className={isActive ? "text-primary" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60"} />
                <span>{link.label}</span>
                {isActive && <ChevronRight size={14} className="ml-auto text-sidebar-foreground/30" />}
              </Link>
            );
          })}
          <div className="mt-2 pt-2 border-t border-sidebar-border/50">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-sidebar-foreground/50 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground transition-all w-full"
            >
              <LogOut size={16} />
              Sair da conta
            </button>
          </div>
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-sidebar-border/50">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-sidebar-accent/30">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-primary-foreground font-semibold text-xs shadow-md">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{profile?.nome || "Usuário"}</p>
              <p className="text-[11px] text-sidebar-foreground/40 truncate capitalize">{role || ""}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar */}
        <header className="h-[72px] border-b border-border bg-card/80 backdrop-blur-xl flex items-center px-4 md:px-6 gap-4 sticky top-0 z-30">
          <button className="lg:hidden text-foreground/60 hover:text-foreground p-2 rounded-xl hover:bg-muted transition-colors" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          {/* Search bar */}
          <div className="hidden md:flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted/60 border-0 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 md:hidden" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-3 pl-3 ml-1 border-l border-border">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-primary-foreground font-semibold text-xs shadow-md">
                {initials}
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-medium text-foreground leading-tight">{profile?.nome || "Usuário"}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

const adminLinks = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/projetos", icon: FolderKanban, label: "Projetos" },
  { to: "/admin/consultores", icon: Users, label: "Consultores" },
  { to: "/admin/empresas", icon: Building2, label: "Empresas" },
  { to: "/admin/moderacao", icon: MessageSquare, label: "Moderação" },
  { to: "/admin/financeiro", icon: DollarSign, label: "Financeiro" },
  { to: "/admin/catalogo", icon: Server, label: "Catálogo ERP" },
  { to: "/admin/base-conhecimento", icon: BookOpen, label: "Base de Conhecimento" },
  { to: "/admin/relatorios", icon: FileSpreadsheet, label: "Relatórios" },
  { to: "/admin/score-config", icon: SlidersHorizontal, label: "Config. de Score" },
];

export const AdminLayout = () => <DashboardLayout links={adminLinks} title="Administração" />;

const consultorLinks = [
  { to: "/consultor", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/consultor/projetos", icon: FolderKanban, label: "Encontrar Projetos" },
  { to: "/consultor/minhas-propostas", icon: FileText, label: "Minhas Propostas" },
  { to: "/consultor/perfil", icon: Users, label: "Meu Perfil" },
  { to: "/consultor/habilidades", icon: Star, label: "Habilidades" },
  { to: "/consultor/score", icon: Trophy, label: "Score & Portfólio" },
  { to: "/consultor/copilot", icon: Bot, label: "Copiloto IA" },
  { to: "/consultor/relatorios", icon: FileSpreadsheet, label: "Relatórios" },
];

export const ConsultorLayout = () => <DashboardLayout links={consultorLinks} title="Consultor" />;

const empresaLinks = [
  { to: "/empresa", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/empresa/projetos", icon: FolderKanban, label: "Meus Projetos" },
  { to: "/empresa/novo-projeto", icon: FileText, label: "Novo Projeto" },
  { to: "/empresa/perfil", icon: Building2, label: "Perfil da Empresa" },
  { to: "/empresa/relatorios", icon: FileSpreadsheet, label: "Relatórios" },
];

export const EmpresaLayout = () => <DashboardLayout links={empresaLinks} title="Empresa" />;
