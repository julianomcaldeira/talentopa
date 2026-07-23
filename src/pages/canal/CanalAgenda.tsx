import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays, Loader2, Save, ShieldCheck, Lock, Ban, CheckCircle2, Trash2, Users,
} from "lucide-react";
import {
  format, parseISO, isSameDay, isBefore, startOfDay, startOfMonth, endOfMonth,
  eachDayOfInterval, isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Estado = "disponivel" | "alocado" | "bloqueado";

interface ConsultorLinha {
  consultor_user_id: string;
  nome: string;
  email: string;
}
interface Perfil {
  jornada_diaria_horas: number;
  dias_semana_disponiveis: number[];
}
interface DiaMarcado {
  id: string;
  dia: string; // YYYY-MM-DD
  estado: Estado;
  projeto_id: string | null;
  jornada_horas: number;
  projeto_nome?: string;
}
interface EventoPessoal {
  id: string;
  inicio: string;
  fim: string;
  titulo: string;
  status: "agendado" | "bloqueado" | "vago";
}
interface ProjetoOpcao {
  id: string;
  nome: string;
}

const DIAS_SEMANA = [
  { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" }, { v: 4, l: "Qui" },
  { v: 5, l: "Sex" }, { v: 6, l: "Sáb" }, { v: 7, l: "Dom" },
];

const isoDow = (d: Date) => {
  // 1=segunda .. 7=domingo
  const js = d.getDay(); // 0=domingo..6=sábado
  return js === 0 ? 7 : js;
};

const fmtDia = (d: Date) => format(d, "yyyy-MM-dd");

const CanalAgenda = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [canalId, setCanalId] = useState<string | null>(null);
  const [canalNome, setCanalNome] = useState<string>("");
  const [consultores, setConsultores] = useState<ConsultorLinha[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const [perfil, setPerfil] = useState<Perfil>({ jornada_diaria_horas: 8, dias_semana_disponiveis: [1, 2, 3, 4, 5] });
  const [perfilSaving, setPerfilSaving] = useState(false);

  const [mesRef, setMesRef] = useState<Date>(startOfMonth(new Date()));
  const [diasMarcados, setDiasMarcados] = useState<DiaMarcado[]>([]);
  const [eventosPessoais, setEventosPessoais] = useState<EventoPessoal[]>([]);
  const [projetos, setProjetos] = useState<ProjetoOpcao[]>([]);
  const [loading, setLoading] = useState(false);

  // Popover / seleção
  const [modoIntervalo, setModoIntervalo] = useState(false);
  const [diaSingle, setDiaSingle] = useState<Date | undefined>();
  const [rangeSel, setRangeSel] = useState<{ from?: Date; to?: Date } | undefined>();
  const [popOpen, setPopOpen] = useState(false);
  const [popAction, setPopAction] = useState<Estado>("alocado");
  const [popProjeto, setPopProjeto] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Carrega canal do usuário
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("canais").select("id, nome").eq("user_id", user.id).maybeSingle();
      if (data) { setCanalId(data.id); setCanalNome(data.nome); }
    })();
  }, [user?.id]);

  // Carrega consultores vinculados
  useEffect(() => {
    if (!canalId) return;
    (async () => {
      const { data: vinc } = await supabase
        .from("canal_consultores")
        .select("consultor_user_id")
        .eq("canal_id", canalId)
        .eq("status", "ativo");
      const ids = (vinc || []).map((v: any) => v.consultor_user_id);
      if (!ids.length) { setConsultores([]); return; }
      const { data: profs } = await supabase
        .from("profiles").select("user_id, nome, email").in("user_id", ids);
      const rows: ConsultorLinha[] = ids.map((id) => {
        const p: any = (profs || []).find((x: any) => x.user_id === id);
        return { consultor_user_id: id, nome: p?.nome || "Sem nome", email: p?.email || "" };
      }).sort((a, b) => a.nome.localeCompare(b.nome));
      setConsultores(rows);
      if (!selecionado && rows.length) setSelecionado(rows[0].consultor_user_id);
    })();
  }, [canalId]);

  // Carrega dados do consultor selecionado
  const carregar = async () => {
    if (!canalId || !selecionado) return;
    setLoading(true);
    const inicio = fmtDia(startOfMonth(mesRef));
    const fim = fmtDia(endOfMonth(mesRef));

    // perfil
    const { data: perf } = await supabase
      .from("consultor_perfil")
      .select("jornada_diaria_horas, dias_semana_disponiveis")
      .eq("user_id", selecionado).maybeSingle();
    if (perf) {
      setPerfil({
        jornada_diaria_horas: Number(perf.jornada_diaria_horas) || 8,
        dias_semana_disponiveis: (perf.dias_semana_disponiveis as number[]) || [1, 2, 3, 4, 5],
      });
    } else {
      setPerfil({ jornada_diaria_horas: 8, dias_semana_disponiveis: [1, 2, 3, 4, 5] });
    }

    // dias marcados no mês
    const { data: dias } = await supabase
      .from("consultor_agenda_dias")
      .select("id, dia, estado, projeto_id, jornada_horas")
      .eq("consultor_user_id", selecionado)
      .eq("canal_id", canalId)
      .gte("dia", inicio).lte("dia", fim);
    const pIds = Array.from(new Set((dias || []).map((d: any) => d.projeto_id).filter(Boolean)));
    let nomes: Record<string, string> = {};
    if (pIds.length) {
      const { data: prjs } = await supabase.from("projetos").select("id, nome").in("id", pIds);
      (prjs || []).forEach((p: any) => { nomes[p.id] = p.nome; });
    }
    setDiasMarcados(((dias || []) as any[]).map((d) => ({
      ...d,
      projeto_nome: d.projeto_id ? nomes[d.projeto_id] : undefined,
    })));

    // eventos pessoais (somente leitura, overlay)
    const inicioIso = new Date(inicio + "T00:00:00").toISOString();
    const fimIso = new Date(fim + "T23:59:59").toISOString();
    const { data: evs } = await supabase
      .from("consultor_agenda")
      .select("id, inicio, fim, titulo, status")
      .eq("consultor_user_id", selecionado)
      .lte("inicio", fimIso).gte("fim", inicioIso);
    setEventosPessoais((evs || []) as any);

    // projetos elegíveis (alocação aprovada OU indicação selecionada deste canal)
    const [aloc, ind] = await Promise.all([
      supabase.from("alocacoes")
        .select("projeto_id").eq("consultor_user_id", selecionado)
        .eq("canal_id", canalId).eq("status", "aprovada"),
      supabase.from("parceiro_indicacoes")
        .select("resposta_id, projeto:parceiro_respostas!inner(projeto_id, canal_id)")
        .eq("consultor_user_id", selecionado).eq("status", "selecionado"),
    ]);
    const projIds = new Set<string>();
    (aloc.data || []).forEach((a: any) => a.projeto_id && projIds.add(a.projeto_id));
    (ind.data || []).forEach((i: any) => {
      if (i.projeto?.canal_id === canalId) projIds.add(i.projeto.projeto_id);
    });
    if (projIds.size) {
      const { data: prjs } = await supabase.from("projetos").select("id, nome").in("id", Array.from(projIds));
      setProjetos((prjs || []) as ProjetoOpcao[]);
    } else {
      setProjetos([]);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [canalId, selecionado, mesRef]);

  // Índices para lookup rápido no calendário
  const marcadosPorDia = useMemo(() => {
    const m = new Map<string, DiaMarcado>();
    diasMarcados.forEach((d) => m.set(d.dia, d));
    return m;
  }, [diasMarcados]);

  const eventoNoDia = (d: Date): EventoPessoal | undefined =>
    eventosPessoais.find((ev) => {
      const ini = startOfDay(parseISO(ev.inicio));
      const fim = startOfDay(parseISO(ev.fim));
      return (d >= ini && d <= fim) && (ev.status === "agendado" || ev.status === "bloqueado");
    });

  const estadoDoDia = (d: Date): { estado: Estado | "pessoal" | "indisponivel"; projeto?: string } => {
    const key = fmtDia(d);
    const m = marcadosPorDia.get(key);
    if (m) return { estado: m.estado, projeto: m.projeto_nome };
    const ev = eventoNoDia(d);
    if (ev) return { estado: "pessoal" };
    if (!perfil.dias_semana_disponiveis.includes(isoDow(d))) return { estado: "indisponivel" };
    return { estado: "disponivel" };
  };

  const hoje = startOfDay(new Date());

  const diasSelecionados = useMemo<Date[]>(() => {
    if (modoIntervalo && rangeSel?.from) {
      const to = rangeSel.to || rangeSel.from;
      return eachDayOfInterval({ start: rangeSel.from, end: to });
    }
    if (!modoIntervalo && diaSingle) return [diaSingle];
    return [];
  }, [modoIntervalo, rangeSel, diaSingle]);

  const abrirPopover = () => {
    if (!diasSelecionados.length) return;
    // bloqueia dias passados
    if (diasSelecionados.some((d) => isBefore(startOfDay(d), hoje))) {
      toast({
        title: "Data no passado",
        description: "Não é possível marcar dias anteriores à data atual.",
        variant: "destructive",
      });
      return;
    }
    setPopAction("alocado");
    setPopProjeto("");
    setPopOpen(true);
  };

  const executarMarcacao = async (acao: Estado | "limpar") => {
    if (!canalId || !selecionado || !diasSelecionados.length) return;

    if (acao === "limpar") {
      setSaving(true);
      const keys = diasSelecionados.map(fmtDia);
      const { error } = await supabase
        .from("consultor_agenda_dias")
        .delete()
        .eq("consultor_user_id", selecionado)
        .eq("canal_id", canalId)
        .in("dia", keys);
      setSaving(false);
      if (error) {
        toast({ title: "Não foi possível limpar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Marcações removidas" });
      setPopOpen(false);
      await carregar();
      return;
    }

    if (acao === "alocado" && !popProjeto) {
      toast({ title: "Selecione a demanda", variant: "destructive" });
      return;
    }

    // Detecta conflito no cliente para mensagem amigável
    const conflitos: { dia: string; nome?: string }[] = [];
    for (const d of diasSelecionados) {
      const m = marcadosPorDia.get(fmtDia(d));
      if (m && m.estado === "alocado" && (acao !== "alocado" || m.projeto_id !== popProjeto)) {
        conflitos.push({ dia: fmtDia(d), nome: m.projeto_nome });
      }
    }
    if (conflitos.length) {
      const c = conflitos[0];
      toast({
        title: "Dia já alocado",
        description: `${format(parseISO(c.dia), "dd/MM/yyyy")} já está alocado à demanda ${c.nome || "existente"}. Use 'Limpar marcação' antes de reatribuir.`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const payload = diasSelecionados.map((d) => ({
      consultor_user_id: selecionado,
      canal_id: canalId,
      dia: fmtDia(d),
      estado: acao,
      projeto_id: acao === "alocado" ? popProjeto : null,
      jornada_horas: perfil.jornada_diaria_horas,
    }));
    const { error } = await supabase
      .from("consultor_agenda_dias")
      .upsert(payload, { onConflict: "consultor_user_id,dia" });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: acao === "alocado" ? "Dias alocados" : "Dias bloqueados" });
    setPopOpen(false);
    setDiaSingle(undefined);
    setRangeSel(undefined);
    await carregar();
  };

  const salvarPerfil = async () => {
    if (!selecionado) return;
    setPerfilSaving(true);
    const { error } = await supabase
      .from("consultor_perfil")
      .update({
        jornada_diaria_horas: perfil.jornada_diaria_horas,
        dias_semana_disponiveis: perfil.dias_semana_disponiveis,
      } as any)
      .eq("user_id", selecionado);
    setPerfilSaving(false);
    if (error) {
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Disponibilidade padrão atualizada" });
  };

  const toggleDia = (v: number) => {
    setPerfil((p) => ({
      ...p,
      dias_semana_disponiveis: p.dias_semana_disponiveis.includes(v)
        ? p.dias_semana_disponiveis.filter((x) => x !== v)
        : [...p.dias_semana_disponiveis, v].sort(),
    }));
  };

  // Modificadores para colorir dias
  const modifiers = useMemo(() => {
    const alocado: Date[] = [];
    const bloqueado: Date[] = [];
    const pessoal: Date[] = [];
    const dias = eachDayOfInterval({ start: startOfMonth(mesRef), end: endOfMonth(mesRef) });
    dias.forEach((d) => {
      const s = estadoDoDia(d);
      if (s.estado === "alocado") alocado.push(d);
      else if (s.estado === "bloqueado") bloqueado.push(d);
      else if (s.estado === "pessoal") pessoal.push(d);
    });
    return { alocado, bloqueado, pessoal };
  }, [mesRef, marcadosPorDia, eventosPessoais, perfil]);

  const consultorSel = consultores.find((c) => c.consultor_user_id === selecionado);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Agenda dos Consultores</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie disponibilidade, alocações e bloqueios dos consultores vinculados ao canal <span className="font-medium">{canalNome}</span>.
        </p>
      </div>

      {!canalId ? (
        <Card className="p-8 text-center text-muted-foreground">Canal não encontrado.</Card>
      ) : consultores.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <p className="font-medium">Nenhum consultor vinculado</p>
          <p className="text-sm text-muted-foreground mt-1">Convide consultores em "Meus Consultores" para começar.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Coluna principal - calendário */}
          <div className="space-y-4">
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-[260px]">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Consultor</Label>
                  <Select value={selecionado || ""} onValueChange={(v) => { setSelecionado(v); setDiaSingle(undefined); setRangeSel(undefined); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {consultores.map((c) => (
                        <SelectItem key={c.consultor_user_id} value={c.consultor_user_id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Seleção de intervalo</Label>
                  <Checkbox
                    checked={modoIntervalo}
                    onCheckedChange={(v) => {
                      setModoIntervalo(!!v);
                      setDiaSingle(undefined);
                      setRangeSel(undefined);
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Disponível</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Alocado</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" /> Bloqueado</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Evento pessoal (leitura)</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Fora da jornada</span>
              </div>

              <div className="flex justify-center">
                {loading ? (
                  <div className="py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : (
                  <Popover open={popOpen} onOpenChange={setPopOpen}>
                    <PopoverTrigger asChild>
                      <div>
                        <Calendar
                          mode={modoIntervalo ? "range" as const : "single" as const}
                          selected={modoIntervalo ? rangeSel as any : diaSingle as any}
                          onSelect={(v: any) => {
                            if (modoIntervalo) {
                              setRangeSel(v);
                              if (v?.from && v?.to) setTimeout(abrirPopover, 50);
                            } else {
                              setDiaSingle(v);
                              if (v) setTimeout(abrirPopover, 50);
                            }
                          }}
                          month={mesRef}
                          onMonthChange={setMesRef}
                          locale={ptBR}
                          disabled={(d) => isBefore(startOfDay(d), hoje)}
                          modifiers={modifiers}
                          modifiersClassNames={{
                            alocado: "bg-primary/15 text-primary font-semibold hover:bg-primary/25",
                            bloqueado: "bg-destructive/15 text-destructive font-semibold hover:bg-destructive/25",
                            pessoal: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                          }}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4 space-y-3" align="center">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        {diasSelecionados.length === 1
                          ? format(diasSelecionados[0], "EEEE, dd/MM/yyyy", { locale: ptBR })
                          : `${diasSelecionados.length} dias selecionados`}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Ação</Label>
                        <Select value={popAction} onValueChange={(v) => setPopAction(v as Estado)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="alocado">Alocar em demanda</SelectItem>
                            <SelectItem value="bloqueado">Bloquear (ausência/férias)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {popAction === "alocado" && (
                        <div className="space-y-2">
                          <Label className="text-xs">Demanda</Label>
                          {projetos.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Este consultor ainda não foi selecionado em nenhuma demanda deste canal.
                            </p>
                          ) : (
                            <Select value={popProjeto} onValueChange={setPopProjeto}>
                              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                              <SelectContent>
                                {projetos.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => executarMarcacao(popAction)}
                          disabled={saving || (popAction === "alocado" && (!popProjeto || projetos.length === 0))}
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                            popAction === "alocado" ? <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar alocação</> : <><Ban className="h-4 w-4 mr-2" /> Bloquear período</>
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => executarMarcacao("limpar")} disabled={saving}>
                          <Trash2 className="h-4 w-4 mr-2" /> Limpar marcação
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </Card>

            {/* Detalhes dos dias marcados */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Marcações do mês</h3>
              </div>
              {diasMarcados.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma marcação neste mês.</p>
              ) : (
                <div className="divide-y divide-border">
                  {diasMarcados
                    .slice()
                    .sort((a, b) => a.dia.localeCompare(b.dia))
                    .map((d) => (
                      <div key={d.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "h-2 w-2 rounded-full",
                            d.estado === "alocado" ? "bg-primary" : d.estado === "bloqueado" ? "bg-destructive" : "bg-emerald-500",
                          )} />
                          <span className="text-sm font-medium">
                            {format(parseISO(d.dia), "EEE, dd/MM", { locale: ptBR })}
                          </span>
                          <Badge variant="outline" className="text-[11px]">
                            {d.estado === "alocado" ? "Alocado" : d.estado === "bloqueado" ? "Bloqueado" : "Disponível"}
                          </Badge>
                          {d.projeto_nome && (
                            <span className="text-xs text-muted-foreground">→ {d.projeto_nome}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{Number(d.jornada_horas)}h</span>
                      </div>
                    ))}
                </div>
              )}
            </Card>
          </div>

          {/* Painel lateral - disponibilidade padrão */}
          <Card className="p-4 h-fit space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Disponibilidade padrão</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Dias da semana e jornada usados como base quando não há marcação específica no dia.
            </p>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Dias da semana</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DIAS_SEMANA.map((d) => {
                  const on = perfil.dias_semana_disponiveis.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => toggleDia(d.v)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                        on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:text-foreground",
                      )}
                    >
                      {d.l}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="jornada" className="text-xs uppercase tracking-wider text-muted-foreground">Jornada diária (h)</Label>
              <Input
                id="jornada"
                type="number"
                min={0} max={24} step={0.5}
                value={perfil.jornada_diaria_horas}
                onChange={(e) => setPerfil((p) => ({ ...p, jornada_diaria_horas: Number(e.target.value) || 0 }))}
              />
            </div>

            <Button onClick={salvarPerfil} disabled={perfilSaving} className="w-full">
              {perfilSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Salvar disponibilidade</>}
            </Button>

            {consultorSel && (
              <div className="text-[11px] text-muted-foreground pt-2 border-t border-border">
                Alterações aplicam à conta de <span className="font-medium">{consultorSel.nome}</span>.
              </div>
            )}

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-2 border-t border-border">
              <Lock className="h-3 w-3" /> Somente o parceiro do vínculo pode editar.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CanalAgenda;
