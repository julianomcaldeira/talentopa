import { useState, useEffect, useMemo } from "react";
import {
  BarChart3, TrendingUp, Clock, FolderKanban, Server, Puzzle, AlertTriangle,
  ArrowUpRight, Target, Zap, Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, DataCard, SectionTitle, StatCard, LoadingState, StatusBadge } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";
import { calculateHealthScore, getScoreColor } from "@/lib/projectHealth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--info))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
];

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

const AdminInteligencia = () => {
  const [projetos, setProjetos] = useState<any[]>([]);
  const [fases, setFases] = useState<any[]>([]);
  const [softwares, setSoftwares] = useState<any[]>([]);
  const [modulos, setModulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const [projRes, fasesRes, swRes, modRes] = await Promise.all([
        supabase.from("projetos").select("*, softwares(nome)").order("created_at", { ascending: false }),
        supabase.from("projeto_fases").select("*"),
        supabase.from("softwares").select("*"),
        supabase.from("projeto_modulos").select("*, modulos(nome)"),
      ]);
      if (projRes.data) setProjetos(projRes.data);
      if (fasesRes.data) setFases(fasesRes.data);
      if (swRes.data) setSoftwares(swRes.data);
      if (modRes.data) setModulos(modRes.data);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // Compute analytics
  const analytics = useMemo(() => {
    if (projetos.length === 0) return null;

    // Health scores for all projects
    const projectScores = projetos
      .filter(p => !["rascunho", "cancelado"].includes(p.status))
      .map(p => {
        const projectFases = fases.filter(f => f.projeto_id === p.id);
        const health = calculateHealthScore(projectFases, p.prazo_estimado, p.status);
        return { ...p, health, fases: projectFases };
      });

    // Average hours per module
    const moduloHours = new Map<string, { total: number; count: number }>();
    modulos.forEach(pm => {
      const projectFases = fases.filter(f => f.projeto_id === pm.projeto_id);
      const avgHoras = projectFases.reduce((s, f) => s + (f.horas_estimadas || 0), 0);
      const name = pm.modulos?.nome || "Desconhecido";
      const existing = moduloHours.get(name) || { total: 0, count: 0 };
      moduloHours.set(name, { total: existing.total + avgHoras, count: existing.count + 1 });
    });

    const horasPorModulo = Array.from(moduloHours.entries())
      .map(([nome, { total, count }]) => ({ nome, media: Math.round(total / count), projetos: count }))
      .sort((a, b) => b.media - a.media)
      .slice(0, 10);

    // Projects by ERP
    const projetosPorErp = new Map<string, number>();
    projetos.forEach(p => {
      const erp = p.softwares?.nome || "Não definido";
      projetosPorErp.set(erp, (projetosPorErp.get(erp) || 0) + 1);
    });
    const erpData = Array.from(projetosPorErp.entries())
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count);

    // Status distribution
    const statusDist = new Map<string, number>();
    projetos.forEach(p => {
      statusDist.set(p.status, (statusDist.get(p.status) || 0) + 1);
    });

    // At risk projects
    const atRisk = projectScores.filter(p => p.health.score < 60).sort((a, b) => a.health.score - b.health.score);

    // Average completion time (in days) for completed projects
    const completed = projetos.filter(p => p.status === "concluido");
    let avgCompletionDays = 0;
    if (completed.length > 0) {
      const totalDays = completed.reduce((s, p) => {
        const created = new Date(p.created_at);
        const updated = new Date(p.updated_at);
        return s + Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      avgCompletionDays = Math.round(totalDays / completed.length);
    }

    // Total hours
    const totalHorasEstimadas = fases.reduce((s, f) => s + (f.horas_estimadas || 0), 0);
    const totalHorasExecutadas = fases.reduce((s, f) => s + (f.horas_executadas || 0), 0);

    // Monthly project creation trend
    const monthlyTrend = new Map<string, number>();
    projetos.forEach(p => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyTrend.set(key, (monthlyTrend.get(key) || 0) + 1);
    });
    const trendData = Array.from(monthlyTrend.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([mes, count]) => ({ mes: mes.split("-")[1] + "/" + mes.split("-")[0].slice(2), projetos: count }));

    // Overdue rate
    const totalActive = projetos.filter(p => ["em_andamento", "em_selecao", "publicado"].includes(p.status)).length;
    const overdueRate = totalActive > 0
      ? Math.round((atRisk.length / totalActive) * 100)
      : 0;

    return {
      projectScores,
      horasPorModulo,
      erpData,
      statusDist,
      atRisk,
      avgCompletionDays,
      totalHorasEstimadas,
      totalHorasExecutadas,
      trendData,
      overdueRate,
    };
  }, [projetos, fases, modulos]);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Inteligência de Projetos"
        description="Análises, benchmarks e insights da plataforma"
      />

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FolderKanban} label="Total de projetos" value={projetos.length.toString()} iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon={Clock} label="Tempo médio conclusão" value={analytics ? `${analytics.avgCompletionDays}d` : "—"} iconColor="text-info" iconBg="bg-info/10" />
        <StatCard icon={AlertTriangle} label="Projetos em risco" value={analytics?.atRisk.length.toString() || "0"} iconColor="text-destructive" iconBg="bg-destructive/10" />
        <StatCard icon={Target} label="Taxa de atraso" value={`${analytics?.overdueRate || 0}%`} iconColor="text-warning" iconBg="bg-warning/10" />
      </div>

      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Trend chart */}
          <DataCard>
            <SectionTitle>Evolução de projetos criados</SectionTitle>
            {analytics.trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={analytics.trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 13 }}
                  />
                  <Line type="monotone" dataKey="projetos" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Dados insuficientes</p>
            )}
          </DataCard>

          {/* ERP distribution */}
          <DataCard>
            <SectionTitle>Projetos por ERP</SectionTitle>
            {analytics.erpData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={analytics.erpData}
                    dataKey="count"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ nome, count }) => `${nome} (${count})`}
                    labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                  >
                    {analytics.erpData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Dados insuficientes</p>
            )}
          </DataCard>

          {/* Hours per module (benchmark) */}
          <DataCard>
            <SectionTitle>Horas médias por módulo (Benchmark)</SectionTitle>
            {analytics.horasPorModulo.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.horasPorModulo} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="nome" type="category" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 13 }} />
                  <Bar dataKey="media" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} name="Horas médias" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum módulo com dados de horas</p>
            )}
          </DataCard>

          {/* Hours comparison */}
          <DataCard>
            <SectionTitle>Horas: Estimadas vs Executadas</SectionTitle>
            <div className="flex items-center justify-center gap-12 py-8">
              <div className="text-center">
                <p className="text-3xl font-display font-bold text-foreground">{analytics.totalHorasEstimadas}h</p>
                <p className="text-xs text-muted-foreground mt-1">Estimadas</p>
              </div>
              <div className="w-px h-16 bg-border" />
              <div className="text-center">
                <p className="text-3xl font-display font-bold text-foreground">{analytics.totalHorasExecutadas}h</p>
                <p className="text-xs text-muted-foreground mt-1">Executadas</p>
              </div>
              <div className="w-px h-16 bg-border" />
              <div className="text-center">
                <p className={`text-3xl font-display font-bold ${
                  analytics.totalHorasEstimadas > 0 && analytics.totalHorasExecutadas > analytics.totalHorasEstimadas * 1.1
                    ? "text-destructive" : "text-success"
                }`}>
                  {analytics.totalHorasEstimadas > 0
                    ? Math.round((analytics.totalHorasExecutadas / analytics.totalHorasEstimadas) * 100) + "%"
                    : "—"
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-1">Utilização</p>
              </div>
            </div>
          </DataCard>
        </div>
      )}

      {/* At risk projects */}
      {analytics && analytics.atRisk.length > 0 && (
        <DataCard noPadding className="mb-6">
          <div className="p-5 pb-3 border-b border-border/60">
            <SectionTitle>⚠️ Projetos em risco</SectionTitle>
          </div>
          <div className="divide-y divide-border/60">
            {analytics.atRisk.map((p) => {
              const sc = getScoreColor(p.health.score);
              return (
                <div key={p.id} className="p-4 px-5 table-row-interactive">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl ${sc.bg} flex items-center justify-center ring-2 ${sc.ring}`}>
                        <span className={`font-display font-bold text-sm ${sc.text}`}>{p.health.score}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{p.softwares?.nome} · {p.protocolo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-[11px]">{p.health.label}</Badge>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                  {p.health.risks.length > 0 && (
                    <div className="ml-[54px] mt-2 space-y-1">
                      {p.health.risks.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <AlertTriangle size={12} className={
                            r.severidade === "alta" ? "text-destructive mt-0.5" :
                            r.severidade === "media" ? "text-warning mt-0.5" : "text-muted-foreground mt-0.5"
                          } />
                          <div>
                            <span className="font-medium text-foreground">{r.titulo}</span>
                            <span className="text-muted-foreground"> — {r.recomendacao}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DataCard>
      )}

      {/* Benchmark summary */}
      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DataCard>
            <div className="flex items-center gap-3 mb-3">
              <div className="icon-container icon-container-md bg-primary/10"><Zap className="h-5 w-5 text-primary" /></div>
              <SectionTitle>Benchmark: Tempo médio</SectionTitle>
            </div>
            <p className="text-3xl font-display font-bold text-foreground">{analytics.avgCompletionDays} dias</p>
            <p className="text-xs text-muted-foreground mt-1">Média de conclusão de projetos</p>
          </DataCard>
          <DataCard>
            <div className="flex items-center gap-3 mb-3">
              <div className="icon-container icon-container-md bg-info/10"><BarChart3 className="h-5 w-5 text-info" /></div>
              <SectionTitle>Benchmark: Horas/projeto</SectionTitle>
            </div>
            <p className="text-3xl font-display font-bold text-foreground">
              {projetos.length > 0 ? Math.round(analytics.totalHorasEstimadas / projetos.length) : 0}h
            </p>
            <p className="text-xs text-muted-foreground mt-1">Média de horas estimadas por projeto</p>
          </DataCard>
          <DataCard>
            <div className="flex items-center gap-3 mb-3">
              <div className="icon-container icon-container-md bg-warning/10"><Calendar className="h-5 w-5 text-warning" /></div>
              <SectionTitle>Benchmark: Taxa de atraso</SectionTitle>
            </div>
            <p className="text-3xl font-display font-bold text-foreground">{analytics.overdueRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">Projetos ativos com score {'<'} 60</p>
          </DataCard>
        </div>
      )}
    </div>
  );
};

export default AdminInteligencia;
