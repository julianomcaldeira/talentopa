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
import { PageHeader, DataCard, StatusBadge, EmptyState, LoadingState } from "@/components/dashboard/DashboardComponents";
import { FolderKanban, Send, Calendar, Target, Star, MessageSquare, Eye, MapPin, Filter, X } from "lucide-react";
import { ProjectCommunication } from "@/components/communication/ProjectCommunication";
import { ProjetoDetalhesDialog, ModeloContratacaoBadge } from "@/components/projetos/ProjetoDetalhesDialog";
import { CityCombobox, CityOption } from "@/components/projetos/CityCombobox";

const ConsultorProjetos = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposalDialog, setProposalDialog] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<any>(null);
  const [proposalForm, setProposalForm] = useState({ estimativa_horas: "", valor_proposta: "", comentarios: "" });
  const [mySkills, setMySkills] = useState<any[]>([]);
  const [projetoScopes, setProjetoScopes] = useState<Map<string, { modulos: string[]; funcs: string[] }>>(new Map());
  const [chatProjeto, setChatProjeto] = useState<any>(null);
  const [myPropostas, setMyPropostas] = useState<Map<string, string>>(new Map());
  const [detalhesProjeto, setDetalhesProjeto] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  // Filter options
  const [softwares, setSoftwares] = useState<{ id: string; nome: string }[]>([]);
  const [modulos, setModulos] = useState<{ id: string; nome: string; software_id: string }[]>([]);
  const [empresaSegmentos, setEmpresaSegmentos] = useState<Map<string, string>>(new Map()); // empresa_user_id -> segmento

  // Filters
  const [filterCity, setFilterCity] = useState<CityOption | null>(null);
  const [filterSoftware, setFilterSoftware] = useState<string>("all");
  const [filterModulo, setFilterModulo] = useState<string>("all");
  const [filterSegmento, setFilterSegmento] = useState<string>("all");

  // Default city from logged consultor profile
  useEffect(() => {
    if (profile?.cidade && profile?.estado && !filterCity) {
      setFilterCity({ cidade: profile.cidade, estado: profile.estado });
    }
  }, [profile]);

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
          supabase.from("profiles").select("user_id, nome, cidade, estado").in("user_id", empresaIds),
          supabase.from("empresa_perfil").select("user_id, endereco, segmento").in("user_id", empresaIds),
        ]);
        const scopeMap = new Map<string, { modulos: string[]; funcs: string[] }>();
        projIds.forEach(id => scopeMap.set(id, { modulos: [], funcs: [] }));
        (pmRes.data || []).forEach(m => scopeMap.get(m.projeto_id)?.modulos.push(m.modulo_id));
        (pfRes.data || []).forEach(f => scopeMap.get(f.projeto_id)?.funcs.push(f.funcionalidade_id));
        setProjetoScopes(scopeMap);

        const empMap = new Map((empRes.data || []).map(e => [e.user_id, e]));
        const empPerfilMap = new Map((empPerfilRes.data || []).map(e => [e.user_id, e]));
        const segMap = new Map<string, string>();
        (empPerfilRes.data || []).forEach(e => { if (e.segmento) segMap.set(e.user_id, e.segmento); });
        setEmpresaSegmentos(segMap);

        projs.forEach(p => {
          const prof = empMap.get(p.empresa_user_id);
          const perfil = empPerfilMap.get(p.empresa_user_id);
          (p as any).empresa_nome = prof?.nome || "Empresa";
          let cidade = prof?.cidade || null;
          let estado = prof?.estado || null;
          if ((!cidade || !estado) && perfil?.endereco) {
            const parts = perfil.endereco.split(",").map((s: string) => s.trim()).filter(Boolean);
            if (!estado && parts.length >= 1) estado = parts[parts.length - 1];
            if (!cidade && parts.length >= 2) cidade = parts[parts.length - 2];
          }
          (p as any).local_cidade = cidade;
          (p as any).local_estado = estado;
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
      comentarios: proposalForm.comentarios || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Proposta enviada com sucesso!" });
    setProposalDialog(false);
    setProposalForm({ estimativa_horas: "", valor_proposta: "", comentarios: "" });
  };

  const getMatchScore = (projeto: any): number => {
    if (!projeto.software_id || mySkills.length === 0) return 0;
    const relevantSkills = mySkills.filter(s => s.software_id === projeto.software_id);
    if (relevantSkills.length === 0) return 0;

    let score = 20;
    const scope = projetoScopes.get(projeto.id);
    if (scope) {
      if (scope.modulos.length > 0) {
        const matched = relevantSkills.filter(s => s.modulo_id && scope.modulos.includes(s.modulo_id)).length;
        score += Math.round((matched / scope.modulos.length) * 40);
      }
      if (scope.funcs.length > 0) {
        const matched = relevantSkills.filter(s => s.funcionalidade_id && scope.funcs.includes(s.funcionalidade_id)).length;
        score += Math.round((matched / scope.funcs.length) * 30);
      }
    }
    const nivelW: Record<string, number> = { junior: 1, pleno: 2, senior: 3, especialista: 4 };
    const maxN = Math.max(...relevantSkills.map(s => nivelW[s.nivel] || 1));
    score += Math.round((maxN / 4) * 10);
    return Math.min(score, 100);
  };

  const scoreColor = (s: number) => s >= 75 ? "text-success" : s >= 50 ? "text-warning" : "text-muted-foreground";
  const scoreBg = (s: number) => s >= 75 ? "bg-success/10 border-success/20" : s >= 50 ? "bg-warning/10 border-warning/20" : "bg-muted/50 border-border";

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
      return true;
    });
  }, [projetos, filterCity, filterSoftware, filterModulo, filterSegmento, projetoScopes]);

  const sortedProjetos = useMemo(() => [...filteredProjetos].sort((a, b) => getMatchScore(b) - getMatchScore(a)), [filteredProjetos, mySkills, projetoScopes]);
  const totalPages = Math.max(1, Math.ceil(sortedProjetos.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedProjetos = sortedProjetos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filterCity, filterSoftware, filterModulo, filterSegmento]);

  const segmentosUnicos = useMemo(() => {
    const set = new Set<string>();
    empresaSegmentos.forEach(v => v && set.add(v));
    return [...set].sort();
  }, [empresaSegmentos]);

  const modulosFiltrados = useMemo(() => {
    if (filterSoftware === "all") return modulos;
    return modulos.filter(m => m.software_id === filterSoftware);
  }, [modulos, filterSoftware]);

  const hasActiveFilters = filterCity || filterSoftware !== "all" || filterModulo !== "all" || filterSegmento !== "all";

  const clearFilters = () => {
    setFilterCity(null);
    setFilterSoftware("all");
    setFilterModulo("all");
    setFilterSegmento("all");
  };

  return (
    <div>
      <PageHeader title="Projetos Disponíveis" description="Encontre projetos compatíveis com seu perfil técnico" />

      {/* Filters */}
      <DataCard className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros</h3>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-7 ml-auto text-xs" onClick={clearFilters}>
              <X size={12} /> Limpar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cidade</Label>
            <CityCombobox value={filterCity} onChange={setFilterCity} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Linha de Produto</Label>
            <Select value={filterSoftware} onValueChange={(v) => { setFilterSoftware(v); setFilterModulo("all"); }}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as linhas</SelectItem>
                {softwares.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Módulo</Label>
            <Select value={filterModulo} onValueChange={setFilterModulo}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                {modulosFiltrados.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Segmento</Label>
            <Select value={filterSegmento} onValueChange={setFilterSegmento}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os segmentos</SelectItem>
                {segmentosUnicos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DataCard>

      {loading ? <DataCard><LoadingState /></DataCard> : sortedProjetos.length === 0 ? (
        <DataCard><EmptyState message={projetos.length === 0 ? "Nenhum projeto disponível no momento" : "Nenhum projeto corresponde aos filtros aplicados"} icon={FolderKanban} /></DataCard>
      ) : (
        <div className="space-y-4">
          {pagedProjetos.map((p) => {
            const score = getMatchScore(p);
            return (
              <DataCard key={p.id}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3.5">
                    <div className="icon-container icon-container-md bg-primary/10 mt-0.5">
                      <FolderKanban size={18} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-foreground text-base">{p.nome}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.softwares?.nome} · {myPropostas.get(p.id) === "aceita" ? (p.empresa_nome || "Empresa") : "Empresa confidencial"} · {p.protocolo}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <ModeloContratacaoBadge modelo={p.modelo_contratacao} />
                    {score > 0 && (
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${scoreBg(score)} ${scoreColor(score)}`}>
                        <Star size={12} />
                        {score}% match
                      </div>
                    )}
                    <StatusBadge status={p.status} labels={{ publicado: "Aberto", em_selecao: "Em seleção" }} />
                  </div>
                </div>

                {p.descricao && <p className="text-sm text-muted-foreground mb-3 pl-[54px]">{p.descricao}</p>}

                <div className="flex flex-wrap gap-3 pl-[54px] mb-4">
                  {(p.local_cidade || p.local_estado) && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary/10 text-primary border border-primary/30 px-2.5 py-1 rounded-lg">
                      <MapPin size={12} />
                      {[p.local_cidade, p.local_estado].filter(Boolean).join(" / ")}
                    </span>
                  )}
                  {p.empresa_segmento && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg">
                      {p.empresa_segmento}
                    </span>
                  )}
                  {p.objetivo && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg">
                      <Target size={12} /> {p.objetivo.substring(0, 60)}{p.objetivo.length > 60 ? "..." : ""}
                    </span>
                  )}
                  {p.prazo_estimado && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg">
                      <Calendar size={12} /> {new Date(p.prazo_estimado).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>

                <div className="pl-[54px] flex gap-2 flex-wrap">
                  <Button variant="outline" onClick={() => setDetalhesProjeto(p)}>
                    <Eye size={14} /> Detalhes
                  </Button>
                  {!myPropostas.has(p.id) && (
                    <Button onClick={() => { setSelectedProjeto(p); setProposalDialog(true); }}>
                      <Send size={14} /> Enviar proposta
                    </Button>
                  )}
                  {myPropostas.has(p.id) && (
                    <Button variant="outline" onClick={() => setChatProjeto(chatProjeto?.id === p.id ? null : p)}>
                      <MessageSquare size={14} /> Comunicação
                    </Button>
                  )}
                </div>
                {chatProjeto?.id === p.id && (
                  <div className="pl-[54px] mt-3">
                    <ProjectCommunication projetoId={p.id} projetoNome={p.nome} isEmpresa={false} />
                  </div>
                )}
              </DataCard>
            );
          })}
        </div>
      )}

      {!loading && totalPages > 1 && (
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estimativa de horas</Label>
                <Input type="number" value={proposalForm.estimativa_horas} onChange={(e) => setProposalForm({ ...proposalForm, estimativa_horas: e.target.value })} placeholder="120" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
                <Input type="number" value={proposalForm.valor_proposta} onChange={(e) => setProposalForm({ ...proposalForm, valor_proposta: e.target.value })} placeholder="36000" />
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
