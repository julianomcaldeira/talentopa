import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Calendar, Target, FileText, Layers, ListChecks, MapPin, Building2, Lock, CalendarClock, AlarmClockPlus } from "lucide-react";

interface Props {
  projeto: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When true, show empresa name (after proposal accepted). Default false. */
  showEmpresa?: boolean;
  /** Called after a successful deadline extension so the parent can refetch. */
  onProjectUpdated?: (projeto: any) => void;
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

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (baseISO: string | null | undefined, days: number) => {
  const base = baseISO ? new Date(baseISO + "T00:00:00") : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
};
const fmtBR = (iso?: string | null) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR") : "—");

export const ProjetoDetalhesDialog = ({ projeto, open, onOpenChange, showEmpresa = false, onProjectUpdated }: Props) => {
  const { user, role } = useAuth();
  const [modulos, setModulos] = useState<string[]>([]);
  const [funcs, setFuncs] = useState<string[]>([]);
  const [fases, setFases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Prazo
  const [prazoLocal, setPrazoLocal] = useState<string | null>(null);
  const [extOpen, setExtOpen] = useState(false);
  const [novaData, setNovaData] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  const canExtend =
    !!projeto &&
    !!user &&
    (role === "admin" || projeto.empresa_user_id === user.id) &&
    ["rascunho", "publicado", "em_selecao"].includes(projeto.status);

  useEffect(() => {
    if (!open || !projeto) return;
    setPrazoLocal(projeto.prazo_propostas || null);
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

  const abrirProrrogacao = () => {
    const base = prazoLocal && prazoLocal >= todayISO() ? prazoLocal : todayISO();
    setNovaData(addDaysISO(base, 7));
    setExtOpen(true);
  };

  const dataMinima = (() => {
    const base = prazoLocal && prazoLocal >= todayISO() ? prazoLocal : todayISO();
    return addDaysISO(base, 1);
  })();

  const confirmarProrrogacao = async () => {
    if (!projeto) return;
    if (!novaData) {
      toast.error("Selecione a nova data");
      return;
    }
    if (novaData < dataMinima) {
      toast.error(`A nova data deve ser posterior a ${fmtBR(prazoLocal || todayISO())}`);
      return;
    }
    setSalvando(true);
    const { data, error } = await supabase
      .from("projetos")
      .update({ prazo_propostas: novaData })
      .eq("id", projeto.id)
      .select("*, softwares(nome)")
      .single();
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível prorrogar", { description: error.message });
      return;
    }
    setPrazoLocal(novaData);
    setExtOpen(false);
    toast.success("Prazo prorrogado", { description: `Novas propostas até ${fmtBR(novaData)}` });
    onProjectUpdated?.(data);
  };

  if (!projeto) return null;

  const prazoVencido = !!prazoLocal && prazoLocal < todayISO();

  return (
    <>
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

            {/* Prazo para receber propostas */}
            <div className={`rounded-xl p-3.5 border flex items-center justify-between gap-3 ${prazoVencido ? "bg-destructive/5 border-destructive/30" : "bg-primary/5 border-primary/20"}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`icon-container icon-container-md ${prazoVencido ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
                  <CalendarClock size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prazo para receber propostas</p>
                  <p className="text-sm font-medium text-foreground">
                    {prazoLocal ? fmtBR(prazoLocal) : "Não definido"}
                    {prazoVencido && <span className="ml-2 text-xs font-semibold text-destructive">(vencido)</span>}
                  </p>
                </div>
              </div>
              {canExtend && (
                <Button size="sm" variant={prazoVencido ? "default" : "outline"} onClick={abrirProrrogacao} className="shrink-0">
                  <AlarmClockPlus size={14} /> Prorrogar
                </Button>
              )}
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

      {/* Modal de confirmação da prorrogação */}
      <Dialog open={extOpen} onOpenChange={setExtOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <AlarmClockPlus size={18} className="text-primary" /> Prorrogar prazo de propostas
            </DialogTitle>
            <DialogDescription>
              Defina uma nova data limite para o recebimento de propostas dos consultores. Os candidatos elegíveis serão notificados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
              <p className="text-muted-foreground">
                Prazo atual: <span className="font-semibold text-foreground">{prazoLocal ? fmtBR(prazoLocal) : "Não definido"}</span>
              </p>
              {prazoVencido && (
                <p className="text-destructive font-semibold mt-1">O prazo está vencido. Defina uma data futura.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nova-data" className="text-xs uppercase tracking-wider text-muted-foreground">Nova data</Label>
              <Input
                id="nova-data"
                type="date"
                value={novaData}
                min={dataMinima}
                onChange={(e) => setNovaData(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Mínimo: {fmtBR(dataMinima)}</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[7, 14, 30].map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNovaData(addDaysISO(prazoLocal && prazoLocal >= todayISO() ? prazoLocal : todayISO(), d))}
                >
                  +{d} dias
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setExtOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={confirmarProrrogacao} disabled={salvando || !novaData || novaData < dataMinima}>
              {salvando ? "Salvando..." : "Confirmar prorrogação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
