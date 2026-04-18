import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DataCard, EmptyState } from "@/components/dashboard/DashboardComponents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Plus, CheckCircle2, XCircle, Trash2 } from "lucide-react";

export const Timesheet = ({
  projetoId,
  fases,
  isConsultor,
  isEmpresa,
}: { projetoId: string; fases: any[]; isConsultor: boolean; isEmpresa: boolean }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [horas, setHoras] = useState("");
  const [faseId, setFaseId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);

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

  const total = lancamentos.reduce((s, l) => s + Number(l.horas || 0), 0);
  const aprovadas = lancamentos.filter((l) => l.aprovado === true).reduce((s, l) => s + Number(l.horas || 0), 0);
  const pendentes = lancamentos.filter((l) => l.aprovado === null).reduce((s, l) => s + Number(l.horas || 0), 0);

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

      {lancamentos.length === 0 ? (
        <DataCard><EmptyState message="Nenhum lançamento ainda" icon={Clock} /></DataCard>
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
                {lancamentos.map((l) => {
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
