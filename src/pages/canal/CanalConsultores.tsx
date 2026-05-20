import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, UserMinus, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Vinculo {
  id: string;
  status: string;
  consultor_user_id: string | null;
  convite_email: string | null;
  data_vinculo: string | null;
  created_at: string;
}
interface ProfileLite {
  user_id: string;
  nome: string;
  email: string;
}

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ativo: { label: "Ativo", variant: "default" },
  pendente: { label: "Pendente", variant: "secondary" },
  recusado: { label: "Recusado", variant: "destructive" },
  desvinculado: { label: "Desvinculado", variant: "outline" },
};

const CanalConsultores = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [open, setOpen] = useState(false);

  const carregar = async () => {
    if (!user) return;
    setLoading(true);
    // canal_id via canais table
    const { data: canalRow } = await supabase.from("canais").select("id").eq("user_id", user.id).single();
    if (!canalRow) { setLoading(false); return; }
    const { data } = await supabase
      .from("canal_consultores")
      .select("*")
      .eq("canal_id", canalRow.id)
      .order("created_at", { ascending: false });
    const list = (data as Vinculo[]) || [];
    setVinculos(list);

    const ids = list.map(v => v.consultor_user_id).filter(Boolean) as string[];
    if (ids.length) {
      const { data: pr } = await supabase.from("profiles").select("user_id, nome, email").in("user_id", ids);
      const map: Record<string, ProfileLite> = {};
      (pr || []).forEach((p: any) => { map[p.user_id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [user?.id]);

  const convidar = async () => {
    if (!email) return;
    setEnviando(true);
    const { error } = await supabase.rpc("canal_convidar_consultor", { p_email: email });
    setEnviando(false);
    if (error) {
      toast({ title: "Erro ao convidar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Convite enviado", description: `${email} receberá uma notificação para aceitar o vínculo.` });
    setEmail("");
    setOpen(false);
    carregar();
  };

  const desvincular = async (id: string) => {
    if (!confirm("Desvincular este consultor do canal?")) return;
    const { error } = await supabase
      .from("canal_consultores")
      .update({ status: "desvinculado", motivo_desvinculo: "Desvinculado pelo canal" })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Consultor desvinculado" });
    carregar();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Meus consultores</h1>
          <p className="text-muted-foreground text-sm mt-1">Convide e gerencie os consultores vinculados ao seu canal.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" /> Convidar consultor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Convidar consultor</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <Label htmlFor="email">E-mail do consultor</Label>
              <Input id="email" type="email" placeholder="consultor@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Um consultor pode estar vinculado a apenas um canal por vez. Caso o e-mail ainda não esteja cadastrado, ele receberá o convite ao se registrar.
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={convidar} disabled={enviando || !email}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar convite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : vinculos.length === 0 ? (
        <Card className="p-10 text-center">
          <Mail className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">Nenhum consultor vinculado ainda</p>
          <p className="text-sm text-muted-foreground mt-1">Envie um convite para começar a montar sua equipe.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {vinculos.map((v) => {
            const p = v.consultor_user_id ? profiles[v.consultor_user_id] : null;
            const meta = statusLabel[v.status] || { label: v.status, variant: "outline" as const };
            return (
              <div key={v.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {p?.nome || v.convite_email || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p?.email || v.convite_email}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  {v.status === "ativo" && (
                    <Button size="sm" variant="ghost" onClick={() => desvincular(v.id)}>
                      <UserMinus className="h-4 w-4 mr-1" /> Desvincular
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
};

export default CanalConsultores;
