import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, X, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Constants } from "@/integrations/supabase/types";
import { motion, AnimatePresence } from "framer-motion";

export interface ReportFiltersState {
  dateFrom?: Date;
  dateTo?: Date;
  status?: string;
  softwareId?: string;
}

interface ReportFiltersProps {
  tableName: string;
  filters: ReportFiltersState;
  onFiltersChange: (filters: ReportFiltersState) => void;
}

const STATUS_OPTIONS: Record<string, { key: string; values: string[]; label: string }> = {
  projetos: { key: "status", values: [...Constants.public.Enums.status_projeto], label: "Status do Projeto" },
  propostas: { key: "status", values: [...Constants.public.Enums.status_proposta], label: "Status da Proposta" },
  projeto_fases: { key: "status", values: [...Constants.public.Enums.status_fase], label: "Status da Fase" },
};

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  em_selecao: "Em Seleção",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
  pendente: "Pendente",
  aguardando_aprovacao: "Aguardando Aprovação",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  em_mediacao: "Em Mediação",
};

const TABLES_WITH_SOFTWARE = ["projetos", "consultor_habilidades"];

export const ReportFilters = ({ tableName, filters, onFiltersChange }: ReportFiltersProps) => {
  const [softwares, setSoftwares] = useState<{ id: string; nome: string }[]>([]);
  const statusConfig = STATUS_OPTIONS[tableName];
  const hasSoftwareFilter = TABLES_WITH_SOFTWARE.includes(tableName);
  const hasDateFilter = true; // All tables have created_at
  const hasAnyFilter = hasDateFilter || !!statusConfig || hasSoftwareFilter;

  const activeFilterCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.status,
    filters.softwareId,
  ].filter(Boolean).length;

  useEffect(() => {
    if (hasSoftwareFilter) {
      supabase.from("softwares").select("id, nome").order("nome").then(({ data }) => {
        if (data) setSoftwares(data);
      });
    }
  }, [hasSoftwareFilter]);

  if (!hasAnyFilter) return null;

  const updateFilter = (partial: Partial<ReportFiltersState>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const clearAll = () => {
    onFiltersChange({});
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <SlidersHorizontal size={16} className="text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Filtros Avançados</span>
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="text-xs">{activeFilterCount} ativo{activeFilterCount > 1 ? "s" : ""}</Badge>
        )}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="ml-auto text-xs h-7">
            <X size={14} className="mr-1" /> Limpar filtros
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Date From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-9 text-xs justify-start", filters.dateFrom && "border-primary text-primary")}
            >
              <CalendarIcon size={14} className="mr-1.5" />
              {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Data início"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateFrom}
              onSelect={(d) => updateFilter({ dateFrom: d || undefined })}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Date To */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-9 text-xs justify-start", filters.dateTo && "border-primary text-primary")}
            >
              <CalendarIcon size={14} className="mr-1.5" />
              {filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Data fim"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateTo}
              onSelect={(d) => updateFilter({ dateTo: d || undefined })}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Status Filter */}
        {statusConfig && (
          <Select
            value={filters.status || "all"}
            onValueChange={(v) => updateFilter({ status: v === "all" ? undefined : v })}
          >
            <SelectTrigger className={cn("h-9 w-[180px] text-xs", filters.status && "border-primary text-primary")}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {statusConfig.values.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Software Filter */}
        {hasSoftwareFilter && softwares.length > 0 && (
          <Select
            value={filters.softwareId || "all"}
            onValueChange={(v) => updateFilter({ softwareId: v === "all" ? undefined : v })}
          >
            <SelectTrigger className={cn("h-9 w-[200px] text-xs", filters.softwareId && "border-primary text-primary")}>
              <SelectValue placeholder="Software" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os softwares</SelectItem>
              {softwares.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Active filter tags */}
      <AnimatePresence>
        {activeFilterCount > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap gap-1.5">
            {filters.dateFrom && (
              <Badge variant="outline" className="text-xs gap-1 cursor-pointer" onClick={() => updateFilter({ dateFrom: undefined })}>
                De: {format(filters.dateFrom, "dd/MM/yy")} <X size={12} />
              </Badge>
            )}
            {filters.dateTo && (
              <Badge variant="outline" className="text-xs gap-1 cursor-pointer" onClick={() => updateFilter({ dateTo: undefined })}>
                Até: {format(filters.dateTo, "dd/MM/yy")} <X size={12} />
              </Badge>
            )}
            {filters.status && (
              <Badge variant="outline" className="text-xs gap-1 cursor-pointer" onClick={() => updateFilter({ status: undefined })}>
                {STATUS_LABELS[filters.status] || filters.status} <X size={12} />
              </Badge>
            )}
            {filters.softwareId && (
              <Badge variant="outline" className="text-xs gap-1 cursor-pointer" onClick={() => updateFilter({ softwareId: undefined })}>
                {softwares.find((s) => s.id === filters.softwareId)?.nome || "Software"} <X size={12} />
              </Badge>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
