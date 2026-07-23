import { useEffect, useState } from "react";
import { Users, FolderKanban, Clock, CheckCircle2, Briefcase, Gauge, TrendingUp, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface Metrics {
  projetos_disponiveis: number;
  consultores_vinculados: number;
  horas_disponiveis: number;
  horas_alocadas: number;
  capacidade_ociosa: number;
  convites_pendentes: number;
  aprovacoes_pendentes: number;
  projetos_ativos: number;
}

const fmtH = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n ?? 0) + "h";

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

  const mesAtual = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const principais = [
    {
      label: "Demandas disponíveis",
      value: metrics?.projetos_disponiveis ?? 0,
      icon: Briefcase,
      color: "text-primary",
      hint: "Publicadas na plataforma",
    },
    {
      label: "Consultores vinculados",
      value: metrics?.consultores_vinculados ?? 0,
      icon: Users,
      color: "text-emerald-500",
      hint: "Vínculos ativos no quadro",
    },
    {
      label: "Horas disponíveis",
      value: loading ? "—" : fmtH(metrics?.horas_disponiveis ?? 0),
      icon: Gauge,
      color: "text-sky-500",
      hint: `Restante em ${mesAtual}`,
    },
    {
      label: "Horas alocadas",
      value: loading ? "—" : fmtH(metrics?.horas_alocadas ?? 0),
      icon: CalendarClock,
      color: "text-amber-500",
      hint: `Mês vigente (${mesAtual})`,
    },
  ];

  const secundarios = [
    { label: "Convites pendentes", value: metrics?.convites_pendentes ?? 0, icon: Clock },
    { label: "Aprovações pendentes", value: metrics?.aprovacoes_pendentes ?? 0, icon: CheckCircle2 },
    { label: "Projetos em andamento", value: metrics?.projetos_ativos ?? 0, icon: FolderKanban },
  ];

  const ociosa = metrics?.capacidade_ociosa ?? 0;
  const disp = metrics?.horas_disponiveis ?? 0;
  const pctOciosa = disp > 0 ? Math.min(100, Math.round((ociosa / disp) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard do Parceiro</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visão gerencial da capacidade e das demandas do seu canal.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {principais.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {c.label}
              </span>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <p className="text-3xl font-display font-bold text-foreground">
              {loading ? "—" : c.value}
            </p>
            <p className="text-xs text-muted-foreground mt-2">{c.hint}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Capacidade líquida ociosa
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              Horas disponíveis menos horas já alocadas no mês vigente.
            </p>
          </div>
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div className="flex items-end gap-3">
          <p className="text-3xl font-display font-bold text-foreground">
            {loading ? "—" : fmtH(ociosa)}
          </p>
          <span className="text-sm text-muted-foreground mb-1">
            de {fmtH(disp)} disponíveis · {pctOciosa}% ocioso
          </span>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pctOciosa}%` }}
          />
        </div>
      </Card>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Indicadores operacionais</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {secundarios.map((c) => (
            <Card key={c.label} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xl font-display font-semibold text-foreground mt-2">
                {loading ? "—" : c.value}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CanalDashboard;
