import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, DataCard, StatusBadge, EmptyState, LoadingState, StatCard } from "@/components/dashboard/DashboardComponents";
import { Send, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const ConsultorMinhasPropostas = () => {
  const { user } = useAuth();
  const [propostas, setPropostas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("propostas")
        .select("*, projetos(nome, protocolo, status, softwares(nome))")
        .eq("consultor_user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setPropostas(data);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const enviadas = propostas.filter((p) => p.status === "enviada").length;
  const aceitas = propostas.filter((p) => p.status === "aceita").length;
  const recusadas = propostas.filter((p) => p.status === "recusada").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Minhas Propostas" description="Acompanhe o status de todas as suas propostas enviadas" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Clock} label="Pendentes" value={enviadas.toString()} iconColor="text-info" iconBg="bg-info/10" />
        <StatCard icon={CheckCircle2} label="Aceitas" value={aceitas.toString()} iconColor="text-success" iconBg="bg-success/10" />
        <StatCard icon={XCircle} label="Recusadas" value={recusadas.toString()} iconColor="text-destructive" iconBg="bg-destructive/10" />
      </div>

      <DataCard noPadding>
        {loading ? (
          <LoadingState />
        ) : propostas.length === 0 ? (
          <EmptyState message="Você ainda não enviou nenhuma proposta" icon={Send} />
        ) : (
          <div className="divide-y divide-border/60">
            {propostas.map((p) => (
              <div key={p.id} className="p-4 px-5 table-row-interactive">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      p.status === "aceita" ? "bg-success/10" : p.status === "recusada" ? "bg-destructive/10" : "bg-info/10"
                    }`}>
                      {p.status === "aceita" ? (
                        <CheckCircle2 size={18} className="text-success" />
                      ) : p.status === "recusada" ? (
                        <XCircle size={18} className="text-destructive" />
                      ) : (
                        <Clock size={18} className="text-info" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.projetos?.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.projetos?.softwares?.nome} · {p.projetos?.protocolo} · {p.estimativa_horas || 0}h
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(p.valor_proposta || 0)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                {p.comentarios && (
                  <p className="text-xs text-muted-foreground mt-2 ml-[54px] line-clamp-2">{p.comentarios}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
};

export default ConsultorMinhasPropostas;
