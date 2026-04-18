import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DataCard, LoadingState, EmptyState } from "@/components/dashboard/DashboardComponents";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings, Save, RotateCcw, Trophy, Target, AlertCircle, CheckCircle2, History, ArrowRight, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

type Cfg = {
  perf_nota_media: number;
  perf_projetos_concluidos: number;
  perf_taxa_aceitacao: number;
  perf_pontualidade: number;
  perf_recomendacoes: number;
  match_software: number;
  match_modulos: number;
  match_funcionalidades: number;
  match_senioridade: number;
  updated_at?: string;
};

type AuditEntry = {
  id: string;
  changed_at: string;
  changed_by: string | null;
  changes: Record<string, { from: number; to: number }>;
  changed_by_nome?: string;
};

const DEFAULTS: Cfg = {
  perf_nota_media: 30, perf_projetos_concluidos: 25, perf_taxa_aceitacao: 15,
  perf_pontualidade: 20, perf_recomendacoes: 10,
  match_software: 20, match_modulos: 40, match_funcionalidades: 30, match_senioridade: 10,
};

const FIELD_LABELS: Record<string, string> = {
  perf_nota_media: "Nota média",
  perf_projetos_concluidos: "Projetos concluídos",
  perf_taxa_aceitacao: "Taxa de aceitação",
  perf_pontualidade: "Pontualidade",
  perf_recomendacoes: "Recomendações",
  match_software: "Software",
  match_modulos: "Módulos",
  match_funcionalidades: "Funcionalidades",
  match_senioridade: "Senioridade",
};

const PERF_FIELDS: { key: keyof Cfg; label: string; desc: string }[] = [
  { key: "perf_nota_media", label: "Nota média recebida", desc: "Média das avaliações dadas pelas empresas (0-5)." },
  { key: "perf_projetos_concluidos", label: "Projetos concluídos", desc: "Volume de projetos entregues com sucesso." },
  { key: "perf_taxa_aceitacao", label: "Taxa de aceitação de propostas", desc: "% de propostas enviadas que foram aceitas." },
  { key: "perf_pontualidade", label: "Pontualidade nas entregas", desc: "Cumprimento de prazos das fases do projeto." },
  { key: "perf_recomendacoes", label: "Recomendações", desc: "Empresas que marcaram 'recomendaria novamente'." },
];

const MATCH_FIELDS: { key: keyof Cfg; label: string; desc: string }[] = [
  { key: "match_software", label: "Domínio do software", desc: "Consultor possui o software ERP do projeto cadastrado." },
  { key: "match_modulos", label: "Módulos compatíveis", desc: "Quantos módulos do projeto o consultor já trabalhou." },
  { key: "match_funcionalidades", label: "Funcionalidades compatíveis", desc: "Quantas funcionalidades específicas do projeto o consultor domina." },
  { key: "match_senioridade", label: "Senioridade", desc: "Nível de experiência declarado (Júnior → Especialista)." },
];

