import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, UserMinus, UserPlus, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Convite {
  id: string;
  email: string;
  status: string; // pendente | aceito | recusado | expirado
  consultor_user_id: string | null;
  data_resposta: string | null;
  expires_at: string | null;
  created_at: string;
}
interface Vinculo {
  id: string;
  status: string; // ativo | recusado | desvinculado
  consultor_user_id: string | null;
  convite_id: string | null;
  convite_email: string | null;
  data_vinculo: string | null;
  data_resposta: string | null;
  created_at: string;
}
interface ProfileLite { user_id: string; nome: string; email: string; }

interface Row {
  key: string;
  conviteId: string | null;
  vinculoId: string | null;
  email: string;
  consultorUserId: string | null;
  status: "pendente" | "aceito" | "recusado" | "expirado" | "ativo" | "desvinculado";
  dataConvite: string;
  dataResposta: string | null;
  expiresAt: string | null;
}

const statusMeta: Record<Row["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline"; hint?: string }> = {
  pendente: { label: "Aguardando resposta", variant: "secondary" },
  aceito: { label: "Convite aceito", variant: "default", hint: "O consultor aceitou, mas já possui vínculo ativo em outro canal." },
  ativo: { label: "Ativo no canal", variant: "default" },
  recusado: { label: "Recusado", variant: "destructive" },
  expirado: { label: "Expirado", variant: "outline" },
  desvinculado: { label: "Desvinculado", variant: "outline" },
};

const CanalConsultores = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [open, setOpen] = useState(false);

  const carregar = async () => {
    if (!user) return;
    setLoading(true);
    const { data: canalRow } = await supabase.from("canais").select("id").eq("user_id", user.id).single();
    if (!canalRow) { setLoading(false); return; }

    const [{ data: convitesData }, { data: vinculosData }] = await Promise.all([
      supabase.from("canal_convites").select("*").eq("canal_id", canalRow.id).order("created_at", { ascending: false }),
      supabase.from("canal_consultores").select("*").eq("canal_id", canalRow.id).order("created_at", { ascending: false }),
    ]);

    const convites = (convitesData as Convite[]) || [];
    const vinculos = (vinculosData as Vinculo[]) || [];

    const vincByConvite = new Map<string, Vinculo>();
    const vincSemConvite: Vinculo[] = [];
    vinculos.forEach((v) => {
      if (v.convite_id) vincByConvite.set(v.convite_id, v);
      else vincSemConvite.push(v);
    });

    const merged: Row[] = [];

    convites.forEach((c) => {
      const v = vincByConvite.get(c.id);
      let status: Row["status"];
      if (v && (v.status === "ativo" || v.status === "desvinculado")) {
        status = v.status as Row["status"];
      } else if (c.status === "pendente" && c.expires_at && new Date(c.expires_at) < new Date()) {
        status = "expirado";
      } else {
        status = c.status as Row["status"];
      }
      merged.push({
        key: `c-${c.id}`,
        conviteId: c.id,
        vinculoId: v?.id || null,
        email: c.email,
        consultorUserId: c.consultor_user_id || v?.consultor_user_id || null,
        status,
        dataConvite: c.created_at,
        dataResposta: c.data_resposta || v?.data_resposta || null,
        expiresAt: c.expires_at,
      });
    });

    vincSemConvite.forEach((v) => {
      merged.push({
        key: `v-${v.id}`,
        conviteId: null,
        vinculoId: v.id,
        email: v.convite_email || "",
        consultorUserId: v.consultor_user_id,
        status: v.status as Row["status"],
        dataConvite: v.created_at,
        dataResposta: v.data_resposta,
        expiresAt: null,
      });
    });

    // Desduplicar por consultor (mesmo email ou user_id) — manter mais recente
    const dedup = new Map<string, Row>();
    merged.forEach((r) => {
      const key = (r.consultorUserId || r.email.toLowerCase()).toLowerCase();
      const existing = dedup.get(key);
      if (!existing || new Date(r.dataConvite) > new Date(existing.dataConvite)) {
        dedup.set(key, r);
      }
    });
    const deduped = Array.from(dedup.values());
    deduped.sort((a, b) => +new Date(b.dataConvite) - +new Date(a.dataConvite));
    setRows(deduped);

    const ids = Array.from(new Set(deduped.map((r) => r.consultorUserId).filter(Boolean) as string[]));
    if (ids.length) {
      const { data: pr } = await supabase.from("profiles_public" as any).select("user_id, nome, email").in("user_id", ids);
      const map: Record<string, ProfileLite> = {};
      (pr || []).forEach((p: any) => { map[p.user_id] = p; });
      setProfiles(map);
    } else {
      setProfiles({});
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
                Um consultor pode estar ativo em apenas um canal por vez. Caso o e-mail ainda não esteja cadastrado, ele receberá o convite ao se registrar.
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
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center">
          <Mail className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">Nenhum convite enviado ainda</p>
          <p className="text-sm text-muted-foreground mt-1">Envie um convite para começar a montar sua equipe.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {rows.map((r) => {
            const p = r.consultorUserId ? profiles[r.consultorUserId] : null;
            const meta = statusMeta[r.status] || { label: r.status, variant: "outline" as const };
            return (
              <div key={r.key} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {p?.nome || r.email || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p?.email || r.email}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Convidado em {new Date(r.dataConvite).toLocaleDateString("pt-BR")}
                    {r.dataResposta && ` · respondido em ${new Date(r.dataResposta).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={meta.variant} title={meta.hint}>{meta.label}</Badge>
                  {r.status === "ativo" && r.vinculoId && (
                    <Button size="sm" variant="ghost" onClick={() => desvincular(r.vinculoId!)}>
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
