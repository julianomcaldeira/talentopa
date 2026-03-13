import { useState, useEffect } from "react";
import { FolderKanban, DollarSign, Star, Clock, ArrowUpRight, Send, CheckCircle2, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard, StatusBadge, PageHeader, DataCard, SectionTitle, LoadingState } from "@/components/dashboard/DashboardComponents";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const ConsultorDashboard = () => {
  const { user, profile } = useAuth();
  const [projetosDisponiveis, setProjetosDisponiveis] = useState<any[]>([]);
  const [minhasPropostas, setMinhasPropostas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [projetosRes, propostasRes] = await Promise.all([
        supabase
          .from("projetos")
          .select("*, softwares(nome)")
          .in("status", ["publicado", "em_selecao"])
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("propostas")
          .select("*, projetos(nome, protocolo, status, softwares(nome))")
          .eq("consultor_user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (projetosRes.data) setProjetosDisponiveis(projetosRes.data);
      if (propostasRes.data) setMinhasPropostas(propostasRes.data);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const propostasAceitas = minhasPropostas.filter((p) => p.status === "aceita");
  const propostasPendentes = minhasPropostas.filter((p) => p.status === "enviada");
  const receitaTotal = propostasAceitas.reduce((sum, p) => sum + (p.valor_proposta || 0), 0);
  const horasContratadas = propostasAceitas.reduce((sum, p) => sum + (p.estimativa_horas || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Olá, ${profile?.nome?.split(" ")[0] || "Consultor"}!`}
        description="Encontre projetos compatíveis e acompanhe suas propostas"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FolderKanban} label="Projetos disponíveis" value={projetosDisponiveis.length.toString()} iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon={Send} label="Propostas enviadas" value={minhasPropostas.length.toString()} iconColor="text-info" iconBg="bg-info/10" />
        <StatCard icon={CheckCircle2} label="Contratos ativos" value={propostasAceitas.length.toString()} iconColor="text-success" iconBg="bg-success/10" />
        <StatCard icon={DollarSign} label="Receita total" value={formatCurrency(receitaTotal)} iconColor="text-accent" iconBg="bg-accent/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available projects */}
        <div className="lg:col-span-2">
          <DataCard noPadding>
            <div className="p-5 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <SectionTitle>Projetos disponíveis</SectionTitle>
                <Link to="/consultor/projetos" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                  Ver todos <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
            {projetosDisponiveis.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Nenhum projeto disponível no momento</div>
            ) : (
              <div className="divide-y divide-border/60">
                {projetosDisponiveis.map((p) => (
                  <Link
                    key={p.id}
                    to="/consultor/projetos"
                    className="flex items-center justify-between p-4 px-5 table-row-interactive cursor-pointer block"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="icon-container icon-container-sm bg-primary/10">
                        <FolderKanban size={14} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{p.softwares?.nome} · {p.protocolo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={p.status} labels={{ publicado: "Aberto", em_selecao: "Em seleção" }} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </DataCard>
        </div>

        {/* My proposals */}
        <div className="space-y-6">
          {/* Pending proposals */}
          <DataCard noPadding>
            <div className="p-5 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <SectionTitle>Propostas pendentes</SectionTitle>
                <Badge variant="secondary" className="text-[11px]">
                  {propostasPendentes.length}
                </Badge>
              </div>
            </div>
            {propostasPendentes.length === 0 ? (
              <div className="p-8 text-center">
                <Send size={24} className="text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma proposta pendente</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {propostasPendentes.slice(0, 5).map((p) => (
                  <div key={p.id} className="p-4 px-5">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.projetos?.nome}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.projetos?.softwares?.nome} · {p.estimativa_horas || 0}h
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-info flex-shrink-0">
                        {formatCurrency(p.valor_proposta || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {minhasPropostas.length > 0 && (
              <div className="p-3 border-t border-border/60">
                <Button asChild variant="ghost" size="sm" className="w-full text-xs">
                  <Link to="/consultor/minhas-propostas">
                    Ver todas as propostas <ArrowUpRight size={12} />
                  </Link>
                </Button>
              </div>
            )}
          </DataCard>

          {/* Active contracts */}
          {propostasAceitas.length > 0 && (
            <DataCard noPadding>
              <div className="p-5 pb-3 border-b border-border/60">
                <SectionTitle>Contratos ativos</SectionTitle>
              </div>
              <div className="divide-y divide-border/60">
                {propostasAceitas.slice(0, 5).map((p) => (
                  <div key={p.id} className="p-4 px-5 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                        <CheckCircle2 size={14} className="text-success" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.projetos?.nome}</p>
                        <p className="text-[11px] text-muted-foreground">{p.estimativa_horas || 0}h</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-success flex-shrink-0">
                      {formatCurrency(p.valor_proposta || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </DataCard>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsultorDashboard;
