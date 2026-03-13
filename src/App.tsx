import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { AdminLayout, ConsultorLayout, EmpresaLayout } from "./components/dashboard/DashboardLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCatalogo from "./pages/admin/AdminCatalogo";
import AdminEmpresas from "./pages/admin/AdminEmpresas";
import AdminProjetos from "./pages/admin/AdminProjetos";
import AdminFinanceiro from "./pages/admin/AdminFinanceiro";
import AdminConsultores from "./pages/admin/AdminConsultores";
import AdminBaseConhecimento from "./pages/admin/AdminBaseConhecimento";
import AdminProjetoDetalhe from "./pages/admin/AdminProjetoDetalhe";
import AdminModeracao from "./pages/admin/AdminModeracao";
import ConsultorDashboard from "./pages/consultor/ConsultorDashboard";
import ConsultorPerfil from "./pages/consultor/ConsultorPerfil";
import ConsultorHabilidades from "./pages/consultor/ConsultorHabilidades";
import ConsultorProjetos from "./pages/consultor/ConsultorProjetos";
import ConsultorMinhasPropostas from "./pages/consultor/ConsultorMinhasPropostas";
import ConsultorCopilot from "./pages/consultor/ConsultorCopilot";
import ConsultorScore from "./pages/consultor/ConsultorScore";
import ConsultorPortfolioPublico from "./pages/consultor/ConsultorPortfolioPublico";
import EmpresaDashboard from "./pages/empresa/EmpresaDashboard";
import EmpresaPerfil from "./pages/empresa/EmpresaPerfil";
import EmpresaNovoProjeto from "./pages/empresa/EmpresaNovoProjeto";
import EmpresaProjetos from "./pages/empresa/EmpresaProjetos";
import AdminRelatorios from "./pages/admin/AdminRelatorios";
import ConsultorRelatorios from "./pages/consultor/ConsultorRelatorios";
import EmpresaRelatorios from "./pages/empresa/EmpresaRelatorios";
const queryClient = new QueryClient();

const AuthRedirect = () => {
  const { session, role, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  const redirectMap: Record<string, string> = { admin: "/admin", consultor: "/consultor", empresa: "/empresa" };
  return <Navigate to={redirectMap[role] || "/login"} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Landing page temporariamente desativada */}
            {/* <Route path="/" element={<Index />} /> */}
            <Route path="/" element={<Navigate to="/login" replace />} />
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
              <Route path="empresas" element={<AdminEmpresas />} />
              <Route path="financeiro" element={<AdminFinanceiro />} />
              <Route path="catalogo" element={<AdminCatalogo />} />
              <Route path="moderacao" element={<AdminModeracao />} />
              <Route path="base-conhecimento" element={<AdminBaseConhecimento />} />
              <Route path="relatorios" element={<AdminRelatorios />} />
            </Route>

            {/* Consultor */}
            <Route path="/consultor" element={<ProtectedRoute allowedRoles={["consultor"]}><ConsultorLayout /></ProtectedRoute>}>
              <Route index element={<ConsultorDashboard />} />
              <Route path="projetos" element={<ConsultorProjetos />} />
              <Route path="minhas-propostas" element={<ConsultorMinhasPropostas />} />
              <Route path="perfil" element={<ConsultorPerfil />} />
              <Route path="habilidades" element={<ConsultorHabilidades />} />
              <Route path="copilot" element={<ConsultorCopilot />} />
              <Route path="score" element={<ConsultorScore />} />
              <Route path="portfolio/:userId" element={<ConsultorPortfolioPublico />} />
              <Route path="relatorios" element={<ConsultorRelatorios />} />
            </Route>

            {/* Empresa */}
            <Route path="/empresa" element={<ProtectedRoute allowedRoles={["empresa"]}><EmpresaLayout /></ProtectedRoute>}>
              <Route index element={<EmpresaDashboard />} />
              <Route path="projetos" element={<EmpresaProjetos />} />
              <Route path="novo-projeto" element={<EmpresaNovoProjeto />} />
              <Route path="perfil" element={<EmpresaPerfil />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