export default function AdminScoreConfig() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  useEffect(() => { fetchCfg(); fetchAudit(); }, []);

  const fetchCfg = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("score_config").select("*").eq("id", "singleton").maybeSingle();
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    setCfg((data as Cfg) || DEFAULTS);
    setLoading(false);
  };

  const fetchAudit = async () => {
    setAuditLoading(true);
    const { data, error } = await (supabase as any)
      .from("score_config_audit")
      .select("id, changed_at, changed_by, changes")
      .order("changed_at", { ascending: false })
      .limit(30);
    if (error) { setAuditLoading(false); return; }
    const entries = (data || []) as AuditEntry[];
    const userIds = [...new Set(entries.map(e => e.changed_by).filter(Boolean))] as string[];
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", userIds);
      const map = new Map((profs || []).map(p => [p.user_id, p.nome]));
      entries.forEach(e => { if (e.changed_by) e.changed_by_nome = map.get(e.changed_by) || "Admin"; });
    }
    setAudit(entries);
    setAuditLoading(false);
  };

  const perfSum = cfg ? cfg.perf_nota_media + cfg.perf_projetos_concluidos + cfg.perf_taxa_aceitacao + cfg.perf_pontualidade + cfg.perf_recomendacoes : 0;
  const matchSum = cfg ? cfg.match_software + cfg.match_modulos + cfg.match_funcionalidades + cfg.match_senioridade : 0;
  const canSave = perfSum === 100 && matchSum === 100;

  const update = (key: keyof Cfg, value: number) => {
    if (!cfg) return;
    setCfg({ ...cfg, [key]: value });
  };

  const reset = () => setCfg({ ...DEFAULTS });

  const handleSave = async () => {
    if (!cfg || !canSave) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("score_config")
      .update({ ...cfg, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq("id", "singleton");
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Configuração salva!", description: "Os novos pesos serão aplicados nos próximos cálculos." });
    fetchCfg();
    fetchAudit();
  };

  const renderSection = (
    title: string, icon: React.ElementType, fields: typeof PERF_FIELDS, sum: number, accent: string
  ) => {
    const Icon = icon;
    return (
      <DataCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
              <Icon size={16} />
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground">Os pesos devem somar 100%.</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
            sum === 100 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}>
            {sum === 100 ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            {sum}/100
          </div>
        </div>
        <div className="space-y-5">
          {fields.map(f => (
            <div key={f.key as string}>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm font-medium text-foreground">{f.label}</Label>
                <span className="text-sm font-bold text-primary tabular-nums">{cfg![f.key]}%</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">{f.desc}</p>
              <Slider
                value={[cfg![f.key] as number]}
                onValueChange={(v) => update(f.key, v[0])}
                min={0} max={100} step={1}
              />
            </div>
          ))}
        </div>
      </DataCard>
    );
  };

  if (loading || !cfg) {
    return <DataCard><LoadingState /></DataCard>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Settings size={18} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Configuração de Score</h1>
            <p className="text-sm text-muted-foreground">
              Ajuste os pesos usados nos cálculos de Performance do Consultor e Match Projeto × Consultor.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {renderSection("Score de Performance do Consultor", Trophy, PERF_FIELDS, perfSum, "bg-warning/10 text-warning")}
        {renderSection("Match Projeto × Consultor", Target, MATCH_FIELDS, matchSum, "bg-primary/10 text-primary")}
      </div>

      <DataCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {cfg.updated_at && <>Última atualização: {new Date(cfg.updated_at).toLocaleString("pt-BR")}</>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>
              <RotateCcw size={14} /> Restaurar padrão
            </Button>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              <Save size={14} /> {saving ? "Salvando..." : "Salvar configuração"}
            </Button>
          </div>
        </div>
        {!canSave && (
          <div className="mt-3 flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>Cada seção precisa somar exatamente 100% para que a configuração possa ser salva.</span>
          </div>
        )}
      </DataCard>

      {/* Histórico de alterações */}
      <DataCard>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
            <History size={16} className="text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Histórico de alterações</h3>
            <p className="text-xs text-muted-foreground">Últimas 30 mudanças nos pesos do score.</p>
          </div>
        </div>

        {auditLoading ? (
          <LoadingState />
        ) : audit.length === 0 ? (
          <EmptyState message="Nenhuma alteração registrada ainda" icon={History} />
        ) : (
          <div className="space-y-3">
            {audit.map((entry, i) => {
              const changeKeys = Object.keys(entry.changes || {});
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border border-border rounded-xl p-4 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <User size={12} className="text-primary" />
                      </div>
                      <span className="font-medium text-foreground">{entry.changed_by_nome || "Sistema"}</span>
                      <span className="text-muted-foreground">alterou {changeKeys.length} peso{changeKeys.length > 1 ? "s" : ""}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {new Date(entry.changed_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {changeKeys.map(k => {
                      const c = entry.changes[k];
                      const diff = Number(c.to) - Number(c.from);
                      return (
                        <div key={k} className="flex items-center justify-between gap-2 text-xs bg-muted/40 rounded-lg px-3 py-2">
                          <span className="text-foreground font-medium truncate">{FIELD_LABELS[k] || k}</span>
                          <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                            <span className="text-muted-foreground line-through">{c.from}%</span>
                            <ArrowRight size={10} className="text-muted-foreground" />
                            <span className="font-bold text-foreground">{c.to}%</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              diff > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                            }`}>
                              {diff > 0 ? "+" : ""}{diff}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </DataCard>
    </div>
  );
}
