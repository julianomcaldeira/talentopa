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
import { UserCog, UserPlus, Trash2, Pencil, Ban, Power } from "lucide-react";
import UsuarioEditDialog from "@/components/usuarios/UsuarioEditDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type EmpUsr = {
  id: string;
  user_id: string;
  papel: string;
  ativo: boolean;
  profile?: { nome: string | null; email: string | null };
};

export default function EmpresaCoordenadores() {
  const { user, empresaUserId } = useAuth();
  const [equipe, setEquipe] = useState<EmpUsr[]>([]);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("coordenador");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [pendingInativarId, setPendingInativarId] = useState<string | null>(null);
  const [pendingReativarId, setPendingReativarId] = useState<string | null>(null);

  const fetchEquipe = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("empresa_usuarios")
      .select("id,user_id,papel,ativo")
      .eq("empresa_user_id", empresaUserId || user.id)
      .order("ativo", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) {
      // fallback se coluna ativo ainda não existe (migration não aplicada)
      const { data: fallback } = await supabase.from("empresa_usuarios").select("id,user_id,papel").eq("empresa_user_id", empresaUserId || user.id);
      const rows = ((fallback || []) as any[]).map((r) => ({ ...r, ativo: true })) as EmpUsr[];
      if (rows.length) {
        const ids = rows.map((r) => r.user_id);
        const { data: profs } = await supabase.from("profiles_public" as any).select("user_id,nome,email").in("user_id", ids);
        const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
        rows.forEach((r) => (r.profile = map.get(r.user_id) as any));
      }
      setEquipe(rows);
      return;
    }
    const rows = (data || []) as EmpUsr[];
    if (rows.length) {
      const ids = rows.map((r) => r.user_id);
      // usar profiles_public (security_definer) — profiles tem RLS restritivo (só próprio/admin) e retornaria "Sem nome"
      const { data: profs } = await supabase.from("profiles_public" as any).select("user_id,nome,email").in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
      rows.forEach((r) => (r.profile = map.get(r.user_id) as any));
      // fallback para invites onde o convidado ainda não tem profiles (nunca logou): buscar email do convite não existe aqui, mas manter email do profile
      // se ainda sem nome, o displayName fará fallback para email
    }
    setEquipe(rows);
  };

  useEffect(() => {
    fetchEquipe();
  }, [user, empresaUserId]);

  const adicionar = async () => {
    if (!user || !email.trim()) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === user.email?.toLowerCase()) {
      toast.error("Você não pode convidar a si mesmo");
      return;
    }
    setLoading(true);
    try {
      const { data: uid, error: rpcErr } = await supabase.rpc("find_user_id_by_email", {
        _email: normalizedEmail,
      });
      if (rpcErr) throw rpcErr;
      if (!uid) throw new Error("Usuário com este e-mail não foi encontrado. Peça para se cadastrar primeiro.");
      if ((uid as string) === user.id) {
        toast.error("Você não pode convidar a si mesmo");
        return;
      }
      const empresaOwnerId = empresaUserId || user.id;
      // tenta RPC nova; se schema cache ainda não tem (Lovable ainda não aplicou migration), cai no fallback
      const { data, error } = await supabase.rpc("empresa_add_membro", {
        _target: uid as string,
        _papel: papel,
        _empresa_user_id: empresaOwnerId,
      });
      if (error) {
        const msg = (error as any)?.message || "";
        const code = (error as any)?.code || "";
        const isCacheMiss = code === "PGRST202" || msg.includes("Could not find the function") || msg.includes("schema cache");
        if (isCacheMiss) {
          // fallback: insert direto (policy "Empresa gestores manage links" permite para dono)
          const { error: insErr } = await supabase.from("empresa_usuarios").insert({
            empresa_user_id: empresaOwnerId,
            user_id: uid as string,
            papel: papel as any,
          });
          if (insErr) throw insErr;
          toast.success(`Usuário adicionado como ${papel}`);
          setEmail("");
          fetchEquipe();
          return;
        }
        throw error;
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Usuário adicionado como ${papel}`);
      setEmail("");
      fetchEquipe();
    } catch (e: any) {
      const msg = e?.message || "";
      const code = e?.code || "";
      if (code === "PGRST202" || msg.includes("Could not find the function") || msg.includes("schema cache")) {
        toast.error("Função ainda não publicada no Lovable. Tente novamente em 1 min.");
      } else if (msg.includes("duplicate key") || code === "23505") {
        toast.error("Este usuário já está vinculado à sua empresa.");
      } else {
        toast.error(msg || "Não foi possível adicionar");
      }
    } finally {
      setLoading(false);
    }
  };

  const remover = async () => {
    if (!pendingRemoveId) return;
    const link = equipe.find((e) => e.id === pendingRemoveId);
    const targetUserId = link?.user_id;
    setPendingRemoveId(null);
    if (!targetUserId) {
      toast.error("Vínculo não encontrado");
      return;
    }
    const empresaOwnerId = empresaUserId || user!.id;
    const { error } = await supabase.rpc("empresa_remove_membro", {
      _target: targetUserId,
      _empresa_user_id: empresaOwnerId,
    } as any);
    if (error) {
      const msg = (error as any)?.message || "";
      const isCacheMiss = msg.includes("Could not find the function") || msg.includes("schema cache") || (error as any)?.code === "PGRST202";
      if (isCacheMiss) {
        const { error: delErr } = await supabase.from("empresa_usuarios").delete().eq("user_id", targetUserId).eq("empresa_user_id", empresaOwnerId);
        if (delErr) {
          const { error: delById } = await supabase.from("empresa_usuarios").delete().eq("id", link!.id);
          if (delById) { toast.error(delById.message); return; }
        }
        await supabase.from("user_roles").delete().eq("user_id", targetUserId).eq("role", "empresa");
        toast.success("Removido (acesso revogado)");
      } else {
        toast.error(msg || "Falha ao remover");
        return;
      }
    } else {
      toast.success("Removido e acesso revogado");
    }
    fetchEquipe();
  };

  const inativar = async () => {
    if (!pendingInativarId) return;
    const link = equipe.find((e) => e.id === pendingInativarId);
    const targetUserId = link?.user_id;
    setPendingInativarId(null);
    if (!targetUserId) { toast.error("Vínculo não encontrado"); return; }
    const empresaOwnerId = empresaUserId || user!.id;
    const { error } = await supabase.rpc("empresa_inativar_membro", {
      _target: targetUserId,
      _empresa_user_id: empresaOwnerId,
    } as any);
    if (error) {
      const msg = (error as any)?.message || "";
      const isCacheMiss = msg.includes("Could not find the function") || msg.includes("schema cache") || (error as any)?.code === "PGRST202" || msg.includes("column") && msg.includes("ativo");
      if (isCacheMiss) {
        toast.error("Função de inativação ainda não publicada no Lovable. Aguarde 1 min e tente novamente.");
      } else toast.error(msg || "Falha ao inativar");
      return;
    }
    toast.success("RMO inativado — acesso revogado, histórico preservado");
    fetchEquipe();
  };

  const reativar = async () => {
    if (!pendingReativarId) return;
    const link = equipe.find((e) => e.id === pendingReativarId);
    const targetUserId = link?.user_id;
    setPendingReativarId(null);
    if (!targetUserId) { toast.error("Vínculo não encontrado"); return; }
    const empresaOwnerId = empresaUserId || user!.id;
    const { error } = await supabase.rpc("empresa_reativar_membro", {
      _target: targetUserId,
      _empresa_user_id: empresaOwnerId,
    } as any);
    if (error) toast.error((error as any)?.message || "Falha ao reativar");
    else toast.success("Membro reativado");
    fetchEquipe();
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
              {equipe.map((m) => {
                const displayName = (() => {
                  const nome = m.profile?.nome?.trim();
                  const email = m.profile?.email?.trim();
                  // se nome é igual ao email ou vazio, mostrar email; se nome parece razão social da empresa, preferir email
                  if (!nome || nome === email) return email || "Convite pendente";
                  // heurística: se nome contém LTDA/ME/EIRELI e email existe, mostrar email como fallback visual mas manter nome completo em tooltip
                  if (email && /LTDA|CONSULTING|LTDA\.|EIRELI|ME\b/i.test(nome) && nome.length > 20) return email;
                  return nome;
                })();
                return (
                <div key={m.id} className={`flex items-center justify-between py-3 ${m.ativo === false ? "opacity-60" : ""}`}>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2" title={m.profile?.nome || ""}>{displayName} {m.ativo === false && <Badge variant="secondary">Inativo</Badge>}</p>
                    <p className="text-xs text-muted-foreground">{m.profile?.email || "sem e-mail"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={m.papel === "coordenador" ? "default" : "secondary"}>
                      {papelLabel[m.papel] || m.papel}
                    </Badge>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(m.user_id)} title="Editar">
                      <Pencil size={14} />
                    </Button>
                    {m.ativo === false ? (
                      <Button size="icon" variant="ghost" onClick={() => setPendingReativarId(m.id)} title="Reativar">
                        <Power size={14} className="text-success" />
                      </Button>
                    ) : (
                      <Button size="icon" variant="ghost" onClick={() => setPendingInativarId(m.id)} title="Inativar">
                        <Ban size={14} className="text-amber-600" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => setPendingRemoveId(m.id)} title="Excluir definitivamente">
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <UsuarioEditDialog
        open={!!editingId}
        onOpenChange={(o) => !o && setEditingId(null)}
        userId={editingId}
        onSaved={fetchEquipe}
      />

      <AlertDialog open={!!pendingInativarId} onOpenChange={(o) => !o && setPendingInativarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar membro?</AlertDialogTitle>
            <AlertDialogDescription>
              O RMO perderá o acesso imediatamente, mas o histórico e as demandas criadas por ele continuarão vinculadas à Empresa. Você pode reativar quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={inativar} className="bg-amber-600 text-white hover:bg-amber-700">Inativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingReativarId} onOpenChange={(o) => !o && setPendingReativarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar membro?</AlertDialogTitle>
            <AlertDialogDescription>
              O acesso do membro será restaurado e ele voltará a ver a Empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={reativar}>Reativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingRemoveId} onOpenChange={(o) => !o && setPendingRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga o vínculo e remove o histórico da equipe. Prefira <b>Inativar</b> se quiser preservar as demandas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remover} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
