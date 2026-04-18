import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useScoreConfig } from "@/hooks/useScoreConfig";
import { PageHeader, DataCard, SectionTitle } from "@/components/dashboard/DashboardComponents";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Trophy, Star, Clock, FolderKanban, TrendingUp, Target,
  CheckCircle2, AlertTriangle, Zap, Award
} from "lucide-react";

interface ScoreData {
  overall: number;
  projetosConcluidos: number;
  projetosTotal: number;
  prazoCumprido: number;
  avaliacaoMedia: number;
  totalAvaliacoes: number;
  horasEntregues: number;
  taxaAceitacao: number;
  totalPropostas: number;
  propostasAceitas: number;
  especialidades: string[];
  breakdown: { label: string; score: number; max: number; weight: number; icon: React.ElementType }[];
}

const getLevel = (score: number) => {
  if (score >= 9) return { label: "Elite", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: Award };
  if (score >= 7) return { label: "Experiente", color: "text-success", bg: "bg-success/10", border: "border-success/30", icon: Trophy };
  if (score >= 5) return { label: "Intermediário", color: "text-primary", bg: "bg-primary/10", border: "border-primary/30", icon: TrendingUp };
  if (score >= 3) return { label: "Iniciante", color: "text-info", bg: "bg-info/10", border: "border-info/30", icon: Zap };
  return { label: "Novo", color: "text-muted-foreground", bg: "bg-muted", border: "border-border", icon: Target };
};

