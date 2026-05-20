import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, X, Inbox } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Alocacao {
  id: string;
  projeto_id: string;
  consultor_user_id: string;
  valor: number | null;
  prazo_estimado: string | null;
  status: string;
  created_at: string;
}

const CanalAprovacoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Alocacao[]>([]);
  const [projetos, setProjetos] = useState<Record<string, string>>({});
  const [consultores, setConsultores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // recusa dialog
  const [recusaOpen, setRecusaOpen] = useState(false);
  const [recusaTarget, setRecusaTarget] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState("");

  const carregar = async () => {
    if (!user) return;
    setLoading(true);
    const { data: canalRow } = await supabase.from("canais").select("id").eq("user_id", user.id).single();
    if (!canalRow) { setLoading(false); return; }
    const { data } = await supabase
      .from("alocacoes")
      .select("*")
      .eq("canal_id", canalRow.id)
      .eq("status", "pendente_aprovacao")
      .order("created_at", { ascending: false });
    const list = (data as Alocacao[]) || [];
    setItems(list);

    const projIds = [...new Set(list.map(i => i.projeto_id))];
    const consIds = [...new Set(list.map(i => i.consultor_user_id))];
    if (projIds.length) {
      const { data: ps } = await supabase.from("projetos").select("id, nome").in("id", projIds);
      const m: Record<string, string> = {};
      (ps || []).forEach((p: any) => { m[p.id] = p.nome; });
      setProjetos(m);
    }
    if (consIds.length) {
      const { data: cs } = await supabase.from("profiles").select("user_id, nome").in("user_id", consIds);
      const m: Record<string, string> = {};
      (cs || []).forEach((p: any) => { m[p.user_id] = p.nome; });
      setConsultores(m);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [user?.id]);

  const responder = async (id: string, aprovar: boolean, motivo?: string) => {
    setProcessing(id);
    const { error } = await supabase.rpc("responder_alocacao_canal", {
      p_alocacao_id: id,
      p_aprovar: aprovar,
      p_justificativa: motivo ?? null,
    });
    setProcessing(null);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: aprovar ? "Alocação aprovada" : "Alocação recusada" });
    carregar();
  };

  const abrirRecusa = (id: string) => {
    setRecusaTarget(id);
    setJustificativa("");
    setRecusaOpen(true);
  };

  const confirmarRecusa = async () => {
    if (!recusaTarget) return;
    await responder(recusaTarget, false, justificativa || undefined);
    setRecusaOpen(false);
    setRecusaTarget(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Aprovações pendentes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Aloções de consultores do seu canal aguardando sua aprovação para entrar nos projetos.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center">
          <Inbox className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">Sem aprovações pendentes</p>
          <p className="text-sm text-muted-foreground mt-1">Tudo em dia por aqui.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary">Pendente</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="font-medium text-foreground">
                    {consultores[a.consultor_user_id] || "Consultor"} →{" "}
                    <span className="text-muted-foreground font-normal">{projetos[a.projeto_id] || "Projeto"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {a.valor ? `R$ ${Number(a.valor).toLocaleString("pt-BR")}` : "Sem valor"}
                    {a.prazo_estimado ? ` · prazo ${new Date(a.prazo_estimado).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => abrirRecusa(a.id)} disabled={processing === a.id}>
                    <X className="h-4 w-4 mr-1" /> Recusar
                  </Button>
                  <Button size="sm" onClick={() => responder(a.id, true)} disabled={processing === a.id}>
                    {processing === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Aprovar</>}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={recusaOpen} onOpenChange={setRecusaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recusar alocação</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Justificativa (opcional)"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecusaOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarRecusa}>Recusar alocação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CanalAprovacoes;
