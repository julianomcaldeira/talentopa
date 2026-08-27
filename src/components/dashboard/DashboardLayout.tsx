import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Menu, X, Search, PanelLeftClose, PanelLeftOpen, UserCog } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NotificationBell from "@/components/notifications/NotificationBell";
import workzLogoWhite from "@/assets/workz-logo-white.png";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  NavGroup,
  adminGroups,
  canalGroups,
  consultorGroups,
  empresaGroups,
} from "./navConfig";

const COLLAPSE_KEY = "workz.sidebar.collapsed";

const DashboardLayout = ({
  groups,
  title,
  profileTo,
}: {
  groups: NavGroup[];
  title: string;
  profileTo?: string;
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(COLLAPSE_KEY) === "1"
  );
  const [cmdOpen, setCmdOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, empresaPapel, signOut } = useAuth();

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const allItems = useMemo(() => groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))), [groups]);

  const current = allItems.find((i) => i.to === location.pathname) || [...allItems].sort((a,b)=>b.to.length-a.to.length).find((i) => location.pathname.startsWith(i.to + "/"));
  const currentGroup = current?.group;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const initials = profile?.nome
    ? profile.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const width = collapsed ? "lg:w-[76px]" : "lg:w-[248px]";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen flex bg-background">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[248px] ${width} sidebar-gradient text-sidebar-foreground flex flex-col transform transition-all duration-200 ease-out lg:translate-x-0 lg:static ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Logo */}
          <div className={`flex items-center h-16 border-b border-sidebar-border/50 ${collapsed ? "lg:justify-center lg:px-0" : ""} gap-3 px-4`}>
            <Link to="/" className="flex-1 min-w-0 flex items-center lg:flex-none" aria-label="Workz">
              <img src={workzLogoWhite} alt="Workz" className={`w-auto select-none ${collapsed ? "h-5" : "h-5"}`} draggable={false} />
            </Link>
            {!collapsed && (
              <span className="hidden lg:inline text-[10px] uppercase tracking-wider text-sidebar-foreground/45 truncate">
                {title}
              </span>
            )}
            <button
              className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
              onClick={() => setSidebarOpen(false)}
              aria-label="Fechar menu"
            >
              <X size={18} />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto custom-scrollbar">
            {groups.map((group) => (
              <div key={group.label} className="space-y-0.5">
                {!collapsed && (
                  <p className="text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/35 font-semibold px-2.5 mb-1.5">
                    {group.label}
                  </p>
                )}
                {collapsed && <div className="h-px bg-sidebar-border/40 mx-2 my-2" />}
                {group.items.map((link) => {
                  const isBase = ["/admin", "/empresa", "/consultor", "/canal"].includes(link.to);
                  const isActive = location.pathname === link.to || (!isBase && location.pathname.startsWith(link.to + "/"));
                  const content = (
                    <Link
                      key={link.to}
                      to={link.to}
                      aria-current={isActive ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg text-[13px] transition-colors duration-150 ${
                        collapsed ? "lg:justify-center lg:px-0 px-2.5" : "px-2.5"
                      } py-2 ${
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="activeNav"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-primary"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                      <link.icon
                        size={17}
                        className={isActive ? "text-primary shrink-0" : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/70 shrink-0"}
                      />
                      <span className={collapsed ? "lg:hidden" : ""}>{link.label}</span>
                    </Link>
                  );
                  return collapsed ? (
                    <Tooltip key={link.to}>
                      <TooltipTrigger asChild>{content}</TooltipTrigger>
                      <TooltipContent side="right">{link.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    content
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Footer: collapse toggle */}
          <div className="hidden lg:flex items-center border-t border-sidebar-border/50 p-2">
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-[12px] text-sidebar-foreground/50 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-colors"
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? <PanelLeftOpen size={16} className="mx-auto" /> : <><PanelLeftClose size={16} /> Recolher menu</>}
            </button>
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
          <header className="h-16 border-b border-border bg-card/85 backdrop-blur-xl flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30">
            <button
              className="lg:hidden text-foreground/60 hover:text-foreground p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb contextual */}
            <nav aria-label="Trilha de navegação" className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-muted-foreground">{title}</span>
              {currentGroup && (
                <>
                  <span className="text-muted-foreground/40">/</span>
                  <span className="text-muted-foreground">{currentGroup}</span>
                </>
              )}
              {current && (
                <>
                  <span className="text-muted-foreground/40">/</span>
                  <span className="font-medium text-foreground truncate">{current.label}</span>
                </>
              )}
            </nav>

            <div className="flex-1" />

            {/* Busca / atalho de navegação */}
            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground text-sm transition-colors"
            >
              <Search size={15} />
              <span className="hidden md:inline">Ir para…</span>
              <kbd className="hidden md:inline text-[10px] font-medium px-1.5 py-0.5 rounded bg-background border border-border">
                ⌘K
              </kbd>
            </button>

            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg pl-1 pr-1.5 py-1 hover:bg-muted transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-primary-foreground font-semibold text-[11px]">
                  {initials}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-[13px] font-medium text-foreground leading-tight">{profile?.nome || "Usuário"}</p>
                  <p className="text-[11px] text-muted-foreground capitalize leading-tight">
                    {empresaPapel ? empresaPapel : role}
                  </p>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium truncate">{profile?.nome || "Usuário"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{empresaPapel ? empresaPapel : role}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profileTo && (
                  <DropdownMenuItem onClick={() => navigate(profileTo)}>
                    <UserCog className="h-4 w-4 mr-2" /> Meu perfil
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" /> Sair da conta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            <div className="page-enter mx-auto w-full max-w-[1400px]">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Command palette */}
        <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
          <CommandInput placeholder="Buscar telas do sistema…" />
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.label} heading={g.label}>
                {g.items.map((item) => (
                  <CommandItem
                    key={item.to}
                    value={`${g.label} ${item.label}`}
                    onSelect={() => {
                      setCmdOpen(false);
                      navigate(item.to);
                    }}
                  >
                    <item.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </CommandDialog>
      </div>
    </TooltipProvider>
  );
};

export const AdminLayout = () => (
  <DashboardLayout groups={adminGroups} title="Administração" profileTo="/admin/perfil" />
);

export const ConsultorLayout = () => {
  const { user } = useAuth();
  const [temVinculo, setTemVinculo] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).rpc("consultor_tem_vinculo_ativo", { p_consultor: user.id });
      setTemVinculo(!!data);
    })();
  }, [user]);

  return (
    <DashboardLayout groups={consultorGroups(temVinculo)} title="Consultor" profileTo="/consultor/perfil" />
  );
};

export const EmpresaLayout = () => (
  <DashboardLayout groups={empresaGroups} title="Empresa" profileTo="/empresa/perfil" />
);

export const CanalLayout = () => (
  <DashboardLayout groups={canalGroups} title="Canal" profileTo="/canal/configuracoes" />
);

export default DashboardLayout;
