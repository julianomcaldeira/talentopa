import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ClipboardList, Plus, Trash2, CheckCircle2, Send, GripVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ProjectQuestionsProps {
  projetoId: string;
  isEmpresa: boolean; // true = can edit questions, false = consultor answering
}

interface Pergunta {
  id: string;
  pergunta: string;
  obrigatoria: boolean;
  ordem: number;
}

interface Resposta {
  id: string;
  pergunta_id: string;
  resposta: string;
  consultor_user_id: string;
}

export const ProjectQuestions = ({ projetoId, isEmpresa }: ProjectQuestionsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [respostas, setRespostas] = useState<Map<string, string>>(new Map());
  const [existingRespostas, setExistingRespostas] = useState<Resposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // For empresa: new question form
  const [newPergunta, setNewPergunta] = useState("");
  const [newObrigatoria, setNewObrigatoria] = useState(true);

  const fetchData = async () => {
    const { data: pergs } = await supabase
      .from("projeto_perguntas")
      .select("*")
      .eq("projeto_id", projetoId)
      .order("ordem", { ascending: true });

    if (pergs) setPerguntas(pergs);

    if (!isEmpresa && user && pergs && pergs.length > 0) {
      const pergIds = pergs.map(p => p.id);
      const { data: resps } = await supabase
        .from("consultor_respostas")
        .select("*")
        .in("pergunta_id", pergIds)
        .eq("consultor_user_id", user.id);

      if (resps) {
        setExistingRespostas(resps);
        const map = new Map<string, string>();
        resps.forEach(r => map.set(r.pergunta_id, r.resposta));
        setRespostas(map);
      }
    }

    // If empresa, fetch all answers from all consultants
    if (isEmpresa && pergs && pergs.length > 0) {
      const pergIds = pergs.map(p => p.id);
      const { data: resps } = await supabase
        .from("consultor_respostas")
        .select("*, consultor:profiles!consultor_respostas_consultor_user_id_fkey(nome)")
        .in("pergunta_id", pergIds);

      if (resps) setExistingRespostas(resps as any);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [projetoId, user]);

  // Empresa: Add question
  const addQuestion = async () => {
    if (!newPergunta.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("projeto_perguntas").insert({
      projeto_id: projetoId,
      pergunta: newPergunta.trim(),
      obrigatoria: newObrigatoria,
      ordem: perguntas.length,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewPergunta("");
      setNewObrigatoria(true);
      await fetchData();
      toast({ title: "Pergunta adicionada!" });
    }
    setSaving(false);
  };

  // Empresa: Remove question
  const removeQuestion = async (id: string) => {
    await supabase.from("projeto_perguntas").delete().eq("id", id);
    await fetchData();
  };

  // Consultor: Submit answers
  const submitAnswers = async () => {
    if (!user) return;
    setSaving(true);

    const required = perguntas.filter(p => p.obrigatoria);
    const missing = required.filter(p => !respostas.get(p.id)?.trim());
    if (missing.length > 0) {
      toast({
        title: "Campos obrigatórios",
        description: `Responda todas as ${missing.length} perguntas obrigatórias`,
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    try {
      for (const [pergunta_id, resposta] of respostas.entries()) {
        if (!resposta.trim()) continue;
        
        // Moderate each answer
        const { data: modResult } = await supabase.functions.invoke("moderate-message", {
          body: { conteudo: resposta.trim() },
        });

        if (modResult && !modResult.aprovado) {
          const pergunta = perguntas.find(p => p.id === pergunta_id);
          toast({
            title: "Resposta bloqueada",
            description: `"${pergunta?.pergunta}": ${modResult.motivo}`,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }

        const existing = existingRespostas.find(r => r.pergunta_id === pergunta_id);
        if (existing) {
          await supabase.from("consultor_respostas")
            .update({ resposta: resposta.trim() })
            .eq("id", existing.id);
        } else {
          await supabase.from("consultor_respostas").insert({
            pergunta_id,
            consultor_user_id: user.id,
            resposta: resposta.trim(),
          });
        }
      }
      toast({ title: "Respostas salvas com sucesso!" });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-20">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList size={16} className="text-primary" />
        <h4 className="text-sm font-display font-semibold text-foreground">
          {isEmpresa ? "Formulário de Qualificação" : "Perguntas do Projeto"}
        </h4>
      </div>

      {isEmpresa && (
        <>
          {/* Add question form */}
          <div className="p-3 rounded-xl border border-dashed border-border bg-muted/20 space-y-3">
            <Input
              value={newPergunta}
              onChange={(e) => setNewPergunta(e.target.value)}
              placeholder="Digite uma pergunta para os consultores..."
              className="text-sm"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={newObrigatoria} onCheckedChange={setNewObrigatoria} />
                <Label className="text-xs text-muted-foreground">Obrigatória</Label>
              </div>
              <Button size="sm" onClick={addQuestion} disabled={!newPergunta.trim() || saving}>
                <Plus size={14} /> Adicionar
              </Button>
            </div>
          </div>

          {/* Questions list with answers */}
          <AnimatePresence>
            {perguntas.map((p, i) => {
              const answers = existingRespostas.filter((r: any) => r.pergunta_id === p.id);
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 rounded-xl border border-border bg-card space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded-md px-1.5 py-0.5 mt-0.5">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm text-foreground">{p.pergunta}</p>
                        {p.obrigatoria && (
                          <span className="text-[10px] text-destructive font-medium">Obrigatória</span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeQuestion(p.id)}>
                      <Trash2 size={13} className="text-destructive" />
                    </Button>
                  </div>
                  {answers.length > 0 && (
                    <div className="ml-6 space-y-1.5 pt-1 border-t border-border/50">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                        {answers.length} resposta(s)
                      </p>
                      {answers.map((a: any) => (
                        <div key={a.id} className="flex items-start gap-2 bg-muted/40 rounded-lg p-2">
                          <CheckCircle2 size={12} className="text-success mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[11px] font-medium text-foreground">
                              {(a as any).consultor?.nome || "Consultor"}
                            </p>
                            <p className="text-xs text-muted-foreground">{a.resposta}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {perguntas.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma pergunta criada. Adicione perguntas para qualificar os consultores.
            </p>
          )}
        </>
      )}

      {!isEmpresa && (
        <>
          {perguntas.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              A empresa ainda não adicionou perguntas para este projeto.
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {perguntas.map((p, i) => {
                  const existing = existingRespostas.find(r => r.pergunta_id === p.id);
                  return (
                    <div key={p.id} className="p-3 rounded-xl border border-border bg-card space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded-md px-1.5 py-0.5 mt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm text-foreground">
                            {p.pergunta}
                            {p.obrigatoria && <span className="text-destructive ml-1">*</span>}
                          </p>
                          <Textarea
                            value={respostas.get(p.id) || ""}
                            onChange={(e) => {
                              const map = new Map(respostas);
                              map.set(p.id, e.target.value);
                              setRespostas(map);
                            }}
                            placeholder="Sua resposta..."
                            rows={2}
                            className="mt-2 text-sm"
                          />
                          {existing && (
                            <p className="text-[10px] text-success flex items-center gap-1 mt-1">
                              <CheckCircle2 size={10} /> Respondido
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button onClick={submitAnswers} disabled={saving} className="w-full">
                <Send size={14} /> {existingRespostas.length > 0 ? "Atualizar respostas" : "Enviar respostas"}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
};
