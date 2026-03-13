import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, DataCard, StatusBadge, EmptyState, LoadingState, SectionTitle } from "@/components/dashboard/DashboardComponents";
import { FolderKanban, Eye, MapPin, Clock, DollarSign, User, Zap } from "lucide-react";
import { ConsultorMatchList } from "@/components/matching/ConsultorMatchList";

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
    const { data } = await supabase.from("projetos").select("*, softwares(nome), projeto_fases(id, nome, status, valor)").eq("empresa_user_id", user!.id).order("created_at", { ascending: false });
    if (data) setProjetos(data);
  };

  return (
    <div>
      <PageHeader title="Meus Projetos" description="Acompanhe e gerencie todos os seus projetos" />

      {loading ? <DataCard><LoadingState /></DataCard> : projetos.length === 0 ? (
        <DataCard><EmptyState message="Nenhum projeto criado ainda" icon={FolderKanban} /></DataCard>
      ) : (
        <div className="space-y-4">
          {projetos.map((p) => (
            <DataCard key={p.id}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3.5">
                  <div className="icon-container icon-container-md bg-primary/10 mt-0.5">
                    <FolderKanban size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-foreground text-[15px]">{p.nome}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.softwares?.nome} · {p.protocolo}</p>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>

              {p.projeto_fases && p.projeto_fases.length > 0 && (
                <div className="ml-[54px] mb-4">
                  <div className="flex gap-1.5">
                    {p.projeto_fases.map((f: any) => (
                      <div key={f.id} className="flex-1">
                        <div className={`h-2 rounded-full mb-1 ${
                          f.status === "aprovada" ? "bg-success" : f.status === "em_andamento" ? "bg-primary" : "bg-border"
                        }`} />
                        <p className="text-[10px] text-muted-foreground truncate">{f.nome}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(p.status === "publicado" || p.status === "em_selecao") && (
                <div className="ml-[54px] flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => viewPropostas(p)}>
                    <Eye size={14} /> Ver propostas
                  </Button>
                </div>
              )}

              {(p.status === "publicado" || p.status === "em_selecao") && (
                <div className="ml-[54px]">
                  <ConsultorMatchList projetoId={p.id} softwareId={p.software_id} />
                </div>
              )}
            </DataCard>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Propostas — {selectedProjeto?.nome}</DialogTitle>
          </DialogHeader>
          {propostas.length === 0 ? (
            <EmptyState message="Nenhuma proposta recebida ainda" icon={User} />
          ) : (
            <div className="space-y-3">
              {propostas.map((prop) => (
                <div key={prop.id} className="border border-border/60 rounded-xl p-4 bg-muted/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground text-xs font-semibold">
                        {prop.consultor?.nome?.charAt(0) || "C"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{prop.consultor?.nome}</p>
                        {prop.consultor?.cidade && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <MapPin size={10} /> {prop.consultor.cidade}{prop.consultor.estado && `, ${prop.consultor.estado}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={prop.status} />
                  </div>
                  <div className="flex items-center gap-4 mt-3 mb-2">
                    {prop.estimativa_horas && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={12} /> {prop.estimativa_horas}h
                      </span>
                    )}
                    {prop.valor_proposta && (
                      <span className="text-xs text-foreground font-medium flex items-center gap-1">
                        <DollarSign size={12} /> R$ {Number(prop.valor_proposta).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>
                  {prop.comentarios && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{prop.comentarios}</p>}
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
