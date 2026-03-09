import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FolderKanban, ArrowLeft, Clock, Users, Calendar, AlertTriangle,
  CheckCircle2, TrendingUp, Target, Lightbulb, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, DataCard, SectionTitle, StatusBadge, LoadingState } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";
import { calculateHealthScore, getScoreColor, suggestCronograma } from "@/lib/projectHealth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--success))",
  "hsl(var(--primary))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--destructive))",
];

const AdminProjetoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const [projeto, setProjeto] = useState<any>(null);
  const [fases, setFases] = useState<any[]>([]);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      const [projRes, fasesRes, propostasRes] = await Promise.all([
        supabase.from("projetos").select("*, softwares(nome)").eq("id", id).single(),
        supabase.from("projeto_fases").select("*").eq("projeto_id", id).order("ordem"),
        supabase.from("propostas").select("*").eq("projeto_id", id),
      ]);

      if (projRes.data) setProjeto(projRes.data);
      if (fasesRes.data) setFases(fasesRes.data);
      if (propostasRes.data) setPropostas(propostasRes.data);

      // Fetch historical recommendations based on software
      if (projRes.data?.software_id) {
        const { data: historicalModules } = await supabase
          .from("projeto_modulos")
          .select("modulos(nome)")
          .limit(50);

        if (historicalModules) {
          const moduleFreq = new Map<string, number>();
          historicalModules.forEach((pm: any) => {
            const name = pm.modulos?.nome;
            if (name) moduleFreq.set(name, (moduleFreq.get(name) || 0) + 1);
          });
          const topModules = Array.from(moduleFreq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name]) => name);

          const recs: string[] = [];
          if (topModules.length > 0) {
            recs.push(`Módulos frequentemente implementados juntos: ${topModules.join(", ")}`);
          }
          recs.push("Recomendação: Defina marcos de validação a cada 2 fases para reduzir retrabalho.");
          recs.push("Boas práticas: Documente decisões técnicas em cada fase para facilitar a manutenção.");

          // Check knowledge base for similar projects
          const { data: learnings } = await supabase
            .from("projeto_aprendizados")
            .select("recomendacoes, dificuldades")
            .eq("erp_utilizado", projRes.data.softwares?.nome || "")
            .limit(3);

          if (learnings && learnings.length > 0) {
            learnings.forEach((l: any) => {
              if (l.recomendacoes) recs.push(`💡 De projetos anteriores: ${l.recomendacoes}`);
            });
          }

          setRecommendations(recs);
        }
      }

      setLoading(false);
    };
    fetchAll();
  }, [id]);

  const health = useMemo(() => {
    if (!projeto) return null;
    return calculateHealthScore(fases, projeto.prazo_estimado, projeto.status);
  }, [projeto, fases]);

  const cronograma = useMemo(() => {
    if (fases.length === 0) return [];
    return suggestCronograma(fases);
  }, [fases]);

  // Chart data
  const horasChartData = useMemo(() => {
    return fases.map(f => ({
      nome: f.nome.length > 15 ? f.nome.slice(0, 15) + "..." : f.nome,
      estimadas: f.horas_estimadas || 0,
      executadas: f.horas_executadas || 0,
    }));
  }, [fases]);

  const statusChartData = useMemo(() => {
    const counts = new Map<string, number>();
    fases.forEach(f => counts.set(f.status, (counts.get(f.status) || 0) + 1));
    return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
  }, [fases]);

  if (loading) return <LoadingState />;
  if (!projeto) return <div className="p-8 text-center text-muted-foreground">Projeto não encontrado</div>;

  const sc = health ? getScoreColor(health.score) : null;

  return (
    <div>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/admin/projetos"><ArrowLeft size={14} /> Voltar aos projetos</Link>
        </Button>
      </div>

      <PageHeader
        title={projeto.nome}
        description={`${projeto.softwares?.nome || "Software"} · ${projeto.protocolo}`}
      />

      {/* Health Score + Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Health Score - prominent */}
        {health && sc && (
          <DataCard className="flex flex-col items-center justify-center py-6">
            <div className={`w-20 h-20 rounded-2xl ${sc.bg} flex items-center justify-center ring-4 ${sc.ring} mb-3`}>
              <span className={`font-display font-bold text-2xl ${sc.text}`}>{health.score}</span>
            </div>
            <p className={`text-sm font-semibold ${sc.text}`}>{health.label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Health Score</p>
          </DataCard>
        )}

        <div className="stat-card p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-primary" />
            <span className="text-xs text-muted-foreground">Progresso</span>
          </div>
          <p className="text-2xl font-display font-bold">{Math.round(health?.metrics.progressPercent || 0)}%</p>
          <p className="text-[11px] text-muted-foreground">{health?.metrics.completedFases || 0}/{health?.metrics.totalFases || 0} fases</p>
        </div>

        <div className="stat-card p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-info" />
            <span className="text-xs text-muted-foreground">Horas</span>
          </div>
          <p className="text-2xl font-display font-bold">
            {fases.reduce((s, f) => s + (f.horas_executadas || 0), 0)}h
          </p>
          <p className="text-[11px] text-muted-foreground">
            de {fases.reduce((s, f) => s + (f.horas_estimadas || 0), 0)}h estimadas
          </p>
        </div>

        <div className="stat-card p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className={health && health.metrics.overdueCount > 0 ? "text-destructive" : "text-success"} />
            <span className="text-xs text-muted-foreground">Fases atrasadas</span>
          </div>
          <p className="text-2xl font-display font-bold">{health?.metrics.overdueCount || 0}</p>
        </div>

        <div className="stat-card p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-accent" />
            <span className="text-xs text-muted-foreground">Propostas</span>
          </div>
          <p className="text-2xl font-display font-bold">{propostas.length}</p>
          <p className="text-[11px] text-muted-foreground">{propostas.filter(p => p.status === "aceita").length} aceitas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Hours comparison chart */}
        <DataCard>
          <SectionTitle>Horas: Estimadas vs Executadas</SectionTitle>
          {horasChartData.some(d => d.estimadas > 0 || d.executadas > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={horasChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 13 }} />
                <Bar dataKey="estimadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Estimadas" />
                <Bar dataKey="executadas" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Executadas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados de horas nas fases</p>
          )}
        </DataCard>

        {/* Phase status distribution */}
        <DataCard>
          <SectionTitle>Distribuição por status das fases</SectionTitle>
          {statusChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusChartData} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={100} label={({ status, count }) => `${status} (${count})`}>
                  {statusChartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem fases cadastradas</p>
          )}
        </DataCard>
      </div>

      {/* Risk alerts */}
      {health && health.risks.length > 0 && (
        <DataCard className="mb-6">
          <SectionTitle>⚠️ Riscos detectados</SectionTitle>
          <div className="space-y-3">
            {health.risks.map((r, i) => (
              <div key={i} className={`p-4 rounded-xl border ${
                r.severidade === "alta" ? "bg-destructive/5 border-destructive/15" :
                r.severidade === "media" ? "bg-warning/5 border-warning/15" : "bg-muted/40 border-border/60"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className={
                    r.severidade === "alta" ? "text-destructive" :
                    r.severidade === "media" ? "text-warning" : "text-muted-foreground"
                  } />
                  <span className="text-sm font-semibold text-foreground">{r.titulo}</span>
                  <Badge variant={r.severidade === "alta" ? "destructive" : "secondary"} className="text-[10px] ml-auto">
                    {r.severidade}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2 ml-[22px]">{r.descricao}</p>
                <div className="flex items-start gap-1.5 ml-[22px]">
                  <Lightbulb size={12} className="text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-primary font-medium">{r.recomendacao}</p>
                </div>
              </div>
            ))}
          </div>
        </DataCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Timeline / Phases */}
        <DataCard>
          <SectionTitle>Linha do tempo do projeto</SectionTitle>
          {fases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma fase cadastrada</p>
          ) : (
            <div className="space-y-0">
              {fases.sort((a, b) => a.ordem - b.ordem).map((f, i) => (
                <div key={f.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      f.status === "aprovada" ? "bg-success/10 text-success ring-2 ring-success/30" :
                      f.status === "em_andamento" ? "bg-primary/10 text-primary ring-2 ring-primary/30" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {f.status === "aprovada" ? <CheckCircle2 size={16} /> : i + 1}
                    </div>
                    {i < fases.length - 1 && (
                      <div className={`w-0.5 h-full min-h-[40px] ${
                        f.status === "aprovada" ? "bg-success/30" : "bg-border"
                      }`} />
                    )}
                  </div>
                  <div className="pb-6 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-foreground">{f.nome}</p>
                      <StatusBadge status={f.status} />
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                      {f.prazo && <span>Prazo: {new Date(f.prazo).toLocaleDateString("pt-BR")}</span>}
                      {f.horas_estimadas > 0 && <span>{f.horas_executadas || 0}/{f.horas_estimadas}h</span>}
                      {f.prazo && new Date(f.prazo) < new Date() && f.status !== "aprovada" && (
                        <span className="text-destructive font-semibold">⚠ Atrasada</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DataCard>

        {/* Recommendations + Suggested Cronograma */}
        <div className="space-y-6">
          {recommendations.length > 0 && (
            <DataCard>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-primary" />
                <SectionTitle>Recomendações inteligentes</SectionTitle>
              </div>
              <div className="space-y-2">
                {recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 bg-primary/5 border border-primary/10 rounded-xl p-3">
                    <Lightbulb size={14} className="text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-[13px] text-foreground">{r}</p>
                  </div>
                ))}
              </div>
            </DataCard>
          )}

          {cronograma.length > 0 && (
            <DataCard>
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={16} className="text-info" />
                <SectionTitle>Cronograma sugerido</SectionTitle>
              </div>
              <div className="space-y-2">
                {cronograma.map((c, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/40 rounded-xl p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.fase}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.inicio.toLocaleDateString("pt-BR")} → {c.fim.toLocaleDateString("pt-BR")} · {c.duracao_dias} dias úteis
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-info">{c.horas_sugeridas}h</span>
                  </div>
                ))}
              </div>
            </DataCard>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProjetoDetalhe;
