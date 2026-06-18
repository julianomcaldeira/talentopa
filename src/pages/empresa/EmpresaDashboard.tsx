import { useState, useEffect, useMemo } from "react";
import {
  FolderKanban, DollarSign, Users, ArrowUpRight, Plus, Send, CheckCircle2,
  Clock, ChevronRight, BarChart3, FileText, Package, Layers, Sparkles, Target, TrendingDown
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// Benchmark: average segment usage potential for a module (catalog-relative)
const SEGMENT_POTENTIAL = 0.85;
const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const }
  }),
};

const statusConfig: Record<string, { label: string; class: string }> = {
  rascunho: { label: "Rascunho", class: "badge-muted" },
  publicado: { label: "Publicado", class: "badge-primary" },
  em_selecao: { label: "Em seleção", class: "badge-warning" },
  em_andamento: { label: "Em andamento", class: "badge-info" },
  concluido: { label: "Concluído", class: "badge-success" },
  cancelado: { label: "Cancelado", class: "badge-destructive" },
};

const EmpresaDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [projetos, setProjetos] = useState<any[]>([]);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]); // softwares with modulos/funcionalidades
  const [usedFuncIds, setUsedFuncIds] = useState<Set<string>>(new Set());
  const [activeSoftwareId, setActiveSoftwareId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: projetosData } = await supabase
        .from("projetos")
        .select("*, softwares(id, nome), projeto_fases(id, nome, status)")
        .eq("empresa_user_id", user.id)
        .order("created_at", { ascending: false });

      const projs = projetosData || [];
      setProjetos(projs);

      // Fetch propostas
      if (projs.length > 0) {
        const projIds = projs.map((p) => p.id);
        const { data: propostasData } = await supabase
          .from("propostas")
          .select("*, projetos(nome, protocolo)")
          .in("projeto_id", projIds)
          .order("created_at", { ascending: false });

        if (propostasData && propostasData.length > 0) {
          const consultorIds = [...new Set(propostasData.map((p) => p.consultor_user_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, nome")
            .in("user_id", consultorIds);
          const nameMap = new Map((profiles || []).map((p) => [p.user_id, p.nome]));
          setPropostas(
            propostasData.map((p) => ({
              ...p,
              consultor_nome: nameMap.get(p.consultor_user_id) || "Consultor",
            }))
          );
        }

        // Funcionalidades contratadas pela empresa (acumulado de todos os projetos)
        const { data: pfs } = await supabase
          .from("projeto_funcionalidades")
          .select("funcionalidade_id")
          .in("projeto_id", projIds);
        setUsedFuncIds(new Set((pfs || []).map((r: any) => r.funcionalidade_id)));
      }

      // Catálogo: somente softwares que a empresa já contratou (via projetos)
      const softwareIds = [...new Set(projs.map((p: any) => p.software_id).filter(Boolean))];
      if (softwareIds.length > 0) {
        const { data: softs } = await supabase
          .from("softwares")
          .select("id, nome, modulos(id, nome, funcionalidades(id, nome))")
          .in("id", softwareIds);
        setCatalog(softs || []);
        if (softs && softs.length > 0) setActiveSoftwareId(softs[0].id);
      }

      setLoading(false);
    };
    fetchData();
  }, [user]);

  const activeCount = projetos.filter((p) => ["publicado", "em_selecao", "em_andamento"].includes(p.status)).length;
  const doneCount = projetos.filter((p) => p.status === "concluido").length;
  const propostasEnviadas = propostas.filter((p) => p.status === "enviada");
  const propostasAceitas = propostas.filter((p) => p.status === "aceita");
  const totalInvestido = propostasAceitas.reduce((sum, p) => sum + (p.valor_proposta || 0), 0);
  const completionRate = projetos.length > 0 ? Math.round((doneCount / projetos.length) * 100) : 0;

  // ===== Catalog analytics =====
  const activeSoftware = useMemo(
    () => catalog.find((s) => s.id === activeSoftwareId) || catalog[0] || null,
    [catalog, activeSoftwareId]
  );

  const moduleUsage = useMemo(() => {
    if (!activeSoftware) return [];
    return (activeSoftware.modulos || [])
      .map((m: any) => {
        const funcs = m.funcionalidades || [];
        const total = funcs.length;
        const usadas = funcs.filter((f: any) => usedFuncIds.has(f.id)).length;
        const usoPct = total > 0 ? Math.round((usadas / total) * 100) : 0;
        const potencialPct = Math.round(SEGMENT_POTENTIAL * 100);
        const gap = Math.max(0, potencialPct - usoPct);
        return {
          id: m.id,
          nome: m.nome,
          usoPct,
          potencialPct,
          gap,
          notUsed: funcs.filter((f: any) => !usedFuncIds.has(f.id)),
          total,
        };
      })
      .filter((m: any) => m.total > 0)
      .sort((a: any, b: any) => b.gap - a.gap);
  }, [activeSoftware, usedFuncIds]);

  const topGapModules = useMemo(() => moduleUsage.slice(0, 4), [moduleUsage]);


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
    { icon: FolderKanban, label: "Projetos ativos", value: activeCount.toString(), color: "text-primary", bg: "bg-primary/10" },
    { icon: CheckCircle2, label: "Concluídos", value: doneCount.toString(), color: "text-success", bg: "bg-success/10" },
    { icon: Send, label: "Propostas recebidas", value: propostas.length.toString(), color: "text-info", bg: "bg-info/10" },
    { icon: DollarSign, label: "Total investido", value: formatCurrency(totalInvestido), color: "text-accent", bg: "bg-accent/10" },
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
              {profile?.nome?.split(" ")[0] || "Empresa"}
            </h1>
            <p className="text-primary-foreground/80 mt-1 text-sm max-w-lg">
              Você tem <span className="font-semibold text-primary-foreground">{activeCount} projetos</span> ativos e <span className="font-semibold text-primary-foreground">{propostasEnviadas.length} propostas</span> aguardando análise.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild size="sm" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-lg">
              <Link to="/empresa/novo-projeto">
                <Plus size={14} className="mr-1.5" /> Novo Projeto
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0 backdrop-blur-sm">
              <Link to="/empresa/projetos">
                <FolderKanban size={14} className="mr-1.5" /> Meus Projetos
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
            className="relative bg-card rounded-2xl border border-border/60 p-5 shadow-card hover:shadow-card-hover transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`icon-container icon-container-md ${stat.bg} rounded-xl`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
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
            <BarChart3 size={16} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Taxa de conclusão</p>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-display font-bold text-foreground">{completionRate}%</span>
          </div>
          <Progress value={completionRate} className="mt-3 h-2" />
          <p className="text-xs text-muted-foreground mt-2">{doneCount} de {projetos.length} projetos concluídos</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-accent" />
            <p className="text-sm font-semibold text-foreground">Consultores contratados</p>
          </div>
          <span className="text-3xl font-display font-bold text-foreground">{propostasAceitas.length}</span>
          <p className="text-xs text-muted-foreground mt-2">Profissionais trabalhando nos seus projetos</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={16} className="text-info" />
            <p className="text-sm font-semibold text-foreground">Propostas pendentes</p>
          </div>
          <span className="text-3xl font-display font-bold text-foreground">{propostasEnviadas.length}</span>
          <div className="flex gap-2 mt-2">
            <span className="text-[11px] badge-success px-2 py-0.5 rounded-full font-medium">{propostasAceitas.length} aceitas</span>
            <span className="text-[11px] badge-destructive px-2 py-0.5 rounded-full font-medium">{propostas.filter(p => p.status === "recusada").length} recusadas</span>
          </div>
        </div>
      </motion.div>

      {/* Charts Row */}
      {(() => {
        const statusColors: Record<string, string> = {
          rascunho: "hsl(225, 14%, 80%)",
          publicado: "hsl(228, 76%, 52%)",
          em_selecao: "hsl(38, 92%, 50%)",
          em_andamento: "hsl(210, 100%, 52%)",
          concluido: "hsl(152, 56%, 40%)",
          cancelado: "hsl(0, 72%, 51%)",
        };
        const statusLabels: Record<string, string> = {
          rascunho: "Rascunho", publicado: "Publicado", em_selecao: "Em seleção",
          em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado",
        };
        const statusCounts: Record<string, number> = {};
        projetos.forEach((p) => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });
        const projetosPorStatus = Object.entries(statusCounts).map(([s, c]) => ({
          name: statusLabels[s] || s, value: c, color: statusColors[s] || "hsl(225, 14%, 80%)",
        }));

        const investimentoPorProjeto = propostasAceitas.slice(0, 6).map((p) => ({
          nome: (p.projetos?.nome || "Projeto").substring(0, 16),
          valor: p.valor_proposta || 0,
        }));

        const monthMap = new Map<string, { projetos: number; investimento: number }>();
        projetos.forEach((p) => {
          const d = new Date(p.created_at);
          const key = d.toLocaleString("pt-BR", { month: "short" });
          const curr = monthMap.get(key) || { projetos: 0, investimento: 0 };
          curr.projetos += 1;
          monthMap.set(key, curr);
        });
        propostasAceitas.forEach((p) => {
          const d = new Date(p.created_at);
          const key = d.toLocaleString("pt-BR", { month: "short" });
          const curr = monthMap.get(key) || { projetos: 0, investimento: 0 };
          curr.investimento += (p.valor_proposta || 0) / 1000;
          monthMap.set(key, curr);
        });
        const monthlyTrend = Array.from(monthMap.entries()).slice(-6).map(([month, data]) => ({ month, ...data }));

        return (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Area Chart */}
              <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-3">
                <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <h3 className="font-display font-semibold text-foreground text-[15px]">Evolução Mensal</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">Projetos criados e investimento (R$ mil)</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        <span className="text-muted-foreground">Projetos</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                        <span className="text-muted-foreground">Investimento</span>
                      </div>
                    </div>
                  </div>
                  {monthlyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={monthlyTrend} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradProjE" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(228, 76%, 52%)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(228, 76%, 52%)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradInvE" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(168, 62%, 44%)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(168, 62%, 44%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 14%, 90%)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(224, 10%, 48%)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "hsl(224, 10%, 48%)" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(225, 14%, 90%)", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.08)", fontSize: "13px" }} />
                        <Area type="monotone" dataKey="projetos" stroke="hsl(228, 76%, 52%)" strokeWidth={2.5} fill="url(#gradProjE)" />
                        <Area type="monotone" dataKey="investimento" stroke="hsl(168, 62%, 44%)" strokeWidth={2.5} fill="url(#gradInvE)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <BarChart3 size={32} className="text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">Crie projetos para ver a evolução</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Pie Chart */}
              <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-2">
                <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5">
                  <h3 className="font-display font-semibold text-foreground text-[15px] mb-4">Projetos por Status</h3>
                  {projetosPorStatus.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={projetosPorStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                            {projetosPorStatus.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(225, 14%, 90%)", borderRadius: "12px", fontSize: "13px" }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 mt-2">
                        {projetosPorStatus.map((item, i) => (
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

            {/* Investment bar chart */}
            {investimentoPorProjeto.length > 0 && (
              <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible">
                <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5">
                  <div className="flex items-center gap-2 mb-6">
                    <DollarSign size={16} className="text-accent" />
                    <h3 className="font-display font-semibold text-foreground text-[15px]">Investimento por Projeto</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={investimentoPorProjeto} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradBarE" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(228, 76%, 52%)" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="hsl(168, 62%, 44%)" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 14%, 90%)" vertical={false} />
                      <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(224, 10%, 48%)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(224, 10%, 48%)" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(value: number) => [new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value), "Valor"]}
                        contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(225, 14%, 90%)", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.08)", fontSize: "13px" }}
                      />
                      <Bar dataKey="valor" fill="url(#gradBarE)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}
          </>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Projects list - takes 3 cols */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-3">
          <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
            <div className="p-5 pb-3 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <h3 className="font-display font-semibold text-foreground text-[15px]">Seus projetos</h3>
              </div>
              <Link to="/empresa/projetos" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                Ver todos <ArrowUpRight size={12} />
              </Link>
            </div>
            {projetos.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                  <FolderKanban size={28} className="text-muted-foreground/40" />
                </div>
                <p className="text-muted-foreground text-sm font-medium mb-1">Nenhum projeto criado ainda</p>
                <p className="text-muted-foreground/60 text-xs mb-4">Crie seu primeiro projeto para encontrar consultores</p>
                <Button asChild size="sm">
                  <Link to="/empresa/novo-projeto">
                    <Plus size={14} className="mr-1.5" /> Criar primeiro projeto
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {projetos.slice(0, 6).map((p) => {
                  const propostasCount = propostas.filter((pr) => pr.projeto_id === p.id).length;
                  const sc = statusConfig[p.status] || statusConfig.rascunho;
                  return (
                    <div
                      key={p.id}
                      className="p-4 px-5 hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => navigate("/empresa/projetos")}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center group-hover:from-primary/20 group-hover:to-accent/20 transition-colors">
                            <FolderKanban size={16} className="text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{p.nome}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">{p.softwares?.nome}</span>
                              <span className="text-muted-foreground/30">·</span>
                              <span className="text-xs text-muted-foreground">{p.protocolo}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          {propostasCount > 0 && (
                            <Badge variant="secondary" className="text-[11px] font-semibold">
                              {propostasCount} proposta{propostasCount !== 1 ? "s" : ""}
                            </Badge>
                          )}
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${sc.class}`}>
                            {sc.label}
                          </span>
                          <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                      {p.projeto_fases && p.projeto_fases.length > 0 && (
                        <div className="flex gap-1 ml-[54px] mt-2">
                          {p.projeto_fases.map((f: any) => (
                            <div
                              key={f.id}
                              className={`flex-1 h-1.5 rounded-full transition-colors ${
                                f.status === "aprovada" ? "bg-success"
                                  : f.status === "em_andamento" ? "bg-primary"
                                  : f.status === "aguardando_aprovacao" ? "bg-warning"
                                  : "bg-border"
                              }`}
                              title={f.nome}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Right Column - takes 2 cols */}
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-2 space-y-6">
          {/* Pending proposals */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
            <div className="p-5 pb-3 border-b border-border/60 flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground text-[15px]">Propostas pendentes</h3>
              <Badge variant="secondary" className="text-[11px] font-semibold">
                {propostasEnviadas.length} nova{propostasEnviadas.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            {propostasEnviadas.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
                  <Send size={20} className="text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">Nenhuma proposta pendente</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Publique projetos para receber propostas</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {propostasEnviadas.slice(0, 5).map((p) => (
                  <div key={p.id} className="p-4 px-5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{p.consultor_nome}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{p.projetos?.nome}</span>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                            <Clock size={10} /> {p.estimativa_horas || 0}h
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-primary flex-shrink-0 ml-3">
                        {formatCurrency(p.valor_proposta || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contracted consultants */}
          {propostasAceitas.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
              <div className="p-5 pb-3 border-b border-border/60 flex items-center justify-between">
                <h3 className="font-display font-semibold text-foreground text-[15px]">Consultores contratados</h3>
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              </div>
              <div className="divide-y divide-border/40">
                {propostasAceitas.slice(0, 5).map((p) => (
                  <div key={p.id} className="p-4 px-5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={14} className="text-success" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.consultor_nome}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{p.projetos?.nome}</p>
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

export default EmpresaDashboard;
