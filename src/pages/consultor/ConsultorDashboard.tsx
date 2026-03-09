import { FolderKanban, DollarSign, Star, Clock } from "lucide-react";

const stats = [
  { label: "Projetos ativos", value: "3", icon: FolderKanban },
  { label: "Projetos concluídos", value: "12", icon: Clock },
  { label: "Receita total", value: "R$ 84.2k", icon: DollarSign },
  { label: "Avaliação média", value: "4.8", icon: Star },
];

const ConsultorDashboard = () => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-foreground">Olá, Consultor!</h1>
        <p className="text-muted-foreground mt-1">Confira seus projetos e oportunidades</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-card rounded-xl p-5 shadow-card border border-border">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <stat.icon className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl p-6 shadow-card border border-border">
        <h3 className="font-display font-semibold text-foreground mb-4">Projetos disponíveis para você</h3>
        <div className="space-y-3">
          {[
            { name: "Implantação TOTVS - Módulo Fiscal", hours: "120h", budget: "R$ 36.000", match: "95%" },
            { name: "Configuração SAP - Financeiro", hours: "80h", budget: "R$ 28.000", match: "88%" },
            { name: "Customização Fluig - Workflow", hours: "60h", budget: "R$ 18.000", match: "82%" },
          ].map((project, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium text-foreground">{project.name}</p>
                <p className="text-xs text-muted-foreground">{project.hours} estimadas • {project.budget}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent font-medium">
                {project.match} match
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConsultorDashboard;
