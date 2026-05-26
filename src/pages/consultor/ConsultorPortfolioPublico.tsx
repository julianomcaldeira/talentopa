import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DataCard, SectionTitle } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Trophy, Star, Clock, FolderKanban, MapPin, Zap, Award, TrendingUp, Target, CheckCircle2
} from "lucide-react";

const getLevel = (score: number) => {
  if (score >= 9) return { label: "Elite", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30" };
  if (score >= 7) return { label: "Experiente", color: "text-success", bg: "bg-success/10", border: "border-success/30" };
  if (score >= 5) return { label: "Intermediário", color: "text-primary", bg: "bg-primary/10", border: "border-primary/30" };
  if (score >= 3) return { label: "Iniciante", color: "text-info", bg: "bg-info/10", border: "border-info/30" };
  return { label: "Novo", color: "text-muted-foreground", bg: "bg-muted", border: "border-border" };
};

const ConsultorPortfolioPublico = () => {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [score, setScore] = useState(0);
  const [stats, setStats] = useState({ avaliacaoMedia: 0, totalAvaliacoes: 0, projetosConcluidos: 0, especialidades: [] as string[] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    loadPortfolio();
  }, [userId]);

  const loadPortfolio = async () => {
    if (!userId) return;
    const [profileRes, casesRes, avalRes, habRes, propostasRes] = await Promise.all([
      supabase.from("profiles_public" as any).select("*").eq("user_id", userId).single(),
      supabase.from("portfolio_cases").select("*").eq("consultor_user_id", userId).eq("publicado", true).order("created_at", { ascending: false }),
      supabase.from("avaliacoes").select("*").eq("avaliado_user_id", userId),
      supabase.from("consultor_habilidades").select("*, softwares(nome)").eq("user_id", userId),
      supabase.from("propostas").select("*, projetos(status)").eq("consultor_user_id", userId),
    ]);

    setProfile(profileRes.data);
    setCases(casesRes.data || []);

    const avaliacoes = avalRes.data || [];
    const habilidades = habRes.data || [];
    const propostas = propostasRes.data || [];
    const aceitas = propostas.filter(p => p.status === "aceita");
    const concluidos = aceitas.filter(p => (p as any).projetos?.status === "concluido").length;
    const avaliacaoMedia = avaliacoes.length > 0 ? avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length : 0;
    const especialidades = [...new Set(habilidades.map(h => (h as any).softwares?.nome).filter(Boolean))];

    const scoreAval = avaliacaoMedia > 0 ? (avaliacaoMedia / 5) * 10 : 5;
    const scoreProjetos = Math.min(concluidos * 2, 10);
    const scoreExp = Math.min(habilidades.length * 0.8, 10);
    const overall = Math.round(((scoreAval * 0.4) + (scoreProjetos * 0.35) + (scoreExp * 0.25)) * 10) / 10;

    setScore(Math.min(overall, 10));
    setStats({ avaliacaoMedia: Math.round(avaliacaoMedia * 10) / 10, totalAvaliacoes: avaliacoes.length, projetosConcluidos: concluidos, especialidades });
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return <div className="text-center py-20 text-muted-foreground">Consultor não encontrado</div>;
  }

  const level = getLevel(score);
  const initials = profile.nome?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <div className="space-y-6">
      {/* Header */}
      <DataCard>
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-primary-foreground font-display font-bold text-xl shadow-lg">
            {initials}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl font-display font-bold text-foreground">{profile.nome}</h1>
            {(profile.cidade || profile.estado) && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center sm:justify-start mt-1">
                <MapPin size={14} /> {profile.cidade}{profile.estado && `, ${profile.estado}`}
              </p>
            )}
            {stats.especialidades.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 justify-center sm:justify-start">
                {stats.especialidades.map(e => (
                  <Badge key={e} variant="secondary" className="text-[11px]">{e}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className={`w-20 h-20 rounded-2xl ${level.bg} border-2 ${level.border} flex flex-col items-center justify-center`}>
            <span className={`text-2xl font-display font-bold ${level.color}`}>{score}</span>
            <span className={`text-[10px] font-semibold ${level.color}`}>{level.label}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-lg font-display font-bold text-foreground">{stats.projetosConcluidos}</p>
            <p className="text-[11px] text-muted-foreground">Projetos</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-display font-bold text-foreground">{stats.avaliacaoMedia || "—"}</p>
            <p className="text-[11px] text-muted-foreground">Avaliação</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-display font-bold text-foreground">{stats.totalAvaliacoes}</p>
            <p className="text-[11px] text-muted-foreground">Avaliações</p>
          </div>
        </div>
      </DataCard>

      {/* Cases */}
      <SectionTitle>Cases de Projetos</SectionTitle>
      {cases.length === 0 ? (
        <DataCard>
          <div className="text-center py-10">
            <Trophy size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Este consultor ainda não possui cases publicados</p>
          </div>
        </DataCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cases.map(c => (
            <DataCard key={c.id}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-display font-semibold text-foreground truncate">{c.titulo}</h3>
                  {c.software_nome && <Badge variant="secondary" className="text-[10px] mt-1">{c.software_nome}</Badge>}
                </div>
                {c.nota_recebida && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-warning/10 flex-shrink-0">
                    <Star size={12} className="text-warning fill-warning" />
                    <span className="text-xs font-bold text-warning">{c.nota_recebida}</span>
                  </div>
                )}
              </div>
              {c.descricao && <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{c.descricao}</p>}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {c.horas_trabalhadas > 0 && (
                  <span className="flex items-center gap-1"><Clock size={11} /> {c.horas_trabalhadas}h</span>
                )}
                {c.modulos_implementados?.length > 0 && (
                  <span className="flex items-center gap-1"><FolderKanban size={11} /> {c.modulos_implementados.length} módulos</span>
                )}
              </div>
              {c.depoimento_empresa && (
                <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/60">
                  <p className="text-xs text-muted-foreground italic">"{c.depoimento_empresa}"</p>
                </div>
              )}
            </DataCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConsultorPortfolioPublico;
