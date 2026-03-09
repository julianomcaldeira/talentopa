import { FolderKanban, DollarSign, Users, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const stats = [
  { label: "Projetos ativos", value: "2", icon: FolderKanban },
  { label: "Projetos concluídos", value: "5", icon: Clock },
  { label: "Consultores contratados", value: "8", icon: Users },
  { label: "Investimento total", value: "R$ 210k", icon: DollarSign },
];

const EmpresaDashboard = () => {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Painel da Empresa</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus projetos e consultores</p>
        </div>
        <Button asChild>
          <Link to="/empresa/novo-projeto">+ Novo Projeto</Link>
        </Button>
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
        <h3 className="font-display font-semibold text-foreground mb-4">Seus projetos</h3>
        <div className="space-y-3">
          {[
            { name: "Implantação TOTVS Protheus - Financeiro", status: "Em andamento", consultor: "João Silva", progress: 65 },
            { name: "Migração SAP - Módulo Compras", status: "Selecionando consultor", consultor: "-", progress: 10 },
          ].map((project, i) => (
            <div key={i} className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">{project.name}</p>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  project.status === "Em andamento" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
                }`}>
                  {project.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Consultor: {project.consultor}</p>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-primary rounded-full h-1.5 transition-all"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmpresaDashboard;
