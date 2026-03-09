import { useState, useEffect } from "react";
import { BookOpen, Search, FolderKanban, Clock, Tag, Calendar, Server, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, DataCard, EmptyState, LoadingState, SectionTitle, StatCard } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";

interface Aprendizado {
  id: string;
  projeto_id: string;
  tipo_projeto: string | null;
  erp_utilizado: string | null;
  modulos_implementados: string[];
  tempo_estimado_dias: number | null;
  tempo_real_dias: number | null;
  horas_estimadas: number | null;
  horas_reais: number | null;
  dificuldades: string | null;
  licoes_aprendidas: string | null;
  recomendacoes: string | null;
  tags: string[];
  created_at: string;
  projeto_nome?: string;
  projeto_protocolo?: string;
}

const AdminBaseConhecimento = () => {
  const { user } = useAuth();
  const [aprendizados, setAprendizados] = useState<Aprendizado[]>([]);
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [erpFilter, setErpFilter] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Aprendizado | null>(null);
  const [softwares, setSoftwares] = useState<any[]>([]);
  const { toast } = useToast();

  const [form, setForm] = useState({
    projeto_id: "",
    tipo_projeto: "",
    erp_utilizado: "",
    modulos_implementados: "",
    tempo_estimado_dias: "",
    tempo_real_dias: "",
    horas_estimadas: "",
    horas_reais: "",
    dificuldades: "",
    licoes_aprendidas: "",
    recomendacoes: "",
    tags: "",
  });

  const fetchData = async () => {
    const [aprendRes, projRes, swRes] = await Promise.all([
      supabase.from("projeto_aprendizados").select("*").order("created_at", { ascending: false }),
      supabase.from("projetos").select("id, nome, protocolo, status, softwares(nome)").eq("status", "concluido"),
      supabase.from("softwares").select("id, nome"),
    ]);

    if (projRes.data) setProjetos(projRes.data);
    if (swRes.data) setSoftwares(swRes.data);

    if (aprendRes.data) {
      // Enrich with project names
      const allProjects = projRes.data || [];
      const projMap = new Map(allProjects.map((p: any) => [p.id, p]));
      const enriched = aprendRes.data.map((a: any) => {
        const proj = projMap.get(a.projeto_id);
        return {
          ...a,
          modulos_implementados: a.modulos_implementados || [],
          tags: a.tags || [],
          projeto_nome: proj?.nome || "Projeto",
          projeto_protocolo: proj?.protocolo || "",
        };
      });
      setAprendizados(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    const payload = {
      projeto_id: form.projeto_id,
      tipo_projeto: form.tipo_projeto || null,
      erp_utilizado: form.erp_utilizado || null,
      modulos_implementados: form.modulos_implementados ? form.modulos_implementados.split(",").map(s => s.trim()) : [],
      tempo_estimado_dias: form.tempo_estimado_dias ? parseInt(form.tempo_estimado_dias) : null,
      tempo_real_dias: form.tempo_real_dias ? parseInt(form.tempo_real_dias) : null,
      horas_estimadas: form.horas_estimadas ? parseFloat(form.horas_estimadas) : null,
      horas_reais: form.horas_reais ? parseFloat(form.horas_reais) : null,
      dificuldades: form.dificuldades || null,
      licoes_aprendidas: form.licoes_aprendidas || null,
      recomendacoes: form.recomendacoes || null,
      tags: form.tags ? form.tags.split(",").map(s => s.trim()) : [],
      created_by: user?.id,
    };

    const { error } = await supabase.from("projeto_aprendizados").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Aprendizado registrado!" });
    setDialogOpen(false);
    setForm({ projeto_id: "", tipo_projeto: "", erp_utilizado: "", modulos_implementados: "", tempo_estimado_dias: "", tempo_real_dias: "", horas_estimadas: "", horas_reais: "", dificuldades: "", licoes_aprendidas: "", recomendacoes: "", tags: "" });
    fetchData();
  };

  const erps = [...new Set(aprendizados.map(a => a.erp_utilizado).filter(Boolean))];

  const filtered = aprendizados.filter(a => {
    const term = search.toLowerCase();
    const matchesSearch = !term ||
      a.projeto_nome?.toLowerCase().includes(term) ||
      a.tipo_projeto?.toLowerCase().includes(term) ||
      a.dificuldades?.toLowerCase().includes(term) ||
      a.licoes_aprendidas?.toLowerCase().includes(term) ||
      a.tags?.some(t => t.toLowerCase().includes(term)) ||
      a.modulos_implementados?.some(m => m.toLowerCase().includes(term));
    const matchesErp = erpFilter === "todos" || a.erp_utilizado === erpFilter;
    return matchesSearch && matchesErp;
  });

  // Stats
  const avgHorasDesvio = aprendizados.filter(a => a.horas_estimadas && a.horas_reais).length > 0
    ? Math.round(
        aprendizados.filter(a => a.horas_estimadas && a.horas_reais)
          .reduce((s, a) => s + ((a.horas_reais! - a.horas_estimadas!) / a.horas_estimadas!) * 100, 0)
        / aprendizados.filter(a => a.horas_estimadas && a.horas_reais).length
      )
    : 0;

  const avgTempoDesvio = aprendizados.filter(a => a.tempo_estimado_dias && a.tempo_real_dias).length > 0
    ? Math.round(
        aprendizados.filter(a => a.tempo_estimado_dias && a.tempo_real_dias)
          .reduce((s, a) => s + ((a.tempo_real_dias! - a.tempo_estimado_dias!) / a.tempo_estimado_dias!) * 100, 0)
        / aprendizados.filter(a => a.tempo_estimado_dias && a.tempo_real_dias).length
      )
    : 0;

  return (
    <div>
      <PageHeader
        title="Base de Conhecimento"
        description="Aprendizados e histórico de projetos concluídos"
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus size={16} /> Registrar Aprendizado
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={BookOpen} label="Registros" value={aprendizados.length.toString()} iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon={Server} label="ERPs documentados" value={erps.length.toString()} iconColor="text-accent" iconBg="bg-accent/10" />
        <StatCard icon={Clock} label="Desvio médio de horas" value={`${avgHorasDesvio > 0 ? "+" : ""}${avgHorasDesvio}%`} iconColor={avgHorasDesvio > 15 ? "text-destructive" : "text-success"} iconBg={avgHorasDesvio > 15 ? "bg-destructive/10" : "bg-success/10"} />
        <StatCard icon={Calendar} label="Desvio médio de prazo" value={`${avgTempoDesvio > 0 ? "+" : ""}${avgTempoDesvio}%`} iconColor={avgTempoDesvio > 15 ? "text-destructive" : "text-success"} iconBg={avgTempoDesvio > 15 ? "bg-destructive/10" : "bg-success/10"} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <Input placeholder="Buscar por projeto, módulo, tag, dificuldade..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        {erps.length > 0 && (
          <Select value={erpFilter} onValueChange={setErpFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="ERP" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os ERPs</SelectItem>
              {erps.map(e => <SelectItem key={e} value={e!}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <DataCard noPadding>
        {loading ? <LoadingState /> : filtered.length === 0 ? (
          <EmptyState message={search ? "Nenhum registro encontrado" : "Nenhum aprendizado registrado ainda"} icon={BookOpen} />
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map(a => (
              <div key={a.id} className="p-4 px-5 table-row-interactive cursor-pointer" onClick={() => { setSelected(a); setDetailOpen(true); }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="icon-container icon-container-md bg-primary/8 flex-shrink-0">
                      <BookOpen size={18} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.projeto_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.erp_utilizado || "ERP não informado"}
                        {a.tipo_projeto && ` · ${a.tipo_projeto}`}
                        {a.horas_reais && ` · ${a.horas_reais}h reais`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {a.tags?.slice(0, 2).map(t => (
                      <Badge key={t} variant="secondary" className="text-[11px]">{t}</Badge>
                    ))}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Eye size={14} /></Button>
                  </div>
                </div>
                {a.modulos_implementados?.length > 0 && (
                  <div className="flex gap-1.5 ml-[54px] mt-2 flex-wrap">
                    {a.modulos_implementados.map(m => (
                      <span key={m} className="text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded-lg">{m}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DataCard>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-lg flex items-center gap-2">
                  <BookOpen size={20} className="text-primary" />
                  {selected.projeto_nome}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <InfoBox label="ERP" value={selected.erp_utilizado} />
                  <InfoBox label="Tipo" value={selected.tipo_projeto} />
                  <InfoBox label="Horas estimadas" value={selected.horas_estimadas?.toString()} />
                  <InfoBox label="Horas reais" value={selected.horas_reais?.toString()} />
                  <InfoBox label="Prazo estimado" value={selected.tempo_estimado_dias ? `${selected.tempo_estimado_dias} dias` : null} />
                  <InfoBox label="Prazo real" value={selected.tempo_real_dias ? `${selected.tempo_real_dias} dias` : null} />
                  <InfoBox label="Desvio horas" value={
                    selected.horas_estimadas && selected.horas_reais
                      ? `${Math.round(((selected.horas_reais - selected.horas_estimadas) / selected.horas_estimadas) * 100)}%`
                      : null
                  } />
                  <InfoBox label="Desvio prazo" value={
                    selected.tempo_estimado_dias && selected.tempo_real_dias
                      ? `${Math.round(((selected.tempo_real_dias - selected.tempo_estimado_dias) / selected.tempo_estimado_dias) * 100)}%`
                      : null
                  } />
                </div>

                {selected.modulos_implementados?.length > 0 && (
                  <div>
                    <SectionTitle>Módulos implementados</SectionTitle>
                    <div className="flex flex-wrap gap-2">
                      {selected.modulos_implementados.map(m => (
                        <Badge key={m} variant="secondary">{m}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selected.dificuldades && (
                  <div>
                    <SectionTitle>Dificuldades encontradas</SectionTitle>
                    <p className="text-sm text-foreground/80 bg-destructive/5 border border-destructive/10 rounded-xl p-4">{selected.dificuldades}</p>
                  </div>
                )}

                {selected.licoes_aprendidas && (
                  <div>
                    <SectionTitle>Lições aprendidas</SectionTitle>
                    <p className="text-sm text-foreground/80 bg-success/5 border border-success/10 rounded-xl p-4">{selected.licoes_aprendidas}</p>
                  </div>
                )}

                {selected.recomendacoes && (
                  <div>
                    <SectionTitle>Recomendações</SectionTitle>
                    <p className="text-sm text-foreground/80 bg-info/5 border border-info/10 rounded-xl p-4">{selected.recomendacoes}</p>
                  </div>
                )}

                {selected.tags?.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/60">
                    <Tag size={12} className="text-muted-foreground" />
                    {selected.tags.map(t => <Badge key={t} variant="outline" className="text-[11px]">{t}</Badge>)}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Registrar Aprendizado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Projeto concluído *</Label>
              <Select value={form.projeto_id} onValueChange={(v) => {
                const proj = projetos.find((p: any) => p.id === v);
                setForm({
                  ...form,
                  projeto_id: v,
                  erp_utilizado: proj?.softwares?.nome || form.erp_utilizado,
                });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
                <SelectContent>
                  {projetos.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} ({p.protocolo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo de projeto</Label>
                <Input value={form.tipo_projeto} onChange={e => setForm({...form, tipo_projeto: e.target.value})} placeholder="Ex: Implantação completa" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ERP utilizado</Label>
                <Input value={form.erp_utilizado} onChange={e => setForm({...form, erp_utilizado: e.target.value})} placeholder="Ex: SAP" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Módulos implementados (separar por vírgula)</Label>
              <Input value={form.modulos_implementados} onChange={e => setForm({...form, modulos_implementados: e.target.value})} placeholder="Financeiro, Fiscal, RH" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Horas estimadas</Label>
                <Input type="number" value={form.horas_estimadas} onChange={e => setForm({...form, horas_estimadas: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Horas reais</Label>
                <Input type="number" value={form.horas_reais} onChange={e => setForm({...form, horas_reais: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prazo estimado (dias)</Label>
                <Input type="number" value={form.tempo_estimado_dias} onChange={e => setForm({...form, tempo_estimado_dias: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prazo real (dias)</Label>
                <Input type="number" value={form.tempo_real_dias} onChange={e => setForm({...form, tempo_real_dias: e.target.value})} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dificuldades encontradas</Label>
              <Textarea value={form.dificuldades} onChange={e => setForm({...form, dificuldades: e.target.value})} rows={3} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lições aprendidas</Label>
              <Textarea value={form.licoes_aprendidas} onChange={e => setForm({...form, licoes_aprendidas: e.target.value})} rows={3} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recomendações</Label>
              <Textarea value={form.recomendacoes} onChange={e => setForm({...form, recomendacoes: e.target.value})} rows={3} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags (separar por vírgula)</Label>
              <Input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="SAP, Financeiro, Complexo" />
            </div>

            <Button className="w-full" onClick={handleSave} disabled={!form.projeto_id}>
              Registrar aprendizado
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const InfoBox = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="bg-muted/40 rounded-xl p-3">
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</p>
    <p className="text-sm font-medium text-foreground">{value || "—"}</p>
  </div>
);

export default AdminBaseConhecimento;
