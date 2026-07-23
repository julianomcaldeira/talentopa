import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader, DataCard, StatusBadge, EmptyState, LoadingState } from "@/components/dashboard/DashboardComponents";
import { FolderKanban, Send, Calendar, Target, Star, MessageSquare, Eye, MapPin, Filter, X, Bookmark, BookmarkPlus, Trash2, Clock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProjectCommunication } from "@/components/communication/ProjectCommunication";
import { PROJETO_SORT_OPTIONS, sortProjetos, ProjetoSortKey } from "@/lib/projetoSort";
import { ProjetoDetalhesDialog, ModeloContratacaoBadge } from "@/components/projetos/ProjetoDetalhesDialog";
import { CityCombobox, CityOption } from "@/components/projetos/CityCombobox";
import { useScoreConfig } from "@/hooks/useScoreConfig";
import { ViewToggle, ViewMode } from "@/components/ui/view-toggle";

const ConsultorProjetos = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { config: scoreCfg } = useScoreConfig();
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposalDialog, setProposalDialog] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<any>(null);
  const [proposalForm, setProposalForm] = useState({ estimativa_horas: "", valor_proposta: "", prazo_entrega_dias: "", comentarios: "" });
  const [mySkills, setMySkills] = useState<any[]>([]);
  const [projetoScopes, setProjetoScopes] = useState<Map<string, { modulos: string[]; funcs: string[] }>>(new Map());
  const [chatProjeto, setChatProjeto] = useState<any>(null);
  const [myPropostas, setMyPropostas] = useState<Map<string, string>>(new Map());
  const [detalhesProjeto, setDetalhesProjeto] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [canalVinculado, setCanalVinculado] = useState<{ id: string; nome: string } | null>(null);
  const PAGE_SIZE = 5;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: canalId } = await (supabase as any).rpc("consultor_tem_vinculo_ativo", { p_consultor: user.id });
      if (!canalId) { setCanalVinculado(null); return; }
      const { data: canal } = await supabase.from("canais").select("id, nome").eq("id", canalId).maybeSingle();
      if (canal) setCanalVinculado({ id: canal.id, nome: canal.nome });
    })();
  }, [user]);

  // Filter options
  const [softwares, setSoftwares] = useState<{ id: string; nome: string }[]>([]);
  const [modulos, setModulos] = useState<{ id: string; nome: string; software_id: string }[]>([]);
  const [empresaSegmentos, setEmpresaSegmentos] = useState<Map<string, string>>(new Map()); // empresa_user_id -> segmento

  // Filters
  const [filterCity, setFilterCity] = useState<CityOption | null>(null);
  const [filterSoftware, setFilterSoftware] = useState<string>("all");
  const [filterModulo, setFilterModulo] = useState<string>("all");
  const [filterSegmento, setFilterSegmento] = useState<string>("all");
  const [onlyCompatible, setOnlyCompatible] = useState(false);
  const [sortBy, setSortBy] = useState<"match" | import("@/lib/projetoSort").ProjetoSortKey>("match");

  // Saved searches
  type SavedSearch = { id: string; nome: string; filtros: any };
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  // Default city from logged consultor profile
  useEffect(() => {
    if (profile?.cidade && profile?.estado && !filterCity) {
      setFilterCity({ cidade: profile.cidade, estado: profile.estado });
    }
  }, [profile]);

  // Load saved searches
  const fetchSavedSearches = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("consultor_buscas_favoritas")
      .select("id, nome, filtros")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setSavedSearches(data);
  };

  useEffect(() => { fetchSavedSearches(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [projRes, skillsRes, propRes, swRes, modRes] = await Promise.all([
        supabase.from("projetos")
          .select("*, softwares(nome)")
          .in("status", ["publicado", "em_selecao"])
          .order("created_at", { ascending: false }),
        supabase.from("consultor_habilidades")
          .select("software_id, modulo_id, funcionalidade_id, nivel")
          .eq("user_id", user.id),
        supabase.from("propostas")
          .select("projeto_id, status")
          .eq("consultor_user_id", user.id),
        supabase.from("softwares").select("id, nome").order("nome"),
        supabase.from("modulos").select("id, nome, software_id").order("nome"),
      ]);

      const projs = projRes.data || [];
      if (skillsRes.data) setMySkills(skillsRes.data);
      if (propRes.data) setMyPropostas(new Map(propRes.data.map(p => [p.projeto_id, p.status as string])));
      if (swRes.data) setSoftwares(swRes.data);
      if (modRes.data) setModulos(modRes.data);

      if (projs.length > 0) {
        const projIds = projs.map(p => p.id);
        const empresaIds = [...new Set(projs.map(p => p.empresa_user_id))];
        const [pmRes, pfRes, empRes, empPerfilRes] = await Promise.all([
          supabase.from("projeto_modulos").select("projeto_id, modulo_id").in("projeto_id", projIds),
          supabase.from("projeto_funcionalidades").select("projeto_id, funcionalidade_id").in("projeto_id", projIds),
          supabase.from("profiles_public" as any).select("user_id, nome, cidade, estado").in("user_id", empresaIds),
          supabase.from("empresa_perfil_public" as any).select("user_id, segmento").in("user_id", empresaIds),
        ]);
        const scopeMap = new Map<string, { modulos: string[]; funcs: string[] }>();
        projIds.forEach(id => scopeMap.set(id, { modulos: [], funcs: [] }));
        (pmRes.data || []).forEach(m => scopeMap.get(m.projeto_id)?.modulos.push(m.modulo_id));
        (pfRes.data || []).forEach(f => scopeMap.get(f.projeto_id)?.funcs.push(f.funcionalidade_id));
        setProjetoScopes(scopeMap);

        const empMap = new Map(((empRes.data as any[]) || []).map((e: any) => [e.user_id, e]));
        const empPerfilMap = new Map(((empPerfilRes.data as any[]) || []).map((e: any) => [e.user_id, e]));
        const segMap = new Map<string, string>();
        ((empPerfilRes.data as any[]) || []).forEach((e: any) => { if (e.segmento) segMap.set(e.user_id, e.segmento); });
        setEmpresaSegmentos(segMap);

        projs.forEach(p => {
          const prof: any = empMap.get(p.empresa_user_id);
          const perfil: any = empPerfilMap.get(p.empresa_user_id);
          (p as any).empresa_nome = prof?.nome || "Empresa";
          (p as any).local_cidade = prof?.cidade || null;
          (p as any).local_estado = prof?.estado || null;
          (p as any).empresa_segmento = perfil?.segmento || null;
        });
      }

      setProjetos(projs);
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  const handleProposal = async () => {
    if (!user || !selectedProjeto) return;
    const { error } = await supabase.from("propostas").insert({
      projeto_id: selectedProjeto.id, consultor_user_id: user.id,
      estimativa_horas: Number(proposalForm.estimativa_horas) || null,
      valor_proposta: Number(proposalForm.valor_proposta) || null,
      prazo_entrega_dias: Number(proposalForm.prazo_entrega_dias) || null,
      comentarios: proposalForm.comentarios || null,
    } as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Proposta enviada com sucesso!" });
    setProposalDialog(false);
    setProposalForm({ estimativa_horas: "", valor_proposta: "", prazo_entrega_dias: "", comentarios: "" });
  };

  const getMatchScore = (projeto: any): number => {
    if (!projeto.software_id || mySkills.length === 0) return 0;
    const relevantSkills = mySkills.filter(s => s.software_id === projeto.software_id);
    if (relevantSkills.length === 0) return 0;

    // Pesos vindos do admin (score_config)
    let score = scoreCfg.match_software;
    const scope = projetoScopes.get(projeto.id);
    if (scope) {
      if (scope.modulos.length > 0) {
        const matched = relevantSkills.filter(s => s.modulo_id && scope.modulos.includes(s.modulo_id)).length;
        score += Math.round((matched / scope.modulos.length) * scoreCfg.match_modulos);
      }
      if (scope.funcs.length > 0) {
        const matched = relevantSkills.filter(s => s.funcionalidade_id && scope.funcs.includes(s.funcionalidade_id)).length;
        score += Math.round((matched / scope.funcs.length) * scoreCfg.match_funcionalidades);
      }
    }
    const nivelW: Record<string, number> = { junior: 1, pleno: 2, senior: 3, especialista: 4 };
    const maxN = Math.max(...relevantSkills.map(s => nivelW[s.nivel] || 1));
    score += Math.round((maxN / 4) * scoreCfg.match_senioridade);
    return Math.min(score, 100);
  };

  const scoreColor = (s: number) => s >= 75 ? "text-success" : s >= 50 ? "text-warning" : "text-muted-foreground";
  const scoreBg = (s: number) => s >= 75 ? "bg-success/10 border-success/20" : s >= 50 ? "bg-warning/10 border-warning/20" : "bg-muted/50 border-border";
  const formatDateTime = (value: string) => new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const formatDeadline = (value: string) => new Date(`${value}T23:59:59`).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  // Apply filters
  const filteredProjetos = useMemo(() => {
    return projetos.filter(p => {
      if (filterCity) {
        if ((p.local_cidade || "").toLowerCase() !== filterCity.cidade.toLowerCase()
          || (p.local_estado || "").toUpperCase() !== filterCity.estado.toUpperCase()) return false;
      }
      if (filterSoftware !== "all" && p.software_id !== filterSoftware) return false;
      if (filterModulo !== "all") {
        const scope = projetoScopes.get(p.id);
        if (!scope || !scope.modulos.includes(filterModulo)) return false;
      }
      if (filterSegmento !== "all" && p.empresa_segmento !== filterSegmento) return false;
      if (onlyCompatible && getMatchScore(p) <= 50) return false;
      return true;
    });
  }, [projetos, filterCity, filterSoftware, filterModulo, filterSegmento, onlyCompatible, projetoScopes, mySkills]);

  const sortedProjetos = useMemo(() => {
    if (sortBy === "match") {
      return [...filteredProjetos].sort((a, b) => getMatchScore(b) - getMatchScore(a));
    }
    return sortProjetos(filteredProjetos, sortBy as ProjetoSortKey);
  }, [filteredProjetos, mySkills, projetoScopes, sortBy]);
  const totalPages = Math.max(1, Math.ceil(sortedProjetos.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedProjetos = sortedProjetos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filterCity, filterSoftware, filterModulo, filterSegmento, onlyCompatible]);

  const segmentosUnicos = useMemo(() => {
    const set = new Set<string>();
    empresaSegmentos.forEach(v => v && set.add(v));
    return [...set].sort();
  }, [empresaSegmentos]);

  const modulosFiltrados = useMemo(() => {
    if (filterSoftware === "all") return modulos;
    return modulos.filter(m => m.software_id === filterSoftware);
  }, [modulos, filterSoftware]);

  // Faceted counts: each filter dimension counts projects passing ALL OTHER filters
  type FilterKey = "city" | "software" | "modulo" | "segmento";
  const matchesExcept = (p: any, except: FilterKey) => {
    if (except !== "city" && filterCity) {
      if ((p.local_cidade || "").toLowerCase() !== filterCity.cidade.toLowerCase()
        || (p.local_estado || "").toUpperCase() !== filterCity.estado.toUpperCase()) return false;
    }
    if (except !== "software" && filterSoftware !== "all" && p.software_id !== filterSoftware) return false;
    if (except !== "modulo" && filterModulo !== "all") {
      const scope = projetoScopes.get(p.id);
      if (!scope || !scope.modulos.includes(filterModulo)) return false;
    }
    if (except !== "segmento" && filterSegmento !== "all" && p.empresa_segmento !== filterSegmento) return false;
    return true;
  };

  const softwareCounts = useMemo(() => {
    const m = new Map<string, number>();
    let all = 0;
    projetos.forEach(p => {
      if (!matchesExcept(p, "software")) return;
      all++;
      if (p.software_id) m.set(p.software_id, (m.get(p.software_id) || 0) + 1);
    });
    return { all, byId: m };
  }, [projetos, filterCity, filterModulo, filterSegmento, projetoScopes]);

  const moduloCounts = useMemo(() => {
    const m = new Map<string, number>();
    let all = 0;
    projetos.forEach(p => {
      if (!matchesExcept(p, "modulo")) return;
      all++;
      const scope = projetoScopes.get(p.id);
      scope?.modulos.forEach(modId => m.set(modId, (m.get(modId) || 0) + 1));
    });
    return { all, byId: m };
  }, [projetos, filterCity, filterSoftware, filterSegmento, projetoScopes]);

  const segmentoCounts = useMemo(() => {
    const m = new Map<string, number>();
    let all = 0;
    projetos.forEach(p => {
      if (!matchesExcept(p, "segmento")) return;
      all++;
      if (p.empresa_segmento) m.set(p.empresa_segmento, (m.get(p.empresa_segmento) || 0) + 1);
    });
    return { all, byId: m };
  }, [projetos, filterCity, filterSoftware, filterModulo, projetoScopes]);

  const cityCount = useMemo(() => {
    if (!filterCity) return 0;
    return projetos.filter(p => matchesExcept(p, "city")
      && (p.local_cidade || "").toLowerCase() === filterCity.cidade.toLowerCase()
      && (p.local_estado || "").toUpperCase() === filterCity.estado.toUpperCase()
    ).length;
  }, [projetos, filterCity, filterSoftware, filterModulo, filterSegmento, projetoScopes]);

  const hasActiveFilters = filterCity || filterSoftware !== "all" || filterModulo !== "all" || filterSegmento !== "all" || onlyCompatible;

  const clearFilters = () => {
    setFilterCity(null);
    setFilterSoftware("all");
    setFilterModulo("all");
    setFilterSegmento("all");
    setOnlyCompatible(false);
  };

  const handleSaveSearch = async () => {
    if (!user || !saveName.trim()) return;
    const filtros = {
      city: filterCity,
      software: filterSoftware,
      modulo: filterModulo,
      segmento: filterSegmento,
      onlyCompatible,
    };
    const { error } = await (supabase as any)
      .from("consultor_buscas_favoritas")
      .insert({ user_id: user.id, nome: saveName.trim(), filtros });
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Busca salva!", description: `"${saveName.trim()}" foi adicionada às suas favoritas.` });
    setSaveName("");
    setSaveDialogOpen(false);
    fetchSavedSearches();
  };

  const applySavedSearch = (s: SavedSearch) => {
    const f = s.filtros || {};
    setFilterCity(f.city || null);
    setFilterSoftware(f.software || "all");
    setFilterModulo(f.modulo || "all");
    setFilterSegmento(f.segmento || "all");
    setOnlyCompatible(!!f.onlyCompatible);
    toast({ title: "Busca aplicada", description: s.nome });
  };

  const deleteSavedSearch = async (id: string, nome: string) => {
    const { error } = await (supabase as any).from("consultor_buscas_favoritas").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Busca removida", description: nome });
    fetchSavedSearches();
  };

  return (
    <div>
      <PageHeader title="Projetos Disponíveis" description="Encontre projetos compatíveis com seu perfil técnico" />

      {canalVinculado && (
        <DataCard className="mb-4 border-primary/30 bg-primary/5">
          <p className="text-sm text-foreground">
            Você está vinculado ao parceiro <strong>{canalVinculado.nome}</strong>. As demandas da plataforma são recebidas e respondidas por ele. Acompanhe suas indicações em <strong>Minhas Indicações</strong>.
          </p>
        </DataCard>
      )}


      {/* Filters */}
      <DataCard className="mb-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Filter size={14} className="text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros</h3>
          <div className="ml-auto flex items-center gap-2">
            {savedSearches.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Bookmark size={12} /> Buscas favoritas ({savedSearches.length})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel className="text-xs">Aplicar busca salva</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {savedSearches.map(s => (
                    <DropdownMenuItem key={s.id} className="flex items-center justify-between gap-2 cursor-pointer" onSelect={(e) => e.preventDefault()}>
                      <button onClick={() => applySavedSearch(s)} className="flex-1 text-left text-xs truncate">{s.nome}</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSavedSearch(s.id, s.nome); }}
                        className="text-muted-foreground hover:text-destructive p-1"
                        title="Remover"
                      >
                        <Trash2 size={12} />
                      </button>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {hasActiveFilters && (
              <>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSaveDialogOpen(true)}>
                  <BookmarkPlus size={12} /> Salvar busca
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                  <X size={12} /> Limpar
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cidade</Label>
            <CityCombobox value={filterCity} onChange={setFilterCity} count={filterCity ? cityCount : undefined} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Linha de Produto</Label>
            <Select value={filterSoftware} onValueChange={(v) => { setFilterSoftware(v); setFilterModulo("all"); }}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as linhas ({softwareCounts.all})</SelectItem>
                {softwares.map(s => {
                  const c = softwareCounts.byId.get(s.id) || 0;
                  return <SelectItem key={s.id} value={s.id} disabled={c === 0 && filterSoftware !== s.id}>{s.nome} ({c})</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Módulo</Label>
            <Select value={filterModulo} onValueChange={setFilterModulo}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos ({moduloCounts.all})</SelectItem>
                {modulosFiltrados.map(m => {
                  const c = moduloCounts.byId.get(m.id) || 0;
                  return <SelectItem key={m.id} value={m.id} disabled={c === 0 && filterModulo !== m.id}>{m.nome} ({c})</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Segmento</Label>
            <Select value={filterSegmento} onValueChange={setFilterSegmento}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os segmentos ({segmentoCounts.all})</SelectItem>
                {segmentosUnicos.map(s => {
                  const c = segmentoCounts.byId.get(s) || 0;
                  return <SelectItem key={s} value={s} disabled={c === 0 && filterSegmento !== s}>{s} ({c})</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-3 flex-wrap">
          <Switch id="only-compatible" checked={onlyCompatible} onCheckedChange={setOnlyCompatible} />
          <Label htmlFor="only-compatible" className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5">
            <Star size={12} className="text-success" />
            Apenas projetos compatíveis com minhas habilidades
            <span className="text-muted-foreground font-normal">(match &gt; 50%)</span>
          </Label>
          <div className="ml-auto flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Ordenar por</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-8 w-52 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="match">Maior compatibilidade</SelectItem>
                {PROJETO_SORT_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DataCard>

      {/* View toggle */}
      {!loading && sortedProjetos.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground">
            {sortedProjetos.length} projeto{sortedProjetos.length > 1 ? "s" : ""} encontrado{sortedProjetos.length > 1 ? "s" : ""}
          </p>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      )}

      {(() => {
        const renderCard = (p: any, compact = false) => {
          const score = getMatchScore(p);
          return (
            <DataCard key={p.id} className={compact ? "p-3.5" : ""}>
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="icon-container icon-container-md bg-primary/10 mt-0.5 shrink-0">
                    <FolderKanban size={16} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display font-semibold text-foreground text-sm truncate">{p.nome}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {p.softwares?.nome} · {myPropostas.get(p.id) === "aceita" ? (p.empresa_nome || "Empresa") : "Empresa confidencial"} · {p.protocolo}
                    </p>
                  </div>
                </div>
                {!compact && (
                  <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                    <ModeloContratacaoBadge modelo={p.modelo_contratacao} />
                    {score > 0 && (
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${scoreBg(score)} ${scoreColor(score)}`}>
                        <Star size={12} /> {score}% match
                      </div>
                    )}
                    <StatusBadge status={p.status} labels={{ publicado: "Aberto", em_selecao: "Em seleção" }} />
                  </div>
                )}
              </div>

              {compact && score > 0 && (
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold mb-2 ${scoreBg(score)} ${scoreColor(score)}`}>
                  <Star size={10} /> {score}% match
                </div>
              )}

              {p.descricao && !compact && <p className="text-sm text-muted-foreground mb-3 pl-[50px]">{p.descricao}</p>}

              <div className={`flex flex-wrap gap-1.5 mb-3 ${compact ? "" : "pl-[50px]"}`}>
                {(p.local_cidade || p.local_estado) && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-md">
                    <MapPin size={10} />
                    {[p.local_cidade, p.local_estado].filter(Boolean).join(" / ")}
                  </span>
                )}
                {p.empresa_segmento && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                    {p.empresa_segmento}
                  </span>
                )}
                {!compact && p.objetivo && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg">
                    <Target size={12} /> {p.objetivo.substring(0, 60)}{p.objetivo.length > 60 ? "..." : ""}
                  </span>
                )}
                {p.prazo_estimado && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                    <Calendar size={10} /> {new Date(p.prazo_estimado).toLocaleDateString("pt-BR")}
                  </span>
                )}
                {p.created_at && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                    <Clock size={10} /> Publicado em {formatDateTime(p.created_at)}
                  </span>
                )}
                {p.prazo_propostas && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-md">
                    <Calendar size={10} /> Retorno até {formatDeadline(p.prazo_propostas)}
                  </span>
                )}
              </div>

              <div className={`flex gap-1.5 flex-wrap ${compact ? "" : "pl-[50px]"}`}>
                <Button variant="outline" size="sm" onClick={() => setDetalhesProjeto(p)}>
                  <Eye size={12} /> Detalhes
                </Button>
                {!myPropostas.has(p.id) && (
                  <Button size="sm" onClick={() => { setSelectedProjeto(p); setProposalDialog(true); }}>
                    <Send size={12} /> {compact ? "Proposta" : "Enviar proposta"}
                  </Button>
                )}
                {myPropostas.has(p.id) && (
                  <Button variant="outline" size="sm" onClick={() => setChatProjeto(chatProjeto?.id === p.id ? null : p)}>
                    <MessageSquare size={12} /> {compact ? "Chat" : "Comunicação"}
                  </Button>
                )}
              </div>
              {chatProjeto?.id === p.id && (
                <div className={`mt-3 ${compact ? "" : "pl-[50px]"}`}>
                  <ProjectCommunication projetoId={p.id} projetoNome={p.nome} isEmpresa={false} />
                </div>
              )}
            </DataCard>
          );
        };

        if (loading) return <DataCard><LoadingState /></DataCard>;
        if (sortedProjetos.length === 0)
          return <DataCard><EmptyState message={projetos.length === 0 ? "Nenhum projeto disponível no momento" : "Nenhum projeto corresponde aos filtros aplicados"} icon={FolderKanban} /></DataCard>;

        if (viewMode === "kanban") {
          const columns = [
            { key: "publicado", label: "Aberto", color: "bg-info", items: sortedProjetos.filter(p => p.status === "publicado" && !myPropostas.has(p.id)) },
            { key: "em_selecao", label: "Em seleção", color: "bg-warning", items: sortedProjetos.filter(p => p.status === "em_selecao" && !myPropostas.has(p.id)) },
            { key: "minhas", label: "Minhas propostas", color: "bg-primary", items: sortedProjetos.filter(p => myPropostas.has(p.id)) },
          ];
          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {columns.map(col => (
                <div key={col.key} className="bg-muted/30 border border-border/60 rounded-xl p-3 min-h-[200px]">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.color}`} />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">{col.label}</h4>
                    </div>
                    <span className="text-[11px] font-bold text-muted-foreground bg-background px-2 py-0.5 rounded-md border border-border/60">
                      {col.items.length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {col.items.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic text-center py-6">Nenhum projeto</p>
                    ) : (
                      col.items.map(p => renderCard(p, true))
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {pagedProjetos.map(p => renderCard(p, false))}
          </div>
        );
      })()}

      {!loading && viewMode === "list" && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 px-1">
          <p className="text-xs text-muted-foreground">
            Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sortedProjetos.length)} de {sortedProjetos.length} projetos
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
              Anterior
            </Button>
            <span className="text-xs font-semibold text-foreground px-2">Página {currentPage} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}

      <Dialog open={proposalDialog} onOpenChange={setProposalDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Enviar Proposta</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/40 rounded-xl p-3 mb-2">
            <p className="text-sm font-medium text-foreground">{selectedProjeto?.nome}</p>
            <p className="text-xs text-muted-foreground">{selectedProjeto?.softwares?.nome}</p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estimativa de horas</Label>
                <Input type="number" value={proposalForm.estimativa_horas} onChange={(e) => setProposalForm({ ...proposalForm, estimativa_horas: e.target.value })} placeholder="120" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
                <Input type="number" value={proposalForm.valor_proposta} onChange={(e) => setProposalForm({ ...proposalForm, valor_proposta: e.target.value })} placeholder="36000" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prazo entrega (dias)</Label>
                <Input type="number" value={proposalForm.prazo_entrega_dias} onChange={(e) => setProposalForm({ ...proposalForm, prazo_entrega_dias: e.target.value })} placeholder="45" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comentários técnicos</Label>
              <Textarea value={proposalForm.comentarios} onChange={(e) => setProposalForm({ ...proposalForm, comentarios: e.target.value })} rows={4} placeholder="Descreva sua abordagem, experiência relevante e diferenciais..." />
            </div>
            <Button className="w-full" onClick={handleProposal}>
              <Send size={14} /> Enviar proposta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Salvar busca favorita</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Salve esta combinação de filtros para reaplicá-la com um clique depois.
            </p>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome da busca</Label>
              <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Ex: SAP em São Paulo" autoFocus />
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-foreground mb-1">Filtros atuais:</p>
              {filterCity && <p>📍 {filterCity.cidade} / {filterCity.estado}</p>}
              {filterSoftware !== "all" && <p>💻 {softwares.find(s => s.id === filterSoftware)?.nome}</p>}
              {filterModulo !== "all" && <p>📦 {modulos.find(m => m.id === filterModulo)?.nome}</p>}
              {filterSegmento !== "all" && <p>🏢 {filterSegmento}</p>}
              {onlyCompatible && <p>⭐ Apenas compatíveis (match &gt; 50%)</p>}
              {!hasActiveFilters && <p className="text-muted-foreground italic">Nenhum filtro ativo</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveSearch} disabled={!saveName.trim()}>
                <BookmarkPlus size={14} /> Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProjetoDetalhesDialog
        projeto={detalhesProjeto}
        open={!!detalhesProjeto}
        onOpenChange={(v) => !v && setDetalhesProjeto(null)}
        showEmpresa={detalhesProjeto ? myPropostas.get(detalhesProjeto.id) === "aceita" : false}
      />
    </div>
  );
};

export default ConsultorProjetos;
