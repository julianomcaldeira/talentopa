import { Building2, Users, FolderKanban, DollarSign, TrendingUp, AlertCircle, ArrowUpRight, Clock } from "lucide-react";
import { StatCard, StatusBadge, PageHeader, DataCard, SectionTitle } from "@/components/dashboard/DashboardComponents";

const AdminDashboard = () => {
  return (
    <div>
      <PageHeader
        title="Painel Administrativo"
        description="Visão geral da plataforma TalentOps"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Consultores ativos" value="342" change="+12%" changeType="positive" iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon={Building2} label="Empresas cadastradas" value="89" change="+8%" changeType="positive" iconColor="text-accent" iconBg="bg-accent/10" />
        <StatCard icon={FolderKanban} label="Projetos em andamento" value="47" change="+15%" changeType="positive" iconColor="text-info" iconBg="bg-info/10" />
        <StatCard icon={DollarSign} label="Receita do mês" value="R$ 128.4k" change="+22%" changeType="positive" iconColor="text-success" iconBg="bg-success/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent projects */}
        <DataCard className="lg:col-span-2" noPadding>
          <div className="p-5 pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <SectionTitle>Projetos recentes</SectionTitle>
              <button className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                Ver todos <ArrowUpRight size={12} />
              </button>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {[
              { name: "Implantação TOTVS Protheus - Financeiro", status: "em_andamento", company: "ABC Ltda", date: "Há 2 dias" },
              { name: "Migração SAP - Módulo Fiscal", status: "publicado", company: "XYZ S.A.", date: "Há 5 dias" },
              { name: "Customização Oracle - RH", status: "concluido", company: "Tech Corp", date: "Há 1 semana" },
              { name: "Fluig - Automação de Processos", status: "em_selecao", company: "Indústria BR", date: "Há 3 dias" },
            ].map((project, i) => (
              <div key={i} className="flex items-center justify-between p-4 px-5 table-row-interactive cursor-pointer">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="icon-container icon-container-sm bg-muted/60 flex-shrink-0">
                    <FolderKanban size={14} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                    <p className="text-xs text-muted-foreground">{project.company} • {project.date}</p>
                  </div>
                </div>
                <StatusBadge status={project.status} />
              </div>
            ))}
          </div>
        </DataCard>

        {/* Alerts + Activity */}
        <div className="space-y-6">
          <DataCard>
            <SectionTitle>Alertas</SectionTitle>
            <div className="space-y-3">
              {[
                { text: "3 projetos aguardando mediação", type: "warning", icon: AlertCircle },
                { text: "5 novos consultores pendentes", type: "info", icon: Users },
                { text: "Pagamento pendente - #1247", type: "warning", icon: Clock },
              ].map((alert, i) => (
                <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl ${
                  alert.type === "warning" ? "bg-warning/5 border border-warning/10" : "bg-info/5 border border-info/10"
                }`}>
                  <alert.icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                    alert.type === "warning" ? "text-warning" : "text-info"
                  }`} />
                  <p className="text-[13px] text-foreground leading-snug">{alert.text}</p>
                </div>
              ))}
            </div>
          </DataCard>

          <DataCard>
            <SectionTitle>Atividade recente</SectionTitle>
            <div className="space-y-4">
              {[
                { text: "João Silva se candidatou ao projeto #1285", time: "Há 15 min" },
                { text: "Empresa ABC aprovou fase 2", time: "Há 1 hora" },
                { text: "Novo consultor registrado", time: "Há 3 horas" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-[13px] text-foreground leading-snug">{item.text}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </DataCard>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
