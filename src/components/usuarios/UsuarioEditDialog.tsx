import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EstadoSelect } from "@/components/forms/EstadoSelect";
import { toast } from "sonner";
import { Loader2, Lock, ShieldAlert, Power, History } from "lucide-react";

type UserRole = "admin" | "consultor" | "empresa" | "canal";

interface UsuarioEditDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string | null;
  onSaved?: () => void;
}

interface EditableData {
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  estado: string;
  status: string;
  role: UserRole | null;
  empresa_papel: string; // '' se não é sub-usuário empresa
  empresa_user_id: string; // empresa vinculada
  created_by: string | null;
}

const empresaPapeis = [
  { value: "rmo", label: "RMO" },
  { value: "coordenador", label: "Coordenador" },
  { value: "responsavel", label: "Responsável" },
  { value: "financeiro", label: "Financeiro" },
  { value: "operacional", label: "Operacional" },
];

export default function UsuarioEditDialog({ open, onOpenChange, userId, onSaved }: UsuarioEditDialogProps) {
  const { user, role: myRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<EditableData | null>(null);
  const [empresas, setEmpresas] = useState<{ user_id: string; nome: string }[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const isAdmin = myRole === "admin";
  const canManage = useMemo(() => {
    if (!data || !user) return false;
    if (isAdmin) return true;
    return data.created_by === user.id;
  }, [data, user, isAdmin]);

  useEffect(() => {
    if (!open || !userId) return;
    (async () => {
      setLoading(true);
      const [pRes, rRes, eRes, empListRes] = await Promise.all([
        supabase.from("profiles").select("user_id, nome, email, telefone, cidade, estado, status, created_by").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("empresa_usuarios").select("papel, empresa_user_id").eq("user_id", userId).maybeSingle(),
        supabase.from("empresa_perfil").select("user_id, razao_social, nome_fantasia"),
      ]);
      const p: any = pRes.data;
      if (!p) {
        toast.error("Usuário não encontrado");
        setLoading(false);
        onOpenChange(false);
        return;
      }
      setData({
        nome: p.nome || "",
        email: p.email || "",
        telefone: p.telefone || "",
        cidade: p.cidade || "",
        estado: p.estado || "",
        status: p.status || "ativo",
        role: (rRes.data?.role as UserRole) || null,
        empresa_papel: (eRes.data?.papel as string) || "",
        empresa_user_id: (eRes.data?.empresa_user_id as string) || "",
        created_by: p.created_by,
      });
      setEmpresas(
        ((empListRes.data as any[]) || []).map((e) => ({
          user_id: e.user_id,
          nome: e.nome_fantasia || e.razao_social || "Empresa",
        }))
      );
      setNewEmail(p.email || "");
      setLoading(false);
    })();
  }, [open, userId]);

  const salvar = async () => {
    if (!data || !userId) return;
    setSaving(true);
    try {
      let roleChanged = false;
      // 1) role (admin only)
      if (isAdmin && data.role) {
        const { data: curRole } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
        if ((curRole?.role as string) !== data.role) {
          const { error } = await supabase.rpc("manage_user_set_role", { _target: userId, _new_role: data.role });
          if (error) throw error;
          roleChanged = true;
        }
      }
      // 2) profile + sub-papel
      const empresaPapelArg =
        data.empresa_papel === ""
          ? "remove"
          : data.empresa_papel;
      const { error } = await supabase.rpc("manage_user_update", {
        _target: userId,
        _nome: data.nome,
        _telefone: data.telefone || null,
        _cidade: data.cidade || null,
        _estado: data.estado || null,
        _status: data.status,
        _empresa_papel: empresaPapelArg,
        _empresa_user_id: data.empresa_papel && data.empresa_papel !== "" ? data.empresa_user_id || null : null,
      });
      if (error) throw error;

      // 3) Se o papel principal mudou, força logout global do usuário-alvo
      // para que, ao entrar novamente, ele já veja o dashboard do novo perfil.
      if (roleChanged) {
        try {
          await supabase.functions.invoke("admin-manage-user", {
            body: { action: "force_signout", target_user_id: userId },
          });
        } catch {
          /* falha silenciosa — o usuário verá a nova visão no próximo login */
        }
        toast.success("Perfil de acesso alterado. O usuário verá a nova visão no próximo acesso.");
      } else {
        toast.success("Alterações salvas");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const invokeAdmin = async (payload: any, key: string) => {
    setBusyAction(key);
    try {
      const { data: res, error } = await supabase.functions.invoke("admin-manage-user", { body: payload });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      toast.success("Operação concluída");
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message || "Falha na operação");
    } finally {
      setBusyAction(null);
    }
  };

  const resetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Senha deve ter ao menos 6 caracteres");
      return;
    }
    await invokeAdmin({ action: "reset_password", target_user_id: userId, new_password: newPassword }, "pwd");
    setNewPassword("");
  };

  const toggleStatus = async () => {
    if (!data) return;
    const next = data.status === "ativo" ? "inativo" : "ativo";
    await invokeAdmin({ action: "set_status", target_user_id: userId, status: next }, "status");
    setData({ ...data, status: next });
  };

  const changeEmail = async () => {
    if (!newEmail || newEmail === data?.email) return;
    await invokeAdmin({ action: "change_email", target_user_id: userId, new_email: newEmail }, "email");
    if (data) setData({ ...data, email: newEmail });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "Como administrador central, você pode editar todos os dados."
              : "Você pode editar apenas usuários que criou."}
          </DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : !canManage ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <ShieldAlert className="mx-auto mb-2" size={22} />
            Você não tem permissão para editar este usuário.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={data.nome} onChange={(e) => setData({ ...data, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail (atual)</Label>
                <Input value={data.email} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={data.telefone} onChange={(e) => setData({ ...data, telefone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={data.status} onValueChange={(v) => setData({ ...data, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input value={data.cidade} onChange={(e) => setData({ ...data, cidade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <EstadoSelect value={data.estado} onChange={(uf) => setData({ ...data, estado: uf })} />
              </div>
            </div>

            {isAdmin && (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Perfil de acesso (admin)</p>
                <Select value={data.role || ""} onValueChange={(v) => setData({ ...data, role: v as UserRole })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador central</SelectItem>
                    <SelectItem value="consultor">Consultor</SelectItem>
                    <SelectItem value="empresa">Empresa</SelectItem>
                    <SelectItem value="canal">Canal</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Alterar o perfil substitui o papel principal do usuário na plataforma.
                </p>
              </div>
            )}

            <div className="rounded-lg border border-border p-4 space-y-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Sub-papel na empresa</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select value={data.empresa_papel || "none"} onValueChange={(v) => setData({ ...data, empresa_papel: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vínculo</SelectItem>
                    {empresaPapeis.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {data.empresa_papel && (
                  <Select
                    value={data.empresa_user_id || ""}
                    onValueChange={(v) => setData({ ...data, empresa_user_id: v })}
                    disabled={!isAdmin && empresas.length <= 1}
                  >
                    <SelectTrigger><SelectValue placeholder="Empresa vinculada" /></SelectTrigger>
                    <SelectContent>
                      {empresas.map((e) => (
                        <SelectItem key={e.user_id} value={e.user_id}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {isAdmin && (
              <>
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Lock size={12} /> Resetar senha
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Nova senha (mín. 6)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <Button variant="outline" onClick={resetPassword} disabled={busyAction === "pwd" || !newPassword}>
                      {busyAction === "pwd" ? "..." : "Aplicar"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Alterar e-mail de login</p>
                  <div className="flex gap-2">
                    <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                    <Button variant="outline" onClick={changeEmail} disabled={busyAction === "email" || !newEmail || newEmail === data.email}>
                      {busyAction === "email" ? "..." : "Alterar"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-destructive flex items-center gap-1.5">
                      <Power size={12} /> {data.status === "ativo" ? "Desativar acesso" : "Reativar acesso"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {data.status === "ativo"
                        ? "Impede o usuário de fazer login."
                        : "Restaura o login deste usuário."}
                    </p>
                  </div>
                  <Button variant={data.status === "ativo" ? "destructive" : "outline"} onClick={toggleStatus} disabled={busyAction === "status"}>
                    {busyAction === "status" ? "..." : data.status === "ativo" ? "Desativar" : "Reativar"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Fechar</Button>
          <Button onClick={salvar} disabled={saving || !canManage || loading}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
