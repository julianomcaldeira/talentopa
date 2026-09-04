import { useState, useEffect } from "react";
import { DataCard, LoadingState, EmptyState } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Award, Zap, ChevronDown, ChevronUp, Trophy, Eye, BadgeCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useScoreConfig } from "@/hooks/useScoreConfig";
import { ConsultorDetailDialog } from "./ConsultorDetailDialog";
import {
  computeConsultorMatches,
  fetchConsultoresComVinculoAtivo,
  NIVEL_LABEL,
  type ConsultorMatch,
} from "@/lib/matchScore";

interface Props {
  projetoId: string;
  projetoNome?: string;
  softwareId: string | null;
  onInvite?: (userId: string) => void | Promise<void>;
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
    const raw = await computeConsultorMatches({
      projetoId,
      softwareId: softwareId!,
      scoreCfg,
      excludeExistingPropostas: true,
    });

    // RN-03 / CA-00: RMO/empresa só enxerga consultores AVULSOS na sugestão.
    // Consultores com vínculo ativo em canal_consultores são indicados pelo parceiro.
    const vinculados = await fetchConsultoresComVinculoAtivo(raw.map((r) => r.user_id));
    const filtered = raw.filter((r) => !vinculados.has(r.user_id));

    setMatches(filtered);
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

  const handlePreApprove = async (match: ConsultorMatch) => {
    if (!onInvite) {
      setSelected(match);
      setDetailOpen(true);
      return;
    }
    await onInvite(match.user_id);
    setMatches(prev => prev.filter(item => item.user_id !== match.user_id));
  };

  const nivelLabel = NIVEL_LABEL;

  if (!softwareId) return null;

  return (
    <div className="mt-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-2 text-foreground hover:text-primary transition-colors"
      >
        <Zap size={16} className="text-primary" />
        <span className="font-display font-semibold text-[15px]">
          Consultores Compatíveis — Avulsos aderentes {!loading && `(${matches.length})`}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <p className="text-xs text-muted-foreground mb-4">
        Apenas consultores <b className="text-foreground">avulsos</b> (não vinculados a Parceiro). Vinculados são indicados pelo Parceiro.
      </p>

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
                              <h4 className="font-display font-semibold text-foreground text-sm truncate" title={m.nome}>{m.nome}</h4>
                              <Badge variant="info" className="text-[10px] px-1.5 py-0">Avulso</Badge>
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
                              onClick={() => handlePreApprove(m)}
                              className="h-8 text-xs"
                            >
                              <BadgeCheck size={12} /> Pré-aprovar
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

      {!loading && expanded && (
        <p className="mt-3 text-[11px] text-muted-foreground italic">
          Consultores vinculados a parceiros são avaliados e indicados diretamente pelos respectivos parceiros.
        </p>
      )}



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
