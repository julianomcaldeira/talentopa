import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, Building2, Users, FolderKanban, Calendar, CreditCard, PieChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, DataCard, SectionTitle, StatCard, StatusBadge, LoadingState } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const AdminFinanceiro = () => {
  const [projetos, setProjetos] = useState<any[]>([]);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("todos");

  useEffect(() => {
    const fetchData = async () => {
      const [projetosRes, propostasRes] = await Promise.all([
        supabase.from("projetos").select("*, softwares(nome), projeto_fases(id, nome, status, valor)").order("created_at", { ascending: false }),
        supabase.from("propostas").select("*, projetos(nome, protocolo)").order("created_at", { ascending: false }),
      ]);

      if (projetosRes.data) setProjetos(projetosRes.data);
      if (propostasRes.data) setPropostas(propostasRes.data);

      // Fetch profile names for propostas
      if (propostasRes.data && propostasRes.data.length > 0) {
        const consultorIds = [...new Set(propostasRes.data.map(p => p.consultor_user_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, nome").in("user_id", consultorIds);
        if (profiles) {
          const nameMap = new Map(profiles.map(p => [p.user_id, p.nome]));
          setPropostas(prev => prev.map(p => ({
            ...p,
            consultor_nome: nameMap.get(p.consultor_user_id) || "Consultor",
          })));
        }
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  // Calculate financial metrics
  const propostasAceitas = propostas.filter(p => p.status === "aceita");
  const totalContratado = propostasAceitas.reduce((sum, p) => sum + (p.valor_proposta || 0), 0);
  const totalHorasContratadas = propostasAceitas.reduce((sum, p) => sum + (p.estimativa_horas || 0), 0);

  const fasesAprovadas = projetos.flatMap(p => (p.projeto_fases || []).filter((f: any) => f.status === "aprovada"));
  const totalFasesAprovadas = fasesAprovadas.reduce((sum: number, f: any) => sum + (f.valor || 0), 0);

  const projetosConcluidos = projetos.filter(p => p.status === "concluido").length;
  const projetosAtivos = projetos.filter(p => ["em_andamento", "em_selecao", "publicado"].includes(p.status)).length;

  // Platform fee (simulated 15%)
  const taxaPlataforma = totalContratado * 0.15;

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Visão financeira da plataforma"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={DollarSign} label="Total contratado" value={formatCurrency(totalContratado)} iconColor="text-success" iconBg="bg-success/10" />
        <StatCard icon={TrendingUp} label="Receita plataforma (15%)" value={formatCurrency(taxaPlataforma)} iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon={CreditCard} label="Fases aprovadas (R$)" value={formatCurrency(totalFasesAprovadas)} iconColor="text-info" iconBg="bg-info/10" />
        <StatCard icon={Users} label="Horas contratadas" value={`${totalHorasContratadas}h`} iconColor="text-accent" iconBg="bg-accent/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Propostas aceitas */}
        <DataCard className="lg:col-span-2" noPadding>
          <div className="p-5 pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <SectionTitle>Propostas aceitas</SectionTitle>
              <Badge variant="secondary" className="text-[11px]">{propostasAceitas.length} contratos</Badge>
            </div>
          </div>
          {propostasAceitas.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma proposta aceita ainda</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {propostasAceitas.slice(0, 10).map((proposta) => (
                <div key={proposta.id} className="flex items-center justify-between p-4 px-5 table-row-interactive">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="icon-container icon-container-sm bg-success/10 flex-shrink-0">
                      <DollarSign size={14} className="text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{proposta.projetos?.nome || "Projeto"}</p>
                      <p className="text-xs text-muted-foreground">
                        {proposta.consultor_nome || "Consultor"} · {proposta.estimativa_horas || 0}h · {proposta.projetos?.protocolo}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold text-success">{formatCurrency(proposta.valor_proposta || 0)}</span>
                    <StatusBadge status={proposta.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </DataCard>

        {/* Summary panel */}
        <div className="space-y-6">
          <DataCard>
            <SectionTitle>Resumo de projetos</SectionTitle>
            <div className="space-y-3">
              <SummaryRow label="Projetos ativos" value={projetosAtivos.toString()} color="text-info" />
              <SummaryRow label="Projetos concluídos" value={projetosConcluidos.toString()} color="text-success" />
              <SummaryRow label="Total de projetos" value={projetos.length.toString()} color="text-foreground" />
              <SummaryRow label="Total de propostas" value={propostas.length.toString()} color="text-foreground" />
              <SummaryRow label="Propostas aceitas" value={propostasAceitas.length.toString()} color="text-success" />
              <SummaryRow label="Taxa de conversão" value={
                propostas.length > 0 ? `${Math.round((propostasAceitas.length / propostas.length) * 100)}%` : "0%"
              } color="text-primary" />
            </div>
          </DataCard>

          <DataCard>
            <SectionTitle>Distribuição por status</SectionTitle>
            <div className="space-y-2">
              {[
                { status: "rascunho", count: projetos.filter(p => p.status === "rascunho").length },
                { status: "publicado", count: projetos.filter(p => p.status === "publicado").length },
                { status: "em_selecao", count: projetos.filter(p => p.status === "em_selecao").length },
                { status: "em_andamento", count: projetos.filter(p => p.status === "em_andamento").length },
                { status: "concluido", count: projetos.filter(p => p.status === "concluido").length },
                { status: "cancelado", count: projetos.filter(p => p.status === "cancelado").length },
              ].filter(s => s.count > 0).map((s) => (
                <div key={s.status} className="flex items-center justify-between bg-muted/40 rounded-xl p-3">
                  <StatusBadge status={s.status} />
                  <span className="text-sm font-bold text-foreground">{s.count}</span>
                </div>
              ))}
              {projetos.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum projeto</p>
              )}
            </div>
          </DataCard>

          <DataCard>
            <SectionTitle>Últimas propostas</SectionTitle>
            <div className="space-y-3">
              {propostas.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{p.consultor_nome || "Consultor"}</p>
                    <p className="text-[11px] text-muted-foreground">{p.projetos?.protocolo}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold">{formatCurrency(p.valor_proposta || 0)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
              {propostas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma proposta</p>
              )}
            </div>
          </DataCard>
        </div>
      </div>
    </div>
  );
};

const SummaryRow = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-[13px] text-muted-foreground">{label}</span>
    <span className={`text-sm font-bold ${color}`}>{value}</span>
  </div>
);

export default AdminFinanceiro;
