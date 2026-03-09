import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import { AdminLayout, ConsultorLayout, EmpresaLayout } from "./components/dashboard/DashboardLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSoftwares from "./pages/admin/AdminSoftwares";
import ConsultorDashboard from "./pages/consultor/ConsultorDashboard";
import EmpresaDashboard from "./pages/empresa/EmpresaDashboard";
import PlaceholderPage from "./components/PlaceholderPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="softwares" element={<AdminSoftwares />} />
            <Route path="modulos" element={<PlaceholderPage title="Módulos" description="Gerencie módulos dos softwares ERP" />} />
            <Route path="funcionalidades" element={<PlaceholderPage title="Funcionalidades" description="Gerencie funcionalidades dos módulos" />} />
            <Route path="templates" element={<PlaceholderPage title="Templates" description="Templates de implementação" />} />
            <Route path="consultores" element={<PlaceholderPage title="Consultores" description="Gerencie consultores da plataforma" />} />
            <Route path="empresas" element={<PlaceholderPage title="Empresas" description="Gerencie empresas cadastradas" />} />
            <Route path="projetos" element={<PlaceholderPage title="Projetos" description="Todos os projetos da plataforma" />} />
            <Route path="financeiro" element={<PlaceholderPage title="Financeiro" description="Painel financeiro da plataforma" />} />
          </Route>

          {/* Consultor */}
          <Route path="/consultor" element={<ConsultorLayout />}>
            <Route index element={<ConsultorDashboard />} />
            <Route path="perfil" element={<PlaceholderPage title="Meu Perfil" description="Gerencie seu perfil e habilidades técnicas" />} />
            <Route path="projetos" element={<PlaceholderPage title="Projetos Disponíveis" description="Projetos compatíveis com seu perfil" />} />
            <Route path="meus-projetos" element={<PlaceholderPage title="Meus Projetos" description="Projetos que você participa" />} />
            <Route path="financeiro" element={<PlaceholderPage title="Financeiro" description="Seus ganhos e pagamentos" />} />
          </Route>

          {/* Empresa */}
          <Route path="/empresa" element={<EmpresaLayout />}>
            <Route index element={<EmpresaDashboard />} />
            <Route path="perfil" element={<PlaceholderPage title="Perfil da Empresa" description="Dados cadastrais e fiscais" />} />
            <Route path="novo-projeto" element={<PlaceholderPage title="Novo Projeto" description="Crie um novo projeto de implementação" />} />
            <Route path="projetos" element={<PlaceholderPage title="Meus Projetos" description="Acompanhe seus projetos" />} />
            <Route path="financeiro" element={<PlaceholderPage title="Financeiro" description="Pagamentos e faturamento" />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
