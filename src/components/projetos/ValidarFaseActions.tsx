import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, MessageSquareWarning, XCircle } from "lucide-react";

type Role = "rmo" | "coordenador";
type Action = "aprovar" | "ajustes" | "invalidar";

interface Props {
  role: Role;
  faseId: string;
  faseNome: string;
  onDone?: () => void;
  disabled?: boolean;
}

const RPC_MAP: Record<Role, Record<Action, string>> = {
  rmo: {
    aprovar: "rmo_validar_fase",
    ajustes: "rmo_solicitar_ajustes_fase",
    invalidar: "rmo_invalidar_fase",
  },
  coordenador: {
    aprovar: "coordenador_co_validar_fase",
    ajustes: "coordenador_solicitar_ajustes_fase",
    invalidar: "coordenador_invalidar_fase",
  },
};

export default function ValidarFaseActions({ role, faseId, faseNome, onDone, disabled }: Props) {
  const [openAction, setOpenAction] = useState<Action | null>(null);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  const label = role === "rmo" ? "RMO" : "Coordenador";

  const run = async (action: Action) => {
    setLoading(true);
    try {
      const rpc = RPC_MAP[role][action];
      const params: Record<string, any> = { p_fase_id: faseId };
      if (action !== "aprovar") params.p_motivo = motivo.trim();
      const { error } = await (supabase as any).rpc(rpc, params);
      if (error) throw error;
      toast.success(
        action === "aprovar"
          ? `Fase ${role === "rmo" ? "validada" : "co-validada"} pelo ${label}`
          : action === "ajustes"
            ? "Ajustes solicitados ao consultor"
            : "Fase invalidada",
      );
      setOpenAction(null);
      setMotivo("");
      onDone?.();
    } catch (e: any) {
      toast.error(e.message || "Falha na ação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => run("aprovar")} disabled={disabled || loading}>
          <CheckCircle2 size={14} className="mr-1" /> Aprovar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpenAction("ajustes")}
          disabled={disabled || loading}
        >
          <MessageSquareWarning size={14} className="mr-1" /> Pedir ajustes
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setOpenAction("invalidar")}
          disabled={disabled || loading}
        >
          <XCircle size={14} className="mr-1" /> Invalidar
        </Button>
      </div>

      <Dialog open={openAction !== null} onOpenChange={(o) => !o && setOpenAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {openAction === "ajustes" ? "Solicitar ajustes" : "Invalidar fase"} · {faseNome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo">
              {openAction === "ajustes"
                ? "Descreva o que precisa ser ajustado pelo consultor"
                : "Justifique por que a fase será invalidada"}
            </Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              placeholder="Motivo obrigatório..."
            />
            <p className="text-xs text-muted-foreground">
              Ação registrada como {label}. O consultor será notificado.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAction(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => openAction && run(openAction)}
              disabled={!motivo.trim() || loading}
              variant={openAction === "invalidar" ? "destructive" : "default"}
            >
              {loading ? "Enviando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
