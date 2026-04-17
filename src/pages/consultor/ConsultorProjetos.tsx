import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PageHeader, DataCard, StatusBadge, EmptyState, LoadingState } from "@/components/dashboard/DashboardComponents";
import { FolderKanban, Send, Calendar, Target, Star, MessageSquare, Eye } from "lucide-react";
import { ProjectCommunication } from "@/components/communication/ProjectCommunication";
import { ProjetoDetalhesDialog, ModeloContratacaoBadge } from "@/components/projetos/ProjetoDetalhesDialog";

const ConsultorProjetos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposalDialog, setProposalDialog] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<any>(null);
  const [proposalForm, setProposalForm] = useState({ estimativa_horas: "", valor_proposta: "", comentarios: "" });
  const [mySkills, setMySkills] = useState<any[]>([]);
  const [projetoScopes, setProjetoScopes] = useState<Map<string, { modulos: string[]; funcs: string[] }>>(new Map());
  const [chatProjeto, setChatProjeto] = useState<any>(null);
  const [myPropostas, setMyPropostas] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [projRes, skillsRes, propRes] = await Promise.all([
        supabase.from("projetos")
          .select("*, softwares(nome)")
          .in("status", ["publicado", "em_selecao"])
          .order("created_at", { ascending: false }),
        supabase.from("consultor_habilidades")
          .select("software_id, modulo_id, funcionalidade_id, nivel")
          .eq("user_id", user.id),
        supabase.from("propostas")
          .select("projeto_id")
          .eq("consultor_user_id", user.id),
      ]);

      const projs = projRes.data || [];
      if (skillsRes.data) setMySkills(skillsRes.data);
      if (propRes.data) setMyPropostas(new Set(propRes.data.map(p => p.projeto_id)));

      if (projs.length > 0) {
        const projIds = projs.map(p => p.id);
        const empresaIds = [...new Set(projs.map(p => p.empresa_user_id))];
        const [modRes, funcRes, empRes] = await Promise.all([
          supabase.from("projeto_modulos").select("projeto_id, modulo_id").in("projeto_id", projIds),
          supabase.from("projeto_funcionalidades").select("projeto_id, funcionalidade_id").in("projeto_id", projIds),
          supabase.from("profiles").select("user_id, nome").in("user_id", empresaIds),
        ]);
        const scopeMap = new Map<string, { modulos: string[]; funcs: string[] }>();
        projIds.forEach(id => scopeMap.set(id, { modulos: [], funcs: [] }));
        (modRes.data || []).forEach(m => scopeMap.get(m.projeto_id)?.modulos.push(m.modulo_id));
        (funcRes.data || []).forEach(f => scopeMap.get(f.projeto_id)?.funcs.push(f.funcionalidade_id));
        setProjetoScopes(scopeMap);

        // Attach empresa name to projects
        const empMap = new Map((empRes.data || []).map(e => [e.user_id, e.nome]));
        projs.forEach(p => { (p as any).empresa_nome = empMap.get(p.empresa_user_id) || "Empresa"; });
      }

      setProjetos(projs);
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  const handleProposal = async () => {
    if (!user || !selectedProjeto) return;
    const { error } = await supabase.from("propostas").insert({
      projeto_id: selectedProjeto.id, consultor_user_id: user.id,
      estimativa_horas: Number(proposalForm.estimativa_horas) || null,
      valor_proposta: Number(proposalForm.valor_proposta) || null,
      comentarios: proposalForm.comentarios || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Proposta enviada com sucesso!" });
    setProposalDialog(false);
    setProposalForm({ estimativa_horas: "", valor_proposta: "", comentarios: "" });
  };

  const getMatchScore = (projeto: any): number => {
    if (!projeto.software_id || mySkills.length === 0) return 0;
    const relevantSkills = mySkills.filter(s => s.software_id === projeto.software_id);
    if (relevantSkills.length === 0) return 0;

    let score = 20;
    const scope = projetoScopes.get(projeto.id);
    if (scope) {
      if (scope.modulos.length > 0) {
        const matched = relevantSkills.filter(s => s.modulo_id && scope.modulos.includes(s.modulo_id)).length;
        score += Math.round((matched / scope.modulos.length) * 40);
      }
      if (scope.funcs.length > 0) {
        const matched = relevantSkills.filter(s => s.funcionalidade_id && scope.funcs.includes(s.funcionalidade_id)).length;
        score += Math.round((matched / scope.funcs.length) * 30);
      }
    }
    const nivelW: Record<string, number> = { junior: 1, pleno: 2, senior: 3, especialista: 4 };
    const maxN = Math.max(...relevantSkills.map(s => nivelW[s.nivel] || 1));
    score += Math.round((maxN / 4) * 10);
    return Math.min(score, 100);
  };

  const scoreColor = (s: number) => s >= 75 ? "text-success" : s >= 50 ? "text-warning" : "text-muted-foreground";
  const scoreBg = (s: number) => s >= 75 ? "bg-success/10 border-success/20" : s >= 50 ? "bg-warning/10 border-warning/20" : "bg-muted/50 border-border";

  const sortedProjetos = [...projetos].sort((a, b) => getMatchScore(b) - getMatchScore(a));

  return (
    <div>
      <PageHeader title="Projetos Disponíveis" description="Encontre projetos compatíveis com seu perfil técnico" />

      {loading ? <DataCard><LoadingState /></DataCard> : projetos.length === 0 ? (
        <DataCard><EmptyState message="Nenhum projeto disponível no momento" icon={FolderKanban} /></DataCard>
      ) : (
        <div className="space-y-4">
          {sortedProjetos.map((p) => {
            const score = getMatchScore(p);
            return (
              <DataCard key={p.id}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3.5">
                    <div className="icon-container icon-container-md bg-primary/10 mt-0.5">
                      <FolderKanban size={18} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-foreground text-base">{p.nome}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.softwares?.nome} · {p.empresa_nome || "Empresa"} · {p.protocolo}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {score > 0 && (
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${scoreBg(score)} ${scoreColor(score)}`}>
                        <Star size={12} />
                        {score}% match
                      </div>
                    )}
                    <StatusBadge status={p.status} labels={{ publicado: "Aberto", em_selecao: "Em seleção" }} />
                  </div>
                </div>

                {p.descricao && <p className="text-sm text-muted-foreground mb-3 pl-[54px]">{p.descricao}</p>}

                <div className="flex flex-wrap gap-3 pl-[54px] mb-4">
                  {p.objetivo && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg">
                      <Target size={12} /> {p.objetivo.substring(0, 60)}{p.objetivo.length > 60 ? "..." : ""}
                    </span>
                  )}
                  {p.prazo_estimado && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg">
                      <Calendar size={12} /> {new Date(p.prazo_estimado).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>

                <div className="pl-[54px] flex gap-2">
                  <Button onClick={() => { setSelectedProjeto(p); setProposalDialog(true); }}>
                    <Send size={14} /> Enviar proposta
                  </Button>
                  {myPropostas.has(p.id) && (
                    <Button variant="outline" onClick={() => setChatProjeto(chatProjeto?.id === p.id ? null : p)}>
                      <MessageSquare size={14} /> Comunicação
                    </Button>
                  )}
                </div>
                {chatProjeto?.id === p.id && (
                  <div className="pl-[54px] mt-3">
                    <ProjectCommunication projetoId={p.id} projetoNome={p.nome} isEmpresa={false} />
                  </div>
                )}
              </DataCard>
            );
          })}
        </div>
      )}

      <Dialog open={proposalDialog} onOpenChange={setProposalDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Enviar Proposta</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/40 rounded-xl p-3 mb-2">
            <p className="text-sm font-medium text-foreground">{selectedProjeto?.nome}</p>
            <p className="text-xs text-muted-foreground">{selectedProjeto?.softwares?.nome}</p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estimativa de horas</Label>
                <Input type="number" value={proposalForm.estimativa_horas} onChange={(e) => setProposalForm({ ...proposalForm, estimativa_horas: e.target.value })} placeholder="120" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
                <Input type="number" value={proposalForm.valor_proposta} onChange={(e) => setProposalForm({ ...proposalForm, valor_proposta: e.target.value })} placeholder="36000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comentários técnicos</Label>
              <Textarea value={proposalForm.comentarios} onChange={(e) => setProposalForm({ ...proposalForm, comentarios: e.target.value })} rows={4} placeholder="Descreva sua abordagem, experiência relevante e diferenciais..." />
            </div>
            <Button className="w-full" onClick={handleProposal}>
              <Send size={14} /> Enviar proposta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsultorProjetos;
