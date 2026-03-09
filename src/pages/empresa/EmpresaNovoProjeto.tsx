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

const EmpresaNovoProjeto = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [softwares, setSoftwares] = useState<any[]>([]);
  const [modulos, setModulos] = useState<any[]>([]);
  const [funcionalidades, setFuncionalidades] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nome: "", descricao: "", problema_atual: "", objetivo: "", prazo_estimado: "",
    software_id: "", template_id: "", observacoes: "",
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
      const funcIds = tpl.template_funcionalidades?.map((tf: any) => tf.funcionalidade_id) || [];
      setSelectedFuncs(funcIds);
      setForm({ ...form, template_id: templateId });
    }
  };

  const handlePublish = async () => {
    if (!user) return;
    setSaving(true);

    const { data: projeto, error } = await supabase.from("projetos").insert({
      empresa_user_id: user.id,
      nome: form.nome,
      descricao: form.descricao || null,
      problema_atual: form.problema_atual || null,
      objetivo: form.objetivo || null,
      prazo_estimado: form.prazo_estimado || null,
      software_id: form.software_id || null,
      template_id: form.template_id || null,
      observacoes: form.observacoes || null,
      status: "publicado" as const,
    }).select("id").single();

    if (error || !projeto) {
      toast({ title: "Erro", description: error?.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Insert modules
    if (selectedModulos.length > 0) {
      await supabase.from("projeto_modulos").insert(
        selectedModulos.map(mid => ({ projeto_id: projeto.id, modulo_id: mid }))
      );
    }

    // Insert funcionalidades
    if (selectedFuncs.length > 0) {
      await supabase.from("projeto_funcionalidades").insert(
        selectedFuncs.map(fid => ({ projeto_id: projeto.id, funcionalidade_id: fid }))
      );
    }

    // Insert fases
    const validFases = fases.filter(f => f.nome);
    if (validFases.length > 0) {
      await supabase.from("projeto_fases").insert(
        validFases.map((f, i) => ({
          projeto_id: projeto.id,
          nome: f.nome,
          descricao: f.descricao || null,
          ordem: i,
          prazo: f.prazo || null,
          valor: f.valor ? Number(f.valor) : null,
        }))
      );
    }

    toast({ title: "Projeto publicado com sucesso!" });
    navigate("/empresa/projetos");
    setSaving(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-2">Novo Projeto</h1>
      <p className="text-muted-foreground mb-6">Crie um novo projeto de implementação ERP</p>

      {/* Steps indicator */}
      <div className="flex gap-2 mb-8">
        {["Informações", "Escopo", "Fases", "Publicar"].map((s, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full ${i + 1 <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      <div className="bg-card rounded-xl p-6 shadow-card border border-border max-w-3xl">
        {step === 1 && (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-foreground">Informações Gerais</h3>
            <div className="space-y-2"><Label>Nome do Projeto *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Implantação TOTVS - Módulo Financeiro" /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
            <div className="space-y-2"><Label>Problema Atual</Label><Textarea value={form.problema_atual} onChange={(e) => setForm({ ...form, problema_atual: e.target.value })} rows={2} placeholder="Descreva o problema que este projeto visa resolver" /></div>
            <div className="space-y-2"><Label>Objetivo</Label><Textarea value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Prazo Estimado</Label><Input type="date" value={form.prazo_estimado} onChange={(e) => setForm({ ...form, prazo_estimado: e.target.value })} /></div>
            <Button onClick={() => setStep(2)} disabled={!form.nome}>Próximo</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-foreground">Escopo do Projeto</h3>
            <div className="space-y-2">
              <Label>Software ERP</Label>
              <Select value={form.software_id} onValueChange={(v) => { setForm({ ...form, software_id: v }); setSelectedModulos([]); setSelectedFuncs([]); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{softwares.map(sw => <SelectItem key={sw.id} value={sw.id}>{sw.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {templates.length > 0 && (
              <div className="space-y-2">
                <Label>Ou use um Template</Label>
                <Select value={form.template_id} onValueChange={applyTemplate}>
                  <SelectTrigger><SelectValue placeholder="Selecione um template (opcional)" /></SelectTrigger>
                  <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {form.software_id && filteredModulos.length > 0 && (
              <div className="space-y-2">
                <Label>Módulos</Label>
                <div className="border border-border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                  {filteredModulos.map(m => (
                    <label key={m.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox checked={selectedModulos.includes(m.id)} onCheckedChange={() => setSelectedModulos(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])} />
                      {m.nome}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {filteredFuncs.length > 0 && (
              <div className="space-y-2">
                <Label>Funcionalidades</Label>
                <div className="border border-border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                  {filteredFuncs.map(f => (
                    <label key={f.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox checked={selectedFuncs.includes(f.id)} onCheckedChange={() => setSelectedFuncs(prev => prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id])} />
                      {f.nome} {f.horas_media_estimadas ? `(${f.horas_media_estimadas}h)` : ""}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={() => setStep(3)}>Próximo</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-foreground">Fases do Projeto</h3>
            {fases.map((fase, i) => (
              <div key={i} className="border border-border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1"><Label>Fase</Label><Input value={fase.nome} onChange={(e) => { const f = [...fases]; f[i].nome = e.target.value; setFases(f); }} /></div>
                  <div className="space-y-1"><Label>Prazo</Label><Input type="date" value={fase.prazo} onChange={(e) => { const f = [...fases]; f[i].prazo = e.target.value; setFases(f); }} /></div>
                  <div className="space-y-1"><Label>Valor (R$)</Label><Input type="number" value={fase.valor} onChange={(e) => { const f = [...fases]; f[i].valor = e.target.value; setFases(f); }} /></div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setFases([...fases, { nome: "", descricao: "", prazo: "", valor: "" }])}>
              + Adicionar fase
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={() => setStep(4)}>Próximo</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-foreground">Revisar e Publicar</h3>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p><strong>Projeto:</strong> {form.nome}</p>
              {form.descricao && <p><strong>Descrição:</strong> {form.descricao}</p>}
              {form.software_id && <p><strong>Software:</strong> {softwares.find(s => s.id === form.software_id)?.nome}</p>}
              <p><strong>Módulos:</strong> {selectedModulos.length}</p>
              <p><strong>Funcionalidades:</strong> {selectedFuncs.length}</p>
              <p><strong>Fases:</strong> {fases.filter(f => f.nome).length}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>Voltar</Button>
              <Button onClick={handlePublish} disabled={saving}>
                {saving ? "Publicando..." : "Publicar Projeto"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmpresaNovoProjeto;
