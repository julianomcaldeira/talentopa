import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Search, Calendar, Building2, Users, Filter, Eye, ArrowUpDown, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard, EmptyState, LoadingState, StatusBadge, SectionTitle, StatCard } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";
import { calculateHealthScore, getScoreColor } from "@/lib/projectHealth";

interface ProjetoRow {
  id: string;
  nome: string;
  descricao: string | null;
  objetivo: string | null;
  problema_atual: string | null;
  observacoes: string | null;
  protocolo: string | null;
  status: string;
  prazo_estimado: string | null;
  created_at: string;
  empresa_user_id: string;
  software_id: string | null;
  modelo_contratacao: string | null;
  software?: { nome: string } | null;
  fases?: { id: string; nome: string; status: string; ordem: number }[];
  propostas_count?: number;
  empresa_nome?: string;
  consultores_nomes?: string[];
}

type SortKey = "recent" | "oldest" | "name_asc" | "health_desc" | "health_asc" | "propostas_desc" | "prazo_asc";

const AdminProjetos = () => {
  const navigate = useNavigate();
  const [projetos, setProjetos] = useState<ProjetoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [softwareFilter, setSoftwareFilter] = useState("todos");
  const [modeloFilter, setModeloFilter] = useState("todos");
  const [healthFilter, setHealthFilter] = useState("todos");
  const [propostasFilter, setPropostasFilter] = useState("todos");
  const [periodoFilter, setPeriodoFilter] = useState("todos");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [selectedProjeto, setSelectedProjeto] = useState<ProjetoRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const { toast } = useToast();

  const fetchProjetos = async () => {
    const { data, error } = await supabase
      .from("projetos")
      .select("*, softwares(nome), projeto_fases(id, nome, status, ordem)")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (!data) { setLoading(false); return; }

    // Fetch empresa names and proposals (with consultor)
    const userIds = [...new Set(data.map(p => p.empresa_user_id))];
    const [profilesRes, propostasRes] = await Promise.all([
      supabase.from("profiles").select("user_id, nome").in("user_id", userIds),
      supabase.from("propostas").select("id, projeto_id, consultor_user_id, status"),
    ]);

    const consultorIds = [...new Set((propostasRes.data || []).map(p => p.consultor_user_id).filter(Boolean))] as string[];
    const { data: consultorProfiles } = consultorIds.length
      ? await supabase.from("profiles").select("user_id, nome").in("user_id", consultorIds)
      : { data: [] as { user_id: string; nome: string }[] };

    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p.nome]));
    const consultorMap = new Map((consultorProfiles || []).map(p => [p.user_id, p.nome]));
    const propostaCountMap = new Map<string, number>();
    const consultoresByProjeto = new Map<string, Set<string>>();
    (propostasRes.data || []).forEach(p => {
      propostaCountMap.set(p.projeto_id, (propostaCountMap.get(p.projeto_id) || 0) + 1);
      const nome = p.consultor_user_id ? consultorMap.get(p.consultor_user_id) : null;
      if (nome) {
        if (!consultoresByProjeto.has(p.projeto_id)) consultoresByProjeto.set(p.projeto_id, new Set());
        consultoresByProjeto.get(p.projeto_id)!.add(nome);
      }
    });

    const enriched: ProjetoRow[] = data.map(p => ({
      ...p,
      software: p.softwares,
      fases: p.projeto_fases || [],
      propostas_count: propostaCountMap.get(p.id) || 0,
      empresa_nome: profileMap.get(p.empresa_user_id) || "Empresa",
      consultores_nomes: Array.from(consultoresByProjeto.get(p.id) || []),
    }));

    setProjetos(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchProjetos(); }, []);

  const softwareOptions = useMemo(() => {
    const map = new Map<string, string>();
    projetos.forEach(p => { if (p.software_id && p.software?.nome) map.set(p.software_id, p.software.nome); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [projetos]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const day = 86400000;
    return projetos.filter(p => {
      const term = search.trim().toLowerCase();
      const matchesSearch = !term ||
        p.nome.toLowerCase().includes(term) ||
        p.protocolo?.toLowerCase().includes(term) ||
        p.empresa_nome?.toLowerCase().includes(term) ||
        p.software?.nome?.toLowerCase().includes(term) ||
        p.descricao?.toLowerCase().includes(term) ||
        p.objetivo?.toLowerCase().includes(term) ||
        (p.consultores_nomes || []).some(n => n.toLowerCase().includes(term));
      if (!matchesSearch) return false;
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (softwareFilter !== "todos" && p.software_id !== softwareFilter) return false;
      if (modeloFilter !== "todos" && p.modelo_contratacao !== modeloFilter) return false;

      if (healthFilter !== "todos") {
        const score = calculateHealthScore(p.fases || [], p.prazo_estimado, p.status).score;
        if (healthFilter === "alto" && score < 75) return false;
        if (healthFilter === "medio" && (score < 50 || score >= 75)) return false;
        if (healthFilter === "baixo" && score >= 50) return false;
      }

      if (propostasFilter !== "todos") {
        const c = p.propostas_count || 0;
        if (propostasFilter === "sem" && c !== 0) return false;
        if (propostasFilter === "com" && c === 0) return false;
        if (propostasFilter === "muitas" && c < 3) return false;
      }

      if (periodoFilter !== "todos") {
        const age = now - new Date(p.created_at).getTime();
        if (periodoFilter === "7d" && age > 7 * day) return false;
        if (periodoFilter === "30d" && age > 30 * day) return false;
        if (periodoFilter === "90d" && age > 90 * day) return false;
      }
      return true;
    });
  }, [projetos, search, statusFilter, softwareFilter, modeloFilter, healthFilter, propostasFilter, periodoFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "oldest": return arr.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      case "name_asc": return arr.sort((a, b) => a.nome.localeCompare(b.nome));
      case "health_desc": return arr.sort((a, b) =>
        calculateHealthScore(b.fases || [], b.prazo_estimado, b.status).score -
        calculateHealthScore(a.fases || [], a.prazo_estimado, a.status).score);
      case "health_asc": return arr.sort((a, b) =>
        calculateHealthScore(a.fases || [], a.prazo_estimado, a.status).score -
        calculateHealthScore(b.fases || [], b.prazo_estimado, b.status).score);
      case "propostas_desc": return arr.sort((a, b) => (b.propostas_count || 0) - (a.propostas_count || 0));
      case "prazo_asc": return arr.sort((a, b) => {
        if (!a.prazo_estimado) return 1;
        if (!b.prazo_estimado) return -1;
        return +new Date(a.prazo_estimado) - +new Date(b.prazo_estimado);
      });
      default: return arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
  }, [filtered, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, statusFilter, softwareFilter, modeloFilter, healthFilter, propostasFilter, periodoFilter, sortBy]);

  const activeFiltersCount = [statusFilter, softwareFilter, modeloFilter, healthFilter, propostasFilter, periodoFilter]
    .filter(v => v !== "todos").length;

  const clearFilters = () => {
    setStatusFilter("todos");
    setSoftwareFilter("todos");
    setModeloFilter("todos");
    setHealthFilter("todos");
    setPropostasFilter("todos");
    setPeriodoFilter("todos");
    setSearch("");
  };

  const statusCounts = {
    total: projetos.length,
    em_andamento: projetos.filter(p => p.status === "em_andamento").length,
    publicado: projetos.filter(p => p.status === "publicado").length,
    concluido: projetos.filter(p => p.status === "concluido").length,
  };

  return (
    <div>
      <PageHeader
        title="Projetos"
        description="Todos os projetos da plataforma"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={FolderKanban} label="Total de projetos" value={statusCounts.total.toString()} iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon={FolderKanban} label="Em andamento" value={statusCounts.em_andamento.toString()} iconColor="text-info" iconBg="bg-info/10" />
        <StatCard icon={FolderKanban} label="Publicados" value={statusCounts.publicado.toString()} iconColor="text-warning" iconBg="bg-warning/10" />
        <StatCard icon={FolderKanban} label="Concluídos" value={statusCounts.concluido.toString()} iconColor="text-success" iconBg="bg-success/10" />
      </div>

      {/* Filters */}
      <div className="bg-card border border-border/60 rounded-2xl p-4 mb-6 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              placeholder="Buscar por nome, protocolo ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-full lg:w-[200px]">
              <ArrowUpDown size={14} className="mr-2 text-muted-foreground" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigos</SelectItem>
              <SelectItem value="name_asc">Nome (A–Z)</SelectItem>
              <SelectItem value="health_desc">Health Score ↓</SelectItem>
              <SelectItem value="health_asc">Health Score ↑</SelectItem>
              <SelectItem value="propostas_desc">Mais propostas</SelectItem>
              <SelectItem value="prazo_asc">Prazo mais próximo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="publicado">Publicado</SelectItem>
              <SelectItem value="em_selecao">Em seleção</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={softwareFilter} onValueChange={setSoftwareFilter}>
            <SelectTrigger><SelectValue placeholder="Software" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os ERPs</SelectItem>
              {softwareOptions.map(([id, nome]) => (
                <SelectItem key={id} value={id}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modeloFilter} onValueChange={setModeloFilter}>
            <SelectTrigger><SelectValue placeholder="Modelo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os modelos</SelectItem>
              <SelectItem value="remoto">Remoto</SelectItem>
              <SelectItem value="hibrido">Híbrido</SelectItem>
              <SelectItem value="presencial">Presencial</SelectItem>
            </SelectContent>
          </Select>

          <Select value={healthFilter} onValueChange={setHealthFilter}>
            <SelectTrigger><SelectValue placeholder="Health Score" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os scores</SelectItem>
              <SelectItem value="alto">Alto (≥75)</SelectItem>
              <SelectItem value="medio">Médio (50–74)</SelectItem>
              <SelectItem value="baixo">Baixo (&lt;50)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={propostasFilter} onValueChange={setPropostasFilter}>
            <SelectTrigger><SelectValue placeholder="Propostas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as propostas</SelectItem>
              <SelectItem value="sem">Sem propostas</SelectItem>
              <SelectItem value="com">Com propostas</SelectItem>
              <SelectItem value="muitas">3+ propostas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
            <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer data</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(activeFiltersCount > 0 || search) && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{sorted.length}</span> de {projetos.length} projeto(s)
              {activeFiltersCount > 0 && (
                <> · <span className="font-semibold text-foreground">{activeFiltersCount}</span> filtro(s) ativo(s)</>
              )}
            </p>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {/* List */}
      <DataCard noPadding>
        {loading ? <LoadingState /> : sorted.length === 0 ? (
          <EmptyState message={search || activeFiltersCount > 0 ? "Nenhum projeto encontrado com esses filtros" : "Nenhum projeto cadastrado"} icon={FolderKanban} />
        ) : (
          <div className="divide-y divide-border/60">
            {paginated.map((projeto) => (
              <div
                key={projeto.id}
                className="p-4 px-5 table-row-interactive cursor-pointer"
                onClick={() => navigate(`/admin/projetos/${projeto.id}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {(() => {
                      const health = calculateHealthScore(projeto.fases || [], projeto.prazo_estimado, projeto.status);
                      const sc = getScoreColor(health.score);
                      return (
                        <div className={`w-10 h-10 rounded-xl ${sc.bg} flex items-center justify-center ring-2 ${sc.ring} flex-shrink-0`}>
                          <span className={`font-display font-bold text-sm ${sc.text}`}>{health.score}</span>
                        </div>
                      );
                    })()}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{projeto.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {projeto.software?.nome || "Software não definido"} · {projeto.protocolo} · {projeto.empresa_nome}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant="secondary" className="text-[11px]">
                      {projeto.propostas_count} proposta{projeto.propostas_count !== 1 ? "s" : ""}
                    </Badge>
                    <StatusBadge status={projeto.status} />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProjeto(projeto);
                        setDetailOpen(true);
                      }}
                      className="h-8 gap-1.5"
                    >
                      <Eye size={14} /> Detalhes
                    </Button>
                  </div>
                </div>
                {projeto.fases && projeto.fases.length > 0 && (
                  <div className="flex gap-1 ml-[54px]">
                    {projeto.fases
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((f) => (
                        <div
                          key={f.id}
                          className={`flex-1 h-1.5 rounded-full transition-colors ${
                            f.status === "aprovada" ? "bg-success" :
                            f.status === "em_andamento" ? "bg-primary" :
                            f.status === "aguardando_aprovacao" ? "bg-warning" : "bg-border"
                          }`}
                          title={`${f.nome}: ${f.status}`}
                        />
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DataCard>

      {/* Pagination */}
      {!loading && sorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-muted-foreground">
            Mostrando <span className="font-semibold text-foreground">{(currentPage - 1) * PAGE_SIZE + 1}</span>
            {" - "}
            <span className="font-semibold text-foreground">{Math.min(currentPage * PAGE_SIZE, sorted.length)}</span>
            {" de "}
            <span className="font-semibold text-foreground">{sorted.length}</span> projetos
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 gap-1"
            >
              <ChevronLeft size={14} /> Anterior
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              Página <span className="font-semibold text-foreground">{currentPage}</span> de{" "}
              <span className="font-semibold text-foreground">{totalPages}</span>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 gap-1"
            >
              Próxima <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <FolderKanban size={20} className="text-primary" />
              {selectedProjeto?.nome}
            </DialogTitle>
          </DialogHeader>

          {selectedProjeto && (
            <div className="space-y-6 pt-2">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={selectedProjeto.status} />
                <Badge variant="outline">{selectedProjeto.protocolo}</Badge>
                {selectedProjeto.software?.nome && (
                  <Badge variant="secondary">{selectedProjeto.software.nome}</Badge>
                )}
              </div>

              <div>
                <SectionTitle>Informações gerais</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DetailItem label="Empresa" value={selectedProjeto.empresa_nome} icon={<Building2 size={14} />} />
                  <DetailItem label="Prazo estimado" value={
                    selectedProjeto.prazo_estimado 
                      ? new Date(selectedProjeto.prazo_estimado).toLocaleDateString("pt-BR")
                      : null
                  } icon={<Calendar size={14} />} />
                  <DetailItem label="Propostas recebidas" value={`${selectedProjeto.propostas_count} proposta(s)`} icon={<Users size={14} />} />
                  <DetailItem label="Criado em" value={new Date(selectedProjeto.created_at).toLocaleDateString("pt-BR")} icon={<Calendar size={14} />} />
                </div>
              </div>

              {selectedProjeto.descricao && (
                <div>
                  <SectionTitle>Descrição</SectionTitle>
                  <p className="text-sm text-foreground/80 bg-muted/40 rounded-xl p-4">{selectedProjeto.descricao}</p>
                </div>
              )}

              {selectedProjeto.objetivo && (
                <div>
                  <SectionTitle>Objetivo</SectionTitle>
                  <p className="text-sm text-foreground/80 bg-muted/40 rounded-xl p-4">{selectedProjeto.objetivo}</p>
                </div>
              )}

              {selectedProjeto.problema_atual && (
                <div>
                  <SectionTitle>Problema atual</SectionTitle>
                  <p className="text-sm text-foreground/80 bg-muted/40 rounded-xl p-4">{selectedProjeto.problema_atual}</p>
                </div>
              )}

              {selectedProjeto.fases && selectedProjeto.fases.length > 0 && (
                <div>
                  <SectionTitle>Fases do projeto</SectionTitle>
                  <div className="space-y-2">
                    {selectedProjeto.fases.sort((a, b) => a.ordem - b.ordem).map((fase, i) => (
                      <div key={fase.id} className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {i + 1}
                        </div>
                        <span className="text-sm font-medium text-foreground flex-1">{fase.nome}</span>
                        <StatusBadge status={fase.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DetailItem = ({ label, value, icon }: { label: string; value: string | null | undefined; icon?: React.ReactNode }) => (
  <div className="bg-muted/40 rounded-xl p-3">
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1.5">
      {icon} {label}
    </p>
    <p className="text-sm font-medium text-foreground">{value || "—"}</p>
  </div>
);

export default AdminProjetos;
