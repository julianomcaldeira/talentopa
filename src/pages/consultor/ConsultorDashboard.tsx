import { useState, useEffect } from "react";
import { FolderKanban, DollarSign, Star, Clock, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard, StatusBadge, PageHeader, DataCard, SectionTitle, LoadingState } from "@/components/dashboard/DashboardComponents";
import { Link } from "react-router-dom";

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
      <PageHeader
        title={`Olá, ${profile?.nome?.split(" ")[0] || "Consultor"}!`}
        description="Confira seus projetos e oportunidades disponíveis"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FolderKanban} label="Projetos disponíveis" value={projetos.length.toString()} iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon={Clock} label="Concluídos" value="0" iconColor="text-success" iconBg="bg-success/10" />
        <StatCard icon={DollarSign} label="Receita total" value="R$ 0" iconColor="text-accent" iconBg="bg-accent/10" />
        <StatCard icon={Star} label="Avaliação média" value="—" iconColor="text-warning" iconBg="bg-warning/10" />
      </div>

      <DataCard noPadding>
        <div className="p-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <SectionTitle>Projetos disponíveis</SectionTitle>
            <Link to="/consultor/projetos" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
              Ver todos <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
        {loading ? <LoadingState /> : projetos.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Nenhum projeto disponível no momento</div>
        ) : (
          <div className="divide-y divide-border/60">
            {projetos.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4 px-5 table-row-interactive cursor-pointer">
                <div className="flex items-center gap-3.5">
                  <div className="icon-container icon-container-sm bg-muted/60">
                    <FolderKanban size={14} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.softwares?.nome} · {p.protocolo}</p>
                  </div>
                </div>
                <StatusBadge status={p.status} labels={{ publicado: "Aberto", em_selecao: "Em seleção" }} />
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
};

export default ConsultorDashboard;
