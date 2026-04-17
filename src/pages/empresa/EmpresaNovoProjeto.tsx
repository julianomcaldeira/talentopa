import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { ArrowLeft, ArrowRight, Check, FileText, Target, Settings, Rocket, Plus, Trash2 } from "lucide-react";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</Label>
);

const steps = [
  { label: "Informações", icon: FileText },
  { label: "Escopo", icon: Target },
  { label: "Fases", icon: Settings },
  { label: "Publicar", icon: Rocket },
];

const EmpresaNovoProjeto = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [softwares, setSoftwares] = useState<any[]>([]);
  const [modulos, setModulos] = useState<any[]>([]);
  const [funcionalidades, setFuncionalidades] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    const fetch = async () => {
      const [swRes, modRes, funcRes, tplRes] = await Promise.all([
        supabase.from("softwares").select("*").order("nome"),
        supabase.from("modulos").select("*").order("nome"),
        supabase.from("funcionalidades").select("*").order("nome"),
        supabase.from("templates").select("*, template_funcionalidades(funcionalidade_id)").order("nome"),
      ]);
      if (swRes.data) setSoftwares(swRes.data);
      if (modRes.data) setModulos(modRes.data);
      if (funcRes.data) setFuncionalidades(funcRes.data);
      if (tplRes.data) setTemplates(tplRes.data);
    };
    fetch();
  }, []);

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
      status: "publicado" as const,
    }).select("id").single();
    if (error || !projeto) { toast({ title: "Erro", description: error?.message, variant: "destructive" }); setSaving(false); return; }

    if (selectedModulos.length > 0) await supabase.from("projeto_modulos").insert(selectedModulos.map(mid => ({ projeto_id: projeto.id, modulo_id: mid })));
    if (selectedFuncs.length > 0) await supabase.from("projeto_funcionalidades").insert(selectedFuncs.map(fid => ({ projeto_id: projeto.id, funcionalidade_id: fid })));
    const validFases = fases.filter(f => f.nome);
    if (validFases.length > 0) await supabase.from("projeto_fases").insert(validFases.map((f, i) => ({ projeto_id: projeto.id, nome: f.nome, descricao: f.descricao || null, ordem: i, prazo: f.prazo || null, valor: f.valor ? Number(f.valor) : null })));

    toast({ title: "Projeto publicado com sucesso!" });
    navigate("/empresa/projetos");
    setSaving(false);
  };

  return (
    <div>
      <PageHeader title="Novo Projeto" description="Crie um projeto de implementação ERP em poucos passos" />

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
            <div className="space-y-2"><SectionLabel>Nome do Projeto *</SectionLabel><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Implantação TOTVS - Módulo Financeiro" /></div>
            <div className="space-y-2"><SectionLabel>Descrição</SectionLabel><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2"><SectionLabel>Problema Atual</SectionLabel><Textarea value={form.problema_atual} onChange={(e) => setForm({ ...form, problema_atual: e.target.value })} rows={2} placeholder="Descreva o problema a resolver" /></div>
              <div className="space-y-2"><SectionLabel>Objetivo</SectionLabel><Textarea value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} rows={2} /></div>
            </div>
            <div className="space-y-2 max-w-xs"><SectionLabel>Prazo Estimado</SectionLabel><Input type="date" value={form.prazo_estimado} onChange={(e) => setForm({ ...form, prazo_estimado: e.target.value })} /></div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(1)} disabled={!form.nome}>Próximo <ArrowRight size={14} /></Button>
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
            <h3 className="font-display font-semibold text-foreground text-lg mb-2">Revisar e Publicar</h3>
            <div className="space-y-3">
              <div className="bg-muted/30 rounded-xl p-4 space-y-2.5 border border-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Projeto</span>
                </div>
                <p className="text-base font-display font-semibold text-foreground">{form.nome}</p>
                {form.descricao && <p className="text-sm text-muted-foreground">{form.descricao}</p>}
              </div>
              <div className="grid grid-cols-3 gap-3">
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
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft size={14} /> Voltar</Button>
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
