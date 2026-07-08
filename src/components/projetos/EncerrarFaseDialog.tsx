import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileCheck2, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  faseId: string;
  faseNome: string;
  projetoId: string;
  onDone?: () => void;
}

export default function EncerrarFaseDialog({ faseId, faseNome, projetoId, onDone }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${projetoId}/${user.id}/${Date.now()}-fase-${faseId}.${ext}`;
      const { error: upErr } = await supabase.storage.from("projeto-anexos").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("projeto-anexos").getPublicUrl(path);
      const url = urlData?.publicUrl || path;

      const { error } = await (supabase as any).rpc("consultor_encerrar_fase", {
        p_fase_id: faseId,
        p_documento_url: url,
        p_documento_nome: file.name,
      });
      if (error) throw error;
      toast.success("Fase encerrada e enviada para validação");
      setOpen(false);
      setFile(null);
      onDone?.();
    } catch (e: any) {
      toast.error(e.message || "Falha ao encerrar fase");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FileCheck2 size={14} className="mr-1" /> Encerrar fase
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encerrar fase: {faseNome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Anexe o documento de encerramento (relatório, ata ou entregável). Ao enviar, o RMO será notificado para validar e o Coordenador para co-validar.
          </p>
          <div>
            <Label htmlFor="fase-doc">Documento de encerramento</Label>
            <Input
              id="fase-doc"
              type="file"
              accept=".pdf,.doc,.docx,.zip,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!file || uploading}>
            <Upload size={14} className="mr-1" />
            {uploading ? "Enviando..." : "Encerrar e notificar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
