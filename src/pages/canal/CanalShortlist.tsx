import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ListChecks, CheckCircle2, Users, ArrowRight } from "lucide-react";

type Projeto = { id: string; nome: string; status: string; canal_id: string | null; coordenador_user_id: string | null };
type Proposta = { id: string; projeto_id: string; consultor_user_id: string; valor_proposta: number | null; status: string; consultor_nome?: string };
type ShortlistItem = { id: string; proposta_id: string; status: string };

export default function CanalShortlist() {
  const { user } = useAuth();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [propostas, setPropostas] = useState<Record<string, Proposta[]>>({});
  const [shortlists, setShortlists] = useState<Record<string, ShortlistItem[]>>({});
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    // canal do usuário (dono ou membro ativo)
    const { data: canalId } = await (supabase as any).rpc("get_user_canal_operador_id", { _user_id: user.id });
    if (!canalId) {
      setLoading(false);
      return;
    }
    const { data: projs } = await supabase
      .from("projetos")
      .select("id,nome,status,canal_id,coordenador_user_id")
      .eq("canal_id", canalId)
      .in("status", ["publicado", "em_selecao"]);
    setProjetos(projs || []);

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
  }, [user]);

  const toggle = (projId: string, propId: string) => {
    setSelected((prev) => {
      const set = new Set(prev[projId] || []);
      if (set.has(propId)) set.delete(propId);
      else set.add(propId);
      return { ...prev, [projId]: set };
    });
  };

  const enviarShortlist = async (projId: string) => {
    const ids = Array.from(selected[projId] || []);
    if (!ids.length) return toast.error("Selecione ao menos uma proposta");
    const { error } = await (supabase as any).rpc("rmo_montar_shortlist", {
      p_projeto_id: projId,
      p_proposta_ids: ids,
    });
    if (error) return toast.error(error.message);
    toast.success("Shortlist enviada ao coordenador");
    setSelected((prev) => ({ ...prev, [projId]: new Set() }));
    fetchData();
  };

  const aprovacaoFinal = async (shortlistId: string) => {
    if (!confirm("Aprovar este candidato como selecionado final? As demais propostas serão recusadas.")) return;
    const { error } = await (supabase as any).rpc("rmo_aprovacao_final", { p_shortlist_id: shortlistId });
    if (error) return toast.error(error.message);
    toast.success("Aprovação final registrada");
    fetchData();
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <ListChecks size={22} /> Shortlists
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Selecione candidatos das propostas recebidas, envie ao Coordenador para parecer técnico e faça a aprovação final.
        </p>
      </div>

      {projetos.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum projeto ativo do canal com propostas em aberto.
          </CardContent>
        </Card>
      )}

      {projetos.map((proj) => {
        const props = propostas[proj.id] || [];
        const sl = shortlists[proj.id] || [];
        const slIds = new Set(sl.map((s) => s.proposta_id));
        return (
          <Card key={proj.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{proj.nome}</CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline">{proj.status}</Badge>
                    {proj.coordenador_user_id ? (
                      <Badge variant="secondary">Coordenador definido</Badge>
                    ) : (
                      <Badge variant="destructive">Sem coordenador</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                  <Users size={12} /> Propostas recebidas
                </p>
                {props.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma proposta ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {props.map((p) => {
                      const naShortlist = slIds.has(p.id);
                      return (
                        <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                          <div className="flex items-center gap-3">
                            {!naShortlist && (
                              <Checkbox
                                checked={selected[proj.id]?.has(p.id) || false}
                                onCheckedChange={() => toggle(proj.id, p.id)}
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium">{p.consultor_nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.valor_proposta ? `R$ ${Number(p.valor_proposta).toLocaleString("pt-BR")}` : "sem valor"} · {p.status}
                              </p>
                            </div>
                          </div>
                          {naShortlist && <Badge>Já na shortlist</Badge>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {props.some((p) => !slIds.has(p.id)) && (
                  <Button className="mt-3" size="sm" onClick={() => enviarShortlist(proj.id)}>
                    <ArrowRight size={14} className="mr-1" /> Enviar ao Coordenador
                  </Button>
                )}
              </div>

              {sl.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Shortlist atual</p>
                  <div className="space-y-2">
                    {sl.map((s) => {
                      const p = props.find((x) => x.id === s.proposta_id);
                      const status = s.status;
                      return (
                        <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{p?.consultor_nome || "Consultor"}</p>
                            <p className="text-xs text-muted-foreground">Status: {status}</p>
                          </div>
                          {status === "aprovada_coordenador" && (
                            <Button size="sm" onClick={() => aprovacaoFinal(s.id)}>
                              <CheckCircle2 size={14} className="mr-1" /> Aprovação final
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
