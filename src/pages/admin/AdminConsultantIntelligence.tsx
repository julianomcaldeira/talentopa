import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, DataCard } from "@/components/dashboard/DashboardComponents";
import AIChatPanel from "@/components/ai/AIChatPanel";
import { Trophy, Star, Clock, FolderKanban, TrendingUp, User, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

interface ConsultorScore {
  userId: string;
  nome: string;
  email: string;
  score: number;
  projetosConcluidos: number;
  prazoCumprido: number;
  avaliacaoMedia: number;
  totalAvaliacoes: number;
  horasEntregues: number;
  especialidades: string[];
}

const AdminConsultantIntelligence = () => {
  const [consultores, setConsultores] = useState<ConsultorScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ConsultorScore | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Get all consultants
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "consultor");
    if (!roles?.length) { setLoading(false); return; }

    const userIds = roles.map(r => r.user_id);

    const [profilesRes, propostasRes, avaliacoesRes, habilidadesRes, fasesRes] = await Promise.all([
      supabase.from("profiles").select("*").in("user_id", userIds),
      supabase.from("propostas").select("*, projetos(status, nome)").in("consultor_user_id", userIds),
      supabase.from("avaliacoes").select("*").in("avaliado_user_id", userIds),
      supabase.from("consultor_habilidades").select("*, softwares(nome), modulos(nome)").in("user_id", userIds),
      supabase.from("projeto_fases").select("*"),
    ]);

    const profiles = profilesRes.data || [];
    const propostas = propostasRes.data || [];
    const avaliacoes = avaliacoesRes.data || [];
    const habilidades = habilidadesRes.data || [];
    const fases = fasesRes.data || [];

    const scores: ConsultorScore[] = userIds.map(uid => {
      const profile = profiles.find(p => p.user_id === uid);
      const userPropostas = propostas.filter(p => p.consultor_user_id === uid);
      const aceitas = userPropostas.filter(p => p.status === "aceita");
      const userAvaliacoes = avaliacoes.filter(a => a.avaliado_user_id === uid);
      const userHabilidades = habilidades.filter(h => h.user_id === uid);

      // Projects concluded (propostas aceitas em projetos concluídos)
      const projetosConcluidos = aceitas.filter(p => (p as any).projetos?.status === "concluido").length;

      // Prazo cumprido - based on phases of accepted projects
      const projetoIds = aceitas.map(p => p.projeto_id);
      const projetoFases = fases.filter(f => projetoIds.includes(f.projeto_id));
      const fasesComPrazo = projetoFases.filter(f => f.prazo);
      const fasesNoPrazo = fasesComPrazo.filter(f => {
        if (!f.prazo) return true;
        if (f.status === "aprovada") return true;
        return new Date(f.prazo) >= new Date();
      });
      const prazoCumprido = fasesComPrazo.length > 0 ? (fasesNoPrazo.length / fasesComPrazo.length) * 100 : 100;

      // Avaliação média
      const avaliacaoMedia = userAvaliacoes.length > 0
        ? userAvaliacoes.reduce((sum, a) => sum + a.nota, 0) / userAvaliacoes.length
        : 0;

      // Horas entregues
      const horasEntregues = projetoFases.reduce((sum, f) => sum + Number(f.horas_executadas || 0), 0);

      // Especialidades
      const especialidades = [...new Set(userHabilidades.map(h => (h as any).softwares?.nome).filter(Boolean))];

      // Score calculation (0-10)
      const scoreAval = avaliacaoMedia > 0 ? (avaliacaoMedia / 5) * 10 : 5; // 0-10
      const scorePrazo = prazoCumprido / 10; // 0-10
      const scoreProjetos = Math.min(projetosConcluidos * 1.5, 10); // 0-10
      const scoreExp = Math.min(userHabilidades.length * 0.8, 10); // 0-10

      const score = Math.round(((scoreAval * 0.35) + (scorePrazo * 0.30) + (scoreProjetos * 0.20) + (scoreExp * 0.15)) * 10) / 10;

      return {
        userId: uid,
        nome: profile?.nome || "Sem nome",
        email: profile?.email || "",
        score: Math.min(score, 10),
        projetosConcluidos,
        prazoCumprido: Math.round(prazoCumprido),
        avaliacaoMedia: Math.round(avaliacaoMedia * 10) / 10,
        totalAvaliacoes: userAvaliacoes.length,
        horasEntregues,
        especialidades,
      };
    });

    scores.sort((a, b) => b.score - a.score);
    setConsultores(scores);
    setLoading(false);
  };

  const filtered = consultores.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.especialidades.some(e => e.toLowerCase().includes(search.toLowerCase()))
  );

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-success";
    if (score >= 6) return "text-primary";
    if (score >= 4) return "text-warning";
    return "text-destructive";
  };

  const getScoreBg = (score: number) => {
    if (score >= 8) return "bg-success/10";
    if (score >= 6) return "bg-primary/10";
    if (score >= 4) return "bg-warning/10";
    return "bg-destructive/10";
  };

  return (
    <div>
      <PageHeader title="Consultant Intelligence" description="Análise de performance de consultores com IA" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranking */}
        <div className="lg:col-span-2 space-y-4">
          <DataCard>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou especialidade..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Calculando scores...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Nenhum consultor encontrado</div>
            ) : (
              <div className="space-y-3">
                {filtered.map((c, idx) => (
                  <div
                    key={c.userId}
                    onClick={() => setSelected(c)}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                      selected?.userId === c.userId
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/60 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-foreground flex-shrink-0">
                      {idx + 1}
                    </div>

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground text-sm font-bold flex-shrink-0">
                      {c.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-semibold text-foreground truncate">{c.nome}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {c.especialidades.length > 0 && (
                          <span className="text-[11px] text-muted-foreground truncate">
                            {c.especialidades.slice(0, 3).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="text-center">
                        <p className="font-semibold text-foreground">{c.projetosConcluidos}</p>
                        <p>Projetos</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground">{c.prazoCumprido}%</p>
                        <p>Prazo</p>
                      </div>
                      <div className="text-center flex items-center gap-1">
                        <Star size={12} className="text-warning" />
                        <p className="font-semibold text-foreground">{c.avaliacaoMedia || "—"}</p>
                      </div>
                    </div>

                    {/* Score */}
                    <div className={`w-14 h-14 rounded-xl ${getScoreBg(c.score)} flex flex-col items-center justify-center flex-shrink-0`}>
                      <span className={`text-lg font-display font-bold ${getScoreColor(c.score)}`}>{c.score}</span>
                      <span className="text-[9px] text-muted-foreground font-medium">/10</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataCard>
        </div>

        {/* Detail sidebar */}
        <div className="space-y-4">
          {selected ? (
            <>
              <DataCard>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground text-sm font-bold">
                    {selected.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <p className="font-display font-semibold text-foreground">{selected.nome}</p>
                    <p className="text-xs text-muted-foreground">{selected.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-center mb-4">
                  <div className={`w-20 h-20 rounded-2xl ${getScoreBg(selected.score)} flex flex-col items-center justify-center`}>
                    <span className={`text-3xl font-display font-bold ${getScoreColor(selected.score)}`}>{selected.score}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">Score /10</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground flex items-center gap-1.5"><FolderKanban size={12} /> Projetos concluídos</span>
                      <span className="font-semibold text-foreground">{selected.projetosConcluidos}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Clock size={12} /> Prazo cumprido</span>
                      <span className="font-semibold text-foreground">{selected.prazoCumprido}%</span>
                    </div>
                    <Progress value={selected.prazoCumprido} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Star size={12} /> Avaliação média</span>
                      <span className="font-semibold text-foreground">{selected.avaliacaoMedia || "—"} ({selected.totalAvaliacoes})</span>
                    </div>
                    <Progress value={(selected.avaliacaoMedia / 5) * 100} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground flex items-center gap-1.5"><TrendingUp size={12} /> Horas entregues</span>
                      <span className="font-semibold text-foreground">{selected.horasEntregues}h</span>
                    </div>
                  </div>
                </div>

                {selected.especialidades.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Especialidades</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.especialidades.map(e => (
                        <span key={e} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-medium">{e}</span>
                      ))}
                    </div>
                  </div>
                )}
              </DataCard>

              {/* AI analysis */}
              <DataCard className="h-[300px] flex flex-col p-0 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
                  <Trophy size={14} className="text-primary" />
                  <span className="text-xs font-display font-semibold text-foreground">Análise IA</span>
                </div>
                <AIChatPanel
                  key={selected.userId}
                  mode="consultant-analysis"
                  projectData={selected}
                  initialMessage={`Analise a performance deste consultor: ${selected.nome}, Score ${selected.score}/10, ${selected.projetosConcluidos} projetos, ${selected.prazoCumprido}% prazo cumprido, avaliação ${selected.avaliacaoMedia}/5, especialidades: ${selected.especialidades.join(", ") || "nenhuma registrada"}.`}
                  placeholder="Pergunte sobre este consultor..."
                />
              </DataCard>
            </>
          ) : (
            <DataCard>
              <div className="text-center py-8">
                <User size={32} className="mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Selecione um consultor para ver detalhes e análise IA</p>
              </div>
            </DataCard>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminConsultantIntelligence;
