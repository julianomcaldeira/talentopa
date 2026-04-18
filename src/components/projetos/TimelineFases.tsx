import { DataCard, EmptyState } from "@/components/dashboard/DashboardComponents";
import { Calendar } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  pendente: "bg-muted",
  em_andamento: "bg-primary",
  aguardando_aprovacao: "bg-warning",
  aprovada: "bg-success",
  reprovada: "bg-destructive",
  em_mediacao: "bg-warning",
};

export const TimelineFases = ({ fases }: { fases: any[] }) => {
  if (!fases.length) {
    return <DataCard><EmptyState message="Nenhuma fase para exibir" icon={Calendar} /></DataCard>;
  }

  // Define janela: data mais antiga (created_at do projeto/fase) -> prazo mais distante
  const datas = fases
    .map((f) => f.prazo)
    .filter(Boolean)
    .map((d) => new Date(d).getTime());
  const minTs = Math.min(...datas, Date.now());
  const maxTs = Math.max(...datas, Date.now() + 1000 * 60 * 60 * 24 * 30);
  const range = Math.max(maxTs - minTs, 1);

  const totalEstimadas = fases.reduce((s, f) => s + (Number(f.horas_estimadas) || 0), 0);
  let acumulado = 0;

  return (
    <DataCard>
      <h4 className="font-display font-semibold text-foreground mb-1">Cronograma</h4>
      <p className="text-xs text-muted-foreground mb-4">
        Visualização das fases por horas estimadas e prazo final.
      </p>

      <div className="space-y-3">
        {fases.map((f) => {
          const horas = Number(f.horas_estimadas) || 0;
          const widthPct = totalEstimadas > 0 ? (horas / totalEstimadas) * 100 : 100 / fases.length;
          const startPct = (acumulado / Math.max(totalEstimadas, 1)) * 100;
          acumulado += horas;
          const progresso = horas > 0 ? Math.min(100, (Number(f.horas_executadas) / horas) * 100) : 0;
          const cor = STATUS_COLOR[f.status] || "bg-muted";

          return (
            <div key={f.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-foreground">{f.nome}</span>
                <span className="text-muted-foreground">
                  {f.horas_executadas || 0}h / {horas}h · {f.prazo ? new Date(f.prazo).toLocaleDateString("pt-BR") : "sem prazo"}
                </span>
              </div>
              <div className="relative h-6 bg-muted/40 rounded-md overflow-hidden">
                <div
                  className={`absolute top-0 bottom-0 ${cor} opacity-30`}
                  style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                />
                <div
                  className={`absolute top-0 bottom-0 ${cor}`}
                  style={{
                    left: `${startPct}%`,
                    width: `${(widthPct * progresso) / 100}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-border flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {Object.entries(STATUS_COLOR).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${v}`} />
            <span className="capitalize">{k.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>
    </DataCard>
  );
};
