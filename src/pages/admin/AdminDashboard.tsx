import { Building2, Users, FolderKanban, DollarSign, TrendingUp, AlertCircle } from "lucide-react";

const stats = [
  { label: "Consultores ativos", value: "342", icon: Users, change: "+12%" },
  { label: "Empresas cadastradas", value: "89", icon: Building2, change: "+8%" },
  { label: "Projetos em andamento", value: "47", icon: FolderKanban, change: "+15%" },
  { label: "Receita do mês", value: "R$ 128.4k", icon: DollarSign, change: "+22%" },
];

const AdminDashboard = () => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-foreground">Painel Administrativo</h1>
        <p className="text-muted-foreground mt-1">Visão geral da plataforma TalentOps</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-card rounded-xl p-5 shadow-card border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-medium text-success flex items-center gap-1">
                <TrendingUp size={12} /> {stat.change}
              </span>
            </div>
            <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl p-6 shadow-card border border-border">
          <h3 className="font-display font-semibold text-foreground mb-4">Projetos recentes</h3>
          <div className="space-y-3">
            {[
              { name: "Implantação TOTVS Protheus - Financeiro", status: "Em andamento", company: "ABC Ltda" },
              { name: "Migração SAP - Módulo Fiscal", status: "Aguardando consultor", company: "XYZ S.A." },
              { name: "Customização Oracle - RH", status: "Concluído", company: "Tech Corp" },
            ].map((project, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{project.name}</p>
                  <p className="text-xs text-muted-foreground">{project.company}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  project.status === "Concluído" ? "bg-success/10 text-success" :
                  project.status === "Em andamento" ? "bg-primary/10 text-primary" :
                  "bg-warning/10 text-warning"
                }`}>
                  {project.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl p-6 shadow-card border border-border">
          <h3 className="font-display font-semibold text-foreground mb-4">Alertas</h3>
          <div className="space-y-3">
            {[
              { text: "3 projetos aguardando mediação", type: "warning" },
              { text: "5 novos consultores pendentes de aprovação", type: "info" },
              { text: "Pagamento pendente - Projeto #1247", type: "warning" },
            ].map((alert, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${
                alert.type === "warning" ? "bg-warning/10" : "bg-info/10"
              }`}>
                <AlertCircle className={`h-4 w-4 flex-shrink-0 ${
                  alert.type === "warning" ? "text-warning" : "text-info"
                }`} />
                <p className="text-sm text-foreground">{alert.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
