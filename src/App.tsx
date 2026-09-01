import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { AdminLayout, ConsultorLayout, EmpresaLayout, CanalLayout } from "./components/dashboard/DashboardLayout";
import { lazy, Suspense } from "react";
const CanalDashboard = lazy(() => import("./pages/canal/CanalDashboard"));
const CanalConsultores = lazy(() => import("./pages/canal/CanalConsultores"));
const CanalProjetos = lazy(() => import("./pages/canal/CanalProjetos"));
const CanalDemandaDetalhe = lazy(() => import("./pages/canal/CanalDemandaDetalhe"));
const CanalAprovacoes = lazy(() => import("./pages/canal/CanalAprovacoes"));
const CanalConfiguracoes = lazy(() => import("./pages/canal/CanalConfiguracoes"));
const CanalAgenda = lazy(() => import("./pages/canal/CanalAgenda"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminCatalogo = lazy(() => import("./pages/admin/AdminCatalogo"));
const AdminEmpresas = lazy(() => import("./pages/admin/AdminEmpresas"));
const AdminProjetos = lazy(() => import("./pages/admin/AdminProjetos"));
const AdminFinanceiro = lazy(() => import("./pages/admin/AdminFinanceiro"));
const AdminConsultores = lazy(() => import("./pages/admin/AdminConsultores"));
const AdminCanais = lazy(() => import("./pages/admin/AdminCanais"));
const AdminProjetoDetalhe = lazy(() => import("./pages/admin/AdminProjetoDetalhe"));
const AdminModeracao = lazy(() => import("./pages/admin/AdminModeracao"));
const AdminTentativasBloqueadas = lazy(() => import("./pages/admin/AdminTentativasBloqueadas"));
const AdminMetricas = lazy(() => import("./pages/admin/AdminMetricas"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));
const ConsultorDashboard = lazy(() => import("./pages/consultor/ConsultorDashboard"));
const ConsultorPerfil = lazy(() => import("./pages/consultor/ConsultorPerfil"));
const ConsultorHabilidades = lazy(() => import("./pages/consultor/ConsultorHabilidades"));
const ConsultorProjetos = lazy(() => import("./pages/consultor/ConsultorProjetos"));
const ConsultorMinhasPropostas = lazy(() => import("./pages/consultor/ConsultorMinhasPropostas"));
const ConsultorCopilot = lazy(() => import("./pages/consultor/ConsultorCopilot"));
const ConsultorScore = lazy(() => import("./pages/consultor/ConsultorScore"));
const ConsultorPortfolioPublico = lazy(() => import("./pages/consultor/ConsultorPortfolioPublico"));
const EmpresaDashboard = lazy(() => import("./pages/empresa/EmpresaDashboard"));
const EmpresaPerfil = lazy(() => import("./pages/empresa/EmpresaPerfil"));
const EmpresaNovoProjeto = lazy(() => import("./pages/empresa/EmpresaNovoProjeto"));
const EmpresaProjetos = lazy(() => import("./pages/empresa/EmpresaProjetos"));
const EmpresaConsultoresHistorico = lazy(() => import("./pages/empresa/EmpresaConsultoresHistorico"));
const AdminRelatorios = lazy(() => import("./pages/admin/AdminRelatorios"));
const AdminScoreConfig = lazy(() => import("./pages/admin/AdminScoreConfig"));
const AdminAIContext = lazy(() => import("./pages/admin/AdminAIContext"));
const AdminUsuarios = lazy(() => import("./pages/admin/AdminUsuarios"));
const AdminTodosUsuarios = lazy(() => import("./pages/admin/AdminTodosUsuarios"));
const AdminPerfil = lazy(() => import("./pages/admin/AdminPerfil"));
const ConsultorRelatorios = lazy(() => import("./pages/consultor/ConsultorRelatorios"));
const ConsultorConvitesCanal = lazy(() => import("./pages/consultor/ConsultorConvitesCanal"));
const ConsultorAgenda = lazy(() => import("./pages/consultor/ConsultorAgenda"));
const ConsultorMinhasIndicacoes = lazy(() => import("./pages/consultor/ConsultorMinhasIndicacoes"));
const EmpresaRelatorios = lazy(() => import("./pages/empresa/EmpresaRelatorios"));
const ProjetoGestao = lazy(() => import("./pages/projetos/ProjetoGestao"));
const GestaoProjetos = lazy(() => import("./pages/projetos/GestaoProjetos"));
const ProjectStateReference = lazy(() => import("./pages/projetos/ProjectStateReference"));
const EmpresaShortlist = lazy(() => import("./pages/empresa/EmpresaShortlist"));
const EmpresaCoordenadores = lazy(() => import("./pages/empresa/EmpresaCoordenadores"));
const EmpresaCoordenadorPainel = lazy(() => import("./pages/empresa/EmpresaCoordenadorPainel"));
const queryClient = new QueryClient();

const AuthRedirect = () => {
  const { session, role, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!loading || role) return;
    const t = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, [loading, role]);
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (!role) {
    if (timedOut) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar seu perfil. Tente sair e entrar novamente.</p>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}>Sair e fazer login</Button>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  const redirectMap: Record<string, string> = { admin: "/admin", consultor: "/consultor", empresa: "/empresa", canal: "/canal" };
  return <Navigate to={redirectMap[role] || "/login"} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<AuthRedirect />} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="projetos" element={<AdminProjetos />} />
              <Route path="projetos/:id" element={<AdminProjetoDetalhe />} />
              <Route path="consultores" element={<AdminConsultores />} />
              <Route path="canais" element={<AdminCanais />} />
              <Route path="empresas" element={<AdminEmpresas />} />
              <Route path="financeiro" element={<AdminFinanceiro />} />
              <Route path="catalogo" element={<AdminCatalogo />} />
              <Route path="moderacao" element={<AdminModeracao />} />
              <Route path="moderacao/tentativas-bloqueadas" element={<AdminTentativasBloqueadas />} />
              <Route path="metricas" element={<AdminMetricas />} />
              <Route path="relatorios" element={<AdminRelatorios />} />
              <Route path="audit-logs" element={<AdminAuditLogs />} />
              <Route path="projetos/:id/gestao" element={<ProjetoGestao />} />
              <Route path="estados-projeto" element={<ProjectStateReference />} />
              <Route path="score-config" element={<AdminScoreConfig />} />
              <Route path="ai-context" element={<AdminAIContext />} />
              <Route path="usuarios" element={<AdminTodosUsuarios />} />
              <Route path="administradores" element={<AdminUsuarios />} />
              <Route path="perfil" element={<AdminPerfil />} />
            </Route>

            {/* Consultor */}
            <Route path="/consultor" element={<ProtectedRoute allowedRoles={["consultor"]}><ConsultorLayout /></ProtectedRoute>}>
              <Route index element={<ConsultorDashboard />} />
              <Route path="projetos" element={<ConsultorProjetos />} />
              <Route path="minhas-propostas" element={<ConsultorMinhasPropostas />} />
              <Route path="minhas-indicacoes" element={<ConsultorMinhasIndicacoes />} />
              <Route path="convites-canal" element={<ConsultorConvitesCanal />} />
              <Route path="agenda" element={<ConsultorAgenda />} />
              <Route path="perfil" element={<ConsultorPerfil />} />
              <Route path="habilidades" element={<ConsultorHabilidades />} />
              <Route path="copilot" element={<ConsultorCopilot />} />
              <Route path="score" element={<ConsultorScore />} />
              <Route path="portfolio/:userId" element={<ConsultorPortfolioPublico />} />
              <Route path="relatorios" element={<ConsultorRelatorios />} />
              <Route path="gestao" element={<GestaoProjetos />} />
              <Route path="estados-projeto" element={<ProjectStateReference />} />
              <Route path="projetos/:id/gestao" element={<ProjetoGestao />} />
            </Route>

            {/* Empresa */}
            <Route path="/empresa" element={<ProtectedRoute allowedRoles={["empresa"]}><EmpresaLayout /></ProtectedRoute>}>
              <Route index element={<EmpresaDashboard />} />
              <Route path="projetos" element={<EmpresaProjetos />} />
              <Route path="consultores" element={<EmpresaConsultoresHistorico />} />
              <Route path="novo-projeto" element={<EmpresaNovoProjeto />} />
              <Route path="perfil" element={<EmpresaPerfil />} />
              <Route path="relatorios" element={<EmpresaRelatorios />} />
              <Route path="gestao" element={<GestaoProjetos />} />
              <Route path="estados-projeto" element={<ProjectStateReference />} />
              <Route path="projetos/:id/gestao" element={<ProjetoGestao />} />
              <Route path="coordenadores" element={<EmpresaCoordenadores />} />
              <Route path="coordenacao" element={<EmpresaCoordenadorPainel />} />
              <Route path="shortlist" element={<EmpresaShortlist />} />
            </Route>

            {/* Canal */}
            <Route path="/canal" element={<ProtectedRoute allowedRoles={["canal"]}><CanalLayout /></ProtectedRoute>}>
              <Route index element={<CanalDashboard />} />
              <Route path="consultores" element={<CanalConsultores />} />
              <Route path="projetos" element={<CanalProjetos />} />
              <Route path="demandas/:id" element={<CanalDemandaDetalhe />} />
              <Route path="aprovacoes" element={<CanalAprovacoes />} />
              <Route path="configuracoes" element={<CanalConfiguracoes />} />
              <Route path="agenda" element={<CanalAgenda />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
