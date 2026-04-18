import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, DataCard, StatusBadge, EmptyState, LoadingState, StatCard } from "@/components/dashboard/DashboardComponents";
import { Send, CheckCircle2, XCircle, Clock, Eye, MessageSquare, Filter, X, Search, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjectCommunication } from "@/components/communication/ProjectCommunication";
import { ModeloContratacaoBadge } from "@/components/projetos/ProjetoDetalhesDialog";
import { ViewToggle, ViewMode } from "@/components/ui/view-toggle";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

const PAGE_SIZE = 5;

const ConsultorMinhasPropostas = () => {
  const { user } = useAuth();
  const [propostas, setPropostas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalheProposta, setDetalheProposta] = useState<any | null>(null);
  const [chatProposta, setChatProposta] = useState<any | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSoftware, setFilterSoftware] = useState<string>("all");
  const [filterPeriodo, setFilterPeriodo] = useState<string>("all"); // 7, 30, 90, all
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data } = await supabase
        .from("propostas")
        .select("*, projetos(id, nome, protocolo, status, descricao, objetivo, prazo_estimado, modelo_contratacao, softwares(nome))")
        .eq("consultor_user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setPropostas(data);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const enviadas = propostas.filter((p) => p.status === "enviada").length;
  const aceitas = propostas.filter((p) => p.status === "aceita").length;
  const recusadas = propostas.filter((p) => p.status === "recusada").length;

  const softwaresUnicos = useMemo(() => {
    const set = new Set<string>();
    propostas.forEach(p => { if (p.projetos?.softwares?.nome) set.add(p.projetos.softwares.nome); });
    return [...set].sort();
  }, [propostas]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const periodMs: Record<string, number> = { "7": 7 * 86400000, "30": 30 * 86400000, "90": 90 * 86400000 };
    return propostas.filter(p => {
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (filterSoftware !== "all" && p.projetos?.softwares?.nome !== filterSoftware) return false;
      if (filterPeriodo !== "all" && periodMs[filterPeriodo]) {
        if (now - new Date(p.created_at).getTime() > periodMs[filterPeriodo]) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = `${p.projetos?.nome || ""} ${p.projetos?.protocolo || ""} ${p.comentarios || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [propostas, filterStatus, filterSoftware, filterPeriodo, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [filterStatus, filterSoftware, filterPeriodo, search]);

  const hasFilters = filterStatus !== "all" || filterSoftware !== "all" || filterPeriodo !== "all" || search.trim() !== "";
  const clearFilters = () => { setFilterStatus("all"); setFilterSoftware("all"); setFilterPeriodo("all"); setSearch(""); };

  return (
    <div className="space-y-6">
      <PageHeader title="Minhas Propostas" description="Acompanhe o status de todas as suas propostas enviadas" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Clock} label="Pendentes" value={enviadas.toString()} iconColor="text-info" iconBg="bg-info/10" />
        <StatCard icon={CheckCircle2} label="Aceitas" value={aceitas.toString()} iconColor="text-success" iconBg="bg-success/10" />
        <StatCard icon={XCircle} label="Recusadas" value={recusadas.toString()} iconColor="text-destructive" iconBg="bg-destructive/10" />
      </div>

      {/* Filters */}
      <DataCard>
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros</h3>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-7 ml-auto text-xs" onClick={clearFilters}>
              <X size={12} /> Limpar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Projeto, protocolo..." className="pl-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="enviada">Pendente</SelectItem>
                <SelectItem value="aceita">Aceita</SelectItem>
                <SelectItem value="recusada">Recusada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Linha de Produto</Label>
            <Select value={filterSoftware} onValueChange={setFilterSoftware}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {softwaresUnicos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Período</Label>
            <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo o período</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </DataCard>

      <DataCard noPadding>
        {loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState message={propostas.length === 0 ? "Você ainda não enviou nenhuma proposta" : "Nenhuma proposta corresponde aos filtros"} icon={Send} />
        ) : (
          <div className="divide-y divide-border/60">
            {paged.map((p) => (
              <div key={p.id} className="p-4 px-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      p.status === "aceita" ? "bg-success/10" : p.status === "recusada" ? "bg-destructive/10" : "bg-info/10"
                    }`}>
                      {p.status === "aceita" ? <CheckCircle2 size={18} className="text-success" />
                        : p.status === "recusada" ? <XCircle size={18} className="text-destructive" />
                        : <Clock size={18} className="text-info" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.projetos?.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.projetos?.softwares?.nome} · {p.projetos?.protocolo} · {p.estimativa_horas || 0}h · {formatDate(p.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(p.valor_proposta || 0)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                {p.comentarios && (
                  <p className="text-xs text-muted-foreground mt-2 ml-[54px] line-clamp-2">{p.comentarios}</p>
                )}
                <div className="ml-[54px] mt-3 flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setDetalheProposta(p)}>
                    <Eye size={14} /> Ver detalhes
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setChatProposta(chatProposta?.id === p.id ? null : p)}>
                    <MessageSquare size={14} /> Comunicação
                  </Button>
                </div>
                {chatProposta?.id === p.id && p.projetos?.id && (
                  <div className="ml-[54px] mt-3">
                    <ProjectCommunication projetoId={p.projetos.id} projetoNome={p.projetos.nome} isEmpresa={false} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DataCard>

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} propostas
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
            <span className="text-xs font-semibold text-foreground px-2">Página {currentPage} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Próxima</Button>
          </div>
        </div>
      )}

      {/* Proposal details dialog */}
      <Dialog open={!!detalheProposta} onOpenChange={(v) => !v && setDetalheProposta(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Detalhes da Proposta</DialogTitle>
          </DialogHeader>
          {detalheProposta && (
            <div className="space-y-5">
              <div className="bg-muted/40 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{detalheProposta.projetos?.nome}</p>
                    <p className="text-xs text-muted-foreground">{detalheProposta.projetos?.softwares?.nome} · {detalheProposta.projetos?.protocolo}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={detalheProposta.status} />
                    <ModeloContratacaoBadge modelo={detalheProposta.projetos?.modelo_contratacao} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-card border border-border/60 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Valor proposto</p>
                  <p className="text-sm font-bold text-foreground mt-1">{formatCurrency(detalheProposta.valor_proposta || 0)}</p>
                </div>
                <div className="bg-card border border-border/60 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Estimativa</p>
                  <p className="text-sm font-bold text-foreground mt-1">{detalheProposta.estimativa_horas || 0}h</p>
                </div>
                <div className="bg-card border border-border/60 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Enviada em</p>
                  <p className="text-sm font-bold text-foreground mt-1">{formatDate(detalheProposta.created_at)}</p>
                </div>
              </div>

              {detalheProposta.comentarios && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Comentários técnicos</p>
                  <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{detalheProposta.comentarios}</p>
                </div>
              )}

              {detalheProposta.projetos?.descricao && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Descrição do projeto</p>
                  <p className="text-sm text-foreground">{detalheProposta.projetos.descricao}</p>
                </div>
              )}

              {detalheProposta.projetos?.objetivo && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Objetivo</p>
                  <p className="text-sm text-foreground">{detalheProposta.projetos.objetivo}</p>
                </div>
              )}

              {detalheProposta.projetos?.prazo_estimado && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar size={14} /> Prazo estimado: <span className="font-semibold text-foreground">{formatDate(detalheProposta.projetos.prazo_estimado)}</span>
                </div>
              )}

              {detalheProposta.projetos?.id && (
                <div className="pt-2 border-t border-border/60">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Histórico de comunicação</p>
                  <ProjectCommunication projetoId={detalheProposta.projetos.id} projetoNome={detalheProposta.projetos.nome} isEmpresa={false} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsultorMinhasPropostas;
