import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AlertTriangle, Wand2 } from "lucide-react";

interface AjustarPropostaDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proposta: any | null;
  onSuccess?: () => void;
}

/**
 * Permite ao consultor:
 *  - "Ajuste rápido" (opção 1): edita direto valor/horas quando status = pre_aprovada
 *  - "Contraproposta formal" (opção 2): envia nova proposta quando status = aguardando_consultor,
 *    levando a proposta de volta para pré-aprovação da empresa.
 */
export const AjustarPropostaDialog = ({ open, onOpenChange, proposta, onSuccess }: AjustarPropostaDialogProps) => {
  const [valor, setValor] = useState("");
  const [horas, setHoras] = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  const isPreAprovada = proposta?.status === "pre_aprovada";
  const isAguardando = proposta?.status === "aguardando_consultor";
  const defaultTab = isAguardando ? "contraproposta" : "ajuste";

  useEffect(() => {
    if (open && proposta) {
      setValor(String(proposta.valor_proposta ?? ""));
      setHoras(String(proposta.estimativa_horas ?? ""));
      setMotivo("");
    }
  }, [open, proposta]);

  if (!proposta) return null;

  const submit = async (modo: "ajuste" | "contraproposta") => {
    const v = parseFloat(valor.replace(",", "."));
    const h = horas ? parseFloat(horas.replace(",", ".")) : null;
    if (!v || v <= 0) { toast.error("Informe um valor válido"); return; }
    setLoading(true);
    const fn = modo === "ajuste" ? "consultor_ajustar_proposta" : "consultor_enviar_contraproposta";
    const args: any = { p_proposta_id: proposta.id, p_valor: v, p_horas: h };
    if (modo === "ajuste") args.p_motivo = motivo || null;
    else args.p_justificativa = motivo || null;
    const { error } = await (supabase as any).rpc(fn, args);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(modo === "ajuste" ? "Proposta ajustada e empresa notificada." : "Contraproposta enviada. Aguarde nova pré-aprovação.");
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Atualizar valor da proposta</DialogTitle>
          <DialogDescription>
            Projeto <span className="font-medium text-foreground">{proposta.projetos?.nome}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="ajuste" disabled={!isPreAprovada}>
              <Wand2 size={14} className="mr-1.5" /> Ajuste rápido
            </TabsTrigger>
            <TabsTrigger value="contraproposta" disabled={!isAguardando && !isPreAprovada}>
              <AlertTriangle size={14} className="mr-1.5" /> Contraproposta formal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ajuste" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">
              Disponível enquanto a proposta está <strong>pré-aprovada</strong>. O novo valor é gravado e a empresa é notificada — não há mudança de status.
            </p>
            <FormGrid valor={valor} setValor={setValor} horas={horas} setHoras={setHoras} motivo={motivo} setMotivo={setMotivo} motivoLabel="Motivo do ajuste (opcional)" />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
              <Button onClick={() => submit("ajuste")} disabled={loading || !isPreAprovada}>
                {loading ? "Salvando..." : "Salvar ajuste"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="contraproposta" className="space-y-3 mt-4">
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-foreground/80">
              A contraproposta encerra a aprovação atual e volta para a empresa <strong>pré-aprovar novamente</strong>. Use quando precisar renegociar formalmente o valor.
            </div>
            <FormGrid valor={valor} setValor={setValor} horas={horas} setHoras={setHoras} motivo={motivo} setMotivo={setMotivo} motivoLabel="Justificativa (recomendada)" />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
              <Button variant="destructive" onClick={() => submit("contraproposta")} disabled={loading}>
                {loading ? "Enviando..." : "Enviar contraproposta"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const FormGrid = ({ valor, setValor, horas, setHoras, motivo, setMotivo, motivoLabel }: any) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Novo valor (R$)</Label>
        <Input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Estimativa de horas</Label>
        <Input type="number" min={0} value={horas} onChange={(e) => setHoras(e.target.value)} />
      </div>
    </div>
    <div className="space-y-1.5">
      <Label className="text-xs">{motivoLabel}</Label>
      <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: escopo ampliado, alteração de prazo, novos requisitos técnicos..." />
    </div>
  </div>
);

export default AjustarPropostaDialog;
