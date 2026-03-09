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
import AdminSoftwares from "./pages/admin/AdminSoftwares";
import AdminModulos from "./pages/admin/AdminModulos";
import AdminFuncionalidades from "./pages/admin/AdminFuncionalidades";
import AdminTemplates from "./pages/admin/AdminTemplates";
import AdminEmpresas from "./pages/admin/AdminEmpresas";
import AdminProjetos from "./pages/admin/AdminProjetos";
import AdminFinanceiro from "./pages/admin/AdminFinanceiro";
import AdminConsultores from "./pages/admin/AdminConsultores";
import AdminInteligencia from "./pages/admin/AdminInteligencia";
import AdminBaseConhecimento from "./pages/admin/AdminBaseConhecimento";
import AdminProjetoDetalhe from "./pages/admin/AdminProjetoDetalhe";
import ConsultorDashboard from "./pages/consultor/ConsultorDashboard";
import ConsultorPerfil from "./pages/consultor/ConsultorPerfil";
import ConsultorHabilidades from "./pages/consultor/ConsultorHabilidades";
import ConsultorProjetos from "./pages/consultor/ConsultorProjetos";
import EmpresaDashboard from "./pages/empresa/EmpresaDashboard";
import EmpresaPerfil from "./pages/empresa/EmpresaPerfil";
import EmpresaNovoProjeto from "./pages/empresa/EmpresaNovoProjeto";
import EmpresaProjetos from "./pages/empresa/EmpresaProjetos";
import PlaceholderPage from "./components/PlaceholderPage";

const queryClient = new QueryClient();

const AuthRedirect = () => {
  const { session, role, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  const redirectMap: Record<string, string> = { admin: "/admin", consultor: "/consultor", empresa: "/empresa" };
  return <Navigate to={redirectMap[role || ""] || "/login"} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
              <Route path="softwares" element={<AdminSoftwares />} />
              <Route path="modulos" element={<AdminModulos />} />
              <Route path="funcionalidades" element={<AdminFuncionalidades />} />
              <Route path="templates" element={<AdminTemplates />} />
              <Route path="consultores" element={<AdminConsultores />} />
              <Route path="empresas" element={<AdminEmpresas />} />
              <Route path="projetos" element={<AdminProjetos />} />
              <Route path="financeiro" element={<AdminFinanceiro />} />
            </Route>

            {/* Consultor */}
            <Route path="/consultor" element={<ProtectedRoute allowedRoles={["consultor"]}><ConsultorLayout /></ProtectedRoute>}>
              <Route index element={<ConsultorDashboard />} />
              <Route path="perfil" element={<ConsultorPerfil />} />
              <Route path="habilidades" element={<ConsultorHabilidades />} />
              <Route path="projetos" element={<ConsultorProjetos />} />
              <Route path="meus-projetos" element={<PlaceholderPage title="Meus Projetos" description="Projetos que você participa" />} />
              <Route path="financeiro" element={<PlaceholderPage title="Financeiro" description="Seus ganhos e pagamentos" />} />
            </Route>

            {/* Empresa */}
            <Route path="/empresa" element={<ProtectedRoute allowedRoles={["empresa"]}><EmpresaLayout /></ProtectedRoute>}>
              <Route index element={<EmpresaDashboard />} />
              <Route path="perfil" element={<EmpresaPerfil />} />
              <Route path="novo-projeto" element={<EmpresaNovoProjeto />} />
              <Route path="projetos" element={<EmpresaProjetos />} />
              <Route path="financeiro" element={<PlaceholderPage title="Financeiro" description="Pagamentos e faturamento" />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
