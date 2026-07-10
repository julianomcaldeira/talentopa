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

import { FileText, CalendarDays, Layers, Loader2, Plus, X, Bell, History, Users, Lock, AlertTriangle } from "lucide-react";

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
  const [initialModulos, setInitialModulos] = useState<Set<string>>(new Set());
  const [initialFuncs, setInitialFuncs] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<any[]>([]);
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
    loadHistory();
  }, [open, projeto?.id]);

  const loadHistory = async () => {
    if (!projeto?.id) return;
    const { data } = await (supabase as any)
      .from("projeto_alteracoes_historico")
      .select("*")
      .eq("projeto_id", projeto.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
  };

  const registerChangeHistory = async (payload: {
    tipo: string;
    descricao: string;
    campos: string[];
    antigos: Record<string, any>;
    novos: Record<string, any>;
  }) => {
    const { error } = await (supabase as any).rpc("registrar_projeto_alteracao", {
      p_projeto_id: projeto.id,
      p_tipo_alteracao: payload.tipo,
      p_descricao: payload.descricao,
      p_campos_alterados: payload.campos,
      p_dados_anteriores: payload.antigos,
      p_dados_novos: payload.novos,
      p_notificar_consultores: notifyConsultants,
      p_mensagem: notificationMessage,
    });
    if (error) throw error;
    await loadHistory();
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
    setInitialModulos(new Set(selMods));

    const moduloIds = modulos.map(m => m.id);
    if (moduloIds.length > 0) {
      const [funcsRes, projFuncsRes] = await Promise.all([
        supabase.from("funcionalidades").select("id, nome, modulo_id").in("modulo_id", moduloIds).order("nome"),
        supabase.from("projeto_funcionalidades").select("funcionalidade_id").eq("projeto_id", projeto.id),
      ]);
      setAllFuncs((funcsRes.data || []) as ScopeItem[]);
      const selFuncs = new Set((projFuncsRes.data || []).map((f: any) => f.funcionalidade_id));
      setSelectedFuncs(selFuncs);
      setInitialFuncs(new Set(selFuncs));
    } else {
      setAllFuncs([]); setSelectedFuncs(new Set()); setInitialFuncs(new Set());
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
      const antigos = {
        descricao: projeto.descricao || null,
        objetivo: projeto.objetivo || null,
        problema_atual: projeto.problema_atual || null,
        observacoes: projeto.observacoes || null,
        prazo_estimado: projeto.prazo_estimado || null,
        prazo_propostas: (projeto as any).prazo_propostas || null,
        modelo_contratacao: projeto.modelo_contratacao || null,
      };
      const novos = {
        descricao: parsed.data.descricao,
        objetivo: parsed.data.objetivo,
        problema_atual: parsed.data.problema_atual,
        observacoes: parsed.data.observacoes,
        prazo_estimado: parsed.data.prazo_estimado || null,
        prazo_propostas: parsed.data.prazo_propostas || null,
        modelo_contratacao: parsed.data.modelo_contratacao || null,
      };
      const campos = Object.keys(novos).filter((key) => JSON.stringify((antigos as any)[key]) !== JSON.stringify((novos as any)[key]));
      if (campos.length > 0 || notifyConsultants) {
        await registerChangeHistory({ tipo: "informacoes", descricao: "Informações do projeto atualizadas", campos, antigos, novos });
      }
      toast({ title: "Projeto atualizado", description: notifyConsultants ? "As informações foram salvas e os consultores vinculados foram notificados." : "As informações foram salvas com sucesso." });
      onSaved?.();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveScope = async () => {
    if (projeto?.status === "concluido") {
      toast({ title: "Escopo bloqueado", description: "Projeto concluído: módulos, funcionalidades e fases não podem mais ser alterados.", variant: "destructive" });
      return;
    }
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
      const antigos = { modulos: Array.from(initialModulos), funcionalidades: Array.from(initialFuncs) };
      const novos = { modulos: Array.from(selectedModulos), funcionalidades: validFuncIds };
      const campos = [
        JSON.stringify(antigos.modulos.sort()) !== JSON.stringify([...novos.modulos].sort()) ? "modulos" : null,
        JSON.stringify(antigos.funcionalidades.sort()) !== JSON.stringify([...novos.funcionalidades].sort()) ? "funcionalidades" : null,
      ].filter(Boolean) as string[];
      if (campos.length > 0 || notifyConsultants) {
        await registerChangeHistory({ tipo: "escopo_tecnico", descricao: "Escopo técnico do projeto atualizado", campos, antigos, novos });
      }
      toast({ title: "Escopo atualizado", description: notifyConsultants ? "Módulos, funcionalidades e notificação foram atualizados." : "Módulos e funcionalidades foram atualizados." });
      onSaved?.();
    } catch (err: any) {
      toast({ title: "Erro ao salvar escopo", description: err.message, variant: "destructive" });
    } finally {
      setSavingScope(false);
    }
  };

  const handleSaveAll = async () => {
    await handleSaveInfo();
    if (projeto?.status !== "concluido" && projeto?.software_id) {
      await handleSaveScope();
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

  const isCompleted = projeto.status === "concluido";

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
            {isCompleted
              ? "Projeto concluído: apenas descrição e observações podem ser ajustadas. Campos críticos permanecem bloqueados."
              : "Atualize informações do projeto a qualquer momento. As alterações ficam visíveis para os consultores."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-3 grid grid-cols-3 h-9">
            <TabsTrigger value="info" className="text-xs"><FileText size={13} className="mr-1.5" />Informações</TabsTrigger>
            <TabsTrigger value="escopo" className="text-xs"><Layers size={13} className="mr-1.5" />Escopo técnico</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs"><History size={13} className="mr-1.5" />Histórico</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            <TabsContent value="info" className="mt-0 space-y-4">
              {isCompleted && (
                <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 flex items-start gap-2 text-xs">
                  <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Alterações críticas bloqueadas após a conclusão.</p>
                    <p className="text-muted-foreground mt-0.5">Você pode atualizar somente descrição e observações adicionais. Objetivo, problema, prazos, modelo de contratação e escopo técnico ficam preservados para auditoria.</p>
                  </div>
                </div>
              )}
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
                  disabled={isCompleted}
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
                  disabled={isCompleted}
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
                    disabled={isCompleted}
                  />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><CalendarDays size={12} /> Prazo p/ propostas</Label>
                  <Input
                    type="date"
                    value={form.prazo_propostas || ""}
                    onChange={e => setForm(f => ({ ...f, prazo_propostas: e.target.value }))}
                    disabled={isCompleted}
                  />
                </div>
                <div>
                  <Label className="text-xs">Modelo de contratação</Label>
                  <Select
                    value={form.modelo_contratacao || ""}
                    onValueChange={(v) => setForm(f => ({ ...f, modelo_contratacao: v as any }))}
                    disabled={isCompleted}
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

              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox checked={notifyConsultants} onCheckedChange={(v) => setNotifyConsultants(v === true)} className="mt-0.5" />
                  <span>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Bell size={13} className="text-primary" /> Notificar consultores vinculados
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      Use quando a alteração impactar escopo, prazo, modelo de contratação ou critérios de avaliação.
                    </span>
                  </span>
                </label>
                {notifyConsultants && (
                  <Textarea
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value.slice(0, 500))}
                    rows={2}
                    maxLength={500}
                    placeholder="Mensagem para os consultores vinculados..."
                    className="text-sm"
                  />
                )}
              </div>

            </TabsContent>


            <TabsContent value="escopo" className="mt-0 space-y-4">
              {isCompleted ? (
                <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3 text-sm">
                  <Lock size={16} className="text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Escopo técnico bloqueado</p>
                    <p className="text-xs text-muted-foreground mt-1">Módulos, funcionalidades e fases não podem ser alterados após a conclusão do projeto para preservar o histórico operacional.</p>
                  </div>
                </div>
              ) : !projeto.software_id ? (
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

                  <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <Checkbox checked={notifyConsultants} onCheckedChange={(v) => setNotifyConsultants(v === true)} className="mt-0.5" />
                      <span>
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Bell size={13} className="text-primary" /> Notificar consultores vinculados
                        </span>
                        <span className="block text-[11px] text-muted-foreground mt-0.5">
                          Use quando a mudança no escopo impactar proposta, prazo, esforço ou alinhamento técnico.
                        </span>
                      </span>
                    </label>
                    {notifyConsultants && (
                      <Textarea
                        value={notificationMessage}
                        onChange={(e) => setNotificationMessage(e.target.value.slice(0, 500))}
                        rows={2}
                        maxLength={500}
                        placeholder="Mensagem para os consultores vinculados..."
                        className="text-sm"
                      />
                    )}
                  </div>

                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      {selectedModulos.size} módulo(s) · {selectedFuncs.size} funcionalidade(s)
                    </p>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="historico" className="mt-0 space-y-3">
              {history.length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                  Nenhuma alteração significativa registrada para este projeto.
                </div>
              ) : history.map((item) => {
                const notified = Array.isArray(item.consultores_notificados) ? item.consultores_notificados : [];
                return (
                  <div key={item.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.descricao || "Alteração registrada"}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(item.created_at).toLocaleString("pt-BR")} · {item.tipo_alteracao?.replace(/_/g, " ")}
                        </p>
                      </div>
                      {item.notificar_consultores && (
                        <Badge variant="outline" className="border-primary/30 text-primary">
                          <Bell size={11} className="mr-1" /> Notificado
                        </Badge>
                      )}
                    </div>
                    {item.campos_alterados?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.campos_alterados.map((campo: string) => (
                          <Badge key={campo} variant="secondary" className="text-[10px]">{campo.replace(/_/g, " ")}</Badge>
                        ))}
                      </div>
                    )}
                    {item.mensagem_notificacao && (
                      <p className="rounded-lg bg-muted/40 border border-border/50 p-2.5 text-xs text-foreground/80">{item.mensagem_notificacao}</p>
                    )}
                    {item.notificar_consultores && (
                      <div className="text-[11px] text-muted-foreground flex items-start gap-2">
                        <Users size={13} className="mt-0.5 text-primary" />
                        <span>
                          {notified.length > 0
                            ? `${notified.length} consultor(es) notificado(s) em ${item.notificado_em ? new Date(item.notificado_em).toLocaleString("pt-BR") : "—"}: ${notified.map((c: any) => c.nome || "Consultor").join(", ")}`
                            : `Nenhum consultor vinculado elegível para notificação em ${item.notificado_em ? new Date(item.notificado_em).toLocaleString("pt-BR") : "—"}.`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </TabsContent>
          </div>
        </Tabs>

        <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-2 shrink-0 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || savingScope}>
            Cancelar
          </Button>
          <Button onClick={handleSaveAll} disabled={saving || savingScope}>
            {(saving || savingScope) ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
            Salvar alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
