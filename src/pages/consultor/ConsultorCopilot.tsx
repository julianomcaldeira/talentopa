import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, DataCard } from "@/components/dashboard/DashboardComponents";
import AIChatPanel from "@/components/ai/AIChatPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, FolderKanban, FileText, MessageSquare, Wrench, ClipboardList } from "lucide-react";

const quickActions = [
  { icon: MessageSquare, label: "Responder cliente", prompt: "Me ajude a escrever uma resposta profissional para o cliente sobre " },
  { icon: FileText, label: "Criar documentação", prompt: "Crie um documento técnico sobre " },
  { icon: Wrench, label: "Troubleshooting", prompt: "Preciso resolver um problema: " },
  { icon: ClipboardList, label: "Plano de ação", prompt: "Crie um plano de ação para " },
];

const ConsultorCopilot = () => {
  const { user } = useAuth();
  const [projetos, setProjetos] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [projectData, setProjectData] = useState<any>(null);
  const [activePrompt, setActivePrompt] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("propostas")
      .select("projeto_id, projetos(id, nome, protocolo, status)")
      .eq("consultor_user_id", user.id)
      .eq("status", "aceita")
      .then(({ data }) => {
        const projs = data?.map((d: any) => d.projetos).filter(Boolean) || [];
        setProjetos(projs);
      });
  }, [user]);

  useEffect(() => {
    if (!selectedId) { setProjectData(null); return; }
    const load = async () => {
      const [projRes, fasesRes] = await Promise.all([
        supabase.from("projetos").select("*").eq("id", selectedId).single(),
        supabase.from("projeto_fases").select("*").eq("projeto_id", selectedId).order("ordem"),
      ]);
      setProjectData({ projeto: projRes.data, fases: fasesRes.data || [] });
    };
    load();
  }, [selectedId]);

  return (
    <div>
      <PageHeader title="Copiloto IA" description="Seu assistente inteligente durante projetos" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Project selector */}
          {projetos.length > 0 && (
            <DataCard>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <FolderKanban size={20} className="text-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-display font-semibold text-foreground">Contexto do projeto</p>
                  <p className="text-xs text-muted-foreground">Selecione para respostas mais precisas</p>
                </div>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="w-[260px]">
                    <SelectValue placeholder="Selecione um projeto (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {projetos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.protocolo ? `${p.protocolo} - ` : ""}{p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DataCard>
          )}

          {/* Chat */}
          <DataCard className="h-[520px] flex flex-col p-0 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/30">
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center">
                <Bot size={16} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-display font-semibold text-foreground">Consultant Copilot</p>
                <p className="text-[11px] text-muted-foreground">
                  {selectedId ? "Com contexto do projeto" : "Modo livre"}
                </p>
              </div>
            </div>
            <AIChatPanel
              key={`${selectedId}-${activePrompt}`}
              mode="consultant-copilot"
              projectData={projectData}
              placeholder="Descreva o que precisa de ajuda..."
              initialMessage={activePrompt || undefined}
            />
          </DataCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <DataCard>
            <h3 className="font-display font-semibold text-foreground text-sm mb-3">Ações rápidas</h3>
            <div className="space-y-2">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => setActivePrompt(a.prompt)}
                  className="flex items-center gap-3 w-full p-3 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/60 hover:border-border transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <a.icon size={14} className="text-primary" />
                  </div>
                  <span className="text-sm text-foreground font-medium">{a.label}</span>
                </button>
              ))}
            </div>
          </DataCard>

          <DataCard>
            <h3 className="font-display font-semibold text-foreground text-sm mb-3">O que posso fazer</h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              {[
                "✍️ Gerar respostas para clientes",
                "📄 Criar documentos técnicos",
                "🔧 Resolver problemas de ERP",
                "📋 Resumir reuniões e gerar atas",
                "📊 Criar planos de ação",
                "💡 Sugerir soluções técnicas",
                "📝 Preparar materiais de treinamento",
                "🔍 Analisar logs e erros",
              ].map((item) => (
                <p key={item} className="p-2 rounded-lg bg-muted/40 border border-border/50">{item}</p>
              ))}
            </div>
          </DataCard>
        </div>
      </div>
    </div>
  );
};

export default ConsultorCopilot;
