import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, DataCard } from "@/components/dashboard/DashboardComponents";
import AIChatPanel from "@/components/ai/AIChatPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, AlertTriangle, TrendingUp, Clock } from "lucide-react";

const AdminAIProjectManager = () => {
  const [projetos, setProjetos] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [projectData, setProjectData] = useState<any>(null);

  useEffect(() => {
    supabase.from("projetos").select("id, nome, status, protocolo").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setProjetos(data);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) { setProjectData(null); return; }
    const load = async () => {
      const [projRes, fasesRes, alertasRes, propostasRes] = await Promise.all([
        supabase.from("projetos").select("*").eq("id", selectedId).single(),
        supabase.from("projeto_fases").select("*").eq("projeto_id", selectedId).order("ordem"),
        supabase.from("projeto_alertas").select("*").eq("projeto_id", selectedId).eq("resolvido", false),
        supabase.from("propostas").select("*").eq("projeto_id", selectedId),
      ]);
      setProjectData({
        projeto: projRes.data,
        fases: fasesRes.data || [],
        alertas: alertasRes.data || [],
        propostas: propostasRes.data || [],
      });
    };
    load();
  }, [selectedId]);

  const alertCount = projectData?.alertas?.length || 0;
  const fasesCount = projectData?.fases?.length || 0;
  const fasesAtrasadas = projectData?.fases?.filter((f: any) => f.prazo && new Date(f.prazo) < new Date() && f.status !== "aprovada").length || 0;

  return (
    <div>
      <PageHeader title="AI Project Manager" description="Gerente de projetos inteligente com análise e alertas automáticos" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Project selector */}
          <DataCard>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Brain size={20} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-display font-semibold text-foreground">Selecione um projeto para análise</p>
                <p className="text-xs text-muted-foreground">A IA vai analisar dados reais do projeto</p>
              </div>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projetos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.protocolo ? `${p.protocolo} - ` : ""}{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DataCard>

          {/* Chat */}
          <DataCard className="h-[500px] flex flex-col p-0 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/30">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Brain size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-display font-semibold text-foreground">AI Project Manager</p>
                <p className="text-[11px] text-muted-foreground">
                  {selectedId ? "Analisando projeto selecionado" : "Selecione um projeto acima"}
                </p>
              </div>
            </div>
            <AIChatPanel
              key={selectedId}
              mode="project-manager"
              projectData={projectData}
              placeholder={selectedId ? "Pergunte sobre o projeto..." : "Selecione um projeto primeiro..."}
              initialMessage={selectedId && projectData ? "Analise o status deste projeto, identifique riscos e gere um resumo com recomendações." : undefined}
            />
          </DataCard>
        </div>

        {/* Stats sidebar */}
        <div className="space-y-4">
          {projectData && (
            <>
              <DataCard>
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle size={16} className={alertCount > 0 ? "text-destructive" : "text-success"} />
                  <span className="text-sm font-display font-semibold text-foreground">Alertas Ativos</span>
                </div>
                <p className="text-3xl font-display font-bold text-foreground">{alertCount}</p>
                {alertCount > 0 && (
                  <div className="mt-3 space-y-2">
                    {projectData.alertas.slice(0, 3).map((a: any) => (
                      <div key={a.id} className="text-xs p-2 rounded-lg bg-destructive/5 text-destructive border border-destructive/10">
                        ⚠️ {a.titulo}
                      </div>
                    ))}
                  </div>
                )}
              </DataCard>

              <DataCard>
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp size={16} className="text-primary" />
                  <span className="text-sm font-display font-semibold text-foreground">Fases</span>
                </div>
                <p className="text-3xl font-display font-bold text-foreground">{fasesCount}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fasesAtrasadas > 0 ? <span className="text-destructive">{fasesAtrasadas} atrasada(s)</span> : "Todas no prazo"}
                </p>
              </DataCard>

              <DataCard>
                <div className="flex items-center gap-3 mb-3">
                  <Clock size={16} className="text-accent" />
                  <span className="text-sm font-display font-semibold text-foreground">Propostas</span>
                </div>
                <p className="text-3xl font-display font-bold text-foreground">{projectData.propostas?.length || 0}</p>
              </DataCard>
            </>
          )}

          <DataCard>
            <h3 className="font-display font-semibold text-foreground text-sm mb-3">Exemplos de perguntas</h3>
            <div className="space-y-2">
              {[
                "Gere um resumo semanal",
                "Quais riscos existem?",
                "Qual o status das fases?",
                "Sugira ações corretivas",
                "Compare horas planejadas vs executadas",
              ].map((q) => (
                <div key={q} className="text-xs text-muted-foreground p-2 rounded-lg bg-muted/40 border border-border/50">
                  💬 {q}
                </div>
              ))}
            </div>
          </DataCard>
        </div>
      </div>
    </div>
  );
};

export default AdminAIProjectManager;
