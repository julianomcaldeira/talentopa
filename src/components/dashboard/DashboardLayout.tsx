import { useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Server, Puzzle, Cog, FileText, Users, Building2,
  FolderKanban, DollarSign, LogOut, Menu, X, ChevronDown
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const DashboardLayout = ({
  links,
  title,
}: {
  links: { to: string; icon: React.ElementType; label: string }[];
  title: string;
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transform transition-transform duration-200 lg:translate-x-0 lg:static ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-sidebar-primary flex items-center justify-center">
              <span className="font-display font-bold text-sidebar-primary-foreground text-xs">TO</span>
            </div>
            <span className="font-display font-semibold text-sm">{title}</span>
          </Link>
          <button className="lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-sidebar-border">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors w-full"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-border bg-card flex items-center px-4 gap-4">
          <button className="lg:hidden text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
              {profile?.nome?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <span className="hidden sm:inline">{profile?.nome || "Usuário"}</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const adminLinks = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/softwares", icon: Server, label: "Softwares ERP" },
  { to: "/admin/modulos", icon: Puzzle, label: "Módulos" },
  { to: "/admin/funcionalidades", icon: Cog, label: "Funcionalidades" },
  { to: "/admin/templates", icon: FileText, label: "Templates" },
  { to: "/admin/consultores", icon: Users, label: "Consultores" },
  { to: "/admin/empresas", icon: Building2, label: "Empresas" },
  { to: "/admin/projetos", icon: FolderKanban, label: "Projetos" },
  { to: "/admin/financeiro", icon: DollarSign, label: "Financeiro" },
];

export const AdminLayout = () => <DashboardLayout links={adminLinks} title="Admin" />;

const consultorLinks = [
  { to: "/consultor", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/consultor/perfil", icon: Users, label: "Meu Perfil" },
  { to: "/consultor/habilidades", icon: Cog, label: "Habilidades" },
  { to: "/consultor/projetos", icon: FolderKanban, label: "Projetos Disponíveis" },
  { to: "/consultor/meus-projetos", icon: FileText, label: "Meus Projetos" },
  { to: "/consultor/financeiro", icon: DollarSign, label: "Financeiro" },
];

export const ConsultorLayout = () => <DashboardLayout links={consultorLinks} title="Consultor" />;

const empresaLinks = [
  { to: "/empresa", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/empresa/perfil", icon: Building2, label: "Perfil da Empresa" },
  { to: "/empresa/novo-projeto", icon: FileText, label: "Novo Projeto" },
  { to: "/empresa/projetos", icon: FolderKanban, label: "Meus Projetos" },
  { to: "/empresa/financeiro", icon: DollarSign, label: "Financeiro" },
];

export const EmpresaLayout = () => <DashboardLayout links={empresaLinks} title="Empresa" />;
