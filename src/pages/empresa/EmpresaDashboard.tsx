import { useState, useEffect } from "react";
import { FolderKanban, DollarSign, Users, Clock, ArrowUpRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard, StatusBadge, PageHeader, DataCard, SectionTitle, LoadingState } from "@/components/dashboard/DashboardComponents";

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
      <PageHeader
        title={`Olá, ${profile?.nome?.split(" ")[0] || "Empresa"}!`}
        description="Gerencie seus projetos e consultores"
        action={
          <Button asChild>
            <Link to="/empresa/novo-projeto"><Plus size={16} /> Novo Projeto</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FolderKanban} label="Projetos ativos" value={activeCount.toString()} iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon={Clock} label="Concluídos" value={doneCount.toString()} iconColor="text-success" iconBg="bg-success/10" />
        <StatCard icon={Users} label="Total de projetos" value={projetos.length.toString()} iconColor="text-info" iconBg="bg-info/10" />
        <StatCard icon={DollarSign} label="Investimento" value="R$ 0" iconColor="text-accent" iconBg="bg-accent/10" />
      </div>

      <DataCard noPadding>
        <div className="p-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <SectionTitle>Seus projetos</SectionTitle>
            <Link to="/empresa/projetos" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
              Ver todos <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
        {loading ? <LoadingState /> : projetos.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground text-sm mb-3">Nenhum projeto criado ainda</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/empresa/novo-projeto">Criar primeiro projeto</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {projetos.map((p) => (
              <div key={p.id} className="p-4 px-5 table-row-interactive">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="icon-container icon-container-sm bg-muted/60">
                      <FolderKanban size={14} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.softwares?.nome} · {p.protocolo}</p>
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                {p.projeto_fases && p.projeto_fases.length > 0 && (
                  <div className="flex gap-1 ml-[46px] mt-2">
                    {p.projeto_fases.map((f: any) => (
                      <div key={f.id} className={`flex-1 h-1.5 rounded-full transition-colors ${
                        f.status === "aprovada" ? "bg-success" : f.status === "em_andamento" ? "bg-primary" : "bg-border"
                      }`} title={f.nome} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
};

export default EmpresaDashboard;
