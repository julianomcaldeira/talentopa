import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const ConsultorProjetos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposalDialog, setProposalDialog] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<any>(null);
  const [proposalForm, setProposalForm] = useState({ estimativa_horas: "", valor_proposta: "", comentarios: "" });

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("projetos")
        .select("*, softwares(nome), empresa:profiles!projetos_empresa_user_id_fkey(nome)")
        .in("status", ["publicado", "em_selecao"])
        .order("created_at", { ascending: false });
      if (data) setProjetos(data);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleProposal = async () => {
    if (!user || !selectedProjeto) return;
    const { error } = await supabase.from("propostas").insert({
      projeto_id: selectedProjeto.id,
      consultor_user_id: user.id,
      estimativa_horas: Number(proposalForm.estimativa_horas) || null,
      valor_proposta: Number(proposalForm.valor_proposta) || null,
      comentarios: proposalForm.comentarios || null,
    });
    if (error) {
      toast({ title: "Erro", description: error.message === '23505' ? "Você já enviou proposta para este projeto" : error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Proposta enviada com sucesso!" });
    setProposalDialog(false);
    setProposalForm({ estimativa_horas: "", valor_proposta: "", comentarios: "" });
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-2">Projetos Disponíveis</h1>
      <p className="text-muted-foreground mb-6">Projetos compatíveis com seu perfil técnico</p>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Carregando...</div>
      ) : projetos.length === 0 ? (
        <div className="bg-card rounded-xl p-12 shadow-card border border-border text-center text-muted-foreground">
          Nenhum projeto disponível no momento
        </div>
      ) : (
        <div className="space-y-4">
          {projetos.map((p) => (
            <div key={p.id} className="bg-card rounded-xl p-6 shadow-card border border-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-display font-semibold text-foreground text-lg">{p.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    {p.softwares?.nome} • {p.empresa?.nome} • Protocolo: {p.protocolo}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  p.status === "publicado" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
                }`}>
                  {p.status === "publicado" ? "Aberto" : "Em seleção"}
                </span>
              </div>
              {p.descricao && <p className="text-sm text-muted-foreground mb-3">{p.descricao}</p>}
              {p.objetivo && <p className="text-sm text-foreground mb-3"><strong>Objetivo:</strong> {p.objetivo}</p>}
              {p.prazo_estimado && <p className="text-sm text-muted-foreground mb-4">Prazo: {new Date(p.prazo_estimado).toLocaleDateString("pt-BR")}</p>}
              <Button onClick={() => { setSelectedProjeto(p); setProposalDialog(true); }}>
                Enviar proposta
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={proposalDialog} onOpenChange={setProposalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Enviar proposta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">{selectedProjeto?.nome}</p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimativa de horas</Label>
                <Input type="number" value={proposalForm.estimativa_horas} onChange={(e) => setProposalForm({ ...proposalForm, estimativa_horas: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Valor da proposta (R$)</Label>
                <Input type="number" value={proposalForm.valor_proposta} onChange={(e) => setProposalForm({ ...proposalForm, valor_proposta: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Comentários técnicos</Label>
              <Textarea value={proposalForm.comentarios} onChange={(e) => setProposalForm({ ...proposalForm, comentarios: e.target.value })} rows={3} placeholder="Descreva sua abordagem..." />
            </div>
            <Button className="w-full" onClick={handleProposal}>Enviar proposta</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsultorProjetos;
