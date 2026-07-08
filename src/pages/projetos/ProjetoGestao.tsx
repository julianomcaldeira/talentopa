import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard, StatusBadge, EmptyState, LoadingState } from "@/components/dashboard/DashboardComponents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, Link as LinkIcon, FileText, CheckCircle2, XCircle, Trash2, Download, Clock, Send } from "lucide-react";
import { ProjectCommunication } from "@/components/communication/ProjectCommunication";
import { TimelineFases } from "@/components/projetos/TimelineFases";
import { ReunioesAtas } from "@/components/projetos/ReunioesAtas";
import { Timesheet } from "@/components/projetos/Timesheet";
import ValidarFaseActions from "@/components/projetos/ValidarFaseActions";
import EncerrarFaseDialog from "@/components/projetos/EncerrarFaseDialog";

const STATUS_FASE_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovação" },
  { value: "aprovada", label: "Aprovada" },
  { value: "reprovada", label: "Reprovada" },
];

const ProjetoGestao = () => {
  const { id: projetoId } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [projeto, setProjeto] = useState<any>(null);
  const [fases, setFases] = useState<any[]>([]);
  const [entregaveis, setEntregaveis] = useState<any[]>([]);
  const [propostaAceita, setPropostaAceita] = useState<any>(null);
  const [uploaderProfiles, setUploaderProfiles] = useState<Map<string, string>>(new Map());
  const [isRmoOfCanal, setIsRmoOfCanal] = useState(false);

  // Novo entregável
  const [novoNome, setNovoNome] = useState("");
  const [novoFaseId, setNovoFaseId] = useState<string>("");
  const [novoTipo, setNovoTipo] = useState<"arquivo" | "link">("arquivo");
  const [novoLink, setNovoLink] = useState("");
  const [novoArquivo, setNovoArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const isEmpresa = role === "empresa";
  const isConsultor = role === "consultor";
  const isMyProject = useMemo(() => {
    if (!projeto || !user) return false;
    if (isEmpresa) return projeto.empresa_user_id === user.id;
    if (isConsultor) return propostaAceita?.consultor_user_id === user.id;
    return role === "admin";
  }, [projeto, user, role, propostaAceita, isEmpresa, isConsultor]);

  const fetchAll = async () => {
    if (!projetoId) { setLoading(false); return; }
    try {
      const [projRes, fasesRes, propRes, entRes] = await Promise.all([
        supabase.from("projetos").select("*, softwares(nome)").eq("id", projetoId).maybeSingle(),
        supabase.from("projeto_fases").select("*").eq("projeto_id", projetoId).order("ordem", { ascending: true }),
        supabase.from("propostas").select("*").eq("projeto_id", projetoId).eq("status", "aceita").maybeSingle(),
        (supabase as any).from("projeto_entregaveis").select("*").eq("projeto_id", projetoId).order("created_at", { ascending: false }),
      ]);
      setProjeto(projRes.data);
      setFases(fasesRes.data || []);
      setPropostaAceita(propRes.data);
      setEntregaveis(entRes.data || []);

      const uploaderIds: string[] = Array.from(new Set((entRes.data || []).map((e: any) => String(e.uploader_user_id))));
      if (uploaderIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", uploaderIds);
        setUploaderProfiles(new Map((profs || []).map(p => [p.user_id, p.nome])));
      }

      // Verifica se o usuário é RMO/admin do canal responsável pelo projeto
      const canalId = projRes.data?.canal_id;
      if (canalId && user?.id) {
        const { data: mem } = await (supabase as any)
          .from("canal_membros")
          .select("role, status")
          .eq("canal_id", canalId)
          .eq("user_id", user.id)
          .eq("status", "ativo")
          .maybeSingle();
        setIsRmoOfCanal(!!mem && (mem.role === "rmo" || mem.role === "admin"));
      } else {
        setIsRmoOfCanal(false);
      }
    } catch (e: any) {
      toast({ title: "Erro ao carregar projeto", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [projetoId]);

  const updateFase = async (faseId: string, patch: { status?: string; horas_executadas?: number }) => {
    const { error } = await (supabase as any).rpc("atualizar_fase", {
      p_fase_id: faseId,
      p_status: patch.status ?? null,
      p_horas_executadas: patch.horas_executadas ?? null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Fase atualizada" });
    fetchAll();
  };

  const handleUpload = async () => {
    if (!user || !projetoId || !novoNome.trim()) {
      toast({ title: "Informe um nome para o entregável", variant: "destructive" });
      return;
    }
    if (novoTipo === "arquivo" && !novoArquivo) {
      toast({ title: "Selecione um arquivo", variant: "destructive" });
      return;
    }
    if (novoTipo === "link" && !novoLink.trim()) {
      toast({ title: "Informe o link", variant: "destructive" });
      return;
    }
    setEnviando(true);
    try {
      let arquivo_url: string | null = null;
      if (novoTipo === "arquivo" && novoArquivo) {
        const path = `${projetoId}/${Date.now()}-${novoArquivo.name}`;
        const { error: upErr } = await supabase.storage.from("entregaveis").upload(path, novoArquivo);
        if (upErr) throw upErr;
        arquivo_url = path;
      }
      const { error } = await (supabase as any).from("projeto_entregaveis").insert({
        projeto_id: projetoId,
        fase_id: novoFaseId || null,
        uploader_user_id: user.id,
        nome: novoNome.trim(),
        tipo: novoTipo,
        arquivo_url,
        link_url: novoTipo === "link" ? novoLink.trim() : null,
      });
      if (error) throw error;
      toast({ title: "Entregável enviado" });
      setNovoNome(""); setNovoLink(""); setNovoArquivo(null); setNovoFaseId("");
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    }
    setEnviando(false);
  };

  const aprovarEntregavel = async (entregavelId: string, aprovar: boolean) => {
    const { error } = await (supabase as any)
      .from("projeto_entregaveis")
      .update({ aprovado: aprovar, aprovado_em: new Date().toISOString(), aprovado_por: user?.id })
      .eq("id", entregavelId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchAll();
  };

  const removerEntregavel = async (e: any) => {
    if (e.arquivo_url) {
      await supabase.storage.from("entregaveis").remove([e.arquivo_url]);
    }
    await (supabase as any).from("projeto_entregaveis").delete().eq("id", e.id);
    fetchAll();
  };

  const downloadArquivo = async (path: string) => {
    const { data } = await supabase.storage.from("entregaveis").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loading) return <DataCard><LoadingState /></DataCard>;
  if (!projeto) return <EmptyState message="Projeto não encontrado" icon={FileText} />;

  const totalHoras = fases.reduce((sum, f) => sum + (Number(f.horas_estimadas) || 0), 0);
  const horasFeitas = fases.reduce((sum, f) => sum + (Number(f.horas_executadas) || 0), 0);
  const progresso = totalHoras > 0 ? Math.round((horasFeitas / totalHoras) * 100) : 0;
  const fasesAprovadas = fases.filter(f => f.status === "aprovada").length;
  const backHref = isEmpresa ? "/empresa/projetos" : isConsultor ? "/consultor/minhas-propostas" : "/admin/projetos";

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate(backHref)} className="mb-3">
        <ArrowLeft size={14} /> Voltar
      </Button>

      <PageHeader
        title={`Gestão · ${projeto.nome}`}
        description={`${projeto.softwares?.nome || "Projeto"} · ${projeto.protocolo || ""}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <DataCard className="!p-4"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Status</p><div className="mt-1"><StatusBadge status={projeto.status} /></div></DataCard>
        <DataCard className="!p-4"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Progresso</p><p className="text-xl font-display font-semibold mt-1">{progresso}%</p></DataCard>
        <DataCard className="!p-4"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Horas (feitas / estimadas)</p><p className="text-xl font-display font-semibold mt-1">{horasFeitas}h / {totalHoras}h</p></DataCard>
        <DataCard className="!p-4"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Fases aprovadas</p><p className="text-xl font-display font-semibold mt-1">{fasesAprovadas} / {fases.length}</p></DataCard>
      </div>

      <Tabs defaultValue="fases">
        <TabsList>
          <TabsTrigger value="fases">Fases</TabsTrigger>
          <TabsTrigger value="timeline">Cronograma</TabsTrigger>
          <TabsTrigger value="entregaveis">Entregáveis</TabsTrigger>
          <TabsTrigger value="horas">Horas</TabsTrigger>
          <TabsTrigger value="reunioes">Reuniões</TabsTrigger>
          <TabsTrigger value="comunicacao">Comunicação</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          <TimelineFases fases={fases} />
        </TabsContent>

        <TabsContent value="horas" className="mt-4">
          <Timesheet projetoId={projeto.id} fases={fases} isConsultor={isConsultor && isMyProject} isEmpresa={isEmpresa && projeto.empresa_user_id === user?.id} projetoNome={projeto.nome} />
        </TabsContent>

        <TabsContent value="reunioes" className="mt-4">
          <ReunioesAtas projetoId={projeto.id} podeEscrever={isMyProject} />
        </TabsContent>

        {/* FASES */}
        <TabsContent value="fases" className="mt-4 space-y-3">
          {fases.length === 0 ? (
            <DataCard><EmptyState message="Nenhuma fase cadastrada" icon={Clock} /></DataCard>
          ) : fases.map(f => (
            <DataCard key={f.id}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h4 className="font-display font-semibold text-foreground">{f.nome}</h4>
                  {f.descricao && <p className="text-xs text-muted-foreground mt-0.5">{f.descricao}</p>}
                </div>
                <StatusBadge status={f.status} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</Label>
                  <Select
                    value={f.status}
                    onValueChange={(v) => updateFase(f.id, { status: v })}
                    disabled={!isMyProject}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_FASE_OPTIONS.filter(o => isEmpresa || !["aprovada","reprovada"].includes(o.value)).map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Horas executadas</Label>
                  <Input
                    type="number"
                    defaultValue={f.horas_executadas || 0}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== Number(f.horas_executadas || 0)) updateFase(f.id, { horas_executadas: v });
                    }}
                    disabled={!isMyProject}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Estimadas / Prazo</Label>
                  <p className="text-sm h-9 flex items-center">{f.horas_estimadas || 0}h · {f.prazo ? new Date(f.prazo).toLocaleDateString("pt-BR") : "—"}</p>
                </div>
              </div>
            </DataCard>
          ))}
        </TabsContent>

        {/* ENTREGÁVEIS */}
        <TabsContent value="entregaveis" className="mt-4 space-y-3">
          {isMyProject && (
            <DataCard>
              <h4 className="font-display font-semibold text-foreground mb-3">Novo entregável</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Nome</Label>
                  <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: Documento de escopo" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Fase</Label>
                  <Select value={novoFaseId} onValueChange={setNovoFaseId}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma fase (opcional)" /></SelectTrigger>
                    <SelectContent>
                      {fases.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo</Label>
                  <Select value={novoTipo} onValueChange={(v: any) => setNovoTipo(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arquivo">Arquivo</SelectItem>
                      <SelectItem value="link">Link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  {novoTipo === "arquivo" ? (
                    <>
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Arquivo</Label>
                      <Input type="file" onChange={(e) => setNovoArquivo(e.target.files?.[0] || null)} />
                    </>
                  ) : (
                    <>
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">URL</Label>
                      <Input value={novoLink} onChange={(e) => setNovoLink(e.target.value)} placeholder="https://..." />
                    </>
                  )}
                </div>
              </div>
              <Button className="mt-3" size="sm" onClick={handleUpload} disabled={enviando}>
                <Send size={14} /> {enviando ? "Enviando..." : "Enviar entregável"}
              </Button>
            </DataCard>
          )}

          {entregaveis.length === 0 ? (
            <DataCard><EmptyState message="Nenhum entregável enviado ainda" icon={FileText} /></DataCard>
          ) : entregaveis.map(e => (
            <DataCard key={e.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="icon-container icon-container-md bg-primary/10">
                    {e.tipo === "link" ? <LinkIcon size={16} className="text-primary" /> : <FileText size={16} className="text-primary" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Por {uploaderProfiles.get(e.uploader_user_id) || "Usuário"} · {new Date(e.created_at).toLocaleString("pt-BR")}
                      {e.fase_id && fases.find(f => f.id === e.fase_id) && ` · Fase: ${fases.find(f => f.id === e.fase_id)?.nome}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {e.aprovado === true && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">Aprovado</span>}
                  {e.aprovado === false && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">Reprovado</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 ml-[54px]">
                {e.tipo === "link" ? (
                  <Button size="sm" variant="outline" onClick={() => window.open(e.link_url, "_blank")}>
                    <LinkIcon size={12} /> Abrir link
                  </Button>
                ) : e.arquivo_url && (
                  <Button size="sm" variant="outline" onClick={() => downloadArquivo(e.arquivo_url)}>
                    <Download size={12} /> Baixar
                  </Button>
                )}
                {isEmpresa && projeto.empresa_user_id === user?.id && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => aprovarEntregavel(e.id, true)}>
                      <CheckCircle2 size={12} /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => aprovarEntregavel(e.id, false)}>
                      <XCircle size={12} /> Reprovar
                    </Button>
                  </>
                )}
                {(e.uploader_user_id === user?.id || role === "admin") && (
                  <Button size="sm" variant="outline" onClick={() => removerEntregavel(e)}>
                    <Trash2 size={12} /> Remover
                  </Button>
                )}
              </div>
            </DataCard>
          ))}
        </TabsContent>

        {/* COMUNICAÇÃO */}
        <TabsContent value="comunicacao" className="mt-4">
          <ProjectCommunication
            projetoId={projeto.id}
            projetoNome={projeto.nome}
            isEmpresa={isEmpresa}
            empresaUserId={isEmpresa ? projeto.empresa_user_id : undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjetoGestao;
