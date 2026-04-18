import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, DataCard, StatusBadge, EmptyState, LoadingState, StatCard } from "@/components/dashboard/DashboardComponents";
import { Users, Search, Star, FolderKanban, Clock, DollarSign, MapPin, Linkedin, Award, TrendingUp, CheckCircle2, Eye, Briefcase, RotateCcw, Download, FileSpreadsheet, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type ConsultorAgg = {
  user_id: string;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  linkedin?: string | null;
  total_projetos: number;
  projetos_concluidos: number;
  projetos_em_andamento: number;
  total_horas: number;
  valor_total: number;
  nota_media: number | null;
  total_avaliacoes: number;
  recomendacoes: number;
  ultima_contratacao: string | null;
  primeira_contratacao: string | null;
  softwares: string[];
  projetos: Array<{
    id: string;
    nome: string;
    status: string;
    valor: number;
    horas: number;
    nota: number | null;
    aceita_em: string;
    software: string | null;
  }>;
};

const EmpresaConsultoresHistorico = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const recontratar = (c: ConsultorAgg) => {
    navigate(`/empresa/projetos/novo?recontratar=${c.user_id}&nome=${encodeURIComponent(c.nome)}`);
  };
  const [loading, setLoading] = useState(true);
  const [consultores, setConsultores] = useState<ConsultorAgg[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("recente");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ConsultorAgg | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // 1. Pega projetos da empresa
      const { data: projetos } = await supabase
        .from("projetos")
        .select("id, nome, status, software_id, softwares(nome)")
        .eq("empresa_user_id", user.id);

      const projetoIds = (projetos || []).map((p) => p.id);
      if (projetoIds.length === 0) {
        setConsultores([]);
        setLoading(false);
        return;
      }

      // 2. Propostas aceitas desses projetos
      const { data: propostas } = await supabase
        .from("propostas")
        .select("id, projeto_id, consultor_user_id, valor_proposta, estimativa_horas, updated_at")
        .in("projeto_id", projetoIds)
        .eq("status", "aceita");

      if (!propostas || propostas.length === 0) {
        setConsultores([]);
        setLoading(false);
        return;
      }

      const consultorIds = [...new Set(propostas.map((p) => p.consultor_user_id))];

      // 3. Profiles, perfil consultor, avaliações
      const [{ data: profiles }, { data: perfis }, { data: avaliacoes }] = await Promise.all([
        supabase.from("profiles").select("user_id, nome, cidade, estado, avatar_url").in("user_id", consultorIds),
        supabase.from("consultor_perfil").select("user_id, bio_profissional, linkedin").in("user_id", consultorIds),
        supabase
          .from("avaliacoes")
          .select("avaliado_user_id, projeto_id, nota, recomendacao")
          .in("avaliado_user_id", consultorIds)
          .in("projeto_id", projetoIds),
      ]);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      const perfilMap = new Map((perfis || []).map((p) => [p.user_id, p]));
      const projetoMap = new Map((projetos || []).map((p) => [p.id, p]));

      // 4. Agrega por consultor
      const agg = new Map<string, ConsultorAgg>();
      for (const prop of propostas) {
        const cid = prop.consultor_user_id;
        const profile: any = profileMap.get(cid);
        const perfil: any = perfilMap.get(cid);
        const projeto: any = projetoMap.get(prop.projeto_id);
        if (!projeto) continue;

        const avaliacao = (avaliacoes || []).find(
          (a) => a.avaliado_user_id === cid && a.projeto_id === prop.projeto_id
        );

        if (!agg.has(cid)) {
          agg.set(cid, {
            user_id: cid,
            nome: profile?.nome || "Consultor",
            cidade: profile?.cidade,
            estado: profile?.estado,
            avatar_url: profile?.avatar_url,
            bio: perfil?.bio_profissional,
            linkedin: perfil?.linkedin,
            total_projetos: 0,
            projetos_concluidos: 0,
            projetos_em_andamento: 0,
            total_horas: 0,
            valor_total: 0,
            nota_media: null,
            total_avaliacoes: 0,
            recomendacoes: 0,
            ultima_contratacao: null,
            primeira_contratacao: null,
            softwares: [],
            projetos: [],
          });
        }
        const a = agg.get(cid)!;
        a.total_projetos += 1;
        if (projeto.status === "concluido") a.projetos_concluidos += 1;
        if (projeto.status === "em_andamento") a.projetos_em_andamento += 1;
        a.total_horas += Number(prop.estimativa_horas || 0);
        a.valor_total += Number(prop.valor_proposta || 0);
        if (avaliacao) {
          a.total_avaliacoes += 1;
          a.nota_media = ((a.nota_media || 0) * (a.total_avaliacoes - 1) + Number(avaliacao.nota)) / a.total_avaliacoes;
          if (avaliacao.recomendacao) a.recomendacoes += 1;
        }
        const dt = prop.updated_at;
        if (!a.ultima_contratacao || dt > a.ultima_contratacao) a.ultima_contratacao = dt;
        if (!a.primeira_contratacao || dt < a.primeira_contratacao) a.primeira_contratacao = dt;
        const sw = projeto.softwares?.nome;
        if (sw && !a.softwares.includes(sw)) a.softwares.push(sw);
        a.projetos.push({
          id: projeto.id,
          nome: projeto.nome,
          status: projeto.status,
          valor: Number(prop.valor_proposta || 0),
          horas: Number(prop.estimativa_horas || 0),
          nota: avaliacao ? Number(avaliacao.nota) : null,
          aceita_em: prop.updated_at,
          software: sw || null,
        });
      }

      setConsultores(Array.from(agg.values()));
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = consultores.filter((c) => {
      if (q && !c.nome.toLowerCase().includes(q) && !c.softwares.some((s) => s.toLowerCase().includes(q))) return false;
      if (statusFilter === "ativo" && c.projetos_em_andamento === 0) return false;
      if (statusFilter === "concluido" && c.projetos_concluidos === 0) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "recente") return (b.ultima_contratacao || "").localeCompare(a.ultima_contratacao || "");
      if (sortBy === "projetos") return b.total_projetos - a.total_projetos;
      if (sortBy === "valor") return b.valor_total - a.valor_total;
      if (sortBy === "nota") return (b.nota_media || 0) - (a.nota_media || 0);
      return 0;
    });
    return list;
  }, [consultores, search, sortBy, statusFilter]);

  const stats = useMemo(() => {
    const totalConsultores = consultores.length;
    const totalProjetos = consultores.reduce((s, c) => s + c.total_projetos, 0);
    const valorTotal = consultores.reduce((s, c) => s + c.valor_total, 0);
    const notas = consultores.filter((c) => c.nota_media !== null);
    const notaMediaGlobal = notas.length ? notas.reduce((s, c) => s + (c.nota_media || 0), 0) / notas.length : 0;
    return { totalConsultores, totalProjetos, valorTotal, notaMediaGlobal };
  }, [consultores]);

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const fmtData = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) : "—";

  const initials = (n: string) =>
    n.split(" ").slice(0, 2).map((x) => x.charAt(0)).join("").toUpperCase();

  return (
    <div>
      <PageHeader
        title="Histórico de Consultores"
        description="Todos os consultores que sua empresa já contratou e o histórico consolidado"
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={filtered.length === 0}>
                <Download size={14} /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCSV}>
                <FileSpreadsheet size={14} className="mr-2" /> Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF}>
                <FileText size={14} className="mr-2" /> Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Consultores únicos" value={String(stats.totalConsultores)} icon={Users} />
        <StatCard label="Projetos contratados" value={String(stats.totalProjetos)} icon={Briefcase} />
        <StatCard label="Valor total investido" value={fmtBRL(stats.valorTotal)} icon={DollarSign} />
        <StatCard label="Nota média geral" value={stats.notaMediaGlobal ? stats.notaMediaGlobal.toFixed(1) : "—"} icon={Star} />
      </div>

      <DataCard className="mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por consultor ou software..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="md:w-48 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Com projeto ativo</SelectItem>
              <SelectItem value="concluido">Com projeto concluído</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="md:w-48 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recente">Contratação recente</SelectItem>
              <SelectItem value="projetos">Mais projetos</SelectItem>
              <SelectItem value="valor">Maior valor</SelectItem>
              <SelectItem value="nota">Melhor nota</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </DataCard>

      {loading ? (
        <DataCard><LoadingState /></DataCard>
      ) : filtered.length === 0 ? (
        <DataCard>
          <EmptyState
            message={consultores.length === 0 ? "Nenhum consultor contratado ainda" : "Nenhum consultor encontrado com os filtros atuais"}
            icon={Users}
          />
        </DataCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <DataCard key={c.user_id} className="flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0 overflow-hidden">
                  {c.avatar_url ? <img src={c.avatar_url} alt={c.nome} className="w-full h-full object-cover" /> : initials(c.nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-semibold text-foreground text-[15px] truncate">{c.nome}</h3>
                  {(c.cidade || c.estado) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {c.cidade}{c.estado && `, ${c.estado}`}
                    </p>
                  )}
                </div>
                {c.nota_media !== null && (
                  <div className="flex items-center gap-1 bg-warning/10 text-warning rounded-md px-2 py-1 text-xs font-semibold">
                    <Star size={11} fill="currentColor" /> {c.nota_media.toFixed(1)}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Projetos</p>
                  <p className="text-base font-display font-semibold text-foreground">{c.total_projetos}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Horas</p>
                  <p className="text-base font-display font-semibold text-foreground">{c.total_horas.toFixed(0)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Valor</p>
                  <p className="text-base font-display font-semibold text-foreground">{fmtBRL(c.valor_total)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {c.projetos_em_andamento > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-info/10 text-info font-medium">
                    {c.projetos_em_andamento} em andamento
                  </span>
                )}
                {c.projetos_concluidos > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium flex items-center gap-1">
                    <CheckCircle2 size={10} /> {c.projetos_concluidos} concluído{c.projetos_concluidos > 1 ? "s" : ""}
                  </span>
                )}
                {c.recomendacoes > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">
                    <Award size={10} /> {c.recomendacoes} recomendação{c.recomendacoes > 1 ? "ões" : ""}
                  </span>
                )}
              </div>

              {c.softwares.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {c.softwares.slice(0, 3).map((s) => (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded border border-border/60 text-muted-foreground">
                      {s}
                    </span>
                  ))}
                  {c.softwares.length > 3 && (
                    <span className="text-[10px] px-2 py-0.5 text-muted-foreground">+{c.softwares.length - 3}</span>
                  )}
                </div>
              )}

              <div className="text-[11px] text-muted-foreground mb-3 flex items-center gap-3">
                <span className="flex items-center gap-1"><TrendingUp size={11} /> Última: {fmtData(c.ultima_contratacao)}</span>
              </div>

              <div className="mt-auto flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setSelected(c)}>
                  <Eye size={14} /> Histórico
                </Button>
                <Button size="sm" className="flex-1" onClick={() => recontratar(c)}>
                  <RotateCcw size={14} /> Recontratar
                </Button>
              </div>
            </DataCard>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-lg flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground text-xs font-semibold overflow-hidden">
                    {selected.avatar_url ? <img src={selected.avatar_url} alt={selected.nome} className="w-full h-full object-cover" /> : initials(selected.nome)}
                  </div>
                  {selected.nome}
                </DialogTitle>
              </DialogHeader>

              {selected.bio && (
                <p className="text-sm text-muted-foreground leading-relaxed">{selected.bio}</p>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Total projetos</p>
                  <p className="text-lg font-display font-semibold">{selected.total_projetos}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Valor total</p>
                  <p className="text-lg font-display font-semibold">{fmtBRL(selected.valor_total)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Horas</p>
                  <p className="text-lg font-display font-semibold">{selected.total_horas.toFixed(0)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Nota média</p>
                  <p className="text-lg font-display font-semibold">{selected.nota_media ? selected.nota_media.toFixed(1) : "—"}</p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-4">
                <span>Primeira contratação: <strong className="text-foreground">{fmtData(selected.primeira_contratacao)}</strong></span>
                <span>Última contratação: <strong className="text-foreground">{fmtData(selected.ultima_contratacao)}</strong></span>
                {selected.linkedin && (
                  <a href={selected.linkedin} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-1 hover:underline">
                    <Linkedin size={11} /> LinkedIn
                  </a>
                )}
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-display font-semibold mb-2 flex items-center gap-2">
                  <FolderKanban size={14} /> Projetos contratados ({selected.projetos.length})
                </h4>
                <div className="space-y-2">
                  {selected.projetos
                    .sort((a, b) => b.aceita_em.localeCompare(a.aceita_em))
                    .map((p) => (
                      <div key={p.id} className="border border-border/60 rounded-lg p-3 bg-muted/10">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{p.nome}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {p.software || "—"} · contratado em {fmtData(p.aceita_em)}
                            </p>
                          </div>
                          <StatusBadge status={p.status} />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock size={11} /> {p.horas.toFixed(0)}h</span>
                          <span className="flex items-center gap-1"><DollarSign size={11} /> {fmtBRL(p.valor)}</span>
                          {p.nota !== null && (
                            <span className="flex items-center gap-1 text-warning"><Star size={11} fill="currentColor" /> {p.nota}</span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-border/40 flex justify-end">
                <Button onClick={() => { recontratar(selected); setSelected(null); }}>
                  <RotateCcw size={14} /> Recontratar este consultor
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmpresaConsultoresHistorico;
