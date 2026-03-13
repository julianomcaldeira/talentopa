import { useEffect, useState } from "react";
import {
  Building2, Users, FolderKanban, DollarSign, TrendingUp,
  AlertCircle, ArrowUpRight, Clock, Zap, Target,
  CheckCircle2, XCircle, Timer, BarChart3, Sparkles, Shield, Send
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, SectionTitle, DataCard } from "@/components/dashboard/DashboardComponents";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
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
  rascunho: "hsl(225, 14%, 80%)",
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

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const }
  }),
};

const AdminDashboard = () => {
  const { profile } = useAuth();
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
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const taxaConversao = data.totalPropostas > 0
    ? Math.round((data.propostasAceitas / data.totalPropostas) * 100) : 0;

  const stats = [
    { icon: Users, label: "Consultores", value: data.totalConsultores.toString(), color: "text-primary", bg: "bg-primary/10", trend: "cadastrados" },
    { icon: Building2, label: "Empresas", value: data.totalEmpresas.toString(), color: "text-accent", bg: "bg-accent/10", trend: "clientes" },
    { icon: FolderKanban, label: "Projetos", value: data.totalProjetos.toString(), color: "text-info", bg: "bg-info/10", trend: `${data.projetosAndamento} em andamento` },
    { icon: Target, label: "Conversão", value: `${taxaConversao}%`, color: "text-success", bg: "bg-success/10", trend: `${data.propostasAceitas}/${data.totalPropostas} propostas` },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 via-primary to-accent/80 p-6 md:p-8 text-primary-foreground"
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-primary-foreground/20 blur-3xl" />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-accent/30 blur-2xl" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-primary-foreground/70 text-sm font-medium mb-1">{greeting()}</p>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">
              {profile?.nome?.split(" ")[0] || "Administrador"}
            </h1>
            <p className="text-primary-foreground/80 mt-1 text-sm max-w-lg">
              <span className="font-semibold text-primary-foreground">{data.totalProjetos} projetos</span> cadastrados, <span className="font-semibold text-primary-foreground">{data.projetosAndamento} em andamento</span> e <span className="font-semibold text-primary-foreground">{data.alertas.length} alertas</span> ativos.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="secondary" size="sm" className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0 backdrop-blur-sm">
              <Link to="/admin/projetos">
                <FolderKanban size={14} className="mr-1.5" /> Projetos
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0 backdrop-blur-sm">
              <Link to="/admin/consultores">
                <Users size={14} className="mr-1.5" /> Consultores
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="relative bg-card rounded-2xl border border-border/60 p-5 shadow-card hover:shadow-card-hover transition-shadow group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`icon-container icon-container-md ${stat.bg} rounded-xl`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <span className="text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <TrendingUp size={10} /> Ativo
              </span>
            </div>
            <p className="text-2xl font-display font-bold text-foreground tracking-tight">{stat.value}</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">{stat.label}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{stat.trend}</p>
          </motion.div>
        ))}
      </div>

      {/* Performance Summary - 3 col KPI row */}
      <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={16} className="text-success" />
            <p className="text-sm font-semibold text-foreground">Projetos concluídos</p>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-display font-bold text-foreground">
              {data.totalProjetos > 0 ? Math.round((data.projetosConcluidos / data.totalProjetos) * 100) : 0}%
            </span>
          </div>
          <Progress value={data.totalProjetos > 0 ? (data.projetosConcluidos / data.totalProjetos) * 100 : 0} className="mt-3 h-2" />
          <p className="text-xs text-muted-foreground mt-2">{data.projetosConcluidos} de {data.totalProjetos} projetos</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Send size={16} className="text-info" />
            <p className="text-sm font-semibold text-foreground">Propostas aceitas</p>
          </div>
          <span className="text-3xl font-display font-bold text-foreground">{data.propostasAceitas}</span>
          <div className="flex gap-2 mt-2">
            <span className="text-[11px] badge-success px-2 py-0.5 rounded-full font-medium">{data.propostasAceitas} aceitas</span>
            <span className="text-[11px] badge-info px-2 py-0.5 rounded-full font-medium">{data.totalPropostas - data.propostasAceitas} pendentes/recusadas</span>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-warning" />
            <p className="text-sm font-semibold text-foreground">Alertas ativos</p>
          </div>
          <span className="text-3xl font-display font-bold text-foreground">{data.alertas.length}</span>
          <p className="text-xs text-muted-foreground mt-2">
            {data.alertas.length === 0 ? "Nenhum alerta pendente" : `${data.alertas.filter((a: any) => a.severidade === "alta" || a.severidade === "critica").length} de alta severidade`}
          </p>
        </div>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Area Chart - Trend */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-3">
          <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <h3 className="font-display font-semibold text-foreground text-[15px]">Evolução Mensal</h3>
                </div>
                <p className="text-xs text-muted-foreground">Projetos e receita estimada (R$ mil)</p>
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
          </div>
        </motion.div>

        {/* Pie Chart */}
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-2">
          <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5">
            <h3 className="font-display font-semibold text-foreground text-[15px] mb-4">Projetos por Status</h3>
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
          </div>
        </motion.div>
      </div>

      {/* Hours Chart */}
      {data.horasData.length > 0 && (
        <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible">
          <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display font-semibold text-foreground text-[15px]">Horas: Estimadas vs Executadas</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Comparação por fase de projeto</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Estimadas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                  <span className="text-muted-foreground">Executadas</span>
                </div>
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
          </div>
        </motion.div>
      )}

      {/* Bottom Row: Projects + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Projects */}
        <motion.div custom={8} variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-3">
          <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
            <div className="p-5 pb-3 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <h3 className="font-display font-semibold text-foreground text-[15px]">Projetos Recentes</h3>
              </div>
              <Link to="/admin/projetos" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                Ver todos <ArrowUpRight size={12} />
              </Link>
            </div>
            {data.recentProjects.length > 0 ? (
              <div className="divide-y divide-border/40">
                {data.recentProjects.map((project: any) => (
                  <Link
                    key={project.id}
                    to={`/admin/projetos/${project.id}`}
                    className="flex items-center justify-between p-4 px-5 hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center flex-shrink-0 group-hover:from-primary/20 group-hover:to-accent/20 transition-colors">
                        <FolderKanban size={16} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {project.nome}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {project.protocolo || "Sem protocolo"} · {project.softwares?.nome || "—"}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={project.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                  <FolderKanban size={28} className="text-muted-foreground/40" />
                </div>
                <p className="text-muted-foreground text-sm">Nenhum projeto ainda</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Right Column: Alerts + Quick Stats */}
        <motion.div custom={9} variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-2 space-y-6">
          {/* Alerts */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
            <div className="p-5 pb-3 border-b border-border/60 flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground text-[15px]">Alertas Ativos</h3>
              <Badge variant="secondary" className="text-[11px] font-semibold">
                {data.alertas.length}
              </Badge>
            </div>
            {data.alertas.length > 0 ? (
              <div className="divide-y divide-border/40">
                {data.alertas.map((alerta: any) => (
                  <div key={alerta.id} className="p-4 px-5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      {alerta.severidade === "alta" || alerta.severidade === "critica" ? (
                        <XCircle size={15} className="text-destructive flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle size={15} className="text-warning flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">{alerta.titulo}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{alerta.descricao}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={20} className="text-success" />
                </div>
                <p className="text-sm text-muted-foreground">Tudo certo! Sem alertas.</p>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={16} className="text-accent" />
              <h3 className="font-display font-semibold text-foreground text-[15px]">Indicadores Rápidos</h3>
            </div>
            <div className="space-y-4">
              {[
                { label: "Projetos Concluídos", value: data.projetosConcluidos, total: data.totalProjetos, color: "bg-success", icon: CheckCircle2 },
                { label: "Em Andamento", value: data.projetosAndamento, total: data.totalProjetos, color: "bg-info", icon: Timer },
                { label: "Propostas Aceitas", value: data.propostasAceitas, total: data.totalPropostas, color: "bg-primary", icon: Sparkles },
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
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;
