import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard, DataCard, LoadingState, EmptyState, SectionTitle } from "@/components/dashboard/DashboardComponents";
import {
  Activity, TrendingUp, TrendingDown, Users, Building2, DollarSign, Clock,
  AlertTriangle, Target, MapPin, Trophy, Sparkles, Wallet
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
const fmtN = (v: number) => new Intl.NumberFormat("pt-BR").format(v || 0);

interface Metrics {
  funil: Record<string, number>;
  tempos: { avg_horas_ate_primeira_proposta: number; avg_dias_aceite_a_conclusao: number; projetos_atrasados: number };
  erp_demanda_oferta: { software: string; demanda: number; oferta: number }[];
  modulos_quentes: { modulo: string; demanda: number; consultores: number }[];
  financeiro: { receita_total: number; gmv_total: number; ticket_medio: number; pendente: number; atrasado: number; pago: number };
  engajamento: { total_consultores: number; consultores_ativos_30d: number; total_empresas: number; empresas_ativas_30d: number; consultores_inativos_60d: number; nps_recomendacao_pct: number; nota_media_geral: number };
  geografia: { estado: string; total: number }[];
  top_empresas: { nome: string; valor: number; pagamentos: number }[];
}

const AdminMetricas = () => {
  const [data, setData] = useState<Metrics | null>(null);
  const [monthly, setMonthly] = useState<{ mes: string; criados: number; concluidos: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, ms] = await Promise.all([
        supabase.rpc("get_admin_advanced_metrics"),
        supabase.rpc("get_monthly_project_stats"),
      ]);
      if (m.data) setData(m.data as unknown as Metrics);
      if (ms.data) setMonthly(ms.data as any);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingState />;
  if (!data) return <EmptyState message="Sem dados disponíveis" icon={Activity} />;

  const f = data.funil;
  const taxaProposta = f.publicados ? (f.com_propostas / f.publicados) * 100 : 0;
  const taxaAceite = f.com_propostas ? (f.aceitas / f.com_propostas) * 100 : 0;
  const taxaConclusao = f.aceitas ? (f.concluidos / f.aceitas) * 100 : 0;
  const taxaCancelamento = f.publicados ? (f.cancelados / f.publicados) * 100 : 0;

  // Pontos fortes/fracos (gap = demanda - oferta)
  const erpComGap = data.erp_demanda_oferta.map(e => ({ ...e, gap: e.demanda - e.oferta }));
  const fortes = [...erpComGap].filter(e => e.demanda > 0 && e.oferta >= e.demanda).slice(0, 5);
  const fracos = [...erpComGap].sort((a, b) => b.gap - a.gap).filter(e => e.gap > 0).slice(0, 5);

  const funnelData = [
    { etapa: "Publicados", v: f.publicados },
    { etapa: "Com propostas", v: f.com_propostas },
    { etapa: "Aceitas", v: f.aceitas },
    { etapa: "Em andamento", v: f.em_andamento },
    { etapa: "Concluídos", v: f.concluidos },
  ];

  const finPie = [
    { name: "Pago", value: data.financeiro.pago },
    { name: "Pendente", value: data.financeiro.pendente },
    { name: "Atrasado", value: data.financeiro.atrasado },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Métricas estratégicas"
        description="Visão executiva da plataforma — pontos fortes, fracos e oportunidades de crescimento."
      />

      {/* TOPO: KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Receita da plataforma" value={fmtBRL(data.financeiro.receita_total)} change={`GMV ${fmtBRL(data.financeiro.gmv_total)}`} changeType="positive" />
        <StatCard icon={Target} label="Taxa de conversão" value={`${taxaAceite.toFixed(1)}%`} change="proposta → aceite" changeType={taxaAceite >= 30 ? "positive" : "neutral"} />
        <StatCard icon={Trophy} label="NPS recomendação" value={`${data.engajamento.nps_recomendacao_pct}%`} change={`Nota média ${data.engajamento.nota_media_geral}`} changeType="positive" />
        <StatCard icon={AlertTriangle} label="Projetos atrasados" value={fmtN(data.tempos.projetos_atrasados)} change={`${taxaCancelamento.toFixed(1)}% cancelam.`} changeType={data.tempos.projetos_atrasados > 0 ? "negative" : "positive"} iconColor="text-warning" iconBg="bg-warning/10" />
      </div>

      {/* PONTOS FORTES vs FRACOS */}
      <div className="grid lg:grid-cols-2 gap-4">
        <DataCard>
          <div className="flex items-center gap-2 mb-4">
            <div className="icon-container icon-container-sm bg-success/10"><Sparkles className="h-4 w-4 text-success" /></div>
            <SectionTitle>Pontos fortes — oferta atende demanda</SectionTitle>
          </div>
          {fortes.length === 0 ? <EmptyState message="Sem dados suficientes" /> : (
            <div className="space-y-2">
              {fortes.map(e => (
                <div key={e.software} className="flex items-center justify-between p-3 rounded-xl bg-success/5 border border-success/10">
                  <div>
                    <p className="font-medium text-sm">{e.software}</p>
                    <p className="text-xs text-muted-foreground">{e.demanda} projetos · {e.oferta} consultores</p>
                  </div>
                  <span className="text-xs font-semibold badge-success px-2 py-1 rounded-full">OK</span>
                </div>
              ))}
            </div>
          )}
        </DataCard>

        <DataCard>
          <div className="flex items-center gap-2 mb-4">
            <div className="icon-container icon-container-sm bg-destructive/10"><TrendingDown className="h-4 w-4 text-destructive" /></div>
            <SectionTitle>Pontos fracos — falta consultor</SectionTitle>
          </div>
          {fracos.length === 0 ? <EmptyState message="Nenhum gap detectado 🎉" /> : (
            <div className="space-y-2">
              {fracos.map(e => (
                <div key={e.software} className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/10">
                  <div>
                    <p className="font-medium text-sm">{e.software}</p>
                    <p className="text-xs text-muted-foreground">{e.demanda} projetos · apenas {e.oferta} consultores</p>
                  </div>
                  <span className="text-xs font-semibold badge-destructive px-2 py-1 rounded-full">Gap {e.gap}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-3 italic">💡 Recrute consultores nesses ERPs para ampliar a oferta.</p>
            </div>
          )}
        </DataCard>
      </div>

      {/* FUNIL */}
      <DataCard>
        <SectionTitle>Funil de conversão</SectionTitle>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72">
            <ResponsiveContainer>
              <BarChart data={funnelData} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis type="category" dataKey="etapa" stroke="hsl(var(--muted-foreground))" fontSize={12} width={110} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="v" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">Publicado → 1ª proposta</p>
              <p className="text-2xl font-display font-bold mt-1">{taxaProposta.toFixed(1)}%</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">Proposta → Aceite</p>
              <p className="text-2xl font-display font-bold mt-1">{taxaAceite.toFixed(1)}%</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">Aceite → Conclusão</p>
              <p className="text-2xl font-display font-bold mt-1">{taxaConclusao.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </DataCard>

      {/* TEMPOS / SLA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Clock} label="Horas até 1ª proposta" value={`${data.tempos.avg_horas_ate_primeira_proposta}h`} />
        <StatCard icon={Activity} label="Dias aceite → conclusão" value={`${data.tempos.avg_dias_aceite_a_conclusao}d`} />
        <StatCard icon={Wallet} label="Ticket médio" value={fmtBRL(data.financeiro.ticket_medio)} />
      </div>

      {/* ERP DEMANDA x OFERTA */}
      <DataCard>
        <SectionTitle>Demanda vs. Oferta por ERP</SectionTitle>
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={data.erp_demanda_oferta}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="software" stroke="hsl(var(--muted-foreground))" fontSize={11} angle={-20} textAnchor="end" height={70} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Legend />
              <Bar dataKey="demanda" name="Projetos (demanda)" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              <Bar dataKey="oferta" name="Consultores (oferta)" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </DataCard>

      {/* MÓDULOS + GEOGRAFIA */}
      <div className="grid lg:grid-cols-2 gap-4">
        <DataCard>
          <SectionTitle>Módulos mais demandados</SectionTitle>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.modulos_quentes} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="modulo" stroke="hsl(var(--muted-foreground))" fontSize={11} width={110} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Legend />
                <Bar dataKey="demanda" name="Demanda" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                <Bar dataKey="consultores" name="Consultores" fill="hsl(var(--accent))" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DataCard>

        <DataCard>
          <div className="flex items-center gap-2 mb-2"><MapPin className="h-4 w-4 text-primary" /><SectionTitle>Distribuição geográfica</SectionTitle></div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.geografia}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="estado" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DataCard>
      </div>

      {/* FINANCEIRO + EVOLUÇÃO */}
      <div className="grid lg:grid-cols-2 gap-4">
        <DataCard>
          <SectionTitle>Status dos pagamentos</SectionTitle>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={finPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => fmtBRL(e.value)}>
                  {finPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </DataCard>

        <DataCard>
          <SectionTitle>Evolução mensal de projetos</SectionTitle>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Legend />
                <Area type="monotone" dataKey="criados" name="Criados" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" />
                <Area type="monotone" dataKey="concluidos" name="Concluídos" stroke="hsl(var(--success))" fill="hsl(var(--success)/0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DataCard>
      </div>

      {/* ENGAJAMENTO */}
      <DataCard>
        <SectionTitle>Engajamento de usuários</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={Users} label="Consultores total" value={fmtN(data.engajamento.total_consultores)} />
          <StatCard icon={TrendingUp} label="Ativos 30d" value={fmtN(data.engajamento.consultores_ativos_30d)} changeType="positive" />
          <StatCard icon={Building2} label="Empresas total" value={fmtN(data.engajamento.total_empresas)} />
          <StatCard icon={TrendingUp} label="Empresas ativas 30d" value={fmtN(data.engajamento.empresas_ativas_30d)} changeType="positive" />
          <StatCard icon={TrendingDown} label="Consultores inativos 60d" value={fmtN(data.engajamento.consultores_inativos_60d)} changeType="negative" iconColor="text-warning" iconBg="bg-warning/10" />
        </div>
      </DataCard>

      {/* TOP EMPRESAS */}
      <DataCard>
        <SectionTitle>Top 10 empresas pagantes</SectionTitle>
        {data.top_empresas.length === 0 ? <EmptyState message="Sem pagamentos registrados" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2">Empresa</th><th className="py-2 text-right">Pagamentos</th><th className="py-2 text-right">Valor total</th>
                </tr>
              </thead>
              <tbody>
                {data.top_empresas.map((e, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 font-medium">{e.nome}</td>
                    <td className="py-3 text-right">{e.pagamentos}</td>
                    <td className="py-3 text-right font-semibold">{fmtBRL(e.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
};

export default AdminMetricas;
