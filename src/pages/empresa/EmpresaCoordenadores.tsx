import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserCog, UserPlus, Trash2, Pencil } from "lucide-react";
import UsuarioEditDialog from "@/components/usuarios/UsuarioEditDialog";

type EmpUsr = {
  id: string;
  user_id: string;
  papel: string;
  profile?: { nome: string | null; email: string | null };
};

export default function EmpresaCoordenadores() {
  const { user } = useAuth();
  const [equipe, setEquipe] = useState<EmpUsr[]>([]);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("coordenador");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchEquipe = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("empresa_usuarios")
      .select("id,user_id,papel")
      .eq("empresa_user_id", user.id);
    const rows = (data || []) as EmpUsr[];
    if (rows.length) {
      const ids = rows.map((r) => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("user_id,nome,email").in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
      rows.forEach((r) => (r.profile = map.get(r.user_id) as any));
    }
    setEquipe(rows);
  };

  useEffect(() => {
    fetchEquipe();
  }, [user]);

  const adicionar = async () => {
    if (!user || !email.trim()) return;
    setLoading(true);
    try {
      const { data: uid, error: rpcErr } = await supabase.rpc("find_user_id_by_email", {
        _email: email.trim(),
      });
      if (rpcErr) throw rpcErr;
      if (!uid) throw new Error("Usuário com este e-mail não foi encontrado. Peça para se cadastrar primeiro.");
      const { error } = await supabase.from("empresa_usuarios").insert({
        empresa_user_id: user.id,
        user_id: uid as string,
        papel: papel as any,
      });
      if (error) throw error;
      toast.success(`Usuário adicionado como ${papel}`);
      setEmail("");
      fetchEquipe();
    } catch (e: any) {
      toast.error(e.message || "Não foi possível adicionar");
    } finally {
      setLoading(false);
    }
  };

  const remover = async (id: string) => {
    if (!confirm("Remover este usuário da equipe?")) return;
    const { error } = await supabase.from("empresa_usuarios").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removido");
      fetchEquipe();
    }
  };

  const papelLabel: Record<string, string> = {
    responsavel: "Responsável",
    financeiro: "Financeiro",
    operacional: "Operacional",
    coordenador: "Coordenador",
    rmo: "RMO",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <UserCog size={22} /> Equipe da Empresa
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Adicione usuários à sua empresa. <b>RMO</b> orquestra o dia-a-dia dos projetos (publica demandas, monta shortlists e valida encerramento de fases). <b>Coordenador</b> é o responsável técnico que entrevista candidatos e co-valida entregas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus size={18} /> Adicionar membro
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Input
            type="email"
            placeholder="e-mail do usuário já cadastrado"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Select value={papel} onValueChange={setPapel}>
            <SelectTrigger className="sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rmo">RMO</SelectItem>
              <SelectItem value="coordenador">Coordenador</SelectItem>
              <SelectItem value="responsavel">Responsável</SelectItem>
              <SelectItem value="financeiro">Financeiro</SelectItem>
              <SelectItem value="operacional">Operacional</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={adicionar} disabled={loading || !email.trim()}>
            Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membros</CardTitle>
        </CardHeader>
        <CardContent>
          {equipe.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum membro adicionado.</p>
          ) : (
            <div className="divide-y">
              {equipe.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{m.profile?.nome || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">{m.profile?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={m.papel === "coordenador" ? "default" : "secondary"}>
                      {papelLabel[m.papel] || m.papel}
                    </Badge>
                    <Button size="icon" variant="ghost" onClick={() => remover(m.id)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
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
