import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PresetReports, type PresetReport } from "./PresetReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

type UserScope = "admin" | "consultor" | "empresa";

interface PresetReportRunnerProps {
  userScope: UserScope;
}

export const PresetReportRunner = ({ userScope }: PresetReportRunnerProps) => {
  const { user } = useAuth();
  const [activePreset, setActivePreset] = useState<PresetReport | null>(null);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  const runPreset = async (preset: PresetReport) => {
    if (!user) return;
    setActivePreset(preset);
    setLoading(true);

    try {
      let query = supabase.from(preset.table as any).select(preset.columns.join(", "));

      if (preset.filters.status && ["projetos", "propostas", "projeto_fases"].includes(preset.table)) {
        query = query.eq("status", preset.filters.status);
      }
      if (preset.filters.softwareId && ["projetos", "consultor_habilidades"].includes(preset.table)) {
        query = query.eq("software_id", preset.filters.softwareId);
      }
      if (preset.filters.dateFrom) {
        query = query.gte("created_at", preset.filters.dateFrom.toISOString());
      }
      if (preset.filters.dateTo) {
        const end = new Date(preset.filters.dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      const { data: result, error } = await query;
      if (error) throw error;
      setData((result as unknown as Record<string, unknown>[]) || []);
    } catch (err) {
      console.error("Preset report error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "boolean") return val ? "Sim" : "Não";
    if (Array.isArray(val)) return val.join(", ");
    if (typeof val === "string" && val.match(/^\d{4}-\d{2}-\d{2}/)) {
      return new Date(val).toLocaleDateString("pt-BR");
    }
    return String(val);
  };

  const exportCSV = () => {
    if (!activePreset || data.length === 0) return;
    const cols = activePreset.columns;
    const csvRows = [cols.join(",")];
    data.forEach((row) => {
      csvRows.push(cols.map((c) => {
        const val = row[c];
        const str = val === null || val === undefined ? "" : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(","));
    });
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${activePreset.id}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const goBack = () => {
    setActivePreset(null);
    setData([]);
  };

  if (!activePreset) {
    return <PresetReports userScope={userScope} onSelectPreset={runPreset} />;
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={goBack} className="gap-2">
        <ArrowLeft size={16} /> Voltar aos relatórios
      </Button>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">{activePreset.icon}</div>
              <div>
                <CardTitle className="text-lg">{activePreset.label}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{activePreset.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{loading ? "Carregando..." : `${data.length} registros`}</Badge>
              {data.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  <Download size={14} className="mr-1.5" /> CSV
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando dados...</p>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado.</p>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {activePreset.columns.map((col) => (
                      <TableHead key={col} className="capitalize">{col.replace(/_/g, " ")}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slice(0, 100).map((row, i) => (
                    <TableRow key={i}>
                      {activePreset.columns.map((col) => (
                        <TableCell key={col} className="max-w-[300px] truncate">{formatValue(row[col])}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.length > 100 && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Exibindo 100 de {data.length} registros. Exporte o CSV para ver todos.
                </p>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
