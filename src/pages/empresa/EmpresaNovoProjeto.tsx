import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard } from "@/components/dashboard/DashboardComponents";
import { ArrowLeft, ArrowRight, Check, FileText, Target, Settings, Rocket, Plus, Trash2, Copy, Sparkles, UserCheck, X, ClipboardList, Lightbulb } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</Label>
);

const steps = [
  { label: "Informações", icon: FileText },
  { label: "Escopo", icon: Target },
  { label: "Fases", icon: Settings },
  { label: "Qualificação", icon: ClipboardList },
  { label: "Publicar", icon: Rocket },
];

const PERGUNTAS_SUGERIDAS = [
  "Quantos projetos similares (mesmo ERP/módulos) você já entregou?",
  "Qual sua disponibilidade semanal em horas para este projeto?",
  "Você possui certificação oficial no ERP escolhido? Qual?",
  "Cite 2 referências de clientes onde implantou esse escopo.",
  "Qual sua abordagem para mitigar atrasos em integrações?",
];

const EmpresaNovoProjeto = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [softwares, setSoftwares] = useState<any[]>([]);
  const [modulos, setModulos] = useState<any[]>([]);
  const [funcionalidades, setFuncionalidades] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [meusProjetos, setMeusProjetos] = useState<any[]>([]);
  const [espelhandoId, setEspelhandoId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [recontratarConsultor, setRecontratarConsultor] = useState<{ user_id: string; nome: string; avatar_url: string | null } | null>(null);

  const [form, setForm] = useState({
    nome: "", descricao: "", problema_atual: "", objetivo: "", prazo_estimado: "",
    software_id: "", template_id: "", observacoes: "",
    modelo_contratacao: "" as "" | "presencial" | "hibrido" | "remoto",
  });
  const [selectedModulos, setSelectedModulos] = useState<string[]>([]);
  const [selectedFuncs, setSelectedFuncs] = useState<string[]>([]);
  const [fases, setFases] = useState([
    { nome: "Planejamento", descricao: "", prazo: "", valor: "" },
    { nome: "Implantação", descricao: "", prazo: "", valor: "" },
    { nome: "Testes", descricao: "", prazo: "", valor: "" },
    { nome: "Treinamento", descricao: "", prazo: "", valor: "" },
    { nome: "Go-live", descricao: "", prazo: "", valor: "" },
  ]);
  const [perguntas, setPerguntas] = useState<{ pergunta: string; obrigatoria: boolean }[]>([]);
  const [novaPergunta, setNovaPergunta] = useState("");
  const [novaObrigatoria, setNovaObrigatoria] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [swRes, modRes, funcRes, tplRes, projRes] = await Promise.all([
        supabase.from("softwares").select("*").order("nome"),
        supabase.from("modulos").select("*").order("nome"),
        supabase.from("funcionalidades").select("*").order("nome"),
        supabase.from("templates").select("*, template_funcionalidades(funcionalidade_id)").order("nome"),
        user ? supabase
          .from("projetos")
          .select("id, nome, descricao, problema_atual, objetivo, prazo_estimado, software_id, template_id, observacoes, modelo_contratacao, status, created_at, projeto_modulos(modulo_id), projeto_funcionalidades(funcionalidade_id), projeto_fases(nome, descricao, ordem, prazo, valor)")
          .eq("empresa_user_id", user.id)
          .neq("status", "rascunho")
          .order("created_at", { ascending: false })
          .limit(20) : Promise.resolve({ data: [] as any[] }),
      ]);
      if (swRes.data) setSoftwares(swRes.data);
      if (modRes.data) setModulos(modRes.data);
      if (funcRes.data) setFuncionalidades(funcRes.data);
      if (tplRes.data) setTemplates(tplRes.data);
      if (projRes.data) setMeusProjetos(projRes.data as any[]);
    };
    fetch();
  }, [user]);

  // Pré-carregar consultor sugerido via querystring (?recontratar=USER_ID)
  useEffect(() => {
    const uid = searchParams.get("recontratar");
    if (!uid) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, nome, avatar_url")
        .eq("user_id", uid)
        .maybeSingle();
      if (data) {
        setRecontratarConsultor({ user_id: data.user_id, nome: data.nome, avatar_url: data.avatar_url });
        toast({ title: "Recontratação iniciada", description: `O projeto será sugerido a ${data.nome} assim que for publicado.` });
      }
    })();
  }, [searchParams, toast]);

  const limparRecontratacao = () => {
    setRecontratarConsultor(null);
    searchParams.delete("recontratar");
    searchParams.delete("nome");
    setSearchParams(searchParams, { replace: true });
  };

  const espelharProjeto = (projetoId: string) => {
    if (!projetoId) {
      setEspelhandoId("");
      return;
    }
    const p = meusProjetos.find(x => x.id === projetoId);
    if (!p) return;
    setEspelhandoId(projetoId);
    setForm({
      nome: `${p.nome} (cópia)`,
      descricao: p.descricao || "",
      problema_atual: p.problema_atual || "",
      objetivo: p.objetivo || "",
      prazo_estimado: "",
      software_id: p.software_id || "",
      template_id: p.template_id || "",
      observacoes: p.observacoes || "",
      modelo_contratacao: (p.modelo_contratacao || "") as any,
    });
    setSelectedModulos((p.projeto_modulos || []).map((m: any) => m.modulo_id));
    setSelectedFuncs((p.projeto_funcionalidades || []).map((f: any) => f.funcionalidade_id));
    const fasesEspelho = (p.projeto_fases || [])
      .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((f: any) => ({
        nome: f.nome || "",
        descricao: f.descricao || "",
        prazo: "",
        valor: f.valor != null ? String(f.valor) : "",
      }));
    if (fasesEspelho.length > 0) setFases(fasesEspelho);
    toast({ title: "Projeto espelhado", description: `Dados de "${p.nome}" copiados. Revise e ajuste antes de publicar.` });
  };

  const filteredModulos = modulos.filter(m => m.software_id === form.software_id);
  const filteredFuncs = funcionalidades.filter(f => selectedModulos.includes(f.modulo_id));

  const applyTemplate = (templateId: string) => {
    const tpl = templates.find(t => t.id === templateId);
    if (tpl) {
      setSelectedFuncs(tpl.template_funcionalidades?.map((tf: any) => tf.funcionalidade_id) || []);
      setForm({ ...form, template_id: templateId });
    }
  };

  const handlePublish = async () => {
    if (!user) return;
    setSaving(true);
    const { data: projeto, error } = await supabase.from("projetos").insert({
      empresa_user_id: user.id, nome: form.nome, descricao: form.descricao || null,
      problema_atual: form.problema_atual || null, objetivo: form.objetivo || null,
      prazo_estimado: form.prazo_estimado || null, software_id: form.software_id || null,
      template_id: form.template_id || null, observacoes: form.observacoes || null,
      modelo_contratacao: (form.modelo_contratacao || null) as any,
      status: "publicado" as const,
    }).select("id").single();
    if (error || !projeto) { toast({ title: "Erro", description: error?.message, variant: "destructive" }); setSaving(false); return; }

    if (selectedModulos.length > 0) await supabase.from("projeto_modulos").insert(selectedModulos.map(mid => ({ projeto_id: projeto.id, modulo_id: mid })));
    if (selectedFuncs.length > 0) await supabase.from("projeto_funcionalidades").insert(selectedFuncs.map(fid => ({ projeto_id: projeto.id, funcionalidade_id: fid })));
    const validFases = fases.filter(f => f.nome);
    if (validFases.length > 0) await supabase.from("projeto_fases").insert(validFases.map((f, i) => ({ projeto_id: projeto.id, nome: f.nome, descricao: f.descricao || null, ordem: i, prazo: f.prazo || null, valor: f.valor ? Number(f.valor) : null })));

    // Perguntas de qualificação para os consultores
    const validPerguntas = perguntas.filter(p => p.pergunta.trim());
    if (validPerguntas.length > 0) {
      await supabase.from("projeto_perguntas").insert(
        validPerguntas.map((p, i) => ({
          projeto_id: projeto.id,
          pergunta: p.pergunta.trim(),
          obrigatoria: p.obrigatoria,
          ordem: i,
        }))
      );
    }

    // Convidar consultor (recontratação): notificação + mensagem-convite no chat do projeto
    if (recontratarConsultor) {
      await supabase.from("notificacoes").insert({
        user_id: recontratarConsultor.user_id,
        tipo: "convite_projeto",
        titulo: "Convite para novo projeto",
        mensagem: `Você foi convidado(a) a enviar uma proposta para o projeto "${form.nome}".`,
        referencia_id: projeto.id,
        referencia_tipo: "projeto",
      });
      await supabase.from("mensagens").insert({
        projeto_id: projeto.id,
        sender_user_id: user.id,
        recipient_user_id: recontratarConsultor.user_id,
        tipo: "convite",
        conteudo: `Olá ${recontratarConsultor.nome}! Gostaríamos de contar com você novamente neste projeto. Avalie o escopo e, se fizer sentido, envie sua proposta.`,
      });
    }

    toast({ title: "Projeto publicado com sucesso!" });
    navigate("/empresa/projetos");
    setSaving(false);
  };

  return (
    <div>
      <PageHeader title="Novo Projeto" description="Crie um projeto de implementação ERP em poucos passos" />

      {recontratarConsultor && (
        <div className="max-w-3xl mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground text-xs font-semibold overflow-hidden shrink-0">
            {recontratarConsultor.avatar_url
              ? <img src={recontratarConsultor.avatar_url} alt={recontratarConsultor.nome} className="w-full h-full object-cover" />
              : recontratarConsultor.nome.split(" ").slice(0, 2).map(x => x.charAt(0)).join("").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-semibold text-foreground flex items-center gap-2">
              <UserCheck size={14} className="text-primary" /> Recontratando {recontratarConsultor.nome}
            </p>
            <p className="text-xs text-muted-foreground">Após publicar, este consultor será notificado e convidado a enviar uma proposta.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={limparRecontratacao}>
            <X size={14} /> Cancelar
          </Button>
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8 max-w-3xl">
        {steps.map((s, i) => (
          <div key={i} className="flex-1 flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              i === step ? "bg-primary text-primary-foreground shadow-sm" :
              i < step ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
            }`}>
              {i < step ? <Check size={14} /> : <s.icon size={14} />}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className={`flex-1 h-[2px] rounded-full ${i < step ? "bg-success" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <DataCard className="max-w-3xl">
        {step === 0 && (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-foreground text-lg mb-2">Informações Gerais</h3>

            {meusProjetos.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-primary" />
                  <SectionLabel>Espelhar projeto anterior (opcional)</SectionLabel>
                </div>
                <p className="text-xs text-muted-foreground">Acelere o preenchimento copiando informações, escopo e fases de um projeto já publicado.</p>
                <div className="flex gap-2">
                  <Select value={espelhandoId} onValueChange={espelharProjeto}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione um projeto para espelhar..." /></SelectTrigger>
                    <SelectContent>
                      {meusProjetos.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} <span className="text-muted-foreground ml-1 text-[11px]">· {new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {espelhandoId && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setEspelhandoId(""); }} className="shrink-0">
                      Limpar
                    </Button>
                  )}
                </div>
                {espelhandoId && (
                  <p className="text-[11px] text-primary flex items-center gap-1"><Copy size={10} /> Dados copiados — ajuste o que precisar antes de publicar.</p>
                )}
              </div>
            )}

            <div className="space-y-2"><SectionLabel>Nome do Projeto *</SectionLabel><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Implantação TOTVS - Módulo Financeiro" /></div>
            <div className="space-y-2"><SectionLabel>Descrição</SectionLabel><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2"><SectionLabel>Problema Atual</SectionLabel><Textarea value={form.problema_atual} onChange={(e) => setForm({ ...form, problema_atual: e.target.value })} rows={2} placeholder="Descreva o problema a resolver" /></div>
              <div className="space-y-2"><SectionLabel>Objetivo</SectionLabel><Textarea value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} rows={2} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2"><SectionLabel>Prazo Estimado</SectionLabel><Input type="date" value={form.prazo_estimado} onChange={(e) => setForm({ ...form, prazo_estimado: e.target.value })} /></div>
              <div className="space-y-2">
                <SectionLabel>Modelo de Contratação *</SectionLabel>
                <Select value={form.modelo_contratacao} onValueChange={(v) => setForm({ ...form, modelo_contratacao: v as any })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="hibrido">Híbrido</SelectItem>
                    <SelectItem value="remoto">Remoto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(1)} disabled={!form.nome || !form.modelo_contratacao}>Próximo <ArrowRight size={14} /></Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-foreground text-lg mb-2">Escopo do Projeto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <SectionLabel>Software ERP</SectionLabel>
                <Select value={form.software_id} onValueChange={(v) => { setForm({ ...form, software_id: v }); setSelectedModulos([]); setSelectedFuncs([]); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{softwares.map(sw => <SelectItem key={sw.id} value={sw.id}>{sw.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {templates.length > 0 && (
                <div className="space-y-2">
                  <SectionLabel>Template (opcional)</SectionLabel>
                  <Select value={form.template_id} onValueChange={applyTemplate}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {form.software_id && filteredModulos.length > 0 && (
              <div className="space-y-2">
                <SectionLabel>Módulos ({selectedModulos.length} selecionados)</SectionLabel>
                <div className="border border-border rounded-xl p-3 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  {filteredModulos.map(m => (
                    <label key={m.id} className="flex items-center gap-2.5 cursor-pointer text-[13px] p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                      <Checkbox checked={selectedModulos.includes(m.id)} onCheckedChange={() => setSelectedModulos(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])} />
                      {m.nome}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {filteredFuncs.length > 0 && (
              <div className="space-y-2">
                <SectionLabel>Funcionalidades ({selectedFuncs.length} selecionadas)</SectionLabel>
                <div className="border border-border rounded-xl p-3 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  {filteredFuncs.map(f => (
                    <label key={f.id} className="flex items-center gap-2.5 cursor-pointer text-[13px] p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                      <Checkbox checked={selectedFuncs.includes(f.id)} onCheckedChange={() => setSelectedFuncs(prev => prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id])} />
                      {f.nome} {f.horas_media_estimadas ? <span className="text-muted-foreground ml-1">({f.horas_media_estimadas}h)</span> : null}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2"><SectionLabel>Observações</SectionLabel><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft size={14} /> Voltar</Button>
              <Button onClick={() => setStep(2)}>Próximo <ArrowRight size={14} /></Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-foreground text-lg mb-2">Fases do Projeto</h3>
            <div className="space-y-3">
              {fases.map((fase, i) => (
                <div key={i} className="border border-border/60 rounded-xl p-4 bg-muted/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fase {i + 1}</span>
                    {i >= 5 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setFases(fases.filter((_, j) => j !== i))}>
                        <Trash2 size={12} />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1"><SectionLabel>Nome</SectionLabel><Input value={fase.nome} onChange={(e) => { const f = [...fases]; f[i].nome = e.target.value; setFases(f); }} /></div>
                    <div className="space-y-1"><SectionLabel>Prazo</SectionLabel><Input type="date" value={fase.prazo} onChange={(e) => { const f = [...fases]; f[i].prazo = e.target.value; setFases(f); }} /></div>
                    <div className="space-y-1"><SectionLabel>Valor (R$)</SectionLabel><Input type="number" value={fase.valor} onChange={(e) => { const f = [...fases]; f[i].valor = e.target.value; setFases(f); }} /></div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setFases([...fases, { nome: "", descricao: "", prazo: "", valor: "" }])}>
              <Plus size={14} /> Adicionar fase
            </Button>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft size={14} /> Voltar</Button>
              <Button onClick={() => setStep(3)}>Próximo <ArrowRight size={14} /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="font-display font-semibold text-foreground text-lg">Formulário de Qualificação</h3>
                <p className="text-xs text-muted-foreground mt-1">Crie perguntas que os consultores deverão responder ao se candidatar. Ajuda a comparar e selecionar.</p>
              </div>
              <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-md whitespace-nowrap">Opcional</span>
            </div>

            {/* Sugestões */}
            {perguntas.length === 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb size={14} className="text-primary" />
                  <SectionLabel>Sugestões rápidas</SectionLabel>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PERGUNTAS_SUGERIDAS.map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPerguntas(prev => [...prev, { pergunta: q, obrigatoria: true }])}
                      className="text-[11px] px-2.5 py-1.5 rounded-lg bg-background border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                    >
                      + {q}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPerguntas(PERGUNTAS_SUGERIDAS.map(q => ({ pergunta: q, obrigatoria: true })))}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/15 transition-colors font-medium"
                  >
                    Adicionar todas
                  </button>
                </div>
              </div>
            )}

            {/* Adicionar nova */}
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 space-y-3">
              <Input
                value={novaPergunta}
                onChange={(e) => setNovaPergunta(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && novaPergunta.trim()) {
                    e.preventDefault();
                    setPerguntas(prev => [...prev, { pergunta: novaPergunta.trim(), obrigatoria: novaObrigatoria }]);
                    setNovaPergunta("");
                  }
                }}
                placeholder="Digite uma pergunta para os consultores..."
                className="text-sm"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={novaObrigatoria} onCheckedChange={setNovaObrigatoria} />
                  <Label className="text-xs text-muted-foreground">Obrigatória</Label>
                </div>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => {
                    if (!novaPergunta.trim()) return;
                    setPerguntas(prev => [...prev, { pergunta: novaPergunta.trim(), obrigatoria: novaObrigatoria }]);
                    setNovaPergunta("");
                  }}
                  disabled={!novaPergunta.trim()}
                >
                  <Plus size={14} /> Adicionar
                </Button>
              </div>
            </div>

            {/* Lista */}
            {perguntas.length > 0 && (
              <div className="space-y-2">
                <SectionLabel>Perguntas adicionadas ({perguntas.length})</SectionLabel>
                {perguntas.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-xl border border-border bg-card">
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded-md px-1.5 py-0.5 mt-0.5 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0 space-y-2">
                      <Input
                        value={p.pergunta}
                        onChange={(e) => {
                          const list = [...perguntas];
                          list[i].pergunta = e.target.value;
                          setPerguntas(list);
                        }}
                        className="text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={p.obrigatoria}
                          onCheckedChange={(v) => {
                            const list = [...perguntas];
                            list[i].obrigatoria = v;
                            setPerguntas(list);
                          }}
                        />
                        <Label className="text-[11px] text-muted-foreground">Obrigatória</Label>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setPerguntas(perguntas.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={13} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft size={14} /> Voltar</Button>
              <Button onClick={() => setStep(4)}>Próximo <ArrowRight size={14} /></Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-foreground text-lg mb-2">Revisar e Publicar</h3>
            <div className="space-y-3">
              <div className="bg-muted/30 rounded-xl p-4 space-y-2.5 border border-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Projeto</span>
                </div>
                <p className="text-base font-display font-semibold text-foreground">{form.nome}</p>
                {form.descricao && <p className="text-sm text-muted-foreground">{form.descricao}</p>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/30 rounded-xl p-3.5 border border-border/40 text-center">
                  <p className="text-lg font-display font-bold text-foreground">{form.software_id ? softwares.find(s => s.id === form.software_id)?.nome : "—"}</p>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase">Software</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3.5 border border-border/40 text-center">
                  <p className="text-lg font-display font-bold text-foreground">{selectedModulos.length + selectedFuncs.length}</p>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase">Itens de escopo</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3.5 border border-border/40 text-center">
                  <p className="text-lg font-display font-bold text-foreground">{fases.filter(f => f.nome).length}</p>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase">Fases</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3.5 border border-border/40 text-center">
                  <p className="text-lg font-display font-bold text-foreground">{perguntas.filter(p => p.pergunta.trim()).length}</p>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase">Perguntas</p>
                </div>
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft size={14} /> Voltar</Button>
              <Button variant="glow" onClick={handlePublish} disabled={saving}>
                {saving ? "Publicando..." : <><Rocket size={14} /> Publicar Projeto</>}
              </Button>
            </div>
          </div>
        )}
      </DataCard>
    </div>
  );
};

export default EmpresaNovoProjeto;
