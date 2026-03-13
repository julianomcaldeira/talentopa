import { useState, useEffect } from "react";
import { FolderKanban, DollarSign, Users, Clock, ArrowUpRight, Plus, Send, CheckCircle2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard, StatusBadge, PageHeader, DataCard, SectionTitle, LoadingState } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const EmpresaDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [projetos, setProjetos] = useState<any[]>([]);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      // Fetch projects with phases
      const { data: projetosData } = await supabase
        .from("projetos")
        .select("*, softwares(nome), projeto_fases(id, nome, status)")
        .eq("empresa_user_id", user.id)
        .order("created_at", { ascending: false });

      const projs = projetosData || [];
      setProjetos(projs);

      // Fetch proposals for these projects
      if (projs.length > 0) {
        const projIds = projs.map((p) => p.id);
        const { data: propostasData } = await supabase
          .from("propostas")
          .select("*, projetos(nome, protocolo)")
          .in("projeto_id", projIds)
          .order("created_at", { ascending: false });

        if (propostasData && propostasData.length > 0) {
          const consultorIds = [...new Set(propostasData.map((p) => p.consultor_user_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, nome")
            .in("user_id", consultorIds);
          const nameMap = new Map((profiles || []).map((p) => [p.user_id, p.nome]));
          setPropostas(
            propostasData.map((p) => ({
              ...p,
              consultor_nome: nameMap.get(p.consultor_user_id) || "Consultor",
            }))
          );
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const activeCount = projetos.filter((p) =>
    ["publicado", "em_selecao", "em_andamento"].includes(p.status)
  ).length;
  const doneCount = projetos.filter((p) => p.status === "concluido").length;
  const propostasEnviadas = propostas.filter((p) => p.status === "enviada");
  const propostasAceitas = propostas.filter((p) => p.status === "aceita");
  const totalInvestido = propostasAceitas.reduce((sum, p) => sum + (p.valor_proposta || 0), 0);

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
        title={`Olá, ${profile?.nome?.split(" ")[0] || "Empresa"}!`}
        description="Gerencie seus projetos e encontre os melhores consultores"
        action={
          <Button asChild>
            <Link to="/empresa/novo-projeto">
              <Plus size={16} /> Novo Projeto
            </Link>
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FolderKanban} label="Projetos ativos" value={activeCount.toString()} iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon={CheckCircle2} label="Concluídos" value={doneCount.toString()} iconColor="text-success" iconBg="bg-success/10" />
        <StatCard icon={Send} label="Propostas recebidas" value={propostas.length.toString()} iconColor="text-info" iconBg="bg-info/10" />
        <StatCard icon={DollarSign} label="Total investido" value={formatCurrency(totalInvestido)} iconColor="text-accent" iconBg="bg-accent/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects list */}
        <div className="lg:col-span-2">
          <DataCard noPadding>
            <div className="p-5 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <SectionTitle>Seus projetos</SectionTitle>
                <Link to="/empresa/projetos" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                  Ver todos <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
            {projetos.length === 0 ? (
              <div className="p-12 text-center">
                <FolderKanban size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-3">Nenhum projeto criado ainda</p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/empresa/novo-projeto">Criar primeiro projeto</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {projetos.slice(0, 6).map((p) => {
                  const propostasCount = propostas.filter((pr) => pr.projeto_id === p.id).length;
                  return (
                    <div
                      key={p.id}
                      className="p-4 px-5 table-row-interactive cursor-pointer"
                      onClick={() => navigate("/empresa/projetos")}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="icon-container icon-container-sm bg-muted/60">
                            <FolderKanban size={14} className="text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{p.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.softwares?.nome} · {p.protocolo}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {propostasCount > 0 && (
                            <Badge variant="secondary" className="text-[11px]">
                              {propostasCount} proposta{propostasCount !== 1 ? "s" : ""}
                            </Badge>
                          )}
                          <StatusBadge status={p.status} />
                        </div>
                      </div>
                      {p.projeto_fases && p.projeto_fases.length > 0 && (
                        <div className="flex gap-1 ml-[46px] mt-1">
                          {p.projeto_fases.map((f: any) => (
                            <div
                              key={f.id}
                              className={`flex-1 h-1.5 rounded-full transition-colors ${
                                f.status === "aprovada"
                                  ? "bg-success"
                                  : f.status === "em_andamento"
                                  ? "bg-primary"
                                  : f.status === "aguardando_aprovacao"
                                  ? "bg-warning"
                                  : "bg-border"
                              }`}
                              title={f.nome}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </DataCard>
        </div>

        {/* Proposals received */}
        <div>
          <DataCard noPadding>
            <div className="p-5 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <SectionTitle>Propostas pendentes</SectionTitle>
                <Badge variant="secondary" className="text-[11px]">
                  {propostasEnviadas.length} nova{propostasEnviadas.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </div>
            {propostasEnviadas.length === 0 ? (
              <div className="p-8 text-center">
                <Send size={24} className="text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma proposta pendente</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {propostasEnviadas.slice(0, 8).map((p) => (
                  <div key={p.id} className="p-4 px-5 table-row-interactive">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.consultor_nome}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {p.projetos?.nome} · {p.estimativa_horas || 0}h
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-primary flex-shrink-0">
                        {formatCurrency(p.valor_proposta || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataCard>

          {/* Accepted contracts */}
          {propostasAceitas.length > 0 && (
            <DataCard noPadding className="mt-6">
              <div className="p-5 pb-3 border-b border-border/60">
                <SectionTitle>Consultores contratados</SectionTitle>
              </div>
              <div className="divide-y divide-border/60">
                {propostasAceitas.slice(0, 5).map((p) => (
                  <div key={p.id} className="p-4 px-5 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                        <CheckCircle2 size={14} className="text-success" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.consultor_nome}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{p.projetos?.nome}</p>
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

export default EmpresaDashboard;
