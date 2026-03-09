import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  iconColor?: string;
  iconBg?: string;
}

export const StatCard = ({ icon: Icon, label, value, change, changeType = "positive", iconColor = "text-primary", iconBg = "bg-primary/10" }: StatCardProps) => (
  <div className="stat-card p-5">
    <div className="flex items-start justify-between mb-4">
      <div className={`icon-container icon-container-md ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      {change && (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          changeType === "positive" ? "badge-success" :
          changeType === "negative" ? "badge-destructive" : "badge-muted"
        }`}>
          {change}
        </span>
      )}
    </div>
    <p className="text-2xl font-display font-bold text-foreground tracking-tight">{value}</p>
    <p className="text-[13px] text-muted-foreground mt-0.5">{label}</p>
  </div>
);

interface StatusBadgeProps {
  status: string;
  labels?: Record<string, string>;
}

const defaultStatusColors: Record<string, string> = {
  rascunho: "badge-muted",
  publicado: "badge-primary",
  em_selecao: "badge-warning",
  em_andamento: "badge-info",
  concluido: "badge-success",
  cancelado: "badge-destructive",
  pendente: "badge-muted",
  aprovada: "badge-success",
  reprovada: "badge-destructive",
  em_mediacao: "badge-warning",
  enviada: "badge-info",
  aceita: "badge-success",
  recusada: "badge-destructive",
};

const defaultStatusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  em_selecao: "Em seleção",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  pendente: "Pendente",
  aguardando_aprovacao: "Aguardando",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  em_mediacao: "Em mediação",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
};

export const StatusBadge = ({ status, labels }: StatusBadgeProps) => {
  const resolvedLabels = { ...defaultStatusLabels, ...labels };
  const colorClass = defaultStatusColors[status] || "badge-muted";
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${colorClass}`}>
      {resolvedLabels[status] || status}
    </span>
  );
};

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export const PageHeader = ({ title, description, action }: PageHeaderProps) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
    <div>
      <h1 className="text-2xl md:text-[28px] font-display font-bold text-foreground tracking-tight">{title}</h1>
      {description && <p className="text-muted-foreground mt-1 text-[15px]">{description}</p>}
    </div>
    {action}
  </div>
);

interface DataCardProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const DataCard = ({ children, className = "", noPadding = false }: DataCardProps) => (
  <div className={`bg-card rounded-2xl shadow-card border border-border/60 ${noPadding ? "" : "p-6"} ${className}`}>
    {children}
  </div>
);

interface EmptyStateProps {
  message: string;
  icon?: LucideIcon;
}

export const EmptyState = ({ message, icon: Icon }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {Icon && (
      <div className="icon-container icon-container-lg bg-muted mb-4">
        <Icon className="h-6 w-6 text-muted-foreground/60" />
      </div>
    )}
    <p className="text-muted-foreground text-sm">{message}</p>
  </div>
);

export const LoadingState = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h3 className="font-display font-semibold text-foreground text-[15px] mb-4">{children}</h3>
);
