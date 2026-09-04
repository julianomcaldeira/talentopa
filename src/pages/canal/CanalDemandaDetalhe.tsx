import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, Send, AlertTriangle, Building2, Calendar, DollarSign, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { ParceiroMatchList } from "@/components/matching/ParceiroMatchList";
import { fetchConsultoresDoCanal } from "@/lib/matchScore";

interface Projeto {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  valor_estimado: number | null;
  prazo_estimado: string | null;
  horas_estimadas: number | null;
  software_id: string | null;
  empresa_user_id: string;
  roteamento_v2: boolean;
}

interface IndicacaoRow {
  id?: string; // present when it already exists in DB
  consultor_user_id: string;
  consultor_nome?: string;
  valor_proposto: string; // string for controlled input
  observacao: string;
  status?: string;
}

const CanalDemandaDetalhe = () => {
  const { id: projetoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [canalId, setCanalId] = useState<string | null>(null);
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [empresaNome, setEmpresaNome] = useState<string>("");
  const [softwareNome, setSoftwareNome] = useState<string>("");
  const [modulos, setModulos] = useState<string[]>([]);
  const [funcs, setFuncs] = useState<string[]>([]);

  const [respostaId, setRespostaId] = useState<string | null>(null);
  const [comentariosResposta, setComentariosResposta] = useState<string>("");
  const [indicacoes, setIndicacoes] = useState<Record<string, IndicacaoRow>>({});

  const projetoEditavel = useMemo(
    () => !!projeto && ["publicado", "em_selecao"].includes(projeto.status),
    [projeto]
  );

  useEffect(() => {
    if (!projetoId || !user) return;
    (async () => {
      setLoading(true);

      // Canal do usuário logado
      const { data: canalRow } = await supabase
        .from("canais")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!canalRow) {
        toast({ title: "Canal não encontrado", variant: "destructive" });
        navigate("/canal/projetos");
        return;
      }
      setCanalId(canalRow.id);

      // Projeto
      const { data: projetoRow, error } = await supabase
        .from("projetos")
        .select("id, nome, descricao, status, valor_estimado, prazo_estimado, horas_estimadas, software_id, empresa_user_id, roteamento_v2")
        .eq("id", projetoId)
        .maybeSingle();
      if (error || !projetoRow) {
        toast({ title: "Demanda não encontrada", variant: "destructive" });
        navigate("/canal/projetos");
        return;
      }
      setProjeto(projetoRow as Projeto);

      // Empresa, software, escopo
      const [empresaRes, softwareRes, modulosRes, funcsRes] = await Promise.all([
        supabase.from("empresa_perfil").select("razao_social, nome_fantasia").eq("user_id", projetoRow.empresa_user_id).maybeSingle(),
        projetoRow.software_id
          ? supabase.from("softwares").select("nome").eq("id", projetoRow.software_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase.from("projeto_modulos").select("modulos(nome)").eq("projeto_id", projetoRow.id),
        supabase.from("projeto_funcionalidades").select("funcionalidades(nome)").eq("projeto_id", projetoRow.id),
      ]);
      setEmpresaNome(
        (empresaRes.data as any)?.nome_fantasia ||
        (empresaRes.data as any)?.razao_social || ""
      );
      setSoftwareNome((softwareRes.data as any)?.nome || "");
      setModulos(((modulosRes.data as any[]) || []).map((r) => r.modulos?.nome).filter(Boolean));
      setFuncs(((funcsRes.data as any[]) || []).map((r) => r.funcionalidades?.nome).filter(Boolean));

      // Resposta existente + indicações
      const { data: respRow } = await supabase
        .from("parceiro_respostas")
        .select("id, comentarios, status")
        .eq("projeto_id", projetoRow.id)
        .eq("canal_id", canalRow.id)
        .maybeSingle();

      if (respRow) {
        setRespostaId(respRow.id);
        setComentariosResposta(respRow.comentarios || "");
        const { data: indRows } = await supabase
          .from("parceiro_indicacoes")
          .select("id, consultor_user_id, valor_proposto, observacao, status")
          .eq("resposta_id", respRow.id);

        const map: Record<string, IndicacaoRow> = {};
        const userIds = ((indRows as any[]) || []).map((r) => r.consultor_user_id);
        let nomes: Record<string, string> = {};
        if (userIds.length) {
          const { data: profs } = await supabase
            .from("profiles_public" as any)
            .select("user_id, nome")
            .in("user_id", userIds);
          nomes = Object.fromEntries(((profs as any[]) || []).map((p) => [p.user_id, p.nome]));
        }
        ((indRows as any[]) || []).forEach((r) => {
          map[r.consultor_user_id] = {
            id: r.id,
            consultor_user_id: r.consultor_user_id,
            consultor_nome: nomes[r.consultor_user_id] || "Consultor",
            valor_proposto: r.valor_proposto != null ? String(r.valor_proposto) : "",
            observacao: r.observacao || "",
            status: r.status,
          };
        });
        setIndicacoes(map);
      }

      setLoading(false);
    })();
  }, [projetoId, user, navigate]);

  const selectedActiveIds = useMemo(
    () => Object.values(indicacoes).filter((i) => i.status !== "retirado").map((i) => i.consultor_user_id),
    [indicacoes]
  );

  const handleSelectionChange = async (userIds: string[]) => {
    // Adiciona os que ainda não estão no estado; reativa "retirado" se marcar de novo;
    // marca como "retirado" os que foram desmarcados e já existiam no banco;
    // remove do estado os que ainda não estão no banco e foram desmarcados.
    const set = new Set(userIds);
    setIndicacoes((prev) => {
      const next: Record<string, IndicacaoRow> = { ...prev };

      // Adições / reativações
      userIds.forEach((uid) => {
        if (!next[uid]) {
          next[uid] = { consultor_user_id: uid, valor_proposto: "", observacao: "" };
        } else if (next[uid].status === "retirado") {
          next[uid] = { ...next[uid], status: "indicado" };
        }
      });

      // Remoções
      Object.keys(next).forEach((uid) => {
        if (!set.has(uid)) {
          if (next[uid].id) {
            // já existe no banco → marca como retirado
            next[uid] = { ...next[uid], status: "retirado" };
          } else {
            delete next[uid];
          }
        }
      });

      return next;
    });

    // Precisamos preencher o nome dos novos adicionados (para exibir na lista de valores)
    const semNome = userIds.filter((uid) => !indicacoes[uid]?.consultor_nome);
    if (semNome.length > 0) {
      const { data: profs } = await supabase
        .from("profiles_public" as any)
        .select("user_id, nome")
        .in("user_id", semNome);
      const nomes = Object.fromEntries(((profs as any[]) || []).map((p) => [p.user_id, p.nome]));
      setIndicacoes((prev) => {
        const next = { ...prev };
        semNome.forEach((uid) => {
          if (next[uid]) next[uid] = { ...next[uid], consultor_nome: nomes[uid] || "Consultor" };
        });
        return next;
      });
    }
  };

  const updateIndicacao = (uid: string, patch: Partial<IndicacaoRow>) => {
    setIndicacoes((prev) => ({ ...prev, [uid]: { ...prev[uid], ...patch } }));
  };

  const handleSubmit = async () => {
    if (!user || !canalId || !projeto) return;
    if (!projetoEditavel) {
      toast({ title: "Demanda não está mais aberta para indicações", variant: "destructive" });
      return;
    }

    const ativos = Object.values(indicacoes).filter((i) => i.status !== "retirado");
    const retiradas = Object.values(indicacoes).filter((i) => i.status === "retirado" && i.id);

    if (ativos.length === 0 && retiradas.length === 0) {
      toast({ title: "Selecione ao menos um consultor para indicar", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // Revalida no banco: todo consultor indicado precisa ter vínculo ATIVO com o canal AGORA (RN-08 / CA-06)
      if (ativos.length > 0) {
        const vinculados = await fetchConsultoresDoCanal(canalId);
        const invalidos = ativos.filter((i) => !vinculados.has(i.consultor_user_id));
        if (invalidos.length > 0) {
          toast({
            title: "Vínculo inválido",
            description: `Alguns consultores indicados não têm mais vínculo ativo com o canal. Recarregue a lista e tente novamente.`,
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
      }

      // Detecta duplicidade no front (RN-09) — o UNIQUE do banco é a barreira final
      const uniq = new Set(ativos.map((i) => i.consultor_user_id));
      if (uniq.size !== ativos.length) {
        toast({ title: "Consultor duplicado na indicação", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      // 1) Upsert da resposta
      let respId = respostaId;
      if (!respId) {
        const { data: novo, error: respErr } = await supabase
          .from("parceiro_respostas")
          .insert({
            projeto_id: projeto.id,
            canal_id: canalId,
            respondido_por: user.id,
            comentarios: comentariosResposta || null,
            status: "enviada",
          })
          .select("id")
          .single();
        if (respErr) throw respErr;
        respId = novo!.id;
        setRespostaId(respId);
      } else {
        const { error: updErr } = await supabase
          .from("parceiro_respostas")
          .update({ comentarios: comentariosResposta || null, respondido_por: user.id })
          .eq("id", respId);
        if (updErr) throw updErr;
      }

      // 2) Novas indicações
      const novas = ativos.filter((i) => !i.id);
      if (novas.length > 0) {
        const payload = novas.map((i) => ({
          resposta_id: respId!,
          consultor_user_id: i.consultor_user_id,
          canal_id: canalId, // congela o vínculo no momento (RN-13)
          valor_proposto: i.valor_proposto ? Number(i.valor_proposto.replace(",", ".")) : null,
          observacao: i.observacao || null,
          status: "indicado",
        }));
        const { error: insErr } = await supabase.from("parceiro_indicacoes").insert(payload);
        if (insErr) throw insErr;
      }

      // 3) Atualiza existentes (valor/observação e possível reativação)
      const existentesAtivas = ativos.filter((i) => i.id);
      for (const i of existentesAtivas) {
        const { error: upErr } = await supabase
          .from("parceiro_indicacoes")
          .update({
            valor_proposto: i.valor_proposto ? Number(i.valor_proposto.replace(",", ".")) : null,
            observacao: i.observacao || null,
            status: "indicado",
          })
          .eq("id", i.id!);
        if (upErr) throw upErr;
      }

      // 4) Retiradas (soft): status = 'retirado', nunca DELETE
      for (const i of retiradas) {
        const { error: rmErr } = await supabase
          .from("parceiro_indicacoes")
          .update({ status: "retirado" })
          .eq("id", i.id!);
        if (rmErr) throw rmErr;
      }

      toast({ title: respostaId ? "Indicação atualizada" : "Indicação enviada com sucesso" });
      navigate("/canal/projetos");
    } catch (e: any) {
      toast({
        title: "Erro ao enviar indicação",
        description: e?.message?.includes("duplicate")
          ? "Um dos consultores já estava indicado nesta resposta."
          : e?.message || String(e),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !projeto) {
    return (
      <div className="p-8 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando demanda…
      </div>
    );
  }

  const initialSelected = Object.values(indicacoes)
    .filter((i) => i.status !== "retirado")
    .map((i) => i.consultor_user_id);

  const editMode = !!respostaId;

  return (
    <div className="space-y-6 pb-16">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to="/canal/projetos"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
        </Button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-display font-semibold text-foreground">{projeto.nome}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              {empresaNome && (<><Building2 className="h-3.5 w-3.5" /> {empresaNome}</>)}
              <Badge variant="outline" className="capitalize ml-2">
                {projeto.status.replace(/_/g, " ")}
              </Badge>
              {editMode && <Badge className="ml-2">Já respondida — em edição</Badge>}
            </div>
          </div>
        </div>
      </div>

      {!projeto.roteamento_v2 && (
        <Card className="p-4 border-warning/40 bg-warning/5 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
          <div className="text-sm">
            Esta demanda foi criada antes do novo fluxo de roteamento. O envio de indicação aqui pode não ser válido para esse projeto.
          </div>
        </Card>
      )}

      {/* Detalhe da demanda */}
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Prazo estimado</div>
            <div className="font-medium text-foreground mt-1">
              {projeto.prazo_estimado
                ? new Date(projeto.prazo_estimado).toLocaleDateString("pt-BR")
                : "Não informado"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Valor estimado</div>
            <div className="font-medium text-foreground mt-1">
              {projeto.valor_estimado
                ? `R$ ${Number(projeto.valor_estimado).toLocaleString("pt-BR")}`
                : "Não informado"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Software</div>
            <div className="font-medium text-foreground mt-1">{softwareNome || "Não informado"}</div>
          </div>
        </div>

        {projeto.descricao && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Descrição</div>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{projeto.descricao}</p>
          </div>
        )}

        {modulos.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">Módulos requeridos</div>
            <div className="flex flex-wrap gap-1.5">
              {modulos.map((m) => (
                <Badge key={m} variant="secondary" className="text-[11px]">{m}</Badge>
              ))}
            </div>
          </div>
        )}

        {funcs.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">Funcionalidades requeridas</div>
            <div className="flex flex-wrap gap-1.5">
              {funcs.map((f) => (
                <Badge key={f} variant="outline" className="text-[11px]">{f}</Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Match / seleção */}
      <Card className="p-5">
        <h2 className="font-display font-semibold text-lg mb-1">Indicar consultores do quadro</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Selecione os consultores que você deseja indicar para esta demanda. O match é uma sugestão — você pode indicar todos, alguns ou nenhum.
        </p>
        {canalId && (
          <ParceiroMatchList
            projetoId={projeto.id}
            canalId={canalId}
            softwareId={projeto.software_id}
            initialSelected={initialSelected}
            onSelectionChange={handleSelectionChange}
          />
        )}
      </Card>

      {/* Detalhamento por consultor selecionado */}
      {selectedActiveIds.length > 0 && (
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="font-display font-semibold text-lg">Detalhes por consultor</h2>
            <p className="text-xs text-muted-foreground">
              Valor proposto e observação são opcionais. Quando o valor estimado não é informado, deixe em branco ou informe sua proposta.
            </p>
          </div>
          <Separator />
          <div className="space-y-4">
            {selectedActiveIds.map((uid) => {
              const i = indicacoes[uid];
              return (
                <div key={uid} className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-3 border-b border-border/50 last:border-0">
                  <div className="md:col-span-3">
                    <span className="text-sm font-medium text-foreground">{i.consultor_nome || "Consultor"}</span>
                  </div>
                  <div>
                    <Label className="text-xs">Valor proposto (R$)</Label>
                    <Input
                      value={i.valor_proposto}
                      onChange={(e) => updateIndicacao(uid, { valor_proposto: e.target.value })}
                      placeholder={projeto.valor_estimado ? `Opcional (estimado R$ ${Number(projeto.valor_estimado).toLocaleString("pt-BR")})` : "Opcional — estimado não informado"}
                      inputMode="decimal"
                      className="h-9"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Observação</Label>
                    <Input
                      value={i.observacao}
                      onChange={(e) => updateIndicacao(uid, { observacao: e.target.value })}
                      placeholder="Opcional"
                      maxLength={300}
                      className="h-9"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Comentário da resposta + submit */}
      <Card className="p-5 space-y-4">
        <div>
          <Label htmlFor="comentarios">Comentário da resposta (opcional)</Label>
          <Textarea
            id="comentarios"
            value={comentariosResposta}
            onChange={(e) => setComentariosResposta(e.target.value)}
            placeholder="Contexto geral da sua indicação para a empresa"
            maxLength={1000}
            rows={3}
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/canal/projetos")} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !projetoEditavel}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Enviando…</>
            ) : (
              <><Send className="h-4 w-4 mr-1" /> {editMode ? "Salvar alterações" : "Enviar indicação"}</>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default CanalDemandaDetalhe;
