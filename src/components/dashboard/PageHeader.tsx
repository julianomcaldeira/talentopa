import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional back link (route + label) shown above the title. */
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

/**
 * Cabeçalho padrão de página: título, contexto e ações primárias sempre no
 * mesmo lugar, em todas as telas e perfis.
 */
const PageHeader = ({ title, description, backTo, backLabel, actions, children }: PageHeaderProps) => (
  <div className="mb-6 space-y-3">
    {backTo && (
      <Button variant="ghost" size="sm" asChild className="-ml-2 h-7 px-2 text-xs text-muted-foreground">
        <Link to={backTo}>
          <ChevronLeft className="h-3.5 w-3.5 mr-1" />
          {backLabel || "Voltar"}
        </Link>
      </Button>
    )}
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-display font-bold text-foreground tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
    {children}
  </div>
);

export default PageHeader;
