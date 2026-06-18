import { useState, useEffect, useMemo } from "react";
import {
  FolderKanban, DollarSign, Send, CheckCircle2, ArrowUpRight,
  Clock, TrendingUp, Briefcase, Target, Zap, ChevronRight, Star, BarChart3,
  CalendarDays, CalendarRange, Sparkles, Wallet, AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const WORK_HOURS_PER_DAY = 8;
const MONTH_LABELS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function businessDaysInRange(start: Date, end: Date) {
  const days: string[] = [];
  const d = new Date(start);
  d.setHours(0,0,0,0);
  const e = new Date(end);
  e.setHours(0,0,0,0);
  while (d <= e) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function computeAvailability(year: number, month: number, agenda: any[], rate: number, fromToday = false) {
  const first = fromToday ? new Date() : new Date(year, month, 1);
  if (fromToday) first.setHours(0,0,0,0);
  const last = new Date(year, month + 1, 0);
  const allBusinessDays = businessDaysInRange(first, last);
  const busyKeys = new Set<string>();
  agenda.forEach((a) => {
    const ai = new Date(a.inicio);
    const af = new Date(a.fim);
    if (af < first || ai > last) return;
    const cur = new Date(Math.max(ai.getTime(), first.getTime()));
    cur.setHours(0,0,0,0);
    const end = new Date(Math.min(af.getTime(), last.getTime()));
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) {
        busyKeys.add(`${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`);
      }
      cur.setDate(cur.getDate() + 1);
    }
  });
  const freeDays = allBusinessDays.filter((k) => !busyKeys.has(k)).length;
  const totalDays = allBusinessDays.length;
  const horas = freeDays * WORK_HOURS_PER_DAY;
  const receita = horas * rate;
  return { freeDays, totalDays, horas, receita, mes: MONTH_LABELS[month], mesShort: MONTH_SHORT[month], year };
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const }
  }),
};

const ConsultorDashboard = () => {
  const { user, profile } = useAuth();
  const [projetosDisponiveis, setProjetosDisponiveis] = useState<any[]>([]);
  const [minhasPropostas, setMinhasPropostas] = useState<any[]>([]);
  const [agenda, setAgenda] = useState<any[]>([]);
  const [valorHora, setValorHora] = useState<number>(60);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const horizonEnd = new Date();
      horizonEnd.setMonth(horizonEnd.getMonth() + 4);
      const [projetosRes, propostasRes, agendaRes, habRes] = await Promise.all([
        supabase
          .from("projetos")
          .select("*, softwares(nome)")
          .in("status", ["publicado", "em_selecao"])
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("propostas")
          .select("*, projetos(nome, protocolo, status, softwares(nome))")
          .eq("consultor_user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("consultor_agenda")
          .select("inicio, fim, status")
          .eq("consultor_user_id", user.id)
          .lte("inicio", horizonEnd.toISOString()),
        supabase
          .from("consultor_habilidades")
          .select("valor_hora")
          .eq("user_id", user.id),
      ]);

      if (projetosRes.data) setProjetosDisponiveis(projetosRes.data);
      if (propostasRes.data) setMinhasPropostas(propostasRes.data);
      if (agendaRes.data) setAgenda(agendaRes.data);
      if (habRes.data && habRes.data.length > 0) {
        const valores = habRes.data.map((h: any) => Number(h.valor_hora)).filter((n: number) => n > 0);
        if (valores.length > 0) {
          setValorHora(valores.reduce((a: number, b: number) => a + b, 0) / valores.length);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const propostasAceitas = minhasPropostas.filter((p) => p.status === "aceita");
  const propostasPendentes = minhasPropostas.filter((p) => p.status === "enviada");
  const propostasRecusadas = minhasPropostas.filter((p) => p.status === "recusada");
  const receitaTotal = propostasAceitas.reduce((sum, p) => sum + (p.valor_proposta || 0), 0);
  const horasContratadas = propostasAceitas.reduce((sum, p) => sum + (p.estimativa_horas || 0), 0);
  const taxaAceitacao = minhasPropostas.length > 0
    ? Math.round((propostasAceitas.length / minhasPropostas.length) * 100) : 0;

  // Chart data
  const propostasPorStatus = [
    { name: "Aceitas", value: propostasAceitas.length, color: "hsl(152, 56%, 40%)" },
    { name: "Pendentes", value: propostasPendentes.length, color: "hsl(38, 92%, 50%)" },
    { name: "Recusadas", value: propostasRecusadas.length, color: "hsl(0, 72%, 51%)" },
  ].filter(d => d.value > 0);

  // Revenue per project (bar chart)
  const receitaPorProjeto = propostasAceitas.slice(0, 6).map((p) => ({
    nome: p.projetos?.nome?.substring(0, 16) || "Projeto",
    valor: p.valor_proposta || 0,
    horas: p.estimativa_horas || 0,
  }));

  // Monthly trend from proposals
  const monthMap = new Map<string, { receita: number; propostas: number }>();
  minhasPropostas.forEach((p) => {
    const d = new Date(p.created_at);
    const key = `${d.toLocaleString("pt-BR", { month: "short" })}`;
    const curr = monthMap.get(key) || { receita: 0, propostas: 0 };
    curr.propostas += 1;
    if (p.status === "aceita") curr.receita += (p.valor_proposta || 0) / 1000;
    monthMap.set(key, curr);
  });
  const monthlyTrend = Array.from(monthMap.entries()).slice(-6).map(([month, data]) => ({
    month, ...data,
  }));

  // ---- Availability (current month + next 3 months) ----
  const now = new Date();
  const currentAvailability = useMemo(
    () => computeAvailability(now.getFullYear(), now.getMonth(), agenda, valorHora, true),
    [agenda, valorHora]
  );
  const projection = useMemo(() => {
    const arr = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      arr.push(computeAvailability(d.getFullYear(), d.getMonth(), agenda, valorHora, false));
    }
    return arr;
  }, [agenda, valorHora]);
  const projTotal = projection.reduce(
    (acc, p) => ({ horas: acc.horas + p.horas, dias: acc.dias + p.freeDays, receita: acc.receita + p.receita }),
    { horas: 0, dias: 0, receita: 0 }
  );
  const periodoProj = projection.length
    ? `${projection[0].mesShort} — ${projection[projection.length - 1].mesShort} / ${projection[projection.length - 1].year}`
    : "";


  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const stats = [
    { icon: FolderKanban, label: "Projetos disponíveis", value: projetosDisponiveis.length.toString(), color: "text-primary", bg: "bg-primary/10", trend: "+3 esta semana" },
    { icon: Send, label: "Propostas enviadas", value: minhasPropostas.length.toString(), color: "text-info", bg: "bg-info/10" },
    { icon: CheckCircle2, label: "Contratos ativos", value: propostasAceitas.length.toString(), color: "text-success", bg: "bg-success/10" },
    { icon: DollarSign, label: "Receita total", value: formatCurrency(receitaTotal), color: "text-accent", bg: "bg-accent/10" },
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
              {profile?.nome?.split(" ")[0] || "Consultor"}
            </h1>
            <p className="text-primary-foreground/80 mt-1 text-sm max-w-lg">
              Você tem <span className="font-semibold text-primary-foreground">{projetosDisponiveis.length} projetos</span> disponíveis e <span className="font-semibold text-primary-foreground">{propostasPendentes.length} propostas</span> aguardando resposta.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="secondary" size="sm" className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0 backdrop-blur-sm">
              <Link to="/consultor/projetos">
                <Target size={14} className="mr-1.5" /> Encontrar projetos
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0 backdrop-blur-sm">
              <Link to="/consultor/perfil">
                <Star size={14} className="mr-1.5" /> Meu perfil
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
              {stat.trend && (
                <span className="text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <TrendingUp size={10} /> {stat.trend}
                </span>
              )}
            </div>
            <p className="text-2xl font-display font-bold text-foreground tracking-tight">{stat.value}</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Performance Summary */}
      <motion.div
        custom={4}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-warning" />
            <p className="text-sm font-semibold text-foreground">Taxa de aceitação</p>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-display font-bold text-foreground">{taxaAceitacao}%</span>
          </div>
          <Progress value={taxaAceitacao} className="mt-3 h-2" />
        </div>
        <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-info" />
            <p className="text-sm font-semibold text-foreground">Horas contratadas</p>
          </div>
          <span className="text-3xl font-display font-bold text-foreground">{horasContratadas}h</span>
          <p className="text-xs text-muted-foreground mt-2">Total acumulado em contratos</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase size={16} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Total de propostas</p>
          </div>
          <span className="text-3xl font-display font-bold text-foreground">{minhasPropostas.length}</span>
          <div className="flex gap-2 mt-2">
            <span className="text-[11px] badge-success px-2 py-0.5 rounded-full font-medium">{propostasAceitas.length} aceitas</span>
            <span className="text-[11px] badge-info px-2 py-0.5 rounded-full font-medium">{propostasPendentes.length} pendentes</span>
          </div>
        </div>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Area Chart - Monthly Trend */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-3">
          <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <h3 className="font-display font-semibold text-foreground text-[15px]">Evolução Mensal</h3>
                </div>
                <p className="text-xs text-muted-foreground">Propostas enviadas e receita (R$ mil)</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Propostas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                  <span className="text-muted-foreground">Receita</span>
                </div>
              </div>
            </div>
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={monthlyTrend} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradPropostasC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(228, 76%, 52%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(228, 76%, 52%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradReceitaC" x1="0" y1="0" x2="0" y2="1">
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
                  <Area type="monotone" dataKey="propostas" stroke="hsl(228, 76%, 52%)" strokeWidth={2.5} fill="url(#gradPropostasC)" />
                  <Area type="monotone" dataKey="receita" stroke="hsl(168, 62%, 44%)" strokeWidth={2.5} fill="url(#gradReceitaC)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BarChart3 size={32} className="text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Envie propostas para ver a evolução</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Pie Chart - Proposals by status */}
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-2">
          <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5">
            <h3 className="font-display font-semibold text-foreground text-[15px] mb-4">Propostas por Status</h3>
            {propostasPorStatus.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={propostasPorStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {propostasPorStatus.map((entry, index) => (
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
                  {propostasPorStatus.map((item, i) => (
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
                <p className="text-sm text-muted-foreground">Nenhuma proposta registrada</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Revenue per project bar chart */}
      {receitaPorProjeto.length > 0 && (
        <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible">
          <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={16} className="text-accent" />
                  <h3 className="font-display font-semibold text-foreground text-[15px]">Receita por Projeto</h3>
                </div>
                <p className="text-xs text-muted-foreground">Valor contratado nos seus projetos ativos</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={receitaPorProjeto} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradBarC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(228, 76%, 52%)" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="hsl(168, 62%, 44%)" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 14%, 90%)" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(224, 10%, 48%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(224, 10%, 48%)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Valor"]}
                  contentStyle={{
                    background: "hsl(0, 0%, 100%)",
                    border: "1px solid hsl(225, 14%, 90%)",
                    borderRadius: "12px",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="valor" fill="url(#gradBarC)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Projects and Proposals Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Available Projects - takes 3 cols */}
        <motion.div custom={8} variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-3">
          <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
            <div className="p-5 pb-3 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <h3 className="font-display font-semibold text-foreground text-[15px]">Projetos disponíveis</h3>
              </div>
              <Link to="/consultor/projetos" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                Ver todos <ArrowUpRight size={12} />
              </Link>
            </div>
            {projetosDisponiveis.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                  <FolderKanban size={28} className="text-muted-foreground/40" />
                </div>
                <p className="text-muted-foreground text-sm mb-1">Nenhum projeto disponível</p>
                <p className="text-muted-foreground/60 text-xs">Novos projetos aparecem aqui quando publicados</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {projetosDisponiveis.map((p) => (
                  <Link
                    key={p.id}
                    to="/consultor/projetos"
                    className="flex items-center justify-between p-4 px-5 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center group-hover:from-primary/20 group-hover:to-accent/20 transition-colors">
                        <FolderKanban size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{p.softwares?.nome} · {p.protocolo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                        p.status === "publicado" ? "badge-primary" : "badge-warning"
                      }`}>
                        {p.status === "publicado" ? "Aberto" : "Em seleção"}
                      </span>
                      <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Right Column - takes 2 cols */}
        <motion.div custom={9} variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-2 space-y-6">
          {/* Pending proposals */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
            <div className="p-5 pb-3 border-b border-border/60 flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground text-[15px]">Propostas pendentes</h3>
              <Badge variant="secondary" className="text-[11px] font-semibold">
                {propostasPendentes.length}
              </Badge>
            </div>
            {propostasPendentes.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
                  <Send size={20} className="text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">Nenhuma proposta pendente</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Envie propostas para projetos disponíveis</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {propostasPendentes.slice(0, 4).map((p) => (
                  <div key={p.id} className="p-4 px-5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{p.projetos?.nome}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{p.projetos?.softwares?.nome}</span>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                            <Clock size={10} /> {p.estimativa_horas || 0}h
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-info flex-shrink-0 ml-3">
                        {formatCurrency(p.valor_proposta || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {minhasPropostas.length > 0 && (
              <div className="p-3 border-t border-border/60">
                <Button asChild variant="ghost" size="sm" className="w-full text-xs hover:bg-muted/40">
                  <Link to="/consultor/minhas-propostas">
                    Ver todas as propostas <ArrowUpRight size={12} className="ml-1" />
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Active contracts */}
          {propostasAceitas.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
              <div className="p-5 pb-3 border-b border-border/60 flex items-center justify-between">
                <h3 className="font-display font-semibold text-foreground text-[15px]">Contratos ativos</h3>
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              </div>
              <div className="divide-y divide-border/40">
                {propostasAceitas.slice(0, 4).map((p) => (
                  <div key={p.id} className="p-4 px-5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={14} className="text-success" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.projetos?.nome}</p>
                        <p className="text-[11px] text-muted-foreground">{p.estimativa_horas || 0}h contratadas</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-success flex-shrink-0 ml-3">
                      {formatCurrency(p.valor_proposta || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ConsultorDashboard;
