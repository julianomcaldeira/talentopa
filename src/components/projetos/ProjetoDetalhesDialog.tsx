import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Target, FileText, Layers, ListChecks, MapPin, Building2, Lock } from "lucide-react";

interface Props {
  projeto: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When true, show empresa name (after proposal accepted). Default false. */
  showEmpresa?: boolean;
}

const modeloLabels: Record<string, { label: string; className: string }> = {
  presencial: { label: "Presencial", className: "bg-warning text-warning-foreground border-warning shadow-sm" },
  hibrido: { label: "Híbrido", className: "bg-primary text-primary-foreground border-primary shadow-sm" },
  remoto: { label: "Remoto", className: "bg-success text-success-foreground border-success shadow-sm" },
};

export const ModeloContratacaoBadge = ({ modelo }: { modelo?: string | null }) => {
  if (!modelo) return null;
  const cfg = modeloLabels[modelo];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${cfg.className}`}>
      <MapPin size={12} /> {cfg.label}
    </span>
  );
};

export const ProjetoDetalhesDialog = ({ projeto, open, onOpenChange, showEmpresa = false }: Props) => {
  const [modulos, setModulos] = useState<string[]>([]);
  const [funcs, setFuncs] = useState<string[]>([]);
  const [fases, setFases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !projeto) return;
    const load = async () => {
      setLoading(true);
      const [modRes, funcRes, faseRes] = await Promise.all([
        supabase.from("projeto_modulos").select("modulos(nome)").eq("projeto_id", projeto.id),
        supabase.from("projeto_funcionalidades").select("funcionalidades(nome, horas_media_estimadas)").eq("projeto_id", projeto.id),
        supabase.from("projeto_fases").select("*").eq("projeto_id", projeto.id).order("ordem"),
      ]);
      setModulos((modRes.data || []).map((m: any) => m.modulos?.nome).filter(Boolean));
      setFuncs((funcRes.data || []).map((f: any) => f.funcionalidades?.nome).filter(Boolean));
      setFases(faseRes.data || []);
      setLoading(false);
    };
    load();
  }, [open, projeto]);

  if (!projeto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{projeto.nome}</DialogTitle>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline" className="text-xs">{projeto.protocolo}</Badge>
            {projeto.softwares?.nome && <Badge variant="secondary" className="text-xs">{projeto.softwares.nome}</Badge>}
            <ModeloContratacaoBadge modelo={projeto.modelo_contratacao} />
            {(projeto.local_cidade || projeto.local_estado) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold bg-primary text-primary-foreground border-primary shadow-sm">
                <MapPin size={12} />
                {[projeto.local_cidade, projeto.local_estado].filter(Boolean).join(" / ")}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Empresa - hidden until proposal accepted */}
          <div className="bg-muted/40 rounded-xl p-3.5 border border-border/40 flex items-center gap-3">
            <div className="icon-container icon-container-md bg-muted">
              {showEmpresa ? <Building2 size={18} className="text-foreground" /> : <Lock size={18} className="text-muted-foreground" />}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Empresa contratante</p>
              <p className="text-sm font-medium text-foreground">
                {showEmpresa ? (projeto.empresa_nome || "Empresa") : "Identidade revelada após aceite da proposta"}
              </p>
            </div>
          </div>

          {projeto.descricao && (
            <Section icon={FileText} title="Descrição">
              <p className="text-sm text-muted-foreground whitespace-pre-line">{projeto.descricao}</p>
            </Section>
          )}

          {projeto.problema_atual && (
            <Section icon={FileText} title="Problema atual">
              <p className="text-sm text-muted-foreground whitespace-pre-line">{projeto.problema_atual}</p>
            </Section>
          )}

          {projeto.objetivo && (
            <Section icon={Target} title="Objetivo">
              <p className="text-sm text-muted-foreground whitespace-pre-line">{projeto.objetivo}</p>
            </Section>
          )}

          {projeto.prazo_estimado && (
            <Section icon={Calendar} title="Prazo estimado">
              <p className="text-sm text-muted-foreground">{new Date(projeto.prazo_estimado).toLocaleDateString("pt-BR")}</p>
            </Section>
          )}

          {modulos.length > 0 && (
            <Section icon={Layers} title={`Módulos (${modulos.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {modulos.map((m, i) => <Badge key={i} variant="secondary" className="text-xs">{m}</Badge>)}
              </div>
            </Section>
          )}

          {funcs.length > 0 && (
            <Section icon={ListChecks} title={`Funcionalidades (${funcs.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {funcs.map((f, i) => <Badge key={i} variant="outline" className="text-xs">{f}</Badge>)}
              </div>
            </Section>
          )}

          {fases.length > 0 && (
            <Section icon={ListChecks} title={`Fases (${fases.length})`}>
              <div className="space-y-2">
                {fases.map((f, i) => (
                  <div key={f.id} className="border border-border/60 rounded-lg p-3 bg-muted/20 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{i + 1}. {f.nome}</span>
                      {f.prazo && <span className="text-xs text-muted-foreground">{new Date(f.prazo).toLocaleDateString("pt-BR")}</span>}
                    </div>
                    {f.descricao && <p className="text-xs text-muted-foreground mt-1">{f.descricao}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {projeto.observacoes && (
            <Section icon={FileText} title="Observações">
              <p className="text-sm text-muted-foreground whitespace-pre-line">{projeto.observacoes}</p>
            </Section>
          )}

          {loading && <p className="text-xs text-muted-foreground text-center">Carregando detalhes...</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <div>
    <div className="flex items-center gap-2 mb-2">
      <Icon size={14} className="text-primary" />
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
    </div>
    {children}
  </div>
);
