import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Filter, RotateCcw, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ReportFilters, ReportFiltersState } from "./ReportFilters";

type UserScope = "admin" | "consultor" | "empresa";

interface TableConfig {
  name: string;
  label: string;
  columns: { key: string; label: string }[];
  scope: UserScope[];
}

const ALL_TABLES: TableConfig[] = [
  {
    name: "projetos",
    label: "Projetos",
    columns: [
      { key: "nome", label: "Nome" },
      { key: "descricao", label: "Descrição" },
      { key: "status", label: "Status" },
      { key: "protocolo", label: "Protocolo" },
      { key: "prazo_estimado", label: "Prazo Estimado" },
      { key: "objetivo", label: "Objetivo" },
      { key: "problema_atual", label: "Problema Atual" },
      { key: "observacoes", label: "Observações" },
      { key: "created_at", label: "Criado em" },
      { key: "updated_at", label: "Atualizado em" },
    ],
    scope: ["admin", "consultor", "empresa"],
  },
  {
    name: "propostas",
    label: "Propostas",
    columns: [
      { key: "status", label: "Status" },
      { key: "valor_proposta", label: "Valor Proposta" },
      { key: "estimativa_horas", label: "Estimativa Horas" },
      { key: "comentarios", label: "Comentários" },
      { key: "created_at", label: "Criado em" },
      { key: "updated_at", label: "Atualizado em" },
    ],
    scope: ["admin", "consultor", "empresa"],
  },
  {
    name: "projeto_fases",
    label: "Fases dos Projetos",
    columns: [
      { key: "nome", label: "Nome" },
      { key: "descricao", label: "Descrição" },
      { key: "status", label: "Status" },
      { key: "ordem", label: "Ordem" },
      { key: "prazo", label: "Prazo" },
      { key: "valor", label: "Valor" },
      { key: "horas_estimadas", label: "Horas Estimadas" },
      { key: "horas_executadas", label: "Horas Executadas" },
      { key: "created_at", label: "Criado em" },
    ],
    scope: ["admin", "consultor", "empresa"],
  },
  {
    name: "avaliacoes",
    label: "Avaliações",
    columns: [
      { key: "nota", label: "Nota" },
      { key: "comentario", label: "Comentário" },
      { key: "recomendacao", label: "Recomendação" },
      { key: "created_at", label: "Criado em" },
    ],
    scope: ["admin", "consultor", "empresa"],
  },
  {
    name: "consultor_habilidades",
    label: "Habilidades de Consultores",
    columns: [
      { key: "nivel", label: "Nível" },
      { key: "valor_hora", label: "Valor/Hora" },
      { key: "created_at", label: "Criado em" },
    ],
    scope: ["admin", "consultor"],
  },
  {
    name: "mensagens",
    label: "Mensagens",
    columns: [
      { key: "conteudo", label: "Conteúdo" },
      { key: "tipo", label: "Tipo" },
      { key: "bloqueado", label: "Bloqueado" },
      { key: "moderado", label: "Moderado" },
      { key: "created_at", label: "Criado em" },
    ],
    scope: ["admin"],
  },
  {
    name: "portfolio_cases",
    label: "Portfólio",
    columns: [
      { key: "titulo", label: "Título" },
      { key: "descricao", label: "Descrição" },
      { key: "software_nome", label: "Software" },
      { key: "modulos_implementados", label: "Módulos" },
      { key: "horas_trabalhadas", label: "Horas Trabalhadas" },
      { key: "nota_recebida", label: "Nota Recebida" },
      { key: "depoimento_empresa", label: "Depoimento" },
      { key: "publicado", label: "Publicado" },
      { key: "created_at", label: "Criado em" },
    ],
    scope: ["admin", "consultor"],
  },
  {
    name: "profiles",
    label: "Perfis",
    columns: [
      { key: "nome", label: "Nome" },
      { key: "email", label: "Email" },
      { key: "telefone", label: "Telefone" },
      { key: "cidade", label: "Cidade" },
      { key: "estado", label: "Estado" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Criado em" },
    ],
    scope: ["admin"],
  },
  {
    name: "softwares",
    label: "Softwares",
    columns: [
      { key: "nome", label: "Nome" },
      { key: "descricao", label: "Descrição" },
      { key: "empresa_desenvolvedora", label: "Empresa Desenvolvedora" },
    ],
    scope: ["admin", "consultor", "empresa"],
  },
  {
    name: "modulos",
    label: "Módulos",
    columns: [
      { key: "nome", label: "Nome" },
      { key: "descricao", label: "Descrição" },
    ],
    scope: ["admin", "consultor", "empresa"],
  },
  {
    name: "funcionalidades",
    label: "Funcionalidades",
    columns: [
      { key: "nome", label: "Nome" },
      { key: "descricao", label: "Descrição" },
      { key: "horas_media_estimadas", label: "Horas Média Estimadas" },
    ],
    scope: ["admin", "consultor", "empresa"],
  },
  {
    name: "projeto_alertas",
    label: "Alertas de Projetos",
    columns: [
      { key: "titulo", label: "Título" },
      { key: "descricao", label: "Descrição" },
      { key: "tipo", label: "Tipo" },
      { key: "severidade", label: "Severidade" },
      { key: "resolvido", label: "Resolvido" },
      { key: "created_at", label: "Criado em" },
    ],
    scope: ["admin", "empresa"],
  },
];

interface ReportBuilderProps {
  userScope: UserScope;
}

export const ReportBuilder = ({ userScope }: ReportBuilderProps) => {
  const { user } = useAuth();
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);

  const availableTables = ALL_TABLES.filter((t) => t.scope.includes(userScope));
  const currentTable = availableTables.find((t) => t.name === selectedTable);

  useEffect(() => {
    setSelectedColumns([]);
    setData([]);
    setHasQueried(false);
  }, [selectedTable]);

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const selectAllColumns = () => {
    if (!currentTable) return;
    setSelectedColumns(currentTable.columns.map((c) => c.key));
  };

  const generateReport = async () => {
    if (!selectedTable || selectedColumns.length === 0 || !user) return;
    setLoading(true);
    setHasQueried(true);

    try {
      const selectStr = selectedColumns.join(", ");
      // RLS handles filtering automatically based on user role
      const { data: result, error } = await supabase
        .from(selectedTable as any)
        .select(selectStr);

      if (error) throw error;
      setData((result as unknown as Record<string, unknown>[]) || []);
    } catch (err) {
      console.error("Report error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (data.length === 0 || !currentTable) return;
    const cols = selectedColumns;
    const colLabels = cols.map(
      (c) => currentTable.columns.find((col) => col.key === c)?.label || c
    );

    const csvRows = [colLabels.join(",")];
    data.forEach((row) => {
      csvRows.push(
        cols
          .map((c) => {
            const val = row[c];
            const str = val === null || val === undefined ? "" : String(val);
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(",")
      );
    });

    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${selectedTable}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet size={20} className="text-primary" />
            Construtor de Relatórios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Table Selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              1. Selecione a tabela
            </label>
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Escolha uma tabela..." />
              </SelectTrigger>
              <SelectContent>
                {availableTables.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Column Selection */}
          {currentTable && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">
                  2. Selecione os campos
                </label>
                <Button variant="ghost" size="sm" onClick={selectAllColumns}>
                  Selecionar todos
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {currentTable.columns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedColumns.includes(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    <span className="text-sm">{col.label}</span>
                  </label>
                ))}
              </div>
            </motion.div>
          )}

          {/* Actions */}
          {currentTable && selectedColumns.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 pt-2"
            >
              <Button onClick={generateReport} disabled={loading}>
                <Filter size={16} className="mr-2" />
                {loading ? "Gerando..." : "Gerar Relatório"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedColumns([]);
                  setData([]);
                  setHasQueried(false);
                }}
              >
                <RotateCcw size={16} className="mr-2" />
                Limpar
              </Button>
              {data.length > 0 && (
                <Button variant="secondary" onClick={exportCSV}>
                  <Download size={16} className="mr-2" />
                  Exportar CSV
                </Button>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {hasQueried && (
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Resultados</CardTitle>
              <Badge variant="secondary">{data.length} registros</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {data.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhum registro encontrado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {selectedColumns.map((col) => (
                        <TableHead key={col}>
                          {currentTable?.columns.find((c) => c.key === col)?.label || col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slice(0, 100).map((row, i) => (
                      <TableRow key={i}>
                        {selectedColumns.map((col) => (
                          <TableCell key={col} className="max-w-[300px] truncate">
                            {formatValue(row[col])}
                          </TableCell>
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
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
