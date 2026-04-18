import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DataCard, EmptyState } from "@/components/dashboard/DashboardComponents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Plus, CheckCircle2, XCircle, Trash2, Download, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Timesheet = ({
  projetoId,
  fases,
  isConsultor,
  isEmpresa,
  projetoNome,
}: { projetoId: string; fases: any[]; isConsultor: boolean; isEmpresa: boolean; projetoNome?: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [horas, setHoras] = useState("");
  const [faseId, setFaseId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Filtros de relatório
  const [filtroDataIni, setFiltroDataIni] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroConsultor, setFiltroConsultor] = useState<string>("todos");
  const [filtroFase, setFiltroFase] = useState<string>("todos");
  const [agruparPor, setAgruparPor] = useState<string>("nenhum");

  const fetch = async () => {
    const { data } = await (supabase as any)
      .from("projeto_horas_lancadas")
      .select("*")
      .eq("projeto_id", projetoId)
      .order("data_execucao", { ascending: false });
    setLancamentos(data || []);
    const ids = Array.from(new Set((data || []).map((l: any) => l.consultor_user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids as string[]);
      setProfiles(new Map((profs || []).map((p) => [p.user_id, p.nome])));
    }
  };

  useEffect(() => { fetch(); /* eslint-disable-next-line */ }, [projetoId]);

  const lancar = async () => {
    if (!user || !data || !horas) {
      toast({ title: "Informe data e horas", variant: "destructive" });
      return;
    }
    setEnviando(true);
    const { error } = await (supabase as any).from("projeto_horas_lancadas").insert({
      projeto_id: projetoId,
      consultor_user_id: user.id,
      data_execucao: data,
      horas: Number(horas),
      fase_id: faseId || null,
      descricao: descricao.trim() || null,
    });
    setEnviando(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setHoras(""); setDescricao(""); setFaseId("");
    toast({ title: "Horas lançadas" });
    fetch();
  };

  const aprovar = async (id: string, aprovar: boolean) => {
    const { error } = await (supabase as any)
      .from("projeto_horas_lancadas")
      .update({ aprovado: aprovar, aprovado_por: user?.id, aprovado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetch();
  };

  const remover = async (id: string) => {
    await (supabase as any).from("projeto_horas_lancadas").delete().eq("id", id);
    fetch();
  };

  // Aplicar filtros
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((l) => {
      if (filtroDataIni && l.data_execucao < filtroDataIni) return false;
      if (filtroDataFim && l.data_execucao > filtroDataFim) return false;
      if (filtroStatus === "aprovado" && l.aprovado !== true) return false;
      if (filtroStatus === "reprovado" && l.aprovado !== false) return false;
      if (filtroStatus === "pendente" && l.aprovado !== null) return false;
      if (filtroConsultor !== "todos" && l.consultor_user_id !== filtroConsultor) return false;
      if (filtroFase !== "todos") {
        if (filtroFase === "_sem_" && l.fase_id) return false;
        if (filtroFase !== "_sem_" && l.fase_id !== filtroFase) return false;
      }
      return true;
    });
  }, [lancamentos, filtroDataIni, filtroDataFim, filtroStatus, filtroConsultor, filtroFase]);

  const consultoresUnicos = useMemo(() => {
    const ids = Array.from(new Set(lancamentos.map((l) => l.consultor_user_id)));
    return ids.map((id) => ({ id, nome: profiles.get(id) || "—" }));
  }, [lancamentos, profiles]);

  // Agrupamento
  const agrupado = useMemo(() => {
    if (agruparPor === "nenhum") return null;
    const groups = new Map<string, { label: string; horas: number; aprovadas: number; pendentes: number; reprovadas: number; count: number }>();
    lancamentosFiltrados.forEach((l) => {
      let key = "", label = "";
      if (agruparPor === "consultor") {
        key = l.consultor_user_id;
        label = profiles.get(l.consultor_user_id) || "—";
      } else if (agruparPor === "fase") {
        key = l.fase_id || "_sem_";
        label = fases.find((f) => f.id === l.fase_id)?.nome || "Sem fase";
      } else if (agruparPor === "mes") {
        key = l.data_execucao.slice(0, 7);
        label = new Date(l.data_execucao + "T00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      } else if (agruparPor === "semana") {
        const d = new Date(l.data_execucao + "T00:00");
        const onejan = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
        key = `${d.getFullYear()}-W${week}`;
        label = `Semana ${week} / ${d.getFullYear()}`;
      }
      const cur = groups.get(key) || { label, horas: 0, aprovadas: 0, pendentes: 0, reprovadas: 0, count: 0 };
      cur.horas += Number(l.horas || 0);
      cur.count += 1;
      if (l.aprovado === true) cur.aprovadas += Number(l.horas || 0);
      else if (l.aprovado === false) cur.reprovadas += Number(l.horas || 0);
      else cur.pendentes += Number(l.horas || 0);
      groups.set(key, cur);
    });
    return Array.from(groups.entries()).map(([key, v]) => ({ key, ...v })).sort((a, b) => b.horas - a.horas);
  }, [lancamentosFiltrados, agruparPor, profiles, fases]);

  const total = lancamentos.reduce((s, l) => s + Number(l.horas || 0), 0);
  const aprovadas = lancamentos.filter((l) => l.aprovado === true).reduce((s, l) => s + Number(l.horas || 0), 0);
  const pendentes = lancamentos.filter((l) => l.aprovado === null).reduce((s, l) => s + Number(l.horas || 0), 0);

  const totalFiltrado = lancamentosFiltrados.reduce((s, l) => s + Number(l.horas || 0), 0);

  const statusLabel = (a: any) => a === true ? "Aprovado" : a === false ? "Reprovado" : "Pendente";

  const exportCSV = () => {
    const linhas = [
      ["Data", "Consultor", "Fase", "Descrição", "Horas", "Status"],
      ...lancamentosFiltrados.map((l) => [
        new Date(l.data_execucao + "T00:00").toLocaleDateString("pt-BR"),
        profiles.get(l.consultor_user_id) || "—",
        fases.find((f) => f.id === l.fase_id)?.nome || "—",
        (l.descricao || "").replace(/"/g, '""'),
        Number(l.horas).toFixed(2).replace(".", ","),
        statusLabel(l.aprovado),
      ]),
    ];
    if (agrupado) {
      linhas.push([], ["Agrupamento: " + agruparPor]);
      linhas.push(["Grupo", "Lançamentos", "Total (h)", "Aprovadas (h)", "Pendentes (h)", "Reprovadas (h)"]);
      agrupado.forEach((g) => linhas.push([g.label, String(g.count), g.horas.toFixed(2).replace(".", ","), g.aprovadas.toFixed(2).replace(".", ","), g.pendentes.toFixed(2).replace(".", ","), g.reprovadas.toFixed(2).replace(".", ",")]));
    }
    const csv = "\ufeff" + linhas.map((r) => r.map((c) => `"${c ?? ""}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `horas_${projetoNome || projetoId}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportado" });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const titulo = `Relatório de Horas — ${projetoNome || "Projeto"}`;
    doc.setFontSize(14);
    doc.text(titulo, 14, 15);
    doc.setFontSize(9);
    const filtros: string[] = [];
    if (filtroDataIni) filtros.push(`De: ${new Date(filtroDataIni + "T00:00").toLocaleDateString("pt-BR")}`);
    if (filtroDataFim) filtros.push(`Até: ${new Date(filtroDataFim + "T00:00").toLocaleDateString("pt-BR")}`);
    if (filtroStatus !== "todos") filtros.push(`Status: ${filtroStatus}`);
    if (filtroConsultor !== "todos") filtros.push(`Consultor: ${profiles.get(filtroConsultor) || "—"}`);
    if (filtroFase !== "todos") filtros.push(`Fase: ${filtroFase === "_sem_" ? "Sem fase" : fases.find((f) => f.id === filtroFase)?.nome || "—"}`);
    doc.text(filtros.length ? `Filtros: ${filtros.join(" • ")}` : "Sem filtros aplicados", 14, 21);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} • Total: ${totalFiltrado.toFixed(2)}h em ${lancamentosFiltrados.length} lançamento(s)`, 14, 26);

    autoTable(doc, {
      startY: 32,
      head: [["Data", "Consultor", "Fase", "Descrição", "Horas", "Status"]],
      body: lancamentosFiltrados.map((l) => [
        new Date(l.data_execucao + "T00:00").toLocaleDateString("pt-BR"),
        profiles.get(l.consultor_user_id) || "—",
        fases.find((f) => f.id === l.fase_id)?.nome || "—",
        l.descricao || "—",
        Number(l.horas).toFixed(2),
        statusLabel(l.aprovado),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229] },
      columnStyles: { 4: { halign: "right" }, 5: { halign: "center" } },
    });

    if (agrupado && agrupado.length) {
      const finalY = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(11);
      doc.text(`Agrupamento por ${agruparPor}`, 14, finalY);
      autoTable(doc, {
        startY: finalY + 3,
        head: [["Grupo", "Lançamentos", "Total (h)", "Aprovadas", "Pendentes", "Reprovadas"]],
        body: agrupado.map((g) => [g.label, g.count, g.horas.toFixed(2), g.aprovadas.toFixed(2), g.pendentes.toFixed(2), g.reprovadas.toFixed(2)]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229] },
        columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      });
    }

    doc.save(`horas_${projetoNome || projetoId}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: "PDF exportado" });
  };

  const limparFiltros = () => {
    setFiltroDataIni(""); setFiltroDataFim(""); setFiltroStatus("todos"); setFiltroConsultor("todos"); setFiltroFase("todos"); setAgruparPor("nenhum");
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <DataCard className="!p-4"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Lançadas</p><p className="text-xl font-display font-semibold mt-1">{total}h</p></DataCard>
        <DataCard className="!p-4"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Aprovadas</p><p className="text-xl font-display font-semibold mt-1 text-success">{aprovadas}h</p></DataCard>
        <DataCard className="!p-4"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Pendentes</p><p className="text-xl font-display font-semibold mt-1 text-warning">{pendentes}h</p></DataCard>
      </div>

      {isConsultor && (
        <DataCard>
          <h4 className="font-display font-semibold text-foreground mb-3">Lançar horas</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Horas</Label>
              <Input type="number" step="0.25" min="0.25" max="24" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="2.5" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Fase</Label>
              <Select value={faseId} onValueChange={setFaseId}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {fases.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-4">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="O que foi feito?" />
            </div>
          </div>
          <Button size="sm" className="mt-3" onClick={lancar} disabled={enviando}>
            <Plus size={14} /> {enviando ? "Lançando..." : "Lançar"}
          </Button>
        </DataCard>
      )}

      <DataCard>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h4 className="font-display font-semibold text-foreground">Relatório / Filtros</h4>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={limparFiltros}>Limpar</Button>
            <Button size="sm" variant="outline" onClick={exportCSV} disabled={!lancamentosFiltrados.length}>
              <Download size={14} /> CSV
            </Button>
            <Button size="sm" onClick={exportPDF} disabled={!lancamentosFiltrados.length}>
              <FileText size={14} /> PDF
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Data inicial</Label>
            <Input type="date" value={filtroDataIni} onChange={(e) => setFiltroDataIni(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Data final</Label>
            <Input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="reprovado">Reprovado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Consultor</Label>
            <Select value={filtroConsultor} onValueChange={setFiltroConsultor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {consultoresUnicos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Fase</Label>
            <Select value={filtroFase} onValueChange={setFiltroFase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="_sem_">Sem fase</SelectItem>
                {fases.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Agrupar por</Label>
            <Select value={agruparPor} onValueChange={setAgruparPor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhum</SelectItem>
                <SelectItem value="consultor">Consultor</SelectItem>
                <SelectItem value="fase">Fase</SelectItem>
                <SelectItem value="semana">Semana</SelectItem>
                <SelectItem value="mes">Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {lancamentosFiltrados.length} lançamento(s) • <span className="font-medium text-foreground">{totalFiltrado.toFixed(2)}h</span> no filtro atual
        </p>
      </DataCard>

      {agrupado && agrupado.length > 0 && (
        <DataCard className="!p-0 overflow-hidden">
          <div className="p-3 bg-muted/30 border-b border-border">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Agrupado por {agruparPor}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Grupo</th>
                  <th className="text-center p-3">Lançamentos</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-right p-3 text-success">Aprovadas</th>
                  <th className="text-right p-3 text-warning">Pendentes</th>
                  <th className="text-right p-3 text-destructive">Reprovadas</th>
                </tr>
              </thead>
              <tbody>
                {agrupado.map((g) => (
                  <tr key={g.key} className="border-t border-border">
                    <td className="p-3 font-medium">{g.label}</td>
                    <td className="p-3 text-center text-muted-foreground">{g.count}</td>
                    <td className="p-3 text-right font-semibold">{g.horas.toFixed(2)}h</td>
                    <td className="p-3 text-right text-success">{g.aprovadas.toFixed(2)}h</td>
                    <td className="p-3 text-right text-warning">{g.pendentes.toFixed(2)}h</td>
                    <td className="p-3 text-right text-destructive">{g.reprovadas.toFixed(2)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}

      {lancamentosFiltrados.length === 0 ? (
        <DataCard><EmptyState message="Nenhum lançamento no filtro atual" icon={Clock} /></DataCard>
      ) : (
        <DataCard className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Consultor</th>
                  <th className="text-left p-3">Fase</th>
                  <th className="text-left p-3">Descrição</th>
                  <th className="text-right p-3">Horas</th>
                  <th className="text-center p-3">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {lancamentosFiltrados.map((l) => {
                  const fase = fases.find((f) => f.id === l.fase_id);
                  return (
                    <tr key={l.id} className="border-t border-border">
                      <td className="p-3">{new Date(l.data_execucao + "T00:00").toLocaleDateString("pt-BR")}</td>
                      <td className="p-3">{profiles.get(l.consultor_user_id) || "—"}</td>
                      <td className="p-3 text-muted-foreground">{fase?.nome || "—"}</td>
                      <td className="p-3 text-muted-foreground max-w-[260px] truncate">{l.descricao || "—"}</td>
                      <td className="p-3 text-right font-medium">{Number(l.horas).toFixed(2)}h</td>
                      <td className="p-3 text-center">
                        {l.aprovado === true && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">Aprovado</span>}
                        {l.aprovado === false && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">Reprovado</span>}
                        {l.aprovado === null && <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">Pendente</span>}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {isEmpresa && l.aprovado === null && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => aprovar(l.id, true)} title="Aprovar"><CheckCircle2 size={14} className="text-success" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => aprovar(l.id, false)} title="Reprovar"><XCircle size={14} className="text-destructive" /></Button>
                          </>
                        )}
                        {l.consultor_user_id === user?.id && l.aprovado === null && (
                          <Button size="sm" variant="ghost" onClick={() => remover(l.id)} title="Remover"><Trash2 size={14} /></Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}
    </div>
  );
};
