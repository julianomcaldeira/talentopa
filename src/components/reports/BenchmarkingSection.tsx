import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { TrendingUp, Clock, DollarSign, Star, Target, Users, BarChart3, Trophy } from "lucide-react";
import { motion } from "framer-motion";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  em_selecao: "Em Seleção",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr", "05": "Mai", "06": "Jun",
  "07": "Jul", "08": "Ago", "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

type UserScope = "admin" | "consultor" | "empresa";

interface PlatformMetrics {
  total_projetos: number;
  total_consultores: number;
  total_empresas: number;
  avg_valor_proposta: number;
  avg_nota: number;
  total_avaliacoes: number;
  taxa_aceitacao: number;
  avg_horas_projeto: number;
  avg_duracao_dias: number;
  valor_total_contratado: number;
  receita_plataforma: number;
}

export const BenchmarkingSection = ({ userScope }: { userScope: UserScope }) => {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [softwareData, setSoftwareData] = useState<{ name: string; count: number }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ mes: string; criados: number; concluidos: number }[]>([]);
  const [topConsultants, setTopConsultants] = useState<{ nome: string; total_projetos: number; nota_media: number; valor_total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [metricsRes, statusRes, softwareRes, monthlyRes, consultantsRes] = await Promise.all([
          supabase.rpc("get_platform_metrics"),
          supabase.rpc("get_projects_by_status"),
          supabase.rpc("get_projects_by_software"),
          supabase.rpc("get_monthly_project_stats"),
          supabase.rpc("get_top_consultants", { p_limit: 5 }),
        ]);

        if (metricsRes.data) setMetrics(metricsRes.data as unknown as PlatformMetrics);

        if (statusRes.data) {
          setStatusData((statusRes.data as any[]).map((r) => ({
            name: STATUS_LABELS[r.status] || r.status,
            value: Number(r.count),
          })));
        }

        if (softwareRes.data) {
          setSoftwareData((softwareRes.data as any[]).map((r) => ({
            name: r.software_nome,
            count: Number(r.count),
          })));
        }

        if (monthlyRes.data) {
          setMonthlyData((monthlyRes.data as any[]).map((r) => {
            const [, mm] = r.mes.split("-");
            return {
              mes: MONTH_LABELS[mm] || r.mes,
              criados: Number(r.criados),
              concluidos: Number(r.concluidos),
            };
          }));
        }

        if (consultantsRes.data) {
          setTopConsultants((consultantsRes.data as any[]).map((r) => ({
            nome: r.nome,
            total_projetos: Number(r.total_projetos),
            nota_media: Number(r.nota_media),
            valor_total: Number(r.valor_total),
          })));
        }
      } catch (err) {
        console.error("Benchmark error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!metrics) return null;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const kpiCards = [
    { icon: DollarSign, label: "Valor Médio das Propostas", value: `R$ ${fmt(metrics.avg_valor_proposta)}`, color: "text-emerald-500" },
    { icon: Clock, label: "Horas Médias por Projeto", value: `${metrics.avg_horas_projeto}h`, color: "text-blue-500" },
    { icon: Star, label: "Nota Média de Avaliação", value: String(metrics.avg_nota), color: "text-amber-500" },
    { icon: Target, label: "Taxa de Aceitação", value: `${metrics.taxa_aceitacao}%`, color: "text-violet-500" },
    { icon: Users, label: "Consultores na Plataforma", value: String(metrics.total_consultores), color: "text-primary" },
    { icon: TrendingUp, label: "Duração Média dos Projetos", value: `${metrics.avg_duracao_dias} dias`, color: "text-rose-500" },
  ];

  const maxSoftware = softwareData.length > 0 ? Math.max(...softwareData.map((s) => s.count)) : 1;

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 size={20} className="text-primary" />
            Benchmarking da Plataforma
            <Badge variant="outline" className="ml-2 text-xs">Dados agregados</Badge>
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
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
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

      {/* Admin-only financial KPIs */}
      {userScope === "admin" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <DollarSign className="text-emerald-500" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Contratado</p>
                <p className="text-xl font-bold text-foreground">R$ {fmt(metrics.valor_total_contratado)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <TrendingUp className="text-primary" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Plataforma (15%)</p>
                <p className="text-xl font-bold text-foreground">R$ {fmt(metrics.receita_plataforma)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly Trends Chart */}
      {monthlyData.length > 0 && (
        <Card className="border-border/50 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Tendência Mensal de Projetos (12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="criados" stroke="hsl(var(--primary))" name="Criados" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="concluidos" stroke="#10b981" name="Concluídos" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects by Status */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Distribuição de Projetos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}>
                    {statusData.map((_, i) => (
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

        {/* Top Softwares */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">ERPs Mais Utilizados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {softwareData.length > 0 ? (
              softwareData.map((sw, i) => (
                <div key={sw.name} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-8 text-muted-foreground">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{sw.name}</span>
                      <span className="text-xs text-muted-foreground">{sw.count} projetos</span>
                    </div>
                    <Progress value={(sw.count / maxSoftware) * 100} className="h-2" />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">Sem dados.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Top Consultants + General Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Consultants */}
        {topConsultants.length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" />
                Top Consultores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead className="text-center">Projetos</TableHead>
                    <TableHead className="text-center">Nota</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topConsultants.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell className="truncate max-w-[150px]">{c.nome}</TableCell>
                      <TableCell className="text-center">{c.total_projetos}</TableCell>
                      <TableCell className="text-center">
                        {c.nota_media > 0 ? (
                          <span className="flex items-center justify-center gap-1">
                            <Star size={12} className="text-amber-500" /> {c.nota_media}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">R$ {fmt(c.valor_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* General Indicators */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Indicadores Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <span className="text-sm">Total de Projetos</span>
              <Badge>{metrics.total_projetos}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <span className="text-sm">Consultores Ativos</span>
              <Badge variant="secondary">{metrics.total_consultores}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <span className="text-sm">Empresas Cadastradas</span>
              <Badge variant="secondary">{metrics.total_empresas}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <span className="text-sm">Taxa de Aceitação</span>
              <Badge variant={metrics.taxa_aceitacao > 30 ? "default" : "destructive"}>
                {metrics.taxa_aceitacao}%
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <span className="text-sm">Total de Avaliações</span>
              <Badge variant="secondary">{metrics.total_avaliacoes}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
