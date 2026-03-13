import { useEffect, useState } from "react";
import {
  Building2, Users, FolderKanban, DollarSign, TrendingUp, TrendingDown,
  AlertCircle, ArrowUpRight, Clock, Activity, Zap, Target,
  CheckCircle2, XCircle, Timer, BarChart3, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, PageHeader, DataCard, SectionTitle } from "@/components/dashboard/DashboardComponents";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

interface DashboardData {
  totalConsultores: number;
  totalEmpresas: number;
  totalProjetos: number;
  projetosAndamento: number;
  projetosConcluidos: number;
  projetosCancelados: number;
  projetosPublicados: number;
  totalPropostas: number;
  propostasAceitas: number;
  recentProjects: any[];
  alertas: any[];
  projetosPorStatus: { name: string; value: number; color: string }[];
  horasData: { fase: string; estimadas: number; executadas: number }[];
}

const statusColors: Record<string, string> = {
  rascunho: "hsl(225, 14%, 92%)",
  publicado: "hsl(228, 76%, 52%)",
  em_selecao: "hsl(38, 92%, 50%)",
  em_andamento: "hsl(210, 100%, 52%)",
  concluido: "hsl(152, 56%, 40%)",
  cancelado: "hsl(0, 72%, 51%)",
};

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  em_selecao: "Em seleção",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const monthlyTrend = [
  { month: "Out", projetos: 5, receita: 42 },
  { month: "Nov", projetos: 8, receita: 68 },
  { month: "Dez", projetos: 6, receita: 54 },
  { month: "Jan", projetos: 12, receita: 96 },
  { month: "Fev", projetos: 15, receita: 118 },
  { month: "Mar", projetos: 11, receita: 128 },
];

const AnimatedNumber = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <>{display}{suffix}</>;
};

const AdminDashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          { count: totalConsultores },
          { count: totalEmpresas },
          { data: projetos },
          { data: propostas },
          { data: recentProjects },
          { data: alertas },
          { data: fases },
        ] = await Promise.all([
          supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "consultor"),
          supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "empresa"),
          supabase.from("projetos").select("id, status"),
          supabase.from("propostas").select("id, status"),
          supabase.from("projetos").select("id, nome, status, created_at, empresa_user_id, protocolo, software_id, softwares(nome)").order("created_at", { ascending: false }).limit(5),
          supabase.from("projeto_alertas").select("*").eq("resolvido", false).order("created_at", { ascending: false }).limit(5),
          supabase.from("projeto_fases").select("nome, horas_estimadas, horas_executadas").limit(8),
        ]);

        const statusCounts: Record<string, number> = {};
        (projetos || []).forEach((p: any) => {
          statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
        });

        const projetosPorStatus = Object.entries(statusCounts).map(([status, count]) => ({
          name: statusLabels[status] || status,
          value: count,
          color: statusColors[status] || "hsl(225, 14%, 80%)",
        }));

        const horasData = (fases || []).slice(0, 6).map((f: any) => ({
          fase: f.nome?.substring(0, 18) || "Fase",
          estimadas: f.horas_estimadas || 0,
          executadas: f.horas_executadas || 0,
        }));

        setData({
          totalConsultores: totalConsultores || 0,
          totalEmpresas: totalEmpresas || 0,
          totalProjetos: (projetos || []).length,
          projetosAndamento: (projetos || []).filter((p: any) => p.status === "em_andamento").length,
          projetosConcluidos: (projetos || []).filter((p: any) => p.status === "concluido").length,
          projetosCancelados: (projetos || []).filter((p: any) => p.status === "cancelado").length,
          projetosPublicados: (projetos || []).filter((p: any) => p.status === "publicado").length,
          totalPropostas: (propostas || []).length,
          propostasAceitas: (propostas || []).filter((p: any) => p.status === "aceita").length,
          recentProjects: recentProjects || [],
          alertas: alertas || [],
          projetosPorStatus,
          horasData,
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const taxaConversao = data.totalPropostas > 0
    ? Math.round((data.propostasAceitas / data.totalPropostas) * 100)
    : 0;

  const stats = [
    {
      icon: Users,
      label: "Consultores",
      value: data.totalConsultores,
      description: "cadastrados na plataforma",
      gradient: "from-primary to-primary/70",
      bgGlow: "bg-primary/5",
    },
    {
      icon: Building2,
      label: "Empresas",
      value: data.totalEmpresas,
      description: "clientes ativos",
      gradient: "from-accent to-accent/70",
      bgGlow: "bg-accent/5",
    },
    {
      icon: FolderKanban,
      label: "Projetos",
      value: data.totalProjetos,
      description: `${data.projetosAndamento} em andamento`,
      gradient: "from-info to-info/70",
      bgGlow: "bg-info/5",
    },
    {
      icon: Target,
      label: "Taxa de conversão",
      value: taxaConversao,
      suffix: "%",
      description: `${data.propostasAceitas} de ${data.totalPropostas} propostas`,
      gradient: "from-success to-success/70",
      bgGlow: "bg-success/5",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium text-success">Sistema operacional</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
            Painel Administrativo
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Visão geral em tempo real da plataforma TalentOps
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 px-3 py-2 rounded-xl">
          <Clock size={14} />
          <span>Atualizado agora</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4, ease: "easeOut" }}
          >
            <div className={`relative bg-card rounded-2xl border border-border/60 p-5 overflow-hidden group hover:shadow-card-hover transition-shadow duration-300`}>
              {/* Background glow */}
              <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${stat.bgGlow} blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`} />

              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
                    <stat.icon size={20} className="text-primary-foreground" />
                  </div>
                  <div className="flex items-center gap-1 text-success text-xs font-medium">
                    <TrendingUp size={14} />
                    <span>Ativo</span>
                  </div>
                </div>
                <p className="text-3xl font-display font-bold text-foreground tracking-tight">
                  <AnimatedNumber value={stat.value} suffix={stat.suffix || ""} />
                </p>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area Chart - Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="lg:col-span-2"
        >
          <DataCard>
            <div className="flex items-center justify-between mb-6">
              <div>
                <SectionTitle>Evolução Mensal</SectionTitle>
                <p className="text-xs text-muted-foreground -mt-3">Projetos e receita estimada (R$ mil)</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Projetos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                  <span className="text-muted-foreground">Receita</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyTrend} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradProjetos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(228, 76%, 52%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(228, 76%, 52%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(168, 62%, 44%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(168, 62%, 44%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 14%, 90%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(224, 10%, 48%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(224, 10%, 48%)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(0, 0%, 100%)",
                    border: "1px solid hsl(225, 14%, 90%)",
                    borderRadius: "12px",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
                    fontSize: "13px",
                  }}
                />
                <Area type="monotone" dataKey="projetos" stroke="hsl(228, 76%, 52%)" strokeWidth={2.5} fill="url(#gradProjetos)" />
                <Area type="monotone" dataKey="receita" stroke="hsl(168, 62%, 44%)" strokeWidth={2.5} fill="url(#gradReceita)" />
              </AreaChart>
            </ResponsiveContainer>
          </DataCard>
        </motion.div>

        {/* Pie Chart - Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          <DataCard>
            <SectionTitle>Projetos por Status</SectionTitle>
            {data.projetosPorStatus.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={data.projetosPorStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {data.projetosPorStatus.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(0, 0%, 100%)",
                        border: "1px solid hsl(225, 14%, 90%)",
                        borderRadius: "12px",
                        fontSize: "13px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {data.projetosPorStatus.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                        <span className="text-muted-foreground text-xs">{item.name}</span>
                      </div>
                      <span className="font-semibold text-foreground text-xs">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 size={32} className="text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum projeto cadastrado</p>
              </div>
            )}
          </DataCard>
        </motion.div>
      </div>

      {/* Hours Chart + KPI Cards */}
      {data.horasData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <DataCard>
            <div className="flex items-center justify-between mb-6">
              <div>
                <SectionTitle>Horas: Estimadas vs Executadas</SectionTitle>
                <p className="text-xs text-muted-foreground -mt-3">Comparação por fase de projeto</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.horasData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 14%, 90%)" vertical={false} />
                <XAxis dataKey="fase" tick={{ fontSize: 11, fill: "hsl(224, 10%, 48%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(224, 10%, 48%)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(0, 0%, 100%)",
                    border: "1px solid hsl(225, 14%, 90%)",
                    borderRadius: "12px",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="estimadas" name="Estimadas" fill="hsl(228, 76%, 52%)" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar dataKey="executadas" name="Executadas" fill="hsl(168, 62%, 44%)" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </DataCard>
        </motion.div>
      )}

      {/* Bottom Row: Projects + Alerts + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="lg:col-span-2"
        >
          <DataCard noPadding>
            <div className="p-5 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-primary" />
                  <SectionTitle>Projetos Recentes</SectionTitle>
                </div>
                <a href="/admin/projetos" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                  Ver todos <ArrowUpRight size={12} />
                </a>
              </div>
            </div>
            {data.recentProjects.length > 0 ? (
              <div className="divide-y divide-border/40">
                {data.recentProjects.map((project: any) => (
                  <a
                    key={project.id}
                    href={`/admin/projetos/${project.id}`}
                    className="flex items-center justify-between p-4 px-5 hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <FolderKanban size={16} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {project.nome}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {project.protocolo || "Sem protocolo"} • {project.softwares?.nome || "—"}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={project.status} />
                  </a>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <FolderKanban size={32} className="text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum projeto ainda</p>
              </div>
            )}
          </DataCard>
        </motion.div>

        {/* Right Column: Alerts + Quick Stats */}
        <div className="space-y-6">
          {/* Alerts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <DataCard>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={16} className="text-warning" />
                <SectionTitle>Alertas Ativos</SectionTitle>
              </div>
              {data.alertas.length > 0 ? (
                <div className="space-y-2.5">
                  {data.alertas.map((alerta: any) => (
                    <div
                      key={alerta.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                        alerta.severidade === "alta" || alerta.severidade === "critica"
                          ? "bg-destructive/5 border-destructive/15"
                          : "bg-warning/5 border-warning/15"
                      }`}
                    >
                      {alerta.severidade === "alta" || alerta.severidade === "critica" ? (
                        <XCircle size={15} className="text-destructive flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle size={15} className="text-warning flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground leading-snug">{alerta.titulo}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{alerta.descricao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 size={28} className="text-success/50 mb-2" />
                  <p className="text-xs text-muted-foreground">Tudo certo! Sem alertas.</p>
                </div>
              )}
            </DataCard>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.4 }}
          >
            <DataCard>
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} className="text-accent" />
                <SectionTitle>Indicadores Rápidos</SectionTitle>
              </div>
              <div className="space-y-4">
                {[
                  {
                    label: "Projetos Concluídos",
                    value: data.projetosConcluidos,
                    total: data.totalProjetos,
                    color: "bg-success",
                    icon: CheckCircle2,
                  },
                  {
                    label: "Em Andamento",
                    value: data.projetosAndamento,
                    total: data.totalProjetos,
                    color: "bg-info",
                    icon: Timer,
                  },
                  {
                    label: "Propostas Aceitas",
                    value: data.propostasAceitas,
                    total: data.totalPropostas,
                    color: "bg-primary",
                    icon: Sparkles,
                  },
                ].map((item, i) => {
                  const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <item.icon size={14} className="text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{item.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground">{item.value}/{item.total}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${item.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, delay: 0.8 + i * 0.15, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </DataCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
