import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard } from "@/components/dashboard/DashboardComponents";
import {
  ArrowLeft, ArrowRight, Check, FileText, Settings, Rocket, Plus, Trash2, Copy,
  Sparkles, UserCheck, X, ClipboardList, Lightbulb, Upload, Paperclip, Loader2,
  AlertTriangle, Brain, Mic, Square,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</Label>
);

const PhaseFieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Label className="inline-flex w-fit items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
    {children}
  </Label>
);

const steps = [
  { label: "Informações", icon: FileText },
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

const MAX_ANEXOS = 5;
const MAX_FILE_MB = 10;

interface AnexoLocal {
  file: File;
  preview_url: string;
}

interface ClassificacaoIA {
  tipo_projeto: string;
  complexidade: string;
  senioridade_recomendada: string;
  horas_estimadas?: number;
  modulos_sugeridos?: string[];
  riscos?: string[];
  resumo_executivo: string;
  escopo_sugerido: string;
  fases_sugeridas: { nome: string; descricao?: string; percentual_tempo: number }[];
}

interface EmpresaNovoProjetoProps {
  onSuccess?: () => void;
  embedded?: boolean;
}

const EmpresaNovoProjeto = ({ onSuccess }: EmpresaNovoProjetoProps = {}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [softwares, setSoftwares] = useState<any[]>([]);
  const [meusProjetos, setMeusProjetos] = useState<any[]>([]);
  const [espelhandoId, setEspelhandoId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [gravandoCampo, setGravandoCampo] = useState<"problema_atual" | "objetivo" | null>(null);
  const [recontratarConsultor, setRecontratarConsultor] = useState<{ user_id: string; nome: string; avatar_url: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptBaseRef = useRef("");

  const [form, setForm] = useState({
    nome: "", descricao: "", problema_atual: "", objetivo: "", prazo_estimado: "",
    prazo_propostas: "",
    software_id: "", observacoes: "",
    modelo_contratacao: "" as "" | "presencial" | "hibrido" | "remoto",
  });
  const [anexos, setAnexos] = useState<AnexoLocal[]>([]);
  const [classificacao, setClassificacao] = useState<ClassificacaoIA | null>(null);
  const [fases, setFases] = useState<{ nome: string; descricao: string; percentual: string }[]>([
    { nome: "Planejamento", descricao: "", percentual: "15" },
    { nome: "Implantação", descricao: "", percentual: "40" },
    { nome: "Testes", descricao: "", percentual: "15" },
    { nome: "Treinamento", descricao: "", percentual: "15" },
    { nome: "Go-live", descricao: "", percentual: "15" },
  ]);
  const [perguntas, setPerguntas] = useState<{ pergunta: string; obrigatoria: boolean }[]>([]);
  const [novaPergunta, setNovaPergunta] = useState("");
  const [novaObrigatoria, setNovaObrigatoria] = useState(true);

  const atualizarEscopoSugerido = (escopo_sugerido: string) => {
    setClassificacao(prev => prev ? { ...prev, escopo_sugerido } : prev);
  };

  const iniciarTranscricao = (campo: "problema_atual" | "objetivo") => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "Transcrição indisponível",
        description: "Seu navegador não oferece suporte à transcrição por voz. Tente usar Chrome ou Edge.",
        variant: "destructive",
      });
      return;
    }

    if (recognitionRef.current) recognitionRef.current.stop();

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;

    let textoFinal = "";
    transcriptBaseRef.current = form[campo];
    setGravandoCampo(campo);
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let parcial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const texto = event.results[i][0].transcript;
        if (event.results[i].isFinal) textoFinal += `${texto} `;
        else parcial += texto;
      }
      const transcricao = `${textoFinal}${parcial}`.trim();
      if (!transcricao) return;
      setForm(prev => ({
        ...prev,
        [campo]: `${transcriptBaseRef.current}${transcriptBaseRef.current ? " " : ""}${transcricao}`.replace(/\s+/g, " ").trim(),
      }));
    };

    recognition.onerror = () => {
      setGravandoCampo(null);
      toast({ title: "Não foi possível transcrever", description: "Verifique a permissão do microfone e tente novamente.", variant: "destructive" });
    };
    recognition.onend = () => setGravandoCampo(null);
    recognition.start();
  };

  const pararTranscricao = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setGravandoCampo(null);
  };

  useEffect(() => {
    const fetch = async () => {
      const [swRes, projRes] = await Promise.all([
        supabase.from("softwares").select("*").order("nome"),
        user ? supabase
          .from("projetos")
          .select("id, nome, descricao, problema_atual, objetivo, prazo_estimado, software_id, observacoes, modelo_contratacao, status, created_at, projeto_fases(nome, descricao, ordem)")
          .eq("empresa_user_id", user.id)
          .neq("status", "rascunho")
          .order("created_at", { ascending: false })
          .limit(20) : Promise.resolve({ data: [] as any[] }),
      ]);
      if (swRes.data) setSoftwares(swRes.data);
      if (projRes.data) setMeusProjetos(projRes.data as any[]);
    };
    fetch();
  }, [user]);

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
    if (!projetoId) { setEspelhandoId(""); return; }
    const p = meusProjetos.find(x => x.id === projetoId);
    if (!p) return;
    setEspelhandoId(projetoId);
    setForm({
      nome: `${p.nome} (cópia)`,
      descricao: p.descricao || "",
      problema_atual: p.problema_atual || "",
      objetivo: p.objetivo || "",
      prazo_estimado: "",
      prazo_propostas: "",
      software_id: p.software_id || "",
      observacoes: p.observacoes || "",
      modelo_contratacao: (p.modelo_contratacao || "") as any,
    });
    toast({ title: "Projeto espelhado", description: `Dados de "${p.nome}" copiados.` });
  };

  // Anexos
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const novos: AnexoLocal[] = [];
    for (const f of Array.from(files)) {
      if (anexos.length + novos.length >= MAX_ANEXOS) {
        toast({ title: "Limite atingido", description: `Máximo de ${MAX_ANEXOS} arquivos.`, variant: "destructive" });
        break;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast({ title: "Arquivo muito grande", description: `${f.name} excede ${MAX_FILE_MB}MB.`, variant: "destructive" });
        continue;
      }
      novos.push({ file: f, preview_url: URL.createObjectURL(f) });
    }
    setAnexos(prev => [...prev, ...novos]);
  };

  const removerAnexo = (i: number) => {
    URL.revokeObjectURL(anexos[i].preview_url);
    setAnexos(anexos.filter((_, j) => j !== i));
  };

  // IA
  const analisarComIA = async () => {
    if (!form.problema_atual && !form.objetivo) {
      toast({ title: "Preencha o briefing", description: "Informe pelo menos o Problema Atual ou Objetivo.", variant: "destructive" });
      return;
    }
    setAnalisando(true);
    try {
      const software_nome = softwares.find(s => s.id === form.software_id)?.nome;
      const { data, error } = await supabase.functions.invoke("project-classifier", {
        body: {
          problema_atual: form.problema_atual,
          objetivo: form.objetivo,
          descricao: form.descricao,
          software_nome,
          modelo_contratacao: form.modelo_contratacao,
          prazo_estimado: form.prazo_estimado,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const result = data as ClassificacaoIA;
      setClassificacao(result);
      // Aplicar fases sugeridas
      if (result.fases_sugeridas?.length) {
        setFases(result.fases_sugeridas.map(f => ({
          nome: f.nome,
          descricao: f.descricao || "",
          percentual: String(f.percentual_tempo ?? ""),
        })));
      }
      toast({ title: "Análise concluída", description: "Escopo e fases foram sugeridos pela IA. Revise antes de publicar." });
    } catch (e: any) {
      toast({ title: "Erro na análise", description: e.message || "Falha ao analisar projeto.", variant: "destructive" });
    } finally {
      setAnalisando(false);
    }
  };

  const totalPercentual = fases.reduce((s, f) => s + (Number(f.percentual) || 0), 0);

  const handlePublish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data: projeto, error } = await supabase.from("projetos").insert({
        empresa_user_id: user.id, nome: form.nome, descricao: form.descricao || null,
        problema_atual: form.problema_atual || null, objetivo: form.objetivo || null,
        prazo_estimado: form.prazo_estimado || null,
        prazo_propostas: form.prazo_propostas || null,
        software_id: form.software_id || null,
        observacoes: form.observacoes || null,
        modelo_contratacao: (form.modelo_contratacao || null) as any,
        escopo_ia: classificacao?.escopo_sugerido || null,
        classificacao_ia: classificacao ? (classificacao as any) : null,
        status: "publicado" as const,
      }).select("id").single();
      if (error || !projeto) throw error || new Error("Falha ao criar projeto");

      // Fases (com percentual armazenado em descricao prefix? Não — vamos usar campo descricao para guardar percentual no formato JSON)
      const validFases = fases.filter(f => f.nome);
      if (validFases.length > 0) {
        await supabase.from("projeto_fases").insert(validFases.map((f, i) => ({
          projeto_id: projeto.id,
          nome: f.nome,
          descricao: f.descricao || null,
          ordem: i,
          // % tempo dedicado armazenado em horas_estimadas como base proporcional
          horas_estimadas: f.percentual ? Number(f.percentual) : null,
        })));
      }

      // Perguntas
      const validPerguntas = perguntas.filter(p => p.pergunta.trim());
      if (validPerguntas.length > 0) {
        await supabase.from("projeto_perguntas").insert(validPerguntas.map((p, i) => ({
          projeto_id: projeto.id, pergunta: p.pergunta.trim(), obrigatoria: p.obrigatoria, ordem: i,
        })));
      }

      // Upload anexos
      if (anexos.length > 0) {
        for (const a of anexos) {
          const path = `${user.id}/${projeto.id}/${Date.now()}_${a.file.name}`;
          const { error: upErr } = await supabase.storage.from("projeto-anexos").upload(path, a.file);
          if (upErr) { console.error("upload error", upErr); continue; }
          // armazena path interno; URLs assinadas são geradas sob demanda
          await supabase.from("projeto_anexos").insert({
            projeto_id: projeto.id,
            uploader_user_id: user.id,
            nome: a.file.name,
            arquivo_url: path,
            tamanho_bytes: a.file.size,
            mime_type: a.file.type,
          });
        }
      }

      // Recontratação
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
          conteudo: `Olá ${recontratarConsultor.nome}! Gostaríamos de contar com você novamente neste projeto.`,
        });
      }

      toast({ title: "Projeto publicado com sucesso!" });
      if (onSuccess) onSuccess();
      else navigate("/empresa/projetos");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const softwareNome = softwares.find(s => s.id === form.software_id)?.nome;

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
            <p className="text-xs text-muted-foreground">Após publicar, este consultor será notificado e convidado.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={limparRecontratacao}><X size={14} /> Cancelar</Button>
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
        {/* ========= STEP 0: INFORMAÇÕES ========= */}
        {step === 0 && (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-foreground text-lg mb-2">Informações Gerais</h3>

            {meusProjetos.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-primary" />
                  <SectionLabel>Espelhar projeto anterior (opcional)</SectionLabel>
                </div>
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
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEspelhandoId("")} className="shrink-0">Limpar</Button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <SectionLabel>Nome do Projeto *</SectionLabel>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Implantação TOTVS - Módulo Financeiro" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <SectionLabel>Software ERP *</SectionLabel>
                <Select value={form.software_id} onValueChange={(v) => setForm({ ...form, software_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Qual sistema deseja contratar?" /></SelectTrigger>
                  <SelectContent>{softwares.map(sw => <SelectItem key={sw.id} value={sw.id}>{sw.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
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

            <div className="space-y-2">
              <SectionLabel>Descrição breve</SectionLabel>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} placeholder="Resumo curto do projeto" />
            </div>

            {/* DESTAQUE: Problema + Objetivo */}
            <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-display font-semibold text-foreground flex items-center gap-2">
                    <Brain size={16} className="text-primary" /> Briefing para a IA
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Quanto mais detalhes, melhor a IA classifica o projeto e gera o escopo automaticamente.
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary border-primary/20">Importante</Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <SectionLabel>Problema Atual *</SectionLabel>
                  <Button
                    type="button"
                    variant={gravandoCampo === "problema_atual" ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => gravandoCampo === "problema_atual" ? pararTranscricao() : iniciarTranscricao("problema_atual")}
                    className="h-8 gap-2"
                  >
                    {gravandoCampo === "problema_atual" ? <><Square size={13} /> Parar</> : <><Mic size={13} /> Transcrever áudio</>}
                  </Button>
                </div>
                <Textarea
                  value={form.problema_atual}
                  onChange={(e) => setForm({ ...form, problema_atual: e.target.value })}
                  rows={4}
                  className="bg-background border-primary/20 focus-visible:border-primary"
                  placeholder="Descreva em detalhes o problema, dores e gaps atuais que precisam ser resolvidos..."
                />
                {gravandoCampo === "problema_atual" && <p className="text-xs text-primary flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary animate-pulse" />Ouvindo... fale com naturalidade, a transcrição será adicionada automaticamente.</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <SectionLabel>Objetivo *</SectionLabel>
                  <Button
                    type="button"
                    variant={gravandoCampo === "objetivo" ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => gravandoCampo === "objetivo" ? pararTranscricao() : iniciarTranscricao("objetivo")}
                    className="h-8 gap-2"
                  >
                    {gravandoCampo === "objetivo" ? <><Square size={13} /> Parar</> : <><Mic size={13} /> Transcrever áudio</>}
                  </Button>
                </div>
                <Textarea
                  value={form.objetivo}
                  onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
                  rows={4}
                  className="bg-background border-primary/20 focus-visible:border-primary"
                  placeholder="O que se espera alcançar com este projeto? Quais resultados, KPIs ou capacidades?"
                />
                {gravandoCampo === "objetivo" && <p className="text-xs text-primary flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary animate-pulse" />Ouvindo... fale com naturalidade, a transcrição será adicionada automaticamente.</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <SectionLabel>Prazo Estimado de Entrega</SectionLabel>
                  <Input type="date" value={form.prazo_estimado} onChange={(e) => setForm({ ...form, prazo_estimado: e.target.value })} className="bg-background" />
                  <p className="text-[11px] text-muted-foreground">Data desejada para conclusão do projeto.</p>
                </div>
                <div className="space-y-2">
                  <SectionLabel>Prazo para receber propostas *</SectionLabel>
                  <Input
                    type="date"
                    value={form.prazo_propostas}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setForm({ ...form, prazo_propostas: e.target.value })}
                    className="bg-background border-primary/20 focus-visible:border-primary"
                  />
                  <p className="text-[11px] text-muted-foreground">Até quando os consultores podem enviar propostas. Você pode editar depois.</p>
                </div>
              </div>

              <Button
                type="button"
                variant="glow"
                onClick={analisarComIA}
                disabled={analisando || (!form.problema_atual && !form.objetivo)}
                className="w-full"
              >
                {analisando ? <><Loader2 size={14} className="animate-spin" /> Analisando...</> : <><Sparkles size={14} /> Analisar e gerar escopo com IA</>}
              </Button>

              {classificacao && (
                <div className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-4">
                  <div className="flex items-center gap-2 text-success">
                    <Check size={14} />
                    <span className="text-xs font-semibold uppercase tracking-wider">Análise concluída</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-[11px]">Tipo: {classificacao.tipo_projeto}</Badge>
                    <Badge variant="outline" className="text-[11px]">Complexidade: {classificacao.complexidade}</Badge>
                    <Badge variant="outline" className="text-[11px]">Senioridade: {classificacao.senioridade_recomendada}</Badge>
                    {classificacao.horas_estimadas != null && (
                      <Badge variant="outline" className="text-[11px]">~{classificacao.horas_estimadas}h</Badge>
                    )}
                  </div>
                  <p className="text-xs text-foreground/80 italic">{classificacao.resumo_executivo}</p>
                  <div className="space-y-2">
                    <SectionLabel>Escopo sugerido pela IA — revise e ajuste antes de publicar</SectionLabel>
                    <Textarea
                      value={classificacao.escopo_sugerido}
                      onChange={(e) => atualizarEscopoSugerido(e.target.value)}
                      rows={7}
                      className="bg-background border-success/20 focus-visible:border-success text-sm"
                      placeholder="Ajuste aqui o escopo sugerido pela IA..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Anexos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel>Anexos para análise (até {MAX_ANEXOS})</SectionLabel>
                <span className="text-[11px] text-muted-foreground">{anexos.length}/{MAX_ANEXOS} · máx {MAX_FILE_MB}MB cada</span>
              </div>
              <div
                className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={20} className="mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">
                  Clique para anexar documentos (RFP, especificações, planilhas etc.) que ajudem o consultor.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
                />
              </div>
              {anexos.length > 0 && (
                <div className="space-y-1.5">
                  {anexos.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card text-xs">
                      <Paperclip size={13} className="text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{a.file.name}</span>
                      <span className="text-muted-foreground shrink-0">{(a.file.size / 1024).toFixed(0)}KB</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removerAnexo(i)}>
                        <X size={12} className="text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <SectionLabel>Observações</SectionLabel>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(1)} disabled={!form.nome || !form.modelo_contratacao || !form.software_id || !form.prazo_propostas}>
                Próximo <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        )}

        {/* ========= STEP 1: FASES ========= */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="font-display font-semibold text-foreground text-lg">Fases do Projeto</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Distribua o tempo total do projeto entre as fases. Você pode editar, remover ou adicionar.
                </p>
              </div>
              <Badge
                variant={totalPercentual === 100 ? "default" : "secondary"}
                className={totalPercentual === 100 ? "bg-success text-success-foreground" : "bg-warning/10 text-warning border-warning/30"}
              >
                Total: {totalPercentual}%
              </Badge>
            </div>

            {totalPercentual !== 100 && fases.length > 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-2.5 flex items-center gap-2 text-xs text-warning">
                <AlertTriangle size={13} /> A soma dos percentuais deve totalizar 100%.
              </div>
            )}

            <div className="space-y-3">
              {fases.map((fase, i) => (
                <div key={i} className="border border-border/60 rounded-xl p-4 bg-muted/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fase {i + 1}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setFases(fases.filter((_, j) => j !== i))}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <PhaseFieldLabel>Nome da fase <strong className="font-bold text-primary">sugerida</strong></PhaseFieldLabel>
                      <Input value={fase.nome} onChange={(e) => { const f = [...fases]; f[i].nome = e.target.value; setFases(f); }} />
                    </div>
                    <div className="space-y-1">
                      <PhaseFieldLabel>% tempo dedicado</PhaseFieldLabel>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={fase.percentual}
                          onChange={(e) => { const f = [...fases]; f[i].percentual = e.target.value; setFases(f); }}
                          className="pr-7"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                  {fase.descricao && (
                    <p className="text-[11px] text-muted-foreground mt-2 italic">{fase.descricao}</p>
                  )}
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={() => setFases([...fases, { nome: "", descricao: "", percentual: "" }])}>
              <Plus size={14} /> Adicionar fase
            </Button>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft size={14} /> Voltar</Button>
              <Button onClick={() => setStep(2)}>Próximo <ArrowRight size={14} /></Button>
            </div>
          </div>
        )}

        {/* ========= STEP 2: QUALIFICAÇÃO ========= */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="font-display font-semibold text-foreground text-lg">Formulário de Qualificação</h3>
                <p className="text-xs text-muted-foreground mt-1">Crie perguntas que os consultores deverão responder ao se candidatar.</p>
              </div>
              <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-md whitespace-nowrap">Opcional</span>
            </div>

            {/* Sugestões SEMPRE visíveis */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb size={14} className="text-primary" />
                  <SectionLabel>Sugestões rápidas</SectionLabel>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const novas = PERGUNTAS_SUGERIDAS
                      .filter(q => !perguntas.some(p => p.pergunta === q))
                      .map(q => ({ pergunta: q, obrigatoria: true }));
                    if (novas.length === 0) {
                      toast({ title: "Todas já adicionadas" });
                      return;
                    }
                    setPerguntas(prev => [...prev, ...novas]);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/15 font-medium"
                >
                  Adicionar todas
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PERGUNTAS_SUGERIDAS.map((q, i) => {
                  const jaAdicionada = perguntas.some(p => p.pergunta === q);
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={jaAdicionada}
                      onClick={() => setPerguntas(prev => [...prev, { pergunta: q, obrigatoria: true }])}
                      className={`text-[11px] px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                        jaAdicionada
                          ? "bg-success/10 border-success/30 text-success cursor-not-allowed"
                          : "bg-background border-border hover:border-primary hover:bg-primary/5"
                      }`}
                    >
                      {jaAdicionada ? <><Check size={10} className="inline" /> {q}</> : <>+ {q}</>}
                    </button>
                  );
                })}
              </div>
            </div>

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
                placeholder="Digite uma pergunta personalizada..."
                className="text-sm"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={novaObrigatoria} onCheckedChange={setNovaObrigatoria} />
                  <Label className="text-xs text-muted-foreground">Obrigatória</Label>
                </div>
                <Button size="sm" type="button" disabled={!novaPergunta.trim()} onClick={() => {
                  if (!novaPergunta.trim()) return;
                  setPerguntas(prev => [...prev, { pergunta: novaPergunta.trim(), obrigatoria: novaObrigatoria }]);
                  setNovaPergunta("");
                }}>
                  <Plus size={14} /> Adicionar
                </Button>
              </div>
            </div>

            {perguntas.length > 0 && (
              <div className="space-y-2">
                <SectionLabel>Perguntas adicionadas ({perguntas.length})</SectionLabel>
                {perguntas.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-xl border border-border bg-card">
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded-md px-1.5 py-0.5 mt-0.5 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0 space-y-2">
                      <Input value={p.pergunta} onChange={(e) => {
                        const list = [...perguntas]; list[i].pergunta = e.target.value; setPerguntas(list);
                      }} className="text-sm" />
                      <div className="flex items-center gap-2">
                        <Switch checked={p.obrigatoria} onCheckedChange={(v) => {
                          const list = [...perguntas]; list[i].obrigatoria = v; setPerguntas(list);
                        }} />
                        <Label className="text-[11px] text-muted-foreground">Obrigatória</Label>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setPerguntas(perguntas.filter((_, j) => j !== i))}>
                      <Trash2 size={13} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft size={14} /> Voltar</Button>
              <Button onClick={() => setStep(3)}>Próximo <ArrowRight size={14} /></Button>
            </div>
          </div>
        )}

        {/* ========= STEP 3: PUBLICAR ========= */}
        {step === 3 && (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-foreground text-lg mb-2">Revisar e Publicar</h3>

            {/* Cabeçalho */}
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 border border-border/40">
              <p className="text-base font-display font-semibold text-foreground">{form.nome}</p>
              {form.descricao && <p className="text-sm text-muted-foreground">{form.descricao}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {softwareNome && <Badge variant="outline" className="text-[11px]">ERP: {softwareNome}</Badge>}
                {form.modelo_contratacao && <Badge variant="outline" className="text-[11px] capitalize">{form.modelo_contratacao}</Badge>}
                {form.prazo_estimado && <Badge variant="outline" className="text-[11px]">Entrega: {new Date(form.prazo_estimado).toLocaleDateString("pt-BR")}</Badge>}
                {form.prazo_propostas && <Badge variant="outline" className="text-[11px] border-primary/40 text-primary">Propostas até: {new Date(form.prazo_propostas).toLocaleDateString("pt-BR")}</Badge>}
              </div>
            </div>

            {/* Resumo da IA */}
            {classificacao && (
              <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Brain size={14} className="text-primary" />
                  <h4 className="font-display font-semibold text-foreground text-sm">Análise da IA</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[11px]">Tipo: {classificacao.tipo_projeto}</Badge>
                  <Badge variant="outline" className="text-[11px]">Complexidade: {classificacao.complexidade}</Badge>
                  <Badge variant="outline" className="text-[11px]">Senioridade: {classificacao.senioridade_recomendada}</Badge>
                  {classificacao.horas_estimadas != null && (
                    <Badge variant="outline" className="text-[11px]">~{classificacao.horas_estimadas}h</Badge>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Resumo executivo</p>
                  <p className="text-xs text-foreground/80">{classificacao.resumo_executivo}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Escopo sugerido</p>
                  <Textarea
                    value={classificacao.escopo_sugerido}
                    onChange={(e) => atualizarEscopoSugerido(e.target.value)}
                    rows={8}
                    className="bg-background/60 border-border/40 text-xs text-foreground/80"
                    placeholder="Revise e ajuste o escopo antes da publicação..."
                  />
                </div>
                {classificacao.modulos_sugeridos && classificacao.modulos_sugeridos.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Módulos sugeridos</p>
                    <div className="flex flex-wrap gap-1.5">
                      {classificacao.modulos_sugeridos.map((m, i) => <Badge key={i} variant="secondary" className="text-[11px]">{m}</Badge>)}
                    </div>
                  </div>
                )}
                {classificacao.riscos && classificacao.riscos.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                      <AlertTriangle size={11} className="text-warning" /> Riscos identificados
                    </p>
                    <ul className="text-xs text-foreground/80 list-disc list-inside space-y-0.5">
                      {classificacao.riscos.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!classificacao && (
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 flex items-start gap-2 text-xs">
                <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Você ainda não rodou a análise da IA.</p>
                  <p className="text-muted-foreground">Volte ao passo "Informações" e clique em "Analisar com IA" para enriquecer o projeto antes de publicar.</p>
                </div>
              </div>
            )}

            {/* Briefing */}
            {(form.problema_atual || form.objetivo) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {form.problema_atual && (
                  <div className="bg-muted/30 rounded-xl p-3.5 border border-border/40">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Problema atual</p>
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap">{form.problema_atual}</p>
                  </div>
                )}
                {form.objetivo && (
                  <div className="bg-muted/30 rounded-xl p-3.5 border border-border/40">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Objetivo</p>
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap">{form.objetivo}</p>
                  </div>
                )}
              </div>
            )}

            {/* Fases */}
            <div className="bg-muted/30 rounded-xl p-3.5 border border-border/40">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Fases ({fases.filter(f => f.nome).length})</p>
              <div className="space-y-1.5">
                {fases.filter(f => f.nome).map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{i + 1}. {f.nome}</span>
                    <span className="text-muted-foreground">{f.percentual || 0}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Anexos */}
            {anexos.length > 0 && (
              <div className="bg-muted/30 rounded-xl p-3.5 border border-border/40">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Anexos ({anexos.length})</p>
                <div className="space-y-1">
                  {anexos.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Paperclip size={11} className="text-muted-foreground" />
                      <span className="flex-1 truncate">{a.file.name}</span>
                      <span className="text-muted-foreground">{(a.file.size / 1024).toFixed(0)}KB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Perguntas */}
            {perguntas.filter(p => p.pergunta.trim()).length > 0 && (
              <div className="bg-muted/30 rounded-xl p-3.5 border border-border/40">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Perguntas de qualificação ({perguntas.length})</p>
                <ul className="text-xs text-foreground/80 list-decimal list-inside space-y-0.5">
                  {perguntas.map((p, i) => (
                    <li key={i}>{p.pergunta} {p.obrigatoria && <span className="text-[10px] text-primary">(obrigatória)</span>}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft size={14} /> Voltar</Button>
              <Button variant="glow" onClick={handlePublish} disabled={saving || !form.nome}>
                {saving ? <><Loader2 size={14} className="animate-spin" /> Publicando...</> : <><Rocket size={14} /> Publicar Projeto</>}
              </Button>
            </div>
          </div>
        )}
      </DataCard>
    </div>
  );
};

export default EmpresaNovoProjeto;
