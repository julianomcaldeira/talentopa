import { useEffect, useMemo, useState } from "react";
import { Bot, Save, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, DataCard, LoadingState } from "@/components/dashboard/DashboardComponents";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_AI_CONTEXT = `CONTEXTO MESTRE DA IA WORKZ

A Workz é uma plataforma SaaS B2B que conecta empresas que usam ERPs a consultores especializados. A plataforma apoia a criação, publicação, análise, matching, contratação, gestão e acompanhamento de projetos ERP.

Papéis principais:
- Admin: administra a plataforma, catálogo ERP, consultores, empresas, projetos, métricas, relatórios, auditoria, moderação, score e configurações.
- Empresa: cria projetos ERP, define escopo, prazo para propostas, avalia consultores, analisa propostas e acompanha a execução.
- Consultor: cadastra habilidades, encontra projetos, envia propostas, executa projetos, registra entregas, horas, reuniões e usa copiloto técnico.

Domínio permitido da IA:
- Projetos ERP, implantação, rollout, migração, integração, suporte e melhoria.
- ERPs como SAP, TOTVS, Oracle, Microsoft Dynamics e módulos/funcionalidades relacionados.
- Escopo, requisitos, riscos, cronograma, estimativa de horas, senioridade, fases e entregáveis.
- Matching entre projeto e consultor, propostas, contratação, seleção e performance.
- Gestão de projetos, comunicação, reuniões, atas, horas, entregáveis, alertas e saúde do projeto.
- Relatórios, benchmarking, métricas operacionais, score, portfólio e inteligência da plataforma.
- Uso, regras de negócio e operação da Workz.

Regra de ouro:
A IA deve responder somente assuntos relacionados ao core da Workz e ao contexto acima. Se o usuário pedir algo fora do escopo, a IA deve recusar de forma educada, curta e profissional, sem tentar responder o conteúdo externo.

Resposta padrão para temas fora do escopo:
"Não consigo responder sobre esse tema. Meu foco é apoiar usuários dentro da plataforma Workz, em assuntos relacionados a projetos ERP, consultores, empresas, propostas, matching, gestão, relatórios e operação da plataforma."

Estilo de resposta:
- Responder sempre em português brasileiro.
- Ser profissional, objetivo e acionável.
- Não inventar dados inexistentes.
- Quando faltar contexto, fazer perguntas objetivas.
- Priorizar recomendações aplicáveis ao ambiente ERP e à operação da Workz.
- Não orientar ações fora da plataforma quando isso não tiver relação com o core do sistema.`;

const AdminAIContext = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contexto, setContexto] = useState(DEFAULT_AI_CONTEXT);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadContext = async () => {
      const db = supabase as any;
      const { data, error } = await db
        .from("ai_context_config")
        .select("contexto, updated_at")
        .eq("id", "singleton")
        .maybeSingle();

      if (error) {
        toast({ title: "Erro", description: "Não foi possível carregar o contexto da IA.", variant: "destructive" });
      } else if (data?.contexto) {
        setContexto(data.contexto);
        setUpdatedAt(data.updated_at);
      }
      setLoading(false);
    };

    loadContext();
  }, [toast]);

  const stats = useMemo(() => {
    const chars = contexto.trim().length;
    const lines = contexto.split("\n").filter(line => line.trim()).length;
    return { chars, lines };
  }, [contexto]);

  const saveContext = async () => {
    if (contexto.trim().length < 200) {
      toast({ title: "Contexto muito curto", description: "Inclua regras, domínio permitido e comportamento esperado da IA.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const db = supabase as any;
    const { error } = await db
      .from("ai_context_config")
      .upsert({ id: "singleton", contexto: contexto.trim(), ativo: true, atualizado_por: user?.id ?? null }, { onConflict: "id" });

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: "Verifique se seu usuário tem permissão de administrador.", variant: "destructive" });
      return;
    }

    setUpdatedAt(new Date().toISOString());
    toast({ title: "Contexto salvo", description: "As próximas respostas da IA já usarão este contexto mestre." });
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Contexto Mestre da IA"
        description="Defina as regras centrais que todos os assistentes inteligentes devem seguir"
        action={<Button onClick={saveContext} disabled={saving}><Save size={16} /> {saving ? "Salvando..." : "Salvar contexto"}</Button>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <DataCard className="xl:col-span-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot size={20} className="text-primary" />
            </div>
            <div>
              <Label htmlFor="ai-context" className="text-base font-display font-semibold">Base de comportamento da IA</Label>
              <p className="text-sm text-muted-foreground">Este texto é consultado antes de cada resposta gerada pela IA.</p>
            </div>
          </div>
          <Textarea
            id="ai-context"
            value={contexto}
            onChange={(event) => setContexto(event.target.value)}
            className="min-h-[560px] resize-y font-mono text-sm leading-relaxed"
          />
        </DataCard>

        <div className="space-y-4">
          <DataCard>
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck size={18} className="text-success" />
              <h3 className="font-display font-semibold text-foreground text-sm">Governança</h3>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Somente administradores podem editar este conteúdo.</p>
              <p>A IA deve recusar perguntas fora do core da Workz.</p>
              <p>Alterações passam a valer nas próximas chamadas de IA.</p>
            </div>
          </DataCard>

          <DataCard>
            <h3 className="font-display font-semibold text-foreground text-sm mb-3">Resumo</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Caracteres</span><span className="font-semibold text-foreground">{stats.chars}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Linhas úteis</span><span className="font-semibold text-foreground">{stats.lines}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Última edição</span><span className="font-semibold text-foreground text-right">{updatedAt ? new Date(updatedAt).toLocaleString("pt-BR") : "—"}</span></div>
            </div>
          </DataCard>
        </div>
      </div>
    </div>
  );
};

export default AdminAIContext;