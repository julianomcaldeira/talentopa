import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageHeader, DataCard, StatusBadge, EmptyState, LoadingState } from "@/components/dashboard/DashboardComponents";
import { ViewToggle, ViewMode } from "@/components/ui/view-toggle";
import { FolderKanban, Eye, MapPin, Clock, DollarSign, User, MessageSquare, Pencil, Search, ChevronLeft, ChevronRight, Settings2, Plus, BadgeCheck, CheckCircle2, CalendarIcon, X, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ConsultorMatchList } from "@/components/matching/ConsultorMatchList";
import { ProjectCommunication } from "@/components/communication/ProjectCommunication";
import { ProjetoEditDialog } from "@/components/projetos/ProjetoEditDialog";
import { cn } from "@/lib/utils";
import EmpresaNovoProjeto from "./EmpresaNovoProjeto";
import { PROJETO_SORT_OPTIONS, sortProjetos, ProjetoSortKey } from "@/lib/projetoSort";

const PAGE_SIZE = 6;
const PROPOSTAS_PAGE_SIZE = 5;
const PROPOSTA_STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "enviada", label: "Enviada" },
  { value: "pre_aprovada", label: "Pré-aprovada" },
  { value: "aguardando_consultor", label: "Aguardando consultor" },
  { value: "aceita", label: "Aceita" },
  { value: "recusada", label: "Recusada" },
];

const preApproveMatchedConsultor = async (projeto: any, consultorUserId: string, toast: ReturnType<typeof useToast>["toast"], refetch: () => Promise<void>) => {
  const { error } = await (supabase as any).rpc("empresa_pre_aprovar_consultor", {
    p_projeto_id: projeto.id,
    p_consultor_user_id: consultorUserId,
  });
  if (error) {
    toast({ title: "Erro ao pré-aprovar", description: error.message, variant: "destructive" });
    return false;
  }
  toast({ title: "Consultor pré-aprovado", description: "A conversa foi liberada para alinhamento antes da aprovação final." });
  refetch();
  return true;
};

const KANBAN_COLUMNS: { key: string; label: string; tone: string }[] = [
  { key: "rascunho", label: "Rascunho", tone: "bg-muted-foreground/40" },
  { key: "publicado", label: "Publicado", tone: "bg-primary" },
  { key: "em_selecao", label: "Em seleção", tone: "bg-warning" },
  { key: "em_andamento", label: "Em andamento", tone: "bg-info" },
  { key: "concluido", label: "Concluído", tone: "bg-success" },
  { key: "cancelado", label: "Cancelado", tone: "bg-destructive" },
];

