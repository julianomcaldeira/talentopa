import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Trash2, Shield, User } from "lucide-react";

type Membro = {
  id: string;
  user_id: string;
  role: "admin" | "rmo";
  status: string;
  created_at: string;
  profile?: { nome: string | null; email: string | null } | null;
};

export default function CanalEquipe() {
  const { user } = useAuth();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchMembros = async () => {
    if (!user) return;
    const { data: canal } = await supabase
      .from("canais")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!canal) return;
    const { data } = await (supabase as any)
      .from("canal_membros")
      .select("*")
      .eq("canal_id", canal.id)
      .order("created_at", { ascending: false });
    const membrosList = (data as Membro[]) || [];
    // Fetch profiles
    if (membrosList.length) {
      const ids = membrosList.map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("user_id,nome,email").in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
      membrosList.forEach((m) => (m.profile = map.get(m.user_id) as any));
    }
    setMembros(membrosList);
  };

  useEffect(() => {
    fetchMembros();
  }, [user]);

  const convidar = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("canal_convidar_rmo", { p_email: email.trim() });
      if (error) throw error;
      toast.success("RMO adicionado à equipe");
      setEmail("");
      fetchMembros();
    } catch (e: any) {
      toast.error(e.message || "Não foi possível adicionar");
    } finally {
      setLoading(false);
    }
  };

  const remover = async (id: string) => {
    if (!confirm("Remover este membro da equipe?")) return;
    const { error } = await (supabase as any)
      .from("canal_membros")
      .update({ status: "removido" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Membro removido");
      fetchMembros();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Equipe do Canal</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Adicione RMOs (Resource Management Office) — funcionários operacionais que orquestram o dia-a-dia dos projetos do canal.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus size={18} /> Adicionar RMO
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Input
            type="email"
            placeholder="e-mail do usuário já cadastrado"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button onClick={convidar} disabled={loading || !email.trim()}>
            Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membros ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {membros.filter((m) => m.status === "ativo").length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum membro ativo além do administrador.</p>
          ) : (
            <div className="divide-y">
              {membros
                .filter((m) => m.status === "ativo")
                .map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        {m.role === "admin" ? <Shield size={16} className="text-primary" /> : <User size={16} className="text-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.profile?.nome || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">{m.profile?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={m.role === "admin" ? "default" : "secondary"}>{m.role === "admin" ? "Admin" : "RMO"}</Badge>
                      {m.role !== "admin" && (
                        <Button size="icon" variant="ghost" onClick={() => remover(m.id)}>
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
