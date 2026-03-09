import { useState, useEffect } from "react";
import { FolderKanban, DollarSign, Star, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ConsultorDashboard = () => {
  const { user, profile } = useAuth();
  const [projetos, setProjectos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("projetos")
        .select("*, softwares(nome)")
        .in("status", ["publicado", "em_selecao"])
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setProjectos(data);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-foreground">Olá, {profile?.nome || "Consultor"}!</h1>
        <p className="text-muted-foreground mt-1">Confira seus projetos e oportunidades</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Projetos disponíveis", value: projetos.length.toString(), icon: FolderKanban },
          { label: "Concluídos", value: "0", icon: Clock },
          { label: "Receita total", value: "R$ 0", icon: DollarSign },
          { label: "Avaliação", value: "-", icon: Star },
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
        <h3 className="font-display font-semibold text-foreground mb-4">Projetos disponíveis</h3>
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : projetos.length === 0 ? (
          <p className="text-muted-foreground">Nenhum projeto disponível no momento</p>
        ) : (
          <div className="space-y-3">
            {projetos.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.softwares?.nome} • {p.protocolo}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                  Aberto
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsultorDashboard;
