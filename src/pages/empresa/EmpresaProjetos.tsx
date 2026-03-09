import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const EmpresaProjetos = () => {
  const { user } = useAuth();
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjeto, setSelectedProjeto] = useState<any>(null);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("projetos")
        .select("*, softwares(nome), projeto_fases(id, nome, status, valor)")
        .eq("empresa_user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setProjetos(data);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const viewPropostas = async (projeto: any) => {
    setSelectedProjeto(projeto);
    const { data } = await supabase
      .from("propostas")
      .select("*, consultor:profiles!propostas_consultor_user_id_fkey(nome, cidade, estado)")
      .eq("projeto_id", projeto.id)
      .order("created_at", { ascending: false });
    if (data) setPropostas(data);
    setDialogOpen(true);
  };

  const acceptProposal = async (propostaId: string) => {
    await supabase.from("propostas").update({ status: "aceita" as const }).eq("id", propostaId);
    if (selectedProjeto) {
      await supabase.from("projetos").update({ status: "em_andamento" as const }).eq("id", selectedProjeto.id);
    }
    setDialogOpen(false);
    // Refresh
    const { data } = await supabase.from("projetos").select("*, softwares(nome), projeto_fases(id, nome, status, valor)").eq("empresa_user_id", user!.id).order("created_at", { ascending: false });
    if (data) setProjetos(data);
  };

  const statusLabels: Record<string, string> = {
    rascunho: "Rascunho", publicado: "Publicado", em_selecao: "Em seleção",
    em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado",
  };
  const statusColors: Record<string, string> = {
    rascunho: "bg-muted text-muted-foreground", publicado: "bg-primary/10 text-primary",
    em_selecao: "bg-warning/10 text-warning", em_andamento: "bg-info/10 text-info",
    concluido: "bg-success/10 text-success", cancelado: "bg-destructive/10 text-destructive",
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-2">Meus Projetos</h1>
      <p className="text-muted-foreground mb-6">Acompanhe todos os seus projetos</p>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Carregando...</div>
      ) : projetos.length === 0 ? (
        <div className="bg-card rounded-xl p-12 shadow-card border border-border text-center text-muted-foreground">
          Nenhum projeto criado ainda
        </div>
      ) : (
        <div className="space-y-4">
          {projetos.map((p) => (
            <div key={p.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-display font-semibold text-foreground">{p.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    {p.softwares?.nome} • {p.protocolo}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[p.status] || ""}`}>
                  {statusLabels[p.status] || p.status}
                </span>
              </div>
              {p.projeto_fases && p.projeto_fases.length > 0 && (
                <div className="flex gap-1 mt-3 mb-3">
                  {p.projeto_fases.map((f: any) => (
                    <div key={f.id} className={`flex-1 h-1.5 rounded-full ${
                      f.status === "aprovada" ? "bg-success" : f.status === "em_andamento" ? "bg-primary" : "bg-muted"
                    }`} title={f.nome} />
                  ))}
                </div>
              )}
              {(p.status === "publicado" || p.status === "em_selecao") && (
                <Button size="sm" variant="outline" onClick={() => viewPropostas(p)}>
                  Ver propostas
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Propostas - {selectedProjeto?.nome}</DialogTitle>
          </DialogHeader>
          {propostas.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhuma proposta recebida</p>
          ) : (
            <div className="space-y-3">
              {propostas.map((prop) => (
                <div key={prop.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-foreground">{prop.consultor?.nome}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      prop.status === "aceita" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    }`}>{prop.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{prop.consultor?.cidade}, {prop.consultor?.estado}</p>
                  {prop.estimativa_horas && <p className="text-sm text-foreground mt-1">Horas: {prop.estimativa_horas}h</p>}
                  {prop.valor_proposta && <p className="text-sm text-foreground">Valor: R$ {Number(prop.valor_proposta).toLocaleString("pt-BR")}</p>}
                  {prop.comentarios && <p className="text-sm text-muted-foreground mt-1">{prop.comentarios}</p>}
                  {prop.status === "enviada" && (
                    <Button size="sm" className="mt-3" onClick={() => acceptProposal(prop.id)}>
                      Aceitar proposta
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmpresaProjetos;
