import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Clock, DollarSign, Star, Target, Users, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

interface BenchmarkData {
  avgProposalValue: number;
  avgHoursPerProject: number;
  avgRating: number;
  proposalAcceptRate: number;
  projectsByStatus: { name: string; value: number }[];
  avgHoursByModule: { name: string; horas: number }[];
  totalConsultors: number;
  totalEmpresas: number;
  totalProjetos: number;
  avgProjectDuration: number;
  topSoftwares: { name: string; count: number }[];
}

type UserScope = "admin" | "consultor" | "empresa";

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  em_selecao: "Em Seleção",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const BenchmarkingSection = ({ userScope }: { userScope: UserScope }) => {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBenchmarkData();
  }, []);

  const fetchBenchmarkData = async () => {
    try {
      const [
        { data: propostas },
        { data: projetos },
        { data: avaliacoes },
        { data: fases },
        { data: consultorRoles },
        { data: empresaRoles },
        { data: softwareData },
      ] = await Promise.all([
        supabase.from("propostas").select("valor_proposta, estimativa_horas, status"),
        supabase.from("projetos").select("id, status, software_id, created_at, prazo_estimado"),
        supabase.from("avaliacoes").select("nota"),
        supabase.from("projeto_fases").select("horas_estimadas, horas_executadas, nome"),
        supabase.from("user_roles").select("id").eq("role", "consultor"),
        supabase.from("user_roles").select("id").eq("role", "empresa"),
        supabase.from("softwares").select("id, nome"),
      ]);

      const propostasArr = propostas || [];
      const projetosArr = projetos || [];
      const avaliacoesArr = avaliacoes || [];
      const fasesArr = fases || [];

      // Avg proposal value
      const propostasWithValue = propostasArr.filter((p) => p.valor_proposta);
      const avgProposalValue =
        propostasWithValue.length > 0
          ? propostasWithValue.reduce((s, p) => s + (p.valor_proposta || 0), 0) / propostasWithValue.length
          : 0;

      // Avg hours
      const propostasWithHours = propostasArr.filter((p) => p.estimativa_horas);
      const avgHoursPerProject =
        propostasWithHours.length > 0
          ? propostasWithHours.reduce((s, p) => s + (p.estimativa_horas || 0), 0) / propostasWithHours.length
          : 0;

      // Avg rating
      const avgRating =
        avaliacoesArr.length > 0
          ? avaliacoesArr.reduce((s, a) => s + a.nota, 0) / avaliacoesArr.length
          : 0;

      // Acceptance rate
      const totalPropostas = propostasArr.length;
      const aceitas = propostasArr.filter((p) => p.status === "aceita").length;
      const proposalAcceptRate = totalPropostas > 0 ? (aceitas / totalPropostas) * 100 : 0;

      // Projects by status
      const statusCount: Record<string, number> = {};
      projetosArr.forEach((p) => {
        statusCount[p.status] = (statusCount[p.status] || 0) + 1;
      });
      const projectsByStatus = Object.entries(statusCount).map(([k, v]) => ({
        name: STATUS_LABELS[k] || k,
        value: v,
      }));

      // Avg hours by phase name
      const phaseHours: Record<string, { total: number; count: number }> = {};
      fasesArr.forEach((f) => {
        if (!phaseHours[f.nome]) phaseHours[f.nome] = { total: 0, count: 0 };
        phaseHours[f.nome].total += Number(f.horas_estimadas) || 0;
        phaseHours[f.nome].count += 1;
      });
      const avgHoursByModule = Object.entries(phaseHours)
        .map(([name, v]) => ({ name, horas: Math.round(v.total / v.count) }))
        .sort((a, b) => b.horas - a.horas)
        .slice(0, 8);

      // Avg project duration
      const projectsWithDates = projetosArr.filter((p) => p.prazo_estimado);
      const avgProjectDuration =
        projectsWithDates.length > 0
          ? projectsWithDates.reduce((s, p) => {
              const created = new Date(p.created_at);
              const deadline = new Date(p.prazo_estimado!);
              return s + Math.max(0, Math.ceil((deadline.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
            }, 0) / projectsWithDates.length
          : 0;

      // Top softwares
      const softwareCount: Record<string, number> = {};
      const softwareMap: Record<string, string> = {};
      (softwareData || []).forEach((s) => (softwareMap[s.id] = s.nome));
      projetosArr.forEach((p) => {
        if (p.software_id && softwareMap[p.software_id]) {
          const name = softwareMap[p.software_id];
          softwareCount[name] = (softwareCount[name] || 0) + 1;
        }
      });
      const topSoftwares = Object.entries(softwareCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setData({
        avgProposalValue,
        avgHoursPerProject,
        avgRating,
        proposalAcceptRate,
        projectsByStatus,
        avgHoursByModule,
        totalConsultors: consultorRoles?.length || 0,
        totalEmpresas: empresaRoles?.length || 0,
        totalProjetos: projetosArr.length,
        avgProjectDuration: Math.round(avgProjectDuration),
        topSoftwares,
      });
    } catch (err) {
      console.error("Benchmark error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const kpiCards = [
    {
      icon: DollarSign,
      label: "Valor Médio das Propostas",
      value: `R$ ${data.avgProposalValue.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      color: "text-emerald-500",
    },
    {
      icon: Clock,
      label: "Horas Médias por Projeto",
      value: `${data.avgHoursPerProject.toFixed(0)}h`,
      color: "text-blue-500",
    },
    {
      icon: Star,
      label: "Nota Média de Avaliação",
      value: data.avgRating.toFixed(1),
      color: "text-amber-500",
    },
    {
      icon: Target,
      label: "Taxa de Aceitação de Propostas",
      value: `${data.proposalAcceptRate.toFixed(1)}%`,
      color: "text-violet-500",
    },
    {
      icon: Users,
      label: "Consultores na Plataforma",
      value: String(data.totalConsultors),
      color: "text-primary",
    },
    {
      icon: TrendingUp,
      label: "Duração Média dos Projetos",
      value: `${data.avgProjectDuration} dias`,
      color: "text-rose-500",
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 size={20} className="text-primary" />
            Benchmarking da Plataforma
            <Badge variant="outline" className="ml-2 text-xs">
              Dados agregados
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Métricas consolidadas de toda a plataforma para comparação e referência.
            {userScope === "consultor" && " Compare seu desempenho com a média do mercado."}
            {userScope === "empresa" && " Compare seus projetos com a média do mercado."}
          </p>
        </CardHeader>
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-border/50 bg-card/80 hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <kpi.icon size={20} className={`mx-auto mb-2 ${kpi.color}`} />
                <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{kpi.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects by Status */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Distribuição de Projetos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {data.projectsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={data.projectsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {data.projectsByStatus.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados.</p>
            )}
          </CardContent>
        </Card>

        {/* Avg Hours by Phase */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Horas Médias por Fase</CardTitle>
          </CardHeader>
          <CardContent>
            {data.avgHoursByModule.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.avgHoursByModule} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados de fases.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Softwares + Acceptance Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">ERPs Mais Utilizados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topSoftwares.length > 0 ? (
              data.topSoftwares.map((sw, i) => (
                <div key={sw.name} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-8 text-muted-foreground">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{sw.name}</span>
                      <span className="text-xs text-muted-foreground">{sw.count} projetos</span>
                    </div>
                    <Progress
                      value={(sw.count / Math.max(...data.topSoftwares.map((s) => s.count))) * 100}
                      className="h-2"
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">Sem dados.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Indicadores Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <span className="text-sm">Total de Projetos</span>
              <Badge>{data.totalProjetos}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <span className="text-sm">Consultores Ativos</span>
              <Badge variant="secondary">{data.totalConsultors}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <span className="text-sm">Empresas Cadastradas</span>
              <Badge variant="secondary">{data.totalEmpresas}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <span className="text-sm">Taxa de Aceitação</span>
              <Badge variant={data.proposalAcceptRate > 30 ? "default" : "destructive"}>
                {data.proposalAcceptRate.toFixed(1)}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