const EmpresaProjetos = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjeto, setSelectedProjeto] = useState<any>(null);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [respostasParceiros, setRespostasParceiros] = useState<any[]>([]);
  const [expandedRespostas, setExpandedRespostas] = useState<Record<string, boolean>>({});
  const [visualizacoesHistorico, setVisualizacoesHistorico] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chatProjeto, setChatProjeto] = useState<any>(null);
  const [editProjeto, setEditProjeto] = useState<any>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [prazoFilter, setPrazoFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<ProjetoSortKey>("recent");
  const [page, setPage] = useState(1);
  const [novoProjetoOpen, setNovoProjetoOpen] = useState(false);
  const [propostaStatusFilter, setPropostaStatusFilter] = useState("all");
  const [propostaDataInicio, setPropostaDataInicio] = useState<Date | undefined>();
  const [propostaDataFim, setPropostaDataFim] = useState<Date | undefined>();
  const [propostaPage, setPropostaPage] = useState(1);

  const refetch = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("projetos")
      .select("*, softwares(nome), projeto_fases(id, nome, status, valor)")
      .eq("empresa_user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) {
      const ids = data.map((p) => p.id);
      const { data: unread } = ids.length
        ? await supabase.from("propostas").select("projeto_id").in("projeto_id", ids).is("visualizada_empresa_em", null)
        : { data: [] as any[] };
      const unreadMap = new Map<string, number>();
      (unread || []).forEach((p: any) => unreadMap.set(p.projeto_id, (unreadMap.get(p.projeto_id) || 0) + 1));
      setProjetos(data.map((p) => ({ ...p, propostas_nao_visualizadas: unreadMap.get(p.id) || 0 })));
    }
  };

  useEffect(() => {
    if (!user) return;
    refetch().then(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`empresa-propostas-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "propostas" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const result = projetos.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (prazoFilter !== "all") {
        const prazo = p.prazo_propostas ? new Date(p.prazo_propostas + "T00:00:00") : null;
        if (prazoFilter === "sem_prazo") {
          if (prazo) return false;
        } else {
          if (!prazo) return false;
          if (prazoFilter === "vencido" && !(prazo < today)) return false;
          if (prazoFilter === "proximo" && !(prazo >= today && prazo <= in7)) return false;
          if (prazoFilter === "dentro" && !(prazo > in7)) return false;
        }
      }
      if (!q) return true;
      return (
        p.nome?.toLowerCase().includes(q) ||
        p.protocolo?.toLowerCase().includes(q) ||
        p.softwares?.nome?.toLowerCase().includes(q)
      );
    });
    return sortProjetos(result, sortBy);
  }, [projetos, search, statusFilter, prazoFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  useEffect(() => { setPage(1); }, [search, statusFilter, prazoFilter, sortBy, view]);

  const propostasFiltradas = useMemo(() => {
    const start = propostaDataInicio ? new Date(propostaDataInicio) : null;
    const end = propostaDataFim ? new Date(propostaDataFim) : null;
    start?.setHours(0, 0, 0, 0);
    end?.setHours(23, 59, 59, 999);
    return propostas.filter((prop) => {
      if (propostaStatusFilter !== "all" && prop.status !== propostaStatusFilter) return false;
      const created = new Date(prop.created_at);
      if (start && created < start) return false;
      if (end && created > end) return false;
      return true;
    });
  }, [propostas, propostaStatusFilter, propostaDataInicio, propostaDataFim]);

  const propostaTotalPages = Math.max(1, Math.ceil(propostasFiltradas.length / PROPOSTAS_PAGE_SIZE));
  const propostaCurrentPage = Math.min(propostaPage, propostaTotalPages);
  const propostasPaginadas = useMemo(
    () => propostasFiltradas.slice((propostaCurrentPage - 1) * PROPOSTAS_PAGE_SIZE, propostaCurrentPage * PROPOSTAS_PAGE_SIZE),
    [propostasFiltradas, propostaCurrentPage]
  );

  useEffect(() => { setPropostaPage(1); }, [propostaStatusFilter, propostaDataInicio, propostaDataFim, selectedProjeto?.id]);

  const viewPropostas = async (projeto: any) => {
    setSelectedProjeto(projeto);
    setPropostaStatusFilter("all");
    setPropostaDataInicio(undefined);
    setPropostaDataFim(undefined);
    setPropostaPage(1);
    const { data: propostasData } = await supabase
      .from("propostas")
      .select("*")
      .eq("projeto_id", projeto.id)
      .order("created_at", { ascending: false });

    if (propostasData && propostasData.length > 0) {
      const consultorIds = [...new Set(propostasData.map(p => p.consultor_user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, nome, cidade, estado")
        .in("user_id", consultorIds);

      const profileMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
      const enriched = propostasData.map(p => ({
        ...p,
        consultor: profileMap.get(p.consultor_user_id) || null,
      }));
      setPropostas(enriched);
    } else {
      setPropostas([]);
    }
    const { error: viewedError } = await (supabase as any).rpc("marcar_propostas_visualizadas_empresa", { p_projeto_id: projeto.id });
    if (viewedError) {
      toast({ title: "Erro ao atualizar contador", description: viewedError.message, variant: "destructive" });
    } else {
      setProjetos((prev) => prev.map((p) => p.id === projeto.id ? { ...p, propostas_nao_visualizadas: 0 } : p));
      setSelectedProjeto((prev: any) => prev?.id === projeto.id ? { ...prev, propostas_nao_visualizadas: 0 } : prev);
      void refetch();
    }
    const { data: historicoData } = await (supabase as any)
      .from("proposta_visualizacoes_historico")
      .select("*")
      .eq("projeto_id", projeto.id)
      .order("visualizado_em", { ascending: false });

    // === Respostas de Parceiros ===
    const { data: respostasData } = await (supabase as any)
      .from("parceiro_respostas")
      .select("*")
      .eq("projeto_id", projeto.id)
      .order("created_at", { ascending: false });

    let respostasEnriched: any[] = [];
    if (respostasData && respostasData.length > 0) {
      const respostaIds = respostasData.map((r: any) => r.id);
      const canalIds = [...new Set(respostasData.map((r: any) => r.canal_id))];
      const [{ data: indicacoesData }, { data: canaisData }] = await Promise.all([
        (supabase as any).from("parceiro_indicacoes").select("*").in("resposta_id", respostaIds),
        supabase.from("canais").select("id, nome, user_id").in("id", canalIds as string[]),
      ]);
      const consIds = [...new Set((indicacoesData || []).map((i: any) => i.consultor_user_id))];
      const { data: consProfiles } = consIds.length
        ? await supabase.from("profiles").select("user_id, nome, cidade, estado, avatar_url").in("user_id", consIds as string[])
        : { data: [] as any[] };
      const consMap = new Map((consProfiles || []).map((p: any) => [p.user_id, p]));
      const canalMap = new Map((canaisData || []).map((c: any) => [c.id, c]));

      respostasEnriched = respostasData.map((r: any) => ({
        ...r,
        canal: canalMap.get(r.canal_id) || null,
        indicacoes: (indicacoesData || [])
          .filter((i: any) => i.resposta_id === r.id)
          .map((i: any) => ({ ...i, consultor: consMap.get(i.consultor_user_id) || null })),
      }));
    }
    setRespostasParceiros(respostasEnriched);
    setExpandedRespostas(Object.fromEntries(respostasEnriched.map((r) => [r.id, true])));
    const viewerIds: string[] = Array.from(new Set((historicoData || []).map((h: any) => String(h.visualizado_por))));
    const { data: viewerProfiles } = viewerIds.length
      ? await supabase.from("profiles").select("user_id, nome").in("user_id", viewerIds)
      : { data: [] as any[] };
    const viewerMap = new Map((viewerProfiles || []).map((p: any) => [p.user_id, p.nome]));
    setVisualizacoesHistorico((historicoData || []).map((h: any) => ({ ...h, visualizador_nome: viewerMap.get(h.visualizado_por) || "Usuário" })));
    setDialogOpen(true);
  };

  const renderPropostasButton = (p: any, compact = false) => {
    const novas = Number(p.propostas_nao_visualizadas) || 0;
    const hasNovas = novas > 0;
    return (
      <Button
        size="sm"
        variant={hasNovas ? "default" : "outline"}
        className={cn(
          compact && "h-7 px-2 text-[11px]",
          hasNovas && "proposal-soft-pulse shadow-primary/20"
        )}
        onClick={() => viewPropostas(p)}
        aria-label={hasNovas ? `Ver propostas, ${novas} novas propostas` : "Ver propostas"}
      >
        <Eye size={compact ? 11 : 14} />
        {compact ? "Propostas" : "Ver propostas"}
        <span className={`ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${hasNovas ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {novas}
        </span>
        {hasNovas && <span className="text-[10px] font-medium">novas</span>}
      </Button>
    );
  };

  const acceptProposal = async (propostaId: string) => {
    const { error } = await (supabase as any).rpc("empresa_aceitar_proposta", { p_proposta_id: propostaId });
    if (error) {
      toast({ title: "Erro ao aceitar proposta", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Proposta aceita!", description: "Aguardando confirmação do consultor para iniciar o projeto." });
    setDialogOpen(false);
    refetch();
  };

  const preApproveProposal = async (propostaId: string) => {
    const { error } = await (supabase as any).rpc("empresa_pre_aprovar_proposta", { p_proposta_id: propostaId });
    if (error) {
      toast({ title: "Erro ao pré-aprovar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Projeto pré-aprovado", description: "A comunicação foi liberada para alinhamento com o consultor." });
    if (selectedProjeto) await viewPropostas(selectedProjeto);
    refetch();
  };

  const rejectProposal = async (propostaId: string) => {
    if (!window.confirm("Tem certeza que deseja recusar esta proposta? O consultor será notificado.")) return;
    const { error } = await (supabase as any).rpc("empresa_recusar_proposta", { p_proposta_id: propostaId, p_motivo: null });
    if (error) {
      toast({ title: "Erro ao recusar proposta", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Proposta recusada", description: "O consultor foi notificado." });
    if (selectedProjeto) await viewPropostas(selectedProjeto);
    refetch();
  };

  const selectIndicacao = async (indicacaoId: string, consultorNome?: string) => {
    if (!window.confirm(`Confirmar seleção${consultorNome ? ` de ${consultorNome}` : ""}? As demais propostas e indicações abertas deste projeto serão recusadas.`)) return;
    const { error } = await (supabase as any).rpc("empresa_selecionar_indicacao", { p_indicacao_id: indicacaoId });
    if (error) {
      toast({ title: "Erro ao selecionar indicação", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Consultor selecionado", description: "A alocação foi criada com titularidade do parceiro." });
    if (selectedProjeto) await viewPropostas(selectedProjeto);
    refetch();
  };


  const renderDateFilter = (label: string, date: Date | undefined, onSelect: (date: Date | undefined) => void) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 justify-start text-left font-normal", !date && "text-muted-foreground")}
        >
          <CalendarIcon size={14} />
          {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );

  const renderProgress = (p: any) => {
    if (!p.projeto_fases || p.projeto_fases.length === 0) return null;
    return (
      <div className="flex gap-1.5">
        {p.projeto_fases.map((f: any) => (
          <div key={f.id} className="flex-1">
            <div className={`h-1.5 rounded-full mb-1 ${
              f.status === "aprovada" ? "bg-success" : f.status === "em_andamento" ? "bg-primary" : "bg-border"
            }`} />
            <p className="text-[10px] text-muted-foreground truncate">{f.nome}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderActions = (p: any) => (
    <div className="flex flex-wrap items-center gap-2">
      {(p.status === "publicado" || p.status === "em_selecao" || p.status === "em_andamento" || p.status === "concluido") && (
        <>
          {p.status !== "concluido" && (
            renderPropostasButton(p)
          )}
          {p.status !== "concluido" && (
            <Button size="sm" variant="outline" onClick={() => setChatProjeto(chatProjeto?.id === p.id ? null : p)}>
              <MessageSquare size={14} /> Comunicação
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditProjeto(p)}>
            <Pencil size={14} /> Editar
          </Button>
        </>
      )}
      {(p.status === "em_andamento" || p.status === "concluido") && (
        <Button size="sm" onClick={() => navigate(`/empresa/projetos/${p.id}/gestao`)}>
          <Settings2 size={14} /> Gestão compartilhada
        </Button>
      )}
    </div>
  );

  const projectsByStatus = useMemo(() => {
    const map: Record<string, any[]> = {};
    KANBAN_COLUMNS.forEach(c => { map[c.key] = []; });
    filtered.forEach(p => {
      if (map[p.status]) map[p.status].push(p);
      else map[p.status] = [p];
    });
    return map;
  }, [filtered]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <PageHeader title="Projetos" description="Acompanhe e gerencie todos os seus projetos" />
        <Button size="lg" onClick={() => setNovoProjetoOpen(true)} className="shadow-lg shadow-primary/25 hover:shadow-primary/40">
          <Plus size={16} /> Novo Projeto
        </Button>
      </div>

      <DataCard className="mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, protocolo ou software..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="md:w-52 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {KANBAN_COLUMNS.map(c => (
                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={prazoFilter} onValueChange={setPrazoFilter}>
            <SelectTrigger className="md:w-56 h-9"><SelectValue placeholder="Prazo de propostas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os prazos</SelectItem>
              <SelectItem value="vencido">Vencidos</SelectItem>
              <SelectItem value="proximo">Próximos (≤ 7 dias)</SelectItem>
              <SelectItem value="dentro">Dentro do prazo (&gt; 7 dias)</SelectItem>
              <SelectItem value="sem_prazo">Sem prazo definido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as ProjetoSortKey)}>
            <SelectTrigger className="md:w-52 h-9"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
            <SelectContent>
              {PROJETO_SORT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ViewToggle value={view} onChange={setView} />
        </div>
        <div className="text-xs text-muted-foreground mt-3">
          {filtered.length} {filtered.length === 1 ? "projeto" : "projetos"}
          {filtered.length !== projetos.length && ` (de ${projetos.length})`}
        </div>
      </DataCard>

      {loading ? (
        <DataCard><LoadingState /></DataCard>
      ) : filtered.length === 0 ? (
        <DataCard><EmptyState message={projetos.length === 0 ? "Nenhum projeto criado ainda" : "Nenhum projeto encontrado com os filtros atuais"} icon={FolderKanban} /></DataCard>
      ) : view === "list" ? (
        <>
          <div className="space-y-4">
            {paginated.map((p) => (
              <DataCard key={p.id}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3.5">
                    <div className="icon-container icon-container-md bg-primary/10 mt-0.5">
                      <FolderKanban size={18} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-foreground text-[15px]">{p.nome}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.softwares?.nome} · {p.protocolo}</p>
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                {p.projeto_fases && p.projeto_fases.length > 0 && (
                  <div className="ml-[54px] mb-4">{renderProgress(p)}</div>
                )}

                <div className="ml-[54px]">{renderActions(p)}</div>

                {chatProjeto?.id === p.id && (
                  <div className="ml-[54px] mt-3">
                    <ProjectCommunication projetoId={p.id} projetoNome={p.nome} isEmpresa={true} empresaUserId={user?.id} />
                  </div>
                )}

                {(p.status === "publicado" || p.status === "em_selecao") && (
                  <div className="ml-[54px]">
                    <ConsultorMatchList
                      projetoId={p.id}
                      projetoNome={p.nome}
                      softwareId={p.software_id}
                      onInvite={async (consultorUserId) => { await preApproveMatchedConsultor(p, consultorUserId, toast, refetch); }}
                    />
                  </div>
                )}
              </DataCard>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages} · Mostrando {paginated.length} de {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <ChevronLeft size={14} /> Anterior
                </Button>
                <div className="flex items-center gap-1 mx-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i + 1)}
                      className={`w-8 h-8 text-xs rounded-md font-medium transition-colors ${
                        currentPage === i + 1
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  Próxima <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {KANBAN_COLUMNS.filter(c => projectsByStatus[c.key]?.length > 0).map((col) => (
            <div key={col.key} className="bg-muted/30 border border-border/60 rounded-xl p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.tone}`} />
                  <h4 className="font-display font-semibold text-sm text-foreground">{col.label}</h4>
                </div>
                <span className="text-[11px] font-medium text-muted-foreground bg-background border border-border/60 rounded-full px-2 py-0.5">
                  {projectsByStatus[col.key].length}
                </span>
              </div>
              <div className="space-y-2.5">
                {projectsByStatus[col.key].map((p) => (
                  <div key={p.id} className="bg-background border border-border/60 rounded-lg p-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="icon-container icon-container-sm bg-primary/10 shrink-0">
                        <FolderKanban size={14} className="text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h5 className="font-medium text-foreground text-[13px] leading-snug truncate">{p.nome}</h5>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{p.softwares?.nome} · {p.protocolo}</p>
                      </div>
                    </div>
                    {p.projeto_fases && p.projeto_fases.length > 0 && (
                      <div className="mb-2.5">{renderProgress(p)}</div>
                    )}
                    {(p.status === "publicado" || p.status === "em_selecao" || p.status === "em_andamento" || p.status === "concluido") && (
                      <div className="flex flex-wrap gap-1">
                        {p.status !== "concluido" && renderPropostasButton(p, true)}
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setEditProjeto(p)}>
                          <Pencil size={11} /> Editar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjetoEditDialog
        open={!!editProjeto}
        onOpenChange={(o) => { if (!o) setEditProjeto(null); }}
        projeto={editProjeto}
        onSaved={() => { refetch(); }}
      />

      <Dialog open={novoProjetoOpen} onOpenChange={setNovoProjetoOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Novo Projeto</DialogTitle>
          </DialogHeader>
          <EmpresaNovoProjeto
            embedded
            onSuccess={() => { setNovoProjetoOpen(false); refetch(); }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Respostas — {selectedProjeto?.nome}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {propostas.length} proposta{propostas.length === 1 ? "" : "s"} de consultor autônomo · {respostasParceiros.length} resposta{respostasParceiros.length === 1 ? "" : "s"} de parceiro
            </p>
          </DialogHeader>
          {propostas.length === 0 && respostasParceiros.length === 0 ? (
            <EmptyState message="Nenhuma resposta recebida ainda" icon={User} />
          ) : (
            <div className="space-y-3">
              {respostasParceiros.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Respostas de parceiros</h4>
                  {respostasParceiros.map((resp) => {
                    const isOpen = expandedRespostas[resp.id] !== false;
                    const ativas = resp.indicacoes.filter((i: any) => i.status !== "retirado");
                    return (
                      <div key={resp.id} className="border border-primary/30 rounded-xl bg-primary/5">
                        <button
                          type="button"
                          onClick={() => setExpandedRespostas((prev) => ({ ...prev, [resp.id]: !isOpen }))}
                          className="w-full flex items-center justify-between gap-3 p-3 text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                              Parceiro
                            </span>
                            <span className="text-sm font-medium text-foreground truncate">{resp.canal?.nome || "Canal"}</span>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              · {ativas.length} indicaç{ativas.length === 1 ? "ão" : "ões"}
                            </span>
                          </div>
                          <ChevronRight size={14} className={cn("transition-transform", isOpen && "rotate-90")} />
                        </button>
                        {isOpen && (
                          <div className="border-t border-primary/20 p-3 space-y-2">
                            {resp.comentarios && (
                              <p className="text-xs text-muted-foreground italic">"{resp.comentarios}"</p>
                            )}
                            {ativas.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Nenhum consultor ativo nesta resposta.</p>
                            ) : ativas.map((ind: any) => (
                              <div key={ind.id} className="border border-border/60 rounded-lg p-3 bg-background">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
                                      {ind.consultor?.nome?.charAt(0) || "C"}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">{ind.consultor?.nome || "Consultor"}</p>
                                      {ind.consultor?.cidade && (
                                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                          <MapPin size={10} /> {ind.consultor.cidade}{ind.consultor.estado && `, ${ind.consultor.estado}`}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {ind.status === "selecionado" ? (
                                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/15 text-success">
                                      Selecionado
                                    </span>
                                  ) : ind.status === "recusado" ? (
                                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                      Não selecionado
                                    </span>
                                  ) : null}
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <div className="rounded-lg border border-border/60 bg-muted/20 p-2">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor proposto</p>
                                    <p className="text-sm font-bold text-foreground mt-0.5 flex items-center gap-1">
                                      <DollarSign size={12} /> {ind.valor_proposto ? `R$ ${Number(ind.valor_proposto).toLocaleString("pt-BR")}` : "—"}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-border/60 bg-muted/20 p-2">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Titularidade</p>
                                    <p className="text-sm font-medium text-foreground mt-0.5 truncate">{resp.canal?.nome || "Parceiro"}</p>
                                  </div>
                                </div>
                                {ind.observacao && (
                                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{ind.observacao}</p>
                                )}
                                {ind.status === "indicado" && (selectedProjeto?.status === "publicado" || selectedProjeto?.status === "em_selecao") && (
                                  <div className="mt-3">
                                    <Button size="sm" onClick={() => selectIndicacao(ind.id, ind.consultor?.nome)}>
                                      <CheckCircle2 size={14} /> Selecionar
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {propostas.length > 0 && (
                <>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">Propostas diretas</h4>

              <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Select value={propostaStatusFilter} onValueChange={setPropostaStatusFilter}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      {PROPOSTA_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {renderDateFilter("Data inicial", propostaDataInicio, setPropostaDataInicio)}
                  {renderDateFilter("Data final", propostaDataFim, setPropostaDataFim)}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {propostasFiltradas.length} de {propostas.length} propostas
                  </p>
                  {(propostaStatusFilter !== "all" || propostaDataInicio || propostaDataFim) && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setPropostaStatusFilter("all"); setPropostaDataInicio(undefined); setPropostaDataFim(undefined); }}>
                      <X size={12} /> Limpar filtros
                    </Button>
                  )}
                </div>
              </div>

              {propostasFiltradas.length === 0 ? (
                <EmptyState message="Nenhuma proposta encontrada com os filtros atuais" icon={Search} />
              ) : propostasPaginadas.map((prop) => (
                <div key={prop.id} className="border border-border/60 rounded-xl p-4 bg-muted/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground text-xs font-semibold">
                        {prop.consultor?.nome?.charAt(0) || "C"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{prop.consultor?.nome}</p>
                        {prop.consultor?.cidade && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <MapPin size={10} /> {prop.consultor.cidade}{prop.consultor.estado && `, ${prop.consultor.estado}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Consultor autônomo
                      </span>
                      <StatusBadge status={prop.status} />
                    </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 mb-2">
                    <div className="rounded-lg border border-border/60 bg-background p-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor da proposta</p>
                      <p className="text-sm font-bold text-foreground mt-0.5 flex items-center gap-1">
                        <DollarSign size={12} /> {prop.valor_proposta ? `R$ ${Number(prop.valor_proposta).toLocaleString("pt-BR")}` : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background p-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Prazo de entrega</p>
                      <p className="text-sm font-bold text-foreground mt-0.5 flex items-center gap-1">
                        <CalendarIcon size={12} /> {prop.prazo_entrega_dias ? `${prop.prazo_entrega_dias} dia${prop.prazo_entrega_dias === 1 ? "" : "s"}` : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background p-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Esforço</p>
                      <p className="text-sm font-bold text-foreground mt-0.5 flex items-center gap-1">
                        <Clock size={12} /> {prop.estimativa_horas ? `${prop.estimativa_horas}h` : "—"}
                      </p>
                    </div>
                  </div>
                  {prop.comentarios && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{prop.comentarios}</p>}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(prop.status === "enviada" || prop.status === "contraproposta_consultor") && (
                      <Button size="sm" variant="outline" onClick={() => preApproveProposal(prop.id)}>
                        <BadgeCheck size={14} /> {prop.status === "contraproposta_consultor" ? "Pré-aprovar contraproposta" : "Pré-aprovar"}
                      </Button>
                    )}
                    {(prop.status === "enviada" || prop.status === "pre_aprovada" || prop.status === "contraproposta_consultor") && (
                      <Button size="sm" onClick={() => acceptProposal(prop.id)}>
                        <CheckCircle2 size={14} /> Aprovação final
                      </Button>
                    )}
                    {(prop.status === "enviada" || prop.status === "pre_aprovada" || prop.status === "contraproposta_consultor") && (
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => rejectProposal(prop.id)}>
                        <XCircle size={14} /> Recusar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {propostaTotalPages > 1 && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-xs text-muted-foreground">
                    Página {propostaCurrentPage} de {propostaTotalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" disabled={propostaCurrentPage === 1} onClick={() => setPropostaPage((p) => Math.max(1, p - 1))}>
                      <ChevronLeft size={14} /> Anterior
                    </Button>
                    <Button size="sm" variant="outline" disabled={propostaCurrentPage === propostaTotalPages} onClick={() => setPropostaPage((p) => Math.min(propostaTotalPages, p + 1))}>
                      Próxima <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
                </>
              )}
              <div className="border-t border-border pt-3 mt-4">

                <h4 className="text-sm font-semibold text-foreground mb-2">Histórico de visualização</h4>
                {visualizacoesHistorico.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma visualização auditada ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {visualizacoesHistorico.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{item.visualizador_nome}</p>
                          <p className="text-[11px] text-muted-foreground">marcou proposta como visualizada</p>
                        </div>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {new Date(item.visualizado_em).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmpresaProjetos;
