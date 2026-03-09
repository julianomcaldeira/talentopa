import { useState } from "react";
import { PageHeader, DataCard } from "@/components/dashboard/DashboardComponents";
import AIChatPanel from "@/components/ai/AIChatPanel";
import { Sparkles, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const EmpresaProjectScopeAI = () => {
  const [scopeGenerated, setScopeGenerated] = useState(false);
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Diagnóstico Inteligente"
        description="Nossa IA vai te guiar para definir o escopo ideal do seu projeto"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat */}
        <div className="lg:col-span-2">
          <DataCard className="h-[600px] flex flex-col p-0 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/30">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-display font-semibold text-foreground">Project Scope AI</p>
                <p className="text-[11px] text-muted-foreground">Assistente de definição de escopo</p>
              </div>
            </div>
            <AIChatPanel
              mode="project-scope"
              placeholder="Descreva brevemente o projeto que você precisa..."
              initialMessage="Olá! Quero ajuda para definir o escopo de um projeto de consultoria ERP."
              onScopeGenerated={() => setScopeGenerated(true)}
            />
          </DataCard>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          <DataCard>
            <h3 className="font-display font-semibold text-foreground text-sm mb-3">Como funciona</h3>
            <div className="space-y-3">
              {[
                { step: "1", text: "Descreva seu projeto ou problema" },
                { step: "2", text: "A IA faz perguntas guiadas" },
                { step: "3", text: "Receba um escopo estruturado" },
                { step: "4", text: "Use o escopo para criar seu projeto" },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                    {item.step}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </DataCard>

          <DataCard>
            <h3 className="font-display font-semibold text-foreground text-sm mb-3">O que a IA gera</h3>
            <div className="space-y-2">
              {["Escopo estruturado", "Etapas do projeto", "Estimativa de horas", "Perfil de consultor", "Análise de complexidade", "Riscos identificados"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText size={12} className="text-primary flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </DataCard>

          {scopeGenerated && (
            <Button className="w-full" onClick={() => navigate("/empresa/novo-projeto")}>
              Criar Projeto com Escopo <ArrowRight size={14} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmpresaProjectScopeAI;
