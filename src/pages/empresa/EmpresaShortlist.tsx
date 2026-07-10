import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ListChecks, CheckCircle2, Users } from "lucide-react";

type Projeto = { id: string; nome: string; status: string; empresa_user_id: string; coordenador_user_id: string | null };
type Proposta = { id: string; projeto_id: string; consultor_user_id: string; valor_proposta: number | null; status: string; consultor_nome?: string };
type ShortlistItem = { id: string; proposta_id: string; status: string };

export default function EmpresaShortlist() {
  const { user, empresaPapel } = useAuth();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [propostas, setPropostas] = useState<Record<string, Proposta[]>>({});
  const [shortlists, setShortlists] = useState<Record<string, ShortlistItem[]>>({});
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [empresaOwnerId, setEmpresaOwnerId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;
    // Descobre a empresa dona a que este RMO pertence.
    // - Se o usuário é o próprio dono da empresa, usa o próprio id.
    // - Se é sub-usuário (RMO), busca empresa_user_id em empresa_usuarios.
    let ownerId: string | null = null;
    if (empresaPapel === "rmo") {
      const { data: eu } = await supabase
        .from("empresa_usuarios")
        .select("empresa_user_id")
        .eq("user_id", user.id)
        .eq("papel", "rmo" as any)
        .maybeSingle();
      ownerId = (eu?.empresa_user_id as string) || null;
    } else {
      ownerId = user.id; // dono da empresa
    }
    setEmpresaOwnerId(ownerId);
    if (!ownerId) {
      setLoading(false);
      return;
    }

    const { data: projs } = await supabase
      .from("projetos")
      .select("id,nome,status,empresa_user_id,coordenador_user_id")
      .eq("empresa_user_id", ownerId)
      .in("status", ["publicado", "em_selecao"]);
    setProjetos((projs as Projeto[]) || []);

    if (projs && projs.length) {
      const projIds = projs.map((p) => p.id);
      const { data: props } = await supabase
        .from("propostas")
        .select("id,projeto_id,consultor_user_id,valor_proposta,status")
        .in("projeto_id", projIds)
        .in("status", ["enviada", "pre_aprovada", "contraproposta_consultor"]);

      const userIds = [...new Set((props || []).map((p) => p.consultor_user_id))];
      const { data: profs } = await supabase.from("profiles").select("user_id,nome").in("user_id", userIds);
      const nomeMap = new Map((profs || []).map((p) => [p.user_id, p.nome]));

      const propsByProj: Record<string, Proposta[]> = {};
      (props || []).forEach((p) => {
        const arr = propsByProj[p.projeto_id] || [];
        arr.push({ ...p, consultor_nome: nomeMap.get(p.consultor_user_id) || "Consultor" });
        propsByProj[p.projeto_id] = arr;
      });
      setPropostas(propsByProj);

      const { data: sl } = await (supabase as any)
        .from("projeto_shortlist")
        .select("id,projeto_id,proposta_id,status")
        .in("projeto_id", projIds);
      const slByProj: Record<string, ShortlistItem[]> = {};
      (sl || []).forEach((s: any) => {
        const arr = slByProj[s.projeto_id] || [];
        arr.push(s);
        slByProj[s.projeto_id] = arr;
      });
      setShortlists(slByProj);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user, empresaPapel]);

  const toggle = (projetoId: string, propostaId: string) => {
    setSelected((prev) => {
      const set = new Set(prev[projetoId] || []);
      if (set.has(propostaId)) set.delete(propostaId);
      else set.add(propostaId);
      return { ...prev, [projetoId]: set };
    });
  };

  const enviarShortlist = async (projetoId: string) => {
    const set = selected[projetoId];
    if (!set || set.size === 0) {
      toast.error("Selecione pelo menos uma proposta");
      return;
    }
    try {
      const { error } = await (supabase as any).rpc("rmo_montar_shortlist", {
        p_projeto_id: projetoId,
        p_proposta_ids: Array.from(set),
      });
      if (error) throw error;
      toast.success(`Shortlist enviada (${set.size} propostas)`);
      setSelected((prev) => ({ ...prev, [projetoId]: new Set() }));
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar shortlist");
    }
  };

  const aprovarFinal = async (shortlistId: string) => {
    if (!confirm("Confirmar seleção final desta proposta? As outras serão recusadas.")) return;
    try {
      const { error } = await (supabase as any).rpc("rmo_aprovacao_final", { p_shortlist_id: shortlistId });
      if (error) throw error;
      toast.success("Consultor selecionado. Aguarde confirmação.");
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Falha na aprovação");
    }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;

  const isRmoSemEmpresa = empresaPapel === "rmo" && !empresaOwnerId;
  if (isRmoSemEmpresa) {
    return <div className="p-8 text-sm text-muted-foreground">Você ainda não está vinculado como RMO a nenhuma empresa.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <ListChecks size={22} /> Shortlists (RMO)
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Selecione as propostas mais promissoras de cada projeto e envie para o Coordenador dar parecer técnico. Depois, aprove a escolha final.
        </p>
      </div>

      {projetos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum projeto em seleção.
          </CardContent>
        </Card>
      ) : (
        projetos.map((p) => {
          const props = propostas[p.id] || [];
          const sl = shortlists[p.id] || [];
          const slPropostaIds = new Set(sl.map((s) => s.proposta_id));
          const set = selected[p.id] || new Set();
          const podeAprovarFinal = sl.some((s) => s.status === "aprovada_coordenador");
          return (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.nome}</CardTitle>
                  <Badge>{p.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {props.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem propostas ainda.</p>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Users size={12} /> {props.length} proposta(s)
                    </div>
                    <div className="divide-y">
                      {props.map((pr) => {
                        const jaShortlist = slPropostaIds.has(pr.id);
                        const slItem = sl.find((s) => s.proposta_id === pr.id);
                        return (
                          <div key={pr.id} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-3">
                              {!jaShortlist && (
                                <Checkbox
                                  checked={set.has(pr.id)}
                                  onCheckedChange={() => toggle(p.id, pr.id)}
                                />
                              )}
                              <div>
                                <p className="text-sm font-medium">{pr.consultor_nome}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  R$ {pr.valor_proposta?.toLocaleString("pt-BR") || "—"} · {pr.status}
                                </p>
                              </div>
                            </div>
                            {jaShortlist && slItem && (
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{slItem.status}</Badge>
                                {slItem.status === "aprovada_coordenador" && (
                                  <Button size="sm" onClick={() => aprovarFinal(slItem.id)}>
                                    <CheckCircle2 size={14} className="mr-1" /> Selecionar
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {set.size > 0 && (
                      <Button onClick={() => enviarShortlist(p.id)}>
                        Enviar shortlist ({set.size})
                      </Button>
                    )}
                    {podeAprovarFinal && (
                      <p className="text-xs text-muted-foreground">
                        Coordenador já aprovou candidatos. Clique em "Selecionar" no card do escolhido.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
