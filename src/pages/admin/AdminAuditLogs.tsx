import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, DataCard, LoadingState, EmptyState } from "@/components/dashboard/DashboardComponents";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollText, Search, Filter, ChevronLeft, ChevronRight, Eye, Download, RefreshCw, AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";

interface AuditLog {
  id: string;
  actor_user_id: string | null;
  actor_role: string | null;
  actor_nome: string | null;
  categoria: string;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  descricao: string | null;
  dados_antigos: any;
  dados_novos: any;
  severidade: string;
  created_at: string;
}

const PAGE_SIZE = 20;

const severityIcon = (s: string) => {
  if (s === "critical") return <ShieldAlert className="h-3.5 w-3.5 text-destructive" />;
  if (s === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-warning" />;
  if (s === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
  return <Info className="h-3.5 w-3.5 text-primary" />;
};

const severityClass = (s: string) =>
  s === "critical" ? "badge-destructive"
  : s === "warning" ? "badge-warning"
  : s === "success" ? "badge-success"
  : "badge-info";

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("all");
  const [severidade, setSeveridade] = useState("all");
  const [periodo, setPeriodo] = useState("30");
  const [actorRole, setActorRole] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1000);
    if (periodo !== "all") {
      const d = new Date(); d.setDate(d.getDate() - parseInt(periodo));
      query = query.gte("created_at", d.toISOString());
    }
    const { data } = await query;
    setLogs((data || []) as AuditLog[]);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); /* eslint-disable-next-line */ }, [periodo]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (categoria !== "all" && l.categoria !== categoria) return false;
      if (severidade !== "all" && l.severidade !== severidade) return false;
      if (actorRole !== "all" && l.actor_role !== actorRole) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(l.descricao?.toLowerCase().includes(s) || l.actor_nome?.toLowerCase().includes(s) || l.acao.toLowerCase().includes(s) || l.entidade?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [logs, search, categoria, severidade, actorRole]);

  useEffect(() => { setPage(1); }, [search, categoria, severidade, actorRole, periodo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCSV = () => {
    const rows = [["Data", "Categoria", "Ação", "Severidade", "Ator", "Papel", "Entidade", "Descrição"]];
    filtered.forEach(l => {
      rows.push([
        new Date(l.created_at).toLocaleString("pt-BR"),
        l.categoria, l.acao, l.severidade,
        l.actor_nome || "", l.actor_role || "", l.entidade || "",
        (l.descricao || "").replace(/"/g, '""'),
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-logs-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const categorias = Array.from(new Set(logs.map(l => l.categoria))).sort();
  const papeis = Array.from(new Set(logs.map(l => l.actor_role).filter(Boolean))) as string[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs de auditoria"
        description="Rastreie todas as ações importantes da plataforma."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs}><RefreshCw size={14} className="mr-2" />Atualizar</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download size={14} className="mr-2" />Exportar CSV</Button>
          </div>
        }
      />

      {/* Filtros */}
      <DataCard>
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground"><Filter size={14} />Filtros</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severidade} onValueChange={setSeveridade}>
            <SelectTrigger><SelectValue placeholder="Severidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="warning">Aviso</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actorRole} onValueChange={setActorRole}>
            <SelectTrigger><SelectValue placeholder="Papel do ator" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os papéis</SelectItem>
              {papeis.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Últimas 24h</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Todo o período</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {filtered.length} {filtered.length === 1 ? "registro" : "registros"} encontrados
        </p>
      </DataCard>

      {/* Tabela */}
      <DataCard noPadding>
        {loading ? <LoadingState /> : paged.length === 0 ? (
          <EmptyState message="Nenhum log encontrado com esses filtros" icon={ScrollText} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Data/hora</th>
                  <th className="px-4 py-3">Sev.</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Ação</th>
                  <th className="px-4 py-3">Ator</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3 text-right">—</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(l => (
                  <tr key={l.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${severityClass(l.severidade)}`}>{severityIcon(l.severidade)}{l.severidade}</span></td>
                    <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-1 rounded-lg badge-muted capitalize">{l.categoria}</span></td>
                    <td className="px-4 py-3 font-mono text-xs">{l.acao}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        <p className="font-medium">{l.actor_nome || "Sistema"}</p>
                        <p className="text-muted-foreground capitalize">{l.actor_role || "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-md truncate">{l.descricao}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(l)}><Eye size={14} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {paged.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Página {page} de {totalPages} · {filtered.length} registros</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></Button>
            </div>
          </div>
        )}
      </DataCard>

      {/* Detalhe */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected && severityIcon(selected.severidade)}
              {selected?.acao}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Data</p><p>{new Date(selected.created_at).toLocaleString("pt-BR")}</p></div>
                <div><p className="text-xs text-muted-foreground">Categoria</p><p className="capitalize">{selected.categoria}</p></div>
                <div><p className="text-xs text-muted-foreground">Ator</p><p>{selected.actor_nome} <span className="text-muted-foreground">({selected.actor_role})</span></p></div>
                <div><p className="text-xs text-muted-foreground">Entidade</p><p className="font-mono text-xs">{selected.entidade} {selected.entidade_id && `· ${selected.entidade_id.slice(0, 8)}`}</p></div>
              </div>
              <div><p className="text-xs text-muted-foreground mb-1">Descrição</p><p>{selected.descricao}</p></div>
              {selected.dados_antigos && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Dados antigos</p>
                  <pre className="bg-muted/40 p-3 rounded-lg text-xs overflow-x-auto">{JSON.stringify(selected.dados_antigos, null, 2)}</pre>
                </div>
              )}
              {selected.dados_novos && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Dados novos</p>
                  <pre className="bg-muted/40 p-3 rounded-lg text-xs overflow-x-auto">{JSON.stringify(selected.dados_novos, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAuditLogs;
