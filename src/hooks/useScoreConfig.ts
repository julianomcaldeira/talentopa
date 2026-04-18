import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ScoreConfig = {
  perf_nota_media: number;
  perf_projetos_concluidos: number;
  perf_taxa_aceitacao: number;
  perf_pontualidade: number;
  perf_recomendacoes: number;
  match_software: number;
  match_modulos: number;
  match_funcionalidades: number;
  match_senioridade: number;
};

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  perf_nota_media: 30, perf_projetos_concluidos: 25, perf_taxa_aceitacao: 15,
  perf_pontualidade: 20, perf_recomendacoes: 10,
  match_software: 20, match_modulos: 40, match_funcionalidades: 30, match_senioridade: 10,
};

export function useScoreConfig() {
  const [config, setConfig] = useState<ScoreConfig>(DEFAULT_SCORE_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("score_config")
        .select("perf_nota_media, perf_projetos_concluidos, perf_taxa_aceitacao, perf_pontualidade, perf_recomendacoes, match_software, match_modulos, match_funcionalidades, match_senioridade")
        .eq("id", "singleton")
        .maybeSingle();
      if (active && data) setConfig(data as ScoreConfig);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  return { config, loading };
}
