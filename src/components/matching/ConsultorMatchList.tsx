import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataCard, LoadingState, EmptyState } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Award, Zap, ChevronDown, ChevronUp, Trophy, Eye, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useScoreConfig } from "@/hooks/useScoreConfig";
import { ConsultorDetailDialog } from "./ConsultorDetailDialog";

interface ConsultorMatch {
  user_id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  avatar_url: string | null;
  bio_profissional: string | null;
  linkedin: string | null;
  score: number;
  matchDetails: {
    softwareMatch: boolean;
    modulosMatch: number;
    funcsMatch: number;
    nivel: string;
    valor_hora: number | null;
  };
}

interface Props {
  projetoId: string;
  projetoNome?: string;
  softwareId: string | null;
  onInvite?: (userId: string) => void;
}

export const ConsultorMatchList = ({ projetoId, projetoNome, softwareId, onInvite }: Props) => {
  const [matches, setMatches] = useState<ConsultorMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState<ConsultorMatch | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { config: scoreCfg } = useScoreConfig();

  useEffect(() => {
    if (!softwareId) { setLoading(false); return; }
    computeMatches();
  }, [projetoId, softwareId, scoreCfg]);

  const computeMatches = async () => {
    setLoading(true);

    // Fetch project scope
    const [modulosRes, funcsRes] = await Promise.all([
      supabase.from("projeto_modulos").select("modulo_id").eq("projeto_id", projetoId),
      supabase.from("projeto_funcionalidades").select("funcionalidade_id").eq("projeto_id", projetoId),
    ]);

    const projetoModulos = modulosRes.data?.map(m => m.modulo_id) || [];
    const projetoFuncs = funcsRes.data?.map(f => f.funcionalidade_id) || [];

    // Fetch all consultants with skills for this software
    const { data: habilidades } = await supabase
      .from("consultor_habilidades")
      .select("user_id, software_id, modulo_id, funcionalidade_id, nivel, valor_hora")
      .eq("software_id", softwareId!);

    if (!habilidades || habilidades.length === 0) {
      setMatches([]);
      setLoading(false);
      return;
    }

    // Group by consultant
    const consultorMap = new Map<string, typeof habilidades>();
    habilidades.forEach(h => {
      const existing = consultorMap.get(h.user_id) || [];
      existing.push(h);
      consultorMap.set(h.user_id, existing);
    });

    // Calculate score per consultant
    const nivelWeight: Record<string, number> = { junior: 1, pleno: 2, senior: 3, especialista: 4 };
    const scored: { user_id: string; score: number; details: ConsultorMatch["matchDetails"] }[] = [];

    consultorMap.forEach((skills, userId) => {
      let score = scoreCfg.match_software; // base: knows the software

      const matchedModulos = skills.filter(s => s.modulo_id && projetoModulos.includes(s.modulo_id));
      const matchedFuncs = skills.filter(s => s.funcionalidade_id && projetoFuncs.includes(s.funcionalidade_id));

      // Module match (peso configurável)
      if (projetoModulos.length > 0) {
        score += Math.round((matchedModulos.length / projetoModulos.length) * scoreCfg.match_modulos);
      }

      // Feature match (peso configurável)
      if (projetoFuncs.length > 0) {
        score += Math.round((matchedFuncs.length / projetoFuncs.length) * scoreCfg.match_funcionalidades);
      }

      // Seniority bonus (peso configurável)
      const maxNivel = Math.max(...skills.map(s => nivelWeight[s.nivel] || 1));
      score += Math.round((maxNivel / 4) * scoreCfg.match_senioridade);

      scored.push({
        user_id: userId,
        score: Math.min(score, 100),
        details: {
          softwareMatch: true,
          modulosMatch: matchedModulos.length,
          funcsMatch: matchedFuncs.length,
          nivel: Object.entries(nivelWeight).find(([, v]) => v === maxNivel)?.[0] || "pleno",
          valor_hora: skills[0]?.valor_hora ?? null,
        },
      });
    });

    // Sort by score desc
    scored.sort((a, b) => b.score - a.score);

    // Fetch profiles
    const userIds = scored.map(s => s.user_id);
    const [profilesRes, perfilRes] = await Promise.all([
      supabase.from("profiles").select("user_id, nome, cidade, estado, avatar_url").in("user_id", userIds),
      supabase.from("consultor_perfil").select("user_id, bio_profissional, linkedin").in("user_id", userIds),
    ]);

    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
    const perfilMap = new Map((perfilRes.data || []).map(p => [p.user_id, p]));

    // Check existing proposals
    const { data: existingPropostas } = await supabase
      .from("propostas")
      .select("consultor_user_id")
      .eq("projeto_id", projetoId);
    const alreadyProposed = new Set((existingPropostas || []).map(p => p.consultor_user_id));

    const result: ConsultorMatch[] = scored
      .filter(s => !alreadyProposed.has(s.user_id))
      .map(s => {
        const profile = profileMap.get(s.user_id);
        const perfil = perfilMap.get(s.user_id);
        return {
          user_id: s.user_id,
          nome: profile?.nome || "Consultor",
          cidade: profile?.cidade || null,
          estado: profile?.estado || null,
          avatar_url: profile?.avatar_url || null,
          bio_profissional: perfil?.bio_profissional || null,
          linkedin: perfil?.linkedin || null,
          score: s.score,
          matchDetails: s.details,
        };
      });

    setMatches(result);
    setLoading(false);
  };

  const scoreColor = (score: number) => {
    if (score >= 75) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-muted-foreground";
  };

  const scoreBg = (score: number) => {
    if (score >= 75) return "bg-success/10 border-success/20";
    if (score >= 50) return "bg-warning/10 border-warning/20";
    return "bg-muted/50 border-border";
  };

  const nivelLabel: Record<string, string> = {
    junior: "Júnior", pleno: "Pleno", senior: "Sênior", especialista: "Especialista"
  };

  if (!softwareId) return null;

  return (
    <div className="mt-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-4 text-foreground hover:text-primary transition-colors"
      >
        <Zap size={16} className="text-primary" />
        <span className="font-display font-semibold text-[15px]">
          Consultores Compatíveis {!loading && `(${matches.length})`}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {loading ? (
              <DataCard><LoadingState /></DataCard>
            ) : matches.length === 0 ? (
              <DataCard>
                <EmptyState message="Nenhum consultor compatível encontrado para este software" icon={Star} />
              </DataCard>
            ) : (
              <div className="space-y-3">
                {matches.map((m, i) => (
                  <motion.div
                    key={m.user_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <DataCard>
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground font-display font-bold text-sm shrink-0">
                          {m.avatar_url ? (
                            <img src={m.avatar_url} alt={m.nome} className="w-full h-full rounded-xl object-cover" />
                          ) : (
                            m.nome.charAt(0).toUpperCase()
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-display font-semibold text-foreground text-sm truncate">{m.nome}</h4>
                              <Link to={`/consultor/portfolio/${m.user_id}`} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                                <Trophy size={10} /> Portfólio
                              </Link>
                            </div>
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${scoreBg(m.score)} ${scoreColor(m.score)}`}>
                              <Star size={12} />
                              {m.score}%
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {m.cidade && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <MapPin size={10} /> {m.cidade}{m.estado && `, ${m.estado}`}
                              </span>
                            )}
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              <Award size={10} className="mr-0.5" />
                              {nivelLabel[m.matchDetails.nivel] || m.matchDetails.nivel}
                            </Badge>
                            {m.matchDetails.valor_hora && (
                              <span className="text-[11px] text-muted-foreground">
                                R$ {Number(m.matchDetails.valor_hora).toFixed(0)}/h
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {m.matchDetails.softwareMatch && (
                              <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-md font-medium">
                                ✓ Software
                              </span>
                            )}
                            {m.matchDetails.modulosMatch > 0 && (
                              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-medium">
                                {m.matchDetails.modulosMatch} módulo{m.matchDetails.modulosMatch > 1 ? "s" : ""}
                              </span>
                            )}
                            {m.matchDetails.funcsMatch > 0 && (
                              <span className="text-[10px] bg-accent/10 text-accent-foreground px-2 py-0.5 rounded-md font-medium">
                                {m.matchDetails.funcsMatch} funcionalidade{m.matchDetails.funcsMatch > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>

                          {m.bio_profissional && (
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              {m.bio_profissional}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setSelected(m); setDetailOpen(true); }}
                              className="h-8 text-xs"
                            >
                              <Eye size={12} /> Ver perfil completo
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => { setSelected(m); setDetailOpen(true); }}
                              className="h-8 text-xs"
                            >
                              <MessageSquare size={12} /> Conversar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DataCard>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ConsultorDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        consultor={selected ? {
          user_id: selected.user_id,
          nome: selected.nome,
          cidade: selected.cidade,
          estado: selected.estado,
          avatar_url: selected.avatar_url,
          bio_profissional: selected.bio_profissional,
          linkedin: selected.linkedin,
          score: selected.score,
        } : null}
        projetoId={projetoId}
        projetoNome={projetoNome || "projeto"}
      />
    </div>
  );
};
