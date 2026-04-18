import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, DataCard, StatusBadge, EmptyState, LoadingState } from "@/components/dashboard/DashboardComponents";
import { ViewToggle, ViewMode } from "@/components/ui/view-toggle";
import { FolderKanban, Eye, MapPin, Clock, DollarSign, User, MessageSquare, Pencil, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { ConsultorMatchList } from "@/components/matching/ConsultorMatchList";
import { ProjectCommunication } from "@/components/communication/ProjectCommunication";
import { ProjetoEditDialog } from "@/components/projetos/ProjetoEditDialog";

const PAGE_SIZE = 6;

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
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjeto, setSelectedProjeto] = useState<any>(null);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chatProjeto, setChatProjeto] = useState<any>(null);
  const [editProjeto, setEditProjeto] = useState<any>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const refetch = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("projetos")
      .select("*, softwares(nome), projeto_fases(id, nome, status, valor)")
      .eq("empresa_user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setProjetos(data);
  };

  useEffect(() => {
    if (!user) return;
    refetch().then(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projetos.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.nome?.toLowerCase().includes(q) ||
        p.protocolo?.toLowerCase().includes(q) ||
        p.softwares?.nome?.toLowerCase().includes(q)
      );
    });
  }, [projetos, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  useEffect(() => { setPage(1); }, [search, statusFilter, view]);

  const viewPropostas = async (projeto: any) => {
    setSelectedProjeto(projeto);
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
    setDialogOpen(true);
  };

  const acceptProposal = async (propostaId: string) => {
    await supabase.from("propostas").update({ status: "aceita" as const }).eq("id", propostaId);
    if (selectedProjeto) {
      await supabase.from("projetos").update({ status: "em_andamento" as const }).eq("id", selectedProjeto.id);
    }
    setDialogOpen(false);
    refetch();
  };

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
    (p.status === "publicado" || p.status === "em_selecao" || p.status === "em_andamento") && (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => viewPropostas(p)}>
          <Eye size={14} /> Ver propostas
        </Button>
        <Button size="sm" variant="outline" onClick={() => setChatProjeto(chatProjeto?.id === p.id ? null : p)}>
          <MessageSquare size={14} /> Comunicação
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditProjeto(p)}>
          <Pencil size={14} /> Editar
        </Button>
      </div>
    )
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
      <PageHeader title="Meus Projetos" description="Acompanhe e gerencie todos os seus projetos" />

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
                    <ConsultorMatchList projetoId={p.id} projetoNome={p.nome} softwareId={p.software_id} />
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
                    {(p.status === "publicado" || p.status === "em_selecao" || p.status === "em_andamento") && (
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => viewPropostas(p)}>
                          <Eye size={11} /> Propostas
                        </Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Propostas — {selectedProjeto?.nome}</DialogTitle>
          </DialogHeader>
          {propostas.length === 0 ? (
            <EmptyState message="Nenhuma proposta recebida ainda" icon={User} />
          ) : (
            <div className="space-y-3">
              {propostas.map((prop) => (
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
                    <StatusBadge status={prop.status} />
                  </div>
                  <div className="flex items-center gap-4 mt-3 mb-2">
                    {prop.estimativa_horas && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={12} /> {prop.estimativa_horas}h
                      </span>
                    )}
                    {prop.valor_proposta && (
                      <span className="text-xs text-foreground font-medium flex items-center gap-1">
                        <DollarSign size={12} /> R$ {Number(prop.valor_proposta).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>
                  {prop.comentarios && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{prop.comentarios}</p>}
                  {prop.status === "enviada" && (
                    <Button size="sm" className="mt-3" onClick={() => acceptProposal(prop.id)}>
                      Aceitar proposta
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmpresaProjetos;
