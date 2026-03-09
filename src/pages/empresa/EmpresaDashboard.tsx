import { useState, useEffect } from "react";
import { FolderKanban, DollarSign, Users, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho", publicado: "Publicado", em_selecao: "Em seleção",
  em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado",
};
const statusColors: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground", publicado: "bg-primary/10 text-primary",
  em_selecao: "bg-warning/10 text-warning", em_andamento: "bg-info/10 text-info",
  concluido: "bg-success/10 text-success", cancelado: "bg-destructive/10 text-destructive",
};

const EmpresaDashboard = () => {
  const { user, profile } = useAuth();
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("projetos")
        .select("*, softwares(nome), projeto_fases(id, nome, status)")
        .eq("empresa_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setProjetos(data);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const activeCount = projetos.filter(p => ["publicado", "em_selecao", "em_andamento"].includes(p.status)).length;
  const doneCount = projetos.filter(p => p.status === "concluido").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Olá, {profile?.nome || "Empresa"}!</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus projetos e consultores</p>
        </div>
        <Button asChild>
          <Link to="/empresa/novo-projeto">+ Novo Projeto</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Projetos ativos", value: activeCount.toString(), icon: FolderKanban },
          { label: "Concluídos", value: doneCount.toString(), icon: Clock },
          { label: "Total de projetos", value: projetos.length.toString(), icon: Users },
          { label: "Investimento", value: "R$ 0", icon: DollarSign },
        ].map((stat, i) => (
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
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : projetos.length === 0 ? (
          <p className="text-muted-foreground">Nenhum projeto criado. <Link to="/empresa/novo-projeto" className="text-primary hover:underline">Criar primeiro projeto</Link></p>
        ) : (
          <div className="space-y-3">
            {projetos.map((p) => (
              <div key={p.id} className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">{p.nome}</p>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[p.status] || ""}`}>
                    {statusLabels[p.status] || p.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{p.softwares?.nome} • {p.protocolo}</p>
                {p.projeto_fases && p.projeto_fases.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {p.projeto_fases.map((f: any) => (
                      <div key={f.id} className={`flex-1 h-1.5 rounded-full ${
                        f.status === "aprovada" ? "bg-success" : f.status === "em_andamento" ? "bg-primary" : "bg-border"
                      }`} title={f.nome} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmpresaDashboard;