const ConsultorScore = () => {
  const { user } = useAuth();
  const { config } = useScoreConfig();
  const [data, setData] = useState<ScoreData | null>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, config]);

  const loadData = async () => {
    if (!user) return;
    const [propostasRes, avaliacoesRes, habilidadesRes, fasesRes, casesRes] = await Promise.all([
      supabase.from("propostas").select("*, projetos(status, nome)").eq("consultor_user_id", user.id),
      supabase.from("avaliacoes").select("*").eq("avaliado_user_id", user.id),
      supabase.from("consultor_habilidades").select("*, softwares(nome)").eq("user_id", user.id),
      supabase.from("projeto_fases").select("*"),
      supabase.from("portfolio_cases").select("*").eq("consultor_user_id", user.id).order("created_at", { ascending: false }),
    ]);

    const propostas = propostasRes.data || [];
    const avaliacoes = avaliacoesRes.data || [];
    const habilidades = habilidadesRes.data || [];
    const fases = fasesRes.data || [];

    setCases(casesRes.data || []);

    const aceitas = propostas.filter(p => p.status === "aceita");
    const projetosConcluidos = aceitas.filter(p => (p as any).projetos?.status === "concluido").length;

    // Prazo cumprido
    const projetoIds = aceitas.map(p => p.projeto_id);
    const projetoFases = fases.filter(f => projetoIds.includes(f.projeto_id));
    const fasesComPrazo = projetoFases.filter(f => f.prazo);
    const fasesNoPrazo = fasesComPrazo.filter(f => {
      if (f.status === "aprovada") return true;
      return f.prazo ? new Date(f.prazo) >= new Date() : true;
    });
    const prazoCumprido = fasesComPrazo.length > 0 ? (fasesNoPrazo.length / fasesComPrazo.length) * 100 : 100;

    const avaliacaoMedia = avaliacoes.length > 0
      ? avaliacoes.reduce((sum, a) => sum + a.nota, 0) / avaliacoes.length : 0;

    const horasEntregues = projetoFases.reduce((sum, f) => sum + Number(f.horas_executadas || 0), 0);

    const taxaAceitacao = propostas.length > 0 ? (aceitas.length / propostas.length) * 100 : 0;

    const especialidades = [...new Set(habilidades.map(h => (h as any).softwares?.nome).filter(Boolean))];

    // Score breakdown (each 0-10, weighted)
    const scoreAval = avaliacaoMedia > 0 ? (avaliacaoMedia / 5) * 10 : 5;
    const scorePrazo = prazoCumprido / 10;
    const scoreProjetos = Math.min(projetosConcluidos * 2, 10);
    const scoreTaxa = taxaAceitacao / 10;
    const scoreExp = Math.min(habilidades.length * 0.8, 10);

    // Pesos vindos do admin (score_config) — convertidos de % para fração
    const weights = {
      aval: config.perf_nota_media / 100,
      prazo: config.perf_pontualidade / 100,
      projetos: config.perf_projetos_concluidos / 100,
      taxa: config.perf_taxa_aceitacao / 100,
      exp: config.perf_recomendacoes / 100,
    };
    const overall = Math.round(
      ((scoreAval * weights.aval) + (scorePrazo * weights.prazo) + (scoreProjetos * weights.projetos) +
        (scoreTaxa * weights.taxa) + (scoreExp * weights.exp)) * 10
    ) / 10;

    setData({
      overall: Math.min(overall, 10),
      projetosConcluidos,
      projetosTotal: aceitas.length,
      prazoCumprido: Math.round(prazoCumprido),
      avaliacaoMedia: Math.round(avaliacaoMedia * 10) / 10,
      totalAvaliacoes: avaliacoes.length,
      horasEntregues,
      taxaAceitacao: Math.round(taxaAceitacao),
      totalPropostas: propostas.length,
      propostasAceitas: aceitas.length,
      especialidades,
      breakdown: [
        { label: "Avaliações", score: Math.round(scoreAval * 10) / 10, max: 10, weight: Math.round(weights.aval * 100), icon: Star },
        { label: "Cumprimento de prazo", score: Math.round(scorePrazo * 10) / 10, max: 10, weight: Math.round(weights.prazo * 100), icon: Clock },
        { label: "Projetos concluídos", score: Math.round(scoreProjetos * 10) / 10, max: 10, weight: Math.round(weights.projetos * 100), icon: FolderKanban },
        { label: "Taxa de aceitação", score: Math.round(scoreTaxa * 10) / 10, max: 10, weight: Math.round(weights.taxa * 100), icon: CheckCircle2 },
        { label: "Experiência técnica", score: Math.round(scoreExp * 10) / 10, max: 10, weight: Math.round(weights.exp * 100), icon: Zap },
      ],
    });
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const level = getLevel(data.overall);
  const LevelIcon = level.icon;

  return (
    <div className="space-y-6">
      <PageHeader title="Meu Score & Portfólio" description="Seu desempenho e cases de projetos concluídos" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score card */}
        <DataCard className="lg:row-span-2">
          <div className="flex flex-col items-center text-center">
            <div className={`w-28 h-28 rounded-3xl ${level.bg} border-2 ${level.border} flex flex-col items-center justify-center mb-4`}>
              <span className={`text-4xl font-display font-bold ${level.color}`}>{data.overall}</span>
              <span className="text-[10px] text-muted-foreground font-medium">/10</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <LevelIcon size={16} className={level.color} />
              <span className={`text-sm font-display font-bold ${level.color}`}>{level.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-6">
              Baseado em {data.totalAvaliacoes} avaliações e {data.projetosConcluidos} projetos
            </p>

            {/* Breakdown */}
            <div className="w-full space-y-4">
              {data.breakdown.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <ItemIcon size={12} /> {item.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground/60">peso {item.weight}%</span>
                        <span className="font-semibold text-foreground">{item.score}</span>
                      </div>
                    </div>
                    <Progress value={(item.score / item.max) * 100} className="h-1.5" />
                  </div>
                );
              })}
            </div>

            {data.especialidades.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border w-full">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Especialidades</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {data.especialidades.map(e => (
                    <Badge key={e} variant="secondary" className="text-[11px]">{e}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DataCard>

        {/* Stats grid */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: FolderKanban, label: "Projetos concluídos", value: data.projetosConcluidos.toString(), color: "text-primary", bg: "bg-primary/10" },
            { icon: Star, label: "Avaliação média", value: data.avaliacaoMedia ? `${data.avaliacaoMedia}/5` : "—", color: "text-warning", bg: "bg-warning/10" },
            { icon: Clock, label: "Horas entregues", value: `${data.horasEntregues}h`, color: "text-info", bg: "bg-info/10" },
            { icon: CheckCircle2, label: "Taxa aceitação", value: `${data.taxaAceitacao}%`, color: "text-success", bg: "bg-success/10" },
          ].map(stat => (
            <DataCard key={stat.label} className="text-center">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mx-auto mb-2`}>
                <stat.icon size={18} className={stat.color} />
              </div>
              <p className="text-lg font-display font-bold text-foreground">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </DataCard>
          ))}
        </div>

        {/* Portfolio */}
        <div className="lg:col-span-2">
          <DataCard noPadding>
            <div className="p-5 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <SectionTitle>Portfólio de Cases</SectionTitle>
                <Badge variant="secondary" className="text-[11px]">{cases.length} cases</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Gerado automaticamente a partir dos projetos concluídos</p>
            </div>

            {cases.length === 0 ? (
              <div className="p-10 text-center">
                <Trophy size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum case ainda</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Seus cases aparecerão aqui quando projetos forem concluídos</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {cases.map((c) => (
                  <div key={c.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-display font-semibold text-foreground truncate">{c.titulo}</h4>
                          {!c.publicado && <Badge variant="outline" className="text-[10px]">Oculto</Badge>}
                        </div>
                        {c.software_nome && (
                          <Badge variant="secondary" className="text-[10px] mb-2">{c.software_nome}</Badge>
                        )}
                        {c.descricao && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.descricao}</p>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
                          {c.horas_trabalhadas > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock size={11} /> {c.horas_trabalhadas}h
                            </span>
                          )}
                          {c.modulos_implementados?.length > 0 && (
                            <span className="flex items-center gap-1">
                              <FolderKanban size={11} /> {c.modulos_implementados.length} módulos
                            </span>
                          )}
                        </div>
                        {c.depoimento_empresa && (
                          <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/60">
                            <p className="text-xs text-muted-foreground italic">"{c.depoimento_empresa}"</p>
                          </div>
                        )}
                      </div>
                      {c.nota_recebida && (
                        <div className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-warning/10">
                          <Star size={14} className="text-warning fill-warning" />
                          <span className="text-sm font-bold text-warning">{c.nota_recebida}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataCard>
        </div>
      </div>

      {/* How score is calculated */}
      <DataCard>
        <SectionTitle>Como seu score é calculado?</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
          {[
            { icon: Star, title: "Avaliações (30%)", desc: "Média das notas recebidas pelas empresas nos projetos" },
            { icon: Clock, title: "Prazo (25%)", desc: "Percentual de fases entregues dentro do prazo" },
            { icon: FolderKanban, title: "Projetos (20%)", desc: "Quantidade de projetos concluídos com sucesso" },
            { icon: CheckCircle2, title: "Aceitação (15%)", desc: "Percentual de propostas aceitas pelas empresas" },
            { icon: Zap, title: "Experiência (10%)", desc: "Quantidade de habilidades técnicas cadastradas" },
          ].map(item => (
            <div key={item.title} className="p-4 rounded-xl bg-muted/30 border border-border/60">
              <item.icon size={16} className="text-primary mb-2" />
              <p className="text-xs font-semibold text-foreground mb-1">{item.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </DataCard>
    </div>
  );
};

export default ConsultorScore;
