import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, CalendarDays, Layers, Loader2, Plus, X, Bell } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto: any;
  onSaved?: () => void;
}

const editSchema = z.object({
  descricao: z.string().trim().max(2000, "Máximo 2000 caracteres").optional().nullable(),
  objetivo: z.string().trim().max(1000, "Máximo 1000 caracteres").optional().nullable(),
  problema_atual: z.string().trim().max(2000, "Máximo 2000 caracteres").optional().nullable(),
  observacoes: z.string().trim().max(2000, "Máximo 2000 caracteres").optional().nullable(),
  prazo_estimado: z.string().optional().nullable(),
  prazo_propostas: z.string().optional().nullable(),
  modelo_contratacao: z.enum(["presencial", "hibrido", "remoto"]).optional().nullable(),
});

interface ScopeItem { id: string; nome: string; }

export const ProjetoEditDialog = ({ open, onOpenChange, projeto, onSaved }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [notifyConsultants, setNotifyConsultants] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [form, setForm] = useState({
    descricao: "", objetivo: "", problema_atual: "", observacoes: "",
    prazo_estimado: "", prazo_propostas: "", modelo_contratacao: "" as "" | "presencial" | "hibrido" | "remoto",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Scope
  const [allModulos, setAllModulos] = useState<ScopeItem[]>([]);
  const [allFuncs, setAllFuncs] = useState<ScopeItem[]>([]);
  const [selectedModulos, setSelectedModulos] = useState<Set<string>>(new Set());
  const [selectedFuncs, setSelectedFuncs] = useState<Set<string>>(new Set());
  const [loadingScope, setLoadingScope] = useState(true);
  const [savingScope, setSavingScope] = useState(false);

  useEffect(() => {
    if (!open || !projeto) return;
    setForm({
      descricao: projeto.descricao || "",
      objetivo: projeto.objetivo || "",
      problema_atual: projeto.problema_atual || "",
      observacoes: projeto.observacoes || "",
      prazo_estimado: projeto.prazo_estimado || "",
      prazo_propostas: (projeto as any).prazo_propostas || "",
      modelo_contratacao: (projeto.modelo_contratacao as any) || "",
    });
    setNotifyConsultants(false);
    setNotificationMessage(`Houve uma atualização importante no projeto "${projeto.nome}". Acesse a plataforma para revisar os detalhes.`);
    setErrors({});
    loadScope();
  }, [open, projeto?.id]);

  const notifyLinkedConsultants = async () => {
    if (!notifyConsultants) return;
    const { error } = await (supabase as any).rpc("notify_project_linked_consultants", {
      p_projeto_id: projeto.id,
      p_mensagem: notificationMessage,
    });
    if (error) throw error;
  };

  const loadScope = async () => {
    setLoadingScope(true);
    if (!projeto?.software_id) {
      setAllModulos([]); setAllFuncs([]); setLoadingScope(false); return;
    }
    const [modsRes, projModsRes] = await Promise.all([
      supabase.from("modulos").select("id, nome").eq("software_id", projeto.software_id).order("nome"),
      supabase.from("projeto_modulos").select("modulo_id").eq("projeto_id", projeto.id),
    ]);
    const modulos = (modsRes.data || []) as ScopeItem[];
    setAllModulos(modulos);
    const selMods = new Set((projModsRes.data || []).map((m: any) => m.modulo_id));
    setSelectedModulos(selMods);

    const moduloIds = modulos.map(m => m.id);
    if (moduloIds.length > 0) {
      const [funcsRes, projFuncsRes] = await Promise.all([
        supabase.from("funcionalidades").select("id, nome, modulo_id").in("modulo_id", moduloIds).order("nome"),
        supabase.from("projeto_funcionalidades").select("funcionalidade_id").eq("projeto_id", projeto.id),
      ]);
      setAllFuncs((funcsRes.data || []) as ScopeItem[]);
      setSelectedFuncs(new Set((projFuncsRes.data || []).map((f: any) => f.funcionalidade_id)));
    } else {
      setAllFuncs([]); setSelectedFuncs(new Set());
    }
    setLoadingScope(false);
  };

  const handleSaveInfo = async () => {
    setErrors({});
    const parsed = editSchema.safeParse({
      descricao: form.descricao || null,
      objetivo: form.objetivo || null,
      problema_atual: form.problema_atual || null,
      observacoes: form.observacoes || null,
      prazo_estimado: form.prazo_estimado || null,
      prazo_propostas: form.prazo_propostas || null,
      modelo_contratacao: (form.modelo_contratacao || null) as any,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach(i => { if (i.path[0]) errs[String(i.path[0])] = i.message; });
      setErrors(errs);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("projetos")
      .update({
        descricao: parsed.data.descricao,
        objetivo: parsed.data.objetivo,
        problema_atual: parsed.data.problema_atual,
        observacoes: parsed.data.observacoes,
        prazo_estimado: parsed.data.prazo_estimado || null,
        prazo_propostas: parsed.data.prazo_propostas || null,
        modelo_contratacao: parsed.data.modelo_contratacao || null,
      })
      .eq("id", projeto.id);
    setSaving(false);
    try {
      if (error) throw error;
      await notifyLinkedConsultants();
      toast({ title: "Projeto atualizado", description: notifyConsultants ? "As informações foram salvas e os consultores vinculados foram notificados." : "As informações foram salvas com sucesso." });
      onSaved?.();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveScope = async () => {
    setSavingScope(true);
    try {
      // Replace módulos
      await supabase.from("projeto_modulos").delete().eq("projeto_id", projeto.id);
      if (selectedModulos.size > 0) {
        const rows = Array.from(selectedModulos).map(mid => ({ projeto_id: projeto.id, modulo_id: mid }));
        const { error } = await supabase.from("projeto_modulos").insert(rows);
        if (error) throw error;
      }
      // Replace funcionalidades (only those whose modulo is still selected)
      const validFuncIds = allFuncs
        .filter((f: any) => selectedModulos.has(f.modulo_id) && selectedFuncs.has(f.id))
        .map(f => f.id);
      await supabase.from("projeto_funcionalidades").delete().eq("projeto_id", projeto.id);
      if (validFuncIds.length > 0) {
        const rows = validFuncIds.map(fid => ({ projeto_id: projeto.id, funcionalidade_id: fid }));
        const { error } = await supabase.from("projeto_funcionalidades").insert(rows);
        if (error) throw error;
      }
      await notifyLinkedConsultants();
      toast({ title: "Escopo atualizado", description: notifyConsultants ? "Módulos, funcionalidades e notificação foram atualizados." : "Módulos e funcionalidades foram atualizados." });
      onSaved?.();
    } catch (err: any) {
      toast({ title: "Erro ao salvar escopo", description: err.message, variant: "destructive" });
    } finally {
      setSavingScope(false);
    }
  };

  const toggleModulo = (id: string) => {
    setSelectedModulos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleFunc = (id: string) => {
    setSelectedFuncs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!projeto) return null;

  const funcsByModulo = new Map<string, any[]>();
  allFuncs.forEach((f: any) => {
    const arr = funcsByModulo.get(f.modulo_id) || [];
    arr.push(f);
    funcsByModulo.set(f.modulo_id, arr);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            Editar projeto · {projeto.nome}
          </DialogTitle>
          <DialogDescription>
            Atualize informações do projeto a qualquer momento. As alterações ficam visíveis para os consultores.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-3 grid grid-cols-2 h-9">
            <TabsTrigger value="info" className="text-xs"><FileText size={13} className="mr-1.5" />Informações</TabsTrigger>
            <TabsTrigger value="escopo" className="text-xs"><Layers size={13} className="mr-1.5" />Escopo técnico</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6 py-4">
            <TabsContent value="info" className="mt-0 space-y-4">
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  rows={3}
                  maxLength={2000}
                  placeholder="Descreva o projeto em alto nível..."
                />
                {errors.descricao && <p className="text-xs text-destructive mt-1">{errors.descricao}</p>}
                <p className="text-[10px] text-muted-foreground text-right mt-0.5">{form.descricao.length}/2000</p>
              </div>

              <div>
                <Label className="text-xs">Objetivo</Label>
                <Textarea
                  value={form.objetivo}
                  onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}
                  rows={2}
                  maxLength={1000}
                  placeholder="O que o projeto precisa entregar?"
                />
                {errors.objetivo && <p className="text-xs text-destructive mt-1">{errors.objetivo}</p>}
              </div>

              <div>
                <Label className="text-xs">Problema atual</Label>
                <Textarea
                  value={form.problema_atual}
                  onChange={e => setForm(f => ({ ...f, problema_atual: e.target.value }))}
                  rows={3}
                  maxLength={2000}
                  placeholder="Qual dor de negócio está sendo endereçada?"
                />
                {errors.problema_atual && <p className="text-xs text-destructive mt-1">{errors.problema_atual}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1"><CalendarDays size={12} /> Prazo estimado</Label>
                  <Input
                    type="date"
                    value={form.prazo_estimado || ""}
                    onChange={e => setForm(f => ({ ...f, prazo_estimado: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><CalendarDays size={12} /> Prazo p/ propostas</Label>
                  <Input
                    type="date"
                    value={form.prazo_propostas || ""}
                    onChange={e => setForm(f => ({ ...f, prazo_propostas: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Modelo de contratação</Label>
                  <Select
                    value={form.modelo_contratacao || ""}
                    onValueChange={(v) => setForm(f => ({ ...f, modelo_contratacao: v as any }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presencial">Presencial</SelectItem>
                      <SelectItem value="hibrido">Híbrido</SelectItem>
                      <SelectItem value="remoto">Remoto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Observações adicionais</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  rows={3}
                  maxLength={2000}
                  placeholder="Informações complementares para os consultores..."
                />
                {errors.observacoes && <p className="text-xs text-destructive mt-1">{errors.observacoes}</p>}
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <Button onClick={handleSaveInfo} disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Salvar informações
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="escopo" className="mt-0 space-y-4">
              {!projeto.software_id ? (
                <p className="text-sm text-muted-foreground italic">
                  Este projeto não possui um software definido. Defina um software para gerenciar o escopo técnico.
                </p>
              ) : loadingScope ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
              ) : (
                <>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Módulos</p>
                    {allModulos.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Nenhum módulo cadastrado para este software.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {allModulos.map(m => {
                          const sel = selectedModulos.has(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => toggleModulo(m.id)}
                              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 ${
                                sel ? "bg-primary/10 border-primary/40 text-primary" : "bg-card border-border text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              {sel ? <X size={11} /> : <Plus size={11} />}
                              {m.nome}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedModulos.size > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Funcionalidades</p>
                      <div className="space-y-3">
                        {Array.from(selectedModulos).map(mid => {
                          const mod = allModulos.find(m => m.id === mid);
                          const funcs = funcsByModulo.get(mid) || [];
                          if (!mod || funcs.length === 0) return null;
                          return (
                            <div key={mid} className="rounded-xl border border-border/60 p-3 bg-card">
                              <p className="text-xs font-semibold text-foreground mb-2">{mod.nome}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {funcs.map((f: any) => {
                                  const sel = selectedFuncs.has(f.id);
                                  return (
                                    <button
                                      key={f.id}
                                      type="button"
                                      onClick={() => toggleFunc(f.id)}
                                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                                        sel ? "bg-accent/15 border-accent/40 text-accent-foreground" : "bg-card border-border text-muted-foreground hover:bg-muted"
                                      }`}
                                    >
                                      {f.nome}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      {selectedModulos.size} módulo(s) · {selectedFuncs.size} funcionalidade(s)
                    </p>
                    <Button onClick={handleSaveScope} disabled={savingScope}>
                      {savingScope ? <Loader2 size={14} className="animate-spin" /> : null}
                      Salvar escopo
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
