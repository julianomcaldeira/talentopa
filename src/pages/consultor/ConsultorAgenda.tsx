import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, LayoutList, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { format, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type AgendaStatus = "agendado" | "bloqueado" | "vago";

interface AgendaItem {
  id: string;
  consultor_user_id: string;
  projeto_id: string | null;
  titulo: string;
  descricao: string | null;
  inicio: string;
  fim: string;
  status: AgendaStatus;
}

interface ProjetoOption {
  id: string;
  nome: string;
}

const statusMeta: Record<AgendaStatus, { label: string; cls: string; dot: string }> = {
  agendado: { label: "Agendado", cls: "bg-primary/10 text-primary border-primary/20", dot: "bg-primary" },
  bloqueado: { label: "Bloqueado", cls: "bg-destructive/10 text-destructive border-destructive/20", dot: "bg-destructive" },
  vago: { label: "Vago", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500" },
};

// helpers para input datetime-local (sem fuso)
const toLocalInput = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (val: string) => (val ? new Date(val).toISOString() : "");

const ConsultorAgenda = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [projetos, setProjetos] = useState<ProjetoOption[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<"all" | AgendaStatus>("all");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [diaSelecionado, setDiaSelecionado] = useState<Date | undefined>(new Date());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  // Detecta conflito (sobreposição) com eventos existentes que reservam o horário.
  // Eventos com status "vago" representam disponibilidade e não conflitam.
  const encontrarConflito = (
    inicioISO: string,
    fimISO: string,
    statusNovo: AgendaStatus,
    ignorarId?: string,
  ): AgendaItem | null => {
    if (statusNovo === "vago") return null;
    const ini = new Date(inicioISO).getTime();
    const fim = new Date(fimISO).getTime();
    return items.find((it) => {
      if (ignorarId && it.id === ignorarId) return false;
      if (it.status === "vago") return false;
      const a = new Date(it.inicio).getTime();
      const b = new Date(it.fim).getTime();
      return a < fim && b > ini;
    }) || null;
  };

  const descreverConflito = (c: AgendaItem) =>
    `Conflita com "${c.titulo}" (${format(parseISO(c.inicio), "dd/MM HH:mm")} – ${format(parseISO(c.fim), "HH:mm")})`;

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AgendaItem | null>(null);

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    inicio: "",
    fim: "",
    status: "agendado" as AgendaStatus,
    projeto_id: "none" as string,
  });

  const carregar = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("consultor_agenda")
      .select("*")
      .eq("consultor_user_id", user.id)
      .order("inicio", { ascending: true });
    setItems((data || []) as AgendaItem[]);

    // Projetos do consultor (propostas em status ativo)
    const { data: props } = await supabase
      .from("propostas")
      .select("projeto_id")
      .eq("consultor_user_id", user.id)
      .in("status", ["pre_aprovada", "aguardando_consultor", "aceita"]);
    const pids = Array.from(new Set((props || []).map((p: any) => p.projeto_id).filter(Boolean)));
    if (pids.length) {
      const { data: prjs } = await supabase
        .from("projetos")
        .select("id, nome")
        .in("id", pids);
      setProjetos((prjs || []) as ProjetoOption[]);
    } else {
      setProjetos([]);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [user?.id]);

  const abrirNovo = () => {
    setEditing(null);
    setForm({ titulo: "", descricao: "", inicio: "", fim: "", status: "agendado", projeto_id: "none" });
    setOpen(true);
  };

  const abrirEditar = (item: AgendaItem) => {
    setEditing(item);
    setForm({
      titulo: item.titulo,
      descricao: item.descricao || "",
      inicio: toLocalInput(item.inicio),
      fim: toLocalInput(item.fim),
      status: item.status,
      projeto_id: item.projeto_id || "none",
    });
    setOpen(true);
  };

  const salvar = async () => {
    if (!user) return;
    if (!form.titulo.trim()) {
      toast({ title: "Informe um título", variant: "destructive" });
      return;
    }
    if (!form.inicio || !form.fim) {
      toast({ title: "Informe início e fim", variant: "destructive" });
      return;
    }
    const inicioISO = fromLocalInput(form.inicio);
    const fimISO = fromLocalInput(form.fim);
    if (new Date(fimISO) <= new Date(inicioISO)) {
      toast({ title: "O fim deve ser após o início", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      consultor_user_id: user.id,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      inicio: inicioISO,
      fim: fimISO,
      status: form.status,
      projeto_id: form.projeto_id === "none" ? null : form.projeto_id,
    };

    const { error } = editing
      ? await supabase.from("consultor_agenda").update(payload).eq("id", editing.id)
      : await supabase.from("consultor_agenda").insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Evento atualizado" : "Evento criado" });
    setOpen(false);
    carregar();
  };

  const remover = async (item: AgendaItem) => {
    if (!confirm("Remover este evento da agenda?")) return;
    const { error } = await supabase.from("consultor_agenda").delete().eq("id", item.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Evento removido" });
    carregar();
  };

  const filtrados = useMemo(
    () => items.filter((i) => filtroStatus === "all" || i.status === filtroStatus),
    [items, filtroStatus]
  );

  const grupos = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    filtrados.forEach((it) => {
      const key = format(parseISO(it.inicio), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtrados]);

  const totais = useMemo(() => {
    return {
      agendado: items.filter((i) => i.status === "agendado").length,
      bloqueado: items.filter((i) => i.status === "bloqueado").length,
      vago: items.filter((i) => i.status === "vago").length,
    };
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Minha Agenda</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Organize seus compromissos com horário de início e fim, vincule a projetos e bloqueie períodos indisponíveis.
          </p>
        </div>
        <Button onClick={abrirNovo}><Plus className="h-4 w-4 mr-2" /> Novo evento</Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(["agendado", "bloqueado", "vago"] as AgendaStatus[]).map((s) => (
          <Card key={s} className="p-4 flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${statusMeta[s].dot}`} />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{statusMeta[s].label}</p>
              <p className="text-xl font-semibold text-foreground">{totais[s]}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filtros + Toggle de visualização */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "agendado", "bloqueado", "vago"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filtroStatus === s ? "default" : "outline"}
              onClick={() => setFiltroStatus(s)}
            >
              {s === "all" ? "Todos" : statusMeta[s as AgendaStatus].label}
            </Button>
          ))}
        </div>
        <div className="inline-flex items-center bg-muted/60 border border-border/60 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutList size={12} /> Lista
          </button>
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              view === "calendar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CalendarDays size={12} /> Calendário
          </button>
        </div>
      </div>

      {(() => {
        const renderEvento = (ev: AgendaItem) => {
          const projeto = projetos.find((p) => p.id === ev.projeto_id);
          const meta = statusMeta[ev.status];
          return (
            <div key={ev.id} className="p-4 flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${meta.cls}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(ev.inicio), "HH:mm")} – {format(parseISO(ev.fim), "HH:mm")}
                  </span>
                  {projeto && (
                    <Badge variant="outline" className="text-[11px]">{projeto.nome}</Badge>
                  )}
                </div>
                <p className="font-medium text-foreground mt-1">{ev.titulo}</p>
                {ev.descricao && (
                  <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line">{ev.descricao}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => abrirEditar(ev)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remover(ev)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        };

        if (loading) {
          return (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          );
        }

        if (view === "calendar") {
          const diasComEventos: Record<AgendaStatus, Date[]> = { agendado: [], bloqueado: [], vago: [] };
          filtrados.forEach((it) => diasComEventos[it.status].push(parseISO(it.inicio)));
          const eventosDoDia = diaSelecionado
            ? filtrados.filter((it) => isSameDay(parseISO(it.inicio), diaSelecionado))
            : [];
          return (
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
              <Card className="p-3 w-fit">
                <Calendar
                  mode="single"
                  selected={diaSelecionado}
                  onSelect={setDiaSelecionado}
                  locale={ptBR}
                  modifiers={{
                    agendado: diasComEventos.agendado,
                    bloqueado: diasComEventos.bloqueado,
                    vago: diasComEventos.vago,
                  }}
                  modifiersClassNames={{
                    agendado: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
                    bloqueado: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-destructive",
                    vago: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-emerald-500",
                  }}
                />
                <div className="mt-2 px-1 pb-1 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                  {(["agendado", "bloqueado", "vago"] as AgendaStatus[]).map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusMeta[s].dot}`} /> {statusMeta[s].label}
                    </span>
                  ))}
                </div>
              </Card>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  {diaSelecionado
                    ? format(diaSelecionado, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : "Selecione um dia"}
                </p>
                {eventosDoDia.length === 0 ? (
                  <Card className="p-10 text-center">
                    <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium text-foreground">Nenhum evento neste dia</p>
                    <p className="text-sm text-muted-foreground mt-1">Clique em "Novo evento" para criar um compromisso.</p>
                  </Card>
                ) : (
                  <Card className="divide-y divide-border">
                    {eventosDoDia.map(renderEvento)}
                  </Card>
                )}
              </div>
            </div>
          );
        }

        if (grupos.length === 0) {
          return (
            <Card className="p-10 text-center">
              <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium text-foreground">Nenhum evento na agenda</p>
              <p className="text-sm text-muted-foreground mt-1">Crie seu primeiro evento para começar a organizar seus projetos.</p>
            </Card>
          );
        }

        return (
          <div className="space-y-4">
            {grupos.map(([dia, eventos]) => (
              <div key={dia}>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  {format(parseISO(`${dia}T00:00:00`), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                <Card className="divide-y divide-border">
                  {eventos.map(renderEvento)}
                </Card>
              </div>
            ))}
          </div>
        );
      })()}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar evento" : "Novo evento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Reunião de kickoff, Bloqueado para férias..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="inicio">Início</Label>
                <Input
                  id="inicio"
                  type="datetime-local"
                  value={form.inicio}
                  onChange={(e) => setForm({ ...form, inicio: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="fim">Fim</Label>
                <Input
                  id="fim"
                  type="datetime-local"
                  value={form.fim}
                  onChange={(e) => setForm({ ...form, fim: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as AgendaStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="bloqueado">Bloqueado</SelectItem>
                    <SelectItem value="vago">Vago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projeto (opcional)</Label>
                <Select value={form.projeto_id} onValueChange={(v) => setForm({ ...form, projeto_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vínculo</SelectItem>
                    {projetos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={3}
                placeholder="Detalhes do compromisso, pauta, observações..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editing ? "Salvar" : "Criar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsultorAgenda;
