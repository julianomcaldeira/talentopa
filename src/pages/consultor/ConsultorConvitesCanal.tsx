import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, Mail, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Convite {
  id: string;
  token: string;
  email: string;
  status: string;
  canal_id: string;
  created_at: string;
  expires_at: string;
  canal_nome?: string;
}

const ConsultorConvitesCanal = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [convites, setConvites] = useState<Convite[]>([]);

  const carregar = async () => {
    if (!user) return;
    setLoading(true);
    const email = user.email?.toLowerCase() || "";
    const { data } = await supabase
      .from("canal_convites")
      .select("id, token, email, status, canal_id, created_at, expires_at")
      .or(`consultor_user_id.eq.${user.id},email.eq.${email}`)
      .order("created_at", { ascending: false });
    const list = (data || []) as Convite[];

    const canalIds = Array.from(new Set(list.map((c) => c.canal_id)));
    if (canalIds.length) {
      // usar canais (view public com security_definer) — fallback para canais direto se RLS negar
      const { data: canais } = await supabase
        .from("canais_public" as any)
        .select("id, nome")
        .in("id", canalIds);
      let map: Record<string, string> = {};
      if (canais && canais.length) {
        (canais as any[]).forEach((c) => { map[c.id] = c.nome; });
      } else {
        const { data: canais2 } = await supabase.from("canais").select("id, nome").in("id", canalIds);
        (canais2 as any[] || []).forEach((c) => { map[c.id] = c.nome; });
      }
      list.forEach((c) => { c.canal_nome = map[c.canal_id] || "Canal"; });
    }
    setConvites(list);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [user?.id]);

  const responder = async (token: string, aceitar: boolean) => {
    setProcessando(token);
    const { error } = await supabase.rpc("responder_convite_canal", { p_token: token, p_aceitar: aceitar });
    setProcessando(null);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: aceitar ? "Convite aceito" : "Convite recusado",
      description: aceitar ? "Você agora faz parte da equipe deste canal." : "O canal foi notificado da recusa.",
    });
    carregar();
  };

  const pendentes = convites.filter((c) => c.status === "pendente" && new Date(c.expires_at) > new Date());
  const historico = convites.filter((c) => !(c.status === "pendente" && new Date(c.expires_at) > new Date()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Convites de Canais</h1>
        <p className="text-muted-foreground text-sm mt-1">Aceite ou recuse convites de canais para fazer parte da equipe de consultores.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Pendentes</h2>
            {pendentes.length === 0 ? (
              <Card className="p-10 text-center">
                <Mail className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">Nenhum convite pendente</p>
                <p className="text-sm text-muted-foreground mt-1">Quando um canal te convidar, aparecerá aqui.</p>
              </Card>
            ) : (
              <Card className="divide-y divide-border">
                {pendentes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{c.canal_nome || "Canal"}</p>
                      <p className="text-xs text-muted-foreground">
                        Recebido {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => responder(c.token, false)} disabled={processando === c.token}>
                        <X className="h-4 w-4 mr-1" /> Recusar
                      </Button>
                      <Button size="sm" onClick={() => responder(c.token, true)} disabled={processando === c.token}>
                        {processando === c.token ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Check className="h-4 w-4 mr-1" /> Aceitar</>)}
                      </Button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </section>

          {historico.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Histórico</h2>
              <Card className="divide-y divide-border">
                {historico.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{c.canal_nome || "Canal"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant={c.status === "aceito" ? "default" : c.status === "recusado" ? "destructive" : "outline"}>
                      {c.status === "aceito" ? "Aceito" : c.status === "recusado" ? "Recusado" : c.status === "pendente" ? "Expirado" : c.status}
                    </Badge>
                  </div>
                ))}
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default ConsultorConvitesCanal;
