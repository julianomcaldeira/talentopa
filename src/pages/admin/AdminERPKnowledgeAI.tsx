import { PageHeader, DataCard } from "@/components/dashboard/DashboardComponents";
import AIChatPanel from "@/components/ai/AIChatPanel";
import { BookOpen, Cpu, Zap, Shield } from "lucide-react";

const topics = [
  { icon: Cpu, label: "SAP", desc: "FI, CO, MM, SD, PP, HR, ABAP" },
  { icon: Zap, label: "TOTVS", desc: "Protheus, Datasul, RM" },
  { icon: Shield, label: "Oracle", desc: "EBS, Cloud, Fusion" },
  { icon: BookOpen, label: "Dynamics", desc: "365, AX, NAV, GP" },
];

const quickQuestions = [
  "Como configurar centro de custo no SAP FI?",
  "Erro na OBYC ao integrar FI com MM",
  "Melhores práticas para Go-Live SAP",
  "Como fazer rollout internacional?",
  "Diferença entre implantação e rollout",
  "Configuração de impostos TOTVS Protheus",
];

const AdminERPKnowledgeAI = () => {
  return (
    <div>
      <PageHeader title="Base de Conhecimento ERP" description="Assistente técnico especializado em ERPs" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DataCard className="h-[600px] flex flex-col p-0 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/30">
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center">
                <BookOpen size={16} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-display font-semibold text-foreground">ERP Knowledge AI</p>
                <p className="text-[11px] text-muted-foreground">Especialista em SAP, TOTVS, Oracle, Dynamics</p>
              </div>
            </div>
            <AIChatPanel
              mode="erp-knowledge"
              placeholder="Faça sua pergunta técnica sobre ERP..."
            />
          </DataCard>
        </div>

        <div className="space-y-4">
          <DataCard>
            <h3 className="font-display font-semibold text-foreground text-sm mb-3">ERPs suportados</h3>
            <div className="space-y-2">
              {topics.map((t) => (
                <div key={t.label} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border border-border/40">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <t.icon size={14} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </DataCard>

          <DataCard>
            <h3 className="font-display font-semibold text-foreground text-sm mb-3">Perguntas frequentes</h3>
            <div className="space-y-2">
              {quickQuestions.map((q) => (
                <div key={q} className="text-xs text-muted-foreground p-2 rounded-lg bg-muted/40 border border-border/50 cursor-default">
                  🔍 {q}
                </div>
              ))}
            </div>
          </DataCard>
        </div>
      </div>
    </div>
  );
};

export default AdminERPKnowledgeAI;
