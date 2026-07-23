import { supabase } from "@/integrations/supabase/client";
import type { ScoreConfig } from "@/hooks/useScoreConfig";

export interface MatchDetails {
  softwareMatch: boolean;
  modulosMatch: number;
  funcsMatch: number;
  nivel: string;
  valor_hora: number | null;
}

export interface ConsultorMatch {
  user_id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  avatar_url: string | null;
  bio_profissional: string | null;
  linkedin: string | null;
  score: number;
  matchDetails: MatchDetails;
}

export const NIVEL_WEIGHT: Record<string, number> = {
  junior: 1, pleno: 2, senior: 3, especialista: 4,
};

export const NIVEL_LABEL: Record<string, string> = {
  junior: "Júnior", pleno: "Pleno", senior: "Sênior", especialista: "Especialista",
};

export interface ComputeMatchesOptions {
  projetoId: string;
  softwareId: string;
  scoreCfg: ScoreConfig;
  /** Only include consultants whose user_id is in this set (post-scoring filter). */
  restrictToUserIds?: Set<string> | null;
  /** Exclude consultants whose user_id is in this set. */
  excludeUserIds?: Set<string> | null;
  /** If true, also exclude consultants who already have a proposta in this projeto. */
  excludeExistingPropostas?: boolean;
}

/**
 * Shared match-score engine. Used by both ConsultorMatchList (empresa/RMO view)
 * and ParceiroMatchList (canal indicando consultores vinculados).
 */
export async function computeConsultorMatches(
  opts: ComputeMatchesOptions
): Promise<ConsultorMatch[]> {
  const {
    projetoId,
    softwareId,
    scoreCfg,
    restrictToUserIds = null,
    excludeUserIds = null,
    excludeExistingPropostas = true,
  } = opts;

  // Project scope
  const [modulosRes, funcsRes] = await Promise.all([
    supabase.from("projeto_modulos").select("modulo_id").eq("projeto_id", projetoId),
    supabase.from("projeto_funcionalidades").select("funcionalidade_id").eq("projeto_id", projetoId),
  ]);
  const projetoModulos = modulosRes.data?.map((m) => m.modulo_id) || [];
  const projetoFuncs = funcsRes.data?.map((f) => f.funcionalidade_id) || [];

  // Consultants with skills for the software
  const { data: habilidades } = await supabase
    .from("consultor_habilidades")
    .select("user_id, software_id, modulo_id, funcionalidade_id, nivel, valor_hora")
    .eq("software_id", softwareId);

  if (!habilidades || habilidades.length === 0) return [];

  const consultorMap = new Map<string, typeof habilidades>();
  habilidades.forEach((h) => {
    const existing = consultorMap.get(h.user_id) || [];
    existing.push(h);
    consultorMap.set(h.user_id, existing);
  });

  const scored: { user_id: string; score: number; details: MatchDetails }[] = [];
  consultorMap.forEach((skills, userId) => {
    let score = scoreCfg.match_software;
    const matchedModulos = skills.filter((s) => s.modulo_id && projetoModulos.includes(s.modulo_id));
    const matchedFuncs = skills.filter((s) => s.funcionalidade_id && projetoFuncs.includes(s.funcionalidade_id));
    if (projetoModulos.length > 0) {
      score += Math.round((matchedModulos.length / projetoModulos.length) * scoreCfg.match_modulos);
    }
    if (projetoFuncs.length > 0) {
      score += Math.round((matchedFuncs.length / projetoFuncs.length) * scoreCfg.match_funcionalidades);
    }
    const maxNivel = Math.max(...skills.map((s) => NIVEL_WEIGHT[s.nivel] || 1));
    score += Math.round((maxNivel / 4) * scoreCfg.match_senioridade);
    scored.push({
      user_id: userId,
      score: Math.min(score, 100),
      details: {
        softwareMatch: true,
        modulosMatch: matchedModulos.length,
        funcsMatch: matchedFuncs.length,
        nivel: Object.entries(NIVEL_WEIGHT).find(([, v]) => v === maxNivel)?.[0] || "pleno",
        valor_hora: skills[0]?.valor_hora ?? null,
      },
    });
  });

  scored.sort((a, b) => b.score - a.score);

  // Filters
  let filtered = scored;
  if (restrictToUserIds) filtered = filtered.filter((s) => restrictToUserIds.has(s.user_id));
  if (excludeUserIds) filtered = filtered.filter((s) => !excludeUserIds.has(s.user_id));

  if (excludeExistingPropostas) {
    const { data: existingPropostas } = await supabase
      .from("propostas")
      .select("consultor_user_id")
      .eq("projeto_id", projetoId);
    const alreadyProposed = new Set((existingPropostas || []).map((p) => p.consultor_user_id));
    filtered = filtered.filter((s) => !alreadyProposed.has(s.user_id));
  }

  if (filtered.length === 0) return [];

  const userIds = filtered.map((s) => s.user_id);
  const [profilesRes, perfilRes] = await Promise.all([
    supabase.from("profiles_public" as any).select("user_id, nome, cidade, estado, avatar_url").in("user_id", userIds),
    supabase.from("consultor_perfil").select("user_id, bio_profissional, linkedin").in("user_id", userIds),
  ]);

  const profileMap = new Map(((profilesRes.data as any[]) || []).map((p: any) => [p.user_id, p]));
  const perfilMap = new Map((perfilRes.data || []).map((p) => [p.user_id, p]));

  return filtered.map((s) => {
    const profile: any = profileMap.get(s.user_id);
    const perfil: any = perfilMap.get(s.user_id);
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
}

/**
 * Returns the set of consultor_user_id that currently have an active bond
 * with any canal. Used to exclude them from the empresa/RMO match list.
 */
export async function fetchConsultoresComVinculoAtivo(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data } = await supabase
    .from("canal_consultores")
    .select("consultor_user_id")
    .in("consultor_user_id", userIds)
    .eq("status", "ativo");
  return new Set((data || []).map((r: any) => r.consultor_user_id));
}

/**
 * Returns the set of consultor_user_id that have an active bond
 * with the given canal_id.
 */
export async function fetchConsultoresDoCanal(canalId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("canal_consultores")
    .select("consultor_user_id")
    .eq("canal_id", canalId)
    .eq("status", "ativo");
  return new Set((data || []).map((r: any) => r.consultor_user_id));
}
