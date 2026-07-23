import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataCard, LoadingState, EmptyState } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, MapPin, Award, Users, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useScoreConfig } from "@/hooks/useScoreConfig";
import {
  computeConsultorMatches,
  fetchConsultoresDoCanal,
  NIVEL_LABEL,
  type ConsultorMatch,
} from "@/lib/matchScore";

interface Props {
  projetoId: string;
  canalId: string;
  softwareId: string | null;
  /** Called whenever the user's selection changes. */
  onSelectionChange?: (selectedUserIds: string[]) => void;
  /** Initial selected user_ids. */
  initialSelected?: string[];
}

interface ExtraConsultor {
  user_id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  avatar_url: string | null;
}

/**
 * Match list para o Parceiro (Canal) indicar consultores VINCULADOS a ele.
 * Reaproveita a mesma engine de score do ConsultorMatchList, filtrando o
 * universo aos consultores com vínculo ativo naquele canal.
 * O match aqui é sugestão (RN-06): o parceiro pode marcar todos, alguns ou
 * nenhum, e também pode indicar alguém fora do match (expandir "todos os
 * meus consultores").
 */
export const ParceiroMatchList = ({
  projetoId,
  canalId,
  softwareId,
  onSelectionChange,
  initialSelected = [],
}: Props) => {
  const { config: scoreCfg } = useScoreConfig();
  const [matches, setMatches] = useState<ConsultorMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));

  // "Todos os meus consultores" (fora do match)
  const [showAll, setShowAll] = useState(false);
  const [allConsultores, setAllConsultores] = useState<ExtraConsultor[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const vinculados = await fetchConsultoresDoCanal(canalId);
      if (vinculados.size === 0 || !softwareId) {
        setMatches([]);
        setLoading(false);
        return;
      }
      const raw = await computeConsultorMatches({
        projetoId,
        softwareId,
        scoreCfg,
        restrictToUserIds: vinculados,
        excludeExistingPropostas: false,
      });
      setMatches(raw);
      setLoading(false);
    })();
  }, [projetoId, canalId, softwareId, scoreCfg]);

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      onSelectionChange?.(Array.from(next));
      return next;
    });
  };

  const loadAllConsultores = async () => {
    if (allConsultores.length > 0) {
      setShowAll(true);
      return;
    }
    setLoadingAll(true);
    setShowAll(true);
    const { data: vinculos } = await supabase
      .from("canal_consultores")
      .select("consultor_user_id")
      .eq("canal_id", canalId)
      .eq("status", "ativo");
    const ids = (vinculos || []).map((v: any) => v.consultor_user_id);
    if (ids.length === 0) {
      setAllConsultores([]);
      setLoadingAll(false);
      return;
    }
    const { data: profiles } = await supabase
      .from("profiles_public" as any)
      .select("user_id, nome, cidade, estado, avatar_url")
      .in("user_id", ids);
    setAllConsultores((profiles as any) || []);
    setLoadingAll(false);
  };

  const matchedIds = useMemo(() => new Set(matches.map((m) => m.user_id)), [matches]);
  const extraConsultores = useMemo(
    () => allConsultores.filter((c) => !matchedIds.has(c.user_id)),
    [allConsultores, matchedIds]
  );

  const scoreColor = (s: number) =>
    s >= 75 ? "text-success" : s >= 50 ? "text-warning" : "text-muted-foreground";
  const scoreBg = (s: number) =>
    s >= 75 ? "bg-success/10 border-success/20" : s >= 50 ? "bg-warning/10 border-warning/20" : "bg-muted/50 border-border";

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-4 text-foreground hover:text-primary transition-colors"
      >
        <Users size={16} className="text-primary" />
        <span className="font-display font-semibold text-[15px]">
          Meus consultores compatíveis {!loading && `(${matches.length})`}
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
                <EmptyState
                  message="Nenhum consultor vinculado com match para este software. Você ainda pode indicar qualquer consultor da sua base."
                  icon={Star}
                />
              </DataCard>
            ) : (
              <div className="space-y-3">
                {matches.map((m, i) => {
                  const isSel = selected.has(m.user_id);
                  return (
                    <motion.div
                      key={m.user_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <DataCard>
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSel}
                            onCheckedChange={() => toggle(m.user_id)}
                            className="mt-1"
                          />
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground font-display font-bold text-sm shrink-0">
                            {m.avatar_url ? (
                              <img src={m.avatar_url} alt={m.nome} className="w-full h-full rounded-xl object-cover" />
                            ) : (
                              m.nome.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-display font-semibold text-foreground text-sm truncate">{m.nome}</h4>
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
                                {NIVEL_LABEL[m.matchDetails.nivel] || m.matchDetails.nivel}
                              </Badge>
                              {m.matchDetails.valor_hora && (
                                <span className="text-[11px] text-muted-foreground">
                                  R$ {Number(m.matchDetails.valor_hora).toFixed(0)}/h
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
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
                          </div>
                        </div>
                      </DataCard>
                    </motion.div>
                  );
                })}
              </div>
            )}

            <div className="mt-4">
              {!showAll ? (
                <Button variant="outline" size="sm" onClick={loadAllConsultores}>
                  <Users size={14} /> Ver todos os meus consultores
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Consultores fora do match (indicação opcional):
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setShowAll(false)}>
                      Recolher
                    </Button>
                  </div>
                  {loadingAll ? (
                    <LoadingState />
                  ) : extraConsultores.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Todos os seus consultores vinculados já estão listados no match.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {extraConsultores.map((c) => {
                        const isSel = selected.has(c.user_id);
                        return (
                          <div key={c.user_id} className="flex items-center gap-3 p-2 rounded-lg border border-border/50 bg-muted/20">
                            <Checkbox checked={isSel} onCheckedChange={() => toggle(c.user_id)} />
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
                              {c.avatar_url ? (
                                <img src={c.avatar_url} alt={c.nome} className="w-full h-full rounded-lg object-cover" />
                              ) : (
                                (c.nome || "?").charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{c.nome}</div>
                              {c.cidade && (
                                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <MapPin size={10} /> {c.cidade}{c.estado && `, ${c.estado}`}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
