import { ReactNode } from "react";
import { MapPin, Clock, DollarSign, CalendarIcon } from "lucide-react";

interface CandidatoResponseCardProps {
  nome: string | null | undefined;
  cidade?: string | null;
  estado?: string | null;
  origem: ReactNode;
  status: ReactNode;
  valor: number | null | undefined;
  prazoDias?: number | null | undefined;
  esforcoHoras?: number | null | undefined;
  observacao?: string | null;
  children?: ReactNode;
}

export function CandidatoResponseCard({
  nome,
  cidade,
  estado,
  origem,
  status,
  valor,
  prazoDias,
  esforcoHoras,
  observacao,
  children,
}: CandidatoResponseCardProps) {
  return (
    <div className="border border-border/60 rounded-xl p-4 bg-muted/10">
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
            {nome?.charAt(0) || "C"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{nome || "Consultor"}</p>
            {cidade && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <MapPin size={10} /> {cidade}{estado && `, ${estado}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {origem}
          {status}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 mb-2">
        <div className="rounded-lg border border-border/60 bg-background p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor</p>
          <p className="text-sm font-bold text-foreground mt-0.5 flex items-center gap-1">
            <DollarSign size={12} /> {valor != null ? `R$ ${Number(valor).toLocaleString("pt-BR")}` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Prazo de entrega</p>
          <p className="text-sm font-bold text-foreground mt-0.5 flex items-center gap-1">
            <CalendarIcon size={12} /> {prazoDias != null ? `${prazoDias} dia${prazoDias === 1 ? "" : "s"}` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Esforço</p>
          <p className="text-sm font-bold text-foreground mt-0.5 flex items-center gap-1">
            <Clock size={12} /> {esforcoHoras != null ? `${esforcoHoras}h` : "—"}
          </p>
        </div>
      </div>

      {observacao && (
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{observacao}</p>
      )}

      {children && <div className="flex flex-wrap gap-2 mt-3">{children}</div>}
    </div>
  );
}