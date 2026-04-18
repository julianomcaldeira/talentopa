import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DataCard, EmptyState } from "@/components/dashboard/DashboardComponents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Plus, Link as LinkIcon, Trash2, Save } from "lucide-react";

export const ReunioesAtas = ({ projetoId, podeEscrever }: { projetoId: string; podeEscrever: boolean }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reunioes, setReunioes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [link, setLink] = useState("");
  const [pauta, setPauta] = useState("");
  const [editAtaId, setEditAtaId] = useState<string | null>(null);
  const [ataTexto, setAtaTexto] = useState("");

  const fetch = async () => {
    const { data } = await (supabase as any)
      .from("projeto_reunioes")
      .select("*")
      .eq("projeto_id", projetoId)
      .order("data_reuniao", { ascending: false });
    setReunioes(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); /* eslint-disable-next-line */ }, [projetoId]);

  const criarReuniao = async () => {
    if (!user || !titulo.trim() || !data) {
      toast({ title: "Informe título e data", variant: "destructive" });
      return;
    }
    setCriando(true);
    const { error } = await (supabase as any).from("projeto_reunioes").insert({
      projeto_id: projetoId,
      titulo: titulo.trim(),
      data_reuniao: new Date(data).toISOString(),
      link: link.trim() || null,
      pauta: pauta.trim() || null,
      criado_por: user.id,
    });
    setCriando(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setTitulo(""); setData(""); setLink(""); setPauta("");
    toast({ title: "Reunião criada" });
    fetch();
  };

  const salvarAta = async (id: string) => {
    const { error } = await (supabase as any)
      .from("projeto_reunioes")
      .update({ ata: ataTexto })
      .eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setEditAtaId(null);
    fetch();
  };

  const remover = async (id: string) => {
    await (supabase as any).from("projeto_reunioes").delete().eq("id", id);
    fetch();
  };

  return (
    <div className="space-y-3">
      {podeEscrever && (
        <DataCard>
          <h4 className="font-display font-semibold text-foreground mb-3">Agendar reunião</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Kickoff" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Data e hora</Label>
              <Input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Link (Meet, Zoom...)</Label>
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Pauta</Label>
              <Textarea value={pauta} onChange={(e) => setPauta(e.target.value)} rows={2} />
            </div>
          </div>
          <Button size="sm" className="mt-3" onClick={criarReuniao} disabled={criando}>
            <Plus size={14} /> {criando ? "Agendando..." : "Agendar"}
          </Button>
        </DataCard>
      )}

      {loading ? null : reunioes.length === 0 ? (
        <DataCard><EmptyState message="Nenhuma reunião agendada" icon={Calendar} /></DataCard>
      ) : reunioes.map((r) => (
        <DataCard key={r.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-display font-semibold text-foreground">{r.titulo}</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {new Date(r.data_reuniao).toLocaleString("pt-BR")} · {r.duracao_min}min
              </p>
            </div>
            {r.criado_por === user?.id && (
              <Button size="sm" variant="ghost" onClick={() => remover(r.id)}>
                <Trash2 size={14} />
              </Button>
            )}
          </div>
          {r.pauta && <p className="text-sm text-foreground mt-3"><span className="text-muted-foreground text-xs">Pauta:</span> {r.pauta}</p>}
          {r.link && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => window.open(r.link, "_blank")}>
              <LinkIcon size={12} /> Entrar na reunião
            </Button>
          )}

          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Ata</p>
            {editAtaId === r.id ? (
              <>
                <Textarea value={ataTexto} onChange={(e) => setAtaTexto(e.target.value)} rows={4} placeholder="Decisões, ações, responsáveis..." />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => salvarAta(r.id)}><Save size={12} /> Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditAtaId(null)}>Cancelar</Button>
                </div>
              </>
            ) : (
              <>
                {r.ata ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{r.ata}</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Sem ata registrada.</p>
                )}
                {podeEscrever && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => { setEditAtaId(r.id); setAtaTexto(r.ata || ""); }}>
                    {r.ata ? "Editar ata" : "Adicionar ata"}
                  </Button>
                )}
              </>
            )}
          </div>
        </DataCard>
      ))}
    </div>
  );
};
