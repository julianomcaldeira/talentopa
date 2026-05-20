import { useEffect, useState } from "react";
import { Users, FolderKanban, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface Metrics {
  consultores_ativos: number;
  consultores_pendentes: number;
  projetos_em_andamento: number;
  alocacoes_pendentes: number;
}

const CanalDashboard = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_canal_dashboard_metrics");
      if (!error && data) setMetrics(data as unknown as Metrics);
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Consultores ativos", value: metrics?.consultores_ativos ?? 0, icon: Users, color: "text-primary" },
    { label: "Convites pendentes", value: metrics?.consultores_pendentes ?? 0, icon: Clock, color: "text-amber-500" },
    { label: "Projetos em andamento", value: metrics?.projetos_em_andamento ?? 0, icon: FolderKanban, color: "text-emerald-500" },
    { label: "Aprovações pendentes", value: metrics?.alocacoes_pendentes ?? 0, icon: CheckCircle2, color: "text-rose-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard do Canal</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral da sua operação.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{c.label}</span>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <p className="text-3xl font-display font-bold text-foreground">
              {loading ? "—" : c.value}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CanalDashboard;
